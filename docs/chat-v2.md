# Chatroom V2

The public lobby lives at `/chat`. Guests pick a unique username (2–24 ASCII
letters, numbers, spaces, underscores or hyphens). An opaque, HttpOnly cookie
remembers their identity for 30 days. Names are reserved until that identity
expires; these are guest identities, not verified accounts.

## Core release

- Vercel `/api/chat` handles history, guest sessions, renaming and message writes.
- Supabase stores messages and delivers inserts through Postgres Changes.
- Supabase Presence supplies the online roster/count, deduplicated by guest ID
  across tabs. It is advisory presence, not an authentication mechanism.
- Markdown includes headings, lists, tables, quotes, fenced code, bold, italic,
  strikethrough and links. Raw HTML is disabled. External Markdown images render
  as links until uploads are implemented.
- Font spans: `:font[**hello**]{family=serif}`. Allowed fonts are `sans`, `serif`,
  `mono`, `handwritten`, `display`; the toolbar wraps selected text.
- Searchable emoji picker; `/nick name`, `/me action`, `/help` commands.
- Last 100 messages load initially; earlier messages can be paged in. Realtime
  arrivals, reconnect recovery and HTTP retries deduplicate by message IDs.

## Configuration

Use the existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` (or
`VITE_SUPABASE_PUBLISHABLE_KEY`) in Vercel. No new service/account is needed.

Apply `supabase/migrations/20261006001000_create_chat_v2.sql` to the same project.
It creates two new tables, service-role-only write RPCs, public read access to
messages, and the Realtime publication entry. Never expose the service role key
to the browser. Sessions and hashed credentials cannot be read by guests.
Sending is rate limited transactionally to one message per second per identity;
new identities are limited to ten per IP per hour. Client IDs make retries
idempotent. Message length is capped at 8,000 characters.

For local full-stack development, populate `.env.local` with the existing
credentials and use `vercel dev` (plain Vite does not serve serverless APIs).

## Next releases

1. Clipboard images/GIFs and file uploads using the `phi-website-db` Vercel Blob
   store, with attachment metadata in Supabase.
2. `/ai`, server-side OpenAI calls and web search. History is opt-in per request:
   the AI asks, and the invoking user grants the last 5 or last 20 messages.
3. Turn-based chess (`react-chessboard`), connect four, tic tac toe, Wordle race,
   battleships and Uno, with game commands and UI controls.
4. Searchable GIF provider integration after choosing/configuring Giphy or Klipy.
