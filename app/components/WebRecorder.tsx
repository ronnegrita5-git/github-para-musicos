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
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const startRecording = async () => {
    if (!user) {
      alert("Debes iniciar sesión para grabar audio")
      return
    }

    setError(null)
    setAudioUrl(null)
    audioChunksRef.current = []

    try {
      // ✅ Solicitar micrófono con configuración óptima
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1,
        }
      })
      
      streamRef.current = stream

      // ✅ Crear analizador de audio para visualizar el nivel
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // ✅ Medir el nivel de audio
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const checkAudioLevel = () => {
        if (isRecording) {
          analyser.getByteFrequencyData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i]
          }
          const average = sum / dataArray.length
          setAudioLevel(average / 255)
          requestAnimationFrame(checkAudioLevel)
        }
      }

      // ✅ Crear MediaRecorder con formato óptimo
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      })
      
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          console.log(`📦 Chunk de audio: ${event.data.size} bytes`)
        }
      }

      mediaRecorder.onstop = async () => {
        console.log(`⏹ Grabación detenida. Chunks: ${audioChunksRef.current.length}`)
        
        if (audioChunksRef.current.length === 0) {
          setError("No se capturó audio. Verifica tu micrófono.")
          return
        }

        // ✅ Crear blob con el formato correcto
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/webm;codecs=opus' 
        })
        
        console.log(`🎵 Blob de audio creado: ${audioBlob.size} bytes`)
        
        if (audioBlob.size < 1000) {
          setError("El audio grabado es demasiado pequeño. ¿Hablaste?")
          return
        }

        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        
        // ✅ Detener el stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }

        if (projectId && user) {
          await uploadAudio(audioBlob)
        }

        if (onRecordingComplete) {
          onRecordingComplete()
        }
      }

      // ✅ Iniciar grabación
      mediaRecorder.start(1000) // Grabar en chunks de 1 segundo
      setIsRecording(true)
      setRecordingTime(0)
      setAudioLevel(0)
      
      // ✅ Iniciar medición de nivel
      checkAudioLevel()

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      console.log('🎤 Grabación iniciada')

    } catch (error) {
      console.error("Error al acceder al micrófono:", error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setError(`No se pudo acceder al micrófono: ${errorMessage}`)
      alert(`Error: ${errorMessage}. Permite el acceso al micrófono en tu navegador.`)
    }
  }

  const uploadAudio = async (blob: Blob) => {
    if (!user || !projectId) {
      console.error("❌ Faltan datos para subir")
      return
    }
    
    setIsUploading(true)
    setError(null)

    try {
      const fileName = `${projectId}/recording_${Date.now()}.webm`
      console.log(`📤 Subiendo a: ${fileName}, tamaño: ${blob.size} bytes`)
      
      const { error: uploadError } = await supabase
        .storage
        .from("audio")
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'audio/webm'
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
      console.log(`🔊 URL del audio: ${audioUrl}`)

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

      console.log("✅ Grabación guardada correctamente")
      alert("✅ Grabación subida correctamente")

    } catch (error) {
      console.error("❌ Error en uploadAudio:", error)
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
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#ef4444", fontSize: 16 }}>
              ⏱ {formatTime(recordingTime)}
            </span>
            <div style={{
              width: 60,
              height: 4,
              background: "#333",
              borderRadius: 2,
              overflow: "hidden"
            }}>
              <div style={{
                width: `${audioLevel * 100}%`,
                height: "100%",
                background: audioLevel > 0.1 ? "#10b981" : "#ef4444",
                transition: "width 0.1s"
              }} />
            </div>
          </div>
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
