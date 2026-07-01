import { useState, useEffect } from 'react'
import { MEAL_PLAN, SUPPLEMENTS, MACRO_TARGETS, SAUCE_PRESETS } from '../data/mealPlan'
import { SHOPPING_LIST, COOK_GUIDES } from '../data/prepGuide'
import { supabase } from '../lib/supabase'

function computeConsumed(meals, ticks, eatOuts, sauceLogs = {}) {
  const eaten = meals.filter(m => ticks[m.id])
  let sp = 0, sc = 0, sf = 0, scal = 0
  eaten.forEach(m => {
    const sauce = sauceLogs[m.id]
    if (sauce) {
      sp   += Number(sauce.protein)  || 0
      sc   += Number(sauce.carbs)    || 0
      sf   += Number(sauce.fat)      || 0
      scal += Number(sauce.calories) || 0
    }
  })
  return {
    protein:  eaten.reduce((s, m) => s + m.protein,  0) + eatOuts.reduce((s, e) => s + (Number(e.protein)  || 0) + (Number(e.sauce?.protein)  || 0), 0) + sp,
    carbs:    eaten.reduce((s, m) => s + m.carbs,    0) + eatOuts.reduce((s, e) => s + (Number(e.carbs)    || 0) + (Number(e.sauce?.carbs)    || 0), 0) + sc,
    fat:      eaten.reduce((s, m) => s + m.fat,      0) + eatOuts.reduce((s, e) => s + (Number(e.fat)      || 0) + (Number(e.sauce?.fat)      || 0), 0) + sf,
    calories: eaten.reduce((s, m) => s + m.calories, 0) + eatOuts.reduce((s, e) => s + (Number(e.calories) || 0) + (Number(e.sauce?.calories) || 0), 0) + scal,
  }
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function Diet() {
  const [activeTab, setActiveTab] = useState('meals')
  const [mealView, setMealView] = useState('today')
  const [suppView, setSuppView] = useState('today')

  // Meal plan (with overrides)
  const [meals, setMeals] = useState(MEAL_PLAN)
  const [overriddenIds, setOverriddenIds] = useState(new Set())
  const [editingMeal, setEditingMeal] = useState(null)
  const [planSaving, setPlanSaving] = useState(false)

  // Daily meal log
  const [mealTicks, setMealTicks] = useState({})
  const [eatOuts, setEatOuts] = useState([])
  const [sauceLogs, setSauceLogs] = useState({})
  const [sauceModalMealId, setSauceModalMealId] = useState(null)
  const [eatOutModal, setEatOutModal] = useState(false)
  const [mealDaySaved, setMealDaySaved] = useState(null)
  const [mealHistory, setMealHistory] = useState([])

  // Meal history edit/delete
  const [editingMealHistory, setEditingMealHistory] = useState(null)
  const [deletingMealEntry, setDeletingMealEntry] = useState(null)

  // Supplements
  const [supplementLog, setSupplementLog] = useState({})
  const [suppDaySaved, setSuppDaySaved] = useState(null)
  const [suppHistory, setSuppHistory] = useState([])

  // Supplement history edit/delete
  const [editingSuppHistory, setEditingSuppHistory] = useState(null)
  const [deletingSuppEntry, setDeletingSuppEntry] = useState(null)

  // Shopping
  const [checked, setChecked] = useState({})

  const todayStr = new Date().toISOString().split('T')[0]
  const consumed = computeConsumed(meals, mealTicks, eatOuts, sauceLogs)

  useEffect(() => {
    fetchSupplements()
    fetchMealOverrides()
    fetchTodayMealLog()
    fetchMealHistory()
    fetchSuppHistory()
  }, [])

  // ── Fetch functions ──────────────────────────────────

  async function fetchSupplements() {
    const { data } = await supabase.from('supplement_logs').select('*').eq('log_date', todayStr).single()
    if (data) {
      if (!data.saved) setSupplementLog(data.supplements || {})
    } else {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toISOString().split('T')[0]
      const { data: yd } = await supabase.from('supplement_logs').select('*').eq('log_date', yStr).single()
      if (yd && !yd.saved && Object.values(yd.supplements || {}).some(Boolean)) {
        await supabase.from('supplement_logs').upsert({ ...yd, saved: true }, { onConflict: 'log_date' })
      }
    }
  }

  async function fetchMealOverrides() {
    const { data } = await supabase.from('meal_overrides').select('*')
    if (data && data.length > 0) {
      const overrides = {}
      const ids = new Set()
      data.forEach(r => { overrides[r.meal_id] = r; ids.add(r.meal_id) })
      setOverriddenIds(ids)
      setMeals(MEAL_PLAN.map(m => overrides[m.id] ? { ...m, ...overrides[m.id] } : m))
    }
  }

  async function fetchTodayMealLog() {
    const { data } = await supabase.from('meal_logs').select('*').eq('log_date', todayStr).single()
    if (data) {
      if (!data.saved) {
        const ticks = {}
        ;(data.meals_eaten || []).forEach(id => { ticks[id] = true })
        setMealTicks(ticks)
        setEatOuts(data.eat_out || [])
        setSauceLogs(data.sauce_logs || {})
      }
    } else {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yStr = yesterday.toISOString().split('T')[0]
      const { data: yd } = await supabase.from('meal_logs').select('*').eq('log_date', yStr).single()
      if (yd && !yd.saved && (yd.meals_eaten?.length > 0 || yd.eat_out?.length > 0)) {
        await supabase.from('meal_logs').upsert({ ...yd, saved: true }, { onConflict: 'log_date' })
      }
    }
  }

  async function fetchMealHistory() {
    const { data } = await supabase.from('meal_logs').select('*')
      .eq('saved', true)
      .order('log_date', { ascending: false })
      .limit(60)
    if (data) setMealHistory(data)
  }

  async function fetchSuppHistory() {
    const { data } = await supabase.from('supplement_logs').select('*')
      .eq('saved', true)
      .order('log_date', { ascending: false })
      .limit(60)
    if (data) setSuppHistory(data)
  }

  // ── Meal log actions ─────────────────────────────────

  async function upsertMealLog(ticks, eatOutsArr, sauceLs = {}) {
    const mealsEaten = Object.entries(ticks).filter(([, v]) => v).map(([k]) => Number(k))
    const totals = computeConsumed(meals, ticks, eatOutsArr, sauceLs)
    await supabase.from('meal_logs').upsert(
      { log_date: todayStr, meals_eaten: mealsEaten, eat_out: eatOutsArr, sauce_logs: sauceLs, ...totals, saved: false },
      { onConflict: 'log_date' }
    )
  }

  async function toggleMeal(mealId) {
    const updated = { ...mealTicks, [mealId]: !mealTicks[mealId] }
    setMealTicks(updated)
    await upsertMealLog(updated, eatOuts, sauceLogs)
  }

  async function addEatOut(entry) {
    const updated = [...eatOuts, entry]
    setEatOuts(updated)
    await upsertMealLog(mealTicks, updated, sauceLogs)
  }

  async function removeEatOut(idx) {
    const updated = eatOuts.filter((_, i) => i !== idx)
    setEatOuts(updated)
    await upsertMealLog(mealTicks, updated, sauceLogs)
  }

  async function addSauce(mealId, sauce) {
    const updated = { ...sauceLogs, [mealId]: sauce }
    setSauceLogs(updated)
    await upsertMealLog(mealTicks, eatOuts, updated)
  }

  async function removeSauce(mealId) {
    const updated = { ...sauceLogs }
    delete updated[mealId]
    setSauceLogs(updated)
    await upsertMealLog(mealTicks, eatOuts, updated)
  }

  async function saveMealDay() {
    setMealDaySaved('saving')
    const mealsEaten = Object.entries(mealTicks).filter(([, v]) => v).map(([k]) => Number(k))
    const totals = computeConsumed(meals, mealTicks, eatOuts, sauceLogs)
    const { error } = await supabase.from('meal_logs').upsert(
      { log_date: todayStr, meals_eaten: mealsEaten, eat_out: eatOuts, sauce_logs: sauceLogs, ...totals, saved: true },
      { onConflict: 'log_date' }
    )
    if (error) { alert('Save failed: ' + error.message); setMealDaySaved(null); return }
    setMealTicks({})
    setEatOuts([])
    setSauceLogs({})
    await fetchMealHistory()
    setMealDaySaved('done')
    setTimeout(() => setMealDaySaved(null), 2500)
  }

  // ── Meal history edit/delete ─────────────────────────

  async function updateMealHistory(logDate, updatedTicks, updatedEatOuts, existingSauceLogs = {}) {
    const mealsEaten = Object.entries(updatedTicks).filter(([, v]) => v).map(([k]) => Number(k))
    const totals = computeConsumed(meals, updatedTicks, updatedEatOuts, existingSauceLogs)
    const { error } = await supabase.from('meal_logs').upsert(
      { log_date: logDate, meals_eaten: mealsEaten, eat_out: updatedEatOuts, sauce_logs: existingSauceLogs, ...totals, saved: true },
      { onConflict: 'log_date' }
    )
    if (error) { alert('Update failed: ' + error.message); return }
    setEditingMealHistory(null)
    await fetchMealHistory()
  }

  async function deleteMealHistory(logDate) {
    const { error } = await supabase.from('meal_logs').delete().eq('log_date', logDate)
    if (error) { alert('Delete failed: ' + error.message); return }
    setDeletingMealEntry(null)
    setMealHistory(prev => prev.filter(e => e.log_date !== logDate))
  }

  // ── Meal plan edit actions ───────────────────────────

  async function resetMeal(mealId) {
    await supabase.from('meal_overrides').delete().eq('meal_id', mealId)
    setMeals(prev => prev.map(m => m.id === mealId ? MEAL_PLAN.find(p => p.id === mealId) : m))
    setOverriddenIds(prev => { const next = new Set(prev); next.delete(mealId); return next })
  }

  async function saveMealEdit(mealId, updatedFoods) {
    setPlanSaving(true)
    await supabase.from('meal_overrides').upsert({ meal_id: mealId, foods: updatedFoods }, { onConflict: 'meal_id' })
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, foods: updatedFoods } : m))
    setPlanSaving(false)
    setEditingMeal(null)
  }

  // ── Supplement actions ───────────────────────────────

  async function toggleSupplement(id) {
    const updated = { ...supplementLog, [id]: !supplementLog[id] }
    setSupplementLog(updated)
    await supabase.from('supplement_logs').upsert({ log_date: todayStr, supplements: updated, saved: false }, { onConflict: 'log_date' })
  }

  async function saveSuppDay() {
    setSuppDaySaved('saving')
    const { error } = await supabase.from('supplement_logs').upsert(
      { log_date: todayStr, supplements: supplementLog, saved: true },
      { onConflict: 'log_date' }
    )
    if (error) { alert('Save failed: ' + error.message); setSuppDaySaved(null); return }
    setSupplementLog({})
    await fetchSuppHistory()
    setSuppDaySaved('done')
    setTimeout(() => setSuppDaySaved(null), 2500)
  }

  // ── Supplement history edit/delete ───────────────────

  async function updateSuppHistory(logDate, updatedSupps) {
    const { error } = await supabase.from('supplement_logs').upsert(
      { log_date: logDate, supplements: updatedSupps, saved: true },
      { onConflict: 'log_date' }
    )
    if (error) { alert('Update failed: ' + error.message); return }
    setEditingSuppHistory(null)
    await fetchSuppHistory()
  }

  async function deleteSuppHistory(logDate) {
    const { error } = await supabase.from('supplement_logs').delete().eq('log_date', logDate)
    if (error) { alert('Delete failed: ' + error.message); return }
    setDeletingSuppEntry(null)
    setSuppHistory(prev => prev.filter(e => e.log_date !== logDate))
  }

  const tabs = [
    { id: 'meals', label: 'Meals' },
    { id: 'supplements', label: 'Supplements' },
    { id: 'prep', label: 'Meal Prep' },
    { id: 'shop', label: 'Shopping' },
  ]

  return (
    <div className="pb-28 max-w-lg mx-auto">
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Diet</h1>
        <p className="text-gray-400 text-sm mt-1">
          {MACRO_TARGETS.calories.toLocaleString()} kcal · {MACRO_TARGETS.protein}g P · {MACRO_TARGETS.carbs}g C · {MACRO_TARGETS.fat}g F
        </p>
      </div>

      <div className="px-4 flex gap-2 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === t.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MEALS TAB ── */}
      {activeTab === 'meals' && (
        <div className="px-4">
          <ViewToggle view={mealView} setView={setMealView} />

          {mealView === 'today' ? (
            <>
              <div className="bg-[#1e1e2a] rounded-2xl p-4 border border-white/5 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-white font-semibold text-sm">Today's macros</p>
                  <p className={`text-sm font-bold ${consumed.calories > MACRO_TARGETS.calories ? 'text-amber-400' : 'text-white'}`}>
                    {consumed.calories} <span className="text-gray-500 font-normal text-xs">/ {MACRO_TARGETS.calories} kcal</span>
                  </p>
                </div>
                <MacroProgressBar label="Protein" consumed={consumed.protein} target={MACRO_TARGETS.protein} color="#6366f1" />
                <MacroProgressBar label="Carbs"   consumed={consumed.carbs}   target={MACRO_TARGETS.carbs}   color="#10b981" />
                <MacroProgressBar label="Fat"     consumed={consumed.fat}     target={MACRO_TARGETS.fat}     color="#f59e0b" />
                <div className="mt-3 pt-3 border-t border-white/5 flex gap-4 text-xs">
                  <span className="text-gray-500">Remaining</span>
                  {[
                    { k: 'P', val: MACRO_TARGETS.protein - consumed.protein },
                    { k: 'C', val: MACRO_TARGETS.carbs - consumed.carbs },
                    { k: 'F', val: MACRO_TARGETS.fat - consumed.fat },
                  ].map(({ k, val }) => (
                    <span key={k} className={val < 0 ? 'text-amber-400' : 'text-gray-300'}>
                      {k} {val > 0 ? val : `+${Math.abs(val)}`}g
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2 mb-3">
                {meals.map(meal => (
                  <MealLogCard
                    key={meal.id}
                    meal={meal}
                    ticked={!!mealTicks[meal.id]}
                    onTick={() => toggleMeal(meal.id)}
                    isOverridden={overriddenIds.has(meal.id)}
                    onEdit={() => setEditingMeal(meal)}
                    onReset={() => resetMeal(meal.id)}
                    sauce={sauceLogs[meal.id]}
                    onOpenSaucePicker={() => setSauceModalMealId(meal.id)}
                    onRemoveSauce={() => removeSauce(meal.id)}
                  />
                ))}
              </div>

              {eatOuts.length > 0 && (
                <div className="space-y-2 mb-3">
                  {eatOuts.map((entry, i) => (
                    <EatOutEntry key={i} entry={entry} onRemove={() => removeEatOut(i)} />
                  ))}
                </div>
              )}

              <button
                onClick={() => setEatOutModal(true)}
                className="w-full py-3 rounded-2xl bg-white/5 text-amber-400 text-sm font-medium active:bg-white/10 mb-4 border border-amber-500/20"
              >
                + Log an eat-out meal
              </button>

              <button
                onClick={saveMealDay}
                disabled={mealDaySaved === 'saving'}
                className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
                  mealDaySaved === 'done'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : mealDaySaved === 'saving'
                    ? 'bg-white/5 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-500 text-white'
                }`}
              >
                {mealDaySaved === 'done' ? '✓ Day saved!' : mealDaySaved === 'saving' ? 'Saving...' : "Save Today's Meals"}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              {mealHistory.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">📅</p>
                  <p className="text-white font-semibold">No history yet</p>
                  <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
                    Tick meals and tap "Save Today's Meals" — each saved day appears here
                  </p>
                </div>
              ) : mealHistory.map(log => (
                <MealHistoryCard
                  key={log.id}
                  log={log}
                  onEdit={() => setEditingMealHistory(log)}
                  onDelete={() => setDeletingMealEntry(log)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUPPLEMENTS TAB ── */}
      {activeTab === 'supplements' && (
        <div className="px-4">
          <ViewToggle view={suppView} setView={setSuppView} />

          {suppView === 'today' ? (
            <>
              <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden mb-3">
                {SUPPLEMENTS.map((supp, i) => (
                  <button
                    key={supp.id}
                    onClick={() => toggleSupplement(supp.id)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors active:bg-white/5 ${
                      i < SUPPLEMENTS.length - 1 ? 'border-b border-white/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 text-left">
                      <span className="text-lg">{supp.icon}</span>
                      <div>
                        <p className={`text-sm font-medium ${supplementLog[supp.id] ? 'text-white' : 'text-gray-300'}`}>{supp.name}</p>
                        <p className="text-gray-500 text-xs">{supp.timing}</p>
                      </div>
                    </div>
                    <CheckCircle checked={!!supplementLog[supp.id]} />
                  </button>
                ))}
              </div>

              <p className="text-center text-gray-500 text-xs mb-5">
                {Object.values(supplementLog).filter(Boolean).length}/{SUPPLEMENTS.length} taken today
              </p>

              <button
                onClick={saveSuppDay}
                disabled={suppDaySaved === 'saving'}
                className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
                  suppDaySaved === 'done'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : suppDaySaved === 'saving'
                    ? 'bg-white/5 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-500 text-white'
                }`}
              >
                {suppDaySaved === 'done' ? '✓ Day saved!' : suppDaySaved === 'saving' ? 'Saving...' : "Save Today's Supplements"}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              {suppHistory.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">💊</p>
                  <p className="text-white font-semibold">No history yet</p>
                  <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
                    Tick your supplements and save — each day appears here
                  </p>
                </div>
              ) : suppHistory.map(log => (
                <SuppHistoryCard
                  key={log.id}
                  log={log}
                  onEdit={() => setEditingSuppHistory(log)}
                  onDelete={() => setDeletingSuppEntry(log)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prep' && <PrepTab />}
      {activeTab === 'shop' && <ShopTab checked={checked} setChecked={setChecked} />}

      {/* ── Modals ── */}
      {eatOutModal && (
        <EatOutModal onSave={addEatOut} onClose={() => setEatOutModal(false)} />
      )}
      {editingMeal && (
        <MealEditModal
          meal={editingMeal}
          onSave={saveMealEdit}
          onClose={() => setEditingMeal(null)}
          saving={planSaving}
        />
      )}
      {editingMealHistory && (
        <MealHistoryEditModal
          log={editingMealHistory}
          meals={meals}
          onSave={(ticks, eos) => updateMealHistory(editingMealHistory.log_date, ticks, eos, editingMealHistory.sauce_logs || {})}
          onDelete={async () => { await deleteMealHistory(editingMealHistory.log_date); setEditingMealHistory(null) }}
          onClose={() => setEditingMealHistory(null)}
        />
      )}
      {deletingMealEntry && (
        <ConfirmModal
          message={`Delete ${fmtDate(deletingMealEntry.log_date)}?`}
          detail="This permanently removes this day's meal log."
          onConfirm={() => deleteMealHistory(deletingMealEntry.log_date)}
          onCancel={() => setDeletingMealEntry(null)}
        />
      )}
      {editingSuppHistory && (
        <SuppHistoryEditModal
          log={editingSuppHistory}
          onSave={(supps) => updateSuppHistory(editingSuppHistory.log_date, supps)}
          onDelete={async () => { await deleteSuppHistory(editingSuppHistory.log_date); setEditingSuppHistory(null) }}
          onClose={() => setEditingSuppHistory(null)}
        />
      )}
      {deletingSuppEntry && (
        <ConfirmModal
          message={`Delete ${fmtDate(deletingSuppEntry.log_date)}?`}
          detail="This permanently removes this day's supplement log."
          onConfirm={() => deleteSuppHistory(deletingSuppEntry.log_date)}
          onCancel={() => setDeletingSuppEntry(null)}
        />
      )}
      {sauceModalMealId != null && (
        <SaucePickerModal
          onAdd={sauce => { addSauce(sauceModalMealId, sauce); setSauceModalMealId(null) }}
          onClose={() => setSauceModalMealId(null)}
        />
      )}
    </div>
  )
}

// ── Shared small components ─────────────────────────────

function ViewToggle({ view, setView }) {
  return (
    <div className="flex gap-2 mb-4">
      {['today', 'history'].map(v => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            view === v ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500'
          }`}
        >
          {v === 'today' ? 'Today' : 'History'}
        </button>
      ))}
    </div>
  )
}

function CheckCircle({ checked }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
      checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
    }`}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5l2 2 4-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function MacroProgressBar({ label, consumed, target, color }) {
  const pct = Math.min((consumed / target) * 100, 100)
  const over = consumed > target
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={over ? 'text-amber-400 font-medium' : 'text-white'}>
          {consumed}g <span className="text-gray-500">/ {target}g</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: over ? '#f59e0b' : color }}
        />
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ── Meal log card (today) ───────────────────────────────

function MealLogCard({ meal, ticked, onTick, isOverridden, onEdit, onReset, sauce, onOpenSaucePicker, onRemoveSauce }) {
  const [open, setOpen] = useState(false)

  const displayCalories = meal.calories + (sauce?.calories || 0)
  const displayProtein  = meal.protein  + (sauce?.protein  || 0)
  const displayCarbs    = meal.carbs    + (sauce?.carbs    || 0)
  const displayFat      = meal.fat      + (sauce?.fat      || 0)

  return (
    <div className={`bg-[#1e1e2a] rounded-2xl border overflow-hidden transition-colors ${
      ticked ? 'border-emerald-500/20' : 'border-white/5'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={onTick} className="shrink-0" aria-label={ticked ? 'Untick meal' : 'Tick meal'}>
          <CheckCircle checked={ticked} />
        </button>
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-2.5 text-left min-w-0">
          <span className="text-xl shrink-0">{meal.emoji}</span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${ticked ? 'text-white' : 'text-gray-400'}`}>{meal.name}</p>
            <p className="text-gray-500 text-xs">
              {meal.time} · {displayCalories} kcal
              {sauce ? <span className="text-indigo-400"> · +sauce</span> : null}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-600 hidden sm:block">P{displayProtein} C{displayCarbs} F{displayFat}</span>
          <svg className={`text-gray-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            onClick={() => setOpen(o => !o)}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="flex gap-4 mb-3">
            <MacroPill label="Protein" value={displayProtein} color="#6366f1" />
            <MacroPill label="Carbs"   value={displayCarbs}   color="#10b981" />
            <MacroPill label="Fat"     value={displayFat}     color="#f59e0b" />
          </div>
          <div className="space-y-1.5 mb-3">
            {meal.foods.map((food, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-300">{food.name}</span>
                <span className="text-gray-500">{food.amount}</span>
              </div>
            ))}
          </div>

          {/* Sauce section */}
          <div className="mb-3">
            {sauce ? (
              <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{sauce.emoji || '🥄'}</span>
                  <div>
                    <p className="text-indigo-300 text-xs font-medium">{sauce.name}</p>
                    <p className="text-gray-500 text-[10px]">{sauce.serving || 'custom'} · {sauce.calories} kcal · P{sauce.protein} C{sauce.carbs} F{sauce.fat}g</p>
                  </div>
                </div>
                <button onClick={onRemoveSauce} className="text-gray-500 active:text-gray-300 p-1 shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenSaucePicker}
                className="w-full py-2 rounded-xl bg-white/5 text-indigo-400 text-xs font-medium active:bg-white/10 border border-indigo-500/20"
              >
                + Add sauce
              </button>
            )}
          </div>

          <button onClick={onEdit} className="w-full py-2 rounded-xl bg-white/5 text-indigo-400 text-sm font-medium active:bg-white/10">
            Edit foods
          </button>
          {isOverridden && (
            <button onClick={onReset} className="w-full mt-2 py-2 rounded-xl bg-white/5 text-gray-400 text-sm font-medium active:bg-white/10">
              Reset to default
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Eat-out entry card ──────────────────────────────────

function EatOutEntry({ entry, onRemove }) {
  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-amber-500/20 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-amber-300 text-sm font-medium">🍴 {entry.name || 'Eat out'}</p>
        {onRemove && (
          <button onClick={onRemove} className="text-gray-500 p-0.5 active:text-gray-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex gap-3 text-xs text-gray-400">
        <span>P <span className="text-white">{entry.protein}g</span></span>
        <span>C <span className="text-white">{entry.carbs}g</span></span>
        <span>F <span className="text-white">{entry.fat}g</span></span>
        <span className="text-gray-300">{entry.calories} kcal</span>
      </div>
      {entry.sauce && (
        <p className="text-indigo-400 text-[10px] mt-1">
          {entry.sauce.emoji || '🥄'} {entry.sauce.name} +{entry.sauce.calories} kcal
        </p>
      )}
    </div>
  )
}

// ── Meal history card ───────────────────────────────────

function MealHistoryCard({ log, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const dateStr = fmtDate(log.log_date)
  const mealsEaten = log.meals_eaten || []
  const eatOuts = log.eat_out || []
  const savedSauces = log.sauce_logs || {}

  const CAL_THRESH  = MACRO_TARGETS.calories * 0.2
  const PROT_THRESH = MACRO_TARGETS.protein  * 0.2
  const calDiff  = log.calories - MACRO_TARGETS.calories
  const protDiff = log.protein  - MACRO_TARGETS.protein

  const flags = []
  if (calDiff > CAL_THRESH)          flags.push({ text: `Over by ${calDiff} kcal`,              color: 'text-amber-400' })
  else if (calDiff < -CAL_THRESH)    flags.push({ text: `Under by ${Math.abs(calDiff)} kcal`,   color: 'text-yellow-500' })
  if (protDiff < -PROT_THRESH)       flags.push({ text: `Protein short ${Math.abs(protDiff)}g`, color: 'text-orange-400' })

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center px-4 py-4 gap-3">
        <button onClick={() => setOpen(o => !o)} className="flex-1 text-left min-w-0">
          <p className="text-white font-semibold text-sm">{dateStr}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {mealsEaten.length}/{MEAL_PLAN.length} meals
            {eatOuts.length > 0 ? ` · ${eatOuts.length} eat-out` : ''}
            {' · '}{log.calories} kcal
          </p>
          {flags.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-1">
              {flags.map((f, i) => (
                <span key={i} className={`text-[10px] font-medium ${f.color}`}>{f.text}</span>
              ))}
            </div>
          )}
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit() }}
            className="text-indigo-400 text-xs font-medium active:text-indigo-300 px-1 py-1">Edit</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="text-red-400 text-xs font-medium active:text-red-300 px-1 py-1">Delete</button>
          <svg onClick={() => setOpen(o => !o)}
            className={`text-gray-500 transition-transform cursor-pointer ${open ? 'rotate-180' : ''}`}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
          {MEAL_PLAN.map(m => {
            const eaten = mealsEaten.includes(m.id)
            const sauce = savedSauces[m.id]
            return (
              <div key={m.id}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${eaten ? 'text-emerald-400' : 'text-gray-600'}`}>{eaten ? '✓' : '✗'}</span>
                  <span className={`text-sm ${eaten ? 'text-gray-300' : 'text-gray-600'}`}>{m.emoji} {m.name}</span>
                  {eaten && <span className="text-gray-500 text-xs ml-auto">{m.calories} kcal</span>}
                </div>
                {eaten && sauce && (
                  <p className="ml-5 text-indigo-400 text-[10px] mt-0.5">
                    {sauce.emoji || '🥄'} {sauce.name} +{sauce.calories} kcal
                  </p>
                )}
              </div>
            )
          })}
          {eatOuts.map((e, i) => (
            <div key={`eo${i}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-400">✓</span>
                <span className="text-sm text-amber-300">🍴 {e.name || 'Eat out'}</span>
                <span className="text-gray-500 text-xs ml-auto">{e.calories} kcal</span>
              </div>
              {e.sauce && (
                <p className="ml-5 text-indigo-400 text-[10px] mt-0.5">
                  {e.sauce.emoji || '🥄'} {e.sauce.name} +{e.sauce.calories} kcal
                </p>
              )}
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-white/5 flex gap-3 text-xs">
            <span className="text-gray-500">Total</span>
            <span className="text-gray-300">P {log.protein}g</span>
            <span className="text-gray-300">C {log.carbs}g</span>
            <span className="text-gray-300">F {log.fat}g</span>
            <span className="text-white font-medium ml-auto">{log.calories} kcal</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Meal history edit modal ─────────────────────────────

function MealHistoryEditModal({ log, meals, onSave, onDelete, onClose }) {
  const [ticks, setTicks] = useState(() => {
    const t = {}
    ;(log.meals_eaten || []).forEach(id => { t[String(id)] = true })
    return t
  })
  const [localEatOuts, setLocalEatOuts] = useState(log.eat_out || [])
  const [showEatOutForm, setShowEatOutForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const consumed = computeConsumed(meals, ticks, localEatOuts, log.sauce_logs || {})

  function toggleTick(mealId) {
    const key = String(mealId)
    setTicks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function addEatOut(entry) { setLocalEatOuts(prev => [...prev, entry]); setShowEatOutForm(false) }
  function removeEatOut(idx) { setLocalEatOuts(prev => prev.filter((_, i) => i !== idx)) }

  async function handleSave() { setSaving(true); await onSave(ticks, localEatOuts); setSaving(false) }
  async function handleDelete() { setDeleting(true); await onDelete(); setDeleting(false) }

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/70 z-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-auto bg-[#1a1a24] rounded-t-3xl max-h-[92vh] flex flex-col">

        {confirmDelete && (
          <div className="absolute inset-0 z-20 bg-[#1a1a24]/95 rounded-t-3xl flex flex-col justify-end p-6">
            <p className="text-white font-bold text-lg mb-1">Delete this day?</p>
            <p className="text-gray-400 text-sm mb-6">Permanently removes the meal log for {fmtDate(log.log_date)}.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm active:bg-white/10">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm active:bg-red-600 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Edit day</h2>
            <p className="text-gray-400 text-sm">{fmtDate(log.log_date)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 active:text-white p-1"><CloseIcon /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <div className="bg-[#16161f] rounded-2xl p-4 border border-white/5">
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Macros</p>
              <p className={`text-sm font-bold ${consumed.calories > MACRO_TARGETS.calories ? 'text-amber-400' : 'text-white'}`}>
                {consumed.calories} <span className="text-gray-500 font-normal text-xs">/ {MACRO_TARGETS.calories} kcal</span>
              </p>
            </div>
            <MacroProgressBar label="Protein" consumed={consumed.protein} target={MACRO_TARGETS.protein} color="#6366f1" />
            <MacroProgressBar label="Carbs"   consumed={consumed.carbs}   target={MACRO_TARGETS.carbs}   color="#10b981" />
            <MacroProgressBar label="Fat"     consumed={consumed.fat}     target={MACRO_TARGETS.fat}     color="#f59e0b" />
          </div>

          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
            {meals.map((meal, i) => (
              <button type="button" key={meal.id} onClick={() => toggleTick(meal.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5 ${
                  i < meals.length - 1 ? 'border-b border-white/5' : ''
                }`}>
                <CheckCircle checked={!!ticks[String(meal.id)]} />
                <span className="text-xl shrink-0">{meal.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${ticks[String(meal.id)] ? 'text-white' : 'text-gray-400'}`}>{meal.name}</p>
                  <p className="text-gray-500 text-xs">{meal.time} · {meal.calories} kcal</p>
                </div>
              </button>
            ))}
          </div>

          {localEatOuts.length > 0 && (
            <div className="space-y-2">
              {localEatOuts.map((entry, i) => (
                <EatOutEntry key={i} entry={entry} onRemove={() => removeEatOut(i)} />
              ))}
            </div>
          )}

          {showEatOutForm ? (
            <InlineEatOutForm onAdd={addEatOut} onCancel={() => setShowEatOutForm(false)} />
          ) : (
            <button type="button" onClick={() => setShowEatOutForm(true)}
              className="w-full py-3 rounded-2xl bg-white/5 text-amber-400 text-sm font-medium active:bg-white/10 border border-amber-500/20">
              + Add eat-out entry
            </button>
          )}
        </div>

        <div className="px-5 pb-6 pt-3 border-t border-white/5 shrink-0 space-y-2">
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="w-full py-3 rounded-2xl bg-white/5 text-red-400 text-sm font-medium active:bg-white/10 border border-red-500/20">
            Delete this day
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline eat-out form ─────────────────────────────────

function InlineEatOutForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [calories, setCalories] = useState('')
  const [sauce, setSauce] = useState(null)
  const [saucePickerOpen, setSaucePickerOpen] = useState(false)

  function handleAdd() {
    onAdd({
      name: name.trim() || 'Eat out',
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      calories: Number(calories) || 0,
      ...(sauce ? { sauce } : {}),
    })
  }

  const hasAny = protein || carbs || fat || calories

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-amber-500/20 p-4">
      <p className="text-amber-300 text-xs font-semibold mb-3 uppercase tracking-widest">Eat-out entry</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Meal name (optional)"
        className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-amber-500 mb-3" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Protein (g)', val: protein, set: setProtein },
          { label: 'Carbs (g)',   val: carbs,   set: setCarbs },
          { label: 'Fat (g)',     val: fat,      set: setFat },
          { label: 'Calories',   val: calories, set: setCalories },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <p className="text-gray-500 text-xs mb-1">{label}</p>
            <input type="number" inputMode="numeric" value={val} onChange={e => set(e.target.value)} placeholder="0"
              className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-amber-500" />
          </div>
        ))}
      </div>
      {sauce ? (
        <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 mb-3">
          <p className="text-indigo-300 text-xs">{sauce.emoji || '🥄'} {sauce.name} +{sauce.calories} kcal</p>
          <button onClick={() => setSauce(null)} className="text-gray-500 active:text-gray-300 text-xs ml-2">✕</button>
        </div>
      ) : (
        <button onClick={() => setSaucePickerOpen(true)}
          className="w-full py-2 rounded-xl bg-white/5 text-indigo-400 text-xs font-medium active:bg-white/10 border border-indigo-500/20 mb-3">
          + Add sauce
        </button>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl bg-white/5 text-gray-400 text-sm font-medium">Cancel</button>
        <button onClick={handleAdd} disabled={!hasAny}
          className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-40">Add</button>
      </div>
      {saucePickerOpen && (
        <SaucePickerModal onAdd={s => { setSauce(s); setSaucePickerOpen(false) }} onClose={() => setSaucePickerOpen(false)} />
      )}
    </div>
  )
}

// ── Supplement history card ─────────────────────────────

function SuppHistoryCard({ log, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const dateStr = fmtDate(log.log_date)
  const supps = log.supplements || {}
  const takenCount = SUPPLEMENTS.filter(s => supps[s.id]).length

  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center px-4 py-4 gap-3">
        <button onClick={() => setOpen(o => !o)} className="flex-1 text-left min-w-0">
          <p className="text-white font-semibold text-sm">{dateStr}</p>
          <p className={`text-xs mt-0.5 ${takenCount === SUPPLEMENTS.length ? 'text-emerald-400' : 'text-gray-400'}`}>
            {takenCount}/{SUPPLEMENTS.length} taken
          </p>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="text-indigo-400 text-xs font-medium active:text-indigo-300 px-1 py-1">Edit</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-red-400 text-xs font-medium active:text-red-300 px-1 py-1">Delete</button>
          <svg onClick={() => setOpen(o => !o)}
            className={`text-gray-500 transition-transform cursor-pointer ${open ? 'rotate-180' : ''}`}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-2">
          {SUPPLEMENTS.map(s => {
            const taken = !!supps[s.id]
            return (
              <div key={s.id} className="flex items-center gap-2">
                <span className={`text-sm ${taken ? 'text-emerald-400' : 'text-gray-600'}`}>{taken ? '✓' : '✗'}</span>
                <span className="text-lg">{s.icon}</span>
                <span className={`text-sm ${taken ? 'text-gray-300' : 'text-gray-600'}`}>{s.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Supplement history edit modal ───────────────────────

function SuppHistoryEditModal({ log, onSave, onDelete, onClose }) {
  const [supps, setSupps] = useState({ ...(log.supplements || {}) })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const takenCount = SUPPLEMENTS.filter(s => supps[s.id]).length

  async function handleSave() { setSaving(true); await onSave(supps); setSaving(false) }
  async function handleDelete() { setDeleting(true); await onDelete(); setDeleting(false) }

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/70 z-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-auto bg-[#1a1a24] rounded-t-3xl p-5">
        {confirmDelete && (
          <div className="absolute inset-0 z-20 bg-[#1a1a24]/95 rounded-t-3xl flex flex-col justify-end p-6">
            <p className="text-white font-bold text-lg mb-1">Delete this day?</p>
            <p className="text-gray-400 text-sm mb-6">Permanently removes the supplement log for {fmtDate(log.log_date)}.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm active:bg-white/10">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm active:bg-red-600 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-lg">Edit supplements</h2>
            <p className="text-gray-400 text-sm">{fmtDate(log.log_date)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 active:text-white p-1"><CloseIcon /></button>
        </div>
        <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden mb-3">
          {SUPPLEMENTS.map((supp, i) => (
            <button type="button" key={supp.id}
              onClick={() => setSupps(prev => ({ ...prev, [supp.id]: !prev[supp.id] }))}
              className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors active:bg-white/5 ${
                i < SUPPLEMENTS.length - 1 ? 'border-b border-white/5' : ''
              }`}>
              <div className="flex items-center gap-3 text-left">
                <span className="text-lg">{supp.icon}</span>
                <div>
                  <p className={`text-sm font-medium ${supps[supp.id] ? 'text-white' : 'text-gray-400'}`}>{supp.name}</p>
                  <p className="text-gray-500 text-xs">{supp.timing}</p>
                </div>
              </div>
              <CheckCircle checked={!!supps[supp.id]} />
            </button>
          ))}
        </div>
        <p className="text-center text-gray-500 text-xs mb-4">{takenCount}/{SUPPLEMENTS.length} taken</p>
        <div className="space-y-2">
          <button type="button" onClick={handleSave} disabled={saving}
            className="w-full py-3.5 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => setConfirmDelete(true)}
            className="w-full py-3 rounded-2xl bg-white/5 text-red-400 text-sm font-medium active:bg-white/10 border border-red-500/20">
            Delete this day
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Confirm modal ───────────────────────────────────────

function ConfirmModal({ message, detail, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false)
  async function handleConfirm() { setBusy(true); await onConfirm(); setBusy(false) }
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1a1a24] rounded-t-3xl p-5">
        <p className="text-white font-bold text-lg mb-1">{message}</p>
        {detail && <p className="text-gray-400 text-sm mb-6">{detail}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm active:bg-white/10">Cancel</button>
          <button onClick={handleConfirm} disabled={busy}
            className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm active:bg-red-600 disabled:opacity-50">
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Eat-out modal ───────────────────────────────────────

function EatOutModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [calories, setCalories] = useState('')
  const [sauce, setSauce] = useState(null)
  const [saucePickerOpen, setSaucePickerOpen] = useState(false)

  function handleSave() {
    onSave({
      name: name.trim() || 'Eat out',
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      calories: Number(calories) || 0,
      ...(sauce ? { sauce } : {}),
    })
    onClose()
  }

  const hasAny = protein || carbs || fat || calories

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1e1e2a] rounded-t-3xl p-5">
        <h2 className="text-white font-bold text-lg mb-1">Log eat-out meal</h2>
        <p className="text-gray-400 text-sm mb-5">Enter what you estimate you had</p>

        <div className="mb-4">
          <p className="text-gray-400 text-xs mb-1.5">Meal name (optional)</p>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Chicken burger at Grill'd"
            className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Protein (g)', val: protein, set: setProtein },
            { label: 'Carbs (g)',   val: carbs,   set: setCarbs },
            { label: 'Fat (g)',     val: fat,      set: setFat },
            { label: 'Calories',   val: calories, set: setCalories },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <p className="text-gray-400 text-xs mb-1.5">{label}</p>
              <input type="number" inputMode="numeric" value={val} onChange={e => set(e.target.value)} placeholder="0"
                className="w-full bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          ))}
        </div>

        {sauce ? (
          <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base">{sauce.emoji || '🥄'}</span>
              <p className="text-indigo-300 text-xs font-medium">{sauce.name} · {sauce.calories} kcal</p>
            </div>
            <button onClick={() => setSauce(null)} className="text-gray-500 active:text-gray-300 text-sm ml-2">✕</button>
          </div>
        ) : (
          <button onClick={() => setSaucePickerOpen(true)}
            className="w-full py-2.5 rounded-xl bg-white/5 text-indigo-400 text-sm font-medium active:bg-white/10 border border-indigo-500/20 mb-4">
            + Add sauce
          </button>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-2xl bg-white/5 text-gray-400 font-semibold text-sm">Cancel</button>
          <button onClick={handleSave} disabled={!hasAny}
            className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-semibold text-sm active:bg-amber-600 disabled:opacity-40">
            Add to today
          </button>
        </div>

        {saucePickerOpen && (
          <SaucePickerModal onAdd={s => { setSauce(s); setSaucePickerOpen(false) }} onClose={() => setSaucePickerOpen(false)} />
        )}
      </div>
    </div>
  )
}

// ── Sauce picker modal ──────────────────────────────────

function SaucePickerModal({ onAdd, onClose }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customP, setCustomP] = useState('')
  const [customC, setCustomC] = useState('')
  const [customF, setCustomF] = useState('')
  const [customCal, setCustomCal] = useState('')

  function addCustom() {
    onAdd({
      id: 'custom',
      name: customName.trim() || 'Custom sauce',
      emoji: '🥄',
      serving: 'custom',
      protein: Number(customP) || 0,
      carbs: Number(customC) || 0,
      fat: Number(customF) || 0,
      calories: Number(customCal) || 0,
    })
  }

  const customHasAny = customP || customC || customF || customCal

  return (
    <div className="fixed inset-0 z-[80] flex items-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1a1a24] rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5 sticky top-0 bg-[#1a1a24]">
          <h3 className="text-white font-bold text-lg">Add a sauce</h3>
          <button onClick={onClose} className="text-gray-400 active:text-white p-1"><CloseIcon /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="bg-[#16161f] rounded-2xl border border-white/5 overflow-hidden">
            {SAUCE_PRESETS.map((s, i) => (
              <button key={s.id} onClick={() => onAdd(s)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-white/5 ${
                  i < SAUCE_PRESETS.length - 1 ? 'border-b border-white/5' : ''
                }`}>
                <span className="text-xl shrink-0">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{s.name}</p>
                  <p className="text-gray-500 text-xs">{s.serving} · {s.calories} kcal · P{s.protein} C{s.carbs} F{s.fat}g</p>
                </div>
                <svg className="text-gray-600 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>

          {!showCustom ? (
            <button onClick={() => setShowCustom(true)}
              className="w-full py-3 rounded-2xl bg-white/5 text-gray-400 text-sm font-medium active:bg-white/10 border border-white/10">
              + Enter custom sauce
            </button>
          ) : (
            <div className="bg-[#16161f] rounded-2xl border border-white/5 p-4">
              <p className="text-white text-sm font-semibold mb-3">Custom sauce</p>
              <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Sauce name"
                className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500 mb-3" />
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { label: 'Protein (g)', val: customP,   set: setCustomP },
                  { label: 'Carbs (g)',   val: customC,   set: setCustomC },
                  { label: 'Fat (g)',     val: customF,   set: setCustomF },
                  { label: 'Calories',   val: customCal, set: setCustomCal },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <p className="text-gray-500 text-xs mb-1">{label}</p>
                    <input type="number" inputMode="numeric" value={val} onChange={e => set(e.target.value)} placeholder="0"
                      className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                ))}
              </div>
              <button onClick={addCustom} disabled={!customHasAny}
                className="w-full py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-semibold active:bg-indigo-600 disabled:opacity-40">
                Add custom sauce
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Meal prep & shopping tabs ───────────────────────────

function PrepTab() {
  const [open, setOpen] = useState(null)
  return (
    <div className="px-4 space-y-3">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 mb-2">
        <p className="text-amber-300 text-sm font-medium">Batch cook strategy</p>
        <p className="text-amber-200/70 text-xs mt-1">Cook chicken + rice on Sunday and Wednesday. Oats and post-workout shake fresh each day. Veggies straight from frozen.</p>
      </div>

      {COOK_GUIDES.map(guide => (
        <div key={guide.id} className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
          <button onClick={() => setOpen(open === guide.id ? null : guide.id)}
            className="w-full flex items-center justify-between px-4 py-4 text-left">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{guide.emoji}</span>
              <div>
                <p className="text-white font-semibold text-sm">{guide.title}</p>
                <p className="text-gray-400 text-xs mt-0.5">{guide.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{guide.prepTime}</span>
              <svg className={`text-gray-500 transition-transform ${open === guide.id ? 'rotate-180' : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {open === guide.id && (
            <div className="px-4 pb-4">
              {guide.seasonings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="text-gray-500 text-xs self-center mr-1">Season with:</span>
                  {guide.seasonings.map(s => (
                    <span key={s} className="text-xs bg-white/5 text-gray-300 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              )}
              <div className="space-y-3 mb-4">
                {guide.steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-indigo-400 font-bold text-sm shrink-0 w-5">{i + 1}.</span>
                    <p className="text-gray-300 text-sm leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
              {guide.tip && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2">
                  <p className="text-indigo-300 text-xs">{guide.tip}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ShopTab({ checked, setChecked }) {
  const toggle = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  const totalItems = SHOPPING_LIST.reduce((sum, cat) => sum + cat.items.length, 0)
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm">Weekly shop · Woolworths or Coles</p>
        <span className="text-xs text-indigo-400 font-medium">{checkedCount}/{totalItems} done</span>
      </div>

      {checkedCount === totalItems && totalItems > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3 mb-4 text-center">
          <p className="text-emerald-400 font-semibold text-sm">✓ All items checked — you're set for the week!</p>
        </div>
      )}

      <div className="space-y-4">
        {SHOPPING_LIST.map(cat => (
          <div key={cat.category}>
            <p className="text-white font-semibold text-sm mb-2">{cat.category}</p>
            <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
              {cat.items.map((item, i) => {
                const key = `${cat.category}-${i}`
                const done = checked[key]
                return (
                  <button key={i} onClick={() => toggle(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/5 ${
                      i < cat.items.length - 1 ? 'border-b border-white/5' : ''
                    }`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                    }`}>
                      {done && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${done ? 'text-gray-500 line-through' : 'text-white'}`}>{item.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{item.qty}</p>
                      {item.note && <p className="text-gray-600 text-xs mt-0.5">{item.note}</p>}
                    </div>
                    {item.store === 'woolworths' && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">Woolies</span>
                    )}
                    {item.store === 'online' && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">Online</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setChecked({})}
        className="w-full mt-5 py-3 rounded-2xl bg-white/5 text-gray-400 text-sm font-medium active:bg-white/10">
        Reset list
      </button>
    </div>
  )
}

// ── Meal plan edit modal ─────────────────────────────────

function MacroPill({ label, value, color }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-sm" style={{ color }}>{value}g</p>
    </div>
  )
}

function MealEditModal({ meal, onSave, onClose, saving }) {
  const [foods, setFoods] = useState(meal.foods.map(f => ({ ...f })))

  function updateFood(i, field, val) {
    setFoods(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1e1e2a] rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Edit — {meal.name}</h2>
          <button onClick={onClose} className="text-gray-400"><CloseIcon /></button>
        </div>
        <div className="space-y-3 mb-4">
          {foods.map((food, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={food.name} onChange={e => updateFood(i, 'name', e.target.value)} placeholder="Food name"
                className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500" />
              <input value={food.amount} onChange={e => updateFood(i, 'amount', e.target.value)} placeholder="Amount"
                className="w-24 bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500" />
              <button onClick={() => setFoods(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => setFoods(prev => [...prev, { name: '', amount: '' }])}
          className="w-full py-2 rounded-xl bg-white/5 text-gray-400 text-sm mb-5 active:bg-white/10">
          + Add food
        </button>
        <button onClick={() => onSave(meal.id, foods)} disabled={saving}
          className="w-full py-3 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
