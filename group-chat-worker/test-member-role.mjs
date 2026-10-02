// PATCH /groups/{id}/members/{userId} — changing a member's role (2026-10-02).
//
// The roles existed and were already enforced by the invite and removal checks, but there was no
// way to CHANGE one after a member was added: the only UPDATE on group_members anywhere in this
// worker set alerts_enabled, and /join uses INSERT OR IGNORE so re-joining as admin does nothing
// to someone already in the group.
//
// The case that needed it: a World's main chat group is owned by the World's own address
// (post@nibi.no) while the person administering the platform connects as themselves, and so could
// not add members to a group they are responsible for. The alternative was letting any platform
// Superadmin bypass the owner check in EVERY group. This is the narrower answer — it removes no
// check, it lets an owner delegate inside their own group — and most of what is pinned below is
// the set of things it still refuses.
//
// Run:  node test-member-role.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './index.js';

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

const chat = database(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
chat.db.exec(`
  INSERT INTO groups(id,name,created_by,created_at,updated_at) VALUES ('nibi','NIBI FELLES','owner',1,1);
  INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES
    ('nibi','owner','owner',1),
    ('nibi','admin','admin',1),
    ('nibi','plain','member',1),
    ('nibi','other','member',1);
`);

const env = { CHAT_DB: chat, SMS_WORKER: { fetch: async () => Response.json({ role: 'User' }) } };

const call = (method, route, body) =>
  worker.fetch(
    new Request('https://chat.test' + route, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
    { waitUntil() {} },
  );

const as = (userId, role) => ({ user_id: userId, phone: '+4790000000', role });
const roleOf = (u) =>
  chat.db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get('nibi', u)?.role ?? null;

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`ok    ${name}`);
  else { failures++; console.error(`FAIL  ${name}\n      ${detail}`); }
};

// 1. What it is for: the owner promotes a member, who can then add people.
{
  const res = await call('PATCH', '/groups/nibi/members/plain', as('owner', 'admin'));
  const body = await res.json();
  check('the owner can promote a member to admin', res.status === 200, `${res.status} ${JSON.stringify(body)}`);
  check('  and the row changes', roleOf('plain') === 'admin', String(roleOf('plain')));
  check('  the reply names the previous role, so a caller can undo it', body.previous_role === 'member', JSON.stringify(body));

  const back = await call('PATCH', '/groups/nibi/members/plain', as('owner', 'member'));
  check('and can demote them again', back.status === 200 && roleOf('plain') === 'member', String(roleOf('plain')));
}

// 2. Only the owner. An admin can add members; it cannot make more admins.
{
  const byAdmin = await call('PATCH', '/groups/nibi/members/other', as('admin', 'admin'));
  check('an admin cannot change roles', byAdmin.status === 403, String(byAdmin.status));
  check('  and nothing changed', roleOf('other') === 'member', String(roleOf('other')));

  const byMember = await call('PATCH', '/groups/nibi/members/other', as('plain', 'admin'));
  check('a plain member cannot either', byMember.status === 403, String(byMember.status));

  const byStranger = await call('PATCH', '/groups/nibi/members/other', as('nobody', 'admin'));
  check('someone outside the group cannot', byStranger.status === 403, String(byStranger.status));
  check('  and nothing changed', roleOf('other') === 'member', String(roleOf('other')));
}

// 3. Ownership is not a role you assign. Handing over a group is a transfer, and allowing it here
//    would let a group end up with two owners or none depending on what followed.
{
  const toOwner = await call('PATCH', '/groups/nibi/members/other', as('owner', 'owner'));
  check('"owner" cannot be assigned', toOwner.status === 400, String(toOwner.status));
  check('  and nothing changed', roleOf('other') === 'member', String(roleOf('other')));

  const nonsense = await call('PATCH', '/groups/nibi/members/other', as('owner', 'wizard'));
  check('an unknown role is refused', nonsense.status === 400, String(nonsense.status));

  const missing = await call('PATCH', '/groups/nibi/members/other', { user_id: 'owner', phone: '+4790000000' });
  check('a missing role is refused', missing.status === 400, String(missing.status));
}

// 4. The owner's own role is untouchable, from either direction. Demoting themselves would leave
//    the group with nobody able to promote anyone back, including them.
{
  const self = await call('PATCH', '/groups/nibi/members/owner', as('owner', 'member'));
  check('the owner cannot demote themselves', self.status === 400, String(self.status));
  check('  and is still the owner', roleOf('owner') === 'owner', String(roleOf('owner')));
}

// 5. A target who is not in the group is a 404, not a silent insert — this route changes a role,
//    it does not add anybody.
{
  const ghost = await call('PATCH', '/groups/nibi/members/ghost', as('owner', 'admin'));
  check('a non-member target is 404', ghost.status === 404, String(ghost.status));
  check('  and no row was created', roleOf('ghost') === null, String(roleOf('ghost')));
}

// 6. DELETE on the same path still removes, so the new method did not shadow the old one.
{
  const del = await call('DELETE', '/groups/nibi/members/other?user_id=owner&phone=%2B4790000000');
  check('DELETE on the same path still removes a member', del.status === 200, String(del.status));
  check('  and the row is gone', roleOf('other') === null, String(roleOf('other')));
}

// 7. The published contract names the route, so a caller can discover it.
{
  const spec = await (await worker.fetch(new Request('https://chat.test/openapi.json'), env, { waitUntil() {} })).json();
  const path = spec.paths['/groups/{groupId}/members/{userId}'];
  check('the spec documents the PATCH', Boolean(path.patch), Object.keys(path).join(','));
  check('  with member and admin as the only roles',
    JSON.stringify(path.patch.requestBody.content['application/json'].schema.properties.role.enum) === '["member","admin"]',
    JSON.stringify(path.patch.requestBody.content['application/json'].schema.properties.role.enum));
  check('  and DELETE is still documented beside it', Boolean(path.delete));
}

console.log(failures === 0 ? '\nAll member-role checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
