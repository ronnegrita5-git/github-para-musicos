"use client"

import { use, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../../context/AuthContext"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Breadcrumbs from "../../components/Breadcrumbs"
import LikeButton from "../../components/LikeButton"
import CommentSection from "../../components/CommentSection"
import WebRecorder from "../../components/WebRecorder"
import MultiUpload from "../../components/MultiUpload"

export default function ProjectPage({ params }: any) {
  const { id } = use(params) as { id: string }
  const { user } = useAuth()
  const router = useRouter()

  const [project, setProject] = useState<any>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [instrument, setInstrument] = useState("guitarra")
  const [playingAll, setPlayingAll] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [updatingVisibility, setUpdatingVisibility] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }
    loadProject()
    loadTracks()
  }, [id, user])

  async function loadProject() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single()

    setProject(data)
    if (data && user) {
      const owner = data.user_id === user.id
      setIsOwner(owner)
      setIsPublic(data.is_public !== false)
    }
  }

  async function loadTracks() {
    setLoading(true)
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("❌ Error al cargar pistas:", error)
    } else {
      setTracks(data || [])
    }
    setLoading(false)
  }

  async function addTrack() {
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede añadir pistas")
      return
    }

    const name = prompt("Nombre de la pista 🎵")
    if (!name) return

    try {
      const { data, error } = await supabase
        .from("tracks")
        .insert([
          {
            name,
            instrument: instrument,
            project_id: id,
            user_id: user?.id,
          },
        ])
        .select()

      if (error) {
        console.error("❌ Error al añadir pista:", error)
        alert("Error al añadir pista: " + error.message)
        return
      }

      alert("✅ Pista añadida correctamente")
      loadTracks()
    } catch (error: any) {
      console.error("❌ Error inesperado:", error)
      alert("Error inesperado: " + (error.message || "Error desconocido"))
    }
  }

  async function uploadAudio(e: any, trackId: string) {
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede subir audio")
      return
    }

    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)

    const fileName = `${id}/${Date.now()}-${file.name}`

    try {
      const { error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error("❌ Error al subir:", uploadError)
        alert("Error al subir el archivo: " + uploadError.message)
        setUploading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from("audio")
        .getPublicUrl(fileName)

      const audioUrl = urlData.publicUrl

      const { error: updateError } = await supabase
        .from("tracks")
        .update({ 
          audio_url: audioUrl,
          source: 'local'
        })
        .eq("id", trackId)

      if (updateError) {
        console.error("❌ Error al actualizar:", updateError)
        alert("Error al guardar la URL: " + updateError.message)
      }

      setUploading(false)
      loadTracks()
    } catch (error: any) {
      console.error("❌ Error inesperado:", error)
      alert("Error al subir audio: " + (error.message || "Error desconocido"))
      setUploading(false)
    }
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>, audioUrl: string) {
    const volume = parseFloat(e.target.value)
    const audioElement = document.querySelector(
      `audio[src="${audioUrl}"]`
    ) as HTMLAudioElement
    if (audioElement) {
      audioElement.volume = volume
    }
  }

  async function deleteTrack(trackId: string) {
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede eliminar pistas")
      return
    }

    if (!confirm("¿Seguro que quieres eliminar esta pista?")) return

    await supabase
      .from("tracks")
      .delete()
      .eq("id", trackId)

    loadTracks()
  }

  function playAllTracks() {
    const audios = document.querySelectorAll('audio')
    
    const anyPlaying = Array.from(audios).some(a => !a.paused)
    
    if (anyPlaying) {
      audios.forEach(a => a.pause())
      setPlayingAll(false)
    } else {
      audios.forEach((audio) => {
        audio.currentTime = 0
        audio.play()
      })
      setPlayingAll(true)
    }
  }

  async function toggleVisibility() {
    if (!isOwner) {
      alert("Solo el dueño del proyecto puede cambiar la visibilidad")
      return
    }

    setUpdatingVisibility(true)
    const newVisibility = !isPublic

    const { error } = await supabase
      .from("projects")
      .update({ is_public: newVisibility })
      .eq("id", id)

    if (error) {
      alert("Error al cambiar visibilidad: " + error.message)
    } else {
      setIsPublic(newVisibility)
      alert(newVisibility ? "✅ Proyecto ahora es PÚBLICO" : "🔒 Proyecto ahora es PRIVADO")
    }

    setUpdatingVisibility(false)
  }

  async function deleteProjectFromPage() {
    if (!isOwner) {
      alert("Solo el dueño puede eliminar el proyecto")
      return
    }

    if (!confirm(`¿Seguro que quieres eliminar el proyecto "${project?.name}"?\n\n⚠️ Esta acción eliminará TODAS las pistas y no se puede deshacer.`)) {
      return
    }

    try {
      const { data: tracks, error: tracksError } = await supabase
        .from("tracks")
        .select("audio_url")
        .eq("project_id", id)

      if (tracksError) {
        console.error("Error al obtener pistas:", tracksError)
      }

      if (tracks && tracks.length > 0) {
        for (const track of tracks) {
          if (track.audio_url) {
            const fileName = track.audio_url.split('/').pop()
            if (fileName) {
              await supabase.storage
                .from("audio")
                .remove([`${id}/${fileName}`])
            }
          }
        }
      }

      await supabase
        .from("tracks")
        .delete()
        .eq("project_id", id)

      const { error: deleteProjectError } = await supabase
        .from("projects")
        .delete()
        .eq("id", id)

      if (deleteProjectError) {
        alert("Error al eliminar proyecto: " + deleteProjectError.message)
        return
      }

      alert(`✅ Proyecto "${project?.name}" eliminado correctamente`)
      router.push("/dashboard")
    } catch (error: any) {
      alert("Error al eliminar proyecto: " + (error.message || "Error desconocido"))
    }
  }

  async function forkProject() {
    if (!project) {
      alert("No hay proyecto para hacer fork")
      return
    }

    const newName = prompt("Nombre para el fork:", `${project.name} (fork)`)
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
        console.error("Error al crear proyecto:", projectError)
        alert("Error al crear fork: " + projectError.message)
        return
      }

      const { data: tracksData, error: tracksError } = await supabase
        .from("tracks")
        .select("*")
        .eq("project_id", project.id)

      if (tracksError) {
        console.error("Error al obtener pistas:", tracksError)
        alert("Error al copiar pistas: " + tracksError.message)
        return
      }

      if (tracksData && tracksData.length > 0) {
        for (const track of tracksData) {
          await supabase.from("tracks").insert([
            {
              name: track.name,
              instrument: track.instrument || null,
              project_id: newProject.id,
              audio_url: track.audio_url || null,
              user_id: user?.id,
            },
          ])
        }
      }

      alert(`✅ Fork creado exitosamente: "${newName}"`)
      router.push(`/project/${newProject.id}`)
    } catch (error: any) {
      console.error("Error en fork:", error)
      alert("Error al hacer fork: " + (error.message || "Error desconocido"))
    }
  }

  async function downloadProject() {
    if (!project) return

    const totalTracks = tracks.length
    const hasAudio = tracks.filter(t => t.audio_url).length
    
    const confirmMessage = 
      `📥 ¿Descargar proyecto "${project.name}"?\n\n` +
      `📁 ${totalTracks} pistas totales\n` +
      `🎵 ${hasAudio} pistas con audio\n` +
      `📦 El archivo se descargará en formato ZIP\n\n` +
      `¿Quieres continuar?`

    if (!confirm(confirmMessage)) {
      return
    }

    try {
      window.location.href = `/api/download-project?projectId=${id}`
    } catch (error) {
      console.error("Error al descargar:", error)
      alert("Error al descargar el proyecto")
    }
  }

  if (!user) return null

  return (
    <div style={{ padding: "30px 20px", fontFamily: "'Inter', sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <Breadcrumbs />
      
      {isOwner && (
        <div style={{
          background: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(10px)",
          padding: 15,
          borderRadius: 12,
          marginBottom: 20,
          border: "1px solid rgba(16, 185, 129, 0.15)",
        }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#10b981" }}>⚙️ Panel de control</h4>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={toggleVisibility}
              disabled={updatingVisibility}
              style={{
                padding: "8px 16px",
                background: isPublic ? "linear-gradient(135deg, #10b981, #059669)" : "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {isPublic ? "🌍 Público" : "🔒 Privado"}
            </button>
            
            <button
              onClick={deleteProjectFromPage}
              style={{
                padding: "8px 16px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              🗑️ Eliminar proyecto
            </button>

            <button
              onClick={downloadProject}
              style={{
                padding: "8px 16px",
                background: "linear-gradient(135deg, #0d6efd, #0b5ed7)",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              📥 Descargar proyecto
            </button>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
            {isPublic 
              ? "🌍 Cualquier usuario puede ver y hacer fork de este proyecto" 
              : "🔒 Solo tú puedes ver y editar este proyecto"}
          </p>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, color: "white" }}>🎵 {project?.name || "Cargando..."}</h1>
          {project && (
            <Link href={`/user/${project.user_id}`} style={{ color: "#10b981", textDecoration: "none", fontSize: 14 }}>
              👤 Ver perfil del creador
            </Link>
          )}
        </div>
        
        <button
          onClick={forkProject}
          style={{
            padding: "8px 16px",
            background: "linear-gradient(135deg, #6f42c1, #5a32a3)",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          🔀 Fork
        </button>

        {isOwner && (
          <button
            onClick={downloadProject}
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #0d6efd, #0b5ed7)",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
              marginLeft: 10,
            }}
          >
            📥 Descargar
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <LikeButton projectId={id} />
      </div>

      {!isOwner && (
        <p style={{ color: "#6b7280", fontStyle: "italic" }}>
          👁️ Estás viendo este proyecto como visitante.
        </p>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        {isOwner && (
          <button onClick={addTrack} style={{
            padding: "8px 16px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}>+ Añadir pista</button>
        )}

        {isOwner && (
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(16, 185, 129, 0.2)",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 14,
            }}
          >
            <option value="guitarra">🎸 Guitarra</option>
            <option value="voz">🎤 Voz</option>
            <option value="bajo">🎸 Bajo</option>
            <option value="bateria">🥁 Batería</option>
            <option value="teclado">🎹 Teclado</option>
            <option value="otro">🎧 Otro</option>
          </select>
        )}

        <button
          onClick={playAllTracks}
          style={{
            padding: "8px 16px",
            background: playingAll ? "#dc3545" : "linear-gradient(135deg, #0d6efd, #0b5ed7)",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {playingAll ? "⏹ Detener todas" : "▶ Reproducir todas"}
        </button>
      </div>

      <MultiUpload projectId={id} onUploadComplete={loadTracks} />

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <p style={{ color: "#6b7280" }}>Cargando pistas...</p>
        ) : tracks.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No hay pistas todavía...</p>
        ) : (
          tracks.map((t) => (
            <div
              key={t.id}
              style={{
                padding: 10,
                border: "1px solid rgba(16, 185, 129, 0.1)",
                marginTop: 10,
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  🎧 {t.name}{" "}
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    ({t.instrument || "sin instrumento"})
                  </span>
                  {t.source && (
                    <span style={{ fontSize: 10, color: "#6b7280", marginLeft: 5 }}>
                      {t.source === 'web' ? '🌐' : '💻'}
                    </span>
                  )}
                </div>
                {isOwner && (
                  <button
                    onClick={() => deleteTrack(t.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 18,
                      padding: "4px 8px",
                      color: "#ef4444",
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>

              <div style={{ marginTop: 10 }}>
                {!t.audio_url ? (
                  <>
                    {isOwner && (
                      <div>
                        <input
                          type="file"
                          accept="audio/mpeg"
                          onChange={(e) => uploadAudio(e, t.id)}
                          disabled={uploading}
                          style={{ 
                            marginBottom: 8,
                            padding: 8,
                            borderRadius: 8,
                            border: "1px solid rgba(16, 185, 129, 0.2)",
                            background: "rgba(255,255,255,0.05)",
                            color: "white",
                            width: "100%",
                          }}
                        />
                        <WebRecorder 
                          projectId={id} 
                          trackId={t.id} 
                          onUploadComplete={loadTracks}
                        />
                      </div>
                    )}
                    {uploading && <p style={{ color: "#10b981" }}>Subiendo...</p>}
                  </>
                ) : (
                  <div>
                    <audio controls src={t.audio_url} style={{ width: "100%" }} />
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>🔊</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        defaultValue="1"
                        style={{ width: 120, accentColor: "#10b981" }}
                        onChange={(e) => handleVolumeChange(e, t.audio_url!)}
                      />
                      <span style={{ fontSize: 12, color: "#6b7280" }}>Volumen</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <CommentSection projectId={id} />
    </div>
  )
}
