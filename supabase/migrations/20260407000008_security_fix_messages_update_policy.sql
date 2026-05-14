-- Security fix: Restrict message updates to sender only
-- The previous 'Update own messages' policy allowed receivers to modify message content
-- This is a critical vulnerability that allows tampering with message history

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Update own messages" ON public.messages;

-- Create restrictive policy: only the sender can update their own message
-- This prevents receivers from modifying content, sender_id, receiver_id, etc.
CREATE POLICY "Sender update own messages" ON public.messages
FOR UPDATE TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Note: Receivers now use the 'mark-messages-read' edge function to mark messages as read
-- This function is invoked with service_role access and validates permissions server-side
-- Edge function: supabase/functions/mark-messages-read/index.ts
-- 
-- The function:
-- 1. Authenticates the requesting user
-- 2. Verifies they are the receiver of the message
-- 3. Updates only the 'read' field for unread messages from the sender
--
-- This approach prevents RLS bypass while allowing the intended functionality