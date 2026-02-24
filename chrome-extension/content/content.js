/**
 * CodeScope Content Script
 * Runs on GitHub file pages — injects heatmap, badges, fork button, and analysis panel
 */

(() => {
  let analysisResults = null;
  let heatmapEnabled = true;
  let panelVisible = false;

  // ─── GitHub DOM Helpers ───
  function isFilePage() {
    return document.querySelector('[data-testid="raw-button"]') !== null
      || document.querySelector('.blob-code') !== null
      || document.querySelector('.react-code-lines') !== null;
  }

  function getFileName() {
    const breadcrumb = document.querySelector('[data-testid="breadcrumbs-filename"]')
      || document.querySelector('.final-path')
      || document.querySelector('.js-path-segment.final-path');
    if (breadcrumb) return breadcrumb.textContent.trim();

    const path = window.location.pathname;
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  }

  function getCodeContent() {
    // Try modern GitHub (react-based)
    const codeLines = document.querySelectorAll('.react-code-line .react-file-line');
    if (codeLines.length > 0) {
      return Array.from(codeLines).map(l => l.textContent).join('\n');
    }

    // Try classic GitHub
    const blobLines = document.querySelectorAll('.blob-code-inner');
    if (blobLines.length > 0) {
      return Array.from(blobLines).map(l => l.textContent).join('\n');
    }

    // Try raw content
    const rawContent = document.querySelector('.data.highlight');
    if (rawContent) return rawContent.textContent;

    return null;
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

    const codeLines = document.querySelectorAll('.react-code-line, .blob-code');
    if (codeLines.length === 0) return;

    results.heatmap.forEach(region => {
      for (let i = region.startLine - 1; i < region.endLine && i < codeLines.length; i++) {
        const line = codeLines[i];
        if (!line) continue;

        const alpha = 0.08 + region.intensity * 0.18;
        line.style.backgroundColor = hexToRGBA(region.color, alpha);
        line.classList.add('codescope-heatmap-line');

        // Add complexity badge on first line of function
        if (i === region.startLine - 1) {
          const badge = document.createElement('span');
          badge.className = 'codescope-complexity-badge';
          badge.style.backgroundColor = region.color;
          badge.textContent = `CC: ${region.complexity}`;
          badge.title = `Cyclomatic Complexity: ${region.complexity} — ${results.functions.find(f => f.name === region.name)?.complexityLevel?.label || ''}`;

          const existing = line.querySelector('.codescope-complexity-badge');
          if (existing) existing.remove();

          line.style.position = 'relative';
          line.appendChild(badge);
        }
      }
    });
  }

  function removeHeatmap() {
    document.querySelectorAll('.codescope-heatmap-line').forEach(el => {
      el.style.backgroundColor = '';
      el.classList.remove('codescope-heatmap-line');
    });
    document.querySelectorAll('.codescope-complexity-badge').forEach(el => el.remove());
  }

  // ─── Side Panel ───
  function createAnalysisPanel(results) {
    removePanel();

    const panel = document.createElement('div');
    panel.id = 'codescope-panel';
    panel.innerHTML = `
      <div class="codescope-panel-header">
        <div class="codescope-panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" stroke-width="2">
            <path d="M12 20V10"/>
            <path d="M18 20V4"/>
            <path d="M6 20v-4"/>
          </svg>
          <span>CodeScope</span>
        </div>
        <button id="codescope-panel-close" class="codescope-btn-icon" title="Close">&times;</button>
      </div>
      <div class="codescope-panel-body">
        ${renderSummarySection(results.summary)}
        ${renderFunctionsSection(results.functions)}
        ${renderLinterSection(results.linterIssues)}
        ${renderRefactorSection(results.refactorSuggestions)}
      </div>
    `;

    document.body.appendChild(panel);
    panelVisible = true;

    document.getElementById('codescope-panel-close').addEventListener('click', () => {
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
    const existing = document.getElementById('codescope-panel');
    if (existing) existing.remove();
    panelVisible = false;
  }

  function renderSummarySection(summary) {
    return `
      <div class="codescope-section">
        <h3 class="codescope-section-title">File Summary</h3>
        <div class="codescope-metrics-grid">
          <div class="codescope-metric">
            <span class="codescope-metric-label">LOC</span>
            <span class="codescope-metric-value">${summary.loc}</span>
          </div>
          <div class="codescope-metric">
            <span class="codescope-metric-label">SLOC</span>
            <span class="codescope-metric-value">${summary.sloc}</span>
          </div>
          <div class="codescope-metric">
            <span class="codescope-metric-label">Functions</span>
            <span class="codescope-metric-value">${summary.functionCount}</span>
          </div>
          <div class="codescope-metric">
            <span class="codescope-metric-label">Complexity</span>
            <span class="codescope-metric-value" style="color:${summary.complexityLevel.color}">${summary.cyclomaticComplexity}</span>
          </div>
        </div>
        <div class="codescope-mi-bar">
          <div class="codescope-mi-label">
            <span>Maintainability Index</span>
            <span style="color:${summary.maintainabilityLevel.color}">${summary.maintainabilityIndex} — ${summary.maintainabilityLevel.label}</span>
          </div>
          <div class="codescope-progress-track">
            <div class="codescope-progress-fill" style="width:${summary.maintainabilityIndex}%;background:${summary.maintainabilityLevel.color}"></div>
          </div>
        </div>
        <div class="codescope-halstead-summary">
          <span>Vol: ${summary.halstead.volume}</span>
          <span>Diff: ${summary.halstead.difficulty}</span>
          <span>Bugs: ${summary.halstead.bugs}</span>
        </div>
      </div>
    `;
  }

  function renderFunctionsSection(functions) {
    if (!functions.length) return '<div class="codescope-section"><h3 class="codescope-section-title">Functions</h3><p class="codescope-empty">No functions detected</p></div>';
    const sorted = [...functions].sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);
    return `
      <div class="codescope-section">
        <h3 class="codescope-section-title">Functions (${functions.length})</h3>
        <div class="codescope-fn-list">
          ${sorted.map(fn => `
            <div class="codescope-fn-item" data-goto-line="${fn.startLine}">
              <div class="codescope-fn-header">
                <span class="codescope-fn-name">${fn.name}</span>
                <span class="codescope-fn-cc" style="background:${fn.complexityLevel.color}20;color:${fn.complexityLevel.color}">CC:${fn.cyclomaticComplexity}</span>
              </div>
              <div class="codescope-fn-meta">
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
    if (!issues.length) return '<div class="codescope-section"><h3 class="codescope-section-title">Linter</h3><p class="codescope-empty codescope-ok">No issues found</p></div>';
    const icons = { critical: '\u26d4', warning: '\u26a0\ufe0f', info: '\u2139\ufe0f' };
    return `
      <div class="codescope-section">
        <h3 class="codescope-section-title">Linter Issues (${issues.length})</h3>
        <div class="codescope-issue-list">
          ${issues.map(issue => `
            <div class="codescope-issue codescope-issue-${issue.severity}" data-goto-line="${issue.line}">
              <span class="codescope-issue-icon">${icons[issue.severity] || ''}</span>
              <div class="codescope-issue-content">
                <span class="codescope-issue-rule">${issue.rule}</span>
                <span class="codescope-issue-msg">${issue.message}</span>
              </div>
              <span class="codescope-issue-line">L${issue.line}</span>
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
      <div class="codescope-section">
        <h3 class="codescope-section-title">Refactoring Suggestions (${suggestions.length})</h3>
        <div class="codescope-refactor-list">
          ${suggestions.map(s => `
            <div class="codescope-refactor-item" data-goto-line="${s.line}">
              <div class="codescope-refactor-header">
                <span class="codescope-refactor-priority" style="color:${priorityColors[s.priority]}">${s.priority.toUpperCase()}</span>
                <span class="codescope-refactor-title">${s.title}</span>
              </div>
              <p class="codescope-refactor-desc">${s.description}</p>
              <span class="codescope-refactor-pattern">${s.pattern}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ─── Fork Button Injector ───
  function injectForkButton() {
    if (document.getElementById('codescope-fork-btn')) return;

    const actionBar = document.querySelector('.file-actions')
      || document.querySelector('[class*="react-blob-header-edit-and-raw-actions"]')
      || document.querySelector('.Box-header .d-flex');

    if (!actionBar) return;

    const btn = document.createElement('button');
    btn.id = 'codescope-fork-btn';
    btn.className = 'codescope-action-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM8 12.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/>
      </svg>
      Fork via CodeScope
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
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM8 12.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/></svg> Fork via CodeScope`;
            btn.style.color = '';
          }, 3000);
        });
      }
    });

    actionBar.prepend(btn);
  }

  // ─── Floating Toggle Button ───
  function injectToggleButton() {
    if (document.getElementById('codescope-toggle')) return;

    const toggle = document.createElement('button');
    toggle.id = 'codescope-toggle';
    toggle.title = 'Toggle CodeScope Analysis';
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
    const lines = document.querySelectorAll('.react-code-line, .blob-code');
    if (lines[lineNumber - 1]) {
      lines[lineNumber - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
      lines[lineNumber - 1].style.outline = '2px solid #58a6ff';
      setTimeout(() => { lines[lineNumber - 1].style.outline = ''; }, 2000);
    }
  }

  // ─── Main Entry ───
  function init() {
    if (!isFilePage()) return;

    const filename = getFileName();
    const language = CodeScopeAnalyzer.detectLanguage(filename);
    if (language === 'unknown') return;

    // Wait for code to be rendered
    const observer = new MutationObserver(() => {
      const code = getCodeContent();
      if (code) {
        observer.disconnect();
        runAnalysis(code, filename);
      }
    });

    const code = getCodeContent();
    if (code) {
      runAnalysis(code, filename);
    } else {
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    }
  }

  function runAnalysis(code, filename) {
    analysisResults = CodeScopeAnalyzer.analyzeCode(code, filename);

    // Send results to popup
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_RESULTS',
      data: analysisResults
    });

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
      setTimeout(init, 1000);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
