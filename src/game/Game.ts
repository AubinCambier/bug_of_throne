import { ParallaxLayer } from '../Sprite/parallaxLayer';
import type { FireballState } from '../server/FireballManager';
import type { EnemyState } from '../server/EnemyManager';
import { getSessionToken } from '../utils/session.ts';
import { io } from 'socket.io-client';

import playerImgSrc from './img/sprite/dragon.png';
import fireballImgSrc from './img/sprite/fireball.png';
import enemyImgSrc from './img/sprite/heros.png';
import goblinGiantImgSrc from './img/sprite/geant_goblin.png';
import oiseauImgSrc from './img/sprite/oiseau.png';
import pegaseImgSrc from './img/sprite/pegase.png';
import lanceImgSrc from './img/lance.png';
import heartImgSrc from './img/coeur.png';
import montagneImgSrc from './img/background/montagne.png';
import chateauImgSrc from './img/background/chateau.png';
import sapinsImgSrc from './img/background/sapins.png';
import solImgSrc from './img/background/sol.png';

const WORLD_WIDTH = 1920;
const WORLD_HEIGHT = 1080;
let modeShootAuto = false;
let movementMode: 'keyboard' | 'mouse' = 'keyboard';

interface ServerPlayerState {
	x: number;
	y: number;
	width: number;
	height: number;
	lives: number;
	score: number;
	invincible: boolean;
	fireballs: FireballState[];
}

interface ServerGameState {
	players: Record<string, ServerPlayerState>;
	enemies: EnemyState[];
	lances: Array<{ x: number; y: number; width: number; height: number }>;
	hearts: Array<{ id: number; x: number; y: number; width: number; height: number }>;
}

interface StartGameOptions {
	roomId?: string;
}

export function startGame(options: StartGameOptions = {}) {
	const requestedRoomId = options.roomId ?? '';
	const username = getSessionToken().trim();
	const socketServerUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
	const gameView = document.getElementById('game-view');
	if (gameView) {
		gameView.classList.remove('hidden');
	}
	const pauseMenu = document.getElementById('pause-menu');
	pauseMenu?.classList.add('hidden');
	const gameoverMenu = document.getElementById('gameover-menu');
	gameoverMenu?.classList.add('hidden');
	const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')!;
	const context = canvas.getContext('2d')!;

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	const scaleX = canvas.width / WORLD_WIDTH;
	const scaleY = canvas.height / WORLD_HEIGHT;

	const keys: Record<string, boolean> = {};
	const socket = io(socketServerUrl, { autoConnect: false });

	let mySocketId: string | null = null;
	let joinedRoomId: string | null = null;
	let serverGameState: ServerGameState | null = null;
	let gameOver = false;
	let isPaused = false;
	let updateIntervalId: number | null = null;
	let renderFrameId: number | null = null;
	let pendingAction: 'retry' | 'mainmenu' | null = null;
	let joinTimeoutId: number | null = null;
	let connectionIssueHandled = false;

	let mouseX = 0;
	let mouseY = 0;

	const playerImage = new Image();
	const enemyImage = new Image();
	const goblinGiantImage = new Image();
	const oiseauImage = new Image();
	const pegaseImage = new Image();
	const fireballImage = new Image();
	const lanceImage = new Image();
	const heartImage = new Image();
	const montagneImage = new Image();
	const chateauImage = new Image();
	const sapinsImage = new Image();
	const solImage = new Image();

	playerImage.src = playerImgSrc;
	enemyImage.src = enemyImgSrc;
	goblinGiantImage.src = goblinGiantImgSrc;
	oiseauImage.src = oiseauImgSrc;
	pegaseImage.src = pegaseImgSrc;
	fireballImage.src = fireballImgSrc;
	lanceImage.src = lanceImgSrc;
	heartImage.src = heartImgSrc;
	montagneImage.src = montagneImgSrc;
	chateauImage.src = chateauImgSrc;
	sapinsImage.src = sapinsImgSrc;
	solImage.src = solImgSrc;

	const layers: ParallaxLayer[] = [];

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			isPaused = !isPaused;
			togglePauseMenu();
			return;
		}
		if (movementMode !== 'keyboard') return;
		keys[event.key] = true;
	}

	function togglePauseMenu() {
		const pauseMenu = document.getElementById('pause-menu');
		if (!pauseMenu) return;
		if (isPaused) {
			pauseMenu.classList.remove('hidden');
		} else {
			pauseMenu.classList.add('hidden');
		}
	}

	function handleKeyUp(event: KeyboardEvent) {
		if (movementMode !== 'keyboard') return;
		keys[event.key] = false;
	}

	function handleMouseMove(event: MouseEvent) {
		if (movementMode !== 'mouse') return;
		mouseX = event.clientX;
		mouseY = event.clientY;
	}

	function update() {
		if (gameOver || isPaused) return;

		for (const layer of layers) {
			layer.update();
		}

		if (joinedRoomId === null) return;

		if (mySocketId === null) mySocketId = socket.id ?? null;

		const modeAuto = document.querySelector<HTMLInputElement>('#mode-auto')?.checked ?? false;
		const nextMovementMode = document.querySelector<HTMLInputElement>('#move-mode-mouse')?.checked
			? 'mouse'
			: 'keyboard';

		if (nextMovementMode !== movementMode) {
			movementMode = nextMovementMode;
			for (const key of Object.keys(keys)) {
				keys[key] = false;
			}
		}
		
		if (modeAuto !== modeShootAuto) {
			modeShootAuto = modeAuto;
			socket.emit('player:modifyShootMode', { modeShootAuto});
		}
		
		socket.emit('player:input', {
			left: Boolean(keys['ArrowLeft'] || keys['q']),
			right: Boolean(keys['ArrowRight'] || keys['d']),
			up: Boolean(keys['ArrowUp'] || keys['z']),
			down: Boolean(keys['ArrowDown'] || keys['s']),
			useMouse: movementMode === 'mouse',
			mouseX: mouseX / scaleX,
			mouseY: mouseY / scaleY,
		});

		if (serverGameState && mySocketId) {
			const myState = serverGameState.players[mySocketId];
			if (myState !== undefined && myState.lives <= 0) {
				gameOver = true;
				if (updateIntervalId !== null) {
					clearInterval(updateIntervalId);
					updateIntervalId = null;
				}
				window.removeEventListener('keydown', handleKeyDown);
				window.removeEventListener('keyup', handleKeyUp);
				canvas.removeEventListener('mousemove', handleMouseMove);
				canvas.removeEventListener('click', handleCLick);
				toggleGameOverMenu();
				socket.disconnect();
			}
		}
	}

	function toggleGameOverMenu() {
		const gameoverMenu = document.getElementById('gameover-menu');
		if (!gameoverMenu) return;
		if (gameOver) {
			gameoverMenu.classList.remove('hidden');
		} else {
			gameoverMenu.classList.add('hidden');
		}
	}

	function drawUI() {
		context.fillStyle = '#fff';
		context.font = '20px monospace';
		context.textAlign = 'start';

		if (serverGameState !== null && mySocketId !== null) {
			const myState = serverGameState.players[mySocketId];
			const lives = myState?.lives ?? 0;
			const score = myState?.score ?? 0;
			const scoreText = `Score: ${score}`;
			context.fillText(scoreText, 10, 30);
			const scoreWidth = context.measureText(scoreText).width;
			context.fillText('Vies: ' + '❤️'.repeat(Math.max(0, lives)), 10 + scoreWidth + 24, 30);

			let yOffset = 60;
			let playerNum = 2;
			for (const [id, pState] of Object.entries(serverGameState.players)) {
				if (id !== mySocketId) {
					context.fillText(`P${playerNum} Vies: ` + '❤️'.repeat(Math.max(0, pState.lives)), 10, yOffset);
					yOffset += 30;
					playerNum++;
				}
			}
		}
	}

	function render() {
		context.clearRect(0, 0, canvas.width, canvas.height);

		for (const layer of layers) {
			layer.draw(context, canvas.width);
		}

		if (serverGameState !== null) {
			for (const [id, pState] of Object.entries(serverGameState.players)) {
				const sx = Math.round(pState.x * scaleX);
				const sy = Math.round(pState.y * scaleY);
				const sw = Math.round(pState.width * scaleX);
				const sh = Math.round(pState.height * scaleY);

				if (!pState.invincible || Math.floor(Date.now() / 100) % 2 === 0) {
					context.drawImage(playerImage, sx, sy, sw, sh);
				}

				if (id !== mySocketId) {
					context.fillStyle = '#ffff00';
					context.font = '14px monospace';
					context.textAlign = 'center';
					context.fillText('P2', sx + sw / 2, sy - 5);
					context.textAlign = 'start';
				}

				for (const fb of pState.fireballs) {
					context.drawImage(
						fireballImage,
						Math.round(fb.x * scaleX), Math.round(fb.y * scaleY),
						Math.round(fb.width * scaleX), Math.round(fb.height * scaleY),
					);
				}
			}

			for (const enemy of serverGameState.enemies) {
				const enemyImg = enemy.type === 'goblin_giant'
					? goblinGiantImage
					: enemy.type === 'waver'
						? oiseauImage
						: enemy.type === 'grunt'
							? pegaseImage
							: enemyImage;
				const ex = Math.round(enemy.x * scaleX);
				const ey = Math.round(enemy.y * scaleY);
				const ew = Math.round(enemy.width * scaleX);
				const eh = Math.round(enemy.height * scaleY);

				// Dessiner l'ennemi avec flash rouge si touché
				if (enemy.hitFlash) {
					// Canvas offscreen pour isoler le sprite et appliquer le rouge
					const offscreen = document.createElement('canvas');
					offscreen.width = ew;
					offscreen.height = eh;
					const offCtx = offscreen.getContext('2d')!;

					// Miroir horizontal
					offCtx.save();
					offCtx.translate(ew / 2, eh / 2);
					offCtx.scale(-1, 1);
					offCtx.drawImage(enemyImg, -ew / 2, -eh / 2, ew, eh);
					offCtx.restore();

					// Rouge uniquement sur les pixels opaques du sprite
					offCtx.globalCompositeOperation = 'source-atop';
					offCtx.fillStyle = 'rgba(255, 0, 0, 0.45)';
					offCtx.fillRect(0, 0, ew, eh);

					context.drawImage(offscreen, ex, ey);
				} else {
					// Miroir horizontal normal
					context.save();
					context.translate(ex + ew / 2, ey + eh / 2);
					context.scale(-1, 1);
					context.drawImage(enemyImg, -ew / 2, -eh / 2, ew, eh);
					context.restore();
				}
			}

			for (const lance of serverGameState.lances) {
				context.drawImage(
					lanceImage,
					Math.round(lance.x * scaleX), Math.round(lance.y * scaleY),
					Math.round(lance.width * scaleX), Math.round(lance.height * scaleY),
				);
			}

			for (const heart of serverGameState.hearts) {
				context.drawImage(
					heartImage,
					Math.round(heart.x * scaleX), Math.round(heart.y * scaleY),
					Math.round(heart.width * scaleX), Math.round(heart.height * scaleY),
				);
			}
		}

		drawUI();

		renderFrameId = requestAnimationFrame(render);
	}
	function handleCLick(event : MouseEvent) {
		if (gameOver || isPaused) return;
		if(modeShootAuto) return;
		const rect = canvas.getBoundingClientRect();
		
		const canvasX = (event.clientX - rect.left)* (canvas.width / rect.width);
		const canvasY = (event.clientY - rect.top)* (canvas.height / rect.height);
		
		const worldX = canvasX / scaleX;
		const worldY = canvasY / scaleY;

		socket.emit('player:click', { x: worldX, y: worldY });
	}

	function cleanup() {
		if (joinTimeoutId !== null) {
			clearTimeout(joinTimeoutId);
			joinTimeoutId = null;
		}
		if (updateIntervalId !== null) {
			clearInterval(updateIntervalId);
			updateIntervalId = null;
		}
		if (renderFrameId !== null) {
			cancelAnimationFrame(renderFrameId);
			renderFrameId = null;
		}
		window.removeEventListener('keydown', handleKeyDown);
		window.removeEventListener('keyup', handleKeyUp);
		canvas.removeEventListener('mousemove', handleMouseMove);
		canvas.removeEventListener('click', handleCLick);

		// Masquer le menu de game over et le canvas
		const gameoverMenu = document.getElementById('gameover-menu');
		if (gameoverMenu) {
			gameoverMenu.classList.add('hidden');
		}
		const gameView = document.getElementById('game-view');
		if (gameView) {
			gameView.classList.add('hidden');
		}
	}

	function handleConnectionIssue(message: string) {
		if (connectionIssueHandled) return;
		connectionIssueHandled = true;
		alert(message);
		cleanup();
		window.location.reload();
	}

	function init() {
		socket.on('connect', () => {
			mySocketId = socket.id ?? null;
			if (joinTimeoutId !== null) {
				clearTimeout(joinTimeoutId);
			}
			joinTimeoutId = window.setTimeout(() => {
				if (joinedRoomId === null) {
					handleConnectionIssue('Le serveur de jeu ne répond pas.');
				}
			}, 5000);

			if (requestedRoomId) {
				socket.emit('game:joinRoom', { roomId: requestedRoomId, username });
			} else {
				socket.emit('game:createAndJoin', { username });
			}
		});

		socket.on('game:joined', (payload: { roomId?: string }) => {
			const roomId = typeof payload?.roomId === 'string' ? payload.roomId : '';
			if (!roomId) return;
			joinedRoomId = roomId;
			if (joinTimeoutId !== null) {
				clearTimeout(joinTimeoutId);
				joinTimeoutId = null;
			}
		});

		socket.on('game:joinError', (payload: { message?: string }) => {
			const message = payload?.message ?? 'Impossible de rejoindre cette partie.';
			handleConnectionIssue(message);
		});

		socket.on('connect_error', () => {
			handleConnectionIssue('Connexion au serveur de jeu impossible (port 3001).');
		});

		socket.on('game:state', (state: ServerGameState) => {
			serverGameState = state;
		});

		const resumeButton = document.getElementById('resume-button');
		if (resumeButton instanceof HTMLButtonElement) {
			resumeButton.onclick = () => {
				isPaused = false;
				togglePauseMenu();
			};
		}

		const quitButton = document.getElementById('quit-button');
		if (quitButton instanceof HTMLButtonElement) {
			quitButton.onclick = () => {
				socket.emit('game:leaveRoom');
				cleanup();
				window.location.reload();
			};
		}

		const retryButton = document.getElementById('retry-button');
		if (retryButton instanceof HTMLButtonElement) {
			retryButton.onclick = () => {
				pendingAction = 'retry';
				cleanup();
				socket.emit('game:leaveRoom');
				socket.disconnect();
				setTimeout(() => {
					if (pendingAction === 'retry') {
						pendingAction = null;
						startGame();
					}
				}, 500);
			};
		}

		const mainmenuButton = document.getElementById('mainmenu-button');
		if (mainmenuButton instanceof HTMLButtonElement) {
			mainmenuButton.onclick = () => {
				cleanup();
				socket.emit('game:leaveRoom');
				socket.disconnect();
				setTimeout(() => {
					window.location.reload();
				}, 100);
			};
		}

		socket.on('disconnect', () => {
			if (pendingAction === 'retry') {
				pendingAction = null;
				startGame();
			}
		});

		layers.push(new ParallaxLayer({ image: montagneImage, speed: 0.3, y: 0, height: canvas.height }));
		layers.push(new ParallaxLayer({ image: chateauImage, speed: 0.8, y: 0, height: canvas.height }));
		layers.push(new ParallaxLayer({ image: sapinsImage, speed: 1.5, y: 0, height: canvas.height }));
		layers.push(new ParallaxLayer({ image: solImage, speed: 2, y: 0, height: canvas.height }));

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		canvas.addEventListener('mousemove', handleMouseMove);

		updateIntervalId = window.setInterval(update, 1000 / 60);
		renderFrameId = requestAnimationFrame(render);
		if (!modeShootAuto) canvas.addEventListener('click', handleCLick);

		socket.connect();
	}

	if (playerImage.complete) {
		init();
	} else {
		playerImage.addEventListener('load', init, { once: true });
		playerImage.addEventListener('error', init, { once: true });
	}
}
