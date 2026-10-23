# NoseyCoder — Project Roadmap & Action Items

## Current State Assessment

The project is a **Chrome extension + web demo** for static code analysis on GitHub file pages. It's at **MVP stage (v3)** with the following components:

| Component | Status | Notes |
|---|---|---|
| Chrome Extension | ✅ Functional | Manifest V3, content scripts, popup, background worker |
| Backend (FastAPI) | ✅ Functional | `/api/analyze`, `/api/history`, `/api/health` |
| Frontend (React) | ✅ Functional | Landing page, analyzer demo, results dashboard |
| Tests | ⚠️ Minimal | Only `backend_test.py` (hits remote URL), `tests/` has empty `__init__.py` |
| CI/CD | ❌ Missing | No GitHub Actions workflow for the project itself |
| Security | ⚠️ Gaps | No token encryption, mocked OAuth, `.env` patterns duplicated in gitignore |

---

## Action Items (Ordered by Execution Priority)

### 🔴 P0 — Critical / Do First

#### 1. Fix Code Quality & Hygiene Issues

> ⚠️ Several issues in the existing codebase that should be fixed before adding new features.

- **`.gitignore` has duplicated env blocks** (lines 82-96 repeat `.env` patterns 4 times with stray `-e` flags) — clean up
- **`backend_test.py` still references "CodeScope"** (old project name) and points to a remote preview URL (`https://github-metrics-hub.preview.emergentagent.com`) — update to use localhost and rename class
- **`test_result.md`** — testing data section is empty; initialize it with current task status
- **`.gitconfig` has `emergent-agent-e1` identity** — likely leftover from scaffolding; update or remove

#### 2. Write Real Backend Tests (pytest)

The `tests/` directory only has an empty `__init__.py`. The only test file (`backend_test.py`) is a manual integration test hitting a remote URL.

- Create proper **pytest unit tests** for the analysis engine functions in `server.py`:
  - `detect_language()`
  - `compute_cyclomatic_complexity()`
  - `compute_halstead()`
  - `compute_maintainability_index()`
  - `extract_js_functions()` / `extract_py_functions()`
  - `run_linter()` / `generate_refactor_suggestions()`
- Create **API integration tests** using `httpx.AsyncClient` (FastAPI TestClient)
- Move `backend_test.py` to `tests/` and refactor it

#### 3. Set Up CI/CD Pipeline

- Create `.github/workflows/ci.yml` with:
  - Python backend: lint (`flake8`/`mypy`), format check (`black --check`), test (`pytest`)
  - Frontend: `yarn install`, `yarn build`, `yarn test`
  - Extension: manifest validation, basic lint

---

### 🟡 P1 — High Priority / Next Up

#### 4. Implement Real GitHub OAuth 2.0

Per the PRD backlog, OAuth is currently **mocked**. This is the #1 planned feature.

- Replace mocked OAuth in `background.js` with real GitHub OAuth 2.0 flow
- Use `chrome.identity.launchWebAuthFlow()` for the extension
- Securely store tokens using `chrome.storage.session` (not `.local`)
- Add token refresh logic

#### 5. Implement Token Encryption

- Encrypt GitHub PAT before storing in `chrome.storage`
- Use Web Crypto API (`SubtleCrypto`) for AES-GCM encryption
- Add passphrase or extension-scoped key derivation

#### 6. Add Error Handling & Edge Cases to Backend

- The `analyze_code()` function has no try/catch for regex failures on malformed code
- `extract_js_functions()` regex patterns can false-match (e.g., `if(x)` matches the method pattern)
- Add input size limits to prevent DoS on the `/api/analyze` endpoint
- Handle MongoDB connection failures gracefully (currently crashes on startup if MongoDB is down)

#### 7. Clean Up `requirements.txt`

Several dependencies appear unused in `server.py`:
- `boto3`, `requests-oauthlib`, `cryptography`, `pyjwt`, `bcrypt`, `passlib`, `python-jose` — none are imported
- `pandas`, `numpy`, `jq`, `typer` — not used in the backend
- `emergentintegrations` — scaffolding artifact

> ❗ Removing unused deps will significantly reduce install time and container size. Verify none are used by other scripts before removing.

---

### 🟢 P2 — Medium Priority / Polish

#### 8. Frontend Improvements

- **Add proper routing** — currently everything is on `/` with view-state switching; add `/analyzer` and `/results` routes
- **Add loading states / skeleton screens** for analysis results
- **Add error toasts** — `sonner` is installed but doesn't appear to be used for error feedback
- **Responsive design audit** — verify mobile experience

#### 9. Chrome Extension UX Improvements

- **Add an options page** (`chrome.options_page`) as a more spacious alternative to the popup for settings
- **Add keyboard shortcuts** for toggling heatmap / opening panel
- **Add badge text** showing total complexity score on the extension icon
- **Handle GitHub SPA navigation** — currently uses `document_idle`; add `MutationObserver` or `navigation` event handling for pushState changes

#### 10. Separate Analysis Engine into Shared Module

The analysis engine is duplicated:
- `chrome-extension/content/analyzer-core.js` (JavaScript, runs in browser)
- `backend/server.py` (Python port, runs on server)

These **will drift**. Consider:
- Extracting the JS engine as an npm package usable by both extension and a Node.js backend
- Or establishing a test suite that validates both engines produce identical output for the same inputs

#### 11. Add Docker Compose Setup

Create `docker-compose.yml` for one-command local development:
```yaml
services:
  backend:
    # FastAPI + uvicorn
  mongodb:
    # MongoDB 7
  frontend:
    # React dev server
```

---

### 🔵 P3 — Future / Nice to Have

#### 12. Multi-Language Support (Java, Go, C/C++)

Per PRD backlog. Requires:
- New regex patterns for function extraction
- Language-specific keyword/operator sets
- Language-specific nesting depth calculation

#### 13. Cognitive Complexity Scoring

More nuanced than cyclomatic complexity — penalizes nesting and flow-breaking constructs.

#### 14. AI-Powered Refactor Suggestions

Current suggestions are rule-based. Could integrate an LLM to provide context-aware refactoring advice.

#### 15. Trend Tracking Across Commits

Track complexity/maintainability changes over time for a repository using the GitHub API + stored analysis history.

#### 16. Chrome Web Store Publishing

- Create promotional images and screenshots
- Write store listing description
- Submit for review
- Set up update workflow

---

## Recommended Execution Order

```
1. Fix Code Hygiene
    ↓
2. Write pytest Tests
    ↓
3. Set Up CI/CD
    ↓ ↘ ↘
    ↓  6. Backend Error Handling
    ↓  7. Clean requirements.txt
4. Real GitHub OAuth
    ↓
5. Token Encryption
    ↓
8. Frontend Polish
    ↓
9. Extension UX
    ↓
10. Shared Analysis Engine
    ↓
11. Docker Compose
    ↓
12-16. Future Features
```

## Open Questions

1. **Which items do you want to start with?** Recommend starting with P0 items (1-3) as a foundation sprint.
2. **Is the remote preview URL (`emergentagent.com`) still active?** The test file references it — should we keep it or fully switch to localhost testing?
3. **Do you want to keep the `emergentintegrations` dependency and `.emergent/` config?** These appear to be from the scaffolding platform.
4. **Are you planning to publish to Chrome Web Store soon?** That would reprioritize some items (e.g., real OAuth becomes P0).
