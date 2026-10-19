-- Run against a migrated database: supabase db query --linked --file supabase/tests/chat_active_usernames.sql
-- All fixtures and changes roll back.
begin;
do $$
declare
  suffix text := left(replace(gen_random_uuid()::text,'-',''),10);
  test_name text := 'Codex ' || suffix;
  first_user public.chat_sessions;
  second_user public.chat_sessions;
  blocked boolean;
begin
  select * into first_user from public.join_chat('first-' || suffix,test_name,'first-ip-' || suffix);
  assert first_user.last_seen_at is not null, 'joining immediately claims the name';
  blocked := false;
  begin
    perform public.join_chat('second-' || suffix,upper(test_name),'second-ip-' || suffix);
  exception when unique_violation then blocked := true;
  end;
  assert blocked, 'active names are unique regardless of case';
  update public.chat_sessions set last_seen_at=clock_timestamp()-interval '41 seconds' where id=first_user.id;
  select * into second_user from public.join_chat('second-' || suffix,test_name,'second-ip-' || suffix);
  assert first_user.id<>second_user.id, 'name reuse does not reuse another identity';
  assert exists(select 1 from public.chat_sessions where id=first_user.id), 'old identity remains';
  blocked := false;
  begin
    perform public.resume_chat_session('first-' || suffix);
  exception when unique_violation then blocked := true;
  end;
  assert blocked, 'old cookies cannot silently reactivate taken names';
  blocked := false;
  begin
    perform public.chat_room_action('first-' || suffix,'state');
  exception when unique_violation then blocked := true;
  end;
  assert blocked, 'heartbeats cannot bypass name claims';
  blocked := false;
  begin
    perform public.send_chat_message('first-' || suffix,gen_random_uuid(),'Must roll back','message');
  exception when unique_violation then blocked := true;
  end;
  assert blocked, 'sending cannot bypass name claims';
  assert not exists(select 1 from public.chat_messages where author_id=first_user.id), 'rejected sends leave no messages';
  select * into first_user from public.join_chat('first-' || suffix,'Other ' || suffix,'first-ip-' || suffix);
  assert first_user.token_hash='first-' || suffix, 'renaming preserves credentials';
  select * into first_user from public.resume_chat_session('first-' || suffix);
  assert first_user.last_seen_at>clock_timestamp()-interval '1 second', 'resume refreshes the claim';
  update public.chat_sessions set last_seen_at=clock_timestamp()-interval '41 seconds' where id=second_user.id;
  select * into first_user from public.join_chat('first-' || suffix,test_name,'first-ip-' || suffix);
  assert first_user.username=test_name, 'released names can be reclaimed';
  assert not exists(select 1 from public.resume_chat_session('unknown-' || suffix)), 'unknown credentials stay anonymous';
  assert not has_function_privilege('anon','public.resume_chat_session(text)','execute'), 'credentials stay server-only';
  raise notice 'Active username checks passed';
end;
$$;
rollback;
