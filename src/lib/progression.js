import { WORKOUT_DAYS } from '../data/workoutPlan'

const LOWER_BODY_IDS = new Set(
  (WORKOUT_DAYS.find(d => d.id === 'legs')?.exercises ?? []).map(e => e.id)
)

export function getIncrease(exerciseId) {
  return LOWER_BODY_IDS.has(exerciseId) ? 5 : 2.5
}

// Pre-build rep scheme ranges: { [exerciseId]: [{ lo, hi }] }
const REP_SCHEMES = (() => {
  const map = {}
  for (const day of WORKOUT_DAYS) {
    for (const ex of day.exercises) {
      map[ex.id] = ex.repScheme.map(r => {
        const parts = String(r).split('-').map(Number)
        return parts.length === 2 ? { lo: parts[0], hi: parts[1] } : { lo: parts[0], hi: parts[0] }
      })
    }
  }
  return map
})()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers to classify a single session for one exercise
// ─────────────────────────────────────────────────────────────────────────────

// Ratings structure: { [exId]: { [date]: { [setNum]: rating } } }
// Reps structure:    { [exId]: { [date]: { [setNum]: { reps } } } }

// A session is "top-of-range" when:
//   - Any set is rated E (easy) — immediate override regardless of reps, or
//   - At least one set has reps logged AND every logged set's reps >= that set's range.hi
//     (H and ✓ at top are treated identically — both confirm the rep was reached)
function isTopOfRangeSession(exId, date, byExRatings, byExReps) {
  const ratings = byExRatings[exId]?.[date] ?? {}
  const reps    = byExReps[exId]?.[date]    ?? {}
  const scheme  = REP_SCHEMES[exId] ?? []

  if (Object.values(ratings).some(r => r === 'easy')) return true

  const loggedSets = Object.entries(reps).filter(([, d]) => d.reps != null)
  if (loggedSets.length === 0) return false

  return loggedSets.every(([setNum, data]) => {
    const range = scheme[parseInt(setNum, 10) - 1]
    return range ? data.reps >= range.hi : false
  })
}

// A session has a "hold signal" when any set has H rating AND the reps logged
// for that set were BELOW the top of the range.
// H at or above range.hi is NOT a hold signal — it means the current weight is
// finally becoming too light (it still counts as a top-of-range session).
function hasHoldSignal(exId, date, byExRatings, byExReps) {
  const ratings = byExRatings[exId]?.[date] ?? {}
  const reps    = byExReps[exId]?.[date]    ?? {}
  const scheme  = REP_SCHEMES[exId] ?? []

  return Object.entries(ratings).some(([setNum, rating]) => {
    if (rating !== 'hard') return false
    const repData = reps[parseInt(setNum, 10)]
    const range   = scheme[parseInt(setNum, 10) - 1]
    if (!range || repData?.reps == null) return false
    return repData.reps < range.hi
  })
}

// Count consecutive top-of-range sessions from the most recent date backward.
// Stops as soon as a session is NOT top-of-range.
function countConsecutiveTop(exId, datesSortedDesc, byExRatings, byExReps) {
  let count = 0
  for (const date of datesSortedDesc) {
    if (isTopOfRangeSession(exId, date, byExRatings, byExReps)) {
      count++
    } else {
      break
    }
  }
  return count
}

// Build nested lookup from flat DB rows
// ratings rows: { exercise_id, log_date, set_number, rating }
// reps rows:    { exercise_id, log_date, set_number, reps }
function buildRatingsLookup(rows) {
  const out = {}
  for (const r of rows) {
    if (!out[r.exercise_id]) out[r.exercise_id] = {}
    if (!out[r.exercise_id][r.log_date]) out[r.exercise_id][r.log_date] = {}
    out[r.exercise_id][r.log_date][r.set_number] = r.rating
  }
  return out
}

function buildRepsLookup(rows) {
  const out = {}
  for (const r of rows) {
    if (!out[r.exercise_id]) out[r.exercise_id] = {}
    if (!out[r.exercise_id][r.log_date]) out[r.exercise_id][r.log_date] = {}
    out[r.exercise_id][r.log_date][r.set_number] = { reps: r.reps }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// computeProgression — powers the per-exercise banner on the workout screen
//
// Decision order per exercise:
//   1. E (easy) in latest session → increase immediately (override)
//   2. Count consecutive sessions at top of range from most recent backward
//      • ≥ 2 consecutive → increase (2-session rule confirmed)
//      • = 1 consecutive → show "1/2 — 1 more session to trigger increase"
//      • = 0 + hold signal (H below top) → hold (weight is working)
//      • = 0 + no hold signal → ok (still building)
//
// Reps naturally dropping after a weight increase (e.g. 12 → 8 reps at new
// weight) do NOT trigger hold — that is the expected progressive overload cycle
// and will be classified as "ok" until the user builds back to the top.
// ─────────────────────────────────────────────────────────────────────────────
export function computeProgression(recentRatings = [], weightHistory = [], recentReps = []) {
  const exerciseMeta = {}
  for (const day of WORKOUT_DAYS) {
    for (const ex of day.exercises) {
      exerciseMeta[ex.id] = { exerciseName: ex.name, dayName: day.name, dayId: day.id }
    }
  }

  const byExRatings = buildRatingsLookup(recentRatings)
  const byExReps    = buildRepsLookup(recentReps)

  // Latest logged weight per exercise (history ordered desc by caller)
  const latestWeight = {}
  for (const h of weightHistory) {
    if (latestWeight[h.exercise_id] !== undefined) continue
    const vals = Object.entries(h.weights ?? {})
      .filter(([k]) => !isNaN(Number(k)))
      .map(([, v]) => v)
      .filter(v => v != null)
    latestWeight[h.exercise_id] = vals.length ? Math.max(...vals) : null
  }

  const allExIds = new Set([...Object.keys(byExRatings), ...Object.keys(byExReps)])
  const result = {}

  for (const exId of allExIds) {
    const meta = exerciseMeta[exId]
    if (!meta) continue

    const ratingDates = Object.keys(byExRatings[exId] ?? {})
    const repDates    = Object.keys(byExReps[exId] ?? {})
    const allDates    = [...new Set([...ratingDates, ...repDates])].sort().reverse()
    if (allDates.length === 0) continue

    const latestDate    = allDates[0]
    const latestRatings = byExRatings[exId]?.[latestDate] ?? {}
    const hasEasy       = Object.values(latestRatings).some(r => r === 'easy')
    const consecutiveTop = countConsecutiveTop(exId, allDates, byExRatings, byExReps)
    const holdSignal    = hasHoldSignal(exId, latestDate, byExRatings, byExReps)

    const lastW = latestWeight[exId] ?? null
    const inc   = getIncrease(exId)

    let status = 'ok'
    let reason = ''

    if (hasEasy) {
      status = 'increase'
      reason = 'Easy set logged — weight is too light'
    } else if (consecutiveTop >= 2) {
      status = 'increase'
      reason = `Hit top of rep range ${consecutiveTop} sessions in a row`
    } else if (consecutiveTop === 1) {
      status = 'ok'
      reason = `1/2 sessions at top of range — 1 more to trigger +${inc}kg`
    } else if (holdSignal) {
      status = 'hold'
      reason = 'Failed below top of range — weight is right, keep building'
    } else {
      status = 'ok'
      reason = 'Rate each set · log reps each session to drive progression'
    }

    result[exId] = {
      exerciseId: exId,
      ...meta,
      status,
      reason,
      consecutiveTop,
      lastWeight: lastW,
      suggested: lastW != null ? lastW + inc : null,
      increase:  inc,
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// computeNextWeights — called at session save to set next-session weights
//
// Requires today's data PLUS the previous session's data (history before today)
// to apply the 2-consecutive-session rule:
//   • E today → increase all sets for that exercise immediately
//   • Top-of-range today AND top-of-range last session → increase
//   • Anything else → hold (keep current weight)
// ─────────────────────────────────────────────────────────────────────────────
export function computeNextWeights(
  dayExercises,
  exerciseSnapshot,
  todayRatings = [],
  todayReps    = [],
  prevRatings  = [],
  prevReps     = [],
) {
  const todayStr = new Date().toISOString().split('T')[0]

  // Build today's lookups using todayStr as the date key
  const todayByRatings = buildRatingsLookup(todayRatings.map(r => ({ ...r, log_date: todayStr })))
  const todayByReps    = buildRepsLookup(todayReps.map(r => ({ ...r, log_date: todayStr })))

  // Build previous sessions lookups (already have real log_date values)
  const prevByRatings = buildRatingsLookup(prevRatings)
  const prevByReps    = buildRepsLookup(prevReps)

  const result = {}

  for (const ex of dayExercises) {
    const snap = exerciseSnapshot.find(e => e.id === ex.id)
    if (!snap || snap.sets.length === 0) continue

    const inc = getIncrease(ex.id)

    // Was today an easy or top-of-range session?
    const hasEasyToday  = Object.values(todayByRatings[ex.id]?.[todayStr] ?? {}).some(r => r === 'easy')
    const todayWasTop   = isTopOfRangeSession(ex.id, todayStr, todayByRatings, todayByReps)

    // Find most recent previous session date for this exercise
    const prevDates = [...new Set([
      ...Object.keys(prevByRatings[ex.id] ?? {}),
      ...Object.keys(prevByReps[ex.id] ?? {}),
    ])].sort().reverse()
    const prevDate   = prevDates[0]
    const prevWasTop = prevDate ? isTopOfRangeSession(ex.id, prevDate, prevByRatings, prevByReps) : false

    const shouldIncrease = hasEasyToday || (todayWasTop && prevWasTop)

    const nextW = {}
    for (const s of snap.sets) {
      nextW[s.set] = shouldIncrease ? s.weight + inc : s.weight
    }

    result[ex.id] = nextW
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// getProgressionSummary — human-readable post-save toast content
//
// Returns which exercises earned a weight increase this session and which had
// a hold signal (H below top of range = weight is appropriately challenging).
// ─────────────────────────────────────────────────────────────────────────────
export function getProgressionSummary(
  dayExercises,
  exerciseSnapshot,
  todayRatings = [],
  todayReps    = [],
  prevRatings  = [],
  prevReps     = [],
) {
  const increases = []
  const holds     = []

  const todayStr = new Date().toISOString().split('T')[0]

  const todayByRatings = buildRatingsLookup(todayRatings.map(r => ({ ...r, log_date: todayStr })))
  const todayByReps    = buildRepsLookup(todayReps.map(r => ({ ...r, log_date: todayStr })))
  const prevByRatings  = buildRatingsLookup(prevRatings)
  const prevByReps     = buildRepsLookup(prevReps)

  for (const ex of dayExercises) {
    const snap = exerciseSnapshot.find(e => e.id === ex.id)
    if (!snap || snap.sets.length === 0) continue

    const inc = getIncrease(ex.id)

    const hasEasyToday = Object.values(todayByRatings[ex.id]?.[todayStr] ?? {}).some(r => r === 'easy')
    const todayWasTop  = isTopOfRangeSession(ex.id, todayStr, todayByRatings, todayByReps)

    const prevDates = [...new Set([
      ...Object.keys(prevByRatings[ex.id] ?? {}),
      ...Object.keys(prevByReps[ex.id] ?? {}),
    ])].sort().reverse()
    const prevDate   = prevDates[0]
    const prevWasTop = prevDate ? isTopOfRangeSession(ex.id, prevDate, prevByRatings, prevByReps) : false

    const holdSignalToday = hasHoldSignal(ex.id, todayStr, todayByRatings, todayByReps)

    if (hasEasyToday || (todayWasTop && prevWasTop)) {
      increases.push({ name: ex.name, inc })
    } else if (holdSignalToday) {
      holds.push(ex.name)
    }
  }

  return { increases, hardFlags: holds }
}
