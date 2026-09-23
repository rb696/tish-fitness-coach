import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function getWeekStart(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function formatWeekRange(weekStart) {
  const start = new Date(weekStart + 'T12:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  return `${fmt(start)} – ${fmt(end)}`
}

const SLEEP_LABELS = ['', 'Poor', 'Below avg', 'Average', 'Good', 'Great']
const ENERGY_LABELS = ['', 'Drained', 'Low', 'Moderate', 'High', 'Peak']

export default function CheckIn() {
  const [checkins, setCheckins] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const thisWeek = getWeekStart()

  const [form, setForm] = useState({
    sessions_completed: null,
    steps_days: null,
    sleep_rating: null,
    energy_rating: null,
    notes: '',
  })

  useEffect(() => { fetchCheckins() }, [])

  async function fetchCheckins() {
    const { data } = await supabase
      .from('weekly_checkins')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(16)
    if (data) {
      setCheckins(data)
      const current = data.find(c => c.week_start === thisWeek)
      if (current) {
        setForm({
          sessions_completed: current.sessions_completed,
          steps_days: current.steps_days,
          sleep_rating: current.sleep_rating,
          energy_rating: current.energy_rating,
          notes: current.notes || '',
        })
      }
    }
    setLoading(false)
  }

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function saveCheckin() {
    setSaving(true)
    const { error } = await supabase.from('weekly_checkins').upsert(
      { week_start: thisWeek, ...form, notes: form.notes.trim() || null },
      { onConflict: 'week_start' }
    )
    if (error) {
      alert(`Save failed: ${error.message}`)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await fetchCheckins()
    }
    setSaving(false)
  }

  const pastCheckins = checkins.filter(c => c.week_start !== thisWeek)

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <div className="px-4 pt-6 mb-5">
        <h1 className="text-2xl font-bold text-white">Weekly Check-in</h1>
        <p className="text-gray-400 text-sm mt-1">Week of {formatWeekRange(thisWeek)}</p>
      </div>

      {loading ? (
        <div className="px-4 py-16 text-center">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      ) : (
        <div className="px-4 space-y-3">

          {/* Sessions trained */}
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-0.5">Sessions trained</p>
            <p className="text-gray-500 text-xs mb-3">How many workouts did you complete?</p>
            <div className="flex gap-1.5">
              {[0,1,2,3,4,5,6,7].map(n => (
                <button key={n} onClick={() => set('sessions_completed', n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    form.sessions_completed === n
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-gray-400 active:bg-white/10'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Step goal */}
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-0.5">Step goal days hit</p>
            <p className="text-gray-500 text-xs mb-3">Days you hit 9,000–10,000 steps</p>
            <div className="flex gap-1.5">
              {[0,1,2,3,4,5,6,7].map(n => (
                <button key={n} onClick={() => set('steps_days', n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    form.steps_days === n
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white/5 text-gray-400 active:bg-white/10'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Sleep */}
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-0.5">Sleep quality</p>
            <p className="text-gray-500 text-xs mb-3">Overall sleep this week</p>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => set('sleep_rating', n)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    form.sleep_rating === n
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-white/5 text-gray-500 active:bg-white/10'
                  }`}>
                  {n}
                  <br />
                  <span className="text-[9px] font-normal">{SLEEP_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-0.5">Energy & mood</p>
            <p className="text-gray-500 text-xs mb-3">How did you feel overall this week?</p>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => set('energy_rating', n)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    form.energy_rating === n
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-white/5 text-gray-500 active:bg-white/10'
                  }`}>
                  {n}
                  <br />
                  <span className="text-[9px] font-normal">{ENERGY_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 p-4">
            <p className="text-white font-semibold text-sm mb-0.5">Notes</p>
            <p className="text-gray-500 text-xs mb-3">Anything worth remembering from this week?</p>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="e.g. Hit a PR on leg press, sleep rough mid-week, diet was on point..."
              rows={3}
              className="w-full bg-white/5 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-white/20 resize-none"
            />
          </div>

          {/* Save */}
          <button
            onClick={saveCheckin}
            disabled={saving}
            className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
              saved
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : saving
                ? 'bg-white/5 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-500 text-white'
            }`}>
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Check-in'}
          </button>

          {/* Past check-ins */}
          {pastCheckins.length > 0 && (
            <div className="pt-2">
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3">Past Check-ins</p>
              <div className="space-y-2">
                {pastCheckins.map(c => (
                  <PastCheckin key={c.week_start} checkin={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PastCheckin({ checkin }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div>
          <p className="text-white text-sm font-semibold">{formatWeekRange(checkin.week_start)}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {checkin.sessions_completed != null ? `${checkin.sessions_completed} sessions` : ''}
            {checkin.steps_days != null ? ` · ${checkin.steps_days}/7 step days` : ''}
            {checkin.sleep_rating != null ? ` · Sleep ${checkin.sleep_rating}/5` : ''}
          </p>
        </div>
        <svg className={`text-gray-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Sessions" value={checkin.sessions_completed ?? '—'} />
            <Stat label="Step days" value={checkin.steps_days != null ? `${checkin.steps_days}/7` : '—'} />
            <Stat label="Sleep" value={checkin.sleep_rating != null ? `${checkin.sleep_rating}/5 · ${SLEEP_LABELS[checkin.sleep_rating]}` : '—'} />
            <Stat label="Energy" value={checkin.energy_rating != null ? `${checkin.energy_rating}/5 · ${ENERGY_LABELS[checkin.energy_rating]}` : '—'} />
          </div>
          {checkin.notes && (
            <div className="bg-white/5 rounded-xl px-3 py-2.5">
              <p className="text-gray-400 text-sm">{checkin.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-white/5 rounded-xl px-3 py-2.5">
      <p className="text-gray-500 text-[10px] uppercase tracking-widest">{label}</p>
      <p className="text-white font-semibold text-sm mt-0.5">{value}</p>
    </div>
  )
}
