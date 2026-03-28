import React from 'react'

interface StatCardProps {
  value: string
  label: string
  delta?: number
  deltaLabel?: string
  subtitle?: string
  accent?: string
}

export default function StatCard({ value, label, delta, deltaLabel, subtitle, accent }: StatCardProps) {
  const isPositive = delta !== undefined && delta >= 0
  const deltaColor = isPositive ? '#3fb950' : '#f85149'
  const deltaArrow = isPositive ? '↑' : '↓'

  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderTop: accent ? `2px solid ${accent}` : '1px solid #21262d',
      borderRadius: 8,
      padding: '16px 20px',
      minWidth: 0,
      flex: 1,
    }}>
      <div style={{
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: '-0.5px',
        color: accent ?? '#e6edf3',
        lineHeight: 1.2,
        marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 500 }}>
        {label}
      </div>
      {delta !== undefined && (
        <div style={{ marginTop: 8, fontSize: 12, color: deltaColor }}>
          {deltaArrow} {Math.abs(delta).toFixed(1)}% {deltaLabel ?? ''}
        </div>
      )}
      {subtitle && (
        <div style={{ marginTop: 6, fontSize: 12, color: '#6e7681' }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
