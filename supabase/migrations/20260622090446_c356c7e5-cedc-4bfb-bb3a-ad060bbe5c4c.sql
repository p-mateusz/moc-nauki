CREATE OR REPLACE FUNCTION public.guard_message_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
    OR NEW.image_url IS DISTINCT FROM OLD.image_url
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Message content cannot be edited';
  END IF;

  IF NEW.read IS DISTINCT FROM OLD.read AND uid <> OLD.receiver_id THEN
    RAISE EXCEPTION 'Only receiver can mark messages read';
  END IF;

  IF uid <> OLD.sender_id AND uid <> OLD.receiver_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_client_updates_trigger ON public.messages;
CREATE TRIGGER guard_message_client_updates_trigger
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_message_client_updates();

REVOKE EXECUTE ON FUNCTION public.guard_message_client_updates() FROM anon, authenticated, public;