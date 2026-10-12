import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gdrivePath = process.env.GDRIVE_LOCAL_DIR || '';

export function getInboxPath() {
  if (gdrivePath && fs.existsSync(gdrivePath)) {
    const inboxPath = path.join(gdrivePath, 'inbox');
    if (fs.existsSync(inboxPath)) return inboxPath;
  }
  const localInbox = path.join(__dirname, '..', 'inbox');
  if (!fs.existsSync(localInbox)) {
    fs.mkdirSync(localInbox, { recursive: true });
  }
  return localInbox;
}

export function listVideoFiles() {
  const inbox = getInboxPath();
  if (!fs.existsSync(inbox)) return [];
  
  return fs.readdirSync(inbox)
    .filter(file => /\.(mp4|mov|mkv|avi|webm)$/i.test(file))
    .map(file => path.join(inbox, file));
}

export function createJobDir(jobName) {
  const jobPath = path.join(__dirname, '..', 'out', jobName);
  fs.mkdirSync(jobPath, { recursive: true });
  return jobPath;
}

export function createCapcutReadyDir(jobPath) {
  const capcut = path.join(jobPath, 'capcut-ready');
  fs.mkdirSync(capcut, { recursive: true });
  return capcut;
}
