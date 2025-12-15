/**
 * Security middleware for chat-history-worker
 * Protects against automated scanning and attacks
 */

// Blocked user agents (security scanners, bots)
const BLOCKED_USER_AGENTS = [
  'masscan',
  'zgrab',
  'nmap',
  'nikto',
  'sqlmap',
  'gobuster',
  'wpscan',
  'dirbuster'
]

// Suspicious headers that indicate automated scanning
const SUSPICIOUS_HEADERS = [
  'next-action',
  'x-nextjs-html-request-id',
  'x-nextjs-request-id',
  'next-router-state-tree'
]

// Rate limiting storage (in-memory for simple implementation)
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30 // 30 requests per minute per IP

/**
 * Check if IP is rate limited
 */
export function checkRateLimit(ip) {
  const now = Date.now()
  const key = `rate:${ip}`
  
  const existing = rateLimitMap.get(key)
  
  if (!existing) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
  }
  
  if (now > existing.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 }
  }
  
  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { 
      allowed: false, 
      remaining: 0,
      resetAt: existing.resetAt
    }
  }
  
  existing.count++
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_MAX_REQUESTS - existing.count 
  }
}

/**
 * Check if request is suspicious
 */
export function isSuspiciousRequest(request) {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || ''
  
  // Check for blocked user agents
  for (const blocked of BLOCKED_USER_AGENTS) {
    if (userAgent.includes(blocked.toLowerCase())) {
      return { suspicious: true, reason: 'Blocked user agent' }
    }
  }
  
  // Check for Next.js scanning headers
  for (const header of SUSPICIOUS_HEADERS) {
    if (request.headers.has(header)) {
      return { suspicious: true, reason: 'Next.js scanning attempt' }
    }
  }
  
  // Check for multipart form data without proper authentication
  const contentType = request.headers.get('content-type')?.toLowerCase() || ''
  if (contentType.includes('multipart/form-data')) {
    const hasAuth = request.headers.has('x-user-id') || 
                   request.headers.has('authorization') ||
                   request.headers.has('x-api-token')
    
    if (!hasAuth) {
      return { suspicious: true, reason: 'Unauthenticated multipart request' }
    }
  }
  
  return { suspicious: false }
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(request, env, reason) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown'
  const country = request.headers.get('cf-ipcountry') || 'unknown'
  const asn = request.cf?.asn || 'unknown'
  const asOrganization = request.cf?.asOrganization || 'unknown'
  
  console.warn('🚨 SUSPICIOUS REQUEST BLOCKED', {
    reason,
    ip,
    country,
    asn,
    asOrganization,
    path: new URL(request.url).pathname,
    method: request.method,
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date().toISOString()
  })
  
  // Optionally store in D1 for analysis
  try {
    await env.DB.prepare(`
      INSERT INTO security_logs (ip, country, asn, reason, path, method, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      ip,
      country,
      String(asn),
      reason,
      new URL(request.url).pathname,
      request.method,
      request.headers.get('user-agent')
    ).run()
  } catch (error) {
    // Fail silently if table doesn't exist
    console.error('Failed to log security event:', error.message)
  }
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimitMap() {
  const now = Date.now()
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}
