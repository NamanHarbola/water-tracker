import { useState } from 'react'
import { supabase } from '../supabaseClient'

const QUICK_ADD = [100, 250, 400, 600]

export default function CalorieTracker({ userId, entries, onAdd, goal = 2000 }) {
  const [custom, setCustom] = useState('')
  const total = entries.reduce((sum, e) => sum + e.calories, 0)
  const pct = Math.min(100, Math.round((total / goal) * 100))

  async function addCalories(amount) {
    if (!amount || amount <= 0) return
    const entry = { user_id: userId, calories: amount, logged_at: new Date().toISOString() }
    const { data, error } = await supabase.from('calorie_logs').insert(entry).select().single()
    if (!error) onAdd(data)
    setCustom('')
  }

  return (
    <div className="bg-white rounded-blob p-5 shadow-sm border border-deep/5">
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
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-deep/10 text-sm focus:border-splash outline-none"
        />
        <button
          onClick={() => addCalories(Number(custom))}
          className="px-4 py-2 rounded-xl bg-deep text-white text-sm font-medium active:scale-95 transition"
        >
          Add
        </button>
      </div>
    </div>
  )
}
