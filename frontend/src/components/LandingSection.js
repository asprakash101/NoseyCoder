import { BarChart3, GitFork, Shield, Zap, ChevronRight } from "lucide-react";

const features = [
  {
    icon: <BarChart3 size={22} />,
    title: "Cyclomatic Complexity",
    desc: "Instant CC scores for every function with color-coded severity badges",
  },
  {
    icon: <Shield size={22} />,
    title: "Maintainability Index",
    desc: "171-point MI formula normalized to 0-100 with Halstead volume integration",
  },
  {
    icon: <Zap size={22} />,
    title: "Heatmap Overlay",
    desc: "Green-to-red gradient overlay directly on GitHub file views",
  },
  {
    icon: <GitFork size={22} />,
    title: "GitHub Integration",
    desc: "Fork repos, generate CI workflows, and authenticate via OAuth",
  },
];

export default function LandingSection({ onTryDemo }) {
  return (
    <main className="landing" data-testid="landing-section">
      {/* Hero */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-badge" data-testid="hero-badge">
            <span className="badge-dot" />
            Chrome Extension for GitHub
          </div>
          <h1 className="hero-title" data-testid="hero-title">
            Analyze Code Complexity
            <br />
            <span className="gradient-text">Directly on GitHub</span>
          </h1>
          <p className="hero-subtitle" data-testid="hero-subtitle">
            NoseyCoder performs in-browser static analysis on GitHub file pages.
            Cyclomatic complexity, maintainability index, heatmaps, linter
            suggestions, and refactoring patterns — all without leaving your browser.
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary"
              data-testid="try-demo-btn"
              onClick={onTryDemo}
            >
              Try Live Demo
              <ChevronRight size={18} />
            </button>
            <a
              href="#install"
              className="btn-ghost"
              data-testid="install-link"
            >
              Install Extension
            </a>
          </div>
        </div>

        {/* Floating metrics preview */}
        <div className="hero-preview" data-testid="hero-preview">
          <div className="preview-card">
            <div className="preview-header">
              <span className="preview-dot green" />
              <span className="preview-dot yellow" />
              <span className="preview-dot red" />
              <span className="preview-filename">server.js</span>
            </div>
            <div className="preview-body">
              <div className="preview-line">
                <span className="ln">1</span>
                <span className="kw">function</span>{" "}
                <span className="fn">processOrder</span>(items, user, config) {"{"}
              </div>
              <div className="preview-line heat-low">
                <span className="ln">2</span>
                {"  "}<span className="kw">if</span> (items.length === 0) <span className="kw">return</span> null;
              </div>
              <div className="preview-line heat-med">
                <span className="ln">3</span>
                {"  "}<span className="kw">for</span> (<span className="kw">const</span> item <span className="kw">of</span> items) {"{"}
              </div>
              <div className="preview-line heat-high">
                <span className="ln">4</span>
                {"    "}<span className="kw">if</span> (item.price &gt; 100 && user.premium) {"{"}
              </div>
              <div className="preview-line heat-high">
                <span className="ln">5</span>
                {"      "}applyDiscount(item, config.rate);
              </div>
              <div className="preview-line">
                <span className="ln">6</span>
                {"    }"} <span className="kw">else if</span> (item.quantity &gt; 10) {"{"}
              </div>
              <div className="preview-line heat-med">
                <span className="ln">7</span>
                {"      "}applyBulkPrice(item);
              </div>
              <div className="preview-line">
                <span className="ln">8</span>
                {"    }"}
              </div>
            </div>
            <div className="preview-badge-overlay">
              <span className="cc-badge cc-high">CC: 8</span>
            </div>
          </div>

          <div className="preview-metrics-float">
            <div className="float-metric">
              <span className="float-val green">72.4</span>
              <span className="float-label">MI Score</span>
            </div>
            <div className="float-metric">
              <span className="float-val yellow">8</span>
              <span className="float-label">Complexity</span>
            </div>
            <div className="float-metric">
              <span className="float-val blue">3</span>
              <span className="float-label">Issues</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section" id="features" data-testid="features-section">
        <h2 className="section-heading">Everything you need for code health</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card" data-testid={`feature-card-${i}`}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics Breakdown */}
      <section className="metrics-breakdown" data-testid="metrics-breakdown">
        <h2 className="section-heading">Metrics at a glance</h2>
        <div className="breakdown-grid">
          <div className="breakdown-card">
            <div className="breakdown-formula">
              M = 1 + <span className="hl">decision points</span>
            </div>
            <h3>Cyclomatic Complexity</h3>
            <p>Counts if, for, while, case, catch, &&, ||, and ternary operators to measure execution path complexity.</p>
          </div>
          <div className="breakdown-card">
            <div className="breakdown-formula">
              MI = 171 - 5.2·ln(<span className="hl">V</span>) - 0.23·<span className="hl">CC</span> - 16.2·ln(<span className="hl">LOC</span>)
            </div>
            <h3>Maintainability Index</h3>
            <p>Composite score combining Halstead Volume, Cyclomatic Complexity, and Lines of Code. Normalized to 0-100.</p>
          </div>
          <div className="breakdown-card">
            <div className="breakdown-formula">
              V = N · log<sub>2</sub>(<span className="hl">n</span>)
            </div>
            <h3>Halstead Volume</h3>
            <p>Program length times log of vocabulary size. Measures the information content of the code.</p>
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="install-section" id="install" data-testid="install-section">
        <h2 className="section-heading">Get Started</h2>
        <div className="install-steps">
          <div className="install-step">
            <span className="step-num">1</span>
            <h3>Download Extension</h3>
            <p>Download the NoseyCoder Chrome extension package</p>
          </div>
          <div className="install-step">
            <span className="step-num">2</span>
            <h3>Load Unpacked</h3>
            <p>Go to chrome://extensions, enable Developer Mode, click "Load unpacked"</p>
          </div>
          <div className="install-step">
            <span className="step-num">3</span>
            <h3>Browse GitHub</h3>
            <p>Navigate to any .js, .ts, or .py file on GitHub — analysis starts automatically</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer" data-testid="site-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <BarChart3 size={20} />
            <span>NoseyCoder</span>
          </div>
          <p>Client-side static analysis for GitHub. Zero backend, total privacy.</p>
        </div>
      </footer>
    </main>
  );
}
