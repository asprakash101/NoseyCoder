/**
 * NoseyCoder Background Service Worker
 * Handles: OAuth, GitHub API, Fork operations, GitHub Actions, token storage, message routing
 */

import { encryptToken, decryptToken } from './crypto-utils.js';

// ─── Constants & Configuration ───
const GITHUB_CLIENT_ID = 'Iv23liPPAtbri41bKpz2';
const DEFAULT_BACKEND_URL = 'http://localhost:8001';

// ─── State ───
let authToken = null;
let authUser = null;
const repoCache = new Map();

// ─── Initialize Auth State ───
async function initAuth() {
  try {
    const data = await chrome.storage.local.get(['github_token_encrypted', 'github_token', 'github_user']);

    if (data.github_token_encrypted) {
      authToken = await decryptToken(data.github_token_encrypted);
    } else if (data.github_token) {
      // Migrate legacy plaintext token to encrypted storage
      authToken = data.github_token;
      const encrypted = await encryptToken(authToken);
      await chrome.storage.local.set({ github_token_encrypted: encrypted });
      await chrome.storage.local.remove(['github_token']);
    }

    if (authToken) {
      await chrome.storage.session.set({ activeToken: authToken });
      if (data.github_user) {
        authUser = data.github_user;
      } else {
        authUser = await fetchGitHubUser(authToken);
        if (authUser) {
          await chrome.storage.local.set({ github_user: authUser });
        }
      }
    }
  } catch (err) {
    console.error('[NoseyCoder] Failed to initialize auth state:', err);
  }
}

initAuth();
chrome.runtime.onInstalled.addListener(initAuth);

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

    case 'SAVE_MANUAL_TOKEN':
      handleSaveManualToken(message.token, sendResponse);
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

// ─── OAuth 2.0 Flow ───
async function handleLogin(sendResponse) {
  try {
    const settings = await chrome.storage.local.get(['backend_url', 'github_client_id']);
    const backendUrl = settings.backend_url || DEFAULT_BACKEND_URL;
    const clientId = settings.github_client_id || GITHUB_CLIENT_ID;

    // Use chrome.identity to get redirect URL (e.g., https://<ext_id>.chromiumapp.org/)
    const redirectUri = chrome.identity.getRedirectURL();

    const authUrl = `https://github.com/login/oauth/authorize` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent('public_repo,workflow,read:user')}` +
      `&prompt=consent`;

    console.log('[NoseyCoder] Initiating GitHub OAuth flow with redirect URI:', redirectUri);

    const redirectResult = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    if (chrome.runtime.lastError || !redirectResult) {
      const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Login window closed';
      sendResponse({ success: false, error: err });
      return;
    }

    const urlObj = new URL(redirectResult);
    const code = urlObj.searchParams.get('code');
    const oauthError = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');

    if (oauthError) {
      sendResponse({ success: false, error: oauthError });
      return;
    }

    if (!code) {
      sendResponse({ success: false, error: 'No authorization code returned by GitHub.' });
      return;
    }

    // Exchange auth code for token via backend
    const tokenRes = await fetch(`${backendUrl}/api/auth/github/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    });

    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      sendResponse({ success: false, error: errData.detail || `Token exchange failed (HTTP ${tokenRes.status})` });
      return;
    }

    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;
    if (!token) {
      sendResponse({ success: false, error: 'Access token missing in GitHub response.' });
      return;
    }

    authToken = token;

    // Encrypt token before persisting
    const encrypted = await encryptToken(token);
    await chrome.storage.local.set({ github_token_encrypted: encrypted });
    await chrome.storage.local.remove(['github_token']);
    await chrome.storage.session.set({ activeToken: token });

    // Fetch GitHub user profile
    const user = await fetchGitHubUser(token);
    if (user) {
      authUser = user;
      await chrome.storage.local.set({ github_user: user });
      sendResponse({ success: true, user });
    } else {
      sendResponse({ success: true, user: { login: 'authenticated_user' } });
    }
  } catch (err) {
    console.error('[NoseyCoder] OAuth Login error:', err);
    sendResponse({ success: false, error: err.message || 'OAuth authentication failed.' });
  }
}

// ─── Manual PAT Save (with encryption) ───
async function handleSaveManualToken(token, sendResponse) {
  try {
    if (!token) {
      sendResponse({ success: false, error: 'No token provided' });
      return;
    }

    authToken = token;
    const encrypted = await encryptToken(token);
    await chrome.storage.local.set({ github_token_encrypted: encrypted });
    await chrome.storage.local.remove(['github_token']);
    await chrome.storage.session.set({ activeToken: token });

    const user = await fetchGitHubUser(token);
    if (user) {
      authUser = user;
      await chrome.storage.local.set({ github_user: user });
      sendResponse({ success: true, user });
    } else {
      sendResponse({ success: true });
    }
  } catch (err) {
    sendResponse({ success: false, error: err.message });
  }
}

async function handleLogout(sendResponse) {
  authToken = null;
  authUser = null;
  await chrome.storage.local.remove(['github_token', 'github_token_encrypted', 'github_user']);
  await chrome.storage.session.remove(['activeToken']);
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
          name: noseycoder-reports
          path: |
            *-report.json
            *-report.txt
`;

  sendResponse({ success: true, workflow });
}
