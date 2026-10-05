-- sms_send_log — one row per SMS attempt from the MCP surface, allowed or refused.
--
-- Mirrors email_send_log, with the same privacy shape for a different identifier: the recipient's
-- COUNTRY CODE is stored, never the subscriber number, plus a SHA-256 of the full number. That
-- answers "was this person texted?" for somebody who already knows the number, while the log
-- itself never becomes a phone book. The message body is never stored; its length and segment
-- count are, because those are what cost money.
--
-- A row is written on REFUSALS too. An attempt by somebody not on the allow-list is exactly the
-- event worth having, and it is invisible if only successes are recorded.
--
-- Rows are never deleted.
CREATE TABLE IF NOT EXISTS sms_send_log (
  id             TEXT PRIMARY KEY,
  ts             TEXT NOT NULL,
  actor_email    TEXT NOT NULL,
  sender_id      TEXT,              -- the alphanumeric sender shown on the handset, e.g. VEGR.AI
  recipient_cc   TEXT,              -- country code only, e.g. +47
  recipient_hash TEXT,              -- SHA-256 of the full normalised number
  body_chars     INTEGER,
  segments       INTEGER,           -- what ClickSend bills per recipient
  outcome        TEXT NOT NULL,     -- SENT | REFUSED | FAILED
  refusal_code   TEXT,              -- the ERR code when outcome = REFUSED
  message_id     TEXT,
  price          REAL,
  currency       TEXT,
  surface        TEXT NOT NULL,     -- 'mcp'
  client_id      TEXT
);

CREATE INDEX IF NOT EXISTS idx_sms_log_actor_ts ON sms_send_log(actor_email, ts);
