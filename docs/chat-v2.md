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
  as links; verified uploaded images render as attachments.
- Font spans: `:font[**hello**]{family=serif}`. Allowed fonts are `sans`, `serif`,
  `mono`, `handwritten`, `display`; the text style box wraps selected text.
- Searchable emoji picker; `/nick name`, `/me action`, `/emoji`, `/format`,
  `/help`, `/upload` commands. `/help` opens the stuff menu; upcoming features are marked
  as unavailable. Menu labels transition into their commands on hover/focus.
- The titlebar online count opens the active-users drawer, including on mobile.
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

## Uploads

Apply `supabase/migrations/20261006002000_chat_attachments.sql` after the core
migration. Connect the existing `phi-website-db` Blob store's
`BLOB_READ_WRITE_TOKEN` to the same Vercel environments. Files upload directly
to Blob using scoped, authenticated tokens from `/api/chat-upload`; file bytes
never pass through the serverless request body. A signed callback and the
client's explicit completion request both verify the reserved path with Blob
`head`. Supabase records ownership, file details, upload status, and message ID.
Sending snapshots attachment metadata into the message atomically, so Realtime
arrivals contain their attachments. Draft metadata is private to the API.

Use `/upload`, the stuff menu, drag files/folders onto the room, or paste files
and images into the composer. Folder contents are flattened into individual
uploads; original relative paths are retained as tooltips. Nested directories
and multiple `readEntries` batches are supported. Clipboard GIF files retain
animation; clipboard sources that provide a PNG instead are uploaded as PNG.
Each queued file has its own titlebar progress circle. Completed circles fly
into the expanding attachment tray; reduced-motion preferences skip the flight.
Portrait images and documents use square tiles; landscape images use rectangles.
Selections in the textbox open a compact formatting toolbar outside the selected
lines. Raw HTML and arbitrary external image embedding remain disabled.

Limits: 25 MB per file, 20 files per message, two concurrent uploads, 60 upload
attempts or 200 MB per hour per identity. Empty files are rejected. Failed files
can be retried or removed; sending waits for all files to finish. Draft removal
cancels the request and deletes its unposted Blob. Sent attachments are immutable
and public, like the room. Unsaved drafts do not persist across reloads. Upload
reservations expire for sending after 24 hours; production retention/cleanup of
abandoned reservations can be added independently. General documents are stored
as `application/octet-stream` for download; only PNG, JPEG, GIF, WebP and AVIF
are embedded as images. Token issuance validates origin, guest session, names,
paths, sizes and limits; send validates ready attachments and ownership in SQL.

Run `npm run test:chat-uploads` for folder traversal, truncation and file-path
checks, alongside the required lint/build and live upload checks.

## Next releases

1. Gartic Phone: drawing rounds, timed handoffs and a final reveal.

## AI, mentions, replies and clears

Apply `supabase/migrations/20261006003000_chat_ai_replies_and_clears.sql` after
the upload migration. `/api/chat-ai` uses the existing `OPENAI_API_KEY` with
the exact model `gpt-6-luna`, Responses API structured output, and web search.
The output schema is `{ Message: string, modifiers: { request_context: boolean,
name: string | null } }`. Markdown and font spans use the normal message renderer.
AI names do not reserve guest names; `is_ai` is server-controlled, and a gold AI
badge always identifies generated messages. `/ai` and `@ai` remain stable;
mentioning the current AI name or replying to an AI message also invokes it.

Default memory is only earlier AI replies and the messages invoking them, capped
at 100 messages including the current invocation. Other room messages are not
sent by default. AI is told to request room context only when explicitly asked
about previous room messages. Its context-request message stays in chat with
inline controls visible to everyone, enabled only for the invoking identity.
Choose 5 or 20 previous messages; the With images checkbox is local state until
the choice is submitted. The grant is bound to that invocation and owner in SQL,
and AI then posts another reply. The original request remains, displaying the
committed choice. PNG/JPEG/WebP images can be included; document contents and
animated GIF/AVIF pixels are not sent to vision. Current invoking attachments
may include supported images without granting unrelated room history.

AI jobs are authenticated, durable, and claimed with a lease to avoid duplicate
provider calls from retries/tabs. Error replies can be retried. Worker recovery
starts after 3 minutes; provider calls time out after 85 seconds. Limits are 3
attempts per invocation, 30 attempts per identity/hour, 300 attempts per room/hour,
and a 5-second initial-call cooldown. API keys and private job rows stay server-side.
Room clears cancel outstanding AI jobs and discard any late generated replies.

Mention `@username`, or `@"Name With Spaces"`; the composer suggests online users
and AI. Mentions inside code are ignored. Mentioned identities and reply authors
get a flat gold highlight. Replies retain a short preview above the message;
clicking it fetches/jumps to the original, including outside the loaded page.
Invalid slash commands are rejected in both client and API; `//` escapes a slash.

`/clear` clears the visible history for the current guest identity only. The stuff
menu calls it Clear for you. `/bigahhclear` (Clear for everyone) opens a vote among
unique authenticated identities active within 40 seconds, snapshot at vote start.
The starter votes yes. More than half of that electorate must vote yes to clear;
a no majority rejects it. Votes expire without clearing after 60 seconds, and
new votes are limited to one per minute. Room state and votes sync through Realtime.
The requested hidden force-clear command bypasses voting for any joined guest
who knows it; it is omitted from the menu and is intentionally not owner-bound.

Clearing advances history cursors rather than permanently deleting messages or
Blob files. Public RLS and API reads exclude room-cleared history; AI memory and
context do too. Personal cursors are persisted on the guest session. Blob
retention is independent. Run `npm run test:chat-features` and the upload checks,
then lint/build and manual checks on labs.

## Games and GIPHY

Apply migrations `20261006004000_chat_games.sql` and `20261006005000_chat_giphy.sql`.
The stuff menu slides into the game list, then expands into a full-width image,
title, description and Start game card. `/game` opens it; `/game chess`,
`/game connect4`, `/game tictactoe`, `/game wordle`, `/game battleships` and
`/game uno` post invitations. Gartic Phone is marked coming soon.

Chess uses react-chessboard and chess.js for legal moves, castling, en passant,
promotion, checkmate and draws. Connect 4 and tic tac toe start with two players.
Battleships starts with private placement of the five ships (5/4/3/3/2), then
alternating shots. Wordle race and Uno accept 2–8 players; the host starts the
round. Wordle has six guesses, a ten-minute limit, an English dictionary and
first-solve victory. Everyone sees other players' guess colours, with letters
hidden. Uno deals seven cards and supports skip, reverse, draw two, wild and
wild draw four. No stacking or bluff/challenge mechanic; a wild draw four is
rejected if you hold the current colour. Missing the Call Uno checkbox when
playing down to one card draws two. Resigning ends the round.

Vercel validates every move. Private answers, fleets and hands live in
service-only `chat_game_secrets`; public `chat_games` publishes only scrubbed
state through Supabase Realtime. Atomic version checks reject simultaneous or
stale moves. Guest credentials authorize each player and room clears invalidate
the game. Game creation is idempotent and limited to five unfinished games per
guest and twenty invitations per hour. Use `npm run test:chat-games` for rule
and disclosure checks.

`/gif` or Find a GIF opens client-side GIPHY trending/search using
`VITE_GIPHY_API_KEY`. The input says Search GIPHY and the picker displays
Powered by GIPHY attribution and creator names. Search uses a 350ms debounce
and pagination. Choosing a GIF adds it to the composer; it can be sent alone,
with text, attachments or a reply. Only GIF ID/title are persisted in Supabase;
media URLs are fetched fresh from GIPHY and media loads directly, without Blob
copies or a proxy. Existing clipboard GIF uploads continue using Blob.
