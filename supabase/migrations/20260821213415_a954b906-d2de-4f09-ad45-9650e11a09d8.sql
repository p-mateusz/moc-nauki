-- 1) app_settings: only expose registration_enabled publicly
DROP POLICY IF EXISTS "Public read whitelisted settings" ON public.app_settings;
CREATE POLICY "Public read registration flag"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key = 'registration_enabled');

-- 2) messages: restrict client updates to reactions / deleted_for (and read by receiver only)
CREATE OR REPLACE FUNCTION public.guard_message_client_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF uid <> OLD.sender_id AND uid <> OLD.receiver_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Immutable columns for every client update
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
    OR NEW.image_url IS DISTINCT FROM OLD.image_url
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Message content cannot be edited';
  END IF;

  -- Only the receiver may flip the read flag, and never back to unread
  IF NEW.read IS DISTINCT FROM OLD.read THEN
    IF uid <> OLD.receiver_id THEN
      RAISE EXCEPTION 'Only receiver can mark messages read';
    END IF;
    IF COALESCE(OLD.read, false) = true AND COALESCE(NEW.read, false) = false THEN
      RAISE EXCEPTION 'Read flag cannot be reverted';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_message_client_updates_trigger ON public.messages;
CREATE TRIGGER guard_message_client_updates_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.guard_message_client_updates();

DROP POLICY IF EXISTS "Users update own message metadata" ON public.messages;
CREATE POLICY "Participants update message reactions only"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);