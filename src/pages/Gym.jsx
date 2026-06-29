import { useState, useEffect } from 'react'
import { WORKOUT_DAYS } from '../data/workoutPlan'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Gym() {
  const [selectedDay, setSelectedDay] = useState('push')
  const [weights, setWeights] = useState({})
  const [logs, setLogs] = useState({})
  const [commentModal, setCommentModal] = useState(null)
  const [historyModal, setHistoryModal] = useState(null)

  const day = WORKOUT_DAYS.find(d => d.id === selectedDay)

  useEffect(() => {
    fetchWeights()
    fetchTodayLogs()
  }, [])

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

  async function saveSetWeight(exerciseId, setNumber, weight) {
    const current = weights[exerciseId] || {}
    const updated = { ...current, [setNumber]: weight }

    // Save current weights (latest values, one row per exercise)
    const { error } = await supabase.from('exercise_weights').upsert(
      { exercise_id: exerciseId, weights: updated },
      { onConflict: 'exercise_id' }
    )
    if (error) {
      console.error('saveSetWeight failed:', error.message, error)
      alert(`Save failed: ${error.message}`)
      return
    }

    // Also write to history (one row per exercise per day)
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
    const { error } = await supabase.from('exercise_comments').upsert(
      { exercise_id: exerciseId, comment, log_date: todayStr },
      { onConflict: ['exercise_id', 'log_date'] }
    )
    if (error) { console.error('saveComment failed:', error.message, error); return }
    setLogs(prev => ({ ...prev, [exerciseId]: comment }))
    setCommentModal(null)
  }

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Gym</h1>
        <p className="text-gray-400 text-sm mt-1">4-day split · 45 min sessions · tap a weight to edit</p>
      </div>

      <div className="px-4 flex gap-2 mb-5 overflow-x-auto pb-1">
        {WORKOUT_DAYS.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedDay(d.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDay === d.id ? 'text-white' : 'bg-white/5 text-gray-400'
            }`}
            style={selectedDay === d.id ? { background: d.color } : {}}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {day.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i + 1}
            dayColor={day.color}
            setWeights={weights[ex.id] || {}}
            comment={logs[ex.id]}
            onSaveSetWeight={(setNum, weight) => saveSetWeight(ex.id, setNum, weight)}
            onComment={() => setCommentModal(ex)}
            onHistory={() => setHistoryModal(ex)}
          />
        ))}
      </div>

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

function ExerciseCard({ exercise, index, dayColor, setWeights, comment, onSaveSetWeight, onComment, onHistory }) {
  const [editingSet, setEditingSet] = useState(null)
  const [inputVal, setInputVal] = useState('')

  function startEdit(setIdx) {
    setEditingSet(setIdx)
    setInputVal(setWeights[setIdx + 1] ?? '')
  }

  function commitEdit() {
    if (inputVal !== '' && !isNaN(inputVal)) {
      onSaveSetWeight(editingSet + 1, parseFloat(inputVal))
    }
    setEditingSet(null)
  }

  const allWeightsLogged = exercise.repScheme.every((_, i) => setWeights[i + 1])
  const topRep = exercise.repScheme[exercise.repScheme.length - 1]
  const isRangeRep = topRep.includes('-')
  const topRepNum = isRangeRep ? parseInt(topRep.split('-')[1]) : parseInt(topRep)

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-start gap-2 flex-1">
            <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: dayColor }}>
              {index}
            </span>
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

        <div className="space-y-2">
          {exercise.repScheme.map((reps, i) => {
            const w = setWeights[i + 1]
            const isEditing = editingSet === i
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-7 shrink-0">S{i + 1}</span>
                <span className="text-gray-300 text-sm w-16 shrink-0">{reps} reps</span>
                <div className="flex-1 flex justify-end">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        type="number"
                        inputMode="decimal"
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={e => e.key === 'Enter' && commitEdit()}
                        className="w-20 bg-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="0"
                      />
                      <span className="text-gray-400 text-xs">kg</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(i)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors active:scale-95 ${
                        w ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-500 border border-white/10 border-dashed'
                      }`}
                    >
                      {w ? `${w} kg` : '— kg'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {allWeightsLogged && (
          <div className="mt-3 px-3 py-2 bg-emerald-500/10 rounded-xl">
            <p className="text-emerald-400 text-xs">
              ↑ Hit {topRepNum}+ reps on your last set → increase weight next session
            </p>
          </div>
        )}

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

function CommentModal({ exercise, existing, onSave, onClose }) {
  const [text, setText] = useState(existing)
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1e1e2a] rounded-t-3xl p-5">
        <h2 className="text-white font-bold mb-1">{exercise.name}</h2>
        <p className="text-gray-400 text-sm mb-4">Session note</p>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
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
        .from('exercise_weight_history')
        .select('*')
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
                    <Line type="monotone" dataKey="top" stroke="#818cf8" strokeWidth={2.5} dot={{ fill: '#818cf8', r: 3 }} activeDot={{ r: 5 }} />
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
