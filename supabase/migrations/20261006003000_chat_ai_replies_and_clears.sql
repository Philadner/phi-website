begin;
alter table public.chat_sessions add column cleared_through bigint not null default 0;
alter table public.chat_sessions add column last_seen_at timestamptz;
alter table public.chat_sessions add column last_ai_at timestamptz;
alter table public.chat_messages add column is_ai boolean not null default false;
alter table public.chat_messages add column invokes_ai boolean not null default false;
alter table public.chat_messages add column mentioned_ids uuid[] not null default '{}';
alter table public.chat_messages add column reply_to bigint references public.chat_messages(id) on delete set null;
alter table public.chat_messages add column reply_preview jsonb;
alter table public.chat_messages add column modifiers jsonb not null default '{}';
create index chat_messages_ai_memory on public.chat_messages(id desc) where is_ai or invokes_ai;

create table public.chat_room_state (
  id integer primary key check (id = 1),
  cleared_through bigint not null default 0,
  clear_revision integer not null default 0,
  ai_name text not null default 'AI',
  last_vote_at timestamptz
);
insert into public.chat_room_state(id) values(1);
create table public.chat_clear_votes (
  id uuid primary key default gen_random_uuid(),
  opened_by uuid not null,
  electorate uuid[] not null,
  yes uuid[] not null default '{}',
  no uuid[] not null default '{}',
  expires_at timestamptz not null default now() + interval '1 minute',
  status text not null default 'active' check (status in ('active','passed','rejected','expired')),
  created_at timestamptz not null default clock_timestamp()
);
create unique index chat_one_active_clear_vote on public.chat_clear_votes(status) where status='active';
create table public.chat_ai_requests (
  id uuid primary key default gen_random_uuid(),
  trigger_id bigint not null unique references public.chat_messages(id) on delete cascade,
  author_id uuid not null,
  status text not null default 'queued' check (status in ('queued','processing','awaiting_context','done','error','declined')),
  phase integer not null default 0,
  context_count integer check (context_count in (5,20)),
  with_images boolean not null default false,
  initial_message_id bigint references public.chat_messages(id) on delete set null,
  final_message_id bigint references public.chat_messages(id) on delete set null,
  error text,
  attempts integer not null default 0,
  lease uuid,
  started_at timestamptz,
  created_at timestamptz not null default now()
);
create index chat_ai_requests_owner_created on public.chat_ai_requests(author_id,created_at desc);
alter table public.chat_room_state enable row level security;
alter table public.chat_clear_votes enable row level security;
alter table public.chat_ai_requests enable row level security;
revoke all on public.chat_room_state, public.chat_clear_votes, public.chat_ai_requests from anon,authenticated;
grant all on public.chat_room_state, public.chat_clear_votes, public.chat_ai_requests to service_role;
grant select on public.chat_room_state,public.chat_clear_votes to anon,authenticated;
create policy "Room state is readable" on public.chat_room_state for select to anon,authenticated using(true);
create policy "Room votes are readable" on public.chat_clear_votes for select to anon,authenticated using(true);
drop policy "Public lobby messages are readable" on public.chat_messages;
create policy "Visible lobby messages are readable" on public.chat_messages for select to anon,authenticated
  using(id > (select cleared_through from public.chat_room_state where id=1));
drop policy "Sent attachments are readable" on public.chat_attachments;
create policy "Visible sent attachments are readable" on public.chat_attachments for select to anon,authenticated
  using(message_id > (select cleared_through from public.chat_room_state where id=1));

alter function public.send_chat_message(text,uuid,text,text,uuid[]) rename to send_chat_message_files;
create function public.send_chat_message(p_token_hash text,p_client_id uuid,p_content text,p_kind text,p_attachment_ids uuid[] default '{}',p_reply_to bigint default null,p_mentioned_ids uuid[] default '{}',p_invokes_ai boolean default false)
returns setof public.chat_messages language plpgsql security definer set search_path=public as $$
declare parent public.chat_messages; sent public.chat_messages; floor bigint; preview jsonb;
begin
  select cleared_through into floor from public.chat_room_state where id=1 for share;
  if p_reply_to is not null then
    select * into parent from public.chat_messages where id=p_reply_to and id>floor;
    if parent.id is null then raise exception 'That message is no longer available to reply to.' using errcode='22023'; end if;
    preview := jsonb_build_object('id',parent.id,'authorId',parent.author_id,'username',parent.username,'content',left(case when parent.content<>'' then parent.content else coalesce(parent.attachments->0->>'name','Attachment') end,240),'isAi',parent.is_ai);
  end if;
  select * into sent from public.send_chat_message_files(p_token_hash,p_client_id,p_content,p_kind,p_attachment_ids);
  -- The old function also deduplicates retries; only enrich a new row once.
  if sent.reply_to is null and sent.mentioned_ids='{}' and not sent.invokes_ai then
    update public.chat_messages set reply_to=p_reply_to,reply_preview=preview,mentioned_ids=p_mentioned_ids,invokes_ai=p_invokes_ai where id=sent.id returning * into sent;
  end if;
  update public.chat_sessions set last_seen_at=now() where id=sent.author_id;
  if sent.invokes_ai then insert into public.chat_ai_requests(trigger_id,author_id) values(sent.id,sent.author_id) on conflict(trigger_id) do nothing; end if;
  return next sent;
end;
$$;

create function public.chat_clear_room()
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.chat_room_state set cleared_through=greatest(cleared_through,coalesce((select max(id) from public.chat_messages),0)),clear_revision=clear_revision+1,ai_name='AI' where id=1;
  update public.chat_ai_requests set status='declined',error=null where status in ('queued','processing','awaiting_context','error');
end;
$$;

create function public.chat_room_action(p_token_hash text,p_action text,p_vote_id uuid default null,p_yes boolean default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.chat_sessions; room public.chat_room_state; v public.chat_clear_votes; members uuid[]; needed integer;
begin
  select * into room from public.chat_room_state where id=1 for update;
  select * into s from public.chat_sessions where token_hash=p_token_hash and expires_at>now();
  if s.id is null and p_action<>'state' then raise exception 'Choose a username to join.' using errcode='28000'; end if;
  if s.id is not null then update public.chat_sessions set last_seen_at=now() where id=s.id; end if;
  update public.chat_clear_votes set status='expired' where status='active' and expires_at<=now();
  if p_action='clear' then
    update public.chat_sessions set cleared_through=greatest(room.cleared_through,coalesce((select max(id) from public.chat_messages),0)) where id=s.id;
  elsif p_action='force' then
    perform public.chat_clear_room();
    update public.chat_clear_votes set status='rejected' where status='active';
  elsif p_action='start_vote' then
    select * into v from public.chat_clear_votes where status='active';
    if v.id is null then
      if room.last_vote_at>now()-interval '1 minute' then raise exception 'Wait a minute before opening another clear vote.' using errcode='P0001'; end if;
      select array_agg(id order by id) into members from public.chat_sessions where expires_at>now() and (last_seen_at>now()-interval '40 seconds' or id=s.id);
      insert into public.chat_clear_votes(opened_by,electorate,yes) values(s.id,members,array[s.id]) returning * into v;
      update public.chat_room_state set last_vote_at=now() where id=1;
    end if;
  elsif p_action='vote' then
    select * into v from public.chat_clear_votes where id=p_vote_id and status='active';
    if v.id is null then raise exception 'That vote has ended.' using errcode='22023'; end if;
    if not s.id=any(v.electorate) then raise exception 'This vote is for users who were online when it started.' using errcode='22023'; end if;
    if p_yes is null then raise exception 'Choose yes or no.' using errcode='22023'; end if;
    update public.chat_clear_votes set yes=array_remove(yes,s.id),no=array_remove(no,s.id) where id=v.id;
    update public.chat_clear_votes set yes=case when p_yes then array_append(yes,s.id) else yes end,no=case when p_yes then no else array_append(no,s.id) end where id=v.id returning * into v;
  elsif p_action<>'state' then raise exception 'Invalid room action.' using errcode='22023'; end if;
  if v.id is not null and v.status='active' then
    needed := cardinality(v.electorate)/2+1;
    if cardinality(v.yes)>=needed then
      perform public.chat_clear_room(); update public.chat_clear_votes set status='passed' where id=v.id;
    elsif cardinality(v.no)>=needed then update public.chat_clear_votes set status='rejected' where id=v.id; end if;
  end if;
  select * into room from public.chat_room_state where id=1;
  select * into s from public.chat_sessions where id=s.id;
  select * into v from public.chat_clear_votes order by created_at desc limit 1;
  return jsonb_build_object('room',jsonb_build_object('cleared_through',room.cleared_through,'clear_revision',room.clear_revision,'ai_name',room.ai_name),'clearedThrough',coalesce(s.cleared_through,0),'vote',case when v.id is null then null else to_jsonb(v) end);
end;
$$;

create function public.claim_chat_ai(p_token_hash text,p_trigger_id bigint,p_context_count integer default null,p_with_images boolean default false,p_decline boolean default false,p_lease uuid default null)
returns setof public.chat_ai_requests language plpgsql security definer set search_path=public as $$
declare s public.chat_sessions; r public.chat_ai_requests; floor bigint;
begin
  select cleared_through into floor from public.chat_room_state where id=1 for share;
  select * into s from public.chat_sessions where token_hash=p_token_hash and expires_at>now() for update;
  if s.id is null then raise exception 'Choose a username to join.' using errcode='28000'; end if;
  select * into r from public.chat_ai_requests where trigger_id=p_trigger_id and author_id=s.id for update;
  if r.id is null or p_trigger_id<=floor then raise exception 'AI request not found.' using errcode='22023'; end if;
  if p_decline then
    if r.status='awaiting_context' then
      update public.chat_ai_requests set status='declined' where id=r.id returning * into r;
      update public.chat_messages set modifiers=modifiers||jsonb_build_object('context_status','declined') where id=r.initial_message_id;
    end if;
    return next r; return;
  end if;
  if r.status in ('done','processing','declined') then return next r; return; end if;
  if r.status='awaiting_context' then
    if p_context_count is null then return next r; return; end if;
    if p_context_count not in (5,20) then raise exception 'Choose 5 or 20 messages.' using errcode='22023'; end if;
    r.phase:=1; r.context_count:=p_context_count; r.with_images:=p_with_images;
    update public.chat_messages set modifiers=modifiers||jsonb_build_object('context_status','granted','context_count',p_context_count,'with_images',p_with_images) where id=r.initial_message_id;
  elsif p_context_count is not null or p_with_images then raise exception 'AI has not requested context.' using errcode='22023'; end if;
  if r.attempts>=3 then raise exception 'This AI request has reached its retry limit.' using errcode='P0001'; end if;
  if r.phase=0 and s.last_ai_at>now()-interval '5 seconds' then raise exception 'Wait a few seconds between AI calls.' using errcode='P0001'; end if;
  if (select coalesce(sum(attempts),0) from public.chat_ai_requests where author_id=s.id and created_at>now()-interval '1 hour')>=30
    or (select coalesce(sum(attempts),0) from public.chat_ai_requests where created_at>now()-interval '1 hour')>=300 then raise exception 'AI limit reached. Try again later.' using errcode='P0001'; end if;
  update public.chat_sessions set last_ai_at=now() where id=s.id;
  return query update public.chat_ai_requests set status='processing',phase=r.phase,context_count=r.context_count,with_images=r.with_images,attempts=attempts+1,started_at=now(),lease=p_lease,error=null where id=r.id returning *;
end;
$$;

create function public.finish_chat_ai(p_request_id uuid,p_phase integer,p_attempt integer,p_message text,p_request_context boolean,p_name text,p_mentions uuid[] default '{}')
returns setof public.chat_messages language plpgsql security definer set search_path=public as $$
declare room public.chat_room_state; r public.chat_ai_requests; trigger public.chat_messages; sent public.chat_messages; next_name text;
begin
  select * into room from public.chat_room_state where id=1 for update;
  select * into r from public.chat_ai_requests where id=p_request_id for update;
  if r.status<>'processing' or r.phase<>p_phase or r.attempts<>p_attempt or r.trigger_id<=room.cleared_through then return; end if;
  select * into trigger from public.chat_messages where id=r.trigger_id;
  next_name:=coalesce(p_name,room.ai_name);
  if next_name!~'^[A-Za-z0-9_ -]{2,24}$' then next_name:=room.ai_name; end if;
  insert into public.chat_messages(client_id,author_id,username,content,kind,is_ai,mentioned_ids,reply_to,reply_preview,modifiers)
    values(gen_random_uuid(),'00000000-0000-4000-8000-000000000001',next_name,p_message,'message',true,p_mentions,trigger.id,
      jsonb_build_object('id',trigger.id,'authorId',trigger.author_id,'username',trigger.username,'content',left(trigger.content,240),'isAi',false),
      jsonb_build_object('request_context',p_request_context and p_phase=0,'name',p_name)) returning * into sent;
  update public.chat_room_state set ai_name=next_name where id=1;
  update public.chat_ai_requests set status=case when p_request_context and p_phase=0 then 'awaiting_context' else 'done' end,
    initial_message_id=case when p_phase=0 then sent.id else initial_message_id end,final_message_id=case when p_phase=1 or not p_request_context then sent.id else null end where id=r.id;
  return next sent;
end;
$$;

revoke all on function public.send_chat_message(text,uuid,text,text,uuid[],bigint,uuid[],boolean),public.chat_clear_room(),public.chat_room_action(text,text,uuid,boolean),public.claim_chat_ai(text,bigint,integer,boolean,boolean,uuid),public.finish_chat_ai(uuid,integer,integer,text,boolean,text,uuid[]) from public,anon,authenticated;
grant execute on function public.send_chat_message(text,uuid,text,text,uuid[],bigint,uuid[],boolean),public.chat_room_action(text,text,uuid,boolean),public.claim_chat_ai(text,bigint,integer,boolean,boolean,uuid),public.finish_chat_ai(uuid,integer,integer,text,boolean,text,uuid[]) to service_role;
alter publication supabase_realtime add table public.chat_room_state,public.chat_clear_votes;
commit;
