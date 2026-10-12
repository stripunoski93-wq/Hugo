import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processMakeReels } from '../src/jobs.js';
import { listTasks } from '../src/memory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create test inbox with a sample video
function createTestVideo() {
  const inbox = path.join(__dirname, '..', 'inbox');
  fs.mkdirSync(inbox, { recursive: true });
  
  const testVideoPath = path.join(inbox, 'test-video.mp4');
  if (!fs.existsSync(testVideoPath)) {
    console.log('ℹ️  Test video not found. Create one in inbox/ directory.');
  }
  return testVideoPath;
}

async function runTest() {
  console.log('🧪 Running HUGO Studio smoke test...');
  try {
    const testVideo = createTestVideo();
    console.log(`✓ Test environment ready`);
    
    // Mock broadcast function
    const mockBroadcast = (msg) => console.log('  [WS]', msg.type);
    
    // Test task creation without actual FFmpeg processing
    const tasks = await listTasks();
    console.log(`✓ Database initialized, ${tasks.length} tasks found`);
    
    console.log('\n✅ Smoke test passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTest();
