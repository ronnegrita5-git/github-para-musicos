"use client"

import { useState, useRef } from "react"
import { useAuth } from "@/app/context/AuthContext"
import { supabase } from "@/lib/supabase"

interface WebRecorderProps {
  projectId?: string
  onRecordingComplete?: () => void
}

export default function WebRecorder({ projectId, onRecordingComplete }: WebRecorderProps) {
  const { user } = useAuth()
  const [isRecording, setIsRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = async () => {
    if (!user) {
      alert("Debes iniciar sesión para grabar audio")
      return
    }

    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        stream.getTracks().forEach(track => track.stop())

        if (projectId && user) {
          await uploadAudio(audioBlob)
        }

        if (onRecordingComplete) {
          onRecordingComplete()
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Error al acceder al micrófono:", error)
      setError("No se pudo acceder al micrófono")
      alert("No se pudo acceder al micrófono")
    }
  }

  const uploadAudio = async (blob: Blob) => {
    if (!user || !projectId) return
    
    setIsUploading(true)
    setError(null)

    try {
      const fileName = `${projectId}/recording_${Date.now()}.webm`
      console.log("📤 Subiendo a:", fileName)
      
      const { error: uploadError } = await supabase
        .storage
        .from("audio")
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error("❌ Error subiendo:", uploadError)
        setError("Error al subir: " + uploadError.message)
        throw uploadError
      }

      const { data: urlData } = supabase
        .storage
        .from("audio")
        .getPublicUrl(fileName)
      
      const audioUrl = urlData.publicUrl
      console.log("🔊 URL del audio:", audioUrl)

      // ✅ Guardar solo con campos que existen
      const { error: dbError } = await supabase
        .from("tracks")
        .insert({
          project_id: projectId,
          user_id: user.id,
          name: `Grabación ${new Date().toLocaleString()}`,
          audio_url: audioUrl,
          source: "recording"
        })

      if (dbError) {
        console.error("❌ Error guardando en DB:", dbError)
        setError("Error en DB: " + dbError.message)
        throw dbError
      }

      console.log("✅ Grabación guardada")
      alert("✅ Grabación subida correctamente")

    } catch (error) {
      console.error("❌ Error en uploadAudio:", error)
      setError("Error al procesar la grabación")
    } finally {
      setIsUploading(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (!user) {
    return (
      <div style={{ padding: 16, color: "#6b7280", textAlign: "center" }}>
        🔒 Inicia sesión para grabar audio
      </div>
    )
  }

  return (
    <div style={{
      padding: 16,
      background: "rgba(255,255,255,0.03)",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.05)"
    }}>
      <h4 style={{ color: "white", marginBottom: 12 }}>🎤 Grabador de audio</h4>

      {error && (
        <div style={{
          padding: 10,
          marginBottom: 12,
          background: "rgba(239,68,68,0.1)",
          color: "#ef4444",
          borderRadius: 6,
          fontSize: 14
        }}>
          ❌ {error}
        </div>
      )}

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap"
      }}>
        {!isRecording ? (
          <button
            onClick={startRecording}
            style={{
              padding: "10px 24px",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: "bold"
            }}
          >
            🔴 Comenzar grabación
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: "10px 24px",
              background: "#6b7280",
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

        {isRecording && (
          <span style={{ color: "#ef4444", fontSize: 16 }}>
            ⏱ {formatTime(recordingTime)}
          </span>
        )}

        {isUploading && (
          <span style={{ color: "#fbbf24", fontSize: 14 }}>
            ⏳ Subiendo audio...
          </span>
        )}

        {audioUrl && !isRecording && !isUploading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <audio controls src={audioUrl} style={{ height: 40 }} />
            <span style={{ color: "#10b981", fontSize: 14 }}>✅ Grabación lista</span>
          </div>
        )}
      </div>
    </div>
  )
}
