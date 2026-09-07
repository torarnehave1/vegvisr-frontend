// billing-worker — Stripe payment tiers for the Vegr.ai ECO system.
//
// Tiers (per person x World): World Founder (paid) / World Member (free seat) / Reader (free).
// Two payment surfaces:
//   Surface 1  platform charges the Founder (platform Stripe account)   <- Slice 3 (this file)
//   Surface 2  Founder charges their own audience via Stripe Connect    <- Slices 5-6
//
// Routed at https://api.vegvisr.org/billing/*  (see wrangler.toml).
// Plain single-file ES module. Stripe SDK via nodejs_compat + Fetch http client.

import Stripe from 'stripe'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Token, x-user-email, x-user-role',
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// Stripe client bound to the PLATFORM account (Surface 1). Fetch client is required in Workers.
function getStripe(env) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  })
}

// ISO string from a Stripe unix timestamp (seconds), or null.
const isoFromUnix = (s) => (s ? new Date(s * 1000).toISOString() : null)

// A buyer should return to the page they were on — a donor on ravner.vegvisr.org has no
// business landing on the main site. The page sends its own URL, but a caller-supplied
// redirect is an OPEN REDIRECT unless the host is checked: without this, anyone could use
// our Stripe account to bounce users to an arbitrary site from a trusted checkout flow.
// Returns a URL string safe to hand Stripe, or null to fall back to the configured default.
function safeReturnUrl(raw) {
  if (!raw || typeof raw !== 'string') return null
  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== 'https:') return null
  const h = u.hostname.toLowerCase()
  const allowed =
    h === 'vegvisr.org' || h.endsWith('.vegvisr.org') || h === 'vegr.ai' || h.endsWith('.vegr.ai')
  if (!allowed) return null
  u.hash = '' // Stripe returns to the URL verbatim; a fragment would hide our query params
  return u.toString()
}

// Append our checkout params WITHOUT encoding Stripe's {CHECKOUT_SESSION_ID} template —
// URLSearchParams would percent-encode the braces and Stripe would return the literal string.
function withCheckoutParams(base, outcome, includeSession) {
  const sep = base.includes('?') ? '&' : '?'
  return (
    base + sep + `vegvisr_checkout=${outcome}` + (includeSession ? '&session_id={CHECKOUT_SESSION_ID}' : '')
  )
}

// ---------------------------------------------------------------------------
// AUTH SEAM — the ONE place identity is read.
// Auth is being rewritten; when the new scheme lands, change ONLY this function.
// Today it trusts the attribution headers the rest of the platform already sends.
// Returns { email, role } or null.
// ---------------------------------------------------------------------------
function getIdentity(request) {
  const email = request.headers.get('x-user-email')
  const role = request.headers.get('x-user-role') || 'User'
  if (!email) return null
  return { email, role }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    if (method === 'OPTIONS') return new Response(null, { headers: CORS })

    try {
      if (path === '/billing/health' && method === 'GET') {
        return json({ ok: true, worker: 'billing-worker' })
      }
      if (path === '/billing/plans' && method === 'GET') {
        return await handlePlans(env)
      }
      if (path === '/billing/checkout/founder' && method === 'POST') {
        return await handleFounderCheckout(request, env)
      }
      if (path === '/billing/products' && method === 'GET') {
        return await handleProducts(env)
      }
      if (path === '/billing/checkout/product' && method === 'POST') {
        return await handleProductCheckout(request, env)
      }
      if (path === '/billing/orders' && method === 'GET') {
        return await handleOrderList(request, env)
      }
      if (path === '/billing/subscriptions' && method === 'GET') {
        return await handleProductSubscriptionList(request, env)
      }
      if (path === '/billing/admin/stripe-prices' && method === 'GET') {
        return await handleStripePriceList(request, env)
      }
      if (path === '/billing/admin/products' && method === 'POST') {
        return await handleAdminSetProduct(request, env)
      }
      if (path === '/billing/webhook' && method === 'POST') {
        return await handlePlatformWebhook(request, env)
      }
      if (path === '/billing/seats' && method === 'GET') {
        return await handleSeatList(request, env)
      }
      if (path === '/billing/seats/invite' && method === 'POST') {
        return await handleSeatInvite(request, env)
      }
      if (path === '/billing/seats/revoke' && method === 'POST') {
        return await handleSeatRevoke(request, env)
      }
      if (path === '/billing/founder/connect/onboard' && method === 'POST') {
        return await handleConnectOnboard(request, env)
      }
      if (path === '/billing/founder/connect/status' && method === 'GET') {
        return await handleConnectStatus(request, env)
      }
      return json({ error: 'Not found', path }, 404)
    } catch (err) {
      console.error('billing-worker error:', err)
      return json({ error: 'Internal server error', details: err.message }, 500)
    }
  },
}

// GET /billing/plans — public list of active platform plans (Surface 1).
async function handlePlans(env) {
  const { results } = await env.vegvisr_org
    .prepare(
      `SELECT id, tier, name, stripe_price_id, included_seats,
              price_nok, price_usd, currency, interval
         FROM subscription_plans
        WHERE active = 1
        ORDER BY price_nok ASC`,
    )
    .all()
  return json({ plans: results || [] })
}

// POST /billing/checkout/founder — Surface 1. A World Founder subscribes to a platform plan.
// Body: { plan_id, world_id? }. Identity (founder email) comes from getIdentity().
// Returns { url } — a Stripe Checkout Session to redirect the Founder to.
async function handleFounderCheckout(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)

  const body = await request.json().catch(() => ({}))
  const planId = body.plan_id
  const worldId = body.world_id || null
  if (!planId) return json({ error: 'Missing plan_id' }, 400)

  const plan = await env.vegvisr_org
    .prepare(`SELECT id, stripe_price_id, included_seats FROM subscription_plans WHERE id = ? AND active = 1`)
    .bind(planId)
    .first()
  if (!plan) return json({ error: 'Plan not found or inactive' }, 404)
  if (!plan.stripe_price_id) {
    return json({ error: 'Plan has no stripe_price_id — set it before selling this plan' }, 409)
  }

  const stripe = getStripe(env)

  // Reuse an existing Stripe customer for this founder if we've seen one; else create.
  const priorCustomer = await env.vegvisr_org
    .prepare(
      `SELECT stripe_customer_id FROM subscriptions
        WHERE founder_email = ? AND stripe_customer_id IS NOT NULL
        ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(identity.email)
    .first()

  let customerId = priorCustomer?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: identity.email,
      metadata: { founder_email: identity.email },
    })
    customerId = customer.id
  }

  // Metadata is copied onto the subscription, so the webhook can write our row.
  const meta = {
    founder_email: identity.email,
    plan_id: plan.id,
    world_id: worldId || '',
    included_seats: String(plan.included_seats ?? 0),
  }

  const sessionParams = {
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    client_reference_id: identity.email,
    metadata: meta,
    subscription_data: { metadata: meta },
    success_url: env.CHECKOUT_SUCCESS_URL || 'https://www.vegvisr.org/billing/success',
    cancel_url: env.CHECKOUT_CANCEL_URL || 'https://www.vegvisr.org/billing/cancel',
    payment_method_collection: 'if_required', // skip card entry when nothing is owed
  }

  // A Superadmin may pre-apply a coupon (comp / zero-cost verification). `discounts` and
  // `allow_promotion_codes` are mutually exclusive in Checkout — choose one.
  if (identity.role === 'Superadmin' && body.coupon) {
    sessionParams.discounts = [{ coupon: body.coupon }]
    // Explicit false, not omission: the account's Checkout default enables promotion codes,
    // which would collide with `discounts`. Same defect found live on the product path.
    sessionParams.allow_promotion_codes = false
  } else {
    sessionParams.allow_promotion_codes = true
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  return json({ url: session.url, session_id: session.id })
}

// ---------------------------------------------------------------------------
// One-time products (Surface 1, `mode: 'payment'`). Unlike founder checkout,
// these are PUBLIC: a buyer needs no Vegvisr account, so identity is optional.
// ---------------------------------------------------------------------------

// GET /billing/products — public list of active one-time products.
async function handleProducts(env) {
  const { results } = await env.vegvisr_org
    .prepare(
      `SELECT id, name, description, stripe_price_id, kind, currency, price_nok, grants
         FROM products
        WHERE active = 1
        ORDER BY created_at ASC`,
    )
    .all()
  return json({ products: results || [] })
}

// POST /billing/checkout/product — Body: { product_id, quantity?, email?, world_id? }.
// Returns { url } — a one-time Stripe Checkout Session.
async function handleProductCheckout(request, env) {
  const body = await request.json().catch(() => ({}))
  const productId = body.product_id
  if (!productId) return json({ error: 'Missing product_id' }, 400)

  const product = await env.vegvisr_org
    .prepare(`SELECT id, name, stripe_price_id, kind, grants FROM products WHERE id = ? AND active = 1`)
    .bind(productId)
    .first()
  if (!product) return json({ error: 'Product not found or inactive' }, 404)
  if (!product.stripe_price_id) {
    return json({ error: 'Product has no stripe_price_id — set it before selling this product' }, 409)
  }

  // Identity is a nicety here (prefills Checkout, links the order); anonymous buyers pass.
  const identity = getIdentity(request)
  const buyerEmail = (body.email || identity?.email || '').trim().toLowerCase()
  const worldId = body.world_id || null

  // A custom_unit_amount price carries no unit amount, so multiplying it is meaningless.
  // A recurring supporter tier is likewise one unit — quantity there would mean "N memberships".
  const quantity =
    product.kind === 'custom_amount' || product.kind === 'recurring'
      ? 1
      : Math.min(Math.max(parseInt(body.quantity, 10) || 1, 1), 99)

  const recurring = product.kind === 'recurring'
  const stripe = getStripe(env)

  // Return the buyer to the page they started on when it is a page we own; otherwise
  // fall back to the site-wide billing pages.
  const back = safeReturnUrl(body.return_url)
  const successUrl = back
    ? withCheckoutParams(back, 'success', true)
    : env.CHECKOUT_SUCCESS_URL || 'https://www.vegvisr.org/billing/success'
  const cancelUrl = back
    ? withCheckoutParams(back, 'cancel', false)
    : env.CHECKOUT_CANCEL_URL || 'https://www.vegvisr.org/billing/cancel'

  // Metadata is copied onto the PaymentIntent, so the webhook can write our row
  // even if it arrives before/without the session we recorded below.
  const meta = {
    product_id: product.id,
    buyer_email: buyerEmail,
    world_id: worldId || '',
    grants: product.grants || '',
  }

  // Params legal in ONE mode only — verified against the installed SDK's own docs:
  //   submit_type        "can only be specified on Checkout Sessions in `payment` mode"
  //   customer_creation  "Can only be set in `payment` and `setup` mode"
  //   payment_intent_data  payment mode; subscription mode carries metadata on the Subscription
  // Sending either in subscription mode is an API error, so they are spread in, not defaulted.
  const modeParams = recurring
    ? {
        mode: 'subscription',
        subscription_data: { metadata: meta },
      }
    : {
        mode: 'payment',
        customer_creation: 'always', // payment mode does not create a Customer by default
        payment_intent_data: { metadata: meta },
        submit_type: product.kind === 'custom_amount' ? 'donate' : 'pay',
      }

  const session = await stripe.checkout.sessions.create({
    ...modeParams,
    line_items: [{ price: product.stripe_price_id, quantity }],
    ...(buyerEmail ? { customer_email: buyerEmail, client_reference_id: buyerEmail } : {}),
    metadata: meta,
    // Stripe rejects promotion codes on a custom_unit_amount price ("You cannot enable
    // promotion codes when using a price with `custom_unit_amount` configured") — there is
    // no fixed amount to discount. OMITTING the param is not enough: the account's Checkout
    // default turns it on, so it must be sent as an explicit false. Verified live 2026-08-13.
    allow_promotion_codes: product.kind !== 'custom_amount',
    success_url: successUrl,
    cancel_url: cancelUrl,
  })

  // Record the intent up front so abandoned checkouts stay visible as 'pending'.
  if (recurring) {
    await env.vegvisr_org
      .prepare(
        `INSERT INTO product_subscriptions
           (id, product_id, stripe_session_id, buyer_email, status, world_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
         ON CONFLICT(stripe_session_id) DO NOTHING`,
      )
      .bind(`psub_${session.id}`, product.id, session.id, buyerEmail || null, worldId)
      .run()
  } else {
    await env.vegvisr_org
      .prepare(
        `INSERT INTO orders
           (id, product_id, stripe_session_id, buyer_email, quantity, status, world_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
         ON CONFLICT(stripe_session_id) DO NOTHING`,
      )
      .bind(`ord_${session.id}`, product.id, session.id, buyerEmail || null, quantity, worldId)
      .run()
  }

  return json({ url: session.url, session_id: session.id, mode: recurring ? 'subscription' : 'payment' })
}

// GET /billing/orders — the caller's own orders; a Superadmin sees all.
async function handleOrderList(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)

  const stmt =
    identity.role === 'Superadmin'
      ? env.vegvisr_org.prepare(
          `SELECT id, product_id, stripe_session_id, buyer_email, amount_total, currency,
                  quantity, status, world_id, created_at
             FROM orders ORDER BY created_at DESC LIMIT 100`,
        )
      : env.vegvisr_org
          .prepare(
            `SELECT id, product_id, stripe_session_id, buyer_email, amount_total, currency,
                    quantity, status, world_id, created_at
               FROM orders WHERE buyer_email = ? ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(identity.email)

  const { results } = await stmt.all()
  return json({ orders: results || [] })
}

// GET /billing/subscriptions — the caller's own supporter subscriptions; Superadmin sees all.
// Distinct from the Founder-plan `subscriptions` table exposed nowhere here.
async function handleProductSubscriptionList(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)

  const cols = `id, product_id, stripe_session_id, stripe_subscription_id, buyer_email,
                status, current_period_end, world_id, created_at`
  const stmt =
    identity.role === 'Superadmin'
      ? env.vegvisr_org.prepare(
          `SELECT ${cols} FROM product_subscriptions ORDER BY created_at DESC LIMIT 100`,
        )
      : env.vegvisr_org
          .prepare(
            `SELECT ${cols} FROM product_subscriptions WHERE buyer_email = ?
              ORDER BY created_at DESC LIMIT 100`,
          )
          .bind(identity.email)

  const { results } = await stmt.all()
  return json({ subscriptions: results || [] })
}

// ---------------------------------------------------------------------------
// Admin — CATALOG ONLY. These endpoints decide what is SOLD, never what it COSTS.
// Nothing here calls stripe.products.create or stripe.prices.create: products and
// prices are created by a human in the Stripe dashboard. A price is the one thing
// that cannot be quietly undone once a customer has bought at it.
// ---------------------------------------------------------------------------

function requireSuperadmin(request) {
  const identity = getIdentity(request)
  if (!identity) return { error: json({ error: 'Unauthorized' }, 401) }
  if (String(identity.role).toLowerCase() !== 'superadmin') {
    return { error: json({ error: `Superadmin role required. Caller role: ${identity.role}` }, 403) }
  }
  return { identity }
}

// Derive our catalog `kind` from what the Stripe price actually IS, so the two can
// never disagree. A mismatch here surfaces at checkout as an opaque Stripe error.
function kindForPrice(price) {
  if (price.recurring) return 'recurring'
  if (price.custom_unit_amount) return 'custom_amount'
  return 'fixed'
}

// GET /billing/admin/stripe-prices — read-only view of what exists in Stripe, so the
// catalog can be filled in without anyone retyping a price id.
async function handleStripePriceList(request, env) {
  const gate = requireSuperadmin(request)
  if (gate.error) return gate.error

  const stripe = getStripe(env)
  const list = await stripe.prices.list({ limit: 100, active: true, expand: ['data.product'] })
  const prices = list.data.map((p) => ({
    stripe_price_id: p.id,
    product_name: typeof p.product === 'object' ? p.product?.name : null,
    product_description: typeof p.product === 'object' ? p.product?.description : null,
    currency: p.currency,
    unit_amount: p.unit_amount, // minor units; null for custom_unit_amount prices
    custom_amount: !!p.custom_unit_amount,
    recurring_interval: p.recurring?.interval || null,
    kind: kindForPrice(p),
    livemode: p.livemode,
  }))
  return json({ prices })
}

// POST /billing/admin/products — upsert ONE catalog row. Body:
// { id, name, stripe_price_id, description?, kind?, price_nok?, grants?, active? }
// `kind` is derived from the Stripe price unless explicitly given, and an explicit
// value that contradicts the price is refused rather than silently corrected.
async function handleAdminSetProduct(request, env) {
  const gate = requireSuperadmin(request)
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const id = (body.id || '').trim()
  const priceId = (body.stripe_price_id || '').trim()
  if (!id || !priceId) return json({ error: 'id and stripe_price_id are required' }, 400)

  // The price must exist. Selling a product whose price id is a typo produces an
  // error only when a real buyer clicks — check it now instead.
  const stripe = getStripe(env)
  let price
  try {
    price = await stripe.prices.retrieve(priceId)
  } catch (err) {
    return json({ error: `Stripe price ${priceId} not found: ${err.message}` }, 404)
  }
  if (!price.active) return json({ error: `Stripe price ${priceId} is not active` }, 409)

  const derived = kindForPrice(price)
  if (body.kind && body.kind !== derived) {
    return json(
      {
        error: `kind '${body.kind}' contradicts the Stripe price, which is '${derived}'. ` +
          `A recurring price cannot be sold in payment mode, and a one-time price cannot be sold in subscription mode.`,
        stripe_price_id: priceId,
        derived_kind: derived,
      },
      409,
    )
  }
  const kind = derived
  const name = (body.name || '').trim() || (typeof price.product === 'string' ? id : 'Untitled product')
  const active = body.active === undefined ? 1 : body.active ? 1 : 0

  await env.vegvisr_org
    .prepare(
      `INSERT INTO products
         (id, name, description, stripe_price_id, kind, currency, price_nok, grants, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name            = excluded.name,
         description     = COALESCE(excluded.description, products.description),
         stripe_price_id = excluded.stripe_price_id,
         kind            = excluded.kind,
         currency        = excluded.currency,
         price_nok       = COALESCE(excluded.price_nok, products.price_nok),
         grants          = COALESCE(excluded.grants, products.grants),
         active          = excluded.active`,
    )
    .bind(
      id,
      name,
      body.description || null,
      priceId,
      kind,
      price.currency || 'nok',
      body.price_nok ?? (price.unit_amount != null ? Math.round(price.unit_amount / 100) : null),
      body.grants || null,
      active,
    )
    .run()

  const row = await env.vegvisr_org
    .prepare(`SELECT id, name, description, stripe_price_id, kind, currency, price_nok, grants, active
                FROM products WHERE id = ?`)
    .bind(id)
    .first()
  return json({ ok: true, product: row, derived_kind: kind })
}

// POST /billing/webhook — Surface 1 platform events. Verified with constructEventAsync
// (sync constructEvent fails in Workers — WebCrypto is async). Idempotent via stripe_events.
async function handlePlatformWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, 500)

  const sig = request.headers.get('stripe-signature')
  if (!sig) return json({ error: 'Missing stripe-signature' }, 400)

  const raw = await request.text()
  const stripe = getStripe(env)
  const cryptoProvider = Stripe.createSubtleCryptoProvider()

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(
      raw,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return json({ error: 'Invalid signature' }, 400)
  }

  // Idempotency: first writer wins. INSERT OR IGNORE — if 0 rows written, already handled.
  const ins = await env.vegvisr_org
    .prepare(`INSERT OR IGNORE INTO stripe_events (event_id, type, surface) VALUES (?, ?, 'platform')`)
    .bind(event.id, event.type)
    .run()
  if (!ins.meta.changes) {
    return json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          // A public supporter (product_id in metadata) is NOT a World Founder buying a
          // platform plan — route it away from `subscriptions`, whose rows drive seat accounting.
          if (sub.metadata?.product_id || session.metadata?.product_id) {
            await upsertProductSubscription(env, sub, session.id)
          } else {
            await upsertSubscription(env, sub)
          }
        } else if (session.mode === 'payment') {
          await upsertOrder(env, session)
        }
        break
      }
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        // Delayed methods settle after completion; expiry closes out an abandoned session.
        if (event.data.object.mode === 'payment') await upsertOrder(env, event.data.object)
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Same fork as above: these events carry no session, so metadata is the only signal.
        const sub = event.data.object
        if (sub.metadata?.product_id) {
          await upsertProductSubscription(env, sub, null)
        } else {
          await upsertSubscription(env, sub)
        }
        break
      }
      default:
        // Unhandled event types are acknowledged (already recorded in stripe_events).
        break
    }
  } catch (err) {
    // The idempotency row was claimed BEFORE the handler ran, so leaving it in place would
    // make Stripe's retry short-circuit as a duplicate and the write would be lost forever.
    // Release the claim so the retry actually re-processes this event.
    console.error(`Handler error for ${event.type}:`, err.message)
    await env.vegvisr_org
      .prepare(`DELETE FROM stripe_events WHERE event_id = ?`)
      .bind(event.id)
      .run()
      .catch(() => {})
    return json({ error: 'Handler failed', details: err.message }, 500)
  }

  return json({ received: true })
}

// Upsert one platform-side subscription row from a Stripe Subscription object.
async function upsertSubscription(env, sub) {
  const meta = sub.metadata || {}
  const status = sub.status === 'canceled' ? 'canceled' : sub.status // active|trialing|past_due|canceled|...
  const seats = meta.included_seats ? parseInt(meta.included_seats, 10) : 0
  const rowId = `bsub_${sub.id}`

  await env.vegvisr_org
    .prepare(
      `INSERT INTO subscriptions
         (id, founder_email, world_id, plan_id, stripe_customer_id, stripe_subscription_id,
          status, seats_total, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(stripe_subscription_id) DO UPDATE SET
         status = excluded.status,
         current_period_end = excluded.current_period_end,
         plan_id = COALESCE(excluded.plan_id, subscriptions.plan_id),
         world_id = COALESCE(NULLIF(excluded.world_id, ''), subscriptions.world_id),
         seats_total = excluded.seats_total,
         updated_at = datetime('now')`,
    )
    .bind(
      rowId,
      meta.founder_email || '',
      meta.world_id || null,
      meta.plan_id || null,
      typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null,
      sub.id,
      status,
      seats,
      isoFromUnix(sub.current_period_end),
    )
    .run()
}

// Upsert one order row from a completed/settled one-time Checkout Session.
// Keyed on stripe_session_id, so the checkout-time 'pending' row and this update converge.
async function upsertOrder(env, session) {
  const meta = session.metadata || {}
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
  const status = paid ? 'paid' : session.status === 'expired' ? 'failed' : 'pending'
  const email =
    (session.customer_details?.email || session.customer_email || meta.buyer_email || '')
      .toLowerCase() || null

  await env.vegvisr_org
    .prepare(
      `INSERT INTO orders
         (id, product_id, stripe_session_id, stripe_payment_intent_id, stripe_customer_id,
          buyer_email, amount_total, currency, quantity, status, world_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(stripe_session_id) DO UPDATE SET
         product_id               = COALESCE(orders.product_id, excluded.product_id),
         stripe_payment_intent_id = COALESCE(excluded.stripe_payment_intent_id, orders.stripe_payment_intent_id),
         stripe_customer_id       = COALESCE(excluded.stripe_customer_id, orders.stripe_customer_id),
         buyer_email              = COALESCE(excluded.buyer_email, orders.buyer_email),
         amount_total             = excluded.amount_total,
         currency                 = excluded.currency,
         status                   = excluded.status,
         world_id                 = COALESCE(orders.world_id, excluded.world_id),
         updated_at               = datetime('now')`,
    )
    .bind(
      `ord_${session.id}`,
      meta.product_id || null,
      session.id,
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null,
      typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
      email,
      session.amount_total ?? null,
      session.currency || null,
      status,
      meta.world_id || null,
    )
    .run()
}

// Upsert one PUBLIC supporter subscription (products.kind='recurring').
// Converges on the row written at checkout time: the session id is known then, the
// subscription id only now, so match on either and fill in whichever is missing.
async function upsertProductSubscription(env, sub, sessionId) {
  const meta = sub.metadata || {}
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || null
  const email = (meta.buyer_email || '').toLowerCase() || null

  // Claim the pending checkout row if we can still see it by session id.
  if (sessionId) {
    await env.vegvisr_org
      .prepare(
        `UPDATE product_subscriptions
            SET stripe_subscription_id = ?, stripe_customer_id = ?, status = ?,
                current_period_end = ?, updated_at = datetime('now')
          WHERE stripe_session_id = ?`,
      )
      .bind(sub.id, customerId, sub.status, isoFromUnix(sub.current_period_end), sessionId)
      .run()
  }

  // Then upsert on the subscription id, so lifecycle events with no session still land.
  await env.vegvisr_org
    .prepare(
      `INSERT INTO product_subscriptions
         (id, product_id, stripe_session_id, stripe_subscription_id, stripe_customer_id,
          buyer_email, status, current_period_end, world_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(stripe_subscription_id) DO UPDATE SET
         product_id         = COALESCE(product_subscriptions.product_id, excluded.product_id),
         stripe_customer_id = COALESCE(excluded.stripe_customer_id, product_subscriptions.stripe_customer_id),
         buyer_email        = COALESCE(excluded.buyer_email, product_subscriptions.buyer_email),
         status             = excluded.status,
         current_period_end = excluded.current_period_end,
         updated_at         = datetime('now')`,
    )
    .bind(
      `psub_${sub.id}`,
      meta.product_id || null,
      sessionId,
      sub.id,
      customerId,
      email,
      sub.status,
      isoFromUnix(sub.current_period_end),
      meta.world_id || null,
    )
    .run()
}

// ---------------------------------------------------------------------------
// Slice 4 — Seats. A Founder assigns the World Member seats bundled in their plan.
// ---------------------------------------------------------------------------

// The Founder's current billable subscription (active or trialing), newest first.
async function founderActiveSubscription(env, email) {
  return await env.vegvisr_org
    .prepare(
      `SELECT id, world_id, seats_total FROM subscriptions
        WHERE founder_email = ? AND status IN ('active','trialing')
        ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(email)
    .first()
}

// GET /billing/seats — roster + used/available counts for the caller's subscription.
async function handleSeatList(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)
  const sub = await founderActiveSubscription(env, identity.email)
  if (!sub) return json({ error: 'No active subscription' }, 403)

  const { results } = await env.vegvisr_org
    .prepare(
      `SELECT member_email, status, world_id, invited_at, activated_at
         FROM world_seats WHERE subscription_id = ? ORDER BY invited_at DESC`,
    )
    .bind(sub.id)
    .all()
  const seats = results || []
  const used = seats.filter((s) => s.status === 'active').length
  return json({
    seats_total: sub.seats_total,
    seats_used: used,
    seats_available: sub.seats_total - used,
    seats,
  })
}

// POST /billing/seats/invite {member_email, world_id?} — grant an active seat (idempotent).
async function handleSeatInvite(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)
  const body = await request.json().catch(() => ({}))
  const memberEmail = (body.member_email || '').trim().toLowerCase()
  if (!memberEmail) return json({ error: 'Missing member_email' }, 400)

  const sub = await founderActiveSubscription(env, identity.email)
  if (!sub) return json({ error: 'No active subscription' }, 403)
  const worldId = body.world_id || sub.world_id || null

  const existing = await env.vegvisr_org
    .prepare(`SELECT id, status FROM world_seats WHERE subscription_id = ? AND member_email = ?`)
    .bind(sub.id, memberEmail)
    .first()
  if (existing && existing.status === 'active') {
    return json({ ok: true, already: true, member_email: memberEmail, status: 'active' })
  }

  // Capacity check counts currently-active seats; reactivation still consumes one.
  const cnt = await env.vegvisr_org
    .prepare(`SELECT COUNT(*) AS n FROM world_seats WHERE subscription_id = ? AND status = 'active'`)
    .bind(sub.id)
    .first()
  if ((cnt?.n || 0) >= sub.seats_total) {
    return json({ error: 'Seat limit reached', seats_total: sub.seats_total }, 409)
  }

  const seatId = existing?.id || `seat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  await env.vegvisr_org
    .prepare(
      `INSERT INTO world_seats (id, subscription_id, world_id, member_email, status, invited_at, activated_at)
       VALUES (?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
       ON CONFLICT(subscription_id, member_email) DO UPDATE SET
         status = 'active',
         world_id = COALESCE(excluded.world_id, world_seats.world_id),
         activated_at = datetime('now')`,
    )
    .bind(seatId, sub.id, worldId, memberEmail)
    .run()

  return json({ ok: true, member_email: memberEmail, status: 'active' })
}

// POST /billing/seats/revoke {member_email} — free the seat (frees capacity).
async function handleSeatRevoke(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)
  const body = await request.json().catch(() => ({}))
  const memberEmail = (body.member_email || '').trim().toLowerCase()
  if (!memberEmail) return json({ error: 'Missing member_email' }, 400)

  const sub = await founderActiveSubscription(env, identity.email)
  if (!sub) return json({ error: 'No active subscription' }, 403)

  const res = await env.vegvisr_org
    .prepare(
      `UPDATE world_seats SET status = 'revoked'
        WHERE subscription_id = ? AND member_email = ? AND status != 'revoked'`,
    )
    .bind(sub.id, memberEmail)
    .run()
  return json({ ok: true, revoked: res.meta.changes })
}

// ---------------------------------------------------------------------------
// Slice 5 — Surface 2 Connect onboarding. A Founder connects their OWN Stripe
// (Express connected account) so they can later charge their own audience.
// ---------------------------------------------------------------------------

// POST /billing/founder/connect/onboard {world_id?} — create/reuse a connected
// account and return a hosted onboarding link.
async function handleConnectOnboard(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)
  const body = await request.json().catch(() => ({}))
  const worldId = body.world_id || null
  const stripe = getStripe(env)

  const existing = await env.vegvisr_org
    .prepare(
      `SELECT id, stripe_account_id FROM connect_accounts
        WHERE founder_email = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(identity.email)
    .first()

  let accountId = existing?.stripe_account_id
  if (!accountId) {
    // Connect is a SEPARATE path from registration. Do NOT pass the Vegvisr login
    // email to Stripe — Stripe collects the account's own email during onboarding.
    // Our only link is founder_email (identity) <-> stripe_account_id, in metadata + the row.
    const acct = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { founder_email: identity.email, world_id: worldId || '' },
    })
    accountId = acct.id
    const feePct = parseFloat(env.DEFAULT_APPLICATION_FEE_PERCENT || '10')
    const id = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    await env.vegvisr_org
      .prepare(
        `INSERT INTO connect_accounts
           (id, founder_email, world_id, stripe_account_id, application_fee_percent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .bind(id, identity.email, worldId, accountId, feePct)
      .run()
  }

  const base = env.CONNECT_RETURN_BASE || 'https://www.vegvisr.org/billing'
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/connect/refresh`,
    return_url: `${base}/connect/return`,
    type: 'account_onboarding',
  })
  return json({ url: link.url, stripe_account_id: accountId })
}

// GET /billing/founder/connect/status — retrieve the connected account and sync flags.
async function handleConnectStatus(request, env) {
  const identity = getIdentity(request)
  if (!identity) return json({ error: 'Unauthorized' }, 401)
  const row = await env.vegvisr_org
    .prepare(
      `SELECT id, stripe_account_id, application_fee_percent FROM connect_accounts
        WHERE founder_email = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(identity.email)
    .first()
  if (!row) return json({ connected: false })

  const stripe = getStripe(env)
  const acct = await stripe.accounts.retrieve(row.stripe_account_id)
  await env.vegvisr_org
    .prepare(
      `UPDATE connect_accounts SET charges_enabled = ?, payouts_enabled = ?, updated_at = datetime('now')
        WHERE id = ?`,
    )
    .bind(acct.charges_enabled ? 1 : 0, acct.payouts_enabled ? 1 : 0, row.id)
    .run()

  return json({
    connected: true,
    stripe_account_id: row.stripe_account_id,
    application_fee_percent: row.application_fee_percent,
    charges_enabled: acct.charges_enabled,
    payouts_enabled: acct.payouts_enabled,
    details_submitted: acct.details_submitted,
  })
}

export { getIdentity } // exported for future auth wiring / tests
