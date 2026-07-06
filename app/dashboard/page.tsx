"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../context/AuthContext"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDesc, setNewProjectDesc] = useState("")

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    loadProjects()
  }, [user])

  async function loadProjects() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setProjects(data || [])
    setLoading(false)
  }

  async function createProject() {
    if (!newProjectName.trim()) {
      alert("El nombre del proyecto es obligatorio")
      return
    }

    if (!user) {
      alert("No has iniciado sesión. Por favor, inicia sesión de nuevo.")
      router.push("/login")
      return
    }

    const { error } = await supabase
      .from("projects")
      .insert([
        {
          name: newProjectName,
          description: newProjectDesc || "Proyecto musical colaborativo",
          user_id: user.id,
          is_public: true,
        },
      ])

    if (error) {
      console.error("❌ Error al crear proyecto:", error)
      alert("Error al crear proyecto: " + error.message)
      return
    }

    setNewProjectName("")
    setNewProjectDesc("")
    setShowCreate(false)
    loadProjects()
  }

  async function deleteProject(projectId: string, projectName: string) {
    if (!confirm(`¿Seguro que quieres eliminar el proyecto "${projectName}"?\n\n⚠️ Esta acción eliminará TODAS las pistas y no se puede deshacer.`)) {
      return
    }

    try {
      const { data: tracks } = await supabase
        .from("tracks")
        .select("audio_url")
        .eq("project_id", projectId)

      if (tracks && tracks.length > 0) {
        for (const track of tracks) {
          if (track.audio_url) {
            const fileName = track.audio_url.split('/').pop()
            if (fileName) {
              await supabase.storage
                .from("audio")
                .remove([`${projectId}/${fileName}`])
            }
          }
        }
      }

      await supabase
        .from("tracks")
        .delete()
        .eq("project_id", projectId)

      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId)

      if (error) {
        alert("Error al eliminar proyecto: " + error.message)
        return
      }

      alert(`✅ Proyecto "${projectName}" eliminado correctamente`)
      loadProjects()

    } catch (error: any) {
      alert("Error al eliminar proyecto: " + (error.message || "Error desconocido"))
    }
  }

  if (!user) return null

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
      fontFamily: "Arial, sans-serif",
      padding: 20
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 0",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        flexWrap: "wrap",
        gap: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🎵</span>
          <h1 style={{ color: "white", margin: 0, fontSize: 24 }}>GitHub para Músicos</h1>
        </div>
        <div style={{ display: "flex", gap: 15, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/explore" style={{ color: "#a78bfa", textDecoration: "none", fontSize: 14 }}>
            🌍 Explorar
          </Link>
          <span style={{ color: "#c4b5fd", fontSize: 14 }}>
            👤 {user.email}
          </span>
          <button
            onClick={signOut}
            style={{
              padding: "8px 20px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 0" }}>
        <div style={{ marginBottom: 30 }}>
          <h2 style={{ color: "white", fontSize: 28, margin: 0 }}>
            🎸 Tus proyectos
          </h2>
          <p style={{ color: "#a78bfa", fontSize: 16, marginTop: 5 }}>
            Crea, colabora y comparte tu música
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{
            padding: "12px 28px",
            background: showCreate ? "#6b21a5" : "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: "bold",
            marginBottom: 30,
          }}
        >
          {showCreate ? "✕ Cancelar" : "+ Nuevo Proyecto"}
        </button>

        {showCreate && (
          <div style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(10px)",
            padding: 25,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 30,
          }}>
            <h3 style={{ color: "white", margin: "0 0 15px 0" }}>✨ Crear nuevo proyecto</h3>
            <input
              placeholder="Nombre del proyecto *"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.1)",
                color: "white",
                fontSize: 16,
                marginBottom: 12,
              }}
            />
            <input
              placeholder="Descripción (opcional)"
              value={newProjectDesc}
              onChange={(e) => setNewProjectDesc(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.1)",
                color: "white",
                fontSize: 16,
                marginBottom: 12,
              }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={createProject}
                style={{
                  padding: "10px 24px",
                  background: "#22c55e",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                🚀 Crear
              </button>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: "10px 24px",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: "#a78bfa", textAlign: "center", padding: 40 }}>
            🎧 Cargando proyectos...
          </div>
        ) : projects.length === 0 ? (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            border: "1px dashed rgba(255,255,255,0.1)",
          }}>
            <p style={{ color: "#a78bfa", fontSize: 18, margin: 0 }}>
              🎹 No tienes proyectos aún. ¡Crea tu primer proyecto musical!
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(10px)",
                  borderRadius: 16,
                  padding: 20,
                  border: "1px solid rgba(255,255,255,0.08)",
                  transition: "transform 0.2s, box-shadow 0.3s",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)"
                  e.currentTarget.style.boxShadow = "0 12px 40px rgba(0,0,0,0.3)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "none"
                }}
              >
                <Link
                  href={`/project/${p.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <h3 style={{ color: "white", margin: 0, fontSize: 18 }}>
                    🎸 {p.name}
                  </h3>
                  <p style={{ color: "#c4b5fd", fontSize: 14, margin: "8px 0 0 0", opacity: 0.8 }}>
                    {p.description || "Sin descripción"}
                  </p>
                  <div style={{ color: "#8b5cf6", fontSize: 12, marginTop: 12 }}>
                    📅 {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    deleteProject(p.id, p.name)
                  }}
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    background: "rgba(239, 68, 68, 0.2)",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                  title="Eliminar proyecto"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
