import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import {
  initMemory,
  listTasks,
  memorySearch,
  updateTaskStatus,
  addEvent,
  createTask,
  memorySet
} from './memory.js';
import { loadAgents } from './agents.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '127.0.0.1';

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const broadcastClients = new Set();

function broadcast(message) {
  broadcastClients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  broadcastClients.add(ws);
  ws.send(JSON.stringify({ type: 'connected', message: 'Connected to HUGO Studio' }));
  ws.on('close', () => broadcastClients.delete(ws));
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'HUGO Studio', host: HOST, port: PORT });
});

app.get('/api/board', async (req, res) => {
  const tasks = await listTasks();
  res.json(tasks);
});

app.get('/api/memory/search', async (req, res) => {
  const term = req.query.q || '';
  const results = term ? await memorySearch(term) : [];
  res.json(results);
});

app.get('/api/agents', async (req, res) => {
  const agents = await loadAgents();
  res.json(agents);
});

app.post('/api/jobs', async (req, res) => {
  const command = String(req.query.command || req.body.command || 'Нова задача');
  const task = await createTask({
    title: command,
    team: 'Command',
    agent: 'Planner',
    status: 'Тече',
    progress: 10,
    payload: { command }
  });

  await memorySet('last_command', { id: task.id, command, timestamp: new Date().toISOString() });
  await addEvent(task.id, 'created', command);

  broadcast({ type: 'task_created', task });
  res.json({ ok: true, task });
});

app.post('/api/jobs/:id/approve', async (req, res) => {
  const id = req.params.id;
  await updateTaskStatus(id, 'Готово', 100);
  await addEvent(id, 'approved', 'Task approved');
  broadcast({ type: 'task_updated', taskId: id, status: 'Готово', progress: 100 });
  res.json({ ok: true });
});

app.post('/api/jobs/:id/reject', async (req, res) => {
  const id = req.params.id;
  await updateTaskStatus(id, 'Отклонено', 0);
  await addEvent(id, 'rejected', 'Task rejected');
  broadcast({ type: 'task_updated', taskId: id, status: 'Отклонено', progress: 0 });
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function boot() {
  await initMemory();
  server.listen(PORT, HOST, () => {
    console.log(`HUGO Studio на http://${HOST}:${PORT}`);
  });
}

boot().catch(console.error);
