import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'wordandwords.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    language TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    title TEXT,
    state TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_players (
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    turn_order INTEGER NOT NULL,
    PRIMARY KEY (game_id, player_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
  CREATE INDEX IF NOT EXISTS idx_game_players_player ON game_players(player_id);
`);

// Add title column if it doesn't exist (migration for existing DBs)
try {
  db.exec(`ALTER TABLE games ADD COLUMN title TEXT`);
  console.log('Added title column to games table');
} catch (e) {
  // Column already exists, ignore
}

console.log('Database initialized at:', dbPath);

// Player operations
export function createPlayer(id, name) {
  const stmt = db.prepare('INSERT OR REPLACE INTO players (id, name) VALUES (?, ?)');
  stmt.run(id, name);
  return { id, name };
}

export function getPlayer(id) {
  const stmt = db.prepare('SELECT * FROM players WHERE id = ?');
  return stmt.get(id);
}

// Game operations
export function saveGame(game) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO games (id, language, status, title, state, updated_at)
    VALUES (?, ?, ?, ?, ?, unixepoch())
  `);
  stmt.run(game.id, game.language, game.status, game.title || null, JSON.stringify(game));

  // Save game-player associations
  const deleteStmt = db.prepare('DELETE FROM game_players WHERE game_id = ?');
  deleteStmt.run(game.id);

  const insertStmt = db.prepare('INSERT INTO game_players (game_id, player_id, turn_order) VALUES (?, ?, ?)');
  for (let i = 0; i < game.players.length; i++) {
    insertStmt.run(game.id, game.players[i].id, i);
  }

  return game;
}

export function getGame(id) {
  const stmt = db.prepare('SELECT state, title FROM games WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  const game = JSON.parse(row.state);
  game.title = row.title;
  return game;
}

export function getActiveGames() {
  const stmt = db.prepare(`
    SELECT state, title FROM games 
    WHERE status IN ('waiting', 'playing')
    ORDER BY updated_at DESC
    LIMIT 50
  `);
  return stmt.all().map(row => {
    const game = JSON.parse(row.state);
    game.title = row.title;
    return game;
  });
}

export function getArchivedGames() {
  const stmt = db.prepare(`
    SELECT state, title, created_at, updated_at FROM games 
    WHERE status = 'archived'
    ORDER BY updated_at DESC
    LIMIT 100
  `);
  return stmt.all().map(row => {
    const game = JSON.parse(row.state);
    game.title = row.title;
    game.archivedAt = row.updated_at;
    return game;
  });
}

export function archiveGame(id, title = null) {
  // First get the current game to preserve its state
  const game = getGame(id);
  if (!game) return null;

  game.status = 'archived';
  game.title = title || `Game ${id.substring(0, 8)}`;

  const stmt = db.prepare(`
    UPDATE games 
    SET status = 'archived', title = ?, updated_at = unixepoch()
    WHERE id = ?
  `);
  stmt.run(game.title, id);

  // Also update the state JSON
  const updateStateStmt = db.prepare(`UPDATE games SET state = ? WHERE id = ?`);
  updateStateStmt.run(JSON.stringify(game), id);

  return game;
}

export function updateGameTitle(id, title) {
  const stmt = db.prepare('UPDATE games SET title = ?, updated_at = unixepoch() WHERE id = ?');
  const result = stmt.run(title, id);

  // Also update in state JSON
  const game = getGame(id);
  if (game) {
    game.title = title;
    const updateStateStmt = db.prepare(`UPDATE games SET state = ? WHERE id = ?`);
    updateStateStmt.run(JSON.stringify(game), id);
  }

  return result.changes > 0;
}

export function getPlayerGames(playerId) {
  const stmt = db.prepare(`
    SELECT g.state, g.title FROM games g
    JOIN game_players gp ON g.id = gp.game_id
    WHERE gp.player_id = ?
    ORDER BY g.updated_at DESC
    LIMIT 20
  `);
  return stmt.all(playerId).map(row => {
    const game = JSON.parse(row.state);
    game.title = row.title;
    return game;
  });
}

export function deleteGame(id) {
  const stmt = db.prepare('DELETE FROM games WHERE id = ?');
  const result = stmt.run(id);
  console.log(`Deleted game ${id} from database (${result.changes} rows affected)`);
  return result.changes > 0;
}

// Cleanup old finished games (older than 7 days) - only non-archived
export function cleanupOldGames() {
  const stmt = db.prepare(`
    DELETE FROM games 
    WHERE status = 'finished' 
    AND updated_at < unixepoch() - 604800
  `);
  const result = stmt.run();
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} old games`);
  }
}

export default db;

