begin;

-- Cookies remember identities; only a live identity claims a name.
drop index public.chat_sessions_username;
create index chat_sessions_username on public.chat_sessions (lower(username));

create function public.claim_active_chat_username()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.expires_at > clock_timestamp() and new.last_seen_at > clock_timestamp() - interval '40 seconds' then
    -- Serialize claims across joins, renames, sends and heartbeats, including
    -- clients that return after their old name has been claimed by someone else.
    perform pg_advisory_xact_lock(hashtextextended('chat-username:' || lower(new.username), 0));
    if exists (select 1 from public.chat_sessions s
      where lower(s.username)=lower(new.username) and s.id<>new.id
        and s.expires_at>clock_timestamp() and s.last_seen_at>clock_timestamp()-interval '40 seconds') then
      raise exception 'That username is currently in use. Choose another.' using errcode='23505';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.claim_active_chat_username() from public,anon,authenticated;
create trigger chat_active_username before insert or update of username,last_seen_at on public.chat_sessions
  for each row execute function public.claim_active_chat_username();

create or replace function public.join_chat(p_token_hash text,p_username text,p_ip_hash text)
returns setof public.chat_sessions language plpgsql security definer set search_path=public as $$
declare current_session public.chat_sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash,0));
  delete from public.chat_sessions where expires_at<now();
  select * into current_session from public.chat_sessions where token_hash=p_token_hash for update;
  if current_session.id is null then
    if (select count(*) from public.chat_sessions where ip_hash=p_ip_hash and created_at>now()-interval '1 hour')>=10 then
      raise exception 'Too many new identities. Try again later.' using errcode='P0001';
    end if;
    return query insert into public.chat_sessions(token_hash,username,ip_hash,last_seen_at)
      values(p_token_hash,p_username,p_ip_hash,clock_timestamp()) returning *;
  else
    return query update public.chat_sessions set username=p_username,last_seen_at=clock_timestamp()
      where id=current_session.id returning *;
  end if;
end;
$$;

create function public.resume_chat_session(p_token_hash text)
returns setof public.chat_sessions language plpgsql security definer set search_path=public as $$
begin
  return query update public.chat_sessions set last_seen_at=clock_timestamp()
    where token_hash=p_token_hash and expires_at>now() returning *;
end;
$$;
revoke all on function public.resume_chat_session(text) from public,anon,authenticated;
grant execute on function public.resume_chat_session(text) to service_role;
commit;
