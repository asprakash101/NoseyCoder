import { ArrowLeft, AlertTriangle, Info, XOctagon, Wrench, BarChart3 } from "lucide-react";

export default function ResultsDashboard({ result, onBack }) {
  if (!result || result.error) {
    return (
      <main className="results-dashboard" data-testid="results-dashboard">
        <div className="demo-header-row">
          <button className="btn-back" data-testid="results-back-btn" onClick={onBack}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
        <div className="empty-results" data-testid="empty-results">
          <p>Unsupported file type or analysis failed</p>
        </div>
      </main>
    );
  }

  const s = result.summary;
  const fns = [...result.functions].sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);

  return (
    <main className="results-dashboard" data-testid="results-dashboard">
      <div className="demo-header-row">
        <button className="btn-back" data-testid="results-back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> New Analysis
        </button>
        <div className="result-file-badge" data-testid="result-file-badge">
          {result.filename} <span className="lang-tag">{result.language}</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid" data-testid="summary-grid">
        <div className="summary-card" data-testid="card-loc">
          <span className="card-value">{s.loc}</span>
          <span className="card-label">Lines of Code</span>
        </div>
        <div className="summary-card" data-testid="card-sloc">
          <span className="card-value">{s.sloc}</span>
          <span className="card-label">Source Lines</span>
        </div>
        <div className="summary-card" data-testid="card-functions">
          <span className="card-value">{s.functionCount}</span>
          <span className="card-label">Functions</span>
        </div>
        <div className="summary-card" data-testid="card-complexity">
          <span className="card-value" style={{ color: s.complexityLevel.color }}>
            {s.cyclomaticComplexity}
          </span>
          <span className="card-label">Cyclomatic Complexity</span>
        </div>
        <div className="summary-card" data-testid="card-issues">
          <span className="card-value" style={{ color: result.linterIssues.length > 0 ? "#d29922" : "#3fb950" }}>
            {result.linterIssues.length}
          </span>
          <span className="card-label">Linter Issues</span>
        </div>
        <div className="summary-card" data-testid="card-suggestions">
          <span className="card-value" style={{ color: result.refactorSuggestions.length > 0 ? "#58a6ff" : "#3fb950" }}>
            {result.refactorSuggestions.length}
          </span>
          <span className="card-label">Suggestions</span>
        </div>
      </div>

      {/* Maintainability Index */}
      <div className="mi-block" data-testid="mi-block">
        <div className="mi-header-row">
          <span className="mi-title">Maintainability Index</span>
          <span className="mi-score" style={{ color: s.maintainabilityLevel.color }}>
            {s.maintainabilityIndex} — {s.maintainabilityLevel.label}
          </span>
        </div>
        <div className="mi-track">
          <div
            className="mi-fill"
            style={{ width: `${s.maintainabilityIndex}%`, background: s.maintainabilityLevel.color }}
          />
        </div>
        <div className="mi-scale">
          <span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span>
        </div>
      </div>

      {/* Halstead Metrics */}
      <div className="halstead-block" data-testid="halstead-block">
        <h3 className="block-title">Halstead Metrics</h3>
        <div className="halstead-grid">
          <HalsteadCell label="Volume" value={s.halstead.volume} />
          <HalsteadCell label="Difficulty" value={s.halstead.difficulty} />
          <HalsteadCell label="Effort" value={s.halstead.effort} />
          <HalsteadCell label="Est. Bugs" value={s.halstead.bugs} />
          <HalsteadCell label="Time (s)" value={s.halstead.time} />
          <HalsteadCell label="Vocabulary" value={s.halstead.vocabulary} />
          <HalsteadCell label="Length" value={s.halstead.length} />
          <HalsteadCell label="Operators" value={`${s.halstead.uniqueOperators} / ${s.halstead.totalOperators}`} />
          <HalsteadCell label="Operands" value={`${s.halstead.uniqueOperands} / ${s.halstead.totalOperands}`} />
        </div>
      </div>

      {/* Heatmap */}
      {result.heatmap.length > 0 && (
        <div className="heatmap-block" data-testid="heatmap-block">
          <h3 className="block-title">
            <BarChart3 size={16} /> Complexity Heatmap
          </h3>
          <div className="heatmap-bars">
            {fns.map((fn, i) => (
              <div key={i} className="heatmap-row" data-testid={`heatmap-row-${i}`}>
                <span className="heatmap-name">{fn.name}</span>
                <div className="heatmap-bar-track">
                  <div
                    className="heatmap-bar-fill"
                    style={{
                      width: `${fn.heatIntensity * 100}%`,
                      background: fn.complexityLevel.color,
                    }}
                  />
                </div>
                <span className="heatmap-cc" style={{ color: fn.complexityLevel.color }}>
                  CC:{fn.cyclomaticComplexity}
                </span>
              </div>
            ))}
          </div>
          <div className="heatmap-legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: "#3fb950" }} /> Low (1-5)</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: "#d29922" }} /> Moderate (6-10)</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: "#f85149" }} /> High (11-20)</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: "#da3633" }} /> Critical (20+)</span>
          </div>
        </div>
      )}

      {/* Functions Table */}
      <div className="functions-block" data-testid="functions-block">
        <h3 className="block-title">Functions ({fns.length})</h3>
        <div className="fn-table">
          <div className="fn-table-header">
            <span>Function</span><span>LOC</span><span>CC</span><span>MI</span><span>Nesting</span><span>Params</span>
          </div>
          {fns.map((fn, i) => (
            <div key={i} className="fn-table-row" data-testid={`fn-row-${i}`}>
              <span className="fn-cell-name">{fn.name}</span>
              <span className="fn-cell">{fn.loc}</span>
              <span className="fn-cell" style={{ color: fn.complexityLevel.color }}>{fn.cyclomaticComplexity}</span>
              <span className="fn-cell" style={{ color: fn.maintainabilityLevel.color }}>{fn.maintainabilityIndex}</span>
              <span className="fn-cell">{fn.maxNestingDepth}</span>
              <span className="fn-cell">{fn.paramCount}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Linter Issues */}
      {result.linterIssues.length > 0 && (
        <div className="linter-block" data-testid="linter-block">
          <h3 className="block-title">Linter Issues ({result.linterIssues.length})</h3>
          <div className="issue-list">
            {result.linterIssues.map((issue, i) => (
              <div key={i} className={`issue-row severity-${issue.severity}`} data-testid={`issue-${i}`}>
                <span className="issue-icon">
                  {issue.severity === "critical" ? <XOctagon size={14} /> :
                   issue.severity === "warning" ? <AlertTriangle size={14} /> :
                   <Info size={14} />}
                </span>
                <div className="issue-body">
                  <span className="issue-rule">{issue.rule}</span>
                  <span className="issue-message">{issue.message}</span>
                </div>
                <span className="issue-line-num">L{issue.line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refactor Suggestions */}
      {result.refactorSuggestions.length > 0 && (
        <div className="refactor-block" data-testid="refactor-block">
          <h3 className="block-title">
            <Wrench size={16} /> Refactoring Suggestions ({result.refactorSuggestions.length})
          </h3>
          <div className="refactor-list">
            {result.refactorSuggestions.map((s, i) => (
              <div key={i} className="refactor-card" data-testid={`refactor-${i}`}>
                <div className="refactor-top">
                  <span className={`refactor-priority priority-${s.priority}`}>{s.priority.toUpperCase()}</span>
                  <span className="refactor-title">{s.title}</span>
                </div>
                <p className="refactor-desc">{s.description}</p>
                <span className="refactor-pattern">{s.pattern}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function HalsteadCell({ label, value }) {
  return (
    <div className="halstead-cell">
      <span className="halstead-val">{value}</span>
      <span className="halstead-label">{label}</span>
    </div>
  );
}
