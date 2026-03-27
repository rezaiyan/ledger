import React from 'react'
import type { SessionType } from '../../src/types'

const SESSION_TYPE_COLORS: Record<SessionType | 'other', { bg: string; text: string }> = {
  feature:  { bg: '#1f3c6e', text: '#79c0ff' },
  bug:      { bg: '#4a1218', text: '#ff7b72' },
  refactor: { bg: '#3a2600', text: '#d29922' },
  explore:  { bg: '#2e1a47', text: '#d2a8ff' },
  research: { bg: '#0d3331', text: '#56d364' },
  other:    { bg: '#21262d', text: '#8b949e' },
}

const MODEL_COLORS: Record<string, { bg: string; text: string }> = {
  'claude-opus':   { bg: '#1f3c6e', text: '#79c0ff' },
  'claude-sonnet': { bg: '#0d3331', text: '#3fb950' },
  'claude-haiku':  { bg: '#2e1a47', text: '#d2a8ff' },
}

function getModelColors(model: string): { bg: string; text: string } {
  for (const [key, val] of Object.entries(MODEL_COLORS)) {
    if (model.toLowerCase().includes(key.replace('claude-', ''))) return val
  }
  return { bg: '#21262d', text: '#8b949e' }
}

interface BadgeProps {
  label: string
  type?: 'session' | 'model' | 'custom'
  bg?: string
  text?: string
}

export default function Badge({ label, type = 'custom', bg, text }: BadgeProps) {
  let colors = { bg: bg ?? '#21262d', text: text ?? '#8b949e' }

  if (type === 'session') {
    const t = label.toLowerCase() as SessionType
    colors = SESSION_TYPE_COLORS[t] ?? SESSION_TYPE_COLORS.other
  } else if (type === 'model') {
    colors = getModelColors(label)
  }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 12,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.3px',
      background: colors.bg,
      color: colors.text,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
