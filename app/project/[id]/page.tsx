"use client"

import { useEffect, useState, useRef } from "react"
import { useAuth } from "@/app/context/AuthContext"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import MultiUpload from "@/app/components/MultiUpload"
import WebRecorder from "@/app/components/WebRecorder"

interface Track {
  id: string
  name: string
  audio_url: string
  user_id: string
  created_at: string
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user } = useAuth()
  const [project, setProject] = useState<any>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1)
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const loadTracks = async () => {
    try {
      const { data, error } = await supabase!
        .from("tracks")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })

      if (error) throw error
      console.log("🎵 Pistas cargadas:", data)
      setTracks(data || [])
    } catch (error) {
      console.error("Error cargando pistas:", error)
    } finally {
      setLoadingTracks(false)
    }
  }

  const deleteTrack = async (trackId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta pista?")) return

    try {
      const { error } = await supabase!
        .from("tracks")
        .delete()
        .eq("id", trackId)

      if (error) throw error
      await loadTracks()
      setSelectedTracks(new Set())
    } catch (error) {
      console.error("Error eliminando pista:", error)
      alert("Error al eliminar la pista")
    }
  }

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const { data, error } = await supabase!
          .from("projects")
          .select("*")
          .eq("id", id)
          .single()

        if (error) throw error
        setProject(data)
      } catch (err) {
        console.error("Error cargando proyecto:", err)
        setError("No se pudo cargar el proyecto")
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchProject()
      loadTracks()
    }
  }, [id])

  const toggleTrackSelection = (trackId: string) => {
    setSelectedTracks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(trackId)) {
        newSet.delete(trackId)
      } else {
        newSet.add(trackId)
      }
      return newSet
    })
    // Resetear reproducción al cambiar selección
    setIsPlaying(false)
    setCurrentTrackIndex(-1)
    setAudioUrl("")
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
  }

  const selectAllTracks = () => {
    const audioTracks = tracks.filter(t => t.audio_url && t.audio_url.length > 0)
    const allIds = new Set(audioTracks.map(t => t.id))
    setSelectedTracks(allIds)
  }

  const deselectAllTracks = () => {
    setSelectedTracks(new Set())
    setIsPlaying(false)
    setCurrentTrackIndex(-1)
    setAudioUrl("")
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }
  }

  // 🎵 Auto-reproducir cuando se selecciona la primera pista
  const playSelectedTracks = () => {
    const selected = tracks.filter(t => selectedTracks.has(t.id) && t.audio_url)
    if (selected.length === 0) {
      alert("No hay pistas seleccionadas con audio")
      return
    }
    
    setCurrentTrackIndex(0)
    setIsPlaying(true)
    setAudioUrl(selected[0].audio_url)
    if (audioRef.current) {
      audioRef.current.src = selected[0].audio_url
      audioRef.current.play()
    }
  }

  const playNextTrack = () => {
    const selected = tracks.filter(t => selectedTracks.has(t.id) && t.audio_url)
    const nextIndex = currentTrackIndex + 1
    if (nextIndex < selected.length) {
      setCurrentTrackIndex(nextIndex)
      setAudioUrl(selected[nextIndex].audio_url)
      if (audioRef.current) {
        audioRef.current.src = selected[nextIndex].audio_url
        audioRef.current.play()
      }
    } else {
      setIsPlaying(false)
      setCurrentTrackIndex(-1)
      setAudioUrl("")
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
      }
    }
  }

  if (loading) {
    return <div style={{ padding: 40, color: "white" }}>⏳ Cargando proyecto...</div>
  }

  if (error || !project) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        <p>❌ {error || "Proyecto no encontrado"}</p>
        <Link href="/explore" style={{ color: "#10b981" }}>← Volver a explorar</Link>
      </div>
    )
  }

  const isCreator = user && user.id === project.user_id
  const projectName = typeof project.name === 'string' ? project.name : 'Proyecto sin título'
  const projectDescription = typeof project.description === 'string' ? project.description : 'Sin descripción'
  const projectDate = project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Fecha desconocida'

  const audioTracks = tracks.filter(t => t.audio_url && t.audio_url.length > 0)
  const selectedCount = selectedTracks.size
  const selectedAudioTracks = tracks.filter(t => selectedTracks.has(t.id) && t.audio_url)

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white" }}>
      <aside style={{ width: 240, padding: "24px 16px", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>🎵 Music Collab</div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
      </aside>

      <main style={{ flex: 1, padding: "40px", maxWidth: "800px" }}>
        <Link href="/explore" style={{ color: "#10b981", textDecoration: "none" }}>← Volver a proyectos</Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>{projectName}</h1>
          {isCreator && (
            <button
              onClick={async () => {
                if (!confirm(`¿Cambiar el proyecto a ${project.is_public ? 'privado' : 'público'}?`)) return
                try {
                  const { error } = await supabase!
                    .from("projects")
                    .update({ is_public: !project.is_public })
                    .eq("id", id)
                    .eq("user_id", user.id)
                  if (error) throw error
                  setProject({ ...project, is_public: !project.is_public })
                } catch (error) {
                  console.error("Error cambiando visibilidad:", error)
                  alert("Error al cambiar la visibilidad")
                }
              }}
              style={{
                padding: "6px 14px",
                background: project.is_public ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: project.is_public ? "#10b981" : "#ef4444",
                border: "1px solid " + (project.is_public ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"),
                borderRadius: 20,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: "bold"
              }}
            >
              {project.is_public ? "🌍 Público" : "🔒 Privado"}
            </button>
          )}
        </div>

        <p style={{ color: "#9ca3af", fontSize: 16, marginTop: 8 }}>{projectDescription}</p>

        <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
          <p style={{ color: "#6b7280", fontSize: 14 }}>📅 Creado: {projectDate}</p>
          <p style={{ color: "#6b7280", fontSize: 14 }}>👤 Creador: {project.user_id}</p>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            {project.is_public ? "🌍 Público" : "🔒 Privado"}
          </p>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            🎵 Pistas: {tracks.length} ({selectedCount} seleccionadas)
          </p>
        </div>

        {/* 🎵 SECCIÓN DE PISTAS */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 24, margin: 0 }}>🎵 Pistas</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={selectAllTracks}
                style={{
                  padding: "4px 12px",
                  background: "rgba(16,185,129,0.15)",
                  color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                Seleccionar todas
              </button>
              <button
                onClick={deselectAllTracks}
                style={{
                  padding: "4px 12px",
                  background: "rgba(239,68,68,0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                Deseleccionar
              </button>
              {selectedCount > 0 && (
                <button
                  onClick={playSelectedTracks}
                  style={{
                    padding: "4px 16px",
                    background: "#10b981",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: "bold"
                  }}
                >
                  ▶ Reproducir ({selectedCount})
                </button>
              )}
            </div>
          </div>

          {isCreator && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 12 }}>
                <MultiUpload 
                  projectId={id} 
                  onUploadComplete={() => {
                    console.log("🔄 Recargando pistas...")
                    loadTracks()
                  }}
                />
              </div>
              <div>
                <WebRecorder 
                  projectId={id} 
                  onRecordingComplete={() => {
                    console.log("🔄 Recargando pistas...")
                    loadTracks()
                  }}
                />
              </div>
            </div>
          )}

          {loadingTracks ? (
            <p style={{ color: "#6b7280" }}>Cargando pistas...</p>
          ) : tracks.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              {isCreator ? "📭 No hay pistas aún. Sube una pista o graba audio." : "📭 Este proyecto aún no tiene pistas."}
            </p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tracks.map((track) => {
                  const audioUrl = track.audio_url
                  const hasAudio = audioUrl && audioUrl.length > 0
                  const isSelected = selectedTracks.has(track.id)
                  const isCurrentTrack = isSelected && currentTrackIndex === selectedAudioTracks.findIndex(t => t.id === track.id)

                  return (
                    <div key={track.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 16px",
                      background: isCurrentTrack ? "rgba(16,185,129,0.15)" : isSelected ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      border: isCurrentTrack ? "1px solid rgba(16,185,129,0.4)" : isSelected ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.05)",
                      cursor: hasAudio ? "pointer" : "default",
                      opacity: hasAudio ? 1 : 0.5
                    }}
                    onClick={() => {
                      if (hasAudio) {
                        toggleTrackSelection(track.id)
                      }
                    }}>
                      <div>
                        <p style={{ margin: 0, color: "white" }}>
                          {isSelected && "☑ "}
                          {!isSelected && hasAudio && "☐ "}
                          {!hasAudio && "⛔ "}
                          {track.name || "Pista sin nombre"}
                        </p>
                        <span style={{ color: "#6b7280", fontSize: 12 }}>
                          {new Date(track.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {hasAudio && isSelected && (
                          <span style={{ color: "#10b981", fontSize: 12 }}>
                            {isCurrentTrack ? "🔊 Reproduciendo" : "✓ Seleccionada"}
                          </span>
                        )}
                        {hasAudio && !isSelected && (
                          <span style={{ color: "#6b7280", fontSize: 12 }}>🎵</span>
                        )}
                        {!hasAudio && (
                          <span style={{ color: "#6b7280", fontSize: 12 }}>Sin audio</span>
                        )}
                        {isCreator && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteTrack(track.id)
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontSize: 16,
                              padding: "0 4px"
                            }}
                            title="Eliminar pista"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 🎵 REPRODUCTOR DE AUDIO JUSTO DEBAJO DE LAS PISTAS */}
              {selectedAudioTracks.length > 0 && (
                <div style={{
                  marginTop: 20,
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}>
                  <span style={{ color: "#6b7280", fontSize: 13, minWidth: 100 }}>
                    {currentTrackIndex >= 0 && isPlaying ? 
                      selectedAudioTracks[currentTrackIndex]?.name || "Reproduciendo" : 
                      `${selectedCount} pistas seleccionadas`}
                  </span>
                  <audio
                    ref={audioRef}
                    controls
                    src={audioUrl}
                    onEnded={playNextTrack}
                    style={{ flex: 1, minWidth: 200, height: "40px" }}
                  />
                  <span style={{ color: "#6b7280", fontSize: 12, minWidth: 50 }}>
                    {selectedCount > 0 && isPlaying ? `${currentTrackIndex + 1}/${selectedCount}` : ""}
                  </span>
                  {isPlaying && (
                    <button
                      onClick={() => {
                        setIsPlaying(false)
                        setCurrentTrackIndex(-1)
                        setAudioUrl("")
                        if (audioRef.current) {
                          audioRef.current.pause()
                          audioRef.current.src = ""
                        }
                      }}
                      style={{
                        padding: "4px 12px",
                        background: "rgba(239,68,68,0.15)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12
                      }}
                    >
                      Detener
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 🗑️ BOTÓN DE ELIMINAR PROYECTO */}
        {isCreator && (
          <div style={{ marginTop: 24, display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                if (!confirm("¿Estás seguro de que quieres eliminar este proyecto?")) return
                try {
                  const { error } = await supabase!
                    .from("projects")
                    .delete()
                    .eq("id", id)
                    .eq("user_id", user.id)
                  if (error) throw error
                  alert("Proyecto eliminado correctamente")
                  window.location.href = "/explore"
                } catch (error) {
                  console.error("Error eliminando proyecto:", error)
                  alert("Error al eliminar el proyecto")
                }
              }}
              style={{
                padding: "10px 20px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              🗑️ Eliminar proyecto
            </button>
            <span style={{ color: "#10b981", fontSize: 14, alignSelf: "center" }}>
              ✅ Eres el creador
            </span>
          </div>
        )}
      </main>
    </div>
  )
}
