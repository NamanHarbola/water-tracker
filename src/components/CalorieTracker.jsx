import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { searchIndianFoods } from '../lib/indianFoodDb'

const QUICK_ADD = [100, 250, 400, 600]

export default function CalorieTracker({ userId, entries, onAdd, goal = 2000 }) {
  const [custom, setCustom] = useState('')
  const [foodQuery, setFoodQuery] = useState('')
  const [selectedFood, setSelectedFood] = useState(null)
  const [qty, setQty] = useState(1)

  const total = entries.reduce((sum, e) => sum + e.calories, 0)
  const pct = Math.min(100, Math.round((total / goal) * 100))
  const suggestions = selectedFood ? [] : searchIndianFoods(foodQuery)

  async function addCalories(amount, foodName = null) {
    if (!amount || amount <= 0) return
    const entry = {
      user_id: userId,
      calories: Math.round(amount),
      logged_at: new Date().toISOString(),
      ...(foodName ? { food_name: foodName } : {})
    }
    const { data, error } = await supabase.from('calorie_logs').insert(entry).select().single()
    if (!error) {
      onAdd(data)
    } else if (foodName) {
      // Fall back to a plain insert if the food_name column hasn't been
      // added yet (see supabase/migration_03_food_and_admin_delete.sql).
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('calorie_logs')
        .insert({ user_id: userId, calories: Math.round(amount), logged_at: entry.logged_at })
        .select()
        .single()
      if (!fallbackError) onAdd(fallbackData)
    }
    setCustom('')
    setFoodQuery('')
    setSelectedFood(null)
    setQty(1)
  }

  return (
    <div className="bg-white rounded-blob p-4 sm:p-5 shadow-sm border border-deep/5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-display text-lg text-deep">Calories today</h3>
        <span className="tabular text-sm text-ink/50">goal {goal}</span>
      </div>

      <div className="flex items-end gap-2 mb-3">
        <span className="font-display text-3xl text-sun tabular">{total}</span>
        <span className="text-sm text-ink/40 mb-1">kcal</span>
      </div>

      <div className="h-2 rounded-full bg-bubble overflow-hidden mb-4">
        <div
          className="h-full bg-sun transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Search a food — Indian food calorie lookup */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-ink/50 mb-1.5 block">
          Log a food (Indian food calorie guide)
        </label>

        {!selectedFood ? (
          <div className="relative">
            <input
              value={foodQuery}
              onChange={(e) => setFoodQuery(e.target.value)}
              placeholder="Type a food, e.g. roti, dal, dosa…"
              className="w-full px-3 py-2 rounded-xl border border-deep/10 text-base focus:border-splash outline-none"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-xl border border-deep/10 shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                {suggestions.map((f) => (
                  <button
                    key={f.name}
                    onClick={() => {
                      setSelectedFood(f)
                      setFoodQuery('')
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-bubble flex items-center justify-between gap-2"
                  >
                    <span className="text-deep truncate">{f.name}</span>
                    <span className="text-xs text-ink/40 tabular shrink-0">
                      {f.calories} kcal / {f.serving}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-bubble rounded-xl p-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-deep truncate">{selectedFood.name}</p>
              <p className="text-xs text-ink/40">
                {selectedFood.calories} kcal per {selectedFood.serving}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setQty((q) => Math.max(0.5, q - 0.5))}
                className="w-7 h-7 rounded-full bg-white text-deep font-semibold press-pop"
              >
                −
              </button>
              <span className="tabular text-sm w-8 text-center">{qty}×</span>
              <button
                onClick={() => setQty((q) => q + 0.5)}
                className="w-7 h-7 rounded-full bg-white text-deep font-semibold press-pop"
              >
                +
              </button>
            </div>
            <button
              onClick={() => addCalories(selectedFood.calories * qty, selectedFood.name)}
              className="px-3 py-1.5 rounded-full bg-sun text-deep text-xs font-bold press-pop shrink-0"
            >
              Add {Math.round(selectedFood.calories * qty)}
            </button>
            <button
              onClick={() => {
                setSelectedFood(null)
                setQty(1)
              }}
              className="text-ink/40 text-lg leading-none px-1 shrink-0"
              aria-label="Cancel"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK_ADD.map((amt) => (
          <button
            key={amt}
            onClick={() => addCalories(amt)}
            className="px-3 py-1.5 rounded-full bg-sun/20 text-deep text-sm font-semibold press-pop transition"
          >
            +{amt}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Custom amount"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-deep/10 text-base focus:border-splash outline-none"
        />
        <button
          onClick={() => addCalories(Number(custom))}
          className="px-4 py-2 rounded-xl bg-deep text-white text-sm font-medium active:scale-95 transition shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  )
}
