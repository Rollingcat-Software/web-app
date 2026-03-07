# Changelog - FIVUCSAS Web App

## [Unreleased] - 2026-03-07

### Added
- CLAUDE.md with project context, known issues, and auth method UI status
- ROADMAP.md with phased auth enrollment and integration plan
- Auth method enrollment gap analysis in TODO.md (9 new items: AE-1 through AE-9)

### Documented
- Auth method UI status matrix: all 10 have step components, only 2 have enrollment UIs
- Missing enrollment UIs: Hardware Key, Fingerprint, Voice, NFC Document
- TotpEnrollment and QrCodeStep disconnected from backend endpoints
- Voice auth disabled (isActive: false), NFC is web placeholder only
- Model/enum mismatches with backend (5 critical issues)
- 16 backend features with no frontend UI

### Previous
- Cross-module integration audit (March 2026): 38 issues identified
- Previous audit (Feb 2026): 47/48 items completed
