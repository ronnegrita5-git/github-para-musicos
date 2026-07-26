"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/app/context/AuthContext"
import Link from "next/link"
import ForkModal from "@/app/components/ForkModal"

interface Project {
  id: string
  name: string
  description: string
  user_id: string
  is_public: boolean
  license: string
  parent_project_id: string | null
  fork_depth: number
  fork_count: number
  bpm: number
  tracks: any[]
  stats: { views: number; stars: number }
  created_at: string
}

export default function Home() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forkModalOpen, setForkModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Cargar proyectos al montar el componente
  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('🔍 Cargando proyectos desde /api/projects...')
      const response = await fetch('/api/projects')
      
      if (!response.ok) {
        const text = await response.text()
        console.error('❌ Error response:', text)
        throw new Error(`Error ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`✅ ${data.length} proyectos cargados`)
      setProjects(data)
    } catch (error) {
      console.error('❌ Error:', error)
      setError(error instanceof Error ? error.message : 'Error al cargar proyectos')
    } finally {
      setLoading(false)
    }
  }

  const handleForkClick = (project: Project) => {
    if (!user) {
      alert('⚠️ Debes iniciar sesión para hacer fork')
      return
    }
    setSelectedProject(project)
    setForkModalOpen(true)
  }

  const handleForkCreated = () => {
    loadProjects()
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "black", color: "white" }}>
      {/* Sidebar */}
      <aside style={{ 
        width: 240, 
        padding: "24px 16px", 
        background: "rgba(255,255,255,0.03)", 
        borderRight: "1px solid rgba(255,255,255,0.1)",
        position: "sticky",
        top: 0,
        height: "100vh"
      }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>🎵 Music Collab</div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🔍 Explorar</Link>
        {user && (
          <>
            <Link href="/dashboard" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>📊 Dashboard</Link>
            <Link href="/project/new" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>➕ Nuevo Proyecto</Link>
          </>
        )}
        <div style={{ marginTop: 20, padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {user ? `👤 ${user.email}` : "🔒 No autenticado"}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 32, marginBottom: 8 }}>🎵 GitHub para Músicos</h1>
            <p style={{ color: "#9ca3af" }}>
              {user ? `👋 Bienvenido, ${user.email}` : "Colabora con otros músicos en tiempo real"}
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
              ➕ Nuevo Proyecto
            </Link>
          )}
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 16, color: "#e5e7eb" }}>
          🌍 Proyectos Públicos
        </h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
            ⏳ Cargando proyectos...
          </div>
        ) : error ? (
          <div style={{ 
            textAlign: "center", 
            padding: 40, 
            color: "#ef4444",
            background: "rgba(239,68,68,0.1)",
            borderRadius: 8,
            border: "1px solid rgba(239,68,68,0.2)"
          }}>
            <p>❌ {error}</p>
            <button
              onClick={loadProjects}
              style={{
                marginTop: 12,
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
        ) : projects.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: 60, 
            background: "rgba(255,255,255,0.03)", 
            borderRadius: 12,
            border: "1px dashed rgba(255,255,255,0.1)"
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
            <p style={{ color: "#9ca3af", fontSize: 18 }}>
              No hay proyectos públicos aún
            </p>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {projects.map((project) => (
              <div 
                key={project.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: 20,
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Link 
                    href={`/project/${project.id}`}
                    style={{ 
                      fontSize: 18, 
                      fontWeight: "bold", 
                      color: "#10b981", 
                      textDecoration: "none",
                      flex: 1
                    }}
                  >
                    {project.name}
                  </Link>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {project.is_public ? (
                      <span style={{ fontSize: 10, background: "#10b981", color: "white", padding: "2px 8px", borderRadius: 12 }}>🌍 Público</span>
                    ) : (
                      <span style={{ fontSize: 10, background: "#6b7280", color: "white", padding: "2px 8px", borderRadius: 12 }}>🔒 Privado</span>
                    )}
                    {project.parent_project_id && (
                      <span style={{ fontSize: 10, background: "#3b82f6", color: "white", padding: "2px 8px", borderRadius: 12 }}>🔀 Fork</span>
                    )}
                  </div>
                </div>
                
                <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {project.description || "Sin descripción"}
                </p>
                
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13, color: "#6b7280" }}>
                  <span>👤 {project.user_id}</span>
                  <span>🎵 {project.tracks?.length || 0} pistas</span>
                  <span>⭐ {project.stats?.stars || 0}</span>
                  <span>👁️ {project.stats?.views || 0}</span>
                </div>

                {project.parent_project_id && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    🔀 Fork de: {project.parent_project_id}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Link 
                    href={`/project/${project.id}`}
                    style={{ 
                      flex: 1,
                      padding: "8px 12px", 
                      background: "rgba(255,255,255,0.05)", 
                      color: "white", 
                      borderRadius: 6, 
                      textDecoration: "none",
                      textAlign: "center",
                      fontSize: 14
                    }}
                  >
                    👁️ Ver
                  </Link>
                  {user && (
                    <button
                      onClick={() => handleForkClick(project)}
                      style={{ 
                        flex: 1,
                        padding: "8px 12px", 
                        background: "#3b82f6", 
                        color: "white", 
                        borderRadius: 6, 
                        border: "none",
                        cursor: "pointer",
                        fontSize: 14
                      }}
                    >
                      🔀 Fork
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedProject && (
        <ForkModal
          isOpen={forkModalOpen}
          onClose={() => {
            setForkModalOpen(false)
            setSelectedProject(null)
          }}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          tracks={selectedProject.tracks || []}
          userId={user?.id || ''}
          onForkCreated={handleForkCreated}
        />
      )}
    </div>
  )
}
