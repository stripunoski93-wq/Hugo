import { initMemory, createTask, listTasks, memorySet, memoryGet, memorySearch } from '../src/memory.js';

async function runTests() {
  console.log('🧪 Running smoke tests...');

  try {
    await initMemory();
    console.log('✓ Memory initialized');

    const task = await createTask({
      title: 'Test task',
      team: 'Command',
      agent: 'Planner',
      status: 'Тече',
      progress: 50
    });
    console.log(`✓ Task created: ${task.id}`);

    const tasks = await listTasks();
    console.log(`✓ Listed ${tasks.length} tasks`);

    await memorySet('test_key', { value: 'test' });
    const memValue = await memoryGet('test_key');
    console.log(`✓ Memory set/get: ${JSON.stringify(memValue)}`);

    const results = await memorySearch('test');
    console.log(`✓ Memory search found ${results.length} results`);

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests();
