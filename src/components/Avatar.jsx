const COLORS = ['bg-splash', 'bg-coral', 'bg-sun', 'bg-grape', 'bg-mint']

function colorFor(seed) {
  const i = (seed || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return COLORS[i % COLORS.length]
}

function initialsFor(name, email) {
  const source = (name || '').trim() || (email || '')
  if (!source) return '?'
  const parts = source.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export default function Avatar({ url, name, email, size = 44 }) {
  const style = { width: size, height: size }

  if (url) {
    return (
      <img
        src={url}
        alt={name || 'Profile'}
        style={style}
        className="rounded-full object-cover border-2 border-white shadow-sm"
      />
    )
  }

  return (
    <div
      style={style}
      className={`rounded-full flex items-center justify-center text-white font-display border-2 border-white shadow-sm ${colorFor(
        email
      )}`}
    >
      <span style={{ fontSize: size * 0.38 }}>{initialsFor(name, email)}</span>
    </div>
  )
}
