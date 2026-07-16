import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { localDateKey } from '../lib/date'

const CELL = 108
const HEADER_H = 96
const DOW_H = 32
const PAD = 20
const COLS = 7

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Draws the calendar onto a canvas and returns it. Kept separate from the
// download step so it's easy to preview before saving.
function drawCalendar(canvas, { userName, year, month, byDay }) {
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = firstOfMonth.getDay() // 0 = Sunday
  const rows = Math.ceil((startWeekday + daysInMonth) / COLS)

  const width = PAD * 2 + COLS * CELL
  const height = PAD * 2 + HEADER_H + DOW_H + rows * CELL
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#EAF9FF'
  ctx.fillRect(0, 0, width, height)

  // Header
  ctx.fillStyle = '#155E9B'
  ctx.font = '700 30px "Segoe UI", sans-serif'
  ctx.textBaseline = 'top'
  ctx.fillText(`${userName} — ${monthLabel(year, month)}`, PAD, PAD)
  ctx.fillStyle = '#1B2A4A'
  ctx.globalAlpha = 0.5
  ctx.font = '400 15px "Segoe UI", sans-serif'
  ctx.fillText('💧 water breaks logged   ·   🔥 calories logged', PAD, PAD + 42)
  ctx.globalAlpha = 1

  // Day-of-week row
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  ctx.font = '600 13px "Segoe UI", sans-serif'
  ctx.fillStyle = '#1B2A4A'
  ctx.globalAlpha = 0.4
  for (let c = 0; c < COLS; c++) {
    ctx.textAlign = 'center'
    ctx.fillText(dow[c], PAD + c * CELL + CELL / 2, PAD + HEADER_H + 8)
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'

  const gridTop = PAD + HEADER_H + DOW_H

  // Grid lines
  ctx.strokeStyle = 'rgba(21,94,155,0.12)'
  ctx.lineWidth = 1
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath()
    ctx.moveTo(PAD, gridTop + r * CELL)
    ctx.lineTo(PAD + COLS * CELL, gridTop + r * CELL)
    ctx.stroke()
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(PAD + c * CELL, gridTop)
    ctx.lineTo(PAD + c * CELL, gridTop + rows * CELL)
    ctx.stroke()
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const cellIndex = startWeekday + day - 1
    const r = Math.floor(cellIndex / COLS)
    const c = cellIndex % COLS
    const x = PAD + c * CELL
    const y = gridTop + r * CELL

    const key = localDateKey(new Date(year, month, day))
    const info = byDay[key] || { waterCount: 0, calories: 0 }
    const isToday = key === localDateKey(new Date())

    if (isToday) {
      ctx.fillStyle = 'rgba(0,194,255,0.08)'
      ctx.fillRect(x, y, CELL, CELL)
    }

    ctx.fillStyle = '#1B2A4A'
    ctx.font = '600 15px "Segoe UI", sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(String(day), x + 8, y + 6)

    ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.fillText('💧', x + 8, y + 34)
    ctx.font = '600 15px "Segoe UI", sans-serif'
    ctx.fillStyle = '#155E9B'
    ctx.fillText(String(info.waterCount), x + 34, y + 38)

    ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.fillStyle = '#1B2A4A'
    ctx.fillText('🔥', x + 8, y + 66)
    ctx.font = '600 14px "Segoe UI", sans-serif'
    ctx.fillStyle = '#B5851F'
    ctx.fillText(info.calories > 0 ? `${info.calories} kcal` : '0', x + 34, y + 70)
  }

  return canvas
}

export default function CalendarExport({ user, onClose }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [previewUrl, setPreviewUrl] = useState(null)
  const [canvasEl, setCanvasEl] = useState(null)

  async function generate() {
    setStatus('loading')
    setPreviewUrl(null)

    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 1)

    const [{ data: logs, error: logsErr }, { data: cals, error: calsErr }] = await Promise.all([
      supabase
        .from('logs')
        .select('uploaded_at')
        .eq('user_id', user.id)
        .gte('uploaded_at', monthStart.toISOString())
        .lt('uploaded_at', monthEnd.toISOString()),
      supabase
        .from('calorie_logs')
        .select('calories, logged_at')
        .eq('user_id', user.id)
        .gte('logged_at', monthStart.toISOString())
        .lt('logged_at', monthEnd.toISOString())
    ])

    if (logsErr || calsErr) {
      setStatus('error')
      return
    }

    const byDay = {}
    for (const l of logs || []) {
      const k = localDateKey(new Date(l.uploaded_at))
      byDay[k] = byDay[k] || { waterCount: 0, calories: 0 }
      byDay[k].waterCount += 1
    }
    for (const c of cals || []) {
      const k = localDateKey(new Date(c.logged_at))
      byDay[k] = byDay[k] || { waterCount: 0, calories: 0 }
      byDay[k].calories += c.calories
    }

    const canvas = document.createElement('canvas')
    drawCalendar(canvas, {
      userName: user.full_name || user.email,
      year,
      month,
      byDay
    })
    setCanvasEl(canvas)
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.92))
    setStatus('ready')
  }

  function download() {
    if (!canvasEl) return
    canvasEl.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const namePart = (user.full_name || user.email || 'user').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        a.download = `${namePart}-${year}-${String(month + 1).padStart(2, '0')}.jpg`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-deep/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-blob w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg text-deep">Export monthly calendar</h3>
          <button onClick={onClose} className="text-ink/40 text-xl leading-none px-1">
            ×
          </button>
        </div>
        <p className="text-xs text-ink/40 mb-4">
          {user.full_name || user.email} — JPEG with 💧 water-break counts and 🔥 calories per day.
        </p>

        <div className="flex gap-2 mb-4">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="flex-1 px-3 py-2 rounded-xl border border-deep/10 text-base bg-white outline-none focus:border-splash"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' })}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-xl border border-deep/10 text-base outline-none focus:border-splash tabular"
          />
        </div>

        <button
          onClick={generate}
          disabled={status === 'loading'}
          className="w-full py-2.5 rounded-xl bg-splash text-white font-semibold press-pop disabled:opacity-60 mb-3"
        >
          {status === 'loading' ? 'Generating…' : 'Generate preview'}
        </button>

        {status === 'error' && (
          <p className="text-xs text-coral mb-3">Couldn't load data — check your connection and try again.</p>
        )}

        {previewUrl && (
          <div className="space-y-3">
            <img src={previewUrl} alt="Calendar preview" className="w-full rounded-2xl border border-deep/10" />
            <button
              onClick={download}
              className="w-full py-2.5 rounded-xl bg-mint text-white font-semibold press-pop"
            >
              ⬇ Download JPEG
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
