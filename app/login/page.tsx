"use client"

import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', padding: '50px' }}>Cargando...</div>
  }

  if (user) {
    return (
      <div style={{ color: 'white', textAlign: 'center', padding: '50px' }}>
        <p>✅ Ya estás logueado</p>
        <button onClick={() => window.location.href = '/dashboard'}>
          Ir al dashboard
        </button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0a0a0a',
      color: 'white',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        padding: 40,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎵</h1>
        <h2 style={{ marginBottom: 24 }}>GitHub para Músicos</h2>
        <p style={{ marginBottom: 32, color: '#9ca3af' }}>
          Inicia sesión para tocar en la jam session
        </p>
        <button
          onClick={() => {
            console.log('🖱️ Botón clickeado')
            signInWithGoogle()
          }}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: 'white',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          🔴 Continuar con Google
        </button>
      </div>
    </div>
  )
}
