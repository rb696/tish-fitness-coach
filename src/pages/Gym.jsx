import { useState, useEffect } from 'react'
import { WORKOUT_DAYS } from '../data/workoutPlan'
import { supabase } from '../lib/supabase'

export default function Gym() {
  const [selectedDay, setSelectedDay] = useState('push')
  const [weights, setWeights] = useState({})
  const [logs, setLogs] = useState({})
  const [commentModal, setCommentModal] = useState(null)

  const day = WORKOUT_DAYS.find(d => d.id === selectedDay)

  useEffect(() => {
    fetchWeights()
    fetchTodayLogs()
  }, [])

  async function fetchWeights() {
    const { data } = await supabase.from('exercise_weights').select('*')
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
    await supabase.from('exercise_weights').upsert(
      { exercise_id: exerciseId, weights: updated },
      { onConflict: 'exercise_id' }
    )
    setWeights(prev => ({ ...prev, [exerciseId]: updated }))
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
    </div>
  )
}

function ExerciseCard({ exercise, index, dayColor, setWeights, comment, onSaveSetWeight, onComment }) {
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

  // Check if all sets have weights logged and if any set hit top of rep range
  const allWeightsLogged = exercise.repScheme.every((_, i) => setWeights[i + 1])
  const topRep = exercise.repScheme[exercise.repScheme.length - 1]
  const isRangeRep = topRep.includes('-')
  const topRepNum = isRangeRep ? parseInt(topRep.split('-')[1]) : parseInt(topRep)

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-start gap-2 flex-1">
            <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: dayColor }}>
              {index}
            </span>
            <p className="text-white font-semibold text-sm leading-snug">{exercise.name}</p>
          </div>
          <button
            onClick={onComment}
            className="shrink-0 p-1.5 rounded-lg bg-white/5 active:bg-white/10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              className={comment ? 'text-indigo-400' : 'text-gray-500'}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>

        {/* Sets table */}
        <div className="space-y-2">
          {exercise.repScheme.map((reps, i) => {
            const w = setWeights[i + 1]
            const isEditing = editingSet === i
            return (
              <div key={i} className="flex items-center gap-3">
                {/* Set label */}
                <span className="text-gray-500 text-xs w-7 shrink-0">S{i + 1}</span>

                {/* Reps */}
                <span className="text-gray-300 text-sm w-16 shrink-0">{reps} reps</span>

                {/* Weight input */}
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
                        w
                          ? 'bg-white/10 text-white'
                          : 'bg-white/5 text-gray-500 border border-white/10 border-dashed'
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

        {/* Progressive overload tip */}
        {allWeightsLogged && (
          <div className="mt-3 px-3 py-2 bg-emerald-500/10 rounded-xl">
            <p className="text-emerald-400 text-xs">
              ↑ Hit {topRepNum}+ reps on your last set → increase weight next session
            </p>
          </div>
        )}

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
