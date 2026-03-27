import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = (process.env.DB_PATH ?? '').trim() || path.join(process.cwd(), 'scores.db');

export interface LeaderboardEntry {
  username: string;
  score: number;
  roomId: string;
  finishedAt: number;
}

let db: Database.Database | null = null;

export function connectDb(): void {
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS scores (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL,
      score       INTEGER NOT NULL,
      room_id     TEXT    NOT NULL,
      finished_at INTEGER NOT NULL
    )
  `);
  console.log(`[db] SQLite connecté : ${DB_PATH}`);
}

export function saveScore(input: { username: string; score: number; roomId: string }): void {
  if (!db) return;

  const username = input.username.trim().slice(0, 32) || 'anonymous';
  const score = Number.isFinite(input.score) ? Math.max(0, Math.round(input.score)) : 0;
  const roomId = input.roomId.trim();

  db.prepare(`
    INSERT INTO scores (username, score, room_id, finished_at)
    VALUES (?, ?, ?, ?)
  `).run(username, score, roomId, Date.now());
}

export function getTopScores(limit = 10): LeaderboardEntry[] {
  if (!db) return [];

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.round(limit))) : 10;

  return db
    .prepare(`
      SELECT username, score, room_id AS roomId, finished_at AS finishedAt
      FROM scores
      ORDER BY score DESC, finished_at DESC
      LIMIT ?
    `)
    .all(safeLimit) as LeaderboardEntry[];
}
