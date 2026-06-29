import { WORKOUT_DAYS } from '../data/workoutPlan'

const LOWER_BODY_IDS = new Set(
  (WORKOUT_DAYS.find(d => d.id === 'legs')?.exercises ?? []).map(e => e.id)
)

export function getIncrease(exerciseId) {
  return LOWER_BODY_IDS.has(exerciseId) ? 5 : 2.5
}

// recentRatings: rows from set_ratings table
// weightHistory:  rows from exercise_weight_history table (sorted desc by log_date)
// Returns: { [exerciseId]: { exerciseName, dayName, status, reason, lastWeight, suggested, increase } }
export function computeProgression(recentRatings = [], weightHistory = []) {
  const exerciseMeta = {}
  for (const day of WORKOUT_DAYS) {
    for (const ex of day.exercises) {
      exerciseMeta[ex.id] = { exerciseName: ex.name, dayName: day.name, dayId: day.id }
    }
  }

  const byExDate = {}
  for (const r of recentRatings) {
    const ex = r.exercise_id
    if (!byExDate[ex]) byExDate[ex] = {}
    if (!byExDate[ex][r.log_date]) byExDate[ex][r.log_date] = []
    byExDate[ex][r.log_date].push(r.rating)
  }

  const latestWeight = {}
  for (const h of weightHistory) {
    if (latestWeight[h.exercise_id] !== undefined) continue
    const vals = Object.values(h.weights ?? {}).filter(v => v != null)
    latestWeight[h.exercise_id] = vals.length ? Math.max(...vals) : null
  }

  const result = {}

  for (const exId of Object.keys(byExDate)) {
    const meta = exerciseMeta[exId]
    if (!meta) continue

    const dateMap = byExDate[exId]
    const sortedDates = Object.keys(dateMap).sort().reverse()
    const lastRatings = dateMap[sortedDates[0]] ?? []

    const hardCount = lastRatings.filter(r => r === 'hard').length
    const easyCount = lastRatings.filter(r => r === 'easy').length

    let status = 'ok'
    let reason = ''

    if (hardCount > 0) {
      status = 'review'
      reason = `${hardCount} hard set${hardCount > 1 ? 's' : ''} last session`
    } else if (easyCount >= 2) {
      status = 'increase'
      reason = `${easyCount} easy sets last session`
    } else if (sortedDates.length >= 2) {
      const prevRatings = dateMap[sortedDates[1]] ?? []
      const lastClean = lastRatings.length > 0 && lastRatings.every(r => r === 'good')
      const prevClean = prevRatings.length > 0 && prevRatings.every(r => r === 'good')
      if (lastClean && prevClean) {
        status = 'increase'
        reason = '2 consecutive clean sessions'
      }
    }

    const lastW = latestWeight[exId] ?? null
    const inc = getIncrease(exId)

    result[exId] = {
      ...meta,
      status,
      reason,
      lastWeight: lastW,
      suggested: lastW != null ? lastW + inc : null,
      increase: inc,
    }
  }

  return result
}

// Computes per-set weight targets for the NEXT session.
// dayExercises: exercise plan objects for today's workout day
// exerciseSnapshot: [{ id, name, sets: [{ set, reps, weight }] }] — built by saveWorkout
// todayRatings: set_ratings rows for today's session
// Returns: { [exerciseId]: { [setNum]: newWeight } }
export function computeNextWeights(dayExercises, exerciseSnapshot, todayRatings = []) {
  const result = {}

  for (const ex of dayExercises) {
    const snap = exerciseSnapshot.find(e => e.id === ex.id)
    if (!snap || snap.sets.length === 0) continue

    const exRatings = todayRatings.filter(r => r.exercise_id === ex.id)
    // Any hard set blocks ALL increases for this exercise
    const hasHardSet = exRatings.some(r => r.rating === 'hard')
    const inc = getIncrease(ex.id)

    const nextW = {}
    for (const s of snap.sets) {
      const rating = exRatings.find(r => r.set_number === s.set)?.rating
      // Easy + no hard sets anywhere → increase; good / hard / unrated → hold
      nextW[s.set] = rating === 'easy' && !hasHardSet ? s.weight + inc : s.weight
    }

    result[ex.id] = nextW
  }

  return result
}

// Returns a human-readable summary for the post-save toast.
export function getProgressionSummary(dayExercises, exerciseSnapshot, todayRatings = []) {
  const increases = []
  const hardFlags = []

  for (const ex of dayExercises) {
    const snap = exerciseSnapshot.find(e => e.id === ex.id)
    if (!snap || snap.sets.length === 0) continue

    const exRatings = todayRatings.filter(r => r.exercise_id === ex.id)
    if (exRatings.length === 0) continue

    const hasHardSet = exRatings.some(r => r.rating === 'hard')
    const easyCount = exRatings.filter(r => r.rating === 'easy').length
    const inc = getIncrease(ex.id)

    if (hasHardSet) {
      hardFlags.push(ex.name)
    } else if (easyCount > 0) {
      increases.push({ name: ex.name, inc, sets: easyCount })
    }
  }

  return { increases, hardFlags }
}
