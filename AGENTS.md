# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite + React + TypeScript app with a small serverless API layer.
- `src/`: Frontend code. Pages live in `src/pages/`, reusable UI in `src/components/`, hooks in `src/hooks/`, and styles in `src/stylesheets/`.
- `api/`: Vercel serverless endpoints (`stats.ts`, `commits.ts`, `append.ts`).
- `public/`: Static assets served as-is.
- `dist/`: Build output (generated; do not edit).

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server on Vite defaults.
- `npm run devhost`: Start dev server bound to host/network.
- `npm run lint`: Run ESLint across the repo.
- `npm run build`: Type-check (`tsc -b`) and create production bundle.
- `npm run preview`: Serve the production build locally.

Use `npm install` first. For API-backed pages, set env vars in `.env.local` (for example `GITHUB_TOKEN`, `VERCEL_TOKEN`, `SITE_TOKEN`).

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`/`.tsx`) and modern ESM.
- Indentation: 2 spaces; keep semicolon-free style consistent with current files.
- Components/pages: `PascalCase` filenames and exports (for example `MusicPlayer.tsx`).
- Hooks: `camelCase` prefixed with `use` (for example `useScrollLock.ts`).
- Keep route/page-specific CSS in `src/stylesheets/` and import it where used.
- Run `npm run lint` before opening a PR.

## Testing Guidelines
There is currently no dedicated test framework configured. Treat these as required checks:
- `npm run lint`
- `npm run build`
- Manual verification of touched routes and related `api/*` endpoints

If you add tests, prefer colocated `*.test.ts(x)` files and document the command in `package.json`.

## Commit & Pull Request Guidelines
Recent history shows short, imperative commit subjects. Keep commits focused and descriptive, e.g. `fix mobile menu focus trap`.
- Agents should commit changes as they work, in small logical increments.
- Agent-authored commit subjects must be prefixed with `codex:` (for example `codex: fix mobile menu focus trap`).
- One logical change per commit.
- PRs should include: summary, affected routes/endpoints, env var changes, and screenshots/GIFs for UI updates.
- Link relevant issues/tasks and include quick verification steps reviewers can run.

## Security & Configuration Tips
- Never commit secrets; use `.env.local` for tokens.
- Validate new API handlers for auth and input checks before deployment.
- Treat `dist/` as generated output.
