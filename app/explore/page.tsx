"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../context/AuthContext"
import { supabase, supabasePublic } from "@/lib/supabase"

interface Track {
  id: string
  name: string
  audio_url: string
}

interface Project {
  id: string
  name: string
  description: string
  user_id: string
  is_public: boolean
  parent_project_id: string | null
  fork_depth: number
  fork_count: number
  license: string
  category?: string
  tags?: string[]
  created_at: string
  tracks?: Track[]
}

// ✅ Emojis por categoría
const CATEGORY_EMOJIS: Record<string, string> = {
  'viento': '🎷',
  'cuerda': '🎻',
  'moderna': '🎸'
}

export default function ExplorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const { data, error } = await supabasePublic
          .from("projects")
          .select("*, tracks(*)")
          .eq("is_public", true)
          .order("created_at", { ascending: false })

        if (error) throw error
        setProjects(data || [])
      } catch (error) {
        console.error("Error:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])

  const handleProjectClick = (projectId: string) => {
    router.push(`/project/${projectId}`)
  }

  if (loading) {
    return <div style={{ color: "white", padding: 40 }}>⏳ Cargando proyectos...</div>
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white" }}>
      <aside style={{ width: 240, padding: "24px 16px", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>🎵 Music Collab</div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
        <Link href="/jam-web" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🎸 Jam</Link>
      </aside>

      <main style={{ flex: 1, padding: "40px", maxWidth: "1200px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: 32, margin: 0 }}>📁 Proyectos</h1>
            <p style={{ color: "#6b7280", marginTop: 4 }}>
              {projects.length} {projects.length === 1 ? 'proyecto' : 'proyectos'} públicos
            </p>
          </div>
          {user && (
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
              ➕ Nuevo proyecto
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: 60, 
            background: "rgba(255,255,255,0.03)", 
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.1)"
          }}>
            <p style={{ color: "#6b7280", fontSize: 18 }}>No hay proyectos públicos aún</p>
            {user && (
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
                Crear el primer proyecto
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {projects.map((p) => {
              const isFork = p.parent_project_id !== null
              const trackCount = p.tracks?.length || 0
              const categoryEmoji = p.category ? CATEGORY_EMOJIS[p.category] || '🎵' : '🎵'
              
              return (
                <div
                  key={p.id}
                  onClick={() => handleProjectClick(p.id)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: 12,
                    padding: "20px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    position: "relative"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)"
                    e.currentTarget.style.borderColor = "#10b981"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)"
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"
                  }}
                >
                  {/* Badges */}
                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
                    {isFork && (
                      <span style={{ 
                        fontSize: 10, 
                        background: "#3b82f6", 
                        color: "white", 
                        padding: "2px 8px", 
                        borderRadius: 12,
                        fontWeight: "bold"
                      }}>
                        🔀 Fork
                      </span>
                    )}
                    {p.fork_count > 0 && (
                      <span style={{ 
                        fontSize: 10, 
                        background: "rgba(251,191,36,0.2)", 
                        color: "#fbbf24", 
                        padding: "2px 8px", 
                        borderRadius: 12
                      }}>
                        🔀 {p.fork_count} forks
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

                  <h3 style={{ margin: 0, marginBottom: 8, color: "white", fontSize: 18 }}>
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
                    <span>👤 {p.user_id}</span>
                    <span>🎵 {trackCount} pistas</span>
                    <span>📅 {new Date(p.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* ✅ Mostrar categoría en la tarjeta */}
                  {p.category && (
                    <div style={{ 
                      marginTop: 8, 
                      fontSize: 12, 
                      color: "#10b981",
                      padding: "4px 8px",
                      background: "rgba(16,185,129,0.05)",
                      borderRadius: 4,
                      border: "1px solid rgba(16,185,129,0.1)"
                    }}>
                      {categoryEmoji} {p.tags?.join(' · ') || p.category}
                    </div>
                  )}

                  {isFork && (
                    <div style={{ 
                      fontSize: 11, 
                      color: "#6b7280", 
                      marginTop: 8,
                      padding: "4px 8px",
                      background: "rgba(59,130,246,0.1)",
                      borderRadius: 4,
                      border: "1px solid rgba(59,130,246,0.1)"
                    }}>
                      🔀 Fork de proyecto original
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
