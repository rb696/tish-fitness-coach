import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'

const START_WEIGHT = 73
const STEP_GOAL = 8000

// Shared SVG icons
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

export default function Weight() {
  // ── Weight state ──────────────────────────────────────────────────────────
  const [logs, setLogs] = useState([])
  const [inputWeight, setInputWeight] = useState('')
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [editWeight, setEditWeight] = useState('')
  const [editDate, setEditDate] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // ── Steps state ───────────────────────────────────────────────────────────
  const [stepLogs, setStepLogs] = useState([])
  const [inputSteps, setInputSteps] = useState('')
  const [inputStepDate, setInputStepDate] = useState(new Date().toISOString().split('T')[0])
  const [savingSteps, setSavingSteps] = useState(false)
  const [showStepForm, setShowStepForm] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [editSteps, setEditSteps] = useState('')
  const [editStepDate, setEditStepDate] = useState('')
  const [confirmDeleteStepId, setConfirmDeleteStepId] = useState(null)

  useEffect(() => {
    fetchLogs()
    fetchStepLogs()
  }, [])

  // ── Weight functions ──────────────────────────────────────────────────────
  async function fetchLogs() {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .order('logged_date', { ascending: true })
    if (data) setLogs(data)
  }

  async function saveWeight() {
    if (!inputWeight || isNaN(inputWeight)) return
    setSaving(true)
    await supabase.from('weight_logs').upsert(
      { logged_date: inputDate, weight_kg: parseFloat(inputWeight) },
      { onConflict: 'logged_date' }
    )
    await fetchLogs()
    setInputWeight('')
    setShowForm(false)
    setSaving(false)
  }

  function startEdit(log) {
    setEditingLog(log)
    setEditWeight(String(log.weight_kg))
    setEditDate(log.logged_date)
    setConfirmDeleteId(null)
  }

  async function saveEdit() {
    if (!editWeight || isNaN(editWeight) || !editDate) return
    await supabase
      .from('weight_logs')
      .update({ logged_date: editDate, weight_kg: parseFloat(editWeight) })
      .eq('id', editingLog.id)
    setEditingLog(null)
    await fetchLogs()
  }

  async function deleteLog(id) {
    await supabase.from('weight_logs').delete().eq('id', id)
    setConfirmDeleteId(null)
    await fetchLogs()
  }

  // ── Steps functions ───────────────────────────────────────────────────────
  async function fetchStepLogs() {
    const { data } = await supabase
      .from('step_logs')
      .select('*')
      .order('logged_date', { ascending: true })
    if (data) setStepLogs(data)
  }

  async function saveSteps() {
    if (!inputSteps || isNaN(inputSteps)) return
    setSavingSteps(true)
    await supabase.from('step_logs').upsert(
      { logged_date: inputStepDate, steps: parseInt(inputSteps, 10) },
      { onConflict: 'logged_date' }
    )
    await fetchStepLogs()
    setInputSteps('')
    setShowStepForm(false)
    setSavingSteps(false)
  }

  function startEditStep(log) {
    setEditingStep(log)
    setEditSteps(String(log.steps))
    setEditStepDate(log.logged_date)
    setConfirmDeleteStepId(null)
  }

  async function saveEditStep() {
    if (!editSteps || isNaN(editSteps) || !editStepDate) return
    await supabase
      .from('step_logs')
      .update({ logged_date: editStepDate, steps: parseInt(editSteps, 10) })
      .eq('id', editingStep.id)
    setEditingStep(null)
    await fetchStepLogs()
  }

  async function deleteStepLog(id) {
    await supabase.from('step_logs').delete().eq('id', id)
    setConfirmDeleteStepId(null)
    await fetchStepLogs()
  }

  // ── Weight derived ────────────────────────────────────────────────────────
  const chartData = logs.map(l => ({
    date: new Date(l.logged_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    weight: l.weight_kg,
  }))

  const latest = logs[logs.length - 1]?.weight_kg ?? START_WEIGHT
  const first = logs[0]?.weight_kg ?? START_WEIGHT
  const change = (latest - first).toFixed(1)
  const changePos = parseFloat(change) >= 0

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const weekLogs = logs.filter(l => new Date(l.logged_date + 'T00:00:00') >= sevenDaysAgo)
  let weeklyTrend = null
  if (weekLogs.length >= 2) {
    const wFirst = weekLogs[0]
    const wLast = weekLogs[weekLogs.length - 1]
    const wDiff = parseFloat((wLast.weight_kg - wFirst.weight_kg).toFixed(1))
    const fmtD = d => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
    weeklyTrend = {
      diff: wDiff,
      range: `${fmtD(wFirst.logged_date)} – ${fmtD(wLast.logged_date)}`,
      label: wDiff < 0 ? `Lost ${Math.abs(wDiff)}kg` : wDiff > 0 ? `Gained ${wDiff}kg` : 'No change',
      positive: wDiff <= 0,
    }
  }

  // ── Steps derived ─────────────────────────────────────────────────────────
  const weekStepLogs = stepLogs.filter(l => new Date(l.logged_date + 'T00:00:00') >= sevenDaysAgo)
  const weeklyAvgSteps = weekStepLogs.length > 0
    ? Math.round(weekStepLogs.reduce((sum, l) => sum + l.steps, 0) / weekStepLogs.length)
    : null
  const daysHitGoal = weekStepLogs.filter(l => l.steps >= STEP_GOAL).length
  const avgPct = weeklyAvgSteps ? Math.min((weeklyAvgSteps / STEP_GOAL) * 100, 100) : 0

  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="pb-28 max-w-lg mx-auto">

      {/* ── WEIGHT SECTION ── */}
      <div className="px-4 pt-6 mb-6">
        <h1 className="text-2xl font-bold text-white">Weight</h1>
        <p className="text-gray-400 text-sm mt-1">Log weekly · track your recomp progress</p>
      </div>

      {/* Stats */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-6">
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

      {/* Weekly Trend */}
      <div className="px-4 mb-6">
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
            <p className="text-gray-500 text-sm">Not enough data — log at least 2 weigh-ins this week</p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 mb-6">
        <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
          <p className="text-white font-semibold text-sm mb-4">Progress Graph</p>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
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
            <div className="h-48 flex items-center justify-center">
              <p className="text-gray-500 text-sm text-center">Log at least 2 entries<br />to see your graph</p>
            </div>
          )}
        </div>
      </div>

      {/* Log Weight button / form */}
      <div className="px-4 mb-6">
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
                <input type="number" step="0.1" value={inputWeight} onChange={e => setInputWeight(e.target.value)}
                  placeholder="73.0"
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

      {/* Weight History */}
      {logs.length > 0 && (
        <div className="px-4 mb-2">
          <p className="text-white font-semibold text-sm mb-3">History</p>
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
            {[...logs].reverse().slice(0, 20).map((log, i, arr) => {
              const isEditing = editingLog?.id === log.id
              const isConfirmingDelete = confirmDeleteId === log.id
              const isLast = i === arr.length - 1

              if (isEditing) return (
                <div key={log.id} className={`px-4 py-3 bg-indigo-500/5 ${!isLast ? 'border-b border-white/5' : ''}`}>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <label className="text-gray-500 text-[10px] mb-1 block">Weight (kg)</label>
                      <input autoFocus type="number" step="0.1" value={editWeight}
                        onChange={e => setEditWeight(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()}
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
                      className="flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-sm font-medium active:bg-white/10">Cancel</button>
                    <button type="button" onClick={saveEdit}
                      className="flex-1 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium active:bg-indigo-600">Save</button>
                  </div>
                </div>
              )

              if (isConfirmingDelete) return (
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
        </div>
      )}

      {/* ── STEPS SECTION ── */}
      <div className="px-4 pt-8 mb-6">
        <h2 className="text-xl font-bold text-white">Steps</h2>
        <p className="text-gray-400 text-sm mt-1">Goal: 8,000 steps per day</p>
      </div>

      {/* Steps weekly average card */}
      <div className="px-4 mb-6">
        <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
          <p className="text-gray-400 text-[10px] font-semibold tracking-widest uppercase mb-3">7-Day Average</p>
          {weeklyAvgSteps !== null ? (
            <>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <span className={`text-2xl font-bold ${weeklyAvgSteps >= STEP_GOAL ? 'text-emerald-400' : 'text-white'}`}>
                    {weeklyAvgSteps.toLocaleString()}
                  </span>
                  <span className="text-gray-500 text-sm ml-1.5">steps/day</span>
                </div>
                <span className={`text-sm font-semibold ${daysHitGoal >= 5 ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {daysHitGoal}/{weekStepLogs.length} days hit 8k
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${weeklyAvgSteps >= STEP_GOAL ? 'bg-emerald-500' : 'bg-amber-500/70'}`}
                  style={{ width: `${avgPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-gray-600 text-[10px]">0</span>
                <span className="text-gray-600 text-[10px]">8,000 goal</span>
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Log your first day to see your average</p>
          )}
        </div>
      </div>

      {/* Log Steps button / form */}
      <div className="px-4 mb-6">
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
                <input type="number" inputMode="numeric" value={inputSteps} onChange={e => setInputSteps(e.target.value)}
                  placeholder="8000" onKeyDown={e => e.key === 'Enter' && saveSteps()}
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

      {/* Steps History */}
      {stepLogs.length > 0 && (
        <div className="px-4">
          <p className="text-white font-semibold text-sm mb-3">Steps History</p>
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
            {[...stepLogs].reverse().slice(0, 20).map((log, i, arr) => {
              const hitGoal = log.steps >= STEP_GOAL
              const pct = Math.min((log.steps / STEP_GOAL) * 100, 100)
              const isEditing = editingStep?.id === log.id
              const isConfirmingDelete = confirmDeleteStepId === log.id
              const isLast = i === arr.length - 1

              if (isEditing) return (
                <div key={log.id} className={`px-4 py-3 bg-emerald-500/5 ${!isLast ? 'border-b border-white/5' : ''}`}>
                  <div className="flex gap-2 mb-3">
                    <div className="flex-1">
                      <label className="text-gray-500 text-[10px] mb-1 block">Steps</label>
                      <input autoFocus type="number" inputMode="numeric" value={editSteps}
                        onChange={e => setEditSteps(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditStep()}
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
                      className="flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-sm font-medium active:bg-white/10">Cancel</button>
                    <button type="button" onClick={saveEditStep}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium active:bg-emerald-700">Save</button>
                  </div>
                </div>
              )

              if (isConfirmingDelete) return (
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
                    <div
                      className={`h-full rounded-full ${hitGoal ? 'bg-emerald-500' : 'bg-amber-500/60'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!hitGoal && (
                    <p className="text-gray-600 text-[10px] mt-1">{(STEP_GOAL - log.steps).toLocaleString()} to go</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
