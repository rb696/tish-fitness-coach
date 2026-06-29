import { useState, useEffect } from 'react'
import { MEAL_PLAN, SUPPLEMENTS, MACRO_TARGETS } from '../data/mealPlan'
import { supabase } from '../lib/supabase'

export default function Diet() {
  const [activeTab, setActiveTab] = useState('meals')
  const [supplementLog, setSupplementLog] = useState({})
  const [editingMeal, setEditingMeal] = useState(null)
  const [meals, setMeals] = useState(MEAL_PLAN)
  const [saving, setSaving] = useState(false)
  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchSupplements()
    fetchMealOverrides()
  }, [])

  async function fetchSupplements() {
    const { data } = await supabase.from('supplement_logs').select('*').eq('log_date', todayStr).single()
    if (data) setSupplementLog(data.supplements || {})
  }

  async function fetchMealOverrides() {
    const { data } = await supabase.from('meal_overrides').select('*')
    if (data && data.length > 0) {
      const overrides = {}
      data.forEach(r => { overrides[r.meal_id] = r })
      setMeals(MEAL_PLAN.map(m => overrides[m.id] ? { ...m, ...overrides[m.id] } : m))
    }
  }

  async function toggleSupplement(id) {
    const updated = { ...supplementLog, [id]: !supplementLog[id] }
    setSupplementLog(updated)
    await supabase.from('supplement_logs').upsert({
      log_date: todayStr,
      supplements: updated,
    }, { onConflict: 'log_date' })
  }

  async function saveMealEdit(mealId, updatedFoods) {
    setSaving(true)
    await supabase.from('meal_overrides').upsert({ meal_id: mealId, foods: updatedFoods }, { onConflict: 'meal_id' })
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, foods: updatedFoods } : m))
    setSaving(false)
    setEditingMeal(null)
  }

  const tabs = ['meals', 'supplements']

  return (
    <div className="pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 mb-4">
        <h1 className="text-2xl font-bold text-white">Diet</h1>
        <p className="text-gray-400 text-sm mt-1">
          {MACRO_TARGETS.calories.toLocaleString()} kcal · {MACRO_TARGETS.protein}g P · {MACRO_TARGETS.carbs}g C · {MACRO_TARGETS.fat}g F
        </p>
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-5">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              activeTab === t ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'meals' && (
        <div className="px-4 space-y-4">
          {meals.map(meal => (
            <MealCard
              key={meal.id}
              meal={meal}
              onEdit={() => setEditingMeal(meal)}
            />
          ))}
        </div>
      )}

      {activeTab === 'supplements' && (
        <div className="px-4">
          <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
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
                    <p className={`text-sm font-medium ${supplementLog[supp.id] ? 'text-white' : 'text-gray-300'}`}>
                      {supp.name}
                    </p>
                    <p className="text-gray-500 text-xs">{supp.timing}</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  supplementLog[supp.id] ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600'
                }`}>
                  {supplementLog[supp.id] && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2 2 4-4" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-gray-500 text-xs mt-3">
            {Object.values(supplementLog).filter(Boolean).length}/{SUPPLEMENTS.length} taken today
          </p>
        </div>
      )}

      {/* Edit modal */}
      {editingMeal && (
        <MealEditModal
          meal={editingMeal}
          onSave={saveMealEdit}
          onClose={() => setEditingMeal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

function MealCard({ meal, onEdit }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-[#1e1e2a] rounded-2xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{meal.emoji}</span>
          <div>
            <p className="text-white font-semibold">{meal.name}</p>
            <p className="text-gray-400 text-xs">{meal.time} · {meal.calories} kcal</p>
          </div>
        </div>
        <svg
          className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Macros */}
          <div className="flex gap-4 mb-3 pb-3 border-b border-white/5">
            <MacroPill label="Protein" value={meal.protein} color="#6366f1" />
            <MacroPill label="Carbs" value={meal.carbs} color="#10b981" />
            <MacroPill label="Fat" value={meal.fat} color="#f59e0b" />
          </div>
          {/* Foods */}
          <div className="space-y-1.5 mb-4">
            {meal.foods.map((food, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-300">{food.name}</span>
                <span className="text-gray-500">{food.amount}</span>
              </div>
            ))}
          </div>
          {/* Edit button */}
          <button
            onClick={onEdit}
            className="w-full py-2 rounded-xl bg-white/5 text-indigo-400 text-sm font-medium active:bg-white/10 transition-colors"
          >
            Edit this meal
          </button>
        </div>
      )}
    </div>
  )
}

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

  function addFood() {
    setFoods(prev => [...prev, { name: '', amount: '' }])
  }

  function removeFood(i) {
    setFoods(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-auto bg-[#1e1e2a] rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Edit — {meal.name}</h2>
          <button onClick={onClose} className="text-gray-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 mb-4">
          {foods.map((food, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={food.name}
                onChange={e => updateFood(i, 'name', e.target.value)}
                placeholder="Food name"
                className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input
                value={food.amount}
                onChange={e => updateFood(i, 'amount', e.target.value)}
                placeholder="Amount"
                className="w-24 bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button onClick={() => removeFood(i)} className="text-red-400 shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addFood}
          className="w-full py-2 rounded-xl bg-white/5 text-gray-400 text-sm mb-5 active:bg-white/10"
        >
          + Add food
        </button>

        <button
          onClick={() => onSave(meal.id, foods)}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-indigo-500 text-white font-semibold text-sm active:bg-indigo-600 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
