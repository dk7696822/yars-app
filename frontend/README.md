# YARS frontend

React 19 + Vite + Tailwind UI for the YARS back-office app. See the repo's
[HANDOFF.md](../HANDOFF.md) for architecture, conventions and deployment.

```bash
npm install
npm run dev     # local dev server (port 8080; use --port 5173 to match the backend's CORS list)
npm test        # Vitest (shared order-math vectors live in backend/tests/fixtures)
npm run build   # production bundle → dist/, deployed with Firebase Hosting
```
