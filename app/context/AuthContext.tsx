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
    // Obtener sesión actual
    const getSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        console.log('🔍 Sesión obtenida:', data?.session?.user?.email || 'No hay sesión')
        setUser(data?.session?.user ?? null)
      } catch (error) {
        console.error('Error obteniendo sesión:', error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    // Escuchar cambios en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Evento de autenticación:', event)
      console.log('👤 Usuario:', session?.user?.email || 'No hay usuario')
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    try {
      console.log('🔄 Iniciando login...')
      const origin = window.location.origin
      const redirectUrl = `${origin}/auth/callback`
      console.log('📍 Redirigiendo a:', redirectUrl)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      })
      
      if (error) {
        console.error('❌ Error:', error)
        throw error
      }
      
      console.log('✅ Login iniciado, redirigiendo a Google...')
      // La redirección la maneja Supabase automáticamente
      
    } catch (error) {
      console.error('❌ Error inesperado:', error)
      alert('Error al iniciar sesión: ' + (error as Error).message)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      console.log('✅ Sesión cerrada')
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
