# Sidebar themes

The sidebar Theme row opens a dedicated pane with four-colour swatches, theme names and fixed light/dark modes. The menu slides right out of the clipped sidebar as themes slide in from the left (180ms ease-out). Back returns to the menu, restores keyboard focus and discards unsaved previews. Reduced-motion preferences disable the transition.

Selecting a theme immediately previews it on the live site without saving. Apply saves the theme ID; a blocking head script restores its palette before paint. Storage errors retain the applied theme for the current visit. Cancel, Back and closing the drawer restore the last applied theme. The drawer uses the dynamic viewport height and bottom safe-area inset to keep Apply visible on mobile while the theme list scrolls independently.

There are 19 choices: phi, 17 album palettes from the supplied specification, and hub as the final choice. phi uses the original labs CSS gold (`#FFD700`) styling, including its original backgrounds and glow colours. hub uses black, white, grey and orange (`#FF9900`). `src/lib/themes.json` is the palette source of truth.

`AlbumThemes.css` scopes colour overrides to non-phi themes. Existing page stylesheets, layouts, typography, corner radii, glow effects, glass effects and animations are preserved. The rainbow Jay Game banner is preserved exactly, including its colours and animations. 1998 mode retains its own stylesheet. See `theme-contrast.md` for measured palette limitations.

Validation:

- `npm run test:themes`
- `npx vite build`
- `node scripts/test-themes.mjs --check-build`
- Chromium checks: every palette; preview/apply/cancel/back; reload; blocked storage; keyboard controls; mobile; music/chat routes; slide direction, clipping and reduced motion.

Full `npm run lint` and `npm run build` currently fail identically on unchanged labs: 26 lint errors / 9 warnings, and two ChatMarkdown className type errors. Focused lint for the new component, theme helper and Vite config passes.
