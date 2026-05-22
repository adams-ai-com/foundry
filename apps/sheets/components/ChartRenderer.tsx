'use client'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

export type ChartData = {
  labels: string[]
  series: { name: string; values: number[] }[]
}

const PAD = { top: 24, right: 16, bottom: 44, left: 48 }

function yScale(allVals: number[], height: number): (v: number) => number {
  const min = Math.min(0, ...allVals)
  const max = Math.max(...allVals, 1)
  const range = max - min || 1
  const chartH = height - PAD.top - PAD.bottom
  return (v: number) => PAD.top + chartH - ((v - min) / range) * chartH
}

function yTicks(allVals: number[]): number[] {
  const min = Math.min(0, ...allVals)
  const max = Math.max(...allVals, 1)
  const range = max - min || 1
  return Array.from({ length: 5 }, (_, i) => min + (range / 4) * i)
}

export function BarChartSVG({ data, width, height }: { data: ChartData; width: number; height: number }) {
  const chartW = width - PAD.left - PAD.right
  const allValues = data.series.flatMap(s => s.values)
  const ys = yScale(allValues, height)
  const ticks = yTicks(allValues)
  const n = Math.max(data.labels.length, 1)
  const groupW = chartW / n
  const barW = Math.min(groupW / Math.max(data.series.length, 1) * 0.75, 36)
  const zeroY = ys(0)

  return (
    <svg width={width} height={height}>
      {ticks.map((v, i) => {
        const y = ys(v)
        return (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        )
      })}

      <line x1={PAD.left} x2={PAD.left + chartW} y1={zeroY} y2={zeroY} stroke="#d1d5db" strokeWidth={1.5} />

      {data.labels.map((label, i) => {
        const groupX = PAD.left + i * groupW
        return (
          <g key={i}>
            {data.series.map((s, si) => {
              const v = s.values[i] ?? 0
              const bx = groupX + (groupW - barW * data.series.length) / 2 + si * barW
              const barH = Math.abs(ys(v) - zeroY)
              const by = v >= 0 ? ys(v) : zeroY
              return <rect key={si} x={bx} y={by} width={Math.max(barW - 1, 1)} height={Math.max(barH, 1)} fill={COLORS[si % COLORS.length]} rx={1} opacity={0.85} />
            })}
            <text x={groupX + groupW / 2} y={height - PAD.bottom + 13} textAnchor="middle" fontSize={9} fill="#6b7280">
              {label.length > 10 ? label.slice(0, 9) + '…' : label}
            </text>
          </g>
        )
      })}

      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + height - PAD.top - PAD.bottom} stroke="#d1d5db" strokeWidth={1} />

      {data.series.length > 1 && (
        <g transform={`translate(${PAD.left}, ${height - 10})`}>
          {data.series.map((s, i) => (
            <g key={i} transform={`translate(${i * 75}, 0)`}>
              <rect x={0} y={-8} width={9} height={9} fill={COLORS[i % COLORS.length]} rx={1} />
              <text x={12} y={0} fontSize={9} fill="#6b7280">{s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

export function LineChartSVG({ data, width, height }: { data: ChartData; width: number; height: number }) {
  const chartW = width - PAD.left - PAD.right
  const chartH = height - PAD.top - PAD.bottom
  const allValues = data.series.flatMap(s => s.values)
  const ys = yScale(allValues, height)
  const ticks = yTicks(allValues)
  const n = Math.max(data.labels.length - 1, 1)
  const stepX = chartW / n

  return (
    <svg width={width} height={height}>
      {ticks.map((v, i) => {
        const y = ys(v)
        return (
          <g key={i}>
            <line x1={PAD.left} x2={PAD.left + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        )
      })}

      {data.series.map((s, si) => {
        const color = COLORS[si % COLORS.length]
        if (s.values.length < 2) return null
        const pts = s.values.map((v, i) => `${PAD.left + i * stepX},${ys(v)}`).join(' ')
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={PAD.left + i * stepX} cy={ys(v)} r={3} fill={color} />
            ))}
          </g>
        )
      })}

      {data.labels.map((label, i) => (
        <text key={i} x={PAD.left + i * stepX} y={height - PAD.bottom + 13}
          textAnchor="middle" fontSize={9} fill="#6b7280">
          {label.length > 10 ? label.slice(0, 9) + '…' : label}
        </text>
      ))}

      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + chartH} stroke="#d1d5db" strokeWidth={1} />
      <line x1={PAD.left} x2={PAD.left + chartW} y1={PAD.top + chartH} y2={PAD.top + chartH} stroke="#d1d5db" strokeWidth={1} />

      {data.series.length > 1 && (
        <g transform={`translate(${PAD.left}, ${height - 10})`}>
          {data.series.map((s, i) => (
            <g key={i} transform={`translate(${i * 75}, 0)`}>
              <line x1={0} x2={11} y1={-3} y2={-3} stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
              <text x={14} y={0} fontSize={9} fill="#6b7280">{s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

export function PieChartSVG({ data, width, height }: { data: ChartData; width: number; height: number }) {
  const s = data.series[0]
  if (!s) return <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#9ca3af">No data</text>

  const cx = width * 0.42
  const cy = height * 0.5
  const r = Math.min(cx, cy) * 0.78
  const positives = s.values.map(v => Math.max(v, 0))
  const total = positives.reduce((a, b) => a + b, 0) || 1

  let angle = -Math.PI / 2
  const slices = data.labels.map((label, i) => {
    const v = positives[i] ?? 0
    const pct = v / total
    const start = angle
    angle += pct * 2 * Math.PI
    const end = angle
    const x1 = cx + r * Math.cos(start)
    const y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    return {
      label, pct, color: COLORS[i % COLORS.length],
      d: pct > 0.001 ? `M${cx},${cy}L${x1},${y1}A${r},${r},0,${pct > 0.5 ? 1 : 0},1,${x2},${y2}Z` : '',
    }
  })

  return (
    <svg width={width} height={height}>
      {slices.map((sl, i) => sl.d && (
        <path key={i} d={sl.d} fill={sl.color} stroke="white" strokeWidth={1.5} opacity={0.85} />
      ))}
      <g transform={`translate(${width * 0.78}, ${height * 0.15})`}>
        {slices.map((sl, i) => (
          <g key={i} transform={`translate(0,${i * 20})`}>
            <rect x={0} y={-9} width={10} height={10} fill={sl.color} rx={1} />
            <text x={13} y={0} fontSize={9} fill="#374151">{sl.label.length > 10 ? sl.label.slice(0, 9) + '…' : sl.label}</text>
            <text x={13} y={11} fontSize={8} fill="#9ca3af">{(sl.pct * 100).toFixed(1)}%</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
