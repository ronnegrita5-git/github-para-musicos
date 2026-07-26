"use client"

import { useEffect, useState, useRef } from "react"
import { useAuth } from "@/app/context/AuthContext"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import MultiUpload from "@/app/components/MultiUpload"
import WebRecorder from "@/app/components/WebRecorder"
import ForkModal from "@/app/components/ForkModal"

interface Track {
  id: string
  name: string
  audio_url: string
  user_id: string
  created_at: string
  size?: number
  duration?: number
  mime_type?: string
}

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
  stats: { views: number; stars: number }
  created_at: string
}

// Nodo de audio con su contexto y fuente
interface AudioNodeWithSource {
  node: GainNode
  source: AudioBufferSourceNode
  trackId: string
  buffer: AudioBuffer
}

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTracks, setLoadingTracks] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [isPlaying, setIsPlaying] = useState(false)
  const [forkModalOpen, setForkModalOpen] = useState(false)
  const [isOwner, setIsOwner] = useState<boolean>(false)
  const [parentProject, setParentProject] = useState<any>(null)
  
  // Estados del mezclador
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>({})
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  
  // Referencias
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioNodesRef = useRef<AudioNodeWithSource[]>([])
  const masterGainRef = useRef<GainNode | null>(null)

  const loadTracks = async () => {
    try {
      const { data, error } = await supabase
        .from("tracks")
        .select("*")
        .eq("project_id", id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setTracks(data || [])
      
      // Inicializar volúmenes por pista
      const volumes: Record<string, number> = {}
      data?.forEach(track => {
        volumes[track.id] = 0.8
      })
      setTrackVolumes(volumes)
    } catch (error) {
      console.error("Error cargando pistas:", error)
    } finally {
      setLoadingTracks(false)
    }
  }

  const loadProject = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw error
      setProject(data)
      
      if (user && user.id === data.user_id) {
        setIsOwner(true)
      } else {
        setIsOwner(false)
      }

      if (data.parent_project_id) {
        const { data: parentData } = await supabase
          .from("projects")
          .select("name, user_id")
          .eq("id", data.parent_project_id)
          .single()
        if (parentData) setParentProject(parentData)
      }
    } catch (err) {
      console.error("Error cargando proyecto:", err)
      setError("No se pudo cargar el proyecto")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      loadProject()
      loadTracks()
    }
    
    // Limpiar al desmontar
    return () => {
      stopAllAudio()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [id])

  // Inicializar contexto de audio
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
    return audioContextRef.current
  }

  // Cargar y reproducir pistas seleccionadas
  const playSelectedTracks = async () => {
    // Detener reproducción actual
    stopAllAudio()
    
    if (selectedTracks.size === 0) {
      alert('Selecciona al menos una pista para reproducir')
      return
    }

    const ctx = initAudioContext()
    
    // Crear nodo master si no existe
    if (!masterGainRef.current) {
      masterGainRef.current = ctx.createGain()
      masterGainRef.current.gain.value = masterVolume
      masterGainRef.current.connect(ctx.destination)
    }

    const selected = tracks.filter(t => selectedTracks.has(t.id) && t.audio_url)
    if (selected.length === 0) {
      alert('Las pistas seleccionadas no tienen audio disponible')
      return
    }

    setIsLoadingAudio(true)
    audioNodesRef.current = []

    try {
      // Cargar y reproducir cada pista seleccionada
      for (const track of selected) {
        try {
          const response = await fetch(track.audio_url)
          if (!response.ok) throw new Error(`Error al cargar ${track.name}`)
          
          const arrayBuffer = await response.arrayBuffer()
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
          
          // Crear fuente
          const source = ctx.createBufferSource()
          source.buffer = audioBuffer
          source.loop = false
          
          // Crear nodo de ganancia individual
          const gainNode = ctx.createGain()
          const volume = trackVolumes[track.id] || 0.8
          gainNode.gain.value = volume
          
          // Conectar: source → gainNode → masterGain → destination
          source.connect(gainNode)
          gainNode.connect(masterGainRef.current)
          
          // Guardar referencia para control
          audioNodesRef.current.push({
            node: gainNode,
            source: source,
            trackId: track.id,
            buffer: audioBuffer
          })
          
          // Iniciar reproducción
          source.start(0)
          
        } catch (err) {
          console.error(`Error al reproducir ${track.name}:`, err)
        }
      }
      
      setIsPlaying(true)
    } catch (error) {
      console.error('Error al reproducir:', error)
      alert('Error al reproducir las pistas')
    } finally {
      setIsLoadingAudio(false)
    }
  }

  // Detener toda reproducción
  const stopAllAudio = () => {
    audioNodesRef.current.forEach(({ source }) => {
      try {
        source.stop()
      } catch (e) {
        // Ignorar errores si ya está detenido
      }
    })
    audioNodesRef.current = []
    setIsPlaying(false)
  }

  // Actualizar volumen master
  const updateMasterVolume = (value: number) => {
    const newVolume = Math.max(0, Math.min(1, value))
    setMasterVolume(newVolume)
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = newVolume
    }
  }

  // Actualizar volumen de una pista
  const updateTrackVolume = (trackId: string, value: number) => {
    const newVolume = Math.max(0, Math.min(1, value))
    setTrackVolumes(prev => ({
      ...prev,
      [trackId]: newVolume
    }))
    
    // Actualizar en tiempo real si está sonando
    const audioNode = audioNodesRef.current.find(n => n.trackId === trackId)
    if (audioNode) {
      audioNode.node.gain.value = newVolume
    }
  }

  const toggleTrackSelection = (trackId: string) => {
    const newSelected = new Set(selectedTracks)
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId)
    } else {
      newSelected.add(trackId)
    }
    setSelectedTracks(newSelected)
  }

  const selectAllTracks = () => {
    const allIds = new Set(tracks.map(t => t.id))
    setSelectedTracks(allIds)
  }

  const deselectAllTracks = () => {
    setSelectedTracks(new Set())
    stopAllAudio()
  }

  const deleteTrack = async (trackId: string) => {
    if (!user) {
      alert("Debes iniciar sesión para eliminar pistas")
      return
    }
    if (!confirm("¿Estás seguro de que quieres eliminar esta pista?")) return

    try {
      const { error } = await supabase
        .from("tracks")
        .delete()
        .eq("id", trackId)

      if (error) throw error
      await loadTracks()
      setSelectedTracks(new Set())
      stopAllAudio()
    } catch (error) {
      console.error("Error eliminando pista:", error)
      alert("Error al eliminar la pista")
    }
  }

  const deleteProject = async () => {
    if (!user) {
      alert("Debes iniciar sesión para eliminar el proyecto")
      return
    }
    if (!confirm("¿Estás seguro de que quieres eliminar este proyecto?")) return

    try {
      const { error } = await supabase
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
  }

  const downloadProject = async () => {
    if (!user) {
      alert("⚠️ Debes iniciar sesión para descargar")
      return
    }

    try {
      const response = await fetch(`/api/projects/${id}/download`, {
        headers: {
          'x-user-id': user.id
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al preparar descarga')
      }

      const data = await response.json()
      
      for (const track of data.project.tracks) {
        if (track.downloadUrl) {
          window.open(track.downloadUrl, '_blank')
        }
      }

      alert(`✅ Descargando ${data.project.tracks.length} pistas`)
    } catch (error) {
      console.error('Error descargando:', error)
      alert('Error al descargar el proyecto')
    }
  }

  const downloadSingleTrack = async (track: Track) => {
    if (!user) {
      alert("⚠️ Debes iniciar sesión para descargar")
      return
    }

    try {
      const response = await fetch(track.audio_url)
      if (!response.ok) throw new Error('Error al descargar')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = track.name || 'audio.wav'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error descargando pista:', error)
      alert('Error al descargar la pista')
    }
  }

  const handleForkCreated = () => {
    loadProject()
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

  const projectName = typeof project.name === 'string' ? project.name : 'Proyecto sin título'
  const projectDescription = typeof project.description === 'string' ? project.description : 'Sin descripción'
  const projectDate = project.created_at ? new Date(project.created_at).toLocaleDateString() : 'Fecha desconocida'

  const selectedCount = selectedTracks.size

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white" }}>
      <aside style={{ width: 240, padding: "24px 16px", background: "rgba(255,255,255,0.03)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>🎵 Music Collab</div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
      </aside>

      <main style={{ flex: 1, padding: "40px", maxWidth: "800px" }}>
        <Link href="/explore" style={{ color: "#10b981", textDecoration: "none" }}>← Volver a proyectos</Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ fontSize: 32, margin: 0 }}>
              {project.parent_project_id ? "🔀 " : ""}{projectName}
            </h1>
            {project.parent_project_id && parentProject && (
              <p style={{ color: "#fbbf24", fontSize: 14, marginTop: 4 }}>
                🔀 Fork de: {parentProject.name} (por {parentProject.user_id})
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {!isOwner && user && (
              <button
                onClick={() => setForkModalOpen(true)}
                style={{
                  padding: "8px 16px",
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: "bold"
                }}
              >
                🔀 Fork
              </button>
            )}

            {user && (
              <button
                onClick={downloadProject}
                style={{
                  padding: "8px 16px",
                  background: "#8b5cf6",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: "bold"
                }}
              >
                📥 Descargar proyecto
              </button>
            )}

            {isOwner && (
              <button
                onClick={async () => {
                  if (!confirm(`¿Cambiar el proyecto a ${project.is_public ? 'privado' : 'público'}?`)) return
                  try {
                    const { error } = await supabase
                      .from("projects")
                      .update({ is_public: !project.is_public })
                      .eq("id", id)
                      .eq("user_id", user?.id || '')
                    if (error) {
                      console.error('Error detallado:', error)
                      alert(`Error: ${error.message}`)
                      return
                    }
                    setProject({ ...project, is_public: !project.is_public })
                    alert(`✅ Proyecto ahora es ${!project.is_public ? 'público' : 'privado'}`)
                  } catch (error) {
                    console.error("Error cambiando visibilidad:", error)
                    alert("Error al cambiar la visibilidad. Revisa los permisos en Supabase.")
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
        </div>

        <p style={{ color: "#9ca3af", fontSize: 16, marginTop: 8 }}>{projectDescription}</p>

        <div style={{ marginTop: 24, padding: 16, background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
          <p style={{ color: "#6b7280", fontSize: 14 }}>📅 Creado: {projectDate}</p>
          <p style={{ color: "#6b7280", fontSize: 14 }}>👤 {isOwner ? "Tú eres el creador" : `Creado por: ${project.user_id}`}</p>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            {project.is_public ? "🌍 Público" : "🔒 Privado"}
          </p>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            🎵 Pistas: {tracks.length}
          </p>
          {project.fork_count > 0 && (
            <p style={{ color: "#6b7280", fontSize: 14 }}>
              🔀 Forks: {project.fork_count}
            </p>
          )}
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            📜 Licencia: {project.license || 'All Rights Reserved'}
          </p>
          {project.parent_project_id && (
            <p style={{ color: "#fbbf24", fontSize: 14, marginTop: 4 }}>
              🔀 Este proyecto es un fork (nivel {project.fork_depth || 1})
            </p>
          )}
        </div>

        {/* ============ SECCIÓN DE PISTAS ============ */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: "8px" }}>
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
              <span style={{ color: "#6b7280", fontSize: 12, alignSelf: "center" }}>
                {selectedCount} pistas seleccionadas
              </span>
            </div>
          </div>

          {isOwner && (
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
              {isOwner ? "📭 No hay pistas aún. Sube una pista o graba audio." : "📭 Este proyecto aún no tiene pistas."}
            </p>
          ) : (
            <>
              {/* LISTA DE PISTAS */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tracks.map((track) => {
                  const hasAudio = track.audio_url && track.audio_url.length > 0
                  const isSelected = selectedTracks.has(track.id)
                  const volume = trackVolumes[track.id] || 0.8

                  return (
                    <div key={track.id} style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "12px 16px",
                      background: isSelected ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)",
                      borderRadius: 8,
                      border: isSelected ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.05)",
                      opacity: hasAudio ? 1 : 0.5
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div 
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "12px",
                            cursor: hasAudio ? "pointer" : "default",
                            flex: 1
                          }}
                          onClick={() => {
                            if (hasAudio) {
                              toggleTrackSelection(track.id)
                            }
                          }}
                        >
                          <span style={{ fontSize: 18 }}>
                            {isSelected ? "☑ " : hasAudio ? "☐ " : "⛔ "}
                          </span>
                          <div>
                            <p style={{ margin: 0, color: "white", fontWeight: isSelected ? "bold" : "normal" }}>
                              {track.name || "Pista sin nombre"}
                            </p>
                            <span style={{ color: "#6b7280", fontSize: 12 }}>
                              {new Date(track.created_at).toLocaleDateString()}
                              {track.size && ` · ${(track.size / 1024 / 1024).toFixed(1)} MB`}
                            </span>
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {/* 📥 Descargar pista */}
                          {user && hasAudio && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                await downloadSingleTrack(track)
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#8b5cf6',
                                cursor: 'pointer',
                                fontSize: 16,
                                padding: '0 4px'
                              }}
                              title="Descargar pista"
                            >
                              📥
                            </button>
                          )}
                          
                          {/* 🗑️ Eliminar pista */}
                          {isOwner && (
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
                      
                      {/* Control de volumen individual (solo si está seleccionada) */}
                      {isSelected && hasAudio && (
                        <div style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: "8px", 
                          marginTop: "8px",
                          paddingLeft: "32px"
                        }}>
                          <span style={{ fontSize: 12, color: "#6b7280", minWidth: "40px" }}>
                            {Math.round(volume * 100)}%
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => {
                              e.stopPropagation()
                              updateTrackVolume(track.id, parseFloat(e.target.value))
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              flex: 1,
                              maxWidth: "200px",
                              accentColor: "#10b981"
                            }}
                          />
                          <span style={{ fontSize: 11, color: "#6b7280" }}>🔊</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ============ CONTROLES DE REPRODUCCIÓN ============ */}
              {selectedCount > 0 && (
                <div style={{ 
                  marginTop: 20,
                  padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <button
                      onClick={playSelectedTracks}
                      disabled={isLoadingAudio || selectedCount === 0}
                      style={{
                        padding: "8px 20px",
                        background: isPlaying ? "#fbbf24" : "#10b981",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: (isLoadingAudio || selectedCount === 0) ? "default" : "pointer",
                        opacity: (isLoadingAudio || selectedCount === 0) ? 0.5 : 1,
                        fontWeight: "bold",
                        fontSize: 14
                      }}
                    >
                      {isLoadingAudio ? '⏳ Cargando...' : isPlaying ? '🔊 Reproduciendo' : '▶️ Reproducir selección'}
                    </button>
                    
                    {isPlaying && (
                      <button
                        onClick={stopAllAudio}
                        style={{
                          padding: "8px 16px",
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 14
                        }}
                      >
                        ⏹ Detener
                      </button>
                    )}
                    
                    <span style={{ color: "#6b7280", fontSize: 13 }}>
                      {selectedCount} pistas seleccionadas
                    </span>
                  </div>
                  
                  {/* Control de volumen master */}
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "12px", 
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(255,255,255,0.05)"
                  }}>
                    <span style={{ fontSize: 14, color: "#9ca3af", fontWeight: "bold" }}>🎛️ Master</span>
                    <span style={{ fontSize: 12, color: "#6b7280", minWidth: "40px" }}>
                      {Math.round(masterVolume * 100)}%
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={masterVolume}
                      onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
                      style={{
                        flex: 1,
                        maxWidth: "200px",
                        accentColor: "#10b981"
                      }}
                    />
                    <span style={{ fontSize: 14, color: "#9ca3af" }}>🔊</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {isOwner && (
          <div style={{ marginTop: 24, display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={deleteProject}
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

      <ForkModal
        isOpen={forkModalOpen}
        onClose={() => setForkModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        tracks={tracks}
        userId={user?.id || ''}
        onForkCreated={handleForkCreated}
      />
    </div>
  )
}
