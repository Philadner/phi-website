-- Public lobby; guest credentials and all writes stay behind the Vercel API.
begin;

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  username text not null check (username ~ '^[A-Za-z0-9_ -]{2,24}$'),
  ip_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  last_message_at timestamptz
);
create unique index chat_sessions_username on public.chat_sessions (lower(username));
create index chat_sessions_ip_created on public.chat_sessions (ip_hash, created_at desc);

create table public.chat_messages (
  id bigint generated always as identity primary key,
  client_id uuid not null,
  author_id uuid not null,
  username text not null,
  content text not null check (char_length(content) between 1 and 8000),
  kind text not null default 'message' check (kind in ('message', 'action')),
  created_at timestamptz not null default now(),
  unique (author_id, client_id)
);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.chat_sessions, public.chat_messages from anon, authenticated;
grant select on public.chat_messages to anon, authenticated;
grant all on public.chat_sessions, public.chat_messages to service_role;
grant usage, select on sequence public.chat_messages_id_seq to service_role;
create policy "Public lobby messages are readable" on public.chat_messages
  for select to anon, authenticated using (true);

create function public.join_chat(p_token_hash text, p_username text, p_ip_hash text)
returns setof public.chat_sessions
language plpgsql security definer set search_path = public
as $$
declare current_session public.chat_sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  delete from public.chat_sessions where expires_at < now();
  select * into current_session from public.chat_sessions where token_hash = p_token_hash for update;
  if current_session.id is null then
    if (select count(*) from public.chat_sessions
        where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'Too many new identities. Try again later.' using errcode = 'P0001';
    end if;
    return query insert into public.chat_sessions (token_hash, username, ip_hash)
      values (p_token_hash, p_username, p_ip_hash) returning *;
  else
    return query update public.chat_sessions set username = p_username
      where id = current_session.id returning *;
  end if;
end;
$$;

create function public.send_chat_message(p_token_hash text, p_client_id uuid, p_content text, p_kind text)
returns setof public.chat_messages
language plpgsql security definer set search_path = public
as $$
declare current_session public.chat_sessions;
begin
  select * into current_session from public.chat_sessions
    where token_hash = p_token_hash and expires_at > now() for update;
  if current_session.id is null then
    raise exception 'Choose a username to join again.' using errcode = '28000';
  end if;
  -- Retried requests return the original message without broadcasting duplicates.
  if exists (select 1 from public.chat_messages
      where author_id = current_session.id and client_id = p_client_id) then
    return query select * from public.chat_messages
      where author_id = current_session.id and client_id = p_client_id;
    return;
  end if;
  if current_session.last_message_at > clock_timestamp() - interval '1 second' then
    raise exception 'Slow down a little. Wait a second between messages.' using errcode = 'P0001';
  end if;
  update public.chat_sessions set last_message_at = clock_timestamp() where id = current_session.id;
  return query insert into public.chat_messages (client_id, author_id, username, content, kind)
    values (p_client_id, current_session.id, current_session.username, p_content, p_kind) returning *;
end;
$$;
revoke all on function public.join_chat(text, text, text) from public, anon, authenticated;
revoke all on function public.send_chat_message(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.join_chat(text, text, text) to service_role;
grant execute on function public.send_chat_message(text, uuid, text, text) to service_role;

alter publication supabase_realtime add table public.chat_messages;
commit;
