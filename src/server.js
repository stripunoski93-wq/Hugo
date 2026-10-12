const state = {
  tasks: [],
  agents: [],
  memory: [],
  ws: null
};

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  state.ws = new WebSocket(`${protocol}//${window.location.host}`);
  state.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'task_created') {
      state.tasks.push(data.task);
      renderBoard();
    } else if (data.type === 'task_updated') {
      const task = state.tasks.find((t) => t.id === data.taskId);
      if (task) {
        task.status = data.status;
        task.progress = data.progress;
        renderBoard();
      }
    }
  };
}

function renderBoard() {
  const running = state.tasks.filter((t) => t.status === 'Тече');
  const approval = state.tasks.filter((t) => t.status === 'Чека одобрување');
  const done = state.tasks.filter((t) => t.status === 'Готово' || t.status === 'Отклонено');

  renderCards(running, 'runningBoard');
  renderCards(approval, 'approvalBoard');
  renderCards(done, 'doneBoard');

  document.getElementById('runningCount').textContent = running.length;
  document.getElementById('approvalCount').textContent = approval.length;
  document.getElementById('doneCount').textContent = done.length;
}

function renderCards(tasks, containerId) {
  const container = document.getElementById(containerId);
  if (!tasks.length) {
    container.innerHTML = '<div class="card">Нема задачи.</div>';
    return;
  }

  container.innerHTML = tasks
    .map((task) => `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${task.title}</div>
          <div class="card-badge">${task.agent}</div>
        </div>
        <div class="card-team">${task.team}</div>
        <div class="card-progress">
          <div class="card-progress-bar" style="width: ${task.progress}%"></div>
        </div>
        <div style="color: var(--text-muted); font-size: 12px; margin: 8px 0;">${task.status}</div>
        ${containerId === 'approvalBoard' ? `
          <div class="card-actions">
            <button class="approve-btn" onclick="approveTask('${task.id}')">Одобри</button>
            <button class="reject-btn" onclick="rejectTask('${task.id}')">Одбиј</button>
          </div>
        ` : ''}
      </div>
    `)
    .join('');
}

async function loadAgents() {
  try {
    const res = await fetch('/api/agents');
    state.agents = await res.json();
    renderAgents();
  } catch (error) {
    console.error('Failed to load agents:', error);
  }
}

function renderAgents() {
  const container = document.getElementById('agentsList');
  container.innerHTML = state.agents
    .map(
      (team) => `
      <div class="agent-group">
        <div class="agent-team">${team.name}</div>
        ${team.agents.map((agent) => `<div class="agent-item">• ${agent.name}</div>`).join('')}
      </div>
    `
    )
    .join('');
}

async function loadBoard() {
  try {
    const res = await fetch('/api/board');
    state.tasks = await res.json();
    renderBoard();
  } catch (error) {
    console.error('Failed to load board:', error);
  }
}

async function submitCommand() {
  const command = document.getElementById('commandInput').value.trim();
  if (!command) return;

  try {
    await fetch(`/api/jobs?command=${encodeURIComponent(command)}`, { method: 'POST' });
    document.getElementById('commandInput').value = '';
    await loadBoard();
  } catch (error) {
    console.error('Failed to submit command:', error);
  }
}

async function approveTask(id) {
  try {
    await fetch(`/api/jobs/${id}/approve`, { method: 'POST' });
    await loadBoard();
  } catch (error) {
    console.error('Failed to approve task:', error);
  }
}

async function rejectTask(id) {
  try {
    await fetch(`/api/jobs/${id}/reject`, { method: 'POST' });
    await loadBoard();
  } catch (error) {
    console.error('Failed to reject task:', error);
  }
}

async function searchMemory() {
  const term = document.getElementById('memorySearch').value.trim();
  if (!term) {
    document.getElementById('memoryResults').innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`/api/memory/search?q=${encodeURIComponent(term)}`);
    const results = await res.json();
    const container = document.getElementById('memoryResults');
    container.innerHTML = results
      .map(
        (item) => `
      <div class="memory-item">
        <div class="memory-key">${item.key}</div>
        <div class="memory-value">${JSON.stringify(item.value)}</div>
      </div>
    `
      )
      .join('');
  } catch (error) {
    console.error('Failed to search memory:', error);
  }
}

function setupVoiceInput() {
  const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechCtor) return;

  const recognition = new SpeechCtor();
  recognition.lang = 'mk-MK';
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0].transcript)
      .join('');
    document.getElementById('commandInput').value = transcript;
  };

  document.getElementById('voiceBtn').addEventListener('click', () => {
    recognition.start();
  });
}

document.getElementById('submitBtn').addEventListener('click', submitCommand);
document.getElementById('commandInput').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') submitCommand();
});
document.getElementById('memorySearch').addEventListener('input', searchMemory);

setupVoiceInput();
connectWebSocket();
loadAgents();
loadBoard();
