# Phrase moderation rollout

## 1. Calibrate locally

Run `npm run moderation:lab` and open http://127.0.0.1:4318.
Requires Node 22 or newer. No extra dependencies are required. Set
`MODERATION_LAB_PORT` to use another port. Stop with Ctrl+C.

Enter your OpenAI API key in the password field. Paste one sample per line or
a JSON array of strings. **Load current phrase list** reads the legacy endpoint
without changing it. **Run moderation** sends samples to OpenAI's
`omni-moderation-latest` moderation endpoint in batches of 32.

Each phrase above any category threshold is highlighted red. Sliders update
the preview immediately using the existing scores; they do not make API calls.
The numeric input allows fine adjustments. The comparison is score >= threshold.
Starting thresholds are 0.5 for experimentation, not OpenAI's internal thresholds
or final production values. Model scores measure category confidence, not severity.
The API's own `flagged` result is shown separately for comparison.

Export thresholds when satisfied. Export scored samples as well to preserve the
full moderation objects for the migration. Both exports can be restored through
the file picker. Only threshold preferences are automatically saved in local
storage. Keys, samples and scores stay in memory unless explicitly exported.
Exports never contain the API key. A failed batch leaves the previous complete
pass displayed; no partial pass is accepted.

Verification: `npm run test:moderation-lab` covers parsing, threshold boundaries,
batch alignment, upstream failures and the loopback server's access controls.
Tests use mocked OpenAI responses and do not require an API key.

OpenAI reference: https://developers.openai.com/api/docs/guides/moderation

## 2. Website integration

- Import the chosen thresholds as shared versioned configuration.
- Migrate the legacy phrase list into the existing Supabase project. Store each
  phrase alongside a `hatefulness` JSONB column containing the full moderation
  result, model snapshot and review time. Preserve the existing list during cutover.
- Moderate submissions server-side with a private API key before saving them.
  A moderation failure must not publish an unreviewed phrase.
- Return the matched category names to the submitter with:
  "your message will be hidden by default unless people turn moderation off.
  this is because it contains {issue}".
- Apply filtering to every phrase surface, including Home and Ticker. Default
  to hiding all phrases above the selected category thresholds.
- Add Settings at the far right of the home horizontal bar. Keep "Show filtered
  content" off by
  default. Turning it on exposes individual Show category items, all on. Turning
  one off hides phrases matching that category.
  Settings uses a separate subtab scroller: above the main scroller on mobile,
  to its left on desktop. Theme comes before Hate speech, and theme preview and
  application retain the original wheel interaction. Settings items use the normal
  home-menu text size. The secondary wheel appears from its centre outward.
  Support keyboard navigation and reduced motion.

Settings keep the existing scroll-to-focus and click-anywhere interaction.
Off items use outlined text with a strike-through. Enabling retracts the line
from right to left, followed 65 ms later by the text fill. Enabling Show filtered
content clears the individual hidden-category selections, so every Show item
starts on. Subtab-only gestures never
change the main section. Global content swipes visit subtabs first, then advance
the main section when swiping past a subtab boundary. Main-scroller gestures
always change main sections. Verify routing with `npm run test:home-swipe-routing`.

Four categories are hard exclusions at the calibrated thresholds: sexual/minors
(0.2), violence/graphic (0.4), illicit/violent (0.3), and self-harm/instructions
(0.2). A score at or above any of these rejects the submission with HTTP 422
before insertion. These categories have no user preference, cannot be revealed
with Show filtered content, and are excluded from imports. A database constraint
also rejects those rows (including missing or malformed scores for these four
categories). The hard-exclusion migration removes any existing matches.

The calibrated configuration is in `src/lib/phraseModeration.ts`. The phrase
tables and hard-exclusion constraint are already applied to the existing website
Supabase project. Runtime reads use `/api/phrases`, and submissions use `/api/append`.
Both need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; submissions additionally
need `OPENAI_API_KEY`. All three are server-side variables. For local verification,
put them in `.env.phrases.local` and start Vite with `--mode phrases`.

`node scripts/prepare-phrase-migration.mjs <export.json>` checks the current legacy
list against the exported scores and writes a filtered SQL import and backup under
`output/*.local` (git-ignored). It never applies the SQL automatically. Specify the
website project reference explicitly when applying SQL with Supabase CLI; a home
folder link may point to another project. Keep the legacy list intact during cutover.
