ALTER TABLE "messages" ADD COLUMN "reply_to_message_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_id_conversation_owner_key" UNIQUE("id","conversation_id","user_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_owner_fk" FOREIGN KEY ("reply_to_message_id","conversation_id","user_id") REFERENCES "public"."messages"("id","conversation_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_one_active_response_idx" ON "messages" USING btree ("conversation_id") WHERE "messages"."role" = 'assistant' AND "messages"."status" = 'streaming';--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_reply_key" UNIQUE("conversation_id","reply_to_message_id");--> statement-breakpoint
UPDATE public.messages a SET reply_to_message_id = u.id
FROM public.messages u
WHERE a.role = 'assistant' AND u.role = 'user'
  AND a.conversation_id = u.conversation_id AND a.user_id = u.user_id
  AND a.position = u.position + 1;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.recover_stale_chat(p_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.conversations c
  WHERE c.id = p_conversation_id AND c.user_id = (SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Conversation unavailable.'; END IF;
  UPDATE public.messages SET status = 'interrupted',
    content = CASE WHEN content = '…' THEN 'Response stopped.' ELSE content END
  WHERE conversation_id = p_conversation_id AND role = 'assistant' AND status = 'streaming'
    AND created_at < clock_timestamp() - interval '5 minutes';
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.append_user_message(p_conversation_id uuid, p_message_id uuid, p_content text)
RETURNS TABLE(id uuid, "position" integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_conversation public.conversations;
  v_message public.messages;
  v_position integer;
BEGIN
  SELECT c.* INTO v_conversation FROM public.conversations c
  WHERE c.id = p_conversation_id AND c.user_id = (SELECT auth.uid()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Conversation unavailable.'; END IF;
  IF p_message_id IS NULL OR p_content IS NULL OR length(btrim(p_content, E' \t\r\n')) NOT BETWEEN 1 AND 20000 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Invalid message.';
  END IF;
  SELECT m.* INTO v_message FROM public.messages m WHERE m.id = p_message_id;
  IF FOUND THEN
    IF v_message.conversation_id <> p_conversation_id OR v_message.role <> 'user' OR v_message.content <> p_content THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Submission does not match the saved message.';
    END IF;
    RETURN QUERY SELECT v_message.id, v_message.position;
    RETURN;
  END IF;
  PERFORM public.recover_stale_chat(p_conversation_id);
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.status = 'streaming') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'A response is still running.';
  END IF;
  SELECT COALESCE(MAX(m.position), 0) + 1 INTO v_position FROM public.messages m WHERE m.conversation_id = p_conversation_id;
  INSERT INTO public.messages(id, conversation_id, user_id, role, content, status, position)
  VALUES(p_message_id, p_conversation_id, auth.uid(), 'user', p_content, 'complete', v_position);
  UPDATE public.conversations SET updated_at = clock_timestamp(),
    title = CASE WHEN title = 'New chat' THEN left(p_content, 42) || CASE WHEN length(p_content) > 42 THEN '…' ELSE '' END ELSE title END
  WHERE conversations.id = p_conversation_id;
  RETURN QUERY SELECT p_message_id, v_position;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.claim_assistant_message(p_conversation_id uuid, p_user_message_id uuid)
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
  SELECT m.* INTO v_response FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.reply_to_message_id = p_user_message_id;
  IF FOUND AND v_response.status = 'complete' THEN
    RETURN QUERY SELECT v_response.id, v_response.position, v_response.content, v_response.status, true;
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.status = 'streaming') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'A response is still running.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = p_conversation_id AND m.role = 'user' AND m.position > v_user.position) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Only the latest message can start a response.';
  END IF;
  IF v_response.id IS NOT NULL THEN
    v_position := v_response.position;
    DELETE FROM public.messages m WHERE m.id = v_response.id;
  ELSE
    SELECT COALESCE(MAX(m.position), 0) + 1 INTO v_position FROM public.messages m WHERE m.conversation_id = p_conversation_id;
  END IF;
  INSERT INTO public.messages(conversation_id, user_id, reply_to_message_id, role, content, status, position)
  VALUES(p_conversation_id, auth.uid(), p_user_message_id, 'assistant', '…', 'streaming', v_position)
  RETURNING * INTO v_response;
  RETURN QUERY SELECT v_response.id, v_response.position, v_response.content, v_response.status, false;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.recover_stale_chat(uuid), public.append_user_message(uuid, uuid, text), public.claim_assistant_message(uuid, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.recover_stale_chat(uuid), public.append_user_message(uuid, uuid, text), public.claim_assistant_message(uuid, uuid) TO authenticated;
