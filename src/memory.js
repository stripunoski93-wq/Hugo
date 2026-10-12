import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'memory.db');
const db = new sqlite3.Database(dbPath);

const schema = `
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
`;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export async function initMemory() {
  return run(schema);
}

export async function memoryGet(key) {
  const row = await get('SELECT value FROM memory WHERE key = ?', [key]);
  return row ? JSON.parse(row.value) : null;
}

export async function memorySet(key, value) {
  const payload = JSON.stringify(value);
  const existing = await get('SELECT id FROM memory WHERE key = ?', [key]);
  if (existing) {
    await run('UPDATE memory SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?', [payload, key]);
  } else {
    await run('INSERT INTO memory (id, key, value) VALUES (?, ?, ?)', [uuidv4(), key, payload]);
  }
  return { key, value };
}

export async function memoryAppend(key, value) {
  const current = (await memoryGet(key)) || [];
  const next = Array.isArray(current) ? [...current, value] : [value];
  return memorySet(key, next);
}

export async function memorySearch(term) {
  const rows = await all('SELECT key, value FROM memory WHERE key LIKE ? OR value LIKE ?', [`%${term}%`, `%${term}%`]);
  return rows.map((row) => ({ key: row.key, value: JSON.parse(row.value) }));
}

export async function createTask(task) {
  const id = task.id || uuidv4();
  const payload = JSON.stringify(task.payload || {});
  await run(
    `INSERT INTO tasks (id, title, team, agent, status, progress, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, status = excluded.status, progress = excluded.progress, updated_at = CURRENT_TIMESTAMP`,
    [id, task.title, task.team, task.agent, task.status || 'Тече', task.progress || 0, payload]
  );
  return { id, ...task, status: task.status || 'Тече', progress: task.progress || 0 };
}

export async function listTasks() {
  const rows = await all('SELECT * FROM tasks ORDER BY created_at DESC');
  return rows.map((row) => ({ ...row, payload: row.payload ? JSON.parse(row.payload) : {} }));
}

export async function updateTaskStatus(id, status, progress) {
  const row = await get('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!row) return null;
  await run('UPDATE tasks SET status = ?, progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, progress, id]);
  return { id, status, progress };
}

export async function addEvent(taskId, type, detail) {
  await run('INSERT INTO events (id, task_id, type, detail) VALUES (?, ?, ?, ?)', [uuidv4(), taskId, type, detail]);
}

export { db };
