import { useState, useEffect } from 'react'
import { WORKOUT_DAYS } from '../data/workoutPlan'
import { supabase } from '../lib/supabase'

export default function Gym() {
  const [selectedDay, setSelectedDay] = useState('push')
  const [weights, setWeights] = useState({})
  const [logs, setLogs] = useState({})
  const [commentModal, setCommentModal] = useState(null)
  const [saving, setSaving] = useState(null)

  const day = WORKOUT_DAYS.find(d => d.id === selectedDay)

  useEffect(() => {
    fetchWeights()
    fetchTodayLogs()
  }, [])

  async function fetchWeights() {
    const { data } = await supabase.from('exercise_weights').select('*')
    if (data) {
      const w = {}
      data.forEach(r => { w[r.exercise_id] = r.weight_kg })
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

  async function saveWeight(exerciseId, newWeight) {
    setSaving(exerciseId)
    await supabase.from('exercise_weights').upsert(
      { exercise_id: exerciseId, weight_kg: parseFloat(newWeight) },
      { onConflict: 'exercise_id' }
    )
    setWeights(prev => ({ ...prev, [exerciseId]: parseFloat(newWeight) }))
    setSaving(null)
  }

  async function saveComment(exerciseId, comment) {
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('exercise_comments').upsert(
      { exercise_id: exerciseId, comment, log_date: todayStr },
      { onConflict: ['exercise_id', 'log_date'] }
    )
    setLogs(prev => ({ ...prev, [exerciseId]: comment }))
    setCommentModal(null)
  }

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Gym</h1>
        <p className="text-gray-400 text-sm mt-1">4-day split · 45 min sessions</p>
      </div>

      {/* Day selector */}
      <div className="px-4 flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
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

      {/* Exercise list */}
      <div className="px-4 space-y-3">
        {day.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i + 1}
            dayColor={day.color}
            weight={weights[ex.id]}
            comment={logs[ex.id]}
            saving={saving === ex.id}
            onSaveWeight={w => saveWeight(ex.id, w)}
            onComment={() => setCommentModal(ex)}
          />
        ))}
      </div>

      {/* Comment modal */}
      {commentModal && (
        <CommentModal
          exercise={commentModal}
          existing={logs[commentModal.id] || ''}
          onSave={comment => saveComment(commentModal.id, comment)}
          onClose={() => setCommentModal(null)}
        />
      )}
    </div>
  )
}

function ExerciseCard({ exercise, index, dayColor, weight, comment, saving, onSaveWeight, onComment }) {
  const [editingWeight, setEditingWeight] = useState(false)
  const [weightInput, setWeightInput] = useState(weight ?? '')

  useEffect(() => {
    setWeightInput(weight ?? '')
  }, [weight])

  function handleWeightSave() {
    if (weightInput !== '' && !isNaN(weightInput)) {
      onSaveWeight(weightInput)
    }
    setEditingWeight(false)
  }

  const topRep = exercise.repScheme[exercise.repScheme.length - 1]
  const isAtTopOfRange = topRep.includes('-')
    ? parseInt(topRep.split('-')[1])
    : parseInt(topRep)

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-4 py-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2 flex-1">
            <span className="text-xs font-bold mt-0.5 shrink-0 w-5 text-center rounded"
              style={{ color: dayColor }}>
              {index}
            </span>
            <p className="text-white font-medium text-sm leading-snug">{exercise.name}</p>
          </div>
          <button
            onClick={onComment}
            className="shrink-0 p-1.5 rounded-lg bg-white/5 active:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={comment ? 'text-indigo-400' : 'text-gray-500'}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>

        {/* Sets row */}
        <div className="flex gap-2 flex-wrap mb-3">
          {exercise.repScheme.map((reps, i) => (
            <div key={i} className="px-2.5 py-1 rounded-lg bg-white/5 text-xs text-gray-300">
              <span className="text-gray-500 mr-1">S{i + 1}</span>{reps}
            </div>
          ))}
        </div>

        {/* Weight row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editingWeight ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="number"
                  value={weightInput}
                  onChange={e => setWeightInput(e.target.value)}
                  onBlur={handleWeightSave}
                  onKeyDown={e => e.key === 'Enter' && handleWeightSave()}
                  className="w-20 bg-white/10 rounded-lg px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="kg"
                />
                <span className="text-gray-400 text-sm">kg</span>
              </div>
            ) : (
              <button
                onClick={() => setEditingWeight(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 active:bg-white/10 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className="text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <span className="text-sm font-medium" style={{ color: weight ? '#fff' : '#6b7280' }}>
                  {saving ? '...' : weight ? `${weight}kg` : 'Set weight'}
                </span>
              </button>
            )}
          </div>

          {weight && (
            <p className="text-xs text-emerald-400 font-medium">
              Hit {isAtTopOfRange}+ reps → increase weight
            </p>
          )}
        </div>

        {/* Note */}
        {exercise.note && (
          <p className="text-gray-500 text-xs mt-2 italic">{exercise.note}</p>
        )}

        {/* Comment preview */}
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
        <p className="text-gray-400 text-sm mb-4">Add a session note</p>
        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. Increased bench, felt strong, shoulder felt fine..."
          rows={3}
          className="w-full bg-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500 resize-none mb-4"
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(text)}
            className="flex-1 py-3 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
