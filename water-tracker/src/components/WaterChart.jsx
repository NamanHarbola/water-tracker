// Dependency-free SVG bar chart. Renders one series (water breaks or
// calories) as bars over a set of days, with an optional goal line.
// Kept as hand-rolled SVG rather than pulling in a charting library so the
// project doesn't need any new npm dependency for this.

export default function WaterChart({ data, valueKey, color, unit, goal, height = 140 }) {
  const max = Math.max(goal || 0, ...data.map((d) => d[valueKey] || 0), 1)
  const barGap = 4
  const chartWidth = Math.max(320, data.length * 28)
  const chartHeight = height
  const barAreaHeight = chartHeight - 28 // leave room for x-axis labels
  const barWidth = Math.max(6, chartWidth / data.length - barGap)

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width={chartWidth}
        height={chartHeight}
        className="block"
      >
        {goal > 0 && (
          <line
            x1={0}
            x2={chartWidth}
            y1={barAreaHeight - (goal / max) * barAreaHeight}
            y2={barAreaHeight - (goal / max) * barAreaHeight}
            stroke="#1B2A4A"
            strokeOpacity={0.15}
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        )}
        {data.map((d, i) => {
          const value = d[valueKey] || 0
          const barHeight = max > 0 ? (value / max) * barAreaHeight : 0
          const x = i * (barWidth + barGap)
          const y = barAreaHeight - barHeight
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, value > 0 ? 2 : 0)}
                rx={Math.min(4, barWidth / 2)}
                fill={color}
                fillOpacity={value > 0 ? 1 : 0}
              />
              <rect
                x={x}
                y={0}
                width={barWidth}
                height={barAreaHeight}
                fill={color}
                fillOpacity={0.06}
                rx={Math.min(4, barWidth / 2)}
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight - 10}
                textAnchor="middle"
                fontSize={9}
                fill="#1B2A4A"
                fillOpacity={0.4}
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="text-[11px] text-ink/30 mt-1">
        Bars show {unit} per day{goal > 0 ? ` · dashed line = goal (${goal})` : ''}
      </p>
    </div>
  )
}
