import { useId } from 'react'

interface SparklineProps {
  values: number[]
  label: string
  className?: string
  /** Stretch to fill the width of its container instead of a fixed small size. */
  stretch?: boolean
}

/** A tiny trend line with a soft fill underneath. */
export function Sparkline({ values, label, className = '', stretch = false }: SparklineProps) {
  const gradientId = useId()
  if (values.length < 2) return null

  const width = 120
  const height = 36
  const pad = 3
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2)
    const y = height - pad - ((value - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${pad},${height} ${line} ${width - pad},${height}`
  const [lastX, lastY] = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio={stretch ? 'none' : undefined}
      className={`h-9 overflow-visible ${stretch ? 'w-full' : 'w-28'} ${className}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5a7828" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#5a7828" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="#5a7828"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {!stretch && <circle cx={lastX} cy={lastY} r="3" fill="#5a7828" stroke="#ffffff" strokeWidth="2" />}
    </svg>
  )
}
