# Security Policy

## Reporting a vulnerability

Email **security@kimit.cloud** (or open a private GitHub Security Advisory). Do not post exploit details in public issues.

## Data handling summary

| Scenario | Behavior |
|----------|----------|
| File &lt; 10MB, cloud backup OFF | Parsed in browser; rows stay local |
| File &lt; 10MB, cloud backup ON | Optional copy may be stored (MinIO) when authenticated |
| File &gt; 10MB | Uploaded to backend for processing |
| AI Chat | Dataset excerpts sent to Groq API |
| Session | Dataset cached in browser IndexedDB until cleared |

## Recommendations for users

- Do not upload regulated/sensitive data unless you accept cloud and AI processing.
- Disable optional cloud backup for maximum local privacy.
- Clear session from the sidebar when finished on shared computers.

## Supported versions

Security fixes are applied to the `main` branch and deployed to [kimit.cloud](https://kimit.cloud).
