import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentsPath = path.join(__dirname, '..', 'agents', 'agents.yaml');

export async function loadAgents() {
  try {
    const content = fs.readFileSync(agentsPath, 'utf-8');
    const data = yaml.load(content);
    return data.teams || [];
  } catch (error) {
    console.error('Failed to load agents:', error.message);
    return [];
  }
}
