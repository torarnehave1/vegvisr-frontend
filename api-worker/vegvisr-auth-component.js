// Source string for the <vegvisr-auth> custom element, served verbatim at
// GET /components/vegvisr-auth.js. Kept as its own module (not an R2 blob) so it stays in
// version control and deploys with the worker — same idea as the other inline components in
// component-handlers.js, just isolated for editability.
//
// The component source below must NOT contain backticks or ${...} (it lives inside this template
// literal). It uses single quotes + string concatenation throughout.
export const VEGVISR_AUTH_COMPONENT = `/**
 * <vegvisr-auth> — the standard Vegvisr login/logout bar + graph read/save bridge.
 *
 * One <script> gives any page (on ANY domain) three things:
 *   1. window.vegvisrWhoAmI()  -> Promise<{email, role} | null>
 *   2. window.vegvisrPatchNode(nodeId, fields[, graphId]) -> authenticated, version-safe save
 *   3. a <vegvisr-auth> element rendering a 3-state bar (logged out / inbox-sent / logged in)
 *
 * Auth = email magic-link. On verify the durable token is captured into per-origin localStorage
 * and replayed as X-API-Token to resolve identity; graph WRITES send x-user-role + x-user-email
 * (KG session auth, works from any origin). No .vegvisr.org cookie dependency.
 *
 * Usage:
 *   <script src="https://api.vegvisr.org/components/vegvisr-auth.js"></script>
 *   <vegvisr-auth></vegvisr-auth>                     (login-only; invite worlds)
 *   <vegvisr-auth register-mode="open"></vegvisr-auth> (also offers email self-registration)
 */
(function () {
  var AUTH = 'https://cookie.vegvisr.org';
  var DASH = 'https://dashboard.vegvisr.org';
  var MAIN = 'https://vegvisr-frontend.torarnehave.workers.dev';
  var KG = 'https://knowledge.vegvisr.org';
  var STORE_KEY = 'vegvisr_user';
  var CHANGED = 'vegvisr-auth-changed';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- canonical identity store ----------
  function readStore() {
    if (window.__VEGVISR_USER && window.__VEGVISR_USER.email) {
      return { email: window.__VEGVISR_USER.email, role: window.__VEGVISR_USER.role || null, token: window.__VEGVISR_USER.token || null };
    }
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var u = JSON.parse(raw); if (u && u.email) return { email: u.email, role: u.role || null, token: u.token || null }; }
    } catch (e) {}
    try {
      var legacy = localStorage.getItem('user') || localStorage.getItem('userStore');
      if (legacy) {
        var p = JSON.parse(legacy); var user = p.user || p;
        if (user && user.email) return { email: user.email, role: user.role || null, token: user.emailVerificationToken || p.token || null };
      }
    } catch (e) {}
    return null;
  }
  function writeStore(u) {
    var rec = { email: u.email, role: u.role || null, token: u.token || null };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rec)); } catch (e) {}
    window.__VEGVISR_USER = { email: rec.email, role: rec.role };
    return rec;
  }
  function clearStore() {
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem('user'); localStorage.removeItem('userStore'); } catch (e) {}
    window.__VEGVISR_USER = null;
  }

  async function resolveByToken(token) {
    var r = await fetch(DASH + '/userdata-from-token', { headers: { 'X-API-Token': token, 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('identity resolve failed (' + r.status + ')');
    var d = await r.json();
    if (!d || !d.email) throw new Error('no identity for token');
    return { email: d.email, role: d.role || null, token: token };
  }

  // Role by EMAIL — the platform's proven pattern (Contacts app + landing template both do
  // this at login). The token path above is optional: when verify returns no apiToken the
  // role must still resolve, or require-role gates deny real admins ("Ingen tilgang").
  async function resolveRoleByEmail(email) {
    var r = await fetch(DASH + '/get-role?email=' + encodeURIComponent(email), { headers: { 'Accept': 'application/json' } });
    if (!r.ok) throw new Error('role lookup failed (' + r.status + ')');
    var d = await r.json();
    if (!d || !d.role) throw new Error('no role for email');
    return d.role;
  }

  // ---------- globals ----------
  window.vegvisrWhoAmI = async function () {
    var s = readStore();
    if (!s) return null;
    // Self-healing reads, email-first (Contacts pattern): a store that carries an identity
    // but no role — or a stale wrong role can be corrected by callers re-asking — resolves
    // against the authoritative get-role before anything gates on it.
    if (!s.role && s.email) {
      try { s = writeStore({ email: s.email, role: await resolveRoleByEmail(s.email), token: s.token || null }); } catch (e) {}
    }
    if (!s.role && s.token) { try { s = writeStore(await resolveByToken(s.token)); } catch (e) {} }
    return { email: s.email, role: s.role };
  };

  if (!window.__vegvisrBridge) {
    window.__vegvisrBridge = true;
    window.vegvisrPatchNode = async function (a, b, c) {
      var nodeId, fields, gId;
      if (b && typeof b === 'object') { nodeId = a; fields = b; gId = c || window.__VEGVISR_GRAPH_ID; }
      else if (c && typeof c === 'object') { gId = a || window.__VEGVISR_GRAPH_ID; nodeId = b; fields = c; }
      else throw new Error('vegvisrPatchNode(nodeId, fields[, graphId])');
      if (!gId) throw new Error('vegvisrPatchNode: no graphId');
      if (!nodeId) throw new Error('vegvisrPatchNode: no nodeId');
      var s = readStore();
      if (!s || !s.email) throw new Error('Not signed in to Vegvisr — log in to save.');
      var headers = { 'Content-Type': 'application/json', 'x-user-role': s.role || 'User', 'x-user-email': s.email };
      async function ver() {
        var r = await fetch(KG + '/getknowgraph?id=' + encodeURIComponent(gId));
        if (!r.ok) throw new Error('Could not read graph version (' + r.status + ')');
        var g = await r.json(); return Number((g && g.metadata && g.metadata.version) || 0);
      }
      var ev = await ver();
      var res = await fetch(KG + '/patchNode', { method: 'POST', headers: headers, body: JSON.stringify({ graphId: gId, nodeId: nodeId, fields: fields, expectedVersion: ev }) });
      if (res.status === 409) {
        ev = await ver();
        res = await fetch(KG + '/patchNode', { method: 'POST', headers: headers, body: JSON.stringify({ graphId: gId, nodeId: nodeId, fields: fields, expectedVersion: ev }) });
      }
      var data = null; try { data = await res.json(); } catch (e) {}
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || ('patchNode failed (' + res.status + ')'));
      return data;
    };
  }

  // ---------- magic-link flow ----------
  function currentUrl() { return window.location.href; }
  function cleanUrl() {
    try {
      var u = new URL(window.location.href); u.searchParams.delete('magic');
      window.history.replaceState({}, document.title, u.pathname + (u.search || '') + u.hash);
    } catch (e) {}
  }
  async function sendMagic(email) {
    var r = await fetch(AUTH + '/login/magic/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, redirectUrl: currentUrl() })
    });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok || !d.success) throw new Error(d.error || 'Kunne ikke sende lenke');
    return d;
  }
  async function registerThenSend(email) {
    try { await fetch(MAIN + '/sve2?email=' + encodeURIComponent(email), { method: 'GET' }); } catch (e) {}
    return sendMagic(email);
  }
  async function verifyMagic(token) {
    var r = await fetch(AUTH + '/login/magic/verify?token=' + encodeURIComponent(token), { headers: { 'Accept': 'application/json' } });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok || !d.success) throw new Error(d.error || 'Ugyldig eller utløpt lenke');
    return d;
  }

  // On script load: complete a magic-link return once, globally (independent of any element).
  var bootDone = false;
  async function bootOnce() {
    if (bootDone) return; bootDone = true;
    var token = null;
    try { token = new URL(window.location.href).searchParams.get('magic'); } catch (e) {}
    if (token) {
      try {
        var v = await verifyMagic(token);
        // Contacts-app pattern: the role is fetched BY EMAIL as part of signing in — never
        // dependent on the verify response having carried an apiToken.
        var tok = v.apiToken || null;
        var role = null;
        try { role = await resolveRoleByEmail(v.email); } catch (e) {}
        if (!role && tok) { try { role = (await resolveByToken(tok)).role; } catch (e) {} }
        writeStore({ email: v.email, role: role, token: tok }); cleanUrl();
      } catch (e) { /* leave signed out; bar shows sign-in */ }
    } else {
      // warm the role if we have an identity but no role yet — email first, token as backup
      var s = readStore();
      if (s && !s.role && s.email) {
        try { writeStore({ email: s.email, role: await resolveRoleByEmail(s.email), token: s.token || null }); }
        catch (e) { if (s.token) { try { writeStore(await resolveByToken(s.token)); } catch (e2) {} } }
      }
    }
    try { window.dispatchEvent(new Event(CHANGED)); } catch (e) {}
  }

  // ---------- custom element ----------
  var CSS = '.bar{display:inline-flex;align-items:center;gap:8px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;color:inherit}'
    + '.in{padding:6px 10px;border:1px solid rgba(128,128,128,.45);border-radius:8px;background:rgba(255,255,255,.06);color:inherit;font-size:13px;min-width:150px;outline:none}'
    + '.btn{padding:6px 12px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap}'
    + '.btn:hover{background:#1d4ed8}'
    + '.btn.ghost{background:transparent;color:inherit;border:1px solid rgba(128,128,128,.45)}'
    + '.btn.out{background:rgba(128,128,128,.18);color:inherit}'
    + '.email{opacity:.85;max-width:220px;overflow:hidden;text-overflow:ellipsis}'
    + '.msg{opacity:.8}.err{color:#dc2626;font-size:12px}'
    // gate (full-screen login card) styles — upgraded to match the Contacts login card
    + '.gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#020617;padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
    + '.card{width:100%;max-width:440px;background:#0f172a;border:1px solid rgba(148,163,184,.14);border-radius:20px;padding:32px;box-shadow:0 24px 70px rgba(0,0,0,.55);text-align:center;color:#e2e8f0}'
    + '.logowrap{width:80px;height:80px;border-radius:24px;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;background:rgba(2,132,199,.10);border:1px solid rgba(14,165,233,.22)}'
    + '.logowrap img{width:52px;height:52px;border-radius:14px;object-fit:cover}'
    + '.title{font-size:28px;font-weight:800;letter-spacing:-.02em;margin:0 0 8px;color:#fff}'
    + '.sub{opacity:.65;font-size:14px;margin:0 0 26px;line-height:1.5}'
    + '.glabel{display:block;text-align:left;font-size:13px;font-weight:500;color:#cbd5e1;margin:0 0 8px}'
    + '.gfield{position:relative;margin-bottom:14px}'
    + '.gicon{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:#64748b;pointer-events:none}'
    + '.gin{width:100%;box-sizing:border-box;padding:12px 14px 12px 42px;border-radius:12px;border:1px solid #1e293b;background:#020617;color:#e2e8f0;font-size:14px;outline:none;transition:border-color .15s,box-shadow .15s}'
    + '.gin::placeholder{color:#475569}'
    + '.gin:focus{border-color:#0ea5e9;box-shadow:0 0 0 3px rgba(14,165,233,.28)}'
    + '.gbtn{width:100%;box-sizing:border-box;padding:12px;border:0;border-radius:12px;background:#0284c7;color:#fff;font-weight:600;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 10px 24px rgba(2,132,199,.25);transition:background .15s}'
    + '.gbtn:hover{background:#0ea5e9}.gbtn[disabled]{opacity:.6;cursor:not-allowed}'
    + '.gbtn.ghost{background:transparent;color:#e2e8f0;border:1px solid rgba(148,163,184,.30);box-shadow:none;margin-top:10px}.gbtn.ghost:hover{background:rgba(148,163,184,.10)}'
    + '.spin{width:18px;height:18px;animation:vgspin 1s linear infinite}@keyframes vgspin{to{transform:rotate(360deg)}}'
    + '.gsent{background:rgba(16,185,129,.10);border:1px solid rgba(16,185,129,.22);border-radius:14px;padding:22px 18px}'
    + '.gsent .gcheck{width:44px;height:44px;color:#34d399;margin:0 auto 12px;display:block}.gsent .gh{color:#34d399;font-weight:600;margin:0 0 6px}.gsent .gp{color:rgba(52,211,153,.78);font-size:13px;line-height:1.5;margin:0}'
    + '.gerr{color:#fca5a5;font-size:13px;margin:0 0 12px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.22);border-radius:10px;padding:9px 11px;text-align:left}'
    + '.linkbtn{background:none;border:0;color:#7dd3fc;font-size:13px;cursor:pointer;margin-top:14px}'
    + '.gfoot{margin-top:26px;padding-top:20px;border-top:1px solid #1e293b;color:#64748b;font-size:12px;line-height:1.5}'
    // floating signed-in bar shown after a gate grants access (the element may be anywhere in the DOM)
    + '.floatbar{position:fixed;top:14px;right:14px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;background:rgba(15,23,42,.88);border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:6px 8px 6px 14px;box-shadow:0 6px 20px rgba(0,0,0,.35);color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px}';

  // Inline icons for the upgraded gate card (no external assets).
  var IC_MAIL = '<svg class="gicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>';
  var IC_CHECK = '<svg class="gcheck" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="m9 11 3 3L22 4"></path></svg>';
  var IC_SPIN = '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>';
  var IC_LOCK = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

  class VegvisrAuth extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this.mode = 'loading'; this.note = ''; this.access = 'loading'; this.card = 'form'; this.me = null; this._onChanged = null; }
    // Non-gated: register-mode="invite|open". Gated: add require-auth (block until signed in);
    // require-role="Admin,Superadmin" (allowed roles); app-name + logo brand the login card.
    get registerMode() { return (this.getAttribute('register-mode') || 'invite').toLowerCase(); }
    get requireAuth() { return this.hasAttribute('require-auth'); }
    get requireRoles() { return (this.getAttribute('require-role') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
    get appName() { return this.getAttribute('app-name') || 'Vegvisr'; }
    get logo() { return this.getAttribute('logo') || ''; }
    connectedCallback() {
      var self = this;
      this._onChanged = function () { if (self.requireAuth) self.evaluate(); else self.refresh(); };
      window.addEventListener(CHANGED, this._onChanged);
      if (this.requireAuth) { this.lockBody(true); this.access = 'loading'; this.card = 'form'; this.render(); this.evaluate(); }
      else { this.refresh(); }
      bootOnce();
    }
    disconnectedCallback() { if (this._onChanged) window.removeEventListener(CHANGED, this._onChanged); }
    lockBody(on) { try { document.documentElement.style.overflow = on ? 'hidden' : ''; } catch (e) {} }

    // ----- gate (blocking) -----
    async evaluate() {
      var me = null; try { me = await window.vegvisrWhoAmI(); } catch (e) {}
      if (!me || !me.email) { this.access = 'login'; this.lockBody(true); this.render(); return; }
      var roles = this.requireRoles;
      if (roles.length && roles.indexOf(me.role) === -1) { this.me = me; this.access = 'denied'; this.lockBody(true); this.render(); return; }
      this.me = me; this.access = 'granted'; this.lockBody(false); this.render();
    }

    // ----- bar (non-blocking) -----
    refresh() { var me = readStore(); this.mode = (me && me.email) ? 'signedin' : 'signedout'; this.render(); }
    setMode(m, note) { this.mode = m; this.note = note || ''; this.render(); }

    async doSignIn(email) {
      if (!email) return;
      this.lastEmail = email;
      if (this.requireAuth) { this.card = 'working'; this.note = 'Sender lenke…'; this.render(); } else this.setMode('working', 'Sender lenke…');
      try { await sendMagic(email); if (this.requireAuth) { this.card = 'sent'; this.note = ''; this.render(); } else this.setMode('sent', ''); }
      catch (e) { if (this.requireAuth) { this.card = 'form'; this.note = e.message; this.render(); } else this.setMode('signedout', e.message); }
    }
    async doRegister(email) {
      if (!email) return;
      this.lastEmail = email;
      if (this.requireAuth) { this.card = 'working'; this.note = 'Oppretter konto…'; this.render(); } else this.setMode('working', 'Oppretter konto…');
      try { await registerThenSend(email); if (this.requireAuth) { this.card = 'sent'; this.note = ''; this.render(); } else this.setMode('sent', ''); }
      catch (e) { if (this.requireAuth) { this.card = 'form'; this.note = e.message; this.render(); } else this.setMode('signedout', e.message); }
    }
    doLogout() {
      clearStore(); try { window.dispatchEvent(new Event(CHANGED)); } catch (e) {}
      if (this.requireAuth) { this.access = 'login'; this.card = 'form'; this.note = ''; this.lockBody(true); this.render(); } else this.setMode('signedout', '');
    }

    logoBlock() { var inner = this.logo ? '<img src="' + esc(this.logo) + '" alt="" referrerpolicy="no-referrer" />' : IC_LOCK; return '<div class="logowrap">' + inner + '</div>'; }

    // On a GATED page, the page's own legacy "Logg inn" button is redundant once the visitor is
    // signed in (the gate owns auth). Hide any page-level login button/link by its text so there is
    // one auth UI, not two. Only runs in gate mode + when granted, so nothing is hidden pre-login.
    hidePageLoginControls() {
      try {
        var LOGIN = ['logg inn', 'logg deg inn', 'login', 'log in', 'sign in', 'log på', 'logg på'];
        var nodes = document.querySelectorAll('button, a, [role="button"]');
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i];
          if (this.contains(n)) continue;
          var t = (n.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase();
          if (LOGIN.indexOf(t) !== -1) { n.setAttribute('data-vegvisr-hidden', '1'); n.style.display = 'none'; }
        }
      } catch (e) {}
    }

    render() {
      if (this.requireAuth) return this.renderGate();
      var body, me = readStore();
      if (this.mode === 'signedin' && me) {
        body = '<span class="email">' + esc(me.email) + '</span><button class="btn out" id="lo">Logg ut</button>';
      } else if (this.mode === 'sent') {
        body = '<span class="msg">Sjekk innboksen din for påloggingslenken.</span>';
      } else if (this.mode === 'working') {
        body = '<span class="msg">' + esc(this.note || '…') + '</span>';
      } else if (this.mode === 'loading') {
        body = '<span class="msg">…</span>';
      } else {
        var reg = this.registerMode === 'open' ? '<button class="btn ghost" id="reg">Registrer</button>' : '';
        body = '<input class="in" id="em" type="email" placeholder="deg@epost.no" autocomplete="email" />'
          + '<button class="btn" id="si">Logg inn</button>' + reg
          + (this.note ? '<span class="err">' + esc(this.note) + '</span>' : '');
      }
      this.shadowRoot.innerHTML = '<style>' + CSS + '</style><div class="bar">' + body + '</div>';
      var self = this, root = this.shadowRoot;
      var em = root.getElementById('em');
      var si = root.getElementById('si'); if (si) si.onclick = function () { self.doSignIn(em.value.trim()); };
      var reg2 = root.getElementById('reg'); if (reg2) reg2.onclick = function () { self.doRegister(em.value.trim()); };
      if (em) em.onkeydown = function (e) { if (e.key === 'Enter') self.doSignIn(em.value.trim()); };
      var lo = root.getElementById('lo'); if (lo) lo.onclick = function () { self.doLogout(); };
    }

    renderGate() {
      var self = this, root = this.shadowRoot;
      if (this.access === 'granted') {
        // reveal the page; float a signed-in bar (email + logout) at top-right so it is visible
        // regardless of where the <vegvisr-auth> element sits in the DOM (gates inject at page end).
        root.innerHTML = '<style>' + CSS + '</style><div class="floatbar"><span class="email">' + esc((this.me && this.me.email) || '') + '</span><button class="btn out" id="lo">Logg ut</button></div>';
        var lo = root.getElementById('lo'); if (lo) lo.onclick = function () { self.doLogout(); };
        this.hidePageLoginControls();
        return;
      }
      var inner;
      if (this.access === 'loading') {
        inner = '<div class="card">' + this.logoBlock() + '<div class="title">' + esc(this.appName) + '</div><div class="sub">' + IC_SPIN + '</div></div>';
      } else if (this.access === 'denied') {
        inner = '<div class="card">' + this.logoBlock() + '<div class="title">Ingen tilgang</div>'
          + '<div class="sub">Kontoen ' + esc((this.me && this.me.email) || '') + ' har ikke tilgang til denne siden.</div>'
          + '<button class="gbtn" id="glo">Logg ut</button></div>';
      } else { // login
        var form;
        if (this.card === 'sent') {
          form = '<div class="gsent">' + IC_CHECK + '<div class="gh">Magisk lenke sendt!</div>'
            + '<div class="gp">Sjekk innboksen din' + (this.lastEmail ? ' på <b>' + esc(this.lastEmail) + '</b>' : '') + ' og klikk lenken for å logge inn.</div></div>'
            + '<button class="linkbtn" id="gagain">Prøv en annen e-post</button>';
        } else if (this.card === 'working') {
          form = '<button class="gbtn" disabled>' + IC_SPIN + esc(this.note || 'Sender…') + '</button>';
        } else {
          var reg = this.registerMode === 'open' ? '<button class="gbtn ghost" id="greg">Registrer ny konto</button>' : '';
          form = '<label class="glabel" for="gem">E-postadresse</label>'
            + '<div class="gfield">' + IC_MAIL + '<input class="gin" id="gem" type="email" placeholder="deg@epost.no" autocomplete="email" /></div>'
            + (this.note ? '<div class="gerr">' + esc(this.note) + '</div>' : '')
            + '<button class="gbtn" id="gsi">Send magisk lenke</button>' + reg;
        }
        inner = '<div class="card">' + this.logoBlock()
          + '<div class="title">Velkommen til ' + esc(this.appName) + '</div>'
          + '<div class="sub">Skriv inn e-posten din for å få en sikker påloggingslenke.</div>'
          + form
          + '<div class="gfoot">Ved å logge inn godtar du våre vilkår og personvernregler.</div></div>';
      }
      root.innerHTML = '<style>' + CSS + '</style><div class="gate">' + inner + '</div>';
      var gem = root.getElementById('gem');
      var gsi = root.getElementById('gsi'); if (gsi) gsi.onclick = function () { self.doSignIn(gem.value.trim()); };
      var greg = root.getElementById('greg'); if (greg) greg.onclick = function () { self.doRegister(gem.value.trim()); };
      if (gem) gem.onkeydown = function (e) { if (e.key === 'Enter') self.doSignIn(gem.value.trim()); };
      var gagain = root.getElementById('gagain'); if (gagain) gagain.onclick = function () { self.card = 'form'; self.note = ''; self.render(); };
      var glo = root.getElementById('glo'); if (glo) glo.onclick = function () { self.doLogout(); };
    }
  }

  if (!customElements.get('vegvisr-auth')) customElements.define('vegvisr-auth', VegvisrAuth);
  // Complete any magic-link return even if no <vegvisr-auth> element is on the page.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootOnce);
  else bootOnce();
})();
`
