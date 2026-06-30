import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MACRO_TARGETS, MEAL_PLAN, SUPPLEMENTS } from '../data/mealPlan'
import { WORKOUT_DAYS } from '../data/workoutPlan'
import { supabase } from '../lib/supabase'
import { computeProgression } from '../lib/progression'

const DAY_ORDER = ['push', 'pull', 'legs', 'chest_arms']

function getTodayWorkout() {
  const day = new Date().getDay()
  // Mon=Push, Tue=Pull, Wed=Legs, Thu=Chest&Arms, rest=rest
  const map = { 1: 0, 2: 1, 3: 2, 4: 3 }
  const idx = map[day]
  return idx !== undefined ? WORKOUT_DAYS[idx] : null
}

export default function Home() {
  const navigate = useNavigate()
  const [weightLogs, setWeightLogs] = useState([])
  const [supplementLog, setSupplementLog] = useState({})
  const [progressionData, setProgressionData] = useState([])
  const todayWorkout = getTodayWorkout()
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const todayStr = new Date().toISOString().split('T')[0]
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [{ data: wl }, { data: sl }, { data: allRatings }, { data: histData }, { data: sessions }] = await Promise.all([
      supabase.from('weight_logs').select('*').order('logged_date', { ascending: false }).limit(5),
      supabase.from('supplement_logs').select('*').eq('log_date', todayStr).single(),
      supabase.from('set_ratings').select('*').gte('log_date', thirtyAgo),
      supabase.from('exercise_weight_history').select('*').order('log_date', { ascending: false }).limit(100),
      supabase.from('workout_sessions').select('saved_at').gte('saved_at', thirtyAgo + 'T00:00:00'),
    ])

    if (wl) setWeightLogs(wl)
    if (sl) setSupplementLog(sl.supplements || {})
    if (allRatings && histData) {
      // Only trust ratings whose date has a saved session (or is today for in-progress sets).
      // This filters out orphaned rows left behind by deleted sessions.
      const validDates = new Set([
        todayStr,
        ...(sessions || []).map(s => s.saved_at.split('T')[0]),
      ])
      const liveRatings = allRatings.filter(r => validDates.has(r.log_date))
      const prog = computeProgression(liveRatings, histData)
      setProgressionData(Object.values(prog))
    }
  }

  const latestWeight = weightLogs[0]?.weight_kg ?? 73
  const supplementsDone = Object.values(supplementLog).filter(Boolean).length

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <p className="text-gray-400 text-sm">{today}</p>
        <h1 className="text-2xl font-bold text-white mt-1">Hey, let's get it 💪</h1>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Current Weight" value={`${latestWeight}kg`} sub="target: recomp" color="indigo" />
        <StatCard label="Daily Calories" value={MACRO_TARGETS.calories.toLocaleString()} sub="target" color="emerald" />
        <StatCard label="Supplements" value={`${supplementsDone}/6`} sub="today" color="amber" />
      </div>

      {/* Today's workout */}
      <div className="mb-6">
        <SectionTitle>Today's Session</SectionTitle>
        {todayWorkout ? (
          <button
            onClick={() => navigate('/gym')}
            className="w-full bg-[#1e1e2a] rounded-2xl p-4 text-left border border-white/5 active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-white text-lg">{todayWorkout.name}</span>
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{ background: todayWorkout.color + '22', color: todayWorkout.color }}>
                {todayWorkout.totalSets} sets
              </span>
            </div>
            <div className="space-y-1">
              {todayWorkout.exercises.map(ex => (
                <p key={ex.id} className="text-sm text-gray-400">· {ex.name}</p>
              ))}
            </div>
            <p className="text-indigo-400 text-sm mt-3 font-medium">Open workout →</p>
          </button>
        ) : (
          <div className="bg-[#1e1e2a] rounded-2xl p-4 border border-white/5 text-center">
            <p className="text-2xl mb-1">🛌</p>
            <p className="text-white font-medium">Rest Day</p>
            <p className="text-gray-400 text-sm mt-1">Hit your 10k steps and recover well</p>
          </div>
        )}
      </div>

      {/* Progressive overload summary */}
      <div className="mb-6">
        <SectionTitle>Progressive Overload</SectionTitle>
        <ProgressionWidget data={progressionData} />
      </div>

      {/* Macro snapshot */}
      <div className="mb-6">
        <SectionTitle>Daily Macro Targets</SectionTitle>
        <div className="bg-[#1e1e2a] rounded-2xl p-4 border border-white/5">
          <MacroBar label="Protein" value={MACRO_TARGETS.protein} unit="g" color="#6366f1" max={200} />
          <MacroBar label="Carbs" value={MACRO_TARGETS.carbs} unit="g" color="#10b981" max={400} />
          <MacroBar label="Fat" value={MACRO_TARGETS.fat} unit="g" color="#f59e0b" max={120} />
          <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center">
            <span className="text-gray-400 text-sm">Daily Calories</span>
            <span className="text-white font-bold">{MACRO_TARGETS.calories.toLocaleString()} kcal</span>
          </div>
        </div>
      </div>

      {/* Next meal */}
      <div className="mb-6">
        <SectionTitle>Next Meal</SectionTitle>
        <NextMealCard onClick={() => navigate('/diet')} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  const colors = {
    indigo: 'text-indigo-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
  }
  return (
    <div className="bg-[#1e1e2a] rounded-2xl p-3 border border-white/5">
      <p className="text-gray-400 text-[10px] mb-1 leading-tight">{label}</p>
      <p className={`font-bold text-lg leading-tight ${colors[color]}`}>{value}</p>
      <p className="text-gray-500 text-[10px] mt-0.5">{sub}</p>
    </div>
  )
}

function MacroBar({ label, value, unit, color, max }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{value}{unit}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function NextMealCard({ onClick }) {
  const now = new Date()
  const hour = now.getHours()
  // Morning Coffee → Lunch (12pm) → Dinner (6:30pm) → Pre-Workout (9pm) → Post-Workout (11pm)
  let next = MEAL_PLAN[0]
  if (hour >= 12 && hour < 18) next = MEAL_PLAN[1]
  else if (hour >= 18 && hour < 21) next = MEAL_PLAN[2]
  else if (hour >= 21 && hour < 23) next = MEAL_PLAN[3]
  else if (hour >= 23) next = MEAL_PLAN[4]

  return (
    <button onClick={onClick} className="w-full bg-[#1e1e2a] rounded-2xl p-4 text-left border border-white/5 active:scale-95 transition-transform">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{next.emoji}</span>
          <div>
            <p className="text-white font-semibold">{next.name}</p>
            <p className="text-gray-400 text-xs">{next.time}</p>
          </div>
        </div>
        <span className="text-indigo-400 text-sm font-medium">{next.calories} kcal</span>
      </div>
      <div className="flex gap-3 text-xs text-gray-400">
        <span>P: <span className="text-white">{next.protein}g</span></span>
        <span>C: <span className="text-white">{next.carbs}g</span></span>
        <span>F: <span className="text-white">{next.fat}g</span></span>
      </div>
      <p className="text-indigo-400 text-sm mt-3 font-medium">View meal plan →</p>
    </button>
  )
}

function ProgressionWidget({ data }) {
  const toIncrease = data.filter(d => d.status === 'increase')
  const toReview   = data.filter(d => d.status === 'review')
  const onTrack    = data.filter(d => d.status === 'ok')

  if (data.length === 0) {
    return (
      <div className="bg-[#1e1e2a] rounded-2xl p-4 border border-white/5">
        <p className="text-gray-500 text-sm">Rate your sets during training — progression flags will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-[#1e1e2a] rounded-2xl p-4 border border-white/5 space-y-4">
      {toIncrease.length > 0 && (
        <div>
          <p className="text-emerald-400 text-[10px] font-bold tracking-widest mb-2">INCREASE THIS WEEK</p>
          {toIncrease.map(d => (
            <div key={d.exerciseId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-white text-sm font-medium truncate">{d.exerciseName}</p>
                <p className="text-gray-500 text-xs">{d.reason}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-emerald-400 text-sm font-bold">+{d.increase}kg</p>
                {d.suggested != null && (
                  <p className="text-gray-500 text-xs">→ {d.suggested}kg</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {toReview.length > 0 && (
        <div>
          <p className="text-amber-400 text-[10px] font-bold tracking-widest mb-2">NEEDS REVIEW</p>
          {toReview.map(d => (
            <div key={d.exerciseId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-white text-sm font-medium truncate">{d.exerciseName}</p>
                <p className="text-gray-500 text-xs">{d.reason}</p>
              </div>
              <p className="text-amber-400 text-xs font-medium shrink-0">Hold weight</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        <p className="text-gray-500 text-xs">{onTrack.length} exercise{onTrack.length !== 1 ? 's' : ''} on track</p>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-white font-semibold text-base mb-3">{children}</h2>
}
