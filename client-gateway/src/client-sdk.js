/**
 * Client Gateway SDK
 *
 * Import this in your main-account workers to interact with
 * any client account's KV, D1, and R2 via their gateway worker.
 *
 * Usage:
 *   import { ClientGateway, resolveClient } from './client-sdk.js';
 *
 *   // Option 1: Direct (if you know the URL)
 *   const client = new ClientGateway(gatewayUrl, secret);
 *   const data = await client.kvGet('user:123');
 *
 *   // Option 2: From D1 registry
 *   const client = await resolveClient(env, 'acme-corp');
 *   const data = await client.kvGet('user:123');
 */

export class ClientGateway {
  /**
   * @param {string} gatewayUrl - The client gateway worker URL
   * @param {string} secret - The shared gateway secret
   */
  constructor(gatewayUrl, secret) {
    this.url = gatewayUrl.replace(/\/$/, '');
    this.secret = secret;
  }

  async _fetch(path, method = 'GET', body = null, extraHeaders = {}) {
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: {
        'X-Gateway-Token': this.secret,
        ...extraHeaders,
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gateway ${method} ${path} failed (${res.status}): ${err}`);
    }

    return res;
  }

  async _json(path, method = 'GET', body = null, extraHeaders = {}) {
    const res = await this._fetch(path, method, body, extraHeaders);
    return res.json();
  }

  // ─── KV ──────────────────────────────────────

  async kvGet(key) {
    return this._json(`/kv/${encodeURIComponent(key)}`);
  }

  async kvPut(key, value, metadata) {
    const metaParam = metadata ? `?metadata=${encodeURIComponent(JSON.stringify(metadata))}` : '';
    return this._json(`/kv/${encodeURIComponent(key)}${metaParam}`, 'PUT', value);
  }

  async kvDelete(key) {
    return this._json(`/kv/${encodeURIComponent(key)}`, 'DELETE');
  }

  async kvList(prefix = '', limit = 1000) {
    return this._json(`/kv/list?prefix=${encodeURIComponent(prefix)}&limit=${limit}`, 'POST');
  }

  // ─── D1 ──────────────────────────────────────

  async d1Query(sql, params = []) {
    return this._json('/d1/query', 'POST', JSON.stringify({ sql, params }), {
      'Content-Type': 'application/json',
    });
  }

  // ─── R2 ──────────────────────────────────────

  async r2Get(key) {
    return this._fetch(`/r2/${encodeURIComponent(key)}`);
  }

  async r2Put(key, body, contentType = 'application/octet-stream') {
    return this._json(`/r2/${encodeURIComponent(key)}`, 'PUT', body, {
      'Content-Type': contentType,
    });
  }

  async r2Delete(key) {
    return this._json(`/r2/${encodeURIComponent(key)}`, 'DELETE');
  }

  async r2List(prefix = '', limit = 1000) {
    return this._json(`/r2/list?prefix=${encodeURIComponent(prefix)}&limit=${limit}`, 'POST');
  }

  // ─── Health ──────────────────────────────────

  async health() {
    const res = await fetch(`${this.url}/health`);
    return res.json();
  }
}

/**
 * Resolve a client from the D1 registry and return a ClientGateway instance.
 *
 * Expects:
 *   - env.vegvisr_org (D1 binding) — the main account's database with client_accounts table
 *   - env.CLIENT_GATEWAY_SECRETS — JSON string mapping client_id → secret
 *     Set via: npx wrangler secret put CLIENT_GATEWAY_SECRETS
 *     Value: {"acme-corp":"secret1","other-client":"secret2"}
 *
 * @param {object} env - Worker env bindings
 * @param {string} clientId - The client ID to look up
 * @returns {Promise<ClientGateway>}
 */
export async function resolveClient(env, clientId) {
  const db = env.vegvisr_org;
  if (!db) throw new Error('D1 binding vegvisr_org not available');

  const row = await db
    .prepare('SELECT gateway_url, status FROM client_accounts WHERE client_id = ?')
    .bind(clientId)
    .first();

  if (!row) throw new Error(`Client not found: ${clientId}`);
  if (row.status !== 'active') throw new Error(`Client ${clientId} is ${row.status}`);

  // Look up the secret for this client
  const secrets = JSON.parse(env.CLIENT_GATEWAY_SECRETS || '{}');
  const secret = secrets[clientId];
  if (!secret) throw new Error(`No gateway secret configured for client: ${clientId}`);

  return new ClientGateway(row.gateway_url, secret);
}
