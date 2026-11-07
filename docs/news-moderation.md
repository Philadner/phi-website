# News moderation

News uses `/api/news` and the existing phrase moderation preferences. The title,
body and author are reviewed together by Omni and, below the calibrated Omni
thresholds, the existing school-safety classifier. Unknown reviews stay hidden;
hard exclusions cannot be revealed. Failed moderation never inserts an article.
The API validates lengths, enforces same-origin writes and rate-limits submissions.
Default GETs return safe articles only; `?includeFiltered=1` includes reviewed
articles that the browser filters using the visitor's settings.

Apply `supabase/migrations/20261107001000_news_moderation.sql` to the explicit
website project `somvkodojhizygkxupug` before deploying the frontend/API changes.
The existing production variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`OPENAI_API_KEY` are reused. `VITE_NEWS_API_URL` is no longer used.

Run `node scripts/moderate-news.mjs` to inspect the legacy import, then add
`--apply` to review and import. It reads environment variables or
`.env.phrases.local`, verifies the project, backs up both feeds under ignored
`output/*.local`, saves review results, preserves article IDs/authors/dates,
rejects changed or malformed legacy articles, and verifies each imported row.
Re-running skips unchanged reviewed rows. Hard-excluded items remain in the
local audit/backup and are never imported. The legacy API is left intact; the
website no longer reads or writes it after deployment. Take the final import
immediately before switching the website, to include any last legacy submissions.

Verify with `node scripts/test-news-moderation.mjs`, `npm run lint` and
`npm run build`. Vite also serves `/api/news` for local API checks.
