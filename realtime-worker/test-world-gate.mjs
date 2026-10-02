// The World membership gate on /realtime/join-token.
//
// A World's membership is its MAIN CHAT GROUP (decided 2026-09-22), not the group_tags column on
// config. For NIBI on 2026-10-02 those two named almost disjoint sets of people, so the choice
// was not cosmetic: the other one would have locked real members out of a live meeting.
//
// What matters most here is what is NOT gated. Eight of the nine meeting owners run no World with
// a main group, and closing their rooms while answering a question about NIBI would be a
// side-effect nobody asked for.
//
// Run:  node test-world-gate.mjs
import { DatabaseSync } from 'node:sqlite'

function db(schema) {
  const d = new DatabaseSync(':memory:')
  d.exec(schema)
  return {
    prepare(sql) {
      const st = d.prepare(sql)
      return { bind: (...v) => ({ first: async () => st.get(...v) ?? null }) }
    },
  }
}

const identity = db(`
  CREATE TABLE meeting_ownership(meeting_id TEXT, owner_email TEXT);
  CREATE TABLE world_founders(domain TEXT, world_name TEXT, founder_email TEXT, main_chat_group_id TEXT);
  CREATE TABLE config(user_id TEXT, email TEXT);
  INSERT INTO meeting_ownership VALUES ('m-nibi','post@nibi.no'),('m-stine','stine.oksvold@gmail.com'),('m-orphan','nobody@example.no');
  INSERT INTO world_founders VALUES ('nibi.no','Nibi','post@nibi.no','g-nibi'),('stineoksvolddesign.no','Stine','stine.oksvold@gmail.com',NULL);
  INSERT INTO config VALUES ('u-member','member@x.no'),('u-outsider','outsider@x.no');
`)
const chat = db(`
  CREATE TABLE group_members(group_id TEXT, user_id TEXT, role TEXT);
  INSERT INTO group_members VALUES ('g-nibi','u-member','member');
`)

// The function under test, lifted from index.js so it runs without a Workers runtime.
const src = (await import('node:fs')).readFileSync(new URL('./index.js', import.meta.url), 'utf8')
const start = src.indexOf('async function checkWorldMembership')
let depth = 0, end = src.indexOf('{', start)
for (let i = end; i < src.length; i++) {
  if (src[i] === '{') depth++
  else if (src[i] === '}') { depth--; if (!depth) { end = i + 1; break } }
}
const { checkWorldMembership } = await import(
  'data:text/javascript,' + encodeURIComponent(src.slice(start, end) + '\nexport { checkWorldMembership };')
)

let fail = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log('ok   ' + name)
  else { fail++; console.error('FAIL ' + name + '  ' + detail) }
}
const env = { vegvisr_org: identity, CHAT_DB: chat }

// 1. A World WITH a main group gates, and membership decides.
{
  const inGroup = await checkWorldMembership('m-nibi', { userId: 'u-member' }, env)
  check('a member of the World group is allowed', inGroup.gated && inGroup.allowed, JSON.stringify(inGroup))
  check('  and the World is named, for the refusal message', inGroup.world === 'Nibi', inGroup.world)

  const notIn = await checkWorldMembership('m-nibi', { userId: 'u-outsider' }, env)
  check('someone outside the group is refused', notIn.gated && !notIn.allowed, JSON.stringify(notIn))
}

// 2. An e-mail-only caller is resolved to a user_id first, not refused outright.
{
  const byEmail = await checkWorldMembership('m-nibi', { email: 'member@x.no' }, env)
  check('an e-mail-only identity still resolves to membership', byEmail.allowed, JSON.stringify(byEmail))
  const unknown = await checkWorldMembership('m-nibi', { email: 'ghost@x.no' }, env)
  check('  an identity that resolves to nothing is refused', unknown.gated && !unknown.allowed)
}

// 3. What is NOT gated — the part with the widest blast radius.
{
  const noGroup = await checkWorldMembership('m-stine', { userId: 'u-outsider' }, env)
  check('a World with no main_chat_group_id is NOT gated', !noGroup.gated && noGroup.allowed, JSON.stringify(noGroup))

  const noWorld = await checkWorldMembership('m-orphan', { userId: 'u-outsider' }, env)
  check('a meeting whose owner runs no World is NOT gated', !noWorld.gated && noWorld.allowed)

  const unknownMeeting = await checkWorldMembership('m-nope', { userId: 'u-outsider' }, env)
  check('an unknown meeting is NOT gated', !unknownMeeting.gated && unknownMeeting.allowed)
}

// 4. It fails OPEN. This gate protects a room, not a bank account, and a transient database
//    error at the top of a meeting would otherwise lock out everyone at once.
{
  const broken = { vegvisr_org: { prepare() { throw new Error('d1 down') } }, CHAT_DB: chat }
  const r = await checkWorldMembership('m-nibi', { userId: 'u-outsider' }, broken)
  check('a database error allows rather than denies', !r.gated && r.allowed, JSON.stringify(r))

  const noBinding = await checkWorldMembership('m-nibi', { userId: 'u-outsider' }, { vegvisr_org: identity })
  check('a missing CHAT_DB binding allows rather than denies', !noBinding.gated && noBinding.allowed)
}

console.log(fail === 0 ? '\nAll world-gate checks passed.' : `\n${fail} check(s) failed.`)
process.exit(fail ? 1 : 0)
