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
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = async () => {
    if (!user) {
      alert("Debes iniciar sesión para grabar audio")
      return
    }

    setError(null)
    setAudioUrl(null)
    audioChunksRef.current = []

    try {
      // ✅ Solicitar micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // ✅ Usar el codec que soporte el navegador
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }

      console.log('🎤 Usando codec:', mimeType)

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log(`📦 Chunk recibido: ${event.data.size} bytes`)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log(`⏹ Grabación detenida. Total chunks: ${audioChunksRef.current.length}`)
        
        if (audioChunksRef.current.length === 0) {
          setError("No se capturó audio. Verifica tu micrófono.")
          return
        }

        // ✅ Crear blob con el tipo correcto
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        console.log(`🎵 Blob creado: ${audioBlob.size} bytes, tipo: ${mimeType}`)
        
        if (audioBlob.size < 500) {
          setError("El audio grabado es demasiado pequeño. ¿Hablaste?")
          return
        }

        // ✅ Crear URL local para previsualizar
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        
        // ✅ Si hay projectId, subir a Supabase
        if (projectId && user) {
          await uploadAudio(audioBlob, mimeType)
        }

        if (onRecordingComplete) {
          onRecordingComplete()
        }
      }

      // ✅ Grabar en chunks pequeños para mejor manejo
      mediaRecorder.start(1000)
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      console.log('✅ Grabación iniciada con éxito')

    } catch (error) {
      console.error("❌ Error al acceder al micrófono:", error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setError(`Error: ${errorMessage}`)
    }
  }

  const uploadAudio = async (blob: Blob, mimeType: string) => {
    if (!user || !projectId) return
    
    setIsUploading(true)
    setError(null)

    try {
      // ✅ Determinar extensión según el mimeType
      let extension = 'webm'
      if (mimeType.includes('mp4')) extension = 'mp4'
      else if (mimeType.includes('mp3')) extension = 'mp3'
      else if (mimeType.includes('wav')) extension = 'wav'

      const fileName = `${projectId}/recording_${Date.now()}.${extension}`
      console.log(`📤 Subiendo: ${fileName} (${blob.size} bytes)`)
      
      const { error: uploadError } = await supabase
        .storage
        .from("audio")
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: mimeType
        })

      if (uploadError) {
        console.error("❌ Error subiendo:", uploadError)
        setError("Error al subir: " + uploadError.message)
        throw uploadError
      }

      // ✅ Obtener URL pública
      const { data: urlData } = supabase
        .storage
        .from("audio")
        .getPublicUrl(fileName)
      
      const audioUrl = urlData.publicUrl
      console.log(`🔊 URL pública: ${audioUrl}`)

      // ✅ Guardar en la tabla tracks
      const { error: dbError } = await supabase
        .from("tracks")
        .insert({
          project_id: projectId,
          user_id: user.id,
          name: `Grabación ${new Date().toLocaleString()}`,
          audio_url: audioUrl,
          source: "recording",
          type: extension
        })

      if (dbError) {
        console.error("❌ Error en DB:", dbError)
        setError("Error al guardar: " + dbError.message)
        throw dbError
      }

      console.log("✅ Grabación guardada correctamente")
      alert("✅ Grabación subida correctamente")

    } catch (error) {
      console.error("❌ Error en upload:", error)
      setError("Error al procesar la grabación")
    } finally {
      setIsUploading(false)
    }
  }

  const stopRecording = () => {
    console.log('⏹ Deteniendo grabación...')
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const downloadRecording = () => {
    if (!audioUrl) return
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = `grabacion-${Date.now()}.webm`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
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
            ⏳ Subiendo...
          </span>
        )}

        {audioUrl && !isRecording && !isUploading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <audio controls src={audioUrl} style={{ height: 40 }} />
            <span style={{ color: "#10b981", fontSize: 14 }}>✅ Grabación lista</span>
            <button
              onClick={downloadRecording}
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
              ⬇️ Descargar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
