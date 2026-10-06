begin;
alter function public.send_chat_message(text,uuid,text,text,uuid[],bigint,uuid[],boolean) rename to send_chat_message_base;
create function public.send_chat_message(p_token_hash text,p_client_id uuid,p_content text,p_kind text,p_attachment_ids uuid[] default '{}',p_reply_to bigint default null,p_mentioned_ids uuid[] default '{}',p_invokes_ai boolean default false,p_gif jsonb default null)
returns setof public.chat_messages language plpgsql security definer set search_path=public as $$
declare m public.chat_messages;
begin
  if p_gif is not null and (jsonb_typeof(p_gif)<>'object' or coalesce(p_gif->>'id','')!~'^[A-Za-z0-9]{1,64}$' or char_length(coalesce(p_gif->>'title',''))>200) then raise exception 'Invalid GIF.' using errcode='22023'; end if;
  select msg.* into m from public.chat_messages msg join public.chat_sessions s on msg.author_id=s.id where s.token_hash=p_token_hash and s.expires_at>now() and msg.client_id=p_client_id;
  if m.id is not null then return next m; return; end if;
  select * into m from public.send_chat_message_base(p_token_hash,p_client_id,p_content,p_kind,p_attachment_ids,p_reply_to,p_mentioned_ids,p_invokes_ai);
  if p_gif is not null and not m.modifiers ? 'gif' then
    update public.chat_messages set modifiers=modifiers || jsonb_build_object('gif',jsonb_build_object('id',p_gif->>'id','title',p_gif->>'title')) where id=m.id returning * into m;
  end if;
  return next m;
end;
$$;
revoke all on function public.send_chat_message(text,uuid,text,text,uuid[],bigint,uuid[],boolean,jsonb) from public,anon,authenticated;
grant execute on function public.send_chat_message(text,uuid,text,text,uuid[],bigint,uuid[],boolean,jsonb) to service_role;
commit;
