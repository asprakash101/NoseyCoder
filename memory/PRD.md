# NoseyCoder – PRD & Implementation Record

## Original Problem Statement
NoseyCoder is a Chrome extension that performs in-browser static code analysis directly on GitHub file pages. Computes Cyclomatic Complexity, Maintainability Index, Halstead metrics, highlights complex functions inline, renders heatmaps, suggests refactoring improvements, provides linter-style feedback, enables GitHub login, and allows users to fork repositories directly from the GitHub interface.

## User Choices
- **Languages**: JavaScript/TypeScript + Python
- **Theme**: Dark (GitHub-like)
- **OAuth**: Mocked for now
- **Fork/GitHub Actions**: Fully functional with real tokens
- **Format**: Standalone Chrome extension + web demo

## What's Been Implemented (Jan 2026)
- [x] Full Chrome extension with Manifest V3
- [x] Static analysis engine (JS/TS + Python): Cyclomatic Complexity, Halstead, MI
- [x] Linter rules: 7 rules
- [x] Refactoring suggestions: 4 patterns
- [x] Heatmap visualization
- [x] GitHub OAuth (mocked), fork repository, GitHub Actions workflow generator
- [x] Extension popup dashboard with 4 tabs + settings
- [x] Content script with 2025 GitHub DOM selectors
- [x] Web demo landing page + interactive code analyzer
- [x] Backend API with MongoDB history
- [x] Renamed from CodeScope to NoseyCoder
- [x] Comprehensive README with build/deploy instructions
- [x] Fixed GitHub DOM selectors for 2025 React-based file viewer

## Iteration Log
- **v1**: Full MVP build — extension + web demo + backend API
- **v2**: Renamed to NoseyCoder, added detailed README
- **v3**: Fixed content script DOM selectors for GitHub 2025 (isFilePage, getCodeContent, getFileName, heatmap rendering). Added retry mechanism, 8-strategy code extraction, URL-based detection.

## Prioritized Backlog

### P0 (Next)
- Real GitHub OAuth 2.0 integration
- Token encryption

### P1
- Multi-language support (Java, Go, C/C++)
- Cognitive complexity scoring

### P2 (Future)
- AI-powered refactor suggestions
- Trend tracking across commits
- Chrome Web Store publishing
