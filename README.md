# NoseyCoder — GitHub On-Page Complexity & Maintainability Analyzer

A Chrome extension that performs **in-browser static code analysis** directly on GitHub file pages. Computes Cyclomatic Complexity, Maintainability Index, Halstead metrics, renders heatmaps, provides linter suggestions, refactoring recommendations, and integrates with the GitHub API for forking and CI workflow generation.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Chrome Extension — Build & Install](#chrome-extension--build--install)
- [Web Demo — Build & Run](#web-demo--build--run)
- [Backend API — Build & Run](#backend-api--build--run)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Supported Languages](#supported-languages)
- [Metrics Reference](#metrics-reference)
- [Linter Rules](#linter-rules)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

| Feature | Description |
|---|---|
| **Cyclomatic Complexity** | Counts decision points (if, for, while, case, catch, &&, \|\|, ternary) per function |
| **Maintainability Index** | Composite 0-100 score combining Halstead Volume, CC, and LOC |
| **Halstead Metrics** | Volume, Difficulty, Effort, Estimated Bugs, Time, Vocabulary, Length |
| **Heatmap Overlay** | Green-to-red gradient directly on GitHub code lines |
| **Complexity Badges** | Inline CC badges on each function's first line |
| **Linter Suggestions** | Max function length, nesting depth, parameter count, duplicate logic |
| **Refactoring Patterns** | Decompose, Extract Method, Parameter Object, Guard Clause |
| **GitHub Fork** | Fork repos via the extension with one click |
| **GitHub Actions** | Generate CI workflow YAML for automated analysis |
| **Side Panel** | Slide-out analysis panel on GitHub pages |
| **Web Demo** | Interactive code analyzer at the companion website |

---

## Project Structure

```
noseycoder/
|
|-- chrome-extension/          # Chrome Extension (standalone)
|   |-- manifest.json          # Manifest V3 configuration
|   |-- background/
|   |   +-- background.js      # Service worker: OAuth, GitHub API, workflow gen
|   |-- content/
|   |   |-- analyzer-core.js   # Core analysis engine (CC, MI, Halstead, linter)
|   |   |-- content.js         # GitHub DOM integration, heatmap, panel, fork btn
|   |   +-- content.css        # Overlay styles for GitHub pages
|   |-- popup/
|   |   |-- popup.html         # Extension popup UI
|   |   |-- popup.css          # Popup styles (dark theme)
|   |   +-- popup.js           # Popup logic: tabs, metrics display, settings
|   +-- icons/
|       |-- icon16.png
|       |-- icon48.png
|       +-- icon128.png
|
|-- backend/                   # FastAPI Backend (for web demo)
|   |-- server.py              # API: /api/analyze, /api/history, /api/health
|   |-- requirements.txt       # Python dependencies
|   +-- .env                   # Environment variables
|
|-- frontend/                  # React Frontend (web demo + landing page)
|   |-- src/
|   |   |-- App.js             # Main app with routing
|   |   |-- App.css            # Complete styling
|   |   +-- components/
|   |       |-- Header.js          # Navigation header
|   |       |-- LandingSection.js  # Hero, features, metrics, install steps
|   |       |-- AnalyzerDemo.js    # Code editor with JS/Python samples
|   |       +-- ResultsDashboard.js # Full metrics visualization
|   |-- package.json
|   |-- tailwind.config.js
|   +-- .env
|
+-- README.md
```

---

## Requirements

### Chrome Extension (no build step needed)
- **Google Chrome** v88+ (Manifest V3 support)
- No Node.js or build tools required — the extension runs as plain JavaScript

### Web Demo Frontend
- **Node.js** >= 18.x
- **Yarn** >= 1.22 (package manager)

### Backend API
- **Python** >= 3.10
- **MongoDB** >= 5.0 (for analysis history storage)
- **pip** (Python package manager)

### Optional (for GitHub features)
- A **GitHub Personal Access Token** (PAT) with scopes:
  - `public_repo` — for fork operations on public repos
  - `repo` — for fork operations on private repos (optional)
  - `workflow` — for GitHub Actions workflow creation (optional)

  **How to create a PAT:**
  1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
  2. Click "Generate new token (classic)"
  3. Select the scopes listed above
  4. Copy the token (starts with `ghp_`)

---

## Quick Start

### Option A: Just the Chrome Extension (no server needed)

The extension is fully client-side. No backend required for core analysis.

```bash
# 1. Clone or download the project
# 2. Open Chrome and navigate to:
chrome://extensions/

# 3. Enable "Developer mode" (toggle in top-right)
# 4. Click "Load unpacked"
# 5. Select the chrome-extension/ folder
# 6. Navigate to any .js, .ts, or .py file on GitHub
# 7. Analysis runs automatically!
```

### Option B: Full Stack (Extension + Web Demo + API)

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2: Frontend
cd frontend
yarn install
yarn start

# Terminal 3: Load Chrome Extension
# Follow steps in Option A above
```

---

## Chrome Extension — Build & Install

### Step 1: Verify Files

Ensure the `chrome-extension/` directory contains:
```
chrome-extension/
  manifest.json
  background/background.js
  content/analyzer-core.js
  content/content.js
  content/content.css
  popup/popup.html
  popup/popup.js
  popup/popup.css
  icons/icon16.png
  icons/icon48.png
  icons/icon128.png
```

### Step 2: Load in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Toggle **Developer mode** ON (top-right corner)
4. Click **"Load unpacked"**
5. Browse to and select the `chrome-extension/` folder
6. The NoseyCoder icon appears in your extensions bar

### Step 3: Pin the Extension

1. Click the puzzle piece icon in Chrome's toolbar
2. Find "NoseyCoder" in the list
3. Click the pin icon to keep it visible

### Step 4: Use on GitHub

1. Navigate to any supported file on GitHub (e.g., `https://github.com/facebook/react/blob/main/packages/react/src/React.js`)
2. The extension automatically:
   - Analyzes the code
   - Overlays a heatmap on the code lines
   - Adds CC badges to function definitions
   - Shows a floating toggle button (bottom-right)
3. Click the toggle button to open the analysis side panel
4. Click the NoseyCoder icon in the toolbar to open the popup dashboard

### Step 5: Configure GitHub Token (Optional)

For fork and API features:
1. Click the NoseyCoder popup icon
2. Click the gear icon (Settings)
3. Paste your GitHub PAT in the "GitHub Token" field
4. Click "Save"
5. Go to the "GitHub" tab to fork repos or generate workflows

### Packaging for Distribution

To create a `.zip` for sharing or submitting to the Chrome Web Store:

```bash
cd chrome-extension
zip -r noseycoder-extension.zip . -x "*.DS_Store" -x "__MACOSX/*"
```

For Chrome Web Store submission:
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload `noseycoder-extension.zip`
4. Fill in listing details, screenshots, and description
5. Submit for review (typically 1-3 business days)

---

## Web Demo — Build & Run

The web demo provides an interactive landing page and code analyzer that mirrors the extension's functionality.

### Install Dependencies

```bash
cd frontend
yarn install
```

### Environment Variables

Create or edit `frontend/.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=443
```

For production, set `REACT_APP_BACKEND_URL` to your deployed backend URL.

### Development Server

```bash
yarn start
```

Opens at `http://localhost:3000`.

### Production Build

```bash
yarn build
```

Outputs optimized static files to `frontend/build/`. Serve with any static file server:

```bash
# Using serve
npx serve -s build -l 3000

# Using nginx (copy build/ to your nginx html root)
```

---

## Backend API — Build & Run

### Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Environment Variables

Create or edit `backend/.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=noseycoder_db
CORS_ORIGINS=*
```

### Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Or install locally: https://www.mongodb.com/docs/manual/installation/
```

### Run the Server

```bash
# Development (with hot reload)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Production
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 4
```

API available at `http://localhost:8001/api/`.

### Verify

```bash
curl http://localhost:8001/api/health
# {"status":"ok","service":"NoseyCoder API"}
```

---

## Configuration

### Extension Settings (via Popup)

| Setting | Default | Description |
|---|---|---|
| Max Function LOC | 50 | Warn when a function exceeds this many lines |
| Max Nesting Depth | 3 | Warn when nesting exceeds this level |
| Max Parameters | 5 | Warn when parameter count exceeds this |
| CC Warning Threshold | 10 | Cyclomatic complexity warning level |
| GitHub Token | (empty) | Personal Access Token for GitHub API features |
| Heatmap Toggle | ON | Enable/disable the inline heatmap overlay |

### Heatmap Color Scale

| Color | CC Range | Label |
|---|---|---|
| Green (#3fb950) | 1 - 5 | Low |
| Yellow (#d29922) | 6 - 10 | Moderate |
| Red (#f85149) | 11 - 20 | High |
| Dark Red (#da3633) | 21+ | Critical |

---

## Usage Guide

### Analyzing a File on GitHub

1. Navigate to any `.js`, `.jsx`, `.ts`, `.tsx`, or `.py` file on GitHub
2. Wait 1-2 seconds for analysis to complete
3. You'll see:
   - **Heatmap**: Colored background on code lines (green = simple, red = complex)
   - **CC Badges**: Small badges showing cyclomatic complexity on each function
   - **Toggle Button**: Bottom-right floating button to open/close the side panel
   - **Fork Button**: "Fork via NoseyCoder" button in the file actions area

### Using the Popup Dashboard

Click the NoseyCoder toolbar icon to see:

- **Dashboard Tab**: File summary (LOC, functions, CC, MI), function list sorted by complexity, heatmap toggle
- **Linter Tab**: All detected issues with severity icons and line numbers
- **Refactor Tab**: Actionable refactoring suggestions with priority and pattern names
- **GitHub Tab**: Login status, fork controls, GitHub Actions workflow generator

### Generating a GitHub Actions Workflow

1. Open the NoseyCoder popup
2. Go to the "GitHub" tab
3. Select language (JavaScript or Python)
4. Check trigger events (push, pull_request, manual)
5. Click "Generate Workflow"
6. Copy the YAML and save as `.github/workflows/noseycoder.yml` in your repo

### Using the Web Demo

1. Visit the web demo URL
2. Click "Try Live Demo" or navigate to "Analyzer"
3. Paste your code or use the built-in JS/Python samples
4. Set the filename (must end in `.js`, `.ts`, `.py`, etc.)
5. Click "Analyze Code"
6. View the full results dashboard with all metrics

---

## Supported Languages

| Language | Extensions | Status |
|---|---|---|
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | Supported |
| TypeScript | `.ts`, `.tsx` | Supported |
| Python | `.py`, `.pyw` | Supported |
| Java | `.java` | Planned |
| Go | `.go` | Planned |
| C/C++ | `.c`, `.cpp`, `.h` | Planned |

---

## Metrics Reference

### Cyclomatic Complexity (CC)

```
M = 1 + number of decision points
```

Decision points counted: `if`, `else if`/`elif`, `for`, `while`, `case`, `catch`/`except`, `&&`/`and`, `||`/`or`, `??`, ternary `?`

| CC | Risk Level |
|---|---|
| 1-5 | Low risk, simple function |
| 6-10 | Moderate, manageable |
| 11-20 | High, consider refactoring |
| 21+ | Critical, must refactor |

### Maintainability Index (MI)

```
MI = 171 - 5.2 * ln(Halstead Volume) - 0.23 * CC - 16.2 * ln(LOC)
```

Normalized to 0-100 scale:

| MI | Rating |
|---|---|
| 80-100 | Excellent |
| 60-79 | Good |
| 40-59 | Moderate |
| 20-39 | Poor |
| 0-19 | Critical |

### Halstead Metrics

| Metric | Formula | Description |
|---|---|---|
| Vocabulary (n) | n1 + n2 | Unique operators + unique operands |
| Length (N) | N1 + N2 | Total operators + total operands |
| Volume (V) | N * log2(n) | Information content |
| Difficulty (D) | (n1/2) * (N2/n2) | Error proneness |
| Effort (E) | V * D | Mental effort to understand |
| Time (T) | E / 18 | Estimated coding time (seconds) |
| Bugs (B) | V / 3000 | Estimated delivered bugs |

---

## Linter Rules

| Rule | Threshold | Severity |
|---|---|---|
| `max-function-length` | > 50 LOC (> 100 = critical) | Warning / Critical |
| `max-nesting-depth` | > 3 levels (> 5 = critical) | Warning / Critical |
| `max-params` | > 5 parameters | Warning |
| `high-complexity` | CC > 10 (> 20 = critical) | Warning / Critical |
| `multiple-returns` | > 3 return statements | Info |
| `large-switch` | > 10 cases | Warning |
| `duplicate-logic` | > 80% similarity between functions | Info |

---

## Architecture

### Chrome Extension (Manifest V3)

```
Content Script (runs on GitHub pages)
  |-- analyzer-core.js  -> Parses code, computes all metrics
  |-- content.js        -> DOM manipulation, heatmap, badges, panel, fork button
  |-- content.css       -> Overlay styling

Background Service Worker
  |-- background.js     -> OAuth handler, GitHub API client, workflow generator
                           Token storage via chrome.storage.local

Popup UI
  |-- popup.html/css/js -> Dashboard tabs: metrics, linter, refactor, GitHub, settings
```

### Web Demo

```
React Frontend (port 3000)
  |-- LandingSection    -> Hero, features, formulas, install guide
  |-- AnalyzerDemo      -> Code editor with sample code
  |-- ResultsDashboard  -> Full metrics visualization

FastAPI Backend (port 8001)
  |-- POST /api/analyze -> Runs analysis, stores to MongoDB
  |-- GET /api/history  -> Returns past analyses
  |-- GET /api/health   -> Health check
```

### Data Flow

```
GitHub File Page
  -> Content Script extracts code from DOM
  -> analyzer-core.js parses and computes metrics
  -> Results rendered as heatmap overlay + side panel
  -> Results sent to popup via chrome.runtime messaging
  -> Fork/Actions via background service worker -> GitHub API
```

---

## API Reference

### `POST /api/analyze`

Analyze a code snippet.

**Request:**
```json
{
  "code": "function hello() { return 42; }",
  "filename": "example.js"
}
```

**Response:**
```json
{
  "language": "javascript",
  "filename": "example.js",
  "summary": {
    "loc": 1,
    "sloc": 1,
    "blankLines": 0,
    "commentLines": 0,
    "functionCount": 1,
    "cyclomaticComplexity": 1,
    "complexityLevel": { "label": "Low", "color": "#3fb950", "level": 0 },
    "maintainabilityIndex": 85.23,
    "maintainabilityLevel": { "label": "Excellent", "color": "#3fb950", "level": 0 },
    "halstead": {
      "uniqueOperators": 3,
      "uniqueOperands": 2,
      "totalOperators": 3,
      "totalOperands": 2,
      "vocabulary": 5,
      "length": 5,
      "volume": 11.61,
      "difficulty": 1.5,
      "effort": 17.41,
      "time": 0.97,
      "bugs": 0.004
    }
  },
  "functions": [...],
  "linterIssues": [...],
  "refactorSuggestions": [...],
  "heatmap": [...]
}
```

### `GET /api/history`

Returns the last 50 analysis records.

### `GET /api/health`

Returns `{ "status": "ok", "service": "NoseyCoder API" }`.

---

## Troubleshooting

### Extension not analyzing files

- **Check language support**: Only `.js`, `.jsx`, `.ts`, `.tsx`, `.py` files are analyzed
- **Refresh the page**: GitHub uses SPA navigation; sometimes a hard refresh helps
- **Check permissions**: Ensure the extension has access to `github.com` (check `chrome://extensions/`)
- **Open DevTools**: Press F12 on GitHub, check the Console tab for errors mentioning "NoseyCoder"

### Heatmap not showing

- Click the floating toggle button (bottom-right) to ensure the heatmap is enabled
- Check the popup Settings to verify heatmap is toggled ON
- Some GitHub UI versions may use different DOM structures; the extension handles both classic and modern views

### Fork button not appearing

- You need to set a GitHub Personal Access Token in the extension settings
- The fork button only appears on file pages of repositories you haven't already forked
- Check rate limits: GitHub API allows 5000 requests/hour for authenticated users

### Backend not starting

- Ensure MongoDB is running: `mongosh` or `docker ps`
- Check the `.env` file has correct `MONGO_URL` and `DB_NAME`
- Check port 8001 is available: `lsof -i :8001`

### Frontend build errors

- Run `yarn install` to ensure all dependencies are installed
- Check Node.js version: `node --version` (needs >= 18)
- Clear cache: `rm -rf node_modules/.cache && yarn start`

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test
4. Submit a pull request

### Development Tips

- The analysis engine in `content/analyzer-core.js` is shared between the extension and can be tested independently in Node.js
- Use `chrome://extensions/ -> NoseyCoder -> Inspect views: service worker` to debug the background script
- Use Chrome DevTools on GitHub pages to debug content scripts (they appear under "Content scripts" in Sources)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
