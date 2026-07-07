"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

type Profile = {
  id: string
  email: string
  full_name: string
  avatar_url: string
  bio: string
  country: string
  city: string
  genres: string[]
  website: string
  social_links: {
    instagram?: string
    twitter?: string
    youtube?: string
  }
  created_at: string
  updated_at: string
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, metadata?: any) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
    
    if (data) {
      setProfile(data)
    } else {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        await supabase.from("profiles").insert([
          {
            id: userData.user.id,
            email: userData.user.email,
            full_name: userData.user.user_metadata?.full_name || "",
            avatar_url: userData.user.user_metadata?.avatar_url || "",
          }
        ])
        loadProfile(userId)
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, metadata?: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {}
      }
    })
    if (error) throw error
    router.push("/dashboard")
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    router.push("/dashboard")
  }

  // 👈 GOOGLE LOGIN CON URL DINÁMICA
  const signInWithGoogle = async () => {
    const redirectUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_VERCEL_URL 
        ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
        : 'http://localhost:3000'

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${redirectUrl}/auth/callback`
      }
    })
    if (error) {
      console.error("❌ Error en Google:", error)
      throw error
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
    router.push("/")
    router.refresh()
  }

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) throw new Error("No hay usuario autenticado")
    
    const { error } = await supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", user.id)
    
    if (error) throw error
    await loadProfile(user.id)
  }

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      updateProfile,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
