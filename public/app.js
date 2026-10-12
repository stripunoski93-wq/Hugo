import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'memory.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS memory (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    team TEXT NOT NULL,
    agent TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Тече',
    progress INTEGER DEFAULT 0,
    payload TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    type TEXT NOT NULL,
    detail TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

export async function initMemory() {
  return true;
}

export async function memoryGet(key) {
  const row = db.prepare('SELECT value FROM memory WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

export async function memorySet(key, value) {
  const payload = JSON.stringify(value);
  const existing = db.prepare('SELECT id FROM memory WHERE key = ?').get(key);
  if (existing) {
    db.prepare('UPDATE memory SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(payload, key);
  } else {
    db.prepare('INSERT INTO memory (id, key, value) VALUES (?, ?, ?)').run(uuidv4(), key, payload);
  }
  return { key, value };
}

export async function memoryAppend(key, value) {
  const current = (await memoryGet(key)) || [];
  const next = Array.isArray(current) ? [...current, value] : [value];
  return memorySet(key, next);
}

export async function memorySearch(term) {
  const rows = db.prepare('SELECT key, value FROM memory WHERE key LIKE ? OR value LIKE ?').all(`%${term}%`, `%${term}%`);
  return rows.map((row) => ({ key: row.key, value: JSON.parse(row.value) }));
}

export async function createTask(task) {
  const id = task.id || uuidv4();
  const payload = JSON.stringify(task.payload || {});
  db.prepare(`
    INSERT INTO tasks (id, title, team, agent, status, progress, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, status = excluded.status, progress = excluded.progress, updated_at = CURRENT_TIMESTAMP
  `).run(id, task.title, task.team, task.agent, task.status || 'Тече', task.progress || 0, payload);

  return { id, ...task, status: task.status || 'Тече', progress: task.progress || 0 };
}

export async function listTasks() {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  return rows.map((row) => ({ ...row, payload: row.payload ? JSON.parse(row.payload) : {} }));
}

export async function updateTaskStatus(id, status, progress) {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return null;
  db.prepare('UPDATE tasks SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, progress, id);
  return { id, status, progress };
}

export async function addEvent(taskId, type, detail) {
  db.prepare('INSERT INTO events (id, task_id, type, detail) VALUES (?, ?, ?, ?)').run(uuidv4(), taskId, type, detail);
}

export { db };
