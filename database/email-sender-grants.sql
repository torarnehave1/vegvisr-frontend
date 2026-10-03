-- email-sender-grants.sql — who may send e-mail as whom, and what was actually sent.
--
-- Applied to the vegvisr_org D1 on 2026-10-03. Kept here because the DDL for mcp_audit_log
-- already drifted from the code that writes it (database/mcp-oauth-tables.sql lacks `method` and
-- `client_info`), and a grant table whose shape is unknowable from the repo would be worse: it is
-- the record of who was allowed to speak as someone else.
--
-- WHY A GRANT TABLE EXISTS AT ALL
-- ------------------------------
-- Agent-Builder's send_email lets any Superadmin send as any address (`forUserEmail`,
-- worker/tool-executors.js:8077). That is sound where every caller is the system's own operator.
-- It is not the rule the MCP surface wants: the System Owner is a World Founder on many sites and
-- not all of them want mail sent in their name. So on the MCP path the right to send as an
-- address is either (a) the address is on your OWN profile, or (b) its holder granted it to you,
-- deliberately and revocably. Superadmin grants nothing. These rows are half (b).

-- One row per delegation of ONE sending address to ONE person.
--
-- Rows are never deleted. Revocation is a write, so the table still answers "who could send as
-- post@nibi.no on 4 November?" after the answer has changed — which is the question an audit
-- asks, and a DELETE would destroy it.
CREATE TABLE IF NOT EXISTS email_sender_grants (
  id            TEXT PRIMARY KEY,   -- UUID v4
  sender_email  TEXT NOT NULL,      -- the FROM address being delegated, lowercased
  holder_email  TEXT NOT NULL,      -- config.email whose settings.emailAccounts[] holds it
  grantee_email TEXT NOT NULL,      -- config.email now allowed to send as it, lowercased
  granted_by    TEXT NOT NULL,      -- the VALIDATED creator. Never a field from a request body.
  granted_at    TEXT NOT NULL,      -- ISO 8601
  expires_at    TEXT,               -- ISO 8601; NULL = no expiry
  revoked_at    TEXT,               -- ISO 8601; NULL = live
  revoked_by    TEXT,
  note          TEXT                -- what the granter wrote, shown back on list
);

-- holder_email is STORED rather than derived. Agent-Builder works the holder out at send time
-- with a three-step heuristic (tool-executors.js:8107-8137: profile-whose-login-is-the-address →
-- World founder → single unique holder → refuse if several). That is a guess made at the worst
-- possible moment. Recorded at grant time, the grant says exactly which stored credential it
-- authorises, and send time only has to check it is still true.
--
-- accountId is deliberately NOT stored: it is resolved at send time by matching the address
-- inside the holder's emailAccounts[]. Storing it would freeze a value that a delete-and-re-add
-- changes, and a stale id resolves to no credential at all.

-- At most one LIVE grant per (sender, grantee). A re-grant after revocation is a NEW row, so the
-- history survives; the partial index is what makes "live" the thing that is unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_esg_live
  ON email_sender_grants(sender_email, grantee_email) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_esg_grantee ON email_sender_grants(grantee_email, revoked_at);
CREATE INDEX IF NOT EXISTS idx_esg_sender  ON email_sender_grants(sender_email, revoked_at);


-- Every send attempt, allowed or refused.
--
-- mcp_audit_log cannot answer this. describeCall (mcp/server.js:176-194) captures only graphId
-- from a call's arguments, so an email would audit as tool='send_email' and nothing else — and
-- widening it is both pinned by an exact deepEqual (test/mcp-tools.test.mjs:2312) and wrong in
-- principle, because it reads UNVALIDATED arguments and would record what the model asked for
-- rather than what the gate allowed. This table is written after the gate has decided.
--
-- WHAT IS DELIBERATELY ABSENT: the subject text, the body, the recipient's local part, and any
-- credential. Same rule as audit() (mcp/server.js:72-79) — a copy of the content in a log is a
-- second place for it to leak from. recipient_hash answers "was this person mailed?" for someone
-- who ALREADY knows the address, without the log itself becoming a contact list.
CREATE TABLE IF NOT EXISTS email_send_log (
  id               TEXT PRIMARY KEY,
  ts               TEXT NOT NULL,
  actor_email      TEXT NOT NULL,   -- the VALIDATED caller, from the token
  sender_email     TEXT NOT NULL,   -- the address it went out as (or would have)
  holder_email     TEXT,            -- whose stored credential was used
  basis            TEXT,            -- 'own-profile' | 'grant' | NULL when refused before deciding
  grant_id         TEXT,            -- the exact grant relied on, or NULL
  recipient_domain TEXT,            -- 'example.com' ONLY. Never the local part.
  recipient_hash   TEXT,            -- SHA-256 of the lowercased full address
  subject_chars    INTEGER,         -- length only
  body_chars       INTEGER,
  template_source  TEXT,            -- 'world-template:login/no' | 'caller-html'
  signature_name   TEXT,
  outcome          TEXT NOT NULL,   -- 'SENT', or the ERR code of the refusal
  message_id       TEXT,            -- what Cloudflare returned, so a bounce can be traced back
  surface          TEXT NOT NULL,   -- 'mcp'. The column exists so a second front door needs no migration.
  client_id        TEXT
);
CREATE INDEX IF NOT EXISTS idx_esl_actor_ts  ON email_send_log(actor_email, ts);
CREATE INDEX IF NOT EXISTS idx_esl_sender_ts ON email_send_log(sender_email, ts);
CREATE INDEX IF NOT EXISTS idx_esl_grant     ON email_send_log(grant_id);
