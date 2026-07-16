// The signature element: a literal "tank" that fills as check-ins land
// through the day. Two offset wave layers scroll at different speeds
// so the surface feels alive rather than static.
export default function WaterTank({ percent, doneCount, totalCount }) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="relative w-full max-w-[240px] mx-auto pt-3">
      {/* ambient floating bubbles */}
      <div className="deco-bubble w-6 h-6 bg-splash -top-1 -left-3 animate-float" />
      <div className="deco-bubble w-4 h-4 bg-coral top-6 -right-2 animate-float-delay" />
      <div className="deco-bubble w-3 h-3 bg-sun -bottom-2 left-4 animate-float" />

      <div className="relative h-72 w-full rounded-[3rem] border-[6px] border-white bg-white/70 overflow-hidden shadow-[0_12px_0_-4px_rgba(21,94,155,0.15)]">
        {/* fill */}
        <div
          className="absolute bottom-0 left-0 w-full transition-[height] duration-700 ease-out"
          style={{ height: `${clamped}%` }}
        >
          <div className="relative w-full h-full bg-gradient-to-b from-splash to-deep">
            {/* wave crest, sits at the top of the fill */}
            <svg
              className="absolute -top-4 left-0 w-full h-6 text-splash animate-wave"
              style={{ width: '200%' }}
              viewBox="0 0 400 20"
              preserveAspectRatio="none"
            >
              <path
                d="M0 10 C 25 0, 75 20, 100 10 S 175 0, 200 10 S 275 20, 300 10 S 375 0, 400 10 V20 H0 Z"
                fill="currentColor"
                opacity="0.9"
              />
            </svg>
            <svg
              className="absolute -top-2 left-0 w-full h-5 text-mint/70 animate-wave-slow"
              style={{ width: '200%' }}
              viewBox="0 0 400 20"
              preserveAspectRatio="none"
            >
              <path
                d="M0 10 C 25 20, 75 0, 100 10 S 175 20, 200 10 S 275 0, 300 10 S 375 20, 400 10 V20 H0 Z"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        {/* readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={`font-display text-4xl font-semibold drop-shadow-sm ${
              clamped > 45 ? 'text-white' : 'text-deep'
            }`}
          >
            {Math.round(clamped)}%
          </span>
          <span
            className={`tabular text-xs mt-1 ${clamped > 15 ? 'text-white/80' : 'text-deep/60'}`}
          >
            {doneCount}/{totalCount} today
          </span>
        </div>
      </div>
    </div>
  )
}
