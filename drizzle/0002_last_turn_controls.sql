-- M5 last-turn controls. Additive only: two new functions, no table changes.
-- Both operate on the latest user message of a conversation; there is no history branching.

CREATE OR REPLACE FUNCTION public.regenerate_assistant_message(p_conversation_id uuid, p_user_message_id uuid)
RETURNS TABLE(id uuid, "position" integer, content text, status public.message_status, replayed boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_user public.messages;
  v_response public.messages;
  v_position integer;
BEGIN
  PERFORM 1 FROM public.conversations c
  WHERE c.id = p_conversation_id AND c.user_id = (SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Conversation unavailable.'; END IF;
  SELECT m.* INTO v_user FROM public.messages m
  WHERE m.id = p_user_message_id AND m.conversation_id = p_conversation_id AND m.role = 'user' AND m.status = 'complete';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Message unavailable.'; END IF;
  PERFORM public.recover_stale_chat(p_conversation_id);
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.status = 'streaming') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'A response is still running.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.role = 'user' AND m.position > v_user.position) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Only the latest message can be regenerated.';
  END IF;
  SELECT m.* INTO v_response FROM public.messages m
  WHERE m.conversation_id = p_conversation_id AND m.reply_to_message_id = p_user_message_id;
  IF FOUND THEN
    v_position := v_response.position;
    DELETE FROM public.messages m WHERE m.id = v_response.id;
  ELSE
    SELECT COALESCE(MAX(m.position), 0) + 1 INTO v_position FROM public.messages m WHERE m.conversation_id = p_conversation_id;
  END IF;
  INSERT INTO public.messages(conversation_id, user_id, reply_to_message_id, role, content, status, position)
  VALUES(p_conversation_id, auth.uid(), p_user_message_id, 'assistant', '…', 'streaming', v_position)
  RETURNING * INTO v_response;
  UPDATE public.conversations SET updated_at = clock_timestamp() WHERE conversations.id = p_conversation_id;
  RETURN QUERY SELECT v_response.id, v_response.position, v_response.content, v_response.status, false;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.edit_last_user_message(p_conversation_id uuid, p_message_id uuid, p_content text)
RETURNS TABLE(id uuid, "position" integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_conversation public.conversations;
  v_message public.messages;
  v_old_title text;
BEGIN
  SELECT c.* INTO v_conversation FROM public.conversations c
  WHERE c.id = p_conversation_id AND c.user_id = (SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Conversation unavailable.'; END IF;
  IF p_message_id IS NULL OR p_content IS NULL OR length(btrim(p_content, E' \t\r\n')) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Invalid message.';
  END IF;
  SELECT m.* INTO v_message FROM public.messages m
  WHERE m.id = p_message_id AND m.conversation_id = p_conversation_id AND m.role = 'user' AND m.status = 'complete';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Message unavailable.'; END IF;
  PERFORM public.recover_stale_chat(p_conversation_id);
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.status = 'streaming') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'A response is still running.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.role = 'user' AND m.position > v_message.position) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Only the latest message can be edited.';
  END IF;
  IF v_message.content = p_content THEN
    RETURN QUERY SELECT v_message.id, v_message.position;
    RETURN;
  END IF;
  DELETE FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.reply_to_message_id = p_message_id;
  UPDATE public.messages SET content = p_content WHERE messages.id = p_message_id;
  v_old_title := left(v_message.content, 42) || CASE WHEN length(v_message.content) > 42 THEN '…' ELSE '' END;
  UPDATE public.conversations SET updated_at = clock_timestamp(),
    title = CASE WHEN title = v_old_title THEN left(p_content, 42) || CASE WHEN length(p_content) > 42 THEN '…' ELSE '' END ELSE title END
  WHERE conversations.id = p_conversation_id;
  RETURN QUERY SELECT v_message.id, v_message.position;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.regenerate_assistant_message(uuid, uuid), public.edit_last_user_message(uuid, uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.regenerate_assistant_message(uuid, uuid), public.edit_last_user_message(uuid, uuid, text) TO authenticated;
