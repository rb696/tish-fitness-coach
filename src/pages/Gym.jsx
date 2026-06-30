import { useState, useEffect, useRef } from 'react'
import { WORKOUT_DAYS } from '../data/workoutPlan'
import { supabase } from '../lib/supabase'
import { computeProgression, computeNextWeights, getProgressionSummary } from '../lib/progression'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Gym() {
  const [activeTab, setActiveTab] = useState('push')
  const [weights, setWeights] = useState({})
  const [logs, setLogs] = useState({})
  const [commentModal, setCommentModal] = useState(null)
  const [historyModal, setHistoryModal] = useState(null)
  const [workoutSaved, setWorkoutSaved] = useState(null)
  const [savedSessions, setSavedSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [ratings, setRatings] = useState({})
  const [repLogs, setRepLogs] = useState({})       // { [exId]: { [setNum]: { reps, toFailure } } }
  const [progressionHints, setProgressionHints] = useState({})
  const [saveToast, setSaveToast] = useState(null)
  const timerRef = useRef(null)
  const [restTimer, setRestTimer] = useState(null)

  function startRestTimer(exerciseId, restSeconds) {
    if (timerRef.current) clearInterval(timerRef.current)
    setRestTimer({ exerciseId, secondsLeft: restSeconds, totalSeconds: restSeconds, done: false })
    timerRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (!prev) return null
        if (prev.secondsLeft <= 1) {
          clearInterval(timerRef.current)
          navigator.vibrate?.([150, 50, 150])
          return { ...prev, secondsLeft: 0, done: true }
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 }
      })
    }, 1000)
  }

  function skipRestTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setRestTimer(null)
  }

  function addRestTime(seconds) {
    setRestTimer(prev => prev ? { ...prev, secondsLeft: prev.secondsLeft + seconds, done: false } : null)
  }

  const day = WORKOUT_DAYS.find(d => d.id === activeTab)

  useEffect(() => {
    fetchWeights()
    fetchTodayLogs()
    fetchRatingsAndHistory()
    cleanupOrphanedData()
  }, [])

  useEffect(() => {
    if (restTimer?.done) {
      const t = setTimeout(() => setRestTimer(null), 4000)
      return () => clearTimeout(t)
    }
  }, [restTimer?.done])

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  useEffect(() => {
    if (activeTab === 'sessions') fetchSessions()
  }, [activeTab])

  async function fetchWeights() {
    const { data, error } = await supabase.from('exercise_weights').select('*')
    if (error) console.error('fetchWeights error:', error.message)
    if (data) {
      const w = {}
      data.forEach(r => { w[r.exercise_id] = r.weights || {} })
      setWeights(w)
    }
  }

  async function fetchTodayLogs() {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('exercise_comments').select('*').eq('log_date', todayStr)
    if (data) {
      const l = {}
      data.forEach(r => { l[r.exercise_id] = r.comment })
      setLogs(l)
    }
  }

  async function fetchRatingsAndHistory() {
    const todayStr = new Date().toISOString().split('T')[0]
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [
      { data: todayRatings },
      { data: histData },
      { data: allRatings },
      { data: sessions },
      { data: allReps },
    ] = await Promise.all([
      supabase.from('set_ratings').select('*').eq('log_date', todayStr),
      supabase.from('exercise_weight_history').select('*').order('log_date', { ascending: false }).limit(100),
      supabase.from('set_ratings').select('*').gte('log_date', thirtyAgo),
      supabase.from('workout_sessions').select('saved_at').gte('saved_at', thirtyAgo + 'T00:00:00'),
      supabase.from('set_reps').select('*').gte('log_date', thirtyAgo),
    ])

    if (todayRatings) {
      const r = {}
      todayRatings.forEach(row => {
        if (!r[row.exercise_id]) r[row.exercise_id] = {}
        r[row.exercise_id][row.set_number] = row.rating
      })
      setRatings(r)
    }

    // Set today's rep logs from the 30-day fetch
    if (allReps) {
      const todayRepsData = allReps.filter(r => r.log_date === todayStr)
      const rl = {}
      todayRepsData.forEach(r => {
        if (!rl[r.exercise_id]) rl[r.exercise_id] = {}
        rl[r.exercise_id][r.set_number] = { reps: r.reps, toFailure: r.to_failure }
      })
      setRepLogs(rl)
    }

    if (allRatings && histData && allReps) {
      const validDates = new Set([
        todayStr,
        ...(sessions || []).map(s => s.saved_at.split('T')[0]),
      ])
      const liveRatings = allRatings.filter(r => validDates.has(r.log_date))
      const liveReps    = allReps.filter(r => validDates.has(r.log_date))
      setProgressionHints(computeProgression(liveRatings, histData, liveReps))
    }
  }

  async function cleanupOrphanedData() {
    const [{ data: sessions }, { data: history }] = await Promise.all([
      supabase.from('workout_sessions').select('saved_at'),
      supabase.from('exercise_weight_history').select('id, exercise_id, log_date'),
    ])
    if (!history || history.length === 0) return

    const sessionDates = new Set((sessions || []).map(s => s.saved_at.split('T')[0]))
    const orphaned = history.filter(h => !sessionDates.has(h.log_date))
    if (orphaned.length === 0) return

    await supabase.from('exercise_weight_history').delete().in('id', orphaned.map(h => h.id))

    const stillValid = new Set(history.filter(h => sessionDates.has(h.log_date)).map(h => h.exercise_id))
    const toReset = [...new Set(orphaned.map(h => h.exercise_id))].filter(id => !stillValid.has(id))

    if (toReset.length > 0) {
      await Promise.all(toReset.map(exId =>
        supabase.from('exercise_weights').upsert(
          { exercise_id: exId, weights: {} },
          { onConflict: 'exercise_id' }
        )
      ))
      await fetchWeights()
    }
  }

  async function saveRating(exerciseId, setNum, rating) {
    const todayStr = new Date().toISOString().split('T')[0]
    const current = ratings[exerciseId]?.[setNum]
    const next = current === rating ? null : rating

    let dbError = null
    if (next === null) {
      const { error } = await supabase.from('set_ratings')
        .delete()
        .eq('exercise_id', exerciseId)
        .eq('log_date', todayStr)
        .eq('set_number', setNum)
      dbError = error
    } else {
      const { error } = await supabase.from('set_ratings').upsert(
        { exercise_id: exerciseId, log_date: todayStr, set_number: setNum, rating: next },
        { onConflict: 'exercise_id,log_date,set_number' }
      )
      dbError = error
    }

    if (dbError) {
      console.error('saveRating failed:', dbError.message)
      alert(`Rating save failed: ${dbError.message}\n\nMake sure you've run the set_ratings table SQL in Supabase.`)
      return
    }

    setRatings(prev => ({
      ...prev,
      [exerciseId]: { ...(prev[exerciseId] || {}), [setNum]: next },
    }))
  }

  async function saveRepLog(exerciseId, setNum, reps, toFailure) {
    const todayStr = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('set_reps').upsert(
      { exercise_id: exerciseId, log_date: todayStr, set_number: setNum, reps: reps ?? null, to_failure: toFailure ?? false },
      { onConflict: 'exercise_id,log_date,set_number' }
    )
    if (error) {
      console.error('saveRepLog failed:', error.message)
      return
    }
    setRepLogs(prev => ({
      ...prev,
      [exerciseId]: { ...(prev[exerciseId] || {}), [setNum]: { reps, toFailure } },
    }))
  }

  async function fetchSessions() {
    setLoadingSessions(true)
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('*')
      .order('saved_at', { ascending: false })
      .limit(50)
    if (error) console.error('fetchSessions error:', error.message)
    if (data) setSavedSessions(data)
    setLoadingSessions(false)
  }

  async function saveSetWeight(exerciseId, setNumber, weight) {
    if (weight > 500) {
      alert('Weight looks too high — max 500 kg per set. Please check the value.')
      return
    }
    const current = weights[exerciseId] || {}
    const updated = { ...current, [setNumber]: weight }

    const { error } = await supabase.from('exercise_weights').upsert(
      { exercise_id: exerciseId, weights: updated },
      { onConflict: 'exercise_id' }
    )
    if (error) {
      console.error('saveSetWeight failed:', error.message)
      alert(`Save failed: ${error.message}`)
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const { error: histErr } = await supabase.from('exercise_weight_history').upsert(
      { exercise_id: exerciseId, log_date: todayStr, weights: updated },
      { onConflict: 'exercise_id,log_date' }
    )
    if (histErr) console.error('history save failed:', histErr.message)

    setWeights(prev => ({ ...prev, [exerciseId]: updated }))
  }

  async function saveComment(exerciseId, comment) {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase.from('exercise_comments').upsert(
      { exercise_id: exerciseId, comment, log_date: todayStr },
      { onConflict: 'exercise_id,log_date' }
    ).select()

    if (error || !data || data.length === 0) {
      const msg = error?.message ?? 'Row not written — RLS may be blocking the insert'
      console.error('saveComment failed:', msg)
      alert(
        `Comment save failed: ${msg}\n\nFix: run this in your Supabase SQL editor:\nalter table exercise_comments disable row level security;`
      )
      return
    }

    setLogs(prev => ({ ...prev, [exerciseId]: comment }))
    setCommentModal(null)
  }

  async function saveWorkout() {
    if (!day) return
    setWorkoutSaved('saving')

    const exercises = day.exercises
      .map(ex => {
        const setWeightsEx = weights[ex.id] || {}
        const sets = ex.repScheme
          .map((reps, i) => ({ set: i + 1, reps, weight: setWeightsEx[i + 1] ?? null }))
          .filter(s => s.weight !== null)
        return { id: ex.id, name: ex.name, sets }
      })
      .filter(ex => ex.sets.length > 0)

    if (exercises.length === 0) {
      alert('No weights logged yet — enter at least one set weight before saving.')
      setWorkoutSaved(null)
      return
    }

    const { error } = await supabase.from('workout_sessions').insert({
      day_type: day.id,
      day_name: day.name,
      exercises,
    })

    if (error) {
      console.error('saveWorkout failed:', error.message)
      alert(`Failed to save workout: ${error.message}`)
      setWorkoutSaved(null)
      return
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const { data: todayRatings, error: ratingErr } = await supabase
      .from('set_ratings')
      .select('*')
      .eq('log_date', todayStr)
      .in('exercise_id', day.exercises.map(ex => ex.id))
    if (ratingErr) console.error('fetchRatings for progression failed:', ratingErr.message)

    // Convert repLogs state to the flat array format progression functions expect
    const todayRepsFlat = []
    for (const [exId, setMap] of Object.entries(repLogs)) {
      for (const [setNum, data] of Object.entries(setMap)) {
        if (data.reps != null || data.toFailure) {
          todayRepsFlat.push({
            exercise_id: exId,
            set_number: parseInt(setNum, 10),
            reps: data.reps,
            to_failure: data.toFailure,
          })
        }
      }
    }

    const nextWeights = computeNextWeights(day.exercises, exercises, todayRatings || [], todayRepsFlat)
    const summary     = getProgressionSummary(day.exercises, exercises, todayRatings || [], todayRepsFlat)

    await Promise.all(
      Object.entries(nextWeights).map(([exId, nextW]) =>
        Object.keys(nextW).length > 0
          ? supabase.from('exercise_weights').upsert(
              { exercise_id: exId, weights: nextW },
              { onConflict: 'exercise_id' }
            )
          : Promise.resolve()
      )
    )

    // Clear local state for next session
    const cleared = {}
    const clearedRatings = {}
    const clearedReps = {}
    day.exercises.forEach(ex => {
      cleared[ex.id] = {}
      clearedRatings[ex.id] = {}
      clearedReps[ex.id] = {}
    })
    setWeights(prev => ({ ...prev, ...cleared }))
    setRatings(prev => ({ ...prev, ...clearedRatings }))
    setRepLogs(prev => ({ ...prev, ...clearedReps }))

    if (summary.increases.length > 0 || summary.hardFlags.length > 0) {
      setSaveToast(summary)
      setTimeout(() => setSaveToast(null), 6000)
    }

    setWorkoutSaved('done')
    setTimeout(() => setWorkoutSaved(null), 2500)
  }

  async function deleteSession(session) {
    const { error } = await supabase.from('workout_sessions').delete().eq('id', session.id)
    if (error) {
      console.error('deleteSession failed:', error.message)
      alert(`Delete failed: ${error.message}`)
      return
    }

    const sessionDate = session.saved_at.split('T')[0]
    const exerciseIds = (session.exercises || []).map(ex => ex.id)

    if (exerciseIds.length > 0) {
      await Promise.all([
        supabase.from('set_ratings').delete()
          .eq('log_date', sessionDate).in('exercise_id', exerciseIds),
        supabase.from('exercise_weight_history').delete()
          .eq('log_date', sessionDate).in('exercise_id', exerciseIds),
        supabase.from('set_reps').delete()
          .eq('log_date', sessionDate).in('exercise_id', exerciseIds),
      ])

      const restorations = {}
      await Promise.all(exerciseIds.map(async exId => {
        const { data } = await supabase
          .from('exercise_weight_history')
          .select('weights')
          .eq('exercise_id', exId)
          .order('log_date', { ascending: false })
          .limit(1)
        const restored = data?.[0]?.weights ?? {}
        restorations[exId] = restored
        await supabase.from('exercise_weights').upsert(
          { exercise_id: exId, weights: restored },
          { onConflict: 'exercise_id' }
        )
      }))

      setWeights(prev => ({ ...prev, ...restorations }))
    }

    setSavedSessions(prev => prev.filter(s => s.id !== session.id))
  }

  const tabs = [
    ...WORKOUT_DAYS.map(d => ({ id: d.id, label: d.name, color: d.color })),
    { id: 'sessions', label: 'Sessions', color: '#6366f1' },
  ]

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Gym</h1>
        <p className="text-gray-400 text-sm mt-1">
          {activeTab === 'sessions'
            ? 'Your saved workout sessions'
            : '4-day split · 45 min sessions · tap a weight to edit'}
        </p>
      </div>

      <div className="px-4 flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === t.id ? 'text-white' : 'bg-white/5 text-gray-400'
            }`}
            style={activeTab === t.id ? { background: t.color } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'sessions' ? (
        <SessionsView sessions={savedSessions} loading={loadingSessions} onDelete={deleteSession} />
      ) : (
        <>
          <div className="px-4 space-y-3">
            {day.exercises.map((ex, i) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                index={i + 1}
                dayColor={day.color}
                setWeights={weights[ex.id] || {}}
                setRatings={ratings[ex.id] || {}}
                repLogs={repLogs[ex.id] || {}}
                suggestion={progressionHints[ex.id]}
                comment={logs[ex.id]}
                onSaveSetWeight={(setNum, weight) => saveSetWeight(ex.id, setNum, weight)}
                onRate={(setNum, rating) => {
                  const prevRating = ratings[ex.id]?.[setNum]
                  saveRating(ex.id, setNum, rating)
                  if (prevRating !== rating) startRestTimer(ex.id, ex.restSeconds ?? 60)
                }}
                onSaveRepLog={(setNum, reps, toFailure) => saveRepLog(ex.id, setNum, reps, toFailure)}
                onComment={() => setCommentModal(ex)}
                onHistory={() => setHistoryModal(ex)}
                restTimer={restTimer?.exerciseId === ex.id ? restTimer : null}
                onSkipTimer={skipRestTimer}
                onAddTime={addRestTime}
              />
            ))}
          </div>

          <div className="px-4 mt-5">
            <button
              onClick={saveWorkout}
              disabled={workoutSaved === 'saving'}
              className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
                workoutSaved === 'done'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : workoutSaved === 'saving'
                  ? 'bg-white/5 text-gray-400 cursor-not-allowed'
                  : 'text-white'
              }`}
              style={!workoutSaved ? { background: day.color } : {}}
            >
              {workoutSaved === 'done'
                ? '✓ Workout saved!'
                : workoutSaved === 'saving'
                ? 'Saving...'
                : `Save ${day.name} Workout`}
            </button>
          </div>
        </>
      )}

      {saveToast && (
        <div className="fixed bottom-24 inset-x-0 px-4 z-40">
          <div className="max-w-lg mx-auto">
            <div className="bg-[#1e1e2a] border border-white/10 rounded-2xl p-4 shadow-xl">
              <p className="text-white font-semibold text-sm mb-3">Next session targets set</p>
              {saveToast.increases.length > 0 && (
                <div className="mb-3">
                  <p className="text-emerald-400 text-[10px] font-bold tracking-widest mb-2">WEIGHT INCREASES LOCKED IN</p>
                  {saveToast.increases.map(inc => (
                    <p key={inc.name} className="text-gray-300 text-xs py-0.5">· {inc.name} +{inc.inc}kg next session</p>
                  ))}
                </div>
              )}
              {saveToast.hardFlags.length > 0 && (
                <div>
                  <p className="text-amber-400 text-[10px] font-bold tracking-widest mb-2">HOLD WEIGHT</p>
                  {saveToast.hardFlags.map(name => (
                    <p key={name} className="text-gray-300 text-xs py-0.5">· {name} — consolidate before increasing</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {commentModal && (
        <CommentModal
          exercise={commentModal}
          existing={logs[commentModal.id] || ''}
          onSave={comment => saveComment(commentModal.id, comment)}
          onClose={() => setCommentModal(null)}
        />
      )}

      {historyModal && (
        <HistoryModal
          exercise={historyModal}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function SessionsView({ sessions, loading, onDelete }) {
  if (loading) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-gray-400 text-sm">Loading sessions...</p>
      </div>
    )
  }
  if (sessions.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-4xl mb-3">🏋️</p>
        <p className="text-white font-semibold">No saved sessions yet</p>
        <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
          Log your weights then tap "Save Workout" at the bottom — each save creates one entry here
        </p>
      </div>
    )
  }
  return (
    <div className="px-4 space-y-3">
      {sessions.map(session => (
        <SessionCard key={session.id} session={session} onDelete={onDelete} />
      ))}
    </div>
  )
}

function SessionCard({ session, onDelete }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const day = WORKOUT_DAYS.find(d => d.id === session.day_type)
  const color = day?.color ?? '#6366f1'

  const savedAt = new Date(session.saved_at)
  const dateStr = savedAt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const timeStr = savedAt.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  const totalSets = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0)

  async function handleDelete() {
    setDeleting(true)
    await onDelete(session)
  }

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <div
        role="button" tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => e.key === 'Enter' && setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-4 text-left cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ background: color }} />
          <div>
            <p className="text-white font-semibold">{session.day_name}</p>
            <p className="text-gray-400 text-xs mt-0.5">{dateStr} · {timeStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-gray-500 text-xs">{session.exercises.length} ex · {totalSets} sets</span>
          <button
            onClick={e => { e.stopPropagation(); setConfirming(c => !c) }}
            className="p-1.5 rounded-lg bg-white/5 active:bg-white/10 ml-1"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500">
              <polyline points="3 6 5 6 21 6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
            </svg>
          </button>
          <svg className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {confirming && (
        <div className="px-4 pb-3 flex items-center gap-3 border-t border-white/5 pt-3">
          <p className="text-gray-300 text-sm flex-1">Delete this session?</p>
          <button onClick={() => setConfirming(false)}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-sm active:bg-white/10">Cancel</button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium active:bg-red-500/25 disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-3">
          {session.exercises.map(ex => (
            <div key={ex.id}>
              <p className="text-white text-sm font-medium mb-2">{ex.name}</p>
              <div className="flex flex-wrap gap-2">
                {ex.sets.map(s => (
                  <div key={s.set} className="bg-white/5 rounded-xl px-3 py-2 text-center min-w-[56px]">
                    <p className="text-gray-500 text-[10px] mb-0.5">S{s.set} · {s.reps}r</p>
                    <p className="text-white text-sm font-semibold">{s.weight}kg</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

const RATING_CONFIG = [
  { key: 'easy', label: 'E', active: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'good', label: '✓', active: 'bg-indigo-500/20 text-indigo-400' },
  { key: 'hard', label: 'H', active: 'bg-red-500/20 text-red-400' },
]

const WARMUP_DEFS = [
  { key: 'w1', label: 'W1', reps: '10r', pct: 0.50 },
  { key: 'w2', label: 'W2', reps: '6r',  pct: 0.70 },
  { key: 'w3', label: 'W3', reps: '4r',  pct: 0.85 },
]

function ExerciseCard({
  exercise, index, dayColor, setWeights, setRatings, repLogs,
  suggestion, comment, onSaveSetWeight, onRate, onSaveRepLog,
  onComment, onHistory, restTimer, onSkipTimer, onAddTime,
}) {
  const [editingWeightKey, setEditingWeightKey] = useState(null)
  const [inputVal, setInputVal] = useState('')
  const [repEdits, setRepEdits] = useState({})  // { [setNum]: string } — in-progress text

  const warmupCount = exercise.warmupSets || 0
  const s1Weight = setWeights[1]

  function startEditSet(i) {
    setEditingWeightKey(i + 1)
    setInputVal(setWeights[i + 1] ?? '')
  }

  function startEditWarmup(key, pct) {
    const stored = setWeights[key]
    const autoVal = s1Weight && pct ? Math.round(s1Weight * pct) : null
    setEditingWeightKey(key)
    setInputVal(stored != null ? String(stored) : (autoVal != null ? String(autoVal) : ''))
  }

  function commitEdit() {
    if (inputVal !== '' && !isNaN(inputVal)) {
      onSaveSetWeight(editingWeightKey, parseFloat(inputVal))
    }
    setEditingWeightKey(null)
  }

  function commitRep(setNum) {
    const raw = repEdits[setNum]
    if (raw === undefined) return
    const val = parseInt(raw, 10)
    if (!isNaN(val) && val > 0) {
      onSaveRepLog(setNum, val, repLogs[setNum]?.toFailure ?? false)
    }
  }

  function toggleFailure(setNum) {
    const current = repLogs[setNum] ?? {}
    onSaveRepLog(setNum, current.reps ?? null, !(current.toFailure ?? false))
  }

  function getRepValue(setNum) {
    if (repEdits[setNum] !== undefined) return repEdits[setNum]
    return repLogs[setNum]?.reps != null ? String(repLogs[setNum].reps) : ''
  }

  const allWeightsLogged = exercise.repScheme.every((_, i) => setWeights[i + 1])

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-start gap-2 flex-1">
            <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: dayColor }}>{index}</span>
            <p className="text-white font-semibold text-sm leading-snug">{exercise.name}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={onHistory} className="p-1.5 rounded-lg bg-white/5 active:bg-white/10">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </button>
            <button onClick={onComment} className="p-1.5 rounded-lg bg-white/5 active:bg-white/10">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className={comment ? 'text-indigo-400' : 'text-gray-500'}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {/* Warmup sets */}
          {warmupCount > 0 && (
            <>
              {WARMUP_DEFS.slice(0, warmupCount).map(({ key, label, reps, pct }) => {
                const autoWeight = s1Weight ? Math.round(s1Weight * pct) : null
                const displayWeight = setWeights[key] ?? autoWeight
                const isEditingThis = editingWeightKey === key
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-amber-500/50 text-xs w-7 shrink-0">{label}</span>
                    <span className="text-gray-600 text-xs w-12 shrink-0">{reps}</span>
                    <div className="flex-1 flex items-center gap-2 justify-end">
                      {isEditingThis ? (
                        <div className="flex items-center gap-1">
                          <input autoFocus type="number" inputMode="decimal" value={inputVal}
                            onChange={e => setInputVal(e.target.value)} onBlur={commitEdit}
                            onKeyDown={e => e.key === 'Enter' && commitEdit()}
                            className="w-16 bg-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:ring-1 focus:ring-amber-500/50"
                            placeholder="0" />
                          <span className="text-gray-400 text-xs">kg</span>
                        </div>
                      ) : (
                        <button onClick={() => startEditWarmup(key, pct)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium min-w-[58px] text-center transition-colors active:scale-95 ${
                            displayWeight != null ? 'bg-amber-500/10 text-amber-600/70' : 'bg-white/5 text-gray-600 border border-amber-500/10 border-dashed'
                          }`}>
                          {displayWeight != null ? `${displayWeight}kg` : '—kg'}
                        </button>
                      )}
                      <span className="w-20 text-center text-[9px] text-amber-500/40 font-semibold uppercase tracking-widest">WARMUP</span>
                    </div>
                  </div>
                )
              })}
              <div className="border-t border-white/5 my-0.5" />
            </>
          )}

          {/* Working sets */}
          {exercise.repScheme.map((reps, i) => {
            const setNum = i + 1
            const w = setWeights[setNum]
            const isEditing = editingWeightKey === setNum
            const currentRating = setRatings[setNum]
            const repLog = repLogs[setNum]
            const isFailure = repLog?.toFailure ?? false

            return (
              <div key={i}>
                {/* Main set row */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs w-7 shrink-0">S{setNum}</span>
                  <span className="text-gray-400 text-xs w-12 shrink-0">{reps}r</span>
                  <div className="flex-1 flex items-center gap-2 justify-end">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus type="number" inputMode="decimal" value={inputVal}
                          onChange={e => setInputVal(e.target.value)} onBlur={commitEdit}
                          onKeyDown={e => e.key === 'Enter' && commitEdit()}
                          className="w-16 bg-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="0" />
                        <span className="text-gray-400 text-xs">kg</span>
                      </div>
                    ) : (
                      <button onClick={() => startEditSet(i)}
                        className={`px-2 py-1.5 rounded-lg text-sm font-medium min-w-[58px] text-center transition-colors active:scale-95 ${
                          w ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500 border border-white/10 border-dashed'
                        }`}>
                        {w ? `${w}kg` : '—kg'}
                      </button>
                    )}
                    <div className="flex gap-1">
                      {RATING_CONFIG.map(({ key, label, active }) => (
                        <button key={key} onClick={() => onRate(setNum, key)}
                          className={`w-6 h-6 rounded-md text-[10px] font-bold transition-colors ${
                            currentRating === key ? active : 'bg-white/5 text-gray-600 active:bg-white/10'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Reps + failure sub-row — appears once the set is rated */}
                {currentRating && (
                  <div className="ml-7 mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={getRepValue(setNum)}
                      onChange={e => setRepEdits(prev => ({ ...prev, [setNum]: e.target.value }))}
                      onBlur={() => commitRep(setNum)}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                      placeholder="reps"
                      className="w-12 bg-white/5 rounded-lg px-1.5 py-1 text-[11px] text-white text-center outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <span className="text-gray-600 text-[11px]">reps</span>
                    <button
                      type="button"
                      onClick={() => toggleFailure(setNum)}
                      className={`text-[10px] px-2 py-1 rounded-lg transition-colors font-medium ${
                        isFailure ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-600'
                      }`}
                    >
                      {isFailure ? '● fail' : '○ fail'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {restTimer && (
            <RestTimerPill timer={restTimer} onSkip={onSkipTimer} onAdd15={() => onAddTime(15)} />
          )}
        </div>

        {/* Progression banner */}
        {suggestion?.status === 'increase' ? (
          <div className="mt-3 px-3 py-2 bg-emerald-500/10 rounded-xl">
            <p className="text-emerald-400 text-xs font-medium">
              ↑ {suggestion.reason} — +{suggestion.increase}kg pre-filled above
            </p>
          </div>
        ) : suggestion?.status === 'hold' || suggestion?.status === 'review' ? (
          <div className="mt-3 px-3 py-2 bg-amber-500/10 rounded-xl">
            <p className="text-amber-400 text-xs font-medium">{suggestion.reason}</p>
          </div>
        ) : allWeightsLogged ? (
          <div className="mt-3 px-3 py-2 bg-white/5 rounded-xl">
            <p className="text-gray-500 text-xs">Rate each set · log reps · drives your progressive overload</p>
          </div>
        ) : null}

        {exercise.note && (
          <p className="text-gray-500 text-xs mt-2 italic">{exercise.note}</p>
        )}

        {comment && (
          <div className="mt-2 px-3 py-2 bg-indigo-500/10 rounded-xl">
            <p className="text-indigo-300 text-xs">"{comment}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function RestTimerPill({ timer, onSkip, onAdd15 }) {
  const { secondsLeft, totalSeconds, done } = timer
  const pct  = done ? 0 : (secondsLeft / totalSeconds) * 100
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className={`mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2 ${done ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
      <span className={`text-[10px] font-semibold tracking-widest uppercase shrink-0 ${done ? 'text-emerald-500/70' : 'text-amber-500/60'}`}>
        {done ? 'go!' : 'rest'}
      </span>
      <span className={`text-sm font-mono font-bold tabular-nums shrink-0 w-9 ${done ? 'text-emerald-400' : 'text-white'}`}>
        {done ? '0:00' : `${mins}:${String(secs).padStart(2, '0')}`}
      </span>
      <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-[950ms] ${done ? 'bg-emerald-500/40' : 'bg-amber-500/50'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!done ? (
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onAdd15} className="text-[11px] text-gray-500 active:text-white px-0.5">+15</button>
          <span className="text-gray-700 text-[10px]">·</span>
          <button type="button" onClick={onSkip} className="text-[11px] text-gray-500 active:text-white px-0.5">skip</button>
        </div>
      ) : (
        <button type="button" onClick={onSkip} className="text-emerald-400 text-[11px] font-bold active:text-emerald-300 shrink-0">✓</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function CommentModal({ exercise, existing, onSave, onClose }) {
  const [text, setText] = useState(existing)
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1e1e2a] rounded-t-3xl p-5">
        <h2 className="text-white font-bold mb-1">{exercise.name}</h2>
        <p className="text-gray-400 text-sm mb-4">Session note</p>
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
          placeholder="e.g. Increased to 80kg, felt strong, shoulder fine..."
          rows={3}
          className="w-full bg-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500 resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm">Cancel</button>
          <button onClick={() => onSave(text)} className="flex-1 py-3 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600">Save</button>
        </div>
      </div>
    </div>
  )
}

function HistoryModal({ exercise, onClose }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('exercise_weight_history').select('*')
        .eq('exercise_id', exercise.id)
        .order('log_date', { ascending: true })
      if (error) console.error('fetchHistory error:', error.message)
      if (data) setHistory(data)
      setLoading(false)
    }
    load()
  }, [exercise.id])

  const chartData = history.map(h => {
    const vals = Object.values(h.weights).map(Number).filter(n => !isNaN(n) && n > 0)
    return {
      date: new Date(h.log_date + 'T12:00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
      top: vals.length ? Math.max(...vals) : 0,
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1e1e2a] rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold">{exercise.name}</h2>
            <p className="text-gray-400 text-sm">Weight history</p>
          </div>
          <button onClick={onClose} className="text-gray-400 p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-center py-12">Loading...</p>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📈</p>
            <p className="text-white font-semibold">No history yet</p>
            <p className="text-gray-400 text-sm mt-1">Log weights and they'll show up here as a trend over time</p>
          </div>
        ) : (
          <>
            {chartData.length > 1 && (
              <div className="mb-5">
                <p className="text-gray-400 text-xs mb-3">Top set weight per session (kg)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#12121a', border: '1px solid #ffffff15', borderRadius: 10 }}
                      labelStyle={{ color: '#e5e7eb', fontSize: 12, marginBottom: 2 }}
                      itemStyle={{ color: '#818cf8', fontSize: 12 }}
                      formatter={v => [`${v} kg`, 'Top set']}
                    />
                    <Line type="monotone" dataKey="top" stroke="#818cf8" strokeWidth={2.5}
                      dot={{ fill: '#818cf8', r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="space-y-2">
              {[...history].reverse().map(h => (
                <div key={h.id} className="bg-white/5 rounded-xl px-4 py-3">
                  <p className="text-white text-sm font-semibold mb-1.5">
                    {new Date(h.log_date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {Object.entries(h.weights)
                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                      .map(([set, w]) => (
                        <span key={set} className="text-gray-400 text-xs">
                          S{set}: <span className="text-white font-medium">{w} kg</span>
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
