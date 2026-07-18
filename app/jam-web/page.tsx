"use client"

import { useEffect, useState, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface Message {
  id: string
  user: string
  text: string
  timestamp: number
}

interface Participant {
  id: string
  name: string
  isMuted: boolean
  isVideoEnabled: boolean
}

export default function JamWebPage() {
  const { user } = useAuth()
  const [roomId, setRoomId] = useState("")
  const [isInRoom, setIsInRoom] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [myName, setMyName] = useState("")
  const [isNameSet, setIsNameSet] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)
  const [audioTest, setAudioTest] = useState<string>("")
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const PEER_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  }

  const setUsername = () => {
    if (myName.trim()) {
      setIsNameSet(true)
      addMessage("Sistema", `👤 ${myName} se ha unido a la sala`)
    }
  }

  const testLocalAudio = () => {
    if (localStreamRef.current) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioContextRef.current = audioContext
        
        const source = audioContext.createMediaStreamSource(localStreamRef.current)
        const analyser = audioContext.createAnalyser()
        source.connect(analyser)
        source.connect(audioContext.destination)
        
        setAudioTest("✅ Escuchando tu micrófono")
        addMessage("Sistema", "🔊 Monitorización de audio activada. ¡Habla para probar!")
        
        console.log('🎤 Monitorización de audio activada')
      } catch (error) {
        console.error('Error en monitorización:', error)
        setAudioTest("❌ Error al monitorizar audio")
      }
    } else {
      setAudioTest("❌ No hay stream de audio")
    }
  }

  const startLocalStream = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: isCameraOn
      }
      
      console.log('🎤 Solicitando micrófono...')
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      console.log('✅ Micrófono obtenido:', stream.getAudioTracks().length)
      
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement
      if (localVideo) {
        localVideo.srcObject = stream
        console.log('📹 Video local conectado')
      }
      
      setIsConnected(true)
      addMessage("Sistema", "🎤 Micrófono conectado")
      
      setTimeout(() => {
        testLocalAudio()
      }, 500)
      
      if (isCameraOn) {
        addMessage("Sistema", "📹 Cámara activada")
      }
      
    } catch (error) {
      console.error('Error al acceder al micrófono:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setAudioTest("❌ Error: " + errorMessage)
      addMessage("Sistema", "❌ No se pudo acceder al micrófono. Permite el acceso en tu navegador.")
    }
  }

  const createRoom = async () => {
    const newRoomId = generateRoomId()
    setRoomId(newRoomId)
    await startLocalStream()
    setIsInRoom(true)
    setParticipants([{ 
      id: user?.id || 'local', 
      name: myName || user?.email || 'Anónimo',
      isMuted: false,
      isVideoEnabled: isCameraOn
    }])
    addMessage("Sistema", `🎵 Sala ${newRoomId} creada. ¡Comparte el código!`)
    subscribeToRoom(newRoomId)
  }

  const joinRoom = async () => {
    if (!roomId.trim()) return
    await startLocalStream()
    setIsInRoom(true)
    setParticipants([{ 
      id: user?.id || 'local', 
      name: myName || user?.email || 'Anónimo',
      isMuted: false,
      isVideoEnabled: isCameraOn
    }])
    addMessage("Sistema", `🎵 Te has unido a la sala ${roomId}`)
    subscribeToRoom(roomId)
  }

  const subscribeToRoom = (roomId: string) => {
    if (channelRef.current) {
      channelRef.current.unsubscribe()
    }

    const channel = supabase.channel(`jam:${roomId}`)
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        console.log('📥 Oferta recibida:', payload)
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        console.log('📥 Respuesta recibida:', payload)
      })
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
        console.log('📥 ICE candidate recibido:', payload)
      })
      .on('broadcast', { event: 'user-joined' }, ({ payload }) => {
        addMessage("Sistema", `👤 ${payload.name} se ha unido`)
        setParticipants(prev => {
          if (!prev.find(p => p.id === payload.id)) {
            return [...prev, { id: payload.id, name: payload.name, isMuted: false, isVideoEnabled: false }]
          }
          return prev
        })
        setPeerCount(prev => prev + 1)
      })
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        addMessage("Sistema", `👤 ${payload.name} ha salido`)
        setParticipants(prev => prev.filter(p => p.id !== payload.id))
        setPeerCount(prev => Math.max(0, prev - 1))
      })
      .subscribe((status) => {
        console.log('🔊 Canal de señalización:', status)
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: { id: user?.id || 'local', name: myName || 'Anónimo' }
          })
        }
      })
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsMuted(!isMuted)
        addMessage("Sistema", isMuted ? "🎤 Micrófono activado" : "🔇 Micrófono desactivado")
      }
    }
  }

  const toggleCamera = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsCameraOn(!isCameraOn)
        addMessage("Sistema", isCameraOn ? "📹 Cámara desactivada" : "📹 Cámara activada")
      } else {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          const videoTrack = stream.getVideoTracks()[0]
          localStreamRef.current.addTrack(videoTrack)
          setIsCameraOn(true)
          addMessage("Sistema", "📹 Cámara activada")
        } catch (error) {
          addMessage("Sistema", "❌ No se pudo activar la cámara")
        }
      }
    }
  }

  const startRecording = () => {
    if (!localStreamRef.current) return
    
    recordedChunksRef.current = []
    const mediaRecorder = new MediaRecorder(localStreamRef.current)
    mediaRecorderRef.current = mediaRecorder
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jam-session-${roomId}-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
      setIsRecording(false)
      setRecordingTime(0)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      addMessage("Sistema", "💾 Grabación guardada")
    }
    
    mediaRecorder.start()
    setIsRecording(true)
    setRecordingTime(0)
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)
    
    addMessage("Sistema", "🔴 Grabación iniciada")
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const addMessage = (user: string, text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      user,
      text,
      timestamp: Date.now()
    }])
  }

  const sendMessage = () => {
    if (!inputMessage.trim()) return
    addMessage(myName || user?.email || 'Anónimo', inputMessage)
    setInputMessage("")
  }

  const leaveRoom = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'user-left',
        payload: { id: user?.id, name: myName || 'Anónimo' }
      })
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    
    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    setIsInRoom(false)
    setRoomId("")
    setParticipants([])
    setMessages([])
    setIsRecording(false)
    setRecordingTime(0)
    setIsMuted(false)
    setIsCameraOn(false)
    setIsConnected(false)
    setPeerCount(0)
    setAudioTest("")
  }

  if (!user) {
    return (
      <div style={{ padding: 40, color: "white", textAlign: "center" }}>
        <p>🔒 Debes iniciar sesión para usar la Jam Session Web</p>
        <Link href="/login" style={{ color: "#10b981" }}>Iniciar sesión</Link>
      </div>
    )
  }

  if (!isNameSet) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "white",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          maxWidth: 400,
          width: "100%",
          padding: 40,
          borderRadius: 16,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center"
        }}>
          <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎵</h1>
          <h2 style={{ marginBottom: 24 }}>Jam Session Web</h2>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>
            Introduce tu nombre para empezar
          </p>
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="Tu nombre artístico"
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #333",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 16,
              marginBottom: 16
            }}
            onKeyPress={(e) => e.key === "Enter" && setUsername()}
          />
          <button
            onClick={setUsername}
            disabled={!myName.trim()}
            style={{
              width: "100%",
              padding: "14px",
              background: myName.trim() ? "#10b981" : "#444",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: "bold",
              cursor: myName.trim() ? "pointer" : "not-allowed"
            }}
          >
            Entrar a la Jam
          </button>
        </div>
      </div>
    )
  }

  if (!isInRoom) {
    return (
      <div style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "white",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          maxWidth: 400,
          width: "100%",
          padding: 40,
          borderRadius: 16,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          textAlign: "center"
        }}>
          <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎵</h1>
          <h2 style={{ marginBottom: 8 }}>Jam Session Web</h2>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>
            Crea una sala o únete a una existente
          </p>
          
          <button
            onClick={createRoom}
            style={{
              width: "100%",
              padding: "14px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              fontWeight: "bold",
              cursor: "pointer",
              marginBottom: 16
            }}
          >
            🎸 Crear sala
          </button>

          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Código de sala"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                fontSize: 16,
                textTransform: "uppercase"
              }}
            />
            <button
              onClick={joinRoom}
              disabled={!roomId.trim()}
              style={{
                padding: "10px 20px",
                background: roomId.trim() ? "#10b981" : "#444",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: roomId.trim() ? "pointer" : "not-allowed",
                fontWeight: "bold"
              }}
            >
              Unirse
            </button>
          </div>

          <p style={{ color: "#6b7280", fontSize: 12, marginTop: 16 }}>
            Máximo 5 participantes por sala
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
        padding: "12px 16px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        flexWrap: "wrap",
        gap: 8
      }}>
        <div>
          <span style={{ color: "#10b981", fontWeight: "bold" }}>🎵 Sala: {roomId}</span>
          <span style={{ color: "#6b7280", marginLeft: 12 }}>
            👥 {participants.length}/5
          </span>
          {isRecording && (
            <span style={{ color: "#ef4444", marginLeft: 12 }}>
              🔴 {formatTime(recordingTime)}
            </span>
          )}
          {audioTest && (
            <span style={{ color: audioTest.includes("✅") ? "#10b981" : "#ef4444", marginLeft: 12, fontSize: 12 }}>
              {audioTest}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={toggleMute}
            style={{
              padding: "6px 14px",
              background: isMuted ? "#ef4444" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13
            }}
          >
            {isMuted ? "🔇 Desmutear" : "🎤 Mutear"}
          </button>
          <button
            onClick={toggleCamera}
            style={{
              padding: "6px 14px",
              background: isCameraOn ? "#10b981" : "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13
            }}
          >
            {isCameraOn ? "📹 Cámara ON" : "📹 Cámara OFF"}
          </button>
          {!isRecording ? (
            <button
              onClick={startRecording}
              style={{
                padding: "6px 14px",
                background: "#ef4444",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13
              }}
            >
              🔴 Grabar
            </button>
          ) : (
            <button
              onClick={stopRecording}
              style={{
                padding: "6px 14px",
                background: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13
              }}
            >
              ⏹ Detener
            </button>
          )}
          <button
            onClick={leaveRoom}
            style={{
              padding: "6px 14px",
              background: "rgba(239,68,68,0.15)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13
            }}
          >
            Salir
          </button>
        </div>
      </div>

      <div style={{
        marginBottom: 16,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.05)",
        aspectRatio: "16/9",
        position: "relative"
      }}>
        <video
          id="localVideo"
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#111"
          }}
        />
        <div style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          background: "rgba(0,0,0,0.7)",
          padding: "4px 12px",
          borderRadius: 12,
          fontSize: 12,
          color: "white"
        }}>
          {myName} {isMuted ? "🔇" : "🎤"} {isCameraOn ? "📹" : ""}
        </div>
        <div style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.7)",
          padding: "4px 12px",
          borderRadius: 12,
          fontSize: 11,
          color: audioTest?.includes("✅") ? "#10b981" : "#6b7280"
        }}>
          {audioTest || "🔇"}
        </div>
      </div>

      {participants.filter(p => p.id !== user?.id && p.id !== 'local').length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: 16
        }}>
          {participants.filter(p => p.id !== user?.id && p.id !== 'local').map((p) => (
            <div key={p.id} style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.05)",
              aspectRatio: "16/9",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <div style={{
                fontSize: 48,
                color: "#6b7280"
              }}>
                🎵
              </div>
              <div style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                background: "rgba(0,0,0,0.7)",
                padding: "4px 12px",
                borderRadius: 12,
                fontSize: 12,
                color: "white"
              }}>
                {p.name}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "200px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.05)",
        overflow: "hidden"
      }}>
        <div style={{
          flex: 1,
          padding: "12px 16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              padding: "4px 12px",
              background: msg.user === "Sistema" ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)",
              borderRadius: 6,
              fontSize: 14
            }}>
              <span style={{ color: msg.user === "Sistema" ? "#10b981" : "#6b7280", fontWeight: "bold" }}>
                {msg.user === "Sistema" ? "📢 " : msg.user}:
              </span>
              <span style={{ color: "white", marginLeft: 4 }}>{msg.text}</span>
            </div>
          ))}
        </div>
        <div style={{
          display: "flex",
          padding: "8px 12px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          gap: "8px"
        }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #333",
              background: "rgba(255,255,255,0.05)",
              color: "white",
              fontSize: 14
            }}
          />
          <button
            onClick={sendMessage}
            style={{
              padding: "8px 16px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Enviar
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
        💡 Comparte el código <strong>{roomId}</strong> con otros músicos
      </div>
    </div>
  )
}
