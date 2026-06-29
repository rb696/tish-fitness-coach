import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MACRO_TARGETS, MEAL_PLAN, SUPPLEMENTS } from '../data/mealPlan'
import { WORKOUT_DAYS } from '../data/workoutPlan'
import { supabase } from '../lib/supabase'

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
  const todayWorkout = getTodayWorkout()
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: wl } = await supabase.from('weight_logs').select('*').order('logged_date', { ascending: false }).limit(5)
    const { data: sl } = await supabase.from('supplement_logs').select('*').eq('log_date', todayStr).single()
    if (wl) setWeightLogs(wl)
    if (sl) setSupplementLog(sl.supplements || {})
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
        <StatCard label="Daily Calories" value="2,500" sub="target" color="emerald" />
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
  let next = MEAL_PLAN[0]
  if (hour >= 12 && hour < 15) next = MEAL_PLAN[1]
  else if (hour >= 15 && hour < 19) next = MEAL_PLAN[2]
  else if (hour >= 19) next = MEAL_PLAN[3]

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

function SectionTitle({ children }) {
  return <h2 className="text-white font-semibold text-base mb-3">{children}</h2>
}
