/**
 * coaching-report-worker
 *
 * CORS proxy in front of the Enkel endring CMS (sms.heinekolltveit.com/api.php).
 * The CMS sends no CORS headers, so the browser cannot call it directly. This
 * worker adds CORS, keeps the shared `secret` server-side (VEGVISR_SECRET), and
 * exposes two routes on api.vegvisr.org:
 *
 *   GET  /coaching/samtaler[?status=Planlagt]   -> vegvisr_hent_samtaler
 *   POST /coaching/rapport   (JSON or form body) -> vegvisr_send_rapport
 *
 * Separate worker — does NOT touch the user's sms-worker.
 */

const CMS_BASE = 'https://sms.heinekolltveit.com/api.php';

// The CMS sits behind Cloudflare bot protection; worker-origin requests get
// challenged unless they look like a normal browser. Send browser-like headers.
const UPSTREAM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.8',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function passthrough(text, status) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (!env.VEGVISR_SECRET) {
      return json({ feil: 'VEGVISR_SECRET er ikke konfigurert på worker' }, 500);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/coaching\/?/, '');

    try {
      // GET /coaching/whoami -> diagnostic: which egress IP does the upstream see?
      if (path === 'whoami' && request.method === 'GET') {
        const r = await fetch('https://api.ipify.org?format=json', { headers: UPSTREAM_HEADERS });
        const ip = await r.text();
        const trace = await (await fetch('https://www.cloudflare.com/cdn-cgi/trace')).text();
        return json({ ipify: ip, trace });
      }

      // GET /coaching/samtaler -> vegvisr_hent_samtaler
      if (path === 'samtaler' && request.method === 'GET') {
        const target = new URL(CMS_BASE);
        target.searchParams.set('handling', 'vegvisr_hent_samtaler');
        target.searchParams.set('secret', env.VEGVISR_SECRET);
        const status = url.searchParams.get('status');
        if (status) target.searchParams.set('status', status);

        const res = await fetch(target.toString(), {
          method: 'GET',
          headers: UPSTREAM_HEADERS,
        });
        return passthrough(await res.text(), res.status);
      }

      // POST /coaching/rapport -> vegvisr_send_rapport
      if (path === 'rapport' && request.method === 'POST') {
        const target = new URL(CMS_BASE);
        target.searchParams.set('handling', 'vegvisr_send_rapport');
        target.searchParams.set('secret', env.VEGVISR_SECRET);

        // Accept JSON or form input; the CMS expects x-www-form-urlencoded.
        const ct = request.headers.get('Content-Type') || '';
        let params;
        if (ct.includes('application/json')) {
          const data = await request.json();
          params = new URLSearchParams();
          for (const [k, v] of Object.entries(data)) {
            if (v !== null && v !== undefined) params.set(k, String(v));
          }
        } else {
          params = new URLSearchParams(await request.text());
        }

        const res = await fetch(target.toString(), {
          method: 'POST',
          headers: { ...UPSTREAM_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        });
        return passthrough(await res.text(), res.status);
      }

      return json({ feil: 'Ukjent rute', path, method: request.method }, 404);
    } catch (err) {
      return json({ feil: 'Proxy-feil: ' + (err && err.message ? err.message : String(err)) }, 502);
    }
  },
};
