"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (mounted) {
          setUser(data?.session?.user ?? null)
        }
      } catch (error) {
        console.error('Error obteniendo sesión:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Evento de autenticación:', event)
      if (mounted) {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      const origin = window.location.origin
      console.log('📍 Iniciando login desde:', origin)
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`
        }
      })
      
      if (error) throw error
      
      console.log('✅ Redirigiendo a Google...')
      
    } catch (error) {
      console.error('❌ Error en login:', error)
      alert('Error al iniciar sesión: ' + (error as Error).message)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
    } catch (error) {
      console.error('Error cerrando sesión:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
