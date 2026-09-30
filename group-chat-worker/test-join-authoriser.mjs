// POST /groups/{id}/join — the optional authorising actor (2026-09-30).
//
// This route serves two different intentions through one shape. It is the self-join path, and it
// is also how Agent-Builder's add_user_to_chat_group and the MCP server's add_group_member add
// somebody else: both look the TARGET up and present the target's own credentials, because that
// is the only shape the endpoint accepts. Serving both is precisely why it has never checked
// ownership — there was no requester in the request to check.
//
// added_by_* names the requester when there is one, and is verified against the group. Pinned
// here:
//   1. a request WITHOUT added_by behaves exactly as it always did, because the full set of
//      callers is not knowable from this repository and breaking one silently is a failure this
//      system has already had;
//   2. a request WITH added_by is refused unless that person is an owner or admin of THIS group;
//   3. the two fields cannot be sent one at a time, which would otherwise read as authorised
//      while proving nothing.
//
// The fixture is built here rather than imported from test-direct-chat.mjs: that file runs its
// own assertions at import time and is currently failing on its own, before and after this
// change. Importing it would make an unrelated breakage look like this one.
//
// Run:  node test-join-authoriser.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.js';

/** The D1 shape the worker uses: prepare().bind().first()/all()/run(). */
function database(schema) {
  const db = new DatabaseSync(':memory:');
  db.exec(schema);
  return {
    db,
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        bind(...values) {
          return {
            first: async () => statement.get(...values),
            all: async () => ({ results: statement.all(...values) }),
            run: () => {
              const result = statement.run(...values);
              return { meta: { last_row_id: Number(result.lastInsertRowid) } };
            },
          };
        },
      };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map((s) => s.run());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
const chat = database(schema);

// tor owns NIBI, inger administers it, tom is an ordinary member. outsider owns a DIFFERENT
// group, so "has standing somewhere" can be told apart from "has standing here".
chat.db.exec(`
  INSERT INTO groups(id,name,created_by,created_at,updated_at) VALUES ('nibi','NIBI FELLES','tor',1,1);
  INSERT INTO groups(id,name,created_by,created_at,updated_at) VALUES ('other','OTHER GROUP','outsider',1,1);
  INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES
    ('nibi','tor','owner',1),
    ('nibi','inger','admin',1),
    ('nibi','tom','member',1),
    ('other','outsider','owner',1);
`);

// validateUser goes through the SMS gateway, which every one of these requests passes: the
// question under test is standing in the group, not whether a user_id/phone pair is real.
const env = {
  CHAT_DB: chat,
  SMS_WORKER: { fetch: async () => Response.json({ role: 'User' }) },
};

const call = (route, body) =>
  worker.fetch(
    new Request('https://chat.test' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
    { waitUntil() {} },
  );

const get = (route) =>
  worker.fetch(new Request('https://chat.test' + route), env, { waitUntil() {} });

const joinBody = (userId, extra = {}) => ({ user_id: userId, phone: '+4790000000', ...extra });
const roleOf = (groupId, userId) =>
  chat.db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId)?.role ?? null;

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) console.log(`ok    ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}\n      ${detail}`);
  }
};

// 1. Unchanged without added_by. A compatibility guarantee, not an endorsement: it is what stops
//    an unknown caller breaking while the new log line counts who still uses this path.
{
  const res = await call('/groups/nibi/join', joinBody('newcomer'));
  check('without added_by, a join still succeeds exactly as before', res.status === 200, String(res.status));
  check('  and the row is written', roleOf('nibi', 'newcomer') === 'member', String(roleOf('nibi', 'newcomer')));
}

// 2. An authoriser who has standing here.
{
  const byOwner = await call('/groups/nibi/join', joinBody('added-by-owner', {
    added_by_user_id: 'tor', added_by_phone: '+4790000001', role: 'admin',
  }));
  check('an owner may add someone else', byOwner.status === 200, String(byOwner.status));
  check('  with the role they asked for', roleOf('nibi', 'added-by-owner') === 'admin', String(roleOf('nibi', 'added-by-owner')));

  const byAdmin = await call('/groups/nibi/join', joinBody('added-by-admin', {
    added_by_user_id: 'inger', added_by_phone: '+4790000002',
  }));
  check('an admin may add someone else', byAdmin.status === 200, String(byAdmin.status));
}

// 3. An authoriser who does not.
{
  const byMember = await call('/groups/nibi/join', joinBody('should-not-appear', {
    added_by_user_id: 'tom', added_by_phone: '+4790000003',
  }));
  check('a plain member may not add anyone', byMember.status === 403, String(byMember.status));
  check('  and nothing was written', roleOf('nibi', 'should-not-appear') === null, String(roleOf('nibi', 'should-not-appear')));

  const byOutsider = await call('/groups/nibi/join', joinBody('also-not', {
    added_by_user_id: 'outsider', added_by_phone: '+4790000004',
  }));
  check('owning a DIFFERENT group grants nothing here', byOutsider.status === 403, String(byOutsider.status));
  check('  and nothing was written', roleOf('nibi', 'also-not') === null, String(roleOf('nibi', 'also-not')));
}

// 4. Half an authoriser is not an authoriser. Accepting a lone user_id would let a caller name a
//    requester without proving anything about them — worse than naming none, because the request
//    would then read as authorised.
{
  const idOnly = await call('/groups/nibi/join', joinBody('half-1', { added_by_user_id: 'tor' }));
  check('added_by_user_id alone is refused', idOnly.status === 400, String(idOnly.status));
  check('  and nothing was written', roleOf('nibi', 'half-1') === null, String(roleOf('nibi', 'half-1')));

  const phoneOnly = await call('/groups/nibi/join', joinBody('half-2', { added_by_phone: '+4790000001' }));
  check('added_by_phone alone is refused', phoneOnly.status === 400, String(phoneOnly.status));
  check('  and nothing was written', roleOf('nibi', 'half-2') === null, String(roleOf('nibi', 'half-2')));
}

// 5. A missing group is still 404, and the authoriser check does not shadow it.
{
  const res = await call('/groups/no-such/join', joinBody('nobody', {
    added_by_user_id: 'tor', added_by_phone: '+4790000001',
  }));
  check('a missing group is still 404, not 403', res.status === 404, String(res.status));
}

// 6. The published contract names the new fields, so a caller discovers them the way everything
//    else on this worker is discovered — and neither is required, so the old shape stays valid.
{
  const spec = await (await get('/openapi.json')).json();
  const body = spec.paths['/groups/{groupId}/join'].post.requestBody.content['application/json'].schema;
  check('the spec documents added_by_user_id', Boolean(body.properties.added_by_user_id), Object.keys(body.properties).join(','));
  check('the spec documents added_by_phone', Boolean(body.properties.added_by_phone), Object.keys(body.properties).join(','));
  check('neither is required, so every existing caller stays valid',
    !body.required.includes('added_by_user_id') && !body.required.includes('added_by_phone'),
    JSON.stringify(body.required));
}

console.log(failures === 0 ? '\nAll join-authoriser checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
