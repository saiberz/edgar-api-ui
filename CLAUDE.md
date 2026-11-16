# Notes for Claude

- Repo: apps/api (Bun + Elysia API) and apps/web (React + Vite frontend, added later)
- Use Elysia 1.4 (stable). @elysiajs/openapi is already installed, if the online docs and node_modules disagree, node_modules is right
- Read SPEC.md and GLOSSARY.md before planning. If code and SPEC.md disagree, stop and ask
- apps/api/src/schemas.ts defines what the API returns. Don't change it without asking
- Chain routes and `export type App = typeof app` (a frontend will use it later via Eden Treaty)
- Tests: `bun test` in apps/api, using fixtures/ and a fake fetch. Never call SEC in tests. Never depend on today's date: pass `now` in
- Prefer the simplest code that meets SPEC.md, prefer readability over clever code or fewer lines.
- Before completing: run `bun test` and `bunx tsc --noEmit` and show the output.
- No new dependencies without asking
- Never run git commit, git push or any git command that changes history.I review every diff and commit myself
- Use bun for everything (bun test, bun install, bun run, bunx). Bun loads .env automatically
