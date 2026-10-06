begin;
create table public.chat_attachments (
  id uuid primary key,
  author_id uuid not null,
  name text not null check (char_length(name) between 1 and 255),
  relative_path text check (char_length(relative_path) <= 1024),
  size integer not null check (size between 1 and 26214400),
  content_type text not null,
  pathname text not null unique,
  url text,
  download_url text,
  width integer,
  height integer,
  status text not null default 'uploading' check (status in ('uploading', 'ready', 'discarded')),
  message_id bigint references public.chat_messages(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index chat_attachments_author_created on public.chat_attachments(author_id, created_at desc);
alter table public.chat_attachments enable row level security;
revoke all on public.chat_attachments from anon, authenticated;
grant all on public.chat_attachments to service_role;
grant select on public.chat_attachments to anon, authenticated;
create policy "Sent attachments are readable" on public.chat_attachments
  for select to anon, authenticated using (message_id is not null);

alter table public.chat_messages add column attachments jsonb not null default '[]';
alter table public.chat_messages drop constraint chat_messages_content_check;
alter table public.chat_messages add constraint chat_messages_content_check
  check (char_length(content) <= 8000 and (char_length(content) > 0 or jsonb_array_length(attachments) > 0));

create function public.reserve_chat_upload(p_token_hash text, p_id uuid, p_name text, p_relative_path text, p_size integer, p_content_type text, p_pathname text, p_width integer, p_height integer)
returns setof public.chat_attachments language plpgsql security definer set search_path = public as $$
declare s public.chat_sessions;
begin
  select * into s from public.chat_sessions where token_hash = p_token_hash and expires_at > now() for update;
  if s.id is null then raise exception 'Choose a username to join again.' using errcode = '28000'; end if;
  if exists (select 1 from public.chat_attachments where id = p_id) then
    raise exception 'This upload already exists. Retry with a new file ID.' using errcode = '22023';
  end if;
  if (select count(*) from public.chat_attachments where author_id = s.id and created_at > now() - interval '1 hour') >= 60
    or (select coalesce(sum(size), 0) from public.chat_attachments where author_id = s.id and created_at > now() - interval '1 hour') + p_size > 209715200 then
    raise exception 'Upload limit reached. Try again later.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.chat_attachments where author_id = s.id and message_id is null and status <> 'discarded' and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Send or remove your attachments before uploading more.' using errcode = 'P0001';
  end if;
  return query insert into public.chat_attachments(id, author_id, name, relative_path, size, content_type, pathname, width, height)
    values(p_id, s.id, p_name, p_relative_path, p_size, p_content_type, p_pathname, p_width, p_height) returning *;
end;
$$;

drop function public.send_chat_message(text, uuid, text, text);
create function public.send_chat_message(p_token_hash text, p_client_id uuid, p_content text, p_kind text, p_attachment_ids uuid[] default '{}')
returns setof public.chat_messages language plpgsql security definer set search_path = public as $$
declare s public.chat_sessions; files jsonb; sent public.chat_messages; file_count integer;
begin
  select * into s from public.chat_sessions where token_hash = p_token_hash and expires_at > now() for update;
  if s.id is null then raise exception 'Choose a username to join again.' using errcode = '28000'; end if;
  if exists (select 1 from public.chat_messages where author_id = s.id and client_id = p_client_id) then
    return query select * from public.chat_messages where author_id = s.id and client_id = p_client_id;
    return;
  end if;
  file_count := cardinality(p_attachment_ids);
  if file_count > 20 or file_count <> (select count(distinct x) from unnest(p_attachment_ids) x) then
    raise exception 'Invalid attachments.' using errcode = '22023';
  end if;
  perform id from public.chat_attachments where id = any(p_attachment_ids) order by id for update;
  if (select count(*) from public.chat_attachments where id = any(p_attachment_ids) and author_id = s.id and status = 'ready' and message_id is null and created_at > now() - interval '24 hours') <> file_count then
    raise exception 'An attachment is unavailable. Remove it and upload again.' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'relativePath', a.relative_path, 'size', a.size, 'contentType', a.content_type, 'url', a.url, 'downloadUrl', a.download_url, 'width', a.width, 'height', a.height) order by array_position(p_attachment_ids, a.id)), '[]')
    into files from public.chat_attachments a where a.id = any(p_attachment_ids);
  if s.last_message_at > clock_timestamp() - interval '1 second' then
    raise exception 'Slow down a little. Wait a second between messages.' using errcode = 'P0001';
  end if;
  update public.chat_sessions set last_message_at = clock_timestamp() where id = s.id;
  insert into public.chat_messages(client_id, author_id, username, content, kind, attachments)
    values(p_client_id, s.id, s.username, p_content, p_kind, files) returning * into sent;
  update public.chat_attachments set message_id = sent.id where id = any(p_attachment_ids);
  return next sent;
end;
$$;
revoke all on function public.reserve_chat_upload(text, uuid, text, text, integer, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_chat_upload(text, uuid, text, text, integer, text, text, integer, integer) to service_role;
revoke all on function public.send_chat_message(text, uuid, text, text, uuid[]) from public, anon, authenticated;
grant execute on function public.send_chat_message(text, uuid, text, text, uuid[]) to service_role;
commit;
