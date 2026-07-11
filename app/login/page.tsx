"use client"

import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', padding: '50px' }}>Cargando...</div>
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'black',
      color: 'white',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: 400,
        padding: 40,
        borderRadius: 16,
        background: '#1a1a1a',
        textAlign: 'center',
        border: '1px solid #333'
      }}>
        <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎵</h1>
        <h2>GitHub para Músicos</h2>
        <p style={{ color: '#888', marginBottom: 30 }}>Inicia sesión para tocar</p>
        <button
          onClick={signInWithGoogle}
          style={{
            width: '100%',
            padding: '14px',
            background: 'white',
            color: 'black',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          🔴 Continuar con Google
        </button>
      </div>
    </div>
  )
}
