'use client'

import { useState } from 'react'

export type Plane = 'internal' | 'external'

let _plane: Plane = 'internal'
const _listeners: Array<(p: Plane) => void> = []

export function getActivePlane(): Plane {
  return _plane
}

export function setActivePlane(p: Plane) {
  _plane = p
  _listeners.forEach((l) => l(p))
}

export function PlaneSwitcher() {
  const [plane, setPlane] = useState<Plane>('internal')

  const handleChange = (p: Plane) => {
    setPlane(p)
    setActivePlane(p)
  }

  return (
    <div
      role="group"
      aria-label="Knowledge plane"
      style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}
    >
      {(['internal', 'external'] as Plane[]).map((p) => (
        <button
          key={p}
          onClick={() => handleChange(p)}
          style={{
            flex: 1,
            height: 28,
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            background: plane === p
              ? p === 'internal' ? 'var(--color-internal-subtle)' : 'var(--color-external-subtle)'
              : 'transparent',
            color: plane === p
              ? p === 'internal' ? 'var(--color-internal)' : 'var(--color-external)'
              : 'var(--color-text-muted)',
            fontSize: 'var(--text-xs)',
            fontWeight: plane === p ? 'var(--font-medium)' : 'var(--font-normal)',
            cursor: 'pointer',
            textTransform: 'capitalize',
            transition: 'background 150ms ease, color 150ms ease',
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
