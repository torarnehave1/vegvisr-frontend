/**
 * schedule.js — VEGR Flows phase 2: when does a scheduled flow run next?
 *
 * A schedule trigger in the flow node is a standard 5-field cron expression read in a time zone
 * (default Europe/Oslo), because "every morning at 07" means 07 where the owner lives — summer
 * and winter time included. Cloudflare's own cron is UTC only and capped at 250 per account, so
 * flows-worker has ONE minute-cron and keeps every flow's next run in D1 (flow_triggers).
 *
 *   { "id": "t_morgen", "type": "schedule", "cron": "0 7 * * *", "timezone": "Europe/Oslo" }
 *
 * Fields: minute hour day-of-month month day-of-week (0 or 7 = Sunday). Each field takes *, a
 * number, a range a-b, a list a,b,c and a step (*\/15, 8-18/2). As in standard cron, when both
 * day-of-month and day-of-week are restricted, a day matching EITHER one runs.
 */

export const DEFAULT_TIMEZONE = 'Europe/Oslo'
const FIELDS = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day of week', min: 0, max: 7 },
]

function parseField(text, { name, min, max }) {
  const set = new Set()
  for (const part of String(text).split(',')) {
    const m = part.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/)
    if (!m) throw new Error(`"${part}" is not a valid ${name}`)
    let lo = min
    let hi = max
    if (m[1] !== '*') {
      const [a, b] = m[1].split('-').map(Number)
      lo = a
      hi = b ?? (m[2] ? max : a)
    }
    const step = m[2] ? Number(m[2]) : 1
    if (lo < min || hi > max || lo > hi || step < 1) throw new Error(`"${part}" is outside ${name} ${min}–${max}`)
    for (let v = lo; v <= hi; v += step) set.add(v)
  }
  return set
}

/** Parse a cron expression, or throw with a readable reason. */
export function parseCron(expr) {
  const parts = String(expr || '').trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`a schedule needs 5 fields (minute hour day month weekday), got "${expr}"`)
  const [minute, hour, dom, month, dow] = parts.map((p, i) => parseField(p, FIELDS[i]))
  if (dow.has(7)) dow.add(0)
  return { minute, hour, dom, month, dow, domAny: parts[2] === '*', dowAny: parts[4] === '*' }
}

/** Is this time zone one the runtime knows? */
export function validTimezone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const fmtCache = new Map()
function localParts(date, tz) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' })
    fmtCache.set(tz, f)
  }
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]))
  return { month: Number(p.month), day: Number(p.day), hour: Number(p.hour) % 24, minute: Number(p.minute), weekday: WEEKDAY[p.weekday] }
}

/**
 * The first minute strictly after `after` that the schedule matches, in its time zone, as a Date.
 * Skips whole hours and days that cannot match, so even a yearly schedule is found quickly.
 * Returns null when nothing matches within 400 days (e.g. 31 February).
 */
export function nextRun(expr, tz = DEFAULT_TIMEZONE, after = new Date()) {
  const c = typeof expr === 'string' ? parseCron(expr) : expr
  let t = Math.floor(after.getTime() / 60000) * 60000 + 60000
  const end = after.getTime() + 400 * 86400000
  while (t <= end) {
    const p = localParts(new Date(t), tz)
    const domOk = c.dom.has(p.day)
    const dowOk = c.dow.has(p.weekday)
    const dayOk = c.month.has(p.month) && (c.domAny && c.dowAny ? true : c.domAny ? dowOk : c.dowAny ? domOk : domOk || dowOk)
    if (!dayOk) { t += (1440 - (p.hour * 60 + p.minute)) * 60000; continue }
    if (!c.hour.has(p.hour)) { t += (60 - p.minute) * 60000; continue }
    if (!c.minute.has(p.minute)) { t += 60000; continue }
    return new Date(t)
  }
  return null
}

/** "fredag 7. november kl. 07:00" in the trigger's time zone, for people. */
export function describeTime(date, tz = DEFAULT_TIMEZONE) {
  if (!date) return null
  return new Intl.DateTimeFormat('nb-NO', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date)
}

/**
 * The schedule triggers of a compiled flow, checked. Returns { triggers, errors }.
 * Each trigger: { id, cron, timezone }.
 */
export function scheduleTriggers(spec) {
  const errors = []
  const triggers = []
  for (const t of spec.triggers || []) {
    if (t?.type !== 'schedule') continue
    const id = String(t.id || '').trim() || `t_${triggers.length + 1}`
    const tz = t.timezone || DEFAULT_TIMEZONE
    if (!validTimezone(tz)) { errors.push(`Trigger "${id}": unknown time zone "${tz}".`); continue }
    try { parseCron(t.cron) } catch (e) { errors.push(`Trigger "${id}": ${e.message}.`); continue }
    if (!nextRun(t.cron, tz)) { errors.push(`Trigger "${id}": "${t.cron}" never happens.`); continue }
    triggers.push({ id, cron: String(t.cron).trim(), timezone: tz })
  }
  return { triggers, errors }
}
