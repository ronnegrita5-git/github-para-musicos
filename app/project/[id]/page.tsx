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
  const [isPlayingAll, setIsPlayingAll] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1)
  const [audioProgress, setAudioProgress] = useState(0)
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

  // 🎵 Funciones para reproducir todas las pistas
  const playAllTracks = () => {
    if (tracks.length === 0) return
    
    const audioUrls = tracks
      .map(t => t.audio_url)
      .filter(url => url && url.length > 0)
    
    if (audioUrls.length === 0) {
      alert("No hay pistas con audio para reproducir")
      return
    }

    setIsPlayingAll(true)
    setCurrentTrackIndex(0)
    setAudioProgress(0)
    
    if (audioRef.current) {
      audioRef.current.src = audioUrls[0]
      audioRef.current.play()
    }
  }

  const stopAllTracks = () => {
    setIsPlayingAll(false)
    setCurrentTrackIndex(-1)
    setAudioProgress(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current.src = ""
    }
  }

  const onTrackEnd = () => {
    const audioUrls = tracks
      .map(t => t.audio_url)
      .filter(url => url && url.length > 0)
    
    const nextIndex = currentTrackIndex + 1
    if (nextIndex < audioUrls.length) {
      setCurrentTrackIndex(nextIndex)
      setAudioProgress(0)
      if (audioRef.current) {
        audioRef.current.src = audioUrls[nextIndex]
        audioRef.current.play()
      }
    } else {
      stopAllTracks()
    }
  }

  const onTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100
      setAudioProgress(progress || 0)
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

  const audioUrls = tracks
    .map(t => t.audio_url)
    .filter(url => url && url.length > 0)

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white" }}>
      {/* Reproductor de audio oculto con controles */}
      <audio
        ref={audioRef}
        onEnded={onTrackEnd}
        onTimeUpdate={onTimeUpdate}
        onError={() => {
          console.error("Error en audio, pasando al siguiente...")
          onTrackEnd()
        }}
        controls
        style={{ 
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          height: "48px",
          background: "#1a1a1a",
          zIndex: 1000,
          padding: "4px 16px"
        }}
      />

      <aside style={{ width: 240, padding: "24px 16px", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>🎵 Music Collab</div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
      </aside>

      <main style={{ flex: 1, padding: "40px", maxWidth: "800px", paddingBottom: "80px" }}>
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
            🎵 Pistas: {tracks.length}
          </p>
        </div>

        {/* 🎵 SECCIÓN DE PISTAS */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 24, margin: 0 }}>🎵 Pistas</h2>
            
            {audioUrls.length > 0 && (
              <div>
                {!isPlayingAll ? (
                  <button
                    onClick={playAllTracks}
                    style={{
                      padding: "8px 16px",
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: "bold"
                    }}
                  >
                    ▶ Reproducir todas ({audioUrls.length})
                  </button>
                ) : (
                  <button
                    onClick={stopAllTracks}
                    style={{
                      padding: "8px 16px",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: "bold"
                    }}
                  >
                    ⏹ Detener
                  </button>
                )}
              </div>
            )}
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
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {tracks.map((track, index) => {
                const audioUrl = track.audio_url
                const hasAudio = audioUrl && audioUrl.length > 0
                const isCurrentTrack = isPlayingAll && index === currentTrackIndex

                return (
                  <div key={track.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: isCurrentTrack ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                    borderRadius: 8,
                    border: isCurrentTrack ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.05)"
                  }}>
                    <div>
                      <p style={{ margin: 0, color: "white" }}>
                        {isCurrentTrack && "▶ "}
                        {track.name || "Pista sin nombre"}
                      </p>
                      <span style={{ color: "#6b7280", fontSize: 12 }}>
                        {new Date(track.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {hasAudio ? (
                        <audio controls src={audioUrl} style={{ height: 32, width: 150 }} />
                      ) : (
                        <span style={{ color: "#6b7280", fontSize: 12 }}>Sin audio</span>
                      )}
                      {isCreator && (
                        <button
                          onClick={() => deleteTrack(track.id)}
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
