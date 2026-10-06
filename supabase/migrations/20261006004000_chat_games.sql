begin;
create table public.chat_games (
  id uuid primary key,
  message_id bigint not null unique references public.chat_messages(id),
  owner_id uuid not null,
  client_id uuid not null,
  state jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(owner_id,client_id)
);
create table public.chat_game_secrets (
  id uuid primary key references public.chat_games(id),
  state jsonb not null
);
alter table public.chat_games enable row level security;
alter table public.chat_game_secrets enable row level security;
revoke all on public.chat_games,public.chat_game_secrets from public,anon,authenticated;
grant select on public.chat_games to anon,authenticated;
grant all on public.chat_games,public.chat_game_secrets to service_role;
create policy "Visible games are readable" on public.chat_games for select to anon,authenticated
  using(message_id > (select cleared_through from public.chat_room_state where id=1));

create function public.create_chat_game(p_token_hash text,p_client_id uuid,p_state jsonb,p_view jsonb,p_title text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.chat_sessions; g public.chat_games; m public.chat_messages; floor bigint;
begin
  select cleared_through into floor from public.chat_room_state where id=1 for share;
  select * into s from public.chat_sessions where token_hash=p_token_hash and expires_at>now() for update;
  if s.id is null then raise exception 'Choose a username first.' using errcode='28000'; end if;
  select * into g from public.chat_games where owner_id=s.id and client_id=p_client_id;
  if g.id is not null then
    select * into m from public.chat_messages where id=g.message_id;
    return jsonb_build_object('id',g.id,'message',to_jsonb(m));
  end if;
  if p_state->>'host'<>s.id::text or p_view->>'host'<>s.id::text or p_state->>'id'<>p_view->>'id' then raise exception 'Invalid game owner.' using errcode='22023'; end if;
  if (select count(*) from public.chat_games where owner_id=s.id and created_at>clock_timestamp()-interval '1 hour')>=20
    or (select count(*) from public.chat_games where owner_id=s.id and message_id>floor and state->>'status'<>'done')>=5 then
    raise exception 'Finish or cancel an existing game first.' using errcode='P0001';
  end if;
  select * into m from public.send_chat_message(p_token_hash,p_client_id,p_title,'message','{}'::uuid[],null,'{}'::uuid[],false);
  update public.chat_messages set modifiers=jsonb_build_object('game_id',p_state->>'id') where id=m.id returning * into m;
  insert into public.chat_games(id,message_id,owner_id,client_id,state) values((p_state->>'id')::uuid,m.id,s.id,p_client_id,p_view);
  insert into public.chat_game_secrets(id,state) values((p_state->>'id')::uuid,p_state);
  return jsonb_build_object('id',p_state->>'id','message',to_jsonb(m));
end;
$$;

create function public.save_chat_game(p_token_hash text,p_id uuid,p_version integer,p_state jsonb,p_view jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare s public.chat_sessions; g public.chat_games; floor bigint;
begin
  select cleared_through into floor from public.chat_room_state where id=1 for share;
  select * into s from public.chat_sessions where token_hash=p_token_hash and expires_at>now();
  if s.id is null then raise exception 'Choose a username first.' using errcode='28000'; end if;
  select * into g from public.chat_games where id=p_id for update;
  if g.id is null or g.message_id<=greatest(floor,s.cleared_through) then raise exception 'This game has been cleared.' using errcode='22023'; end if;
  if g.version<>p_version then return false; end if;
  if not exists(select 1 from jsonb_array_elements(p_state->'players') p where p->>'id'=s.id::text)
    and not exists(select 1 from jsonb_array_elements(g.state->'players') p where p->>'id'=s.id::text) then raise exception 'Join this game first.' using errcode='28000'; end if;
  if (p_state->>'version')::integer<>p_version+1 or p_state->>'id'<>p_id::text or p_view->>'id'<>p_id::text then raise exception 'Invalid game version.' using errcode='22023'; end if;
  update public.chat_game_secrets set state=p_state where id=p_id;
  update public.chat_games set state=p_view,version=p_version+1,updated_at=clock_timestamp() where id=p_id;
  return true;
end;
$$;
create function public.expire_chat_game(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.chat_games; s jsonb; view jsonb;
begin
  perform 1 from public.chat_room_state where id=1 for share;
  select * into g from public.chat_games where id=p_id for update;
  select state into s from public.chat_game_secrets where id=p_id;
  if s->>'kind'='wordle' and s->>'status'='active' and (s->>'startedAt')::bigint < extract(epoch from clock_timestamp())*1000-600000 then
    s=s || jsonb_build_object('status','done','winner',null,'reason','Time up','version',g.version+1);
    view=g.state || jsonb_build_object('status','done','winner',null,'reason','Time up','version',g.version+1,'solution',s->>'answer');
    update public.chat_game_secrets set state=s where id=p_id;
    update public.chat_games set state=view,version=g.version+1,updated_at=clock_timestamp() where id=p_id;
  end if;
  return s;
end;
$$;
revoke all on function public.create_chat_game(text,uuid,jsonb,jsonb,text),public.save_chat_game(text,uuid,integer,jsonb,jsonb),public.expire_chat_game(uuid) from public,anon,authenticated;
grant execute on function public.create_chat_game(text,uuid,jsonb,jsonb,text),public.save_chat_game(text,uuid,integer,jsonb,jsonb),public.expire_chat_game(uuid) to service_role;
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_games') then alter publication supabase_realtime add table public.chat_games; end if;
end $$;
commit;
