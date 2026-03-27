import { createServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { MovementManager, type MovementInput, type PlayerMovementState } from './MovementManager';
import { FireballManager } from './FireballManager';
import { EnemyManager, type EnemyTemplate } from './EnemyManager';
import { CollisionManager } from './CollisionManager';
import { ScreenManager } from './ScreenManager';
import { connectDb, getTopScores, saveScore } from './db';

const PORT = Number(process.env.PORT ?? 3001);

const WORLD_WIDTH = 1920;
const WORLD_HEIGHT = 1080;
const SPRITE_HEIGHT = Math.round(WORLD_HEIGHT * 0.15);
const PLAYER_HEIGHT = Math.round(WORLD_HEIGHT * 0.22);
const PLAYER_WIDTH = Math.round(PLAYER_HEIGHT * 1.4);
const FIREBALL_SIZE = Math.round(SPRITE_HEIGHT * 0.5);
const FIRE_RATE = 30;
const BASE_LANCE_RATE = 200;
const MIN_LANCE_RATE = 70;
const BASE_LANCE_SPEED_X = -5;
const MAX_LANCE_SPEED_X = -12;
const LANCE_HEIGHT = Math.round(SPRITE_HEIGHT * 0.5);
const LANCE_WIDTH = Math.round(LANCE_HEIGHT * 3);
const KILL_POINTS = 25;
const SURVIVAL_SCORE_INTERVAL_MS = 1000;
const ENEMY_BASE_SPAWN_MIN_MS = 1900;
const ENEMY_BASE_SPAWN_MAX_MS = 2800;
const ENEMY_MIN_SPAWN_MIN_MS = 550;
const ENEMY_MIN_SPAWN_MAX_MS = 1000;
const ENEMY_MAX_SPEED_MULTIPLIER = 2.3;
const DIFFICULTY_MAX_TIME_MS = 5 * 60_000;
const DIFFICULTY_MAX_SCORE = 10_000;
const EMPTY_ROOM_TTL_MS = 10 * 60_000;
const GOBLIN_GIANT_SHOOT_COOLDOWN = 180; // 3 secondes à 60 FPS
const GOBLIN_GIANT_LANCE_SPEED = 8;

const ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    type: 'grunt',
    weight: 55,
    width: SPRITE_HEIGHT,
    height: SPRITE_HEIGHT,
    hp: 4,
    minSpeed: 2,
    maxSpeed: 3.2,
    behavior: {
      update(mob, context) {
        mob.x -= mob.speed * context.speedMultiplier * context.deltaFrames;
      },
    },
  },
  {
    type: 'scout',
    weight: 30,
    width: Math.round(SPRITE_HEIGHT * 0.78),
    height: Math.round(SPRITE_HEIGHT * 0.78),
    hp: 2,
    minSpeed: 3.4,
    maxSpeed: 5,
    behavior: {
      update(mob, context) {
        mob.x -= mob.speed * context.speedMultiplier * context.deltaFrames;
      },
    },
  },
  {
    type: 'waver',
    weight: 15,
    width: Math.round(SPRITE_HEIGHT * 1.2),
    height: Math.round(SPRITE_HEIGHT * 1.2),
    hp: 5,
    minSpeed: 1.8,
    maxSpeed: 2.8,
    behavior: {
      update(mob, context) {
        mob.x -= mob.speed * context.speedMultiplier * context.deltaFrames;
        const amplitude = Math.max(20, mob.height * 0.5);
        mob.y = mob.baseY + Math.sin(mob.ageMs / 240) * amplitude;
      },
    },
  },
  {
    type: 'goblin_giant',
    weight: 20,
    width: 83 * 2,
    height: 126 * 2,
    hp: 6,
    minSpeed: 1.2,
    maxSpeed: 1.8,
    behavior: {
      update(mob, context) {
        mob.x -= mob.speed * context.speedMultiplier * context.deltaFrames;
        // Le géant goblin marche au sol
        mob.y = context.bounds.height - mob.height;
      },
    },
  },
];

interface HeartData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ttl: number;
}

interface LanceData {
  x: number;
  y: number;
  width: number;
  height: number;
  speedX: number;
  speedY?: number;
}

interface DifficultyState {
  enemySpawnMinMs: number;
  enemySpawnMaxMs: number;
  enemySpeedMultiplier: number;
  lanceRateFrames: number;
  lanceSpeedX: number;
}

interface PlayerData {
  id: string;
  username: string;
  x: number;
  y: number;
  width: number;
  height: number;
  speedX: number;
  speedY: number;
  lives: number;
  invincible: boolean;
  invincibleTimer: number;
  movementManager: MovementManager;
  fireballManager: FireballManager;
  score: number;
  survivalMsRemainder: number;
  scoreSaved: boolean;
}

interface GameRoom {
  id: string;
  createdAt: number;
  startedAt: number;
  lastTickAt: number;
  players: Map<string, PlayerData>;
  lances: LanceData[];
  lanceCooldown: number;
  currentLanceRate: number;
  currentLanceSpeedX: number;
  hearts: HeartData[];
  nextHeartId: number;
  goblinGiantCooldowns: Map<number, number>;
  enemyManager: EnemyManager;
  collisionManager: CollisionManager;
}

interface LobbyRoomSummary {
  id: string;
  playerCount: number;
  createdAt: number;
}

interface JoinRoomPayload {
  roomId: string;
  username?: string;
}

interface CreateAndJoinPayload {
  username?: string;
}

const HEART_SPAWN_CHANCE_PER_TICK = 0.0001;
const HEART_TTL_TICKS = 60 * 8;
const HEART_SIZE = Math.round(SPRITE_HEIGHT * 0.35);

const SPAWN_POSITIONS = [
  { x: 200, y: WORLD_HEIGHT - PLAYER_HEIGHT - 50 },
  { x: 450, y: WORLD_HEIGHT - PLAYER_HEIGHT - 50 },
];

const screenManager = new ScreenManager();
screenManager.setSize(WORLD_WIDTH, WORLD_HEIGHT);

const rooms = new Map<string, GameRoom>();
const socketToRoomId = new Map<string, string>();
let nextRoomId = 1;

function sanitizeUsername(value: unknown, socketId: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw) return raw.slice(0, 32);
  return `player-${socketId.slice(0, 6)}`;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function computeDifficulty(elapsedMs: number, totalScore: number): DifficultyState {
  const timeProgress = clamp(elapsedMs / DIFFICULTY_MAX_TIME_MS, 0, 1);
  const scoreProgress = clamp(totalScore / DIFFICULTY_MAX_SCORE, 0, 1);
  const progress = clamp(timeProgress * 0.6 + scoreProgress * 0.4, 0, 1);

  return {
    enemySpawnMinMs: Math.round(lerp(ENEMY_BASE_SPAWN_MIN_MS, ENEMY_MIN_SPAWN_MIN_MS, progress)),
    enemySpawnMaxMs: Math.round(lerp(ENEMY_BASE_SPAWN_MAX_MS, ENEMY_MIN_SPAWN_MAX_MS, progress)),
    enemySpeedMultiplier: lerp(1, ENEMY_MAX_SPEED_MULTIPLIER, progress),
    lanceRateFrames: Math.round(lerp(BASE_LANCE_RATE, MIN_LANCE_RATE, progress)),
    lanceSpeedX: lerp(BASE_LANCE_SPEED_X, MAX_LANCE_SPEED_X, progress),
  };
}

function createRoomId(): string {
  const roomId = `room-${String(nextRoomId).padStart(4, '0')}`;
  nextRoomId += 1;
  return roomId;
}

function buildLobbyRoomSummary(room: GameRoom): LobbyRoomSummary {
  return {
    id: room.id,
    playerCount: room.players.size,
    createdAt: room.createdAt,
  };
}

function getLobbyRoomList(): LobbyRoomSummary[] {
  return [...rooms.values()]
    .filter(room => room.players.size > 0)
    .map(buildLobbyRoomSummary)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function createRoom(now = Date.now()): GameRoom {
  const enemyManager = new EnemyManager();
  enemyManager.setTemplates(ENEMY_TEMPLATES);

  const initialDifficulty = computeDifficulty(0, 0);
  enemyManager.setDynamicDifficulty({
    minSpawnDelayMs: initialDifficulty.enemySpawnMinMs,
    maxSpawnDelayMs: initialDifficulty.enemySpawnMaxMs,
    speedMultiplier: initialDifficulty.enemySpeedMultiplier,
  }, now);

  return {
    id: createRoomId(),
    createdAt: now,
    startedAt: now,
    lastTickAt: now,
    players: new Map(),
    lances: [],
    lanceCooldown: BASE_LANCE_RATE,
    currentLanceRate: BASE_LANCE_RATE,
    currentLanceSpeedX: BASE_LANCE_SPEED_X,
    hearts: [],
    nextHeartId: 1,
    goblinGiantCooldowns: new Map(),
    enemyManager,
    collisionManager: new CollisionManager(),
  };
}

function createPlayer(socketId: string, username: string, spawn: { x: number; y: number }): PlayerData {
  const movementManager = new MovementManager();
  const fireballManager = new FireballManager();
  fireballManager.setConfig(FIRE_RATE, FIREBALL_SIZE);

  return {
    id: socketId,
    username,
    x: spawn.x,
    y: spawn.y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speedX: 0,
    speedY: 0,
    lives: 3,
    invincible: false,
    invincibleTimer: 0,
    movementManager,
    fireballManager,
    score: 0,
    survivalMsRemainder: 0,
    scoreSaved: false,
  };
}

function getRoomOfSocket(socketId: string): GameRoom | null {
  const roomId = socketToRoomId.get(socketId);
  if (!roomId) return null;
  return rooms.get(roomId) ?? null;
}

function publishLobbyRooms(io: Server, target?: Socket): void {
  const roomsList = getLobbyRoomList();
  if (target) {
    target.emit('lobby:rooms', roomsList);
    return;
  }
  io.emit('lobby:rooms', roomsList);
}

function savePlayerScore(roomId: string, player: PlayerData): void {
  if (player.scoreSaved) return;
  player.scoreSaved = true;

  try {
    saveScore({
      username: player.username,
      score: player.score,
      roomId,
    });
  } catch (error) {
    player.scoreSaved = false;
    console.error(`[db] unable to save score for ${player.username}`, error);
  }
}

function leaveCurrentRoom(io: Server, socket: Socket): void {
  const roomId = socketToRoomId.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  socketToRoomId.delete(socket.id);
  socket.leave(roomId);

  if (!room) {
    publishLobbyRooms(io);
    return;
  }

  const player = room.players.get(socket.id);
  if (player) {
    savePlayerScore(room.id, player);
  }

  room.players.delete(socket.id);
  io.to(room.id).emit('player_left', { id: socket.id });

  if (room.players.size === 0) {
    room.createdAt = Date.now();
  }

  publishLobbyRooms(io);
}

function joinRoom(io: Server, socket: Socket, roomId: string, username: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  leaveCurrentRoom(io, socket);

  socket.join(room.id);
  const spawnIndex = room.players.size % SPAWN_POSITIONS.length;
  const spawn = SPAWN_POSITIONS[spawnIndex]!;
  const player = createPlayer(socket.id, username, spawn);

  room.players.set(socket.id, player);
  socketToRoomId.set(socket.id, room.id);

  io.to(room.id).emit('player_joined', { id: socket.id });
  socket.emit('game:joined', { roomId: room.id });
  publishLobbyRooms(io);

  return true;
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Socket.IO server running');
});

const io = new Server(httpServer, {
  cors: { origin: true },
});

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  publishLobbyRooms(io, socket);

  socket.on('lobby:list', () => {
    publishLobbyRooms(io, socket);
  });

  socket.on('leaderboard:list', () => {
    try {
      const topScores = getTopScores(10);
      socket.emit('leaderboard:top', topScores);
    } catch (error) {
      console.error('[db] unable to fetch leaderboard', error);
      socket.emit('leaderboard:top', []);
    }
  });

  socket.on('lobby:create', () => {
    const room = createRoom();
    rooms.set(room.id, room);
    socket.emit('lobby:created', { roomId: room.id });
    publishLobbyRooms(io);
  });

  socket.on('game:createAndJoin', (payload?: CreateAndJoinPayload) => {
    const username = sanitizeUsername(payload?.username, socket.id);
    const room = createRoom();
    rooms.set(room.id, room);
    joinRoom(io, socket, room.id, username);
  });

  socket.on('game:joinRoom', (payload: JoinRoomPayload) => {
    const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
    const username = sanitizeUsername(payload?.username, socket.id);
    if (!roomId) {
      socket.emit('game:joinError', { message: 'Identifiant de partie invalide.' });
      return;
    }

    const joined = joinRoom(io, socket, roomId, username);
    if (!joined) {
      socket.emit('game:joinError', { message: 'Partie introuvable ou déjà terminée.' });
    }
  });

  socket.on('game:leaveRoom', () => {
    leaveCurrentRoom(io, socket);
  });

  socket.on('player:input', (input: MovementInput) => {
    const room = getRoomOfSocket(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player || player.lives <= 0) return;

    const state: PlayerMovementState = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
      speedX: player.speedX,
      speedY: player.speedY,
    };

    const next = player.movementManager.updatePlayer(state, input, screenManager.getBounds());
    player.x = next.x;
    player.y = next.y;
    player.speedX = next.speedX;
    player.speedY = next.speedY;
  });

  socket.on('player:modifyShootMode', (data: { modeShootAuto?: boolean }) => {
    const room = getRoomOfSocket(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player || player.lives <= 0) return;

    player.fireballManager.setFireMode(data.modeShootAuto ? 'auto' : 'click');
  });

  socket.on('player:click', ({ x, y }: { x: number; y: number }) => {
    const room = getRoomOfSocket(socket.id);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player || player.lives <= 0) return;

    player.fireballManager.queueClickShot(x, y);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(io, socket);
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

setInterval(() => {
  const now = Date.now();
  const bounds = screenManager.getBounds();

  for (const [roomId, room] of rooms) {
    if (room.players.size === 0 && now - room.createdAt > EMPTY_ROOM_TTL_MS) {
      rooms.delete(roomId);
      publishLobbyRooms(io);
      continue;
    }

    const totalScore = [...room.players.values()].reduce((sum, player) => sum + player.score, 0);
    const elapsedMs = now - room.startedAt;
    const deltaMs = Math.max(0, now - room.lastTickAt);
    room.lastTickAt = now;
    const difficulty = computeDifficulty(elapsedMs, totalScore);

    room.enemyManager.setDynamicDifficulty({
      minSpawnDelayMs: difficulty.enemySpawnMinMs,
      maxSpawnDelayMs: difficulty.enemySpawnMaxMs,
      speedMultiplier: difficulty.enemySpeedMultiplier,
    }, now);

    room.currentLanceRate = difficulty.lanceRateFrames;
    room.currentLanceSpeedX = difficulty.lanceSpeedX;

    if (room.lanceCooldown > room.currentLanceRate) {
      room.lanceCooldown = room.currentLanceRate;
    }

    const enemyStates = room.enemyManager.updateEnemies(bounds, now);

    // Logique de tir pour les géants goblins
    for (const enemy of enemyStates) {
      if (enemy.type === 'goblin_giant') {
        const cooldown = room.goblinGiantCooldowns.get(enemy.id) ?? 0;

        if (cooldown <= 0) {
          // Trouver un joueur vivant à cibler
          const alivePlayers = [...room.players.values()].filter(p => p.lives > 0);
          if (alivePlayers.length > 0) {
            const targetPlayer = alivePlayers[0]!;

            // Position de départ de la lance (centre du géant goblin)
            const lanceX = enemy.x;
            const lanceY = enemy.y + enemy.height * 0.5;

            // Position cible (centre du joueur)
            const targetX = targetPlayer.x + targetPlayer.width * 0.5;
            const targetY = targetPlayer.y + targetPlayer.height * 0.5;

            // Calculer la direction
            const dx = targetX - lanceX;
            const dy = targetY - lanceY;
            const distance = Math.hypot(dx, dy);

            if (distance > 0) {
              const speedX = (dx / distance) * GOBLIN_GIANT_LANCE_SPEED;
              const speedY = (dy / distance) * GOBLIN_GIANT_LANCE_SPEED;

              room.lances.push({
                x: lanceX,
                y: lanceY - LANCE_HEIGHT / 2,
                width: LANCE_WIDTH,
                height: LANCE_HEIGHT,
                speedX,
                speedY,
              });
            }

            room.goblinGiantCooldowns.set(enemy.id, GOBLIN_GIANT_SHOOT_COOLDOWN);
          }
        } else {
          room.goblinGiantCooldowns.set(enemy.id, cooldown - 1);
        }
      }
    }

    // Nettoyer les cooldowns des ennemis qui n'existent plus
    const activeEnemyIds = new Set(enemyStates.map(e => e.id));
    for (const [enemyId] of room.goblinGiantCooldowns) {
      if (!activeEnemyIds.has(enemyId)) {
        room.goblinGiantCooldowns.delete(enemyId);
      }
    }

    if (Math.random() < HEART_SPAWN_CHANCE_PER_TICK) {
      const x = bounds.width - Math.random() * (bounds.width * 0.25);
      const y = Math.random() * Math.max(0, bounds.height - HEART_SIZE);
      room.hearts.push({
        id: room.nextHeartId++,
        x,
        y,
        width: HEART_SIZE,
        height: HEART_SIZE,
        ttl: HEART_TTL_TICKS,
      });
    }

    room.lanceCooldown -= 1;
    if (room.lanceCooldown <= 0 && enemyStates.length > 0) {
      const shooter = enemyStates[Math.floor(Math.random() * enemyStates.length)]!;

      let lanceSpeedX = room.currentLanceSpeedX; // par défaut vers la gauche
      const players = [...room.players.values()];
      if (players.length > 0) {
        const mainPlayer = players[0]!;
        // Si le joueur est à droite de l'ennemi, tirer vers la droite
        if (mainPlayer.x > shooter.x) {
          lanceSpeedX = -lanceSpeedX; // inverser la direction
        }
      }

      room.lances.push({
        x: shooter.x,
        y: shooter.y + shooter.height * 0.5 - LANCE_HEIGHT / 2,
        width: LANCE_WIDTH,
        height: LANCE_HEIGHT,
        speedX: lanceSpeedX,
      });
      room.lanceCooldown = room.currentLanceRate;
    }

    for (const lance of room.lances) {
      lance.x += lance.speedX;
      if (lance.speedY !== undefined) {
        lance.y += lance.speedY;
      }
    }
    room.lances = room.lances.filter((lance) => (
      lance.x + lance.width > 0 &&
      lance.x < bounds.width &&
      lance.y + lance.height > 0 &&
      lance.y < bounds.height
    ));

    for (const heart of room.hearts) {
      heart.x += room.currentLanceSpeedX;
      heart.ttl -= 1;
    }
    room.hearts = room.hearts.filter((heart) => heart.ttl > 0 && heart.x + heart.width > 0);

    const lanceStates = room.lances.map((lance) => ({
      x: lance.x,
      y: lance.y,
      width: lance.width,
      height: lance.height,
    }));

    const allRemovedLanceIndices = new Set<number>();
    const playerStates: Record<string, object> = {};

    for (const [playerId, player] of room.players) {
      if (player.lives > 0) {
        player.survivalMsRemainder += deltaMs;
        if (player.survivalMsRemainder >= SURVIVAL_SCORE_INTERVAL_MS) {
          const survivalPoints = Math.floor(player.survivalMsRemainder / SURVIVAL_SCORE_INTERVAL_MS);
          player.score += survivalPoints;
          player.survivalMsRemainder %= SURVIVAL_SCORE_INTERVAL_MS;
        }
      }

      if (player.invincible) {
        player.invincibleTimer -= 1;
        if (player.invincibleTimer <= 0) player.invincible = false;
      }

      const state: PlayerMovementState = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
        speedX: player.speedX,
        speedY: player.speedY,
      };

      const fireballs = player.fireballManager.updateProjectiles(state, bounds);

      const result = room.collisionManager.checkCollisions(
        state,
        player.invincible,
        player.fireballManager.getFireballs(),
        room.enemyManager.getEnemies(),
        lanceStates,
        room.hearts.map((heart) => ({
          id: heart.id,
          x: heart.x,
          y: heart.y,
          width: heart.width,
          height: heart.height,
        })),
        room.enemyManager
      );

      if (result.removedFireballIds.length > 0) {
        player.fireballManager.removeProjectilesByIds(result.removedFireballIds);
      }

      if (result.removedEnemyIds.length > 0) {
        room.enemyManager.removeEnemiesByIds(result.removedEnemyIds);
        player.score += result.removedEnemyIds.length * KILL_POINTS;
      }

      if (result.removedHeartIds.length > 0) {
        const removedHearts = new Set(result.removedHeartIds);
        room.hearts = room.hearts.filter((heart) => !removedHearts.has(heart.id));
        player.lives += result.removedHeartIds.length;
      }

      for (const removedIndex of result.removedLanceIndices) {
        allRemovedLanceIndices.add(removedIndex);
      }

      if (result.playerHit && player.lives > 0) {
        player.lives -= 1;
        player.invincible = true;
        player.invincibleTimer = 120;
        if (player.lives <= 0) {
          savePlayerScore(room.id, player);
        }
      }

      playerStates[playerId] = {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
        lives: player.lives,
        score: player.score,
        invincible: player.invincible,
        fireballs,
      };
    }

    if (allRemovedLanceIndices.size > 0) {
      room.lances = room.lances.filter((_, index) => !allRemovedLanceIndices.has(index));
    }

    io.to(room.id).emit('game:state', {
      players: playerStates,
      enemies: room.enemyManager.getEnemies(),
      lances: lanceStates,
      hearts: room.hearts.map((heart) => ({
        id: heart.id,
        x: Math.round(heart.x),
        y: Math.round(heart.y),
        width: heart.width,
        height: heart.height,
      })),
    });
  }
}, 1000 / 60);

function bootstrap(): void {
  try {
    connectDb();
  } catch (error) {
    console.error('[db] unable to open SQLite database, server startup aborted.', error);
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`[socket] server listening on http://localhost:${PORT}`);
  });
}

bootstrap();
