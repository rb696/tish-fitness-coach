import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'

const START_WEIGHT = 73
const STEP_GOAL = 8000
const TODAY = new Date().toISOString().split('T')[0]

const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-gray-500">
    <polyline points="3 6 5 6 21 6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
)
const Chevron = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
    className={`text-gray-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

// ── Week helpers ──────────────────────────────────────────────────────────────
function getWeekMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return mon.toISOString().split('T')[0]
}

function groupByWeek(logs) {
  const map = {}
  for (const log of logs) {
    const key = getWeekMonday(log.logged_date)
    if (!map[key]) map[key] = { weekKey: key, entries: [] }
    map[key].entries.push(log)
  }
  return Object.values(map).sort((a, b) => b.weekKey.localeCompare(a.weekKey))
}

function fmtWeekRange(weekKey) {
  const mon = new Date(weekKey + 'T00:00:00')
  const sun = new Date(weekKey + 'T00:00:00')
  sun.setDate(mon.getDate() + 6)
  const o = { day: 'numeric', month: 'short' }
  return `${mon.toLocaleDateString('en-AU', o)} – ${sun.toLocaleDateString('en-AU', o)}`
}

const fmtDate = d =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

// ─────────────────────────────────────────────────────────────────────────────
export default function Weight() {
  const [activeTab, setActiveTab]               = useState('main')
  const [historyTab, setHistoryTab]             = useState('weight')
  const [expandedWeightWeek, setExpandedWeightWeek] = useState(null)
  const [expandedStepWeek,   setExpandedStepWeek]   = useState(null)

  // weight state
  const [logs, setLogs]               = useState([])
  const [inputWeight, setInputWeight] = useState('')
  const [inputDate, setInputDate]     = useState(TODAY)
  const [saving, setSaving]           = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [editingLog, setEditingLog]   = useState(null)
  const [editWeight, setEditWeight]   = useState('')
  const [editDate, setEditDate]       = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // steps state
  const [stepLogs, setStepLogs]           = useState([])
  const [inputSteps, setInputSteps]       = useState('')
  const [inputStepDate, setInputStepDate] = useState(TODAY)
  const [savingSteps, setSavingSteps]     = useState(false)
  const [showStepForm, setShowStepForm]   = useState(false)
  const [editingStep, setEditingStep]     = useState(null)
  const [editSteps, setEditSteps]         = useState('')
  const [editStepDate, setEditStepDate]   = useState('')
  const [confirmDeleteStepId, setConfirmDeleteStepId] = useState(null)

  useEffect(() => { fetchLogs(); fetchStepLogs() }, [])

  // ── Weight CRUD ────────────────────────────────────────────────────────────
  async function fetchLogs() {
    const { data } = await supabase.from('weight_logs').select('*').order('logged_date', { ascending: true })
    if (data) setLogs(data)
  }
  async function saveWeight() {
    if (!inputWeight || isNaN(inputWeight)) return
    setSaving(true)
    await supabase.from('weight_logs').upsert(
      { logged_date: inputDate, weight_kg: parseFloat(inputWeight) },
      { onConflict: 'logged_date' }
    )
    await fetchLogs(); setInputWeight(''); setShowForm(false); setSaving(false)
  }
  function startEdit(log) {
    setEditingLog(log); setEditWeight(String(log.weight_kg)); setEditDate(log.logged_date); setConfirmDeleteId(null)
  }
  async function saveEdit() {
    if (!editWeight || isNaN(editWeight) || !editDate) return
    await supabase.from('weight_logs').update({ logged_date: editDate, weight_kg: parseFloat(editWeight) }).eq('id', editingLog.id)
    setEditingLog(null); await fetchLogs()
  }
  async function deleteLog(id) {
    await supabase.from('weight_logs').delete().eq('id', id)
    setConfirmDeleteId(null); await fetchLogs()
  }

  // ── Steps CRUD ─────────────────────────────────────────────────────────────
  async function fetchStepLogs() {
    const { data } = await supabase.from('step_logs').select('*').order('logged_date', { ascending: true })
    if (data) setStepLogs(data)
  }
  async function saveSteps() {
    if (!inputSteps || isNaN(inputSteps)) return
    setSavingSteps(true)
    await supabase.from('step_logs').upsert(
      { logged_date: inputStepDate, steps: parseInt(inputSteps, 10) },
      { onConflict: 'logged_date' }
    )
    await fetchStepLogs(); setInputSteps(''); setShowStepForm(false); setSavingSteps(false)
  }
  function startEditStep(log) {
    setEditingStep(log); setEditSteps(String(log.steps)); setEditStepDate(log.logged_date); setConfirmDeleteStepId(null)
  }
  async function saveEditStep() {
    if (!editSteps || isNaN(editSteps) || !editStepDate) return
    await supabase.from('step_logs').update({ logged_date: editStepDate, steps: parseInt(editSteps, 10) }).eq('id', editingStep.id)
    setEditingStep(null); await fetchStepLogs()
  }
  async function deleteStepLog(id) {
    await supabase.from('step_logs').delete().eq('id', id)
    setConfirmDeleteStepId(null); await fetchStepLogs()
  }

  // ── Weight derived ─────────────────────────────────────────────────────────
  const chartData = logs.map(l => ({
    date: new Date(l.logged_date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    weight: l.weight_kg,
  }))
  const latest    = logs[logs.length - 1]?.weight_kg ?? START_WEIGHT
  const first     = logs[0]?.weight_kg ?? START_WEIGHT
  const change    = (latest - first).toFixed(1)
  const changePos = parseFloat(change) >= 0

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekLogs = logs.filter(l => new Date(l.logged_date + 'T00:00:00') >= sevenDaysAgo)
  let weeklyTrend = null
  if (weekLogs.length >= 2) {
    const wDiff = parseFloat((weekLogs[weekLogs.length - 1].weight_kg - weekLogs[0].weight_kg).toFixed(1))
    const fD = d => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    weeklyTrend = {
      range: `${fD(weekLogs[0].logged_date)} – ${fD(weekLogs[weekLogs.length - 1].logged_date)}`,
      label: wDiff < 0 ? `Lost ${Math.abs(wDiff)}kg` : wDiff > 0 ? `Gained ${wDiff}kg` : 'No change',
      positive: wDiff <= 0,
    }
  }

  // ── Steps derived ──────────────────────────────────────────────────────────
  const todayEntry     = stepLogs.find(l => l.logged_date === TODAY)
  const todaySteps     = todayEntry?.steps ?? null
  const todayPct       = todaySteps ? Math.min((todaySteps / STEP_GOAL) * 100, 100) : 0
  const todayHit       = todaySteps !== null && todaySteps >= STEP_GOAL
  const weekStepLogs   = stepLogs.filter(l => new Date(l.logged_date + 'T00:00:00') >= sevenDaysAgo)
  const weeklyAvgSteps = weekStepLogs.length > 0
    ? Math.round(weekStepLogs.reduce((s, l) => s + l.steps, 0) / weekStepLogs.length)
    : null
  const daysHitGoal    = weekStepLogs.filter(l => l.steps >= STEP_GOAL).length

  // ── History weekly grouping ────────────────────────────────────────────────
  const weightWeeks = groupByWeek(logs).map((w, i, arr) => ({
    ...w,
    avg:     parseFloat((w.entries.reduce((s, e) => s + e.weight_kg, 0) / w.entries.length).toFixed(1)),
    prevAvg: arr[i + 1]
      ? parseFloat((arr[i + 1].entries.reduce((s, e) => s + e.weight_kg, 0) / arr[i + 1].entries.length).toFixed(1))
      : null,
  }))
  const stepWeeks = groupByWeek(stepLogs).map(w => ({
    ...w,
    avg:     Math.round(w.entries.reduce((s, e) => s + e.steps, 0) / w.entries.length),
    daysHit: w.entries.filter(e => e.steps >= STEP_GOAL).length,
  }))

  const tabs = [
    { id: 'main',    label: 'Overview', color: '#6366f1' },
    { id: 'history', label: 'History',  color: '#6366f1' },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pb-28 max-w-lg mx-auto">
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Weight & Steps</h1>
        <p className="text-gray-400 text-sm mt-1">
          {activeTab === 'main' ? 'Track your recomp progress' : 'Weekly averages · tap a week to see daily entries'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="px-4 flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === t.id ? 'text-white' : 'bg-white/5 text-gray-400'
            }`}
            style={activeTab === t.id ? { background: t.color } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {activeTab === 'main' && (
        <div className="px-4">

          {/* — WEIGHT — */}
          <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-3">Weight</p>
          <div className="space-y-4">

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1e1e2a] rounded-2xl p-3 border border-white/5 text-center">
                <p className="text-gray-400 text-[10px] mb-1">Start</p>
                <p className="text-white font-bold text-lg">{first}kg</p>
              </div>
              <div className="bg-[#1e1e2a] rounded-2xl p-3 border border-white/5 text-center">
                <p className="text-gray-400 text-[10px] mb-1">Current</p>
                <p className="text-white font-bold text-lg">{latest}kg</p>
              </div>
              <div className="bg-[#1e1e2a] rounded-2xl p-3 border border-white/5 text-center">
                <p className="text-gray-400 text-[10px] mb-1">Change</p>
                <p className={`font-bold text-lg ${changePos ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {changePos ? '+' : ''}{change}kg
                </p>
              </div>
            </div>

            <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
              <p className="text-gray-400 text-[10px] font-semibold tracking-widest uppercase mb-2">This Week</p>
              {weeklyTrend ? (
                <div className="flex items-center justify-between">
                  <p className="text-gray-500 text-xs">{weeklyTrend.range}</p>
                  <p className={`font-bold text-base ${weeklyTrend.positive ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {weeklyTrend.label}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Log at least 2 weigh-ins this week</p>
              )}
            </div>

            <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
              <p className="text-white font-semibold text-sm mb-4">Progress Graph</p>
              {chartData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e1e2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                      labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                      formatter={val => [`${val}kg`, 'Weight']}
                    />
                    <ReferenceLine y={START_WEIGHT} stroke="#6366f133" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2}
                      dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#6366f1' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <p className="text-gray-500 text-sm text-center">Log at least 2 entries<br />to see your graph</p>
                </div>
              )}
            </div>

            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                className="w-full py-3.5 rounded-2xl bg-indigo-500 text-white font-semibold active:bg-indigo-600 transition-colors">
                + Log Weight
              </button>
            ) : (
              <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
                <p className="text-white font-semibold mb-4">Log Weight</p>
                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs mb-1 block">Weight (kg)</label>
                    <input autoFocus type="number" step="0.1" value={inputWeight}
                      onChange={e => setInputWeight(e.target.value)} placeholder="73.0"
                      onKeyDown={e => e.key === 'Enter' && saveWeight()}
                      className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs mb-1 block">Date</label>
                    <input type="date" value={inputDate} onChange={e => setInputDate(e.target.value)}
                      className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)}
                    className="flex-1 py-2.5 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm">Cancel</button>
                  <button onClick={saveWeight} disabled={saving}
                    className="flex-1 py-2.5 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 my-7" />

          {/* — STEPS — */}
          <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-3">Steps</p>
          <div className="space-y-4">

            {/* Today + 7-day avg card */}
            <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
              <div className="flex items-start justify-between mb-3">
                <p className="text-gray-400 text-[10px] font-semibold tracking-widest uppercase">Today</p>
                {weeklyAvgSteps !== null && (
                  <div className="text-right">
                    <p className="text-gray-500 text-[10px]">7-day avg</p>
                    <p className="text-gray-300 text-xs font-semibold">{weeklyAvgSteps.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {todaySteps !== null ? (
                <>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className={`text-3xl font-bold ${todayHit ? 'text-emerald-400' : 'text-white'}`}>
                      {todaySteps.toLocaleString()}
                    </span>
                    <span className="text-gray-500 text-sm">steps</span>
                    {todayHit && <span className="text-emerald-400 text-[11px] font-semibold ml-1">✓ Goal reached</span>}
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${todayHit ? 'bg-emerald-500' : 'bg-amber-500/70'}`}
                      style={{ width: `${todayPct}%` }} />
                  </div>
                  <p className="text-gray-600 text-[10px]">
                    {todayHit
                      ? weekStepLogs.length > 1 ? `${daysHitGoal}/${weekStepLogs.length} days hit 8k this week` : 'Goal 8,000 steps'
                      : `${(STEP_GOAL - todaySteps).toLocaleString()} to go${weekStepLogs.length > 0 ? ` · ${daysHitGoal}/${weekStepLogs.length} days hit 8k` : ''}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 text-sm mb-3">Not logged today</p>
                  <div className="h-1.5 bg-white/5 rounded-full mb-1.5" />
                  <p className="text-gray-700 text-[10px]">
                    {weekStepLogs.length > 0 ? `${daysHitGoal}/${weekStepLogs.length} days hit 8k this week` : 'Goal: 8,000 steps'}
                  </p>
                </>
              )}
            </div>

            {!showStepForm ? (
              <button onClick={() => setShowStepForm(true)}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-semibold active:bg-emerald-700 transition-colors">
                + Log Steps
              </button>
            ) : (
              <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
                <p className="text-white font-semibold mb-4">Log Steps</p>
                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs mb-1 block">Steps</label>
                    <input autoFocus type="number" inputMode="numeric" value={inputSteps}
                      onChange={e => setInputSteps(e.target.value)} placeholder="8000"
                      onKeyDown={e => e.key === 'Enter' && saveSteps()}
                      className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <label className="text-gray-400 text-xs mb-1 block">Date</label>
                    <input type="date" value={inputStepDate} onChange={e => setInputStepDate(e.target.value)}
                      className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowStepForm(false)}
                    className="flex-1 py-2.5 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm">Cancel</button>
                  <button onClick={saveSteps} disabled={savingSteps}
                    className="flex-1 py-2.5 rounded-2xl bg-emerald-600 text-white font-semibold text-sm active:bg-emerald-700 disabled:opacity-50">
                    {savingSteps ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ HISTORY ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div>
          {/* History sub-tabs */}
          <div className="px-4 flex gap-2 mb-4">
            {[
              { id: 'weight', label: 'Weigh-ins' },
              { id: 'steps',  label: 'Steps' },
            ].map(t => (
              <button key={t.id} onClick={() => setHistoryTab(t.id)}
                className={`px-3.5 py-1 rounded-full text-sm font-medium border transition-colors ${
                  historyTab === t.id
                    ? t.id === 'weight'
                      ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-transparent text-gray-500 border-white/10'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="px-4">

            {/* ── Weigh-ins: weekly accordion ─────────────────────────────── */}
            {historyTab === 'weight' && (
              weightWeeks.length === 0 ? (
                <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-6 text-center">
                  <p className="text-gray-500 text-sm">No weigh-ins logged yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {weightWeeks.map(week => {
                    const isOpen = expandedWeightWeek === week.weekKey
                    const delta = week.prevAvg !== null
                      ? parseFloat((week.avg - week.prevAvg).toFixed(1))
                      : null
                    return (
                      <div key={week.weekKey} className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">

                        {/* Week summary */}
                        <button type="button"
                          onClick={() => setExpandedWeightWeek(isOpen ? null : week.weekKey)}
                          className="w-full flex items-center px-4 py-3.5 text-left active:bg-white/[0.03]">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-500 text-xs mb-0.5">{fmtWeekRange(week.weekKey)}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold">avg {week.avg}kg</span>
                              {delta !== null && (
                                <span className={`text-xs font-medium ${
                                  delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-amber-400' : 'text-gray-500'
                                }`}>
                                  {delta < 0 ? `↓ ${Math.abs(delta)}kg` : delta > 0 ? `↑ ${delta}kg` : '–'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-gray-600 text-xs">
                              {week.entries.length} {week.entries.length === 1 ? 'entry' : 'entries'}
                            </span>
                            <Chevron open={isOpen} />
                          </div>
                        </button>

                        {/* Daily entries */}
                        {isOpen && (
                          <div className="border-t border-white/5">
                            {[...week.entries]
                              .sort((a, b) => b.logged_date.localeCompare(a.logged_date))
                              .map((log, i, arr) => {
                                const isLast = i === arr.length - 1
                                if (editingLog?.id === log.id) return (
                                  <div key={log.id} className={`px-4 py-3 bg-indigo-500/5 ${!isLast ? 'border-b border-white/5' : ''}`}>
                                    <div className="flex gap-2 mb-3">
                                      <div className="flex-1">
                                        <label className="text-gray-500 text-[10px] mb-1 block">Weight (kg)</label>
                                        <input autoFocus type="number" step="0.1" value={editWeight}
                                          onChange={e => setEditWeight(e.target.value)}
                                          onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                          className="w-full bg-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                                      </div>
                                      <div className="flex-1">
                                        <label className="text-gray-500 text-[10px] mb-1 block">Date</label>
                                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                                          className="w-full bg-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-500" />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button type="button" onClick={() => setEditingLog(null)}
                                        className="flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-sm active:bg-white/10">Cancel</button>
                                      <button type="button" onClick={saveEdit}
                                        className="flex-1 py-2 rounded-xl bg-indigo-500 text-white text-sm active:bg-indigo-600">Save</button>
                                    </div>
                                  </div>
                                )
                                if (confirmDeleteId === log.id) return (
                                  <div key={log.id} className={`px-4 py-3 flex items-center gap-3 bg-red-500/5 ${!isLast ? 'border-b border-white/5' : ''}`}>
                                    <p className="text-gray-300 text-sm flex-1">Delete this entry?</p>
                                    <button type="button" onClick={() => setConfirmDeleteId(null)}
                                      className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-sm active:bg-white/10">Cancel</button>
                                    <button type="button" onClick={() => deleteLog(log.id)}
                                      className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium active:bg-red-500/25">Delete</button>
                                  </div>
                                )
                                return (
                                  <div key={log.id} className={`flex items-center px-4 py-3 ${!isLast ? 'border-b border-white/5' : ''}`}>
                                    <span className="text-gray-400 text-sm flex-1">{fmtDate(log.logged_date)}</span>
                                    <span className="text-white font-semibold mr-3">{log.weight_kg}kg</span>
                                    <div className="flex gap-1">
                                      <button type="button" onClick={() => startEdit(log)} className="p-1.5 rounded-lg bg-white/5 active:bg-white/10"><PencilIcon /></button>
                                      <button type="button" onClick={() => { setConfirmDeleteId(log.id); setEditingLog(null) }} className="p-1.5 rounded-lg bg-white/5 active:bg-white/10"><TrashIcon /></button>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* ── Steps: weekly accordion ──────────────────────────────────── */}
            {historyTab === 'steps' && (
              stepWeeks.length === 0 ? (
                <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-6 text-center">
                  <p className="text-gray-500 text-sm">No step logs yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stepWeeks.map(week => {
                    const isOpen    = expandedStepWeek === week.weekKey
                    const avgHit    = week.avg >= STEP_GOAL
                    const rateGood  = week.daysHit >= Math.ceil(week.entries.length / 2)
                    return (
                      <div key={week.weekKey} className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">

                        {/* Week summary */}
                        <button type="button"
                          onClick={() => setExpandedStepWeek(isOpen ? null : week.weekKey)}
                          className="w-full flex items-center px-4 py-3.5 text-left active:bg-white/[0.03]">
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-500 text-xs mb-0.5">{fmtWeekRange(week.weekKey)}</p>
                            <div className="flex items-center gap-2.5">
                              <span className={`font-bold ${avgHit ? 'text-emerald-400' : 'text-white'}`}>
                                avg {week.avg.toLocaleString()}
                              </span>
                              <span className={`text-xs font-medium ${rateGood ? 'text-emerald-400' : 'text-gray-500'}`}>
                                {week.daysHit}/{week.entries.length} hit 8k
                              </span>
                            </div>
                          </div>
                          <Chevron open={isOpen} />
                        </button>

                        {/* Daily entries */}
                        {isOpen && (
                          <div className="border-t border-white/5">
                            {[...week.entries]
                              .sort((a, b) => b.logged_date.localeCompare(a.logged_date))
                              .map((log, i, arr) => {
                                const hitGoal = log.steps >= STEP_GOAL
                                const pct     = Math.min((log.steps / STEP_GOAL) * 100, 100)
                                const isLast  = i === arr.length - 1
                                if (editingStep?.id === log.id) return (
                                  <div key={log.id} className={`px-4 py-3 bg-emerald-500/5 ${!isLast ? 'border-b border-white/5' : ''}`}>
                                    <div className="flex gap-2 mb-3">
                                      <div className="flex-1">
                                        <label className="text-gray-500 text-[10px] mb-1 block">Steps</label>
                                        <input autoFocus type="number" inputMode="numeric" value={editSteps}
                                          onChange={e => setEditSteps(e.target.value)}
                                          onKeyDown={e => e.key === 'Enter' && saveEditStep()}
                                          className="w-full bg-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                                      </div>
                                      <div className="flex-1">
                                        <label className="text-gray-500 text-[10px] mb-1 block">Date</label>
                                        <input type="date" value={editStepDate} onChange={e => setEditStepDate(e.target.value)}
                                          className="w-full bg-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-emerald-500" />
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button type="button" onClick={() => setEditingStep(null)}
                                        className="flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-sm active:bg-white/10">Cancel</button>
                                      <button type="button" onClick={saveEditStep}
                                        className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm active:bg-emerald-700">Save</button>
                                    </div>
                                  </div>
                                )
                                if (confirmDeleteStepId === log.id) return (
                                  <div key={log.id} className={`px-4 py-3 flex items-center gap-3 bg-red-500/5 ${!isLast ? 'border-b border-white/5' : ''}`}>
                                    <p className="text-gray-300 text-sm flex-1">Delete this entry?</p>
                                    <button type="button" onClick={() => setConfirmDeleteStepId(null)}
                                      className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-sm active:bg-white/10">Cancel</button>
                                    <button type="button" onClick={() => deleteStepLog(log.id)}
                                      className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium active:bg-red-500/25">Delete</button>
                                  </div>
                                )
                                return (
                                  <div key={log.id} className={`px-4 pt-3 pb-2.5 ${!isLast ? 'border-b border-white/5' : ''}`}>
                                    <div className="flex items-center mb-2">
                                      <span className="text-gray-400 text-sm flex-1">{fmtDate(log.logged_date)}</span>
                                      <div className="flex items-center gap-1.5 mr-3">
                                        {hitGoal && (
                                          <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">✓</span>
                                        )}
                                        <span className={`font-semibold text-sm ${hitGoal ? 'text-emerald-400' : 'text-white'}`}>
                                          {log.steps.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="flex gap-1">
                                        <button type="button" onClick={() => startEditStep(log)} className="p-1.5 rounded-lg bg-white/5 active:bg-white/10"><PencilIcon /></button>
                                        <button type="button" onClick={() => { setConfirmDeleteStepId(log.id); setEditingStep(null) }} className="p-1.5 rounded-lg bg-white/5 active:bg-white/10"><TrashIcon /></button>
                                      </div>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${hitGoal ? 'bg-emerald-500' : 'bg-amber-500/60'}`}
                                        style={{ width: `${pct}%` }} />
                                    </div>
                                    {!hitGoal && (
                                      <p className="text-gray-600 text-[10px] mt-1">{(STEP_GOAL - log.steps).toLocaleString()} to go</p>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )}

          </div>
        </div>
      )}
    </div>
  )
}
