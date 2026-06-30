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
// computeProgression — between-session hint banner per exercise
//
// Decision order:
//   1. Hard rating → review (hold regardless of reps)
//   2. Rep data present:
//      • All sets hit top of range → increase
//      • Any set below range.lo → hold (genuinely struggling)
//      • Sets in range but below top → ok (keep building)
//      • ≥2 easy despite rep data → increase override
//   3. Ratings-only (no reps logged):
//      • ≥2 easy → increase
//      • 2 consecutive all-✓ sessions → increase
// ─────────────────────────────────────────────────────────────────────────────
export function computeProgression(recentRatings = [], weightHistory = [], recentReps = []) {
  const exerciseMeta = {}
  for (const day of WORKOUT_DAYS) {
    for (const ex of day.exercises) {
      exerciseMeta[ex.id] = { exerciseName: ex.name, dayName: day.name, dayId: day.id }
    }
  }

  // { [exId]: { [date]: { [setNum]: rating } } }
  const byExRatings = {}
  for (const r of recentRatings) {
    if (!byExRatings[r.exercise_id]) byExRatings[r.exercise_id] = {}
    if (!byExRatings[r.exercise_id][r.log_date]) byExRatings[r.exercise_id][r.log_date] = {}
    byExRatings[r.exercise_id][r.log_date][r.set_number] = r.rating
  }

  // { [exId]: { [date]: { [setNum]: { reps } } } }
  const byExReps = {}
  for (const r of recentReps) {
    if (!byExReps[r.exercise_id]) byExReps[r.exercise_id] = {}
    if (!byExReps[r.exercise_id][r.log_date]) byExReps[r.exercise_id][r.log_date] = {}
    byExReps[r.exercise_id][r.log_date][r.set_number] = { reps: r.reps }
  }

  // Latest logged weight per exercise (history is ordered desc)
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

    const ratingDates = Object.keys(byExRatings[exId] ?? {}).sort().reverse()
    const repDates    = Object.keys(byExReps[exId] ?? {}).sort().reverse()
    const allDates    = [...new Set([...ratingDates, ...repDates])].sort().reverse()
    if (allDates.length === 0) continue

    const latestDate    = allDates[0]
    const latestRatings = byExRatings[exId]?.[latestDate] ?? {}
    const latestReps    = byExReps[exId]?.[latestDate] ?? {}
    const scheme        = REP_SCHEMES[exId] ?? []

    const hasHardRating  = Object.values(latestRatings).some(r => r === 'hard')
    const easyCount      = Object.values(latestRatings).filter(r => r === 'easy').length
    const allGoodRatings = Object.values(latestRatings).length > 0 &&
      Object.values(latestRatings).every(r => r === 'good')

    const hasRepData    = Object.keys(latestReps).length > 0
    const allSetsLogged = scheme.length > 0 && scheme.every((_, i) => latestReps[i + 1]?.reps != null)
    const allHitTop     = allSetsLogged && scheme.every((range, i) => latestReps[i + 1].reps >= range.hi)
    const anyBelowFloor = hasRepData && Object.entries(latestReps).some(([sn, d]) => {
      const range = scheme[parseInt(sn, 10) - 1]
      return d.reps != null && range && d.reps < range.lo
    })

    let status = 'ok'
    let reason = ''

    if (hasHardRating) {
      status = 'review'
      reason = 'Hard set last session — hold weight and focus on quality'
    } else if (hasRepData) {
      if (allSetsLogged && allHitTop) {
        status = 'increase'
        reason = 'Hit top of all rep targets — ready to go heavier'
      } else if (anyBelowFloor) {
        status = 'hold'
        reason = 'Some sets fell below target range — consolidate here'
      } else if (easyCount >= 2) {
        status = 'increase'
        reason = `${easyCount} sets felt easy`
      }
    } else {
      // Ratings-only fallback (no reps logged)
      if (easyCount >= 2) {
        status = 'increase'
        reason = `${easyCount} easy sets — ready to go heavier`
      } else if (allDates.length >= 2) {
        const prevDate    = allDates[1]
        const prevRatings = byExRatings[exId]?.[prevDate] ?? {}
        const prevAllGood = Object.values(prevRatings).length > 0 &&
          Object.values(prevRatings).every(r => r === 'good')
        if (allGoodRatings && prevAllGood) {
          status = 'increase'
          reason = '2 consecutive clean sessions'
        }
      }
    }

    const lastW = latestWeight[exId] ?? null
    const inc   = getIncrease(exId)

    result[exId] = {
      exerciseId: exId,
      ...meta,
      status,
      reason,
      lastWeight: lastW,
      suggested:  lastW != null ? lastW + inc : null,
      increase:   inc,
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// computeNextWeights — called at session save; sets next-session starting weights
//
// Per-set: hit top of rep range → increase. Hard rating on any set blocks the
// whole exercise. No rep data falls back to easy rating → increase.
// ─────────────────────────────────────────────────────────────────────────────
export function computeNextWeights(dayExercises, exerciseSnapshot, todayRatings = [], todayReps = []) {
  const repsByEx = {}
  for (const r of todayReps) {
    if (!repsByEx[r.exercise_id]) repsByEx[r.exercise_id] = {}
    repsByEx[r.exercise_id][r.set_number] = { reps: r.reps }
  }

  const result = {}

  for (const ex of dayExercises) {
    const snap = exerciseSnapshot.find(e => e.id === ex.id)
    if (!snap || snap.sets.length === 0) continue

    const exRatings     = todayRatings.filter(r => r.exercise_id === ex.id)
    const exReps        = repsByEx[ex.id] ?? {}
    const scheme        = REP_SCHEMES[ex.id] ?? []
    const inc           = getIncrease(ex.id)
    const hasHardRating = exRatings.some(r => r.rating === 'hard')

    const nextW = {}
    for (const s of snap.sets) {
      const rating  = exRatings.find(r => r.set_number === s.set)?.rating
      const repData = exReps[s.set]
      const range   = scheme[s.set - 1] ?? { lo: 8, hi: 12 }

      let increase = false
      if (!hasHardRating) {
        if (repData?.reps != null) {
          increase = repData.reps >= range.hi
        } else {
          increase = rating === 'easy'
        }
      }

      nextW[s.set] = increase ? s.weight + inc : s.weight
    }

    result[ex.id] = nextW
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// getProgressionSummary — human-readable post-save toast content
// ─────────────────────────────────────────────────────────────────────────────
export function getProgressionSummary(dayExercises, exerciseSnapshot, todayRatings = [], todayReps = []) {
  const increases = []
  const hardFlags = []

  const repsByEx = {}
  for (const r of todayReps) {
    if (!repsByEx[r.exercise_id]) repsByEx[r.exercise_id] = {}
    repsByEx[r.exercise_id][r.set_number] = { reps: r.reps }
  }

  for (const ex of dayExercises) {
    const snap = exerciseSnapshot.find(e => e.id === ex.id)
    if (!snap || snap.sets.length === 0) continue

    const exRatings = todayRatings.filter(r => r.exercise_id === ex.id)
    const exReps    = repsByEx[ex.id] ?? {}
    const scheme    = REP_SCHEMES[ex.id] ?? []
    const inc       = getIncrease(ex.id)

    if (exRatings.length === 0 && Object.keys(exReps).length === 0) continue

    const hasHardRating = exRatings.some(r => r.rating === 'hard')
    const hasRepData    = Object.keys(exReps).length > 0
    const allHitTop     = scheme.length > 0 && scheme.every((range, i) =>
      (exReps[i + 1]?.reps ?? 0) >= range.hi
    )
    const anyEasy = exRatings.some(r => r.rating === 'easy')

    if (hasHardRating) {
      hardFlags.push(ex.name)
    } else if ((hasRepData && allHitTop) || (!hasRepData && anyEasy)) {
      increases.push({ name: ex.name, inc })
    }
  }

  return { increases, hardFlags }
}
