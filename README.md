# phi.me.uk labs

Welcome to the codebase behind my phi labs site, the playground where every shiny idea for phi.me.uk ships first. It is part digital garden, part arcade cabinet, part changelog diary. The main branch runs the production site, the labs branch is where the chaos happens.

## What makes it fun
- Home page that never sits still: a tilt reacting hero wordmark, animated typewriter loops, and a ticker fed from my edge kv store.
- Quick Links hub that doubles as a stealth Flash arcade when you tap `g`, complete with a Ruffle powered loader and a panic button mapped to F1.
- Archive.org powered music digger with buttery overlay transitions (Framer Motion), prefetching audio metadata, and deep links per album.
- Realtime-ish changelog duo: Markdown notes for the human version plus a live feed of GitHub commits pulled through a Vercel function.
- Workin hard or hardly workin stats panel that pings Vercel and GitHub to judge whether I have actually shipped anything today.
- Browser based chatroom hanging off a tiny WebSocket server on Render, because sometimes you just want to yell into the void.
- Append page that lets friends drop new phrases into the homepage ticker via a locked-down POST endpoint.

## Under the hood
- React 19 + TypeScript + Vite for the front end, with Framer Motion for the fancy transitions.
- Global styling is hand rolled CSS, lots of custom animation math, and a hover aware collapsing title bar.
- Serverless bits live in `api/`: `stats.ts` hits the Vercel and GitHub APIs, `commits.ts` streams commit history, and `append.ts` proxies writes to my Cloudflare Worker KV.
- Deploys happen on Vercel; the same code runs on phi.me.uk and labs.phi.me.uk, just pointed at different branches.
- Ruffle loads on demand to bring Flash classics back to life, and everything tries to respect reduced motion settings.

## Running it locally
```bash
pnpm install     # or npm/yarn if you insist
pnpm dev         # launches Vite on http://localhost:5173
```

The music search, changelog commits, stats panel, and append page all call serverless endpoints. To avoid 500s while developing, set these environment variables before running the dev server:

```
GITHUB_TOKEN=ghp_yourTokenWithContentsRead
GITHUB_REPO=YourUser/your-repo-name
GITHUB_BRANCH=labs                 # optional, defaults to labs
VERCEL_TOKEN=vercelPatHere
VERCEL_PROJECT=phi-website
SITE_TOKEN=kv-writer-token         # used by /api/append
```

Drop them into a `.env.local` file at the project root or export them in your shell. The WebSocket chat will try to connect to `wss://phi-chat-server.onrender.com`; update the URL in `src/pages/Chatroom.tsx` if you are running your own socket.

## Roadmap vibes
- Smooth out the music player overlay for mobile browsers.
- More panic destinations and a visual cue when stealth mode is armed.
- Brighter analytics so the stats page has more to flex.

If you want to keep tabs on what broke this week, check `src/content/changelog.md` or visit `/realchangelog` on the site. Suggestions, playlists, and bug reports: github issues or an email if you insist at [phil@phi.me.uk](mailto:phil@phi.me.uk). Stay epic.
