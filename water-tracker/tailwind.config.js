/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        splash: '#00C2FF',    // primary — electric aqua
        deep: '#155E9B',      // headers, contrast text on light bg
        bubble: '#EAF9FF',    // pale background wash
        mint: '#3DDC97',      // success / completed
        coral: '#FF6B6B',     // playful secondary accent
        sun: '#FFC93C',       // calories / food accent
        grape: '#7C6CF6',     // tertiary accent for variety
        ink: '#1B2A4A'        // body text
      },
      fontFamily: {
        display: ['"Fredoka"', 'sans-serif'],
        body: ['"Nunito"', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace']
      },
      borderRadius: {
        blob: '2rem 3rem 2rem 3rem'
      },
      keyframes: {
        wave: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-14px) scale(1.05)' }
        },
        pop: {
          '0%': { transform: 'scale(0.9)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 }
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' }
        }
      },
      animation: {
        wave: 'wave 6s linear infinite',
        'wave-slow': 'wave 9s linear infinite reverse',
        float: 'float 5s ease-in-out infinite',
        'float-delay': 'float 6s ease-in-out infinite 1.5s',
        pop: 'pop 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        wiggle: 'wiggle 0.4s ease-in-out'
      }
    }
  },
  plugins: []
}
