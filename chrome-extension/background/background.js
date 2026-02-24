/**
 * NoseyCoder Background Service Worker
 * Handles: OAuth, GitHub API, Fork operations, GitHub Actions, token storage, message routing
 */

// ─── State ───
let authToken = null;
let authUser = null;
const repoCache = new Map();

// ─── Initialize ───
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['github_token', 'github_user'], (data) => {
    if (data.github_token) authToken = data.github_token;
    if (data.github_user) authUser = data.github_user;
  });
});

// ─── Message Handler ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'LOGIN':
      handleLogin(sendResponse);
      return true;

    case 'LOGOUT':
      handleLogout(sendResponse);
      return true;

    case 'GET_AUTH_STATUS':
      sendResponse({ authenticated: !!authToken, user: authUser });
      return true;

    case 'FORK_REPO':
      handleFork(message.owner, message.repo, sendResponse);
      return true;

    case 'CHECK_FORK_STATUS':
      checkForkStatus(message.owner, message.repo, sendResponse);
      return true;

    case 'GENERATE_WORKFLOW':
      generateWorkflow(message.config, sendResponse);
      return true;

    case 'ANALYSIS_RESULTS':
      // Store latest results for popup
      chrome.storage.session.set({ lastAnalysis: message.data });
      return false;

    case 'GET_LAST_ANALYSIS':
      chrome.storage.session.get(['lastAnalysis'], (data) => {
        sendResponse(data.lastAnalysis || null);
      });
      return true;

    default:
      return false;
  }
});

// ─── OAuth (Mocked for now) ───
async function handleLogin(sendResponse) {
  // MOCK: In production, this would use chrome.identity.launchWebAuthFlow
  // with GitHub's OAuth 2.0 Authorization Code Flow
  //
  // Real flow:
  // 1. chrome.identity.launchWebAuthFlow({
  //      url: `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=public_repo,workflow`,
  //      interactive: true
  //    })
  // 2. Exchange code for token at GitHub's token endpoint
  // 3. Store encrypted token

  try {
    // For development: simulate successful auth with a provided token
    // Users can set their own token via the popup settings
    const stored = await chrome.storage.local.get(['github_token']);

    if (stored.github_token) {
      authToken = stored.github_token;
      const user = await fetchGitHubUser(authToken);
      if (user) {
        authUser = user;
        await chrome.storage.local.set({ github_user: user });
        sendResponse({ success: true, user });
        return;
      }
    }

    // Mock login response for demo
    authUser = { login: 'noseycoder-user', avatar_url: '', name: 'NoseyCoder User' };
    await chrome.storage.local.set({ github_user: authUser });
    sendResponse({ success: true, user: authUser, mocked: true });
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleLogout(sendResponse) {
  authToken = null;
  authUser = null;
  await chrome.storage.local.remove(['github_token', 'github_user']);
  sendResponse({ success: true });
}

// ─── GitHub API ───
async function fetchGitHubUser(token) {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

async function handleFork(owner, repo, sendResponse) {
  if (!authToken) {
    sendResponse({ success: false, error: 'Not authenticated. Set your GitHub token in Settings.' });
    return;
  }

  try {
    // Check if already forked
    const existing = await checkUserHasFork(owner, repo);
    if (existing) {
      sendResponse({ success: false, error: 'Already forked', url: existing.html_url });
      return;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/forks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.status === 202) {
      const data = await res.json();
      sendResponse({ success: true, url: data.html_url });
    } else if (res.status === 403) {
      sendResponse({ success: false, error: 'Permission denied or rate limited' });
    } else {
      const err = await res.json();
      sendResponse({ success: false, error: err.message || 'Fork failed' });
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function checkUserHasFork(owner, repo) {
  if (!authToken || !authUser) return null;

  const cacheKey = `${authUser.login}/${repo}`;
  if (repoCache.has(cacheKey)) return repoCache.get(cacheKey);

  try {
    const res = await fetch(`https://api.github.com/repos/${authUser.login}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.fork) {
        repoCache.set(cacheKey, data);
        return data;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function checkForkStatus(owner, repo, sendResponse) {
  if (!authToken) {
    sendResponse({ forked: false, authenticated: false });
    return;
  }

  const fork = await checkUserHasFork(owner, repo);
  sendResponse({ forked: !!fork, url: fork?.html_url, authenticated: true });
}

// ─── GitHub Actions Workflow Generator ───
function generateWorkflow(config, sendResponse) {
  const {
    name = 'NoseyCoder Analysis',
    language = 'javascript',
    triggers = ['push', 'pull_request'],
    branches = ['main', 'develop']
  } = config || {};

  const triggerBlock = triggers.map(t => {
    if (t === 'push' || t === 'pull_request') {
      return `  ${t}:\n    branches: [${branches.map(b => `"${b}"`).join(', ')}]`;
    }
    return `  ${t}:`;
  }).join('\n');

  const languageSteps = language === 'python'
    ? `      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: pip install pylint radon
      - name: Run complexity analysis
        run: radon cc . -a -nc
      - name: Run maintainability index
        run: radon mi . -nc
      - name: Run pylint
        run: pylint **/*.py --exit-zero`
    : `      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run ESLint
        run: npx eslint . --ext .js,.jsx,.ts,.tsx --format json > eslint-report.json || true
      - name: Run complexity report
        run: npx cr . --format json > complexity-report.json || true`;

  const workflow = `name: ${name}

on:
${triggerBlock}

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
${languageSteps}
      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: codescope-reports
          path: |
            *-report.json
            *-report.txt
`;

  sendResponse({ success: true, workflow });
}
