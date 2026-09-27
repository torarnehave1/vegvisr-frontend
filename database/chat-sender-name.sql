-- group_messages.sender_name (2026-09-27)
--
-- A bot-posted message stores user_id = 'bot:<uuid>' and nothing else about the sender, so every
-- client has to resolve the name from the group's bot list. A client whose list predates the bot
-- shows a raw id instead: adding the Claude bot and posting immediately rendered as "bot:8d8f".
--
-- The name now travels with the message, exactly as sender_avatar_url and
-- forwarded_from_user_name already do. Denormalised on purpose: a display name captured at send
-- time is what was true when the message was sent, and it needs no second request to read.
ALTER TABLE group_messages ADD COLUMN sender_name TEXT;
