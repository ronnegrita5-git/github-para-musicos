"use client"

import { useAuth } from '../context/AuthContext'
import Link from 'next/link'

export default function UserStatus() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return <span style={{ color: '#6b7280', fontSize: 14 }}>⏳ Cargando...</span>
  }

  if (user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#10b981',
          fontSize: 14
        }}>
          🟢 {user.email}
        </span>
        <button
          onClick={signOut}
          style={{
            padding: '6px 14px',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13
          }}
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <Link
      href="/login"
      style={{
        padding: '8px 16px',
        background: '#10b981',
        color: 'white',
        borderRadius: 6,
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 'bold'
      }}
    >
      🔑 Iniciar sesión
    </Link>
  )
}
