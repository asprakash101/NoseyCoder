/**
 * CodeScope Popup Script
 * Handles: Tab navigation, displaying analysis results, auth UI, workflow generation
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─── Tab Navigation ───
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  let settingsMode = false;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      settingsMode = false;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      contents.forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // Settings toggle
  document.getElementById('btn-settings').addEventListener('click', () => {
    settingsMode = !settingsMode;
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    if (settingsMode) {
      document.getElementById('tab-settings').classList.add('active');
    } else {
      tabs[0].classList.add('active');
      document.getElementById('tab-dashboard').classList.add('active');
    }
  });

  // ─── Load Analysis ───
  loadAnalysis();

  // ─── Auth ───
  checkAuthStatus();

  document.getElementById('btn-login').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOGIN' }, (res) => {
      if (res && res.success) {
        showAuthState(res.user);
      }
    });
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
      hideAuthState();
    });
  });

  // ─── Token ───
  document.getElementById('btn-save-token').addEventListener('click', () => {
    const token = document.getElementById('token-input').value.trim();
    if (!token) return;
    chrome.storage.local.set({ github_token: token }, () => {
      const status = document.getElementById('token-status');
      status.textContent = 'Token saved securely';
      status.style.color = '#3fb950';
      setTimeout(() => { status.textContent = ''; }, 3000);
    });
  });

  // ─── Settings ───
  loadSettings();
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

  // ─── Heatmap Toggle ───
  document.getElementById('heatmap-toggle').addEventListener('change', (e) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_HEATMAP',
          enabled: e.target.checked
        });
      }
    });
  });

  // ─── Workflow Generator ───
  document.getElementById('btn-generate-workflow').addEventListener('click', () => {
    const lang = document.getElementById('workflow-lang').value;
    const checkboxes = document.querySelectorAll('.checkbox-group input:checked');
    const triggers = Array.from(checkboxes).map(cb => cb.value);

    chrome.runtime.sendMessage({
      type: 'GENERATE_WORKFLOW',
      config: { language: lang, triggers }
    }, (res) => {
      if (res && res.success) {
        document.getElementById('workflow-output').style.display = 'block';
        document.getElementById('workflow-code').textContent = res.workflow;
      }
    });
  });

  document.getElementById('btn-copy-workflow').addEventListener('click', () => {
    const code = document.getElementById('workflow-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById('btn-copy-workflow');
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
});

// ─── Functions ───
function loadAnalysis() {
  // First try getting from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_ANALYSIS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          // Try session storage
          chrome.runtime.sendMessage({ type: 'GET_LAST_ANALYSIS' }, (data) => {
            if (data) renderDashboard(data);
          });
        } else {
          renderDashboard(response);
        }
      });
    }
  });
}

function renderDashboard(data) {
  if (!data || data.error) return;

  document.getElementById('no-analysis').style.display = 'none';
  document.getElementById('analysis-content').style.display = 'block';

  const s = data.summary;

  // File badge
  document.getElementById('file-badge').textContent = `${data.filename} (${data.language})`;

  // Summary cards
  document.getElementById('summary-cards').innerHTML = `
    <div class="metric-card">
      <span class="metric-value">${s.loc}</span>
      <span class="metric-label">LOC</span>
    </div>
    <div class="metric-card">
      <span class="metric-value">${s.functionCount}</span>
      <span class="metric-label">Functions</span>
    </div>
    <div class="metric-card">
      <span class="metric-value" style="color:${s.complexityLevel.color}">${s.cyclomaticComplexity}</span>
      <span class="metric-label">Complexity</span>
    </div>
    <div class="metric-card">
      <span class="metric-value" style="color:${s.maintainabilityLevel.color}">${s.maintainabilityIndex}</span>
      <span class="metric-label">MI Score</span>
    </div>
  `;

  // MI bar
  document.getElementById('mi-section').innerHTML = `
    <div class="mi-label-row">
      <span>Maintainability Index</span>
      <span class="mi-value" style="color:${s.maintainabilityLevel.color}">${s.maintainabilityIndex} — ${s.maintainabilityLevel.label}</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width:${s.maintainabilityIndex}%;background:${s.maintainabilityLevel.color}"></div>
    </div>
  `;

  // Halstead
  document.getElementById('halstead-row').innerHTML = `
    <div class="halstead-item"><span>Volume</span><span class="halstead-val">${s.halstead.volume}</span></div>
    <div class="halstead-item"><span>Difficulty</span><span class="halstead-val">${s.halstead.difficulty}</span></div>
    <div class="halstead-item"><span>Effort</span><span class="halstead-val">${s.halstead.effort}</span></div>
    <div class="halstead-item"><span>Est. Bugs</span><span class="halstead-val">${s.halstead.bugs}</span></div>
    <div class="halstead-item"><span>Time (s)</span><span class="halstead-val">${s.halstead.time}</span></div>
  `;

  // Functions
  document.getElementById('fn-count').textContent = data.functions.length;
  const sorted = [...data.functions].sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);
  document.getElementById('fn-list').innerHTML = sorted.map(fn => `
    <div class="fn-item">
      <div>
        <span class="fn-name">${fn.name}</span>
        <span class="fn-meta">L${fn.startLine} | ${fn.loc} LOC | ${fn.paramCount}p</span>
      </div>
      <span class="fn-cc-badge" style="background:${fn.complexityLevel.color}20;color:${fn.complexityLevel.color}">CC:${fn.cyclomaticComplexity}</span>
    </div>
  `).join('');

  // Linter
  renderLinter(data.linterIssues);

  // Refactor
  renderRefactor(data.refactorSuggestions);
}

function renderLinter(issues) {
  if (!issues || issues.length === 0) {
    document.getElementById('linter-empty').style.display = 'flex';
    document.getElementById('linter-list').innerHTML = '';
    return;
  }

  document.getElementById('linter-empty').style.display = 'none';
  const icons = { critical: '\u26d4', warning: '\u26a0\ufe0f', info: '\u2139\ufe0f' };

  document.getElementById('linter-list').innerHTML = issues.map(i => `
    <div class="issue-item ${i.severity}">
      <span class="issue-icon">${icons[i.severity] || ''}</span>
      <div class="issue-body">
        <span class="issue-rule">${i.rule}</span>
        <span class="issue-msg">${i.message}</span>
      </div>
      <span class="issue-line">L${i.line}</span>
    </div>
  `).join('');
}

function renderRefactor(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    document.getElementById('refactor-empty').style.display = 'flex';
    document.getElementById('refactor-list').innerHTML = '';
    return;
  }

  document.getElementById('refactor-empty').style.display = 'none';
  const priorityColors = { high: '#f85149', medium: '#d29922', low: '#3fb950' };

  document.getElementById('refactor-list').innerHTML = suggestions.map(s => `
    <div class="refactor-item">
      <div class="refactor-header">
        <span class="refactor-priority" style="color:${priorityColors[s.priority]}">${s.priority.toUpperCase()}</span>
        <span class="refactor-title">${s.title}</span>
      </div>
      <p class="refactor-desc">${s.description}</p>
      <span class="refactor-pattern">${s.pattern}</span>
    </div>
  `).join('');
}

function checkAuthStatus() {
  chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (res) => {
    if (res && res.authenticated && res.user) {
      showAuthState(res.user);
    }
  });
}

function showAuthState(user) {
  document.getElementById('auth-logged-out').style.display = 'none';
  document.getElementById('auth-logged-in').style.display = 'block';
  document.getElementById('user-name').textContent = user.name || user.login;
  document.getElementById('user-login').textContent = `@${user.login}`;
  if (user.avatar_url) {
    document.getElementById('user-avatar').src = user.avatar_url;
  }
}

function hideAuthState() {
  document.getElementById('auth-logged-out').style.display = 'block';
  document.getElementById('auth-logged-in').style.display = 'none';
}

function loadSettings() {
  chrome.storage.local.get(['thresholds'], (data) => {
    if (data.thresholds) {
      document.getElementById('threshold-loc').value = data.thresholds.loc || 50;
      document.getElementById('threshold-nesting').value = data.thresholds.nesting || 3;
      document.getElementById('threshold-params').value = data.thresholds.params || 5;
      document.getElementById('threshold-cc').value = data.thresholds.cc || 10;
    }
  });
}

function saveSettings() {
  const thresholds = {
    loc: parseInt(document.getElementById('threshold-loc').value) || 50,
    nesting: parseInt(document.getElementById('threshold-nesting').value) || 3,
    params: parseInt(document.getElementById('threshold-params').value) || 5,
    cc: parseInt(document.getElementById('threshold-cc').value) || 10
  };

  chrome.storage.local.set({ thresholds }, () => {
    // Re-trigger analysis with new thresholds
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'REANALYZE' });
      }
    });
  });
}
