"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/app/context/AuthContext"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Project {
  id: string
  name: string
  description: string
  user_id: string
  is_public: boolean
  parent_project_id: string | null
  fork_count: number
  created_at: string
  tracks?: any[]
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadMyProjects()
    } else {
      setLoading(false)
    }
  }, [user])

  const loadMyProjects = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      console.log('Cargando proyectos para usuario:', user.id)
      
      // Usar la API para obtener proyectos del usuario
      const response = await fetch(`/api/projects/user/me`, {
        headers: {
          'x-user-id': user.id
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al cargar proyectos')
      }

      const data = await response.json()
      console.log('Proyectos cargados:', data)
      setProjects(data || [])
    } catch (error) {
      console.error("Error cargando proyectos:", error)
      setError(error instanceof Error ? error.message : 'Error al cargar proyectos')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div style={{ padding: 40, color: "white", textAlign: "center" }}>
        <p>🔒 Inicia sesión para ver tus proyectos</p>
        <Link href="/login" style={{ color: "#10b981" }}>Iniciar sesión</Link>
      </div>
    )
  }

  if (loading) {
    return <div style={{ padding: 40, color: "white", textAlign: "center" }}>⏳ Cargando tus proyectos...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: "white", textAlign: "center" }}>
        <p style={{ color: "#ef4444" }}>❌ {error}</p>
        <button 
          onClick={() => loadMyProjects()}
          style={{
            marginTop: 16,
            padding: "8px 16px",
            background: "#10b981",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div style={{ 
      display: "flex", 
      minHeight: "100vh", 
      background: "#0a0a0a", 
      color: "white",
      padding: "40px",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 32, margin: 0 }}>📊 Mis Proyectos</h1>
            <p style={{ color: "#6b7280", marginTop: 4 }}>
              {projects.length} {projects.length === 1 ? 'proyecto' : 'proyectos'}
            </p>
          </div>
          <Link 
            href="/project/new" 
            style={{ 
              padding: "10px 20px", 
              background: "#10b981", 
              color: "white", 
              borderRadius: 8, 
              textDecoration: "none",
              fontWeight: "bold"
            }}
          >
            ➕ Nuevo Proyecto
          </Link>
        </div>

        {projects.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: 60, 
            background: "rgba(255,255,255,0.03)", 
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.1)"
          }}>
            <p style={{ color: "#6b7280", fontSize: 18 }}>No tienes proyectos aún</p>
            <Link
              href="/project/new"
              style={{
                display: "inline-block",
                marginTop: 16,
                padding: "10px 24px",
                background: "#10b981",
                color: "white",
                borderRadius: 8,
                textDecoration: "none"
              }}
            >
              Crear tu primer proyecto
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {projects.map((p) => {
              const isFork = p.parent_project_id !== null
              const trackCount = p.tracks?.length || 0
              
              return (
                <Link 
                  key={p.id}
                  href={`/project/${p.id}`}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    padding: "20px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    transition: "all 0.2s",
                    textDecoration: "none",
                    color: "white",
                    display: "block"
                  }}
                >
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                    {isFork && (
                      <span style={{ fontSize: 10, background: "#3b82f6", color: "white", padding: "2px 8px", borderRadius: 12 }}>
                        🔀 Fork
                      </span>
                    )}
                    <span style={{ 
                      fontSize: 10, 
                      background: p.is_public ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.2)", 
                      color: p.is_public ? "#10b981" : "#6b7280", 
                      padding: "2px 8px", 
                      borderRadius: 12
                    }}>
                      {p.is_public ? "🌍 Público" : "🔒 Privado"}
                    </span>
                  </div>

                  <h3 style={{ margin: 0, marginBottom: 8, fontSize: 18 }}>
                    {p.name || "Sin título"}
                  </h3>
                  
                  <p style={{ 
                    color: "#9ca3af", 
                    fontSize: 14, 
                    marginBottom: 12,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>
                    {p.description || "Sin descripción"}
                  </p>
                  
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: 13, color: "#6b7280" }}>
                    <span>🎵 {trackCount} pistas</span>
                    {p.fork_count > 0 && <span>🔀 {p.fork_count} forks</span>}
                    <span>📅 {new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
