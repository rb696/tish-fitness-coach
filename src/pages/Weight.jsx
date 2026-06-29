import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'

const START_WEIGHT = 73

export default function Weight() {
  const [logs, setLogs] = useState([])
  const [inputWeight, setInputWeight] = useState('')
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [])

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

  const chartData = logs.map(l => ({
    date: new Date(l.logged_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    weight: l.weight_kg,
  }))

  const latest = logs[logs.length - 1]?.weight_kg ?? START_WEIGHT
  const first = logs[0]?.weight_kg ?? START_WEIGHT
  const change = (latest - first).toFixed(1)
  const changePos = parseFloat(change) >= 0

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Header */}
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

      {/* Chart */}
      <div className="px-4 mb-6">
        <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
          <p className="text-white font-semibold text-sm mb-4">Progress Graph</p>
          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#1e1e2a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                  labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                  formatter={val => [`${val}kg`, 'Weight']}
                />
                <ReferenceLine y={START_WEIGHT} stroke="#6366f133" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#6366f1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-gray-500 text-sm text-center">Log at least 2 entries<br />to see your graph</p>
            </div>
          )}
        </div>
      </div>

      {/* Log button */}
      <div className="px-4 mb-6">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-3.5 rounded-2xl bg-indigo-500 text-white font-semibold active:bg-indigo-600 transition-colors"
          >
            + Log Weight
          </button>
        ) : (
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
            <p className="text-white font-semibold mb-4">Log Weight</p>
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-gray-400 text-xs mb-1 block">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={inputWeight}
                  onChange={e => setInputWeight(e.target.value)}
                  placeholder="73.0"
                  className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="text-gray-400 text-xs mb-1 block">Date</label>
                <input
                  type="date"
                  value={inputDate}
                  onChange={e => setInputDate(e.target.value)}
                  className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={saveWeight}
                disabled={saving}
                className="flex-1 py-2.5 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {logs.length > 0 && (
        <div className="px-4">
          <p className="text-white font-semibold text-sm mb-3">History</p>
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
            {[...logs].reverse().slice(0, 12).map((log, i) => (
              <div key={log.id} className={`flex justify-between items-center px-4 py-3 ${i < Math.min(logs.length, 12) - 1 ? 'border-b border-white/5' : ''}`}>
                <span className="text-gray-400 text-sm">
                  {new Date(log.logged_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-white font-semibold">{log.weight_kg}kg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
