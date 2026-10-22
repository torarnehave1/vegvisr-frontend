/**
 * my-day-service.js — the caller's OWN calendar for a day, for MCP get_my_day (2026-10-22).
 *
 * The same source as the ContactHub Day View: calendar-worker's /api/calendar/day-view, which
 * merges the owner's Google calendars with CalSync bookings. Reached over the CALENDAR_WORKER
 * service binding with the e-mail from the VERIFIED token — never an argument, so nobody can read
 * someone else's calendar by naming them.
 *
 * Days are Oslo days. day-view cuts at UTC midnight, so the window asked for is one day wider on
 * each side and the events are then kept by their Oslo date — otherwise 00:00–02:00 local falls
 * on the previous day.
 *
 * Whitelisted on the way back: time, title, place, calendar, attendees. Event descriptions are
 * left out — they hold private notes and meeting links the question did not ask for.
 */
import { ERR, statusForCode } from './graph-service.js'

const TZ = 'Europe/Oslo'

function fail(code, message, extra = {}) {
  return { ok: false, code, status: statusForCode(code), message, ...extra }
}

/** YYYY-MM-DD of an instant, in Oslo. */
export function osloDate(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** HH:MM of an instant, in Oslo. */
function osloTime(d) {
  return new Intl.DateTimeFormat('nb-NO', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d)
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export async function getMyDay(env, { actor, date, days = 1 }) {
  if (!actor?.email) return fail(ERR.UNAUTHENTICATED, 'Authentication required.')
  if (!env.CALENDAR_WORKER?.fetch) {
    return fail(ERR.INTERNAL_ERROR, 'The CALENDAR_WORKER service binding is not configured on this worker.')
  }
  const first = date ? String(date).trim() : osloDate(new Date())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return fail(ERR.INVALID_INPUT, 'date must be YYYY-MM-DD.')
  const n = Math.min(Math.max(Number(days) || 1, 1), 7)
  const last = addDays(first, n - 1)

  let res
  let data
  try {
    res = await env.CALENDAR_WORKER.fetch(
      `https://calendar-worker/api/calendar/day-view?date=${addDays(first, -1)}&days=${n + 2}`,
      { headers: { 'X-User-Email': actor.email } },
    )
    data = await res.json().catch(() => ({}))
  } catch (e) {
    console.error('[my-day] calendar-worker unreachable:', e.message)
    return fail(ERR.INTERNAL_ERROR, `Could not reach the calendar service: ${e.message}`)
  }
  if (!res.ok) return fail(ERR.INVALID_INPUT, data?.error || `Calendar request failed (status ${res.status}).`)
  if (data?.error) return fail(ERR.INVALID_INPUT, data.error)

  const events = []
  for (const e of Array.isArray(data.events) ? data.events : []) {
    const allDay = Boolean(e.all_day) || !String(e.start_time || '').includes('T')
    let day
    let start = null
    let end = null
    if (allDay) {
      day = String(e.start_time || '').slice(0, 10)
    } else {
      const s = new Date(e.start_time)
      if (Number.isNaN(s.getTime())) continue
      day = osloDate(s)
      start = osloTime(s)
      const en = new Date(e.end_time)
      end = Number.isNaN(en.getTime()) ? null : osloTime(en)
    }
    if (day < first || day > last) continue
    events.push({
      date: day,
      start,
      end,
      allDay,
      title: String(e.summary || '(uten tittel)'),
      location: e.location ? String(e.location) : null,
      calendar: e.calendar_name ? String(e.calendar_name) : null,
      attendees: Array.isArray(e.attendees) ? e.attendees.map(String).filter(Boolean) : [],
    })
  }
  events.sort((a, b) => (a.date + (a.allDay ? '00:00' : a.start)).localeCompare(b.date + (b.allDay ? '00:00' : b.start)))
  return { ok: true, from: first, to: last, timeZone: TZ, count: events.length, events }
}
