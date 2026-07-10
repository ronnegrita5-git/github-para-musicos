"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../context/AuthContext"
import { useRouter } from "next/navigation"
import Breadcrumbs from "../components/Breadcrumbs"

export default function ExplorePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadProjects()
  }, [searchTerm])

  async function loadProjects() {
    setLoading(true)
    try {
      let query = supabase
        .from("projects")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })

      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error("Error al cargar proyectos:", error)
        setProjects([])
      } else {
        setProjects(data || [])
      }
    } catch (err) {
      console.error("Error inesperado:", err)
      setProjects([])
    }
    setLoading(false)
  }

  async function forkProject(project: any) {
    if (!user) {
      alert("Debes iniciar sesión para hacer fork")
      router.push("/login")
      return
    }

    if (!confirm(`¿Quieres hacer fork de "${project.name}"?`)) return

    const newName = prompt("Nombre para tu fork:", `${project.name} (fork)`)
    if (!newName) return

    try {
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert([
          {
            name: newName,
            description: `Fork de "${project.name}"`,
            user_id: user?.id,
            is_public: true,
          },
        ])
        .select()
        .single()

      if (projectError) {
        alert("Error al crear fork: " + projectError.message)
        return
      }

      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select("*")
        .eq("project_id", project.id)

      if (tracksError) {
        alert("Error al copiar pistas: " + tracksError.message)
        return
      }

      if (tracks && tracks.length > 0) {
        for (const track of tracks) {
          await supabase.from("tracks").insert([
            {
              name: track.name,
              instrument: track.instrument,
              project_id: newProject.id,
              audio_url: track.audio_url,
              user_id: user?.id,
            },
          ])
        }
      }

      alert(`✅ Fork creado: "${newName}"`)
      router.push(`/project/${newProject.id}`)
    } catch (error: any) {
      alert("Error al hacer fork: " + (error.message || "Error desconocido"))
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0a 0%, #0f1a14 50%, #0a0a0a 100%)",
      fontFamily: "'Inter', sans-serif",
      padding: "20px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* 👈 BREADCRUMBS AQUÍ */}
        <Breadcrumbs />

        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 0",
          borderBottom: "1px solid rgba(16, 185, 129, 0.1)",
          marginBottom: 20,
        }}>
          <h1 style={{
            color: "white",
            fontSize: 28,
            margin: 0,
            background: "linear-gradient(135deg, #10b981, #34d399)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            🌍 Explorar proyectos
          </h1>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/" style={{ color: "#10b981", textDecoration: "none" }}>
              ← Inicio
            </Link>
            {user && (
              <Link href="/dashboard" style={{ color: "#10b981", textDecoration: "none" }}>
                🎸 Mis proyectos
              </Link>
            )}
          </div>
        </div>

        {!user && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            padding: 15,
            borderRadius: 8,
            marginBottom: 20,
            textAlign: "center",
            border: "1px solid rgba(16, 185, 129, 0.1)",
          }}>
            <p>
              👋 <Link href="/login" style={{ color: "#10b981", fontWeight: "bold" }}>Inicia sesión</Link> para hacer fork de proyectos.
            </p>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="🔍 Buscar proyectos por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              maxWidth: 500,
              padding: 12,
              borderRadius: 8,
              border: "1px solid rgba(16, 185, 129, 0.2)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 16,
            }}
          />
        </div>

        {loading ? (
          <div style={{ color: "#10b981", textAlign: "center", padding: 40 }}>
            🎧 Cargando proyectos...
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            border: "1px dashed rgba(16, 185, 129, 0.2)",
          }}>
            <p style={{ color: "#10b981", fontSize: 18, margin: 0 }}>
              {searchTerm ? "No se encontraron proyectos" : "No hay proyectos públicos todavía"}
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(10px)",
                  borderRadius: 16,
                  padding: 20,
                  border: "1px solid rgba(16, 185, 129, 0.1)",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-4px)"
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(16, 185, 129, 0.08)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              >
                <div>
                  <Link href={`/project/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <h3 style={{ color: "white", margin: 0, fontSize: 18, fontWeight: 600 }}>
                      🎵 {p.name}
                    </h3>
                    <p style={{ color: "#9ca3af", fontSize: 14, margin: "8px 0 0 0", lineHeight: 1.4 }}>
                      {p.description || "Sin descripción"}
                    </p>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                      📅 {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </Link>
                </div>
                <div style={{ marginTop: 16 }}>
                  {user ? (
                    <button
                      onClick={() => forkProject(p)}
                      style={{
                        padding: "8px 16px",
                        background: "linear-gradient(135deg, #6f42c1, #5a32a3)",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14,
                        width: "100%",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.02)"
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)"
                      }}
                    >
                      🔀 Fork
                    </button>
                  ) : (
                    <Link href="/login" style={{ textDecoration: "none", display: "block" }}>
                      <button
                        style={{
                          padding: "8px 16px",
                          background: "#6b7280",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontSize: 14,
                          width: "100%",
                        }}
                      >
                        🔀 Fork (login)
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
