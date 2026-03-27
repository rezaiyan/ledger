import React from 'react'

interface EmptyStateProps {
  icon?: string
  title: string
  message?: string
  children?: React.ReactNode
}

export default function EmptyState({ icon = '📭', title, message, children }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 32px',
      color: '#8b949e',
      textAlign: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 40, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#c9d1d9' }}>{title}</div>
      {message && <div style={{ fontSize: 13, maxWidth: 480, lineHeight: 1.6 }}>{message}</div>}
      {children}
    </div>
  )
}
