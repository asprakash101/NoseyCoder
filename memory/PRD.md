# NoseyCoder – PRD & Implementation Record

## Original Problem Statement
NoseyCoder (formerly CodeScope) is a Chrome extension that performs in-browser static code analysis directly on GitHub file pages. It computes Cyclomatic Complexity, Maintainability Index, Halstead metrics, highlights complex functions inline, renders heatmaps, suggests refactoring improvements, provides linter-style feedback, enables GitHub login, and allows users to fork repositories directly from the GitHub interface.

## User Choices
- **Languages**: JavaScript/TypeScript + Python
- **Theme**: Dark (GitHub-like)
- **OAuth**: Mocked for now
- **Fork/GitHub Actions**: Fully functional with real tokens
- **Format**: Standalone Chrome extension + web demo

## What's Been Implemented (Jan 2026)
- [x] Full Chrome extension with Manifest V3
- [x] Static analysis engine (JS/TS + Python): Cyclomatic Complexity, Halstead, MI
- [x] Linter rules: 7 rules including max-function-length, nesting, params, complexity, duplicates
- [x] Refactoring suggestions: decompose, parameter-object, extract-method, flatten
- [x] Heatmap visualization (green/yellow/red/dark-red gradient)
- [x] GitHub OAuth (mocked), fork repository, GitHub Actions workflow generator
- [x] Extension popup dashboard with 4 tabs + settings
- [x] Content script: inline heatmap, CC badges, side panel, fork button
- [x] Web demo landing page + interactive code analyzer
- [x] Backend API with MongoDB history
- [x] Renamed from CodeScope to NoseyCoder across all files
- [x] Comprehensive README with build, deploy, and usage instructions

## Iteration Log
- **v1**: Full MVP build — extension + web demo + backend API
- **v2**: Renamed to NoseyCoder, added detailed README with deployment instructions

## Prioritized Backlog

### P0 (Next)
- Real GitHub OAuth 2.0 integration (replace mock)
- Token encryption in chrome.storage

### P1
- Multi-language support (Java, Go, C/C++)
- Cognitive complexity scoring
- PR auto-comment bot

### P2 (Future)
- AI-powered refactor suggestions
- Trend tracking across commits
- Multi-branch comparison
- Technical debt scoring
- Chrome Web Store publishing
