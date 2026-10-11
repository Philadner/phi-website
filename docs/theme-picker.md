# Sidebar themes

The sidebar Theme row opens a dedicated pane with four-colour swatches, theme names and fixed light/dark modes. The menu slides right out of the clipped sidebar as themes slide in from the left (180ms ease-out). Back returns to the menu, restores keyboard focus and discards unsaved previews. Reduced-motion preferences disable the transition.

Selecting a theme immediately previews it on the live site without saving. Apply saves the theme ID; a blocking head script restores its palette before paint. Storage errors retain the applied theme for the current visit. Cancel, Back and closing the drawer restore the last applied theme. The drawer uses the dynamic viewport height and bottom safe-area inset to keep Apply visible on mobile while the theme list scrolls independently.

There are 19 choices: phi, 17 album palettes from the supplied specification, and hub as the final choice. phi uses the original labs CSS gold (`#FFD700`) styling, including its original backgrounds and glow colours. hub uses black, white, grey and orange (`#FF9900`). `src/lib/themes.json` is the palette source of truth.

`AlbumThemes.css`, `ThemePages.css` and `ThemeDetails.css` scope colour overrides to non-phi themes. Existing page stylesheets, layouts, typography, corner radii, glow effects, glass effects and animations are preserved. The rainbow Jay Game banner is preserved exactly, including its colours and animations. 1998 mode retains its own stylesheet. See `theme-contrast.md` for measured palette limitations.

Validation:

- `npm run test:themes`
- `npx vite build`
- `node scripts/test-themes.mjs --check-build`
- Chromium checks: every palette; preview/apply/cancel/back; reload; blocked storage; keyboard controls; mobile; music/chat routes; slide direction, clipping and reduced motion.

`npm run build` passes; the existing ChatMarkdown className types were corrected to arrays. The repository-wide lint baseline still contains unrelated errors. Focused lint for the picker, theme helper, fixtures and theme lab passes.

## Local page demos

Open `/theme-lab` on the PR preview. Links open actual page components with explicit `?theme-demo=1` fixtures: populated/empty/error chat, guest join, music album/artist/search, news, stats and tracker pages. Chat messages, game moves and silent 24-second audio playback are local. Demo mode disables Supabase chat realtime and serves API requests from this tab; unsupported demo actions return an explanatory error. Normal visits do not load fixtures. Return to phi exits demo mode.

Derived text, muted, border and action roles use only existing palette colours. Menus and player surfaces match the selected background. Gameplay colours, charts and media artwork remain distinct where colour conveys their meaning. No page geometry or typography is changed.

Repeat the browser matrix against `npm run dev` using `node scripts/test-theme-pages.mjs`. Playwright is optional: install it separately and set `PHI_PLAYWRIGHT_MODULE` to its `index.mjs`; set `PHI_CHROMIUM` to a system Chromium binary if needed. `PHI_TEST_URL` defaults to `http://localhost:5173`. This checks all 19 palettes on populated chat/music at mobile and desktop widths, page errors, horizontal overflow, themed surfaces, short mobile picker viewports, actual mobile playback and swipe handling. Track pointer capture begins only after horizontal movement, so ordinary taps reach the play button.
