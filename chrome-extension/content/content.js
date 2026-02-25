/**
 * NoseyCoder Content Script
 * Runs on GitHub file pages — injects heatmap, badges, fork button, and analysis panel
 * Updated for GitHub's 2025 React-based file viewer
 */

(() => {
  let analysisResults = null;
  let heatmapEnabled = true;
  let panelVisible = false;
  let initAttempts = 0;
  const MAX_INIT_ATTEMPTS = 30;

  // ─── GitHub DOM Helpers ───
  function isFilePage() {
    // URL-based detection: /owner/repo/blob/branch/path/to/file
    const path = window.location.pathname;
    if (/^\/[^/]+\/[^/]+\/blob\//.test(path)) return true;

    // DOM-based fallback
    if (document.querySelector('[data-testid="raw-button"]')) return true;
    if (document.querySelector('[data-testid="react-blob"]')) return true;
    if (document.querySelector('.react-blob-print-hide')) return true;
    if (document.querySelector('.blob-code')) return true;
    if (document.querySelector('.react-code-text')) return true;
    if (document.querySelector('.react-code-lines')) return true;
    if (document.querySelector('.react-code-line-contents')) return true;

    return false;
  }

  function getFileName() {
    // Try multiple breadcrumb selectors for different GitHub UI versions
    const selectors = [
      '[data-testid="breadcrumbs-filename"]',
      '[data-testid="breadcrumbs"] li:last-child',
      '.react-directory-filename-column a',
      '.final-path',
      '.js-path-segment.final-path',
      'h2[data-testid] .Link--primary',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }

    // URL-based extraction (most reliable)
    const path = window.location.pathname;
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  }

  function getCodeContent() {
    // Strategy 1: GitHub 2025 React-based viewer (.react-code-text)
    const reactCodeText = document.querySelectorAll('.react-code-text');
    if (reactCodeText.length > 0) {
      return Array.from(reactCodeText).map(el => el.textContent).join('\n');
    }

    // Strategy 2: GitHub React viewer (data-testid based)
    const testIdLines = document.querySelectorAll('[data-testid="react-code-text"]');
    if (testIdLines.length > 0) {
      return Array.from(testIdLines).map(el => el.textContent).join('\n');
    }

    // Strategy 3: React code line contents
    const reactLineContents = document.querySelectorAll('.react-code-line-contents');
    if (reactLineContents.length > 0) {
      return Array.from(reactLineContents).map(el => el.textContent).join('\n');
    }

    // Strategy 4: React file line
    const reactFileLines = document.querySelectorAll('.react-file-line');
    if (reactFileLines.length > 0) {
      return Array.from(reactFileLines).map(el => el.textContent).join('\n');
    }

    // Strategy 5: Classic GitHub blob view
    const blobLines = document.querySelectorAll('.blob-code-inner');
    if (blobLines.length > 0) {
      return Array.from(blobLines).map(el => el.textContent).join('\n');
    }

    // Strategy 6: Any code element inside the blob wrapper
    const blobWrapper = document.querySelector('.blob-wrapper, [data-testid="react-blob"]');
    if (blobWrapper) {
      const codeEl = blobWrapper.querySelector('pre, code, table');
      if (codeEl) return codeEl.textContent;
    }

    // Strategy 7: data.highlight (raw view)
    const rawContent = document.querySelector('.data.highlight');
    if (rawContent) return rawContent.textContent;

    // Strategy 8: Try getting text from any code-like container inside main content
    const codeContainer = document.querySelector('[data-hpc] .react-code-lines, .react-blob-print-hide');
    if (codeContainer) return codeContainer.textContent;

    return null;
  }

  function getCodeLineElements() {
    // Returns the DOM elements representing individual code lines for heatmap rendering
    const selectors = [
      '.react-code-text',
      '[data-testid="react-code-text"]',
      '.react-code-line-contents',
      '.react-file-line',
      '.blob-code',
      '.blob-code-inner',
    ];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) return els;
    }
    return document.querySelectorAll('.react-code-line, .blob-code');
  }

  function getRepoInfo() {
    const path = window.location.pathname.split('/');
    if (path.length >= 3) {
      return { owner: path[1], repo: path[2] };
    }
    return null;
  }

  // ─── Heatmap Renderer ───
  function renderHeatmap(results) {
    removeHeatmap();
    if (!heatmapEnabled || !results || !results.heatmap) return;

    const codeLines = getCodeLineElements();
    if (codeLines.length === 0) return;

    results.heatmap.forEach(region => {
      for (let i = region.startLine - 1; i < region.endLine && i < codeLines.length; i++) {
        const line = codeLines[i];
        if (!line) continue;

        // Apply heatmap background to the line or its parent row
        const targetEl = line.closest('tr') || line.closest('.react-code-line') || line;
        const alpha = 0.08 + region.intensity * 0.18;
        targetEl.style.backgroundColor = hexToRGBA(region.color, alpha);
        targetEl.classList.add('noseycoder-heatmap-line');

        // Add complexity badge on first line of function
        if (i === region.startLine - 1) {
          const badge = document.createElement('span');
          badge.className = 'noseycoder-complexity-badge';
          badge.style.backgroundColor = region.color;
          badge.textContent = `CC: ${region.complexity}`;
          badge.title = `Cyclomatic Complexity: ${region.complexity} — ${results.functions.find(f => f.name === region.name)?.complexityLevel?.label || ''}`;

          const existing = targetEl.querySelector('.noseycoder-complexity-badge');
          if (existing) existing.remove();

          targetEl.style.position = 'relative';
          targetEl.appendChild(badge);
        }
      }
    });
  }

  function removeHeatmap() {
    document.querySelectorAll('.noseycoder-heatmap-line').forEach(el => {
      el.style.backgroundColor = '';
      el.classList.remove('noseycoder-heatmap-line');
    });
    document.querySelectorAll('.noseycoder-complexity-badge').forEach(el => el.remove());
  }

  // ─── Side Panel ───
  function createAnalysisPanel(results) {
    removePanel();

    const panel = document.createElement('div');
    panel.id = 'noseycoder-panel';
    panel.innerHTML = `
      <div class="noseycoder-panel-header">
        <div class="noseycoder-panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2">
            <path d="M12 20V10"/>
            <path d="M18 20V4"/>
            <path d="M6 20v-4"/>
          </svg>
          <span>NoseyCoder</span>
        </div>
        <button id="noseycoder-panel-close" class="noseycoder-btn-icon" title="Close">&times;</button>
      </div>
      <div class="noseycoder-panel-body">
        ${renderSummarySection(results.summary)}
        ${renderFunctionsSection(results.functions)}
        ${renderLinterSection(results.linterIssues)}
        ${renderRefactorSection(results.refactorSuggestions)}
      </div>
    `;

    document.body.appendChild(panel);
    panelVisible = true;

    document.getElementById('noseycoder-panel-close').addEventListener('click', () => {
      removePanel();
    });

    // Scroll-to-line on function click
    panel.querySelectorAll('[data-goto-line]').forEach(el => {
      el.addEventListener('click', () => {
        const line = parseInt(el.dataset.gotoLine);
        scrollToLine(line);
      });
    });
  }

  function removePanel() {
    const existing = document.getElementById('noseycoder-panel');
    if (existing) existing.remove();
    panelVisible = false;
  }

  function renderSummarySection(summary) {
    return `
      <div class="noseycoder-section">
        <h3 class="noseycoder-section-title">File Summary</h3>
        <div class="noseycoder-metrics-grid">
          <div class="noseycoder-metric">
            <span class="noseycoder-metric-label">LOC</span>
            <span class="noseycoder-metric-value">${summary.loc}</span>
          </div>
          <div class="noseycoder-metric">
            <span class="noseycoder-metric-label">SLOC</span>
            <span class="noseycoder-metric-value">${summary.sloc}</span>
          </div>
          <div class="noseycoder-metric">
            <span class="noseycoder-metric-label">Functions</span>
            <span class="noseycoder-metric-value">${summary.functionCount}</span>
          </div>
          <div class="noseycoder-metric">
            <span class="noseycoder-metric-label">Complexity</span>
            <span class="noseycoder-metric-value" style="color:${summary.complexityLevel.color}">${summary.cyclomaticComplexity}</span>
          </div>
        </div>
        <div class="noseycoder-mi-bar">
          <div class="noseycoder-mi-label">
            <span>Maintainability Index</span>
            <span style="color:${summary.maintainabilityLevel.color}">${summary.maintainabilityIndex} — ${summary.maintainabilityLevel.label}</span>
          </div>
          <div class="noseycoder-progress-track">
            <div class="noseycoder-progress-fill" style="width:${summary.maintainabilityIndex}%;background:${summary.maintainabilityLevel.color}"></div>
          </div>
        </div>
        <div class="noseycoder-halstead-summary">
          <span>Vol: ${summary.halstead.volume}</span>
          <span>Diff: ${summary.halstead.difficulty}</span>
          <span>Bugs: ${summary.halstead.bugs}</span>
        </div>
      </div>
    `;
  }

  function renderFunctionsSection(functions) {
    if (!functions.length) return '<div class="noseycoder-section"><h3 class="noseycoder-section-title">Functions</h3><p class="noseycoder-empty">No functions detected</p></div>';
    const sorted = [...functions].sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);
    return `
      <div class="noseycoder-section">
        <h3 class="noseycoder-section-title">Functions (${functions.length})</h3>
        <div class="noseycoder-fn-list">
          ${sorted.map(fn => `
            <div class="noseycoder-fn-item" data-goto-line="${fn.startLine}">
              <div class="noseycoder-fn-header">
                <span class="noseycoder-fn-name">${fn.name}</span>
                <span class="noseycoder-fn-cc" style="background:${fn.complexityLevel.color}20;color:${fn.complexityLevel.color}">CC:${fn.cyclomaticComplexity}</span>
              </div>
              <div class="noseycoder-fn-meta">
                <span>L${fn.startLine}-${fn.endLine}</span>
                <span>${fn.loc} LOC</span>
                <span>MI: ${fn.maintainabilityIndex}</span>
                <span>${fn.paramCount} params</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderLinterSection(issues) {
    if (!issues.length) return '<div class="noseycoder-section"><h3 class="noseycoder-section-title">Linter</h3><p class="noseycoder-empty noseycoder-ok">No issues found</p></div>';
    const icons = { critical: '\u26d4', warning: '\u26a0\ufe0f', info: '\u2139\ufe0f' };
    return `
      <div class="noseycoder-section">
        <h3 class="noseycoder-section-title">Linter Issues (${issues.length})</h3>
        <div class="noseycoder-issue-list">
          ${issues.map(issue => `
            <div class="noseycoder-issue noseycoder-issue-${issue.severity}" data-goto-line="${issue.line}">
              <span class="noseycoder-issue-icon">${icons[issue.severity] || ''}</span>
              <div class="noseycoder-issue-content">
                <span class="noseycoder-issue-rule">${issue.rule}</span>
                <span class="noseycoder-issue-msg">${issue.message}</span>
              </div>
              <span class="noseycoder-issue-line">L${issue.line}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderRefactorSection(suggestions) {
    if (!suggestions.length) return '';
    const priorityColors = { high: '#f85149', medium: '#d29922', low: '#3fb950' };
    return `
      <div class="noseycoder-section">
        <h3 class="noseycoder-section-title">Refactoring Suggestions (${suggestions.length})</h3>
        <div class="noseycoder-refactor-list">
          ${suggestions.map(s => `
            <div class="noseycoder-refactor-item" data-goto-line="${s.line}">
              <div class="noseycoder-refactor-header">
                <span class="noseycoder-refactor-priority" style="color:${priorityColors[s.priority]}">${s.priority.toUpperCase()}</span>
                <span class="noseycoder-refactor-title">${s.title}</span>
              </div>
              <p class="noseycoder-refactor-desc">${s.description}</p>
              <span class="noseycoder-refactor-pattern">${s.pattern}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ─── Fork Button Injector ───
  function injectForkButton() {
    if (document.getElementById('noseycoder-fork-btn')) return;

    // Try multiple possible action bar selectors
    const actionBar = document.querySelector('[class*="react-blob-header-edit-and-raw-actions"]')
      || document.querySelector('[data-testid="raw-button"]')?.parentElement
      || document.querySelector('.file-actions')
      || document.querySelector('.Box-header .d-flex')
      || document.querySelector('.react-blob-header-edit-and-raw-actions');

    if (!actionBar) return;

    const btn = document.createElement('button');
    btn.id = 'noseycoder-fork-btn';
    btn.className = 'noseycoder-action-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM8 12.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/>
      </svg>
      Fork via NoseyCoder
    `;

    btn.addEventListener('click', () => {
      const repoInfo = getRepoInfo();
      if (repoInfo) {
        chrome.runtime.sendMessage({
          type: 'FORK_REPO',
          owner: repoInfo.owner,
          repo: repoInfo.repo
        }, (response) => {
          if (response && response.success) {
            btn.textContent = 'Forked!';
            btn.style.color = '#3fb950';
          } else {
            btn.textContent = response?.error || 'Fork failed';
            btn.style.color = '#f85149';
          }
          setTimeout(() => {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM8 12.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/></svg> Fork via NoseyCoder`;
            btn.style.color = '';
          }, 3000);
        });
      }
    });

    actionBar.prepend(btn);
  }

  // ─── Floating Toggle Button ───
  function injectToggleButton() {
    if (document.getElementById('noseycoder-toggle')) return;

    const toggle = document.createElement('button');
    toggle.id = 'noseycoder-toggle';
    toggle.title = 'Toggle NoseyCoder Analysis';
    toggle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20V10"/>
        <path d="M18 20V4"/>
        <path d="M6 20v-4"/>
      </svg>
    `;

    toggle.addEventListener('click', () => {
      if (panelVisible) {
        removePanel();
      } else if (analysisResults) {
        createAnalysisPanel(analysisResults);
      }
    });

    document.body.appendChild(toggle);
  }

  // ─── Utilities ───
  function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function scrollToLine(lineNumber) {
    const lines = getCodeLineElements();
    if (lines[lineNumber - 1]) {
      lines[lineNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      const target = lines[lineNumber - 1].closest('tr') || lines[lineNumber - 1].closest('.react-code-line') || lines[lineNumber - 1];
      target.style.outline = '2px solid #58a6ff';
      setTimeout(() => { target.style.outline = ''; }, 2000);
    }
  }

  // ─── Main Entry ───
  function init() {
    if (!isFilePage()) return;

    const filename = getFileName();
    const language = NoseyCoderAnalyzer.detectLanguage(filename);
    if (language === 'unknown') return;

    tryExtractAndAnalyze(filename);
  }

  function tryExtractAndAnalyze(filename) {
    const code = getCodeContent();
    if (code && code.trim().length > 0) {
      runAnalysis(code, filename);
      return;
    }

    // GitHub loads code async — retry with increasing delay
    initAttempts++;
    if (initAttempts < MAX_INIT_ATTEMPTS) {
      setTimeout(() => tryExtractAndAnalyze(filename), 500);
    }
  }

  function runAnalysis(code, filename) {
    analysisResults = NoseyCoderAnalyzer.analyzeCode(code, filename);

    // Send results to popup
    try {
      chrome.runtime.sendMessage({
        type: 'ANALYSIS_RESULTS',
        data: analysisResults
      });
    } catch (e) {
      // Extension context may be invalidated on navigation
    }

    // Render heatmap
    renderHeatmap(analysisResults);

    // Inject UI elements
    injectToggleButton();
    injectForkButton();
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_ANALYSIS') {
      if (analysisResults) {
        sendResponse(analysisResults);
      } else {
        // Try to analyze now if we haven't yet
        if (isFilePage()) {
          const code = getCodeContent();
          const filename = getFileName();
          if (code && code.trim().length > 0) {
            const language = NoseyCoderAnalyzer.detectLanguage(filename);
            if (language !== 'unknown') {
              analysisResults = NoseyCoderAnalyzer.analyzeCode(code, filename);
              sendResponse(analysisResults);
              renderHeatmap(analysisResults);
              injectToggleButton();
              injectForkButton();
              return;
            }
          }
        }
        sendResponse(null);
      }
    }
    if (msg.type === 'TOGGLE_HEATMAP') {
      heatmapEnabled = msg.enabled;
      if (heatmapEnabled && analysisResults) {
        renderHeatmap(analysisResults);
      } else {
        removeHeatmap();
      }
    }
    if (msg.type === 'TOGGLE_PANEL') {
      if (panelVisible) {
        removePanel();
      } else if (analysisResults) {
        createAnalysisPanel(analysisResults);
      }
    }
    if (msg.type === 'REANALYZE') {
      const code = getCodeContent();
      const filename = getFileName();
      if (code) runAnalysis(code, filename);
    }
    return true;
  });

  // Handle GitHub SPA navigation
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      removeHeatmap();
      removePanel();
      analysisResults = null;
      initAttempts = 0;
      // Remove toggle and fork button on navigation
      const toggle = document.getElementById('noseycoder-toggle');
      if (toggle) toggle.remove();
      const forkBtn = document.getElementById('noseycoder-fork-btn');
      if (forkBtn) forkBtn.remove();

      setTimeout(init, 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Start — with a slight delay to let GitHub's React app render
  function startInit() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
      setTimeout(init, 1000);
    }
  }

  startInit();
})();
