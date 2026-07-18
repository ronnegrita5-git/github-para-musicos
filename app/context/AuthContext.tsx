"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  city?: string
  country?: string
  instrument_id?: string
  music_genre?: string
  bio?: string
  avatar_url?: string
  created_at?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, userData?: Partial<User>) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    return {
      user: null,
      loading: false,
      signIn: async () => {},
      signUp: async () => {},
      signOut: async () => {},
    } as AuthContextType
  }
  return context
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (userData) {
          setUser({
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            city: userData.city || '',
            country: userData.country || '',
            instrument_id: userData.instrument_id || '',
            music_genre: userData.music_genre || '',
            bio: userData.bio || '',
            avatar_url: userData.avatar_url || '',
            created_at: userData.created_at,
          })
        }
      }

      setLoading(false)
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null)
        } else if (event === 'SIGNED_IN' && session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (userData) {
            setUser({
              id: userData.id,
              email: userData.email,
              first_name: userData.first_name || '',
              last_name: userData.last_name || '',
              city: userData.city || '',
              country: userData.country || '',
              instrument_id: userData.instrument_id || '',
              music_genre: userData.music_genre || '',
              bio: userData.bio || '',
              avatar_url: userData.avatar_url || '',
              created_at: userData.created_at,
            })
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, userData?: Partial<User>) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const { error: dbError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            first_name: userData?.first_name || null,
            last_name: userData?.last_name || null,
            city: userData?.city || null,
            country: userData?.country || null,
            instrument_id: userData?.instrument_id || null,
            music_genre: userData?.music_genre || null,
            bio: userData?.bio || null,
          })

        if (dbError) throw dbError

        const newUser = {
          id: data.user.id,
          email,
          first_name: userData?.first_name || '',
          last_name: userData?.last_name || '',
          city: userData?.city || '',
          country: userData?.country || '',
          instrument_id: userData?.instrument_id || '',
          music_genre: userData?.music_genre || '',
          bio: userData?.bio || '',
        }

        setUser(newUser)
      }
    } catch (error) {
      console.error('Error en registro:', error)
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle()

        let loggedUser

        if (!userData) {
          loggedUser = {
            id: data.user.id,
            email: data.user.email || email,
            first_name: '',
            last_name: '',
            city: '',
            country: '',
            instrument_id: '',
            music_genre: '',
            bio: '',
            avatar_url: '',
            created_at: new Date().toISOString(),
          }

          await supabase.from('users').insert({
            id: loggedUser.id,
            email: loggedUser.email,
          })
        } else {
          loggedUser = {
            id: userData.id,
            email: userData.email,
            first_name: userData.first_name || '',
            last_name: userData.last_name || '',
            city: userData.city || '',
            country: userData.country || '',
            instrument_id: userData.instrument_id || '',
            music_genre: userData.music_genre || '',
            bio: userData.bio || '',
            avatar_url: userData.avatar_url || '',
            created_at: userData.created_at,
          }
        }

        setUser(loggedUser)
      }
    } catch (error) {
      console.error('Error en login:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
