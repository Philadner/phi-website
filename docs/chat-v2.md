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

1. `/ai`, server-side OpenAI calls and web search. History is opt-in per request:
   the AI asks, and the invoking user grants the last 5 or last 20 messages.
2. Turn-based chess (`react-chessboard`), connect four, tic tac toe, Wordle race,
   battleships and Uno, with game commands and UI controls.
3. Searchable GIF provider integration after choosing/configuring Giphy or Klipy.
