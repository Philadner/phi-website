# Homepage navigation and themes

The homepage has two wheels: categories (Socials, Projects, phi, Navigate, Theme) and a vertical item wheel. Categories scroll vertically in the right column on desktop and horizontally at the bottom on mobile. phi is the default and retains its shuffled community phrases, automatic cycling and single-line width filtering. Navigation and theme names wrap at their full focused width before the complete block scales down; their line breaks stay fixed during selection. Off-screen items remain available through scrolling.

Swipe, scroll or use arrow keys to select categories and items. Tap anywhere in the large item wheel or press Enter to activate the centred item. Swipes only scroll and never activate. Touch taps have no highlight box; keyboard focus remains visible. The Home button across the website returns to `/`, or resets an existing homepage to phi. The old sidebar is removed; its destinations are in Navigate. Games remain available there on mobile, including the rainbow Jay Game banner.

Scrolling through Theme immediately previews each palette. Activate the centred theme to apply and save it. Leaving Theme without applying restores the previous palette. A blocking head script restores saved colours before paint. If browser storage is unavailable, applying still works for the current visit.

There are 23 choices: original CSS-gold phi, 20 album palettes, MyCP, and hub last. MyCP and hub only appear when Settings → Moderation → Show generally offensive content is on. Turning it off while either theme is applied restores phi. Saved restricted themes also fall back to phi before first paint when the setting is off. `src/lib/themes.json` is the palette source. BRAT uses green `#8ACE00` with black text; A Broken Frame uses the four supplied swatches; The Now Now uses cover blue `#2FE2DE`, black text and pink `#E4548B`. Page layouts and gameplay colours remain intact. Legacy `/1998` routes redirect to the regular homepage.

Category changes use overlapping centre-out ripples, with the new centre appearing before the outgoing list finishes. Reduced motion disables ripples and uses immediate selection. Haptic requests are 8ms for manual vertical selection, 14ms for category changes and 18ms for activation. Automatic cycling, initialization, hovering and snapping do not add ticks. Unsupported vibration APIs are ignored.

## Local demos and validation

`/theme-lab` links to actual page components with `?theme-demo=1` fixtures for chat, music, news, stats and tracker. Chat messages, games and silent audio playback are local; demo mode disables chat realtime. Normal visits do not load fixtures.

Run `npm run build`, `npm run lint`, `npm run test:themes`, and `npm run test:home-navigation`. The browser checks require separately installed Playwright; set `PHI_PLAYWRIGHT_MODULE` to its `index.mjs` and optionally `PHI_CHROMIUM` to a Chromium binary. `PHI_TEST_URL` defaults to `http://localhost:5173` with the development server running.

`node scripts/test-theme-pages.mjs` checks all available palettes on populated chat/music at mobile and desktop sizes, playback and swipes, Home navigation, short/landscape viewports and legacy mode removal. The homepage suite checks phrase filtering and cycling, keyboard and pointer interactions, haptic requests, all themes, preview cancellation, stable full-size wrapping, reduced motion and rapid category changes. Hardware vibration feel still requires a supported physical device. See `theme-contrast.md` for existing palette limitations.
