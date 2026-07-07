"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

type AuthContextType = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    console.log("🔵 AuthProvider: Inicializando...")
    
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log("🔵 Sesión:", session ? `Sí (${session.user.email})` : "No")
      
      if (session) {
        setUser(session.user)
        // 👈 REDIRIGIR AL DASHBOARD SI HAY SESIÓN
        router.push("/dashboard")
      } else {
        setUser(null)
        // 👈 REDIRIGIR AL LOGIN SI NO HAY SESIÓN
        router.push("/login")
      }
      setLoading(false)
    }
    
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🔵 Cambio de estado:", _event)
      console.log("🔵 Usuario:", session?.user?.email || "No autenticado")
      
      if (session) {
        setUser(session.user)
        router.push("/dashboard")
      } else {
        setUser(null)
        router.push("/login")
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    console.log("🔵 Iniciando login con Google...")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) {
      console.error("❌ Error:", error)
      throw error
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push("/")
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
