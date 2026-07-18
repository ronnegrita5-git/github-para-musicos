"use client"

import { useEffect, useState, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import Link from "next/link"

// Configuración de WebRTC
const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

interface Message {
  id: string
  user: string
  text: string
  timestamp: number
}

interface Participant {
  id: string
  name: string
  stream: MediaStream | null
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
  const [isVideoEnabled, setIsVideoEnabled] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [myName, setMyName] = useState("")
  const [isNameSet, setIsNameSet] = useState(false)
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Generar ID de sala
  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  // Configurar nombre
  const setUsername = () => {
    if (myName.trim()) {
      setIsNameSet(true)
      addMessage("Sistema", `👤 ${myName} se ha unido a la sala`)
    }
  }

  const createRoom = async () => {
    const newRoomId = generateRoomId()
    setRoomId(newRoomId)
    await startLocalMedia()
    setIsInRoom(true)
    setParticipants([{ 
      id: user?.id || 'local', 
      name: myName || user?.email || 'Anónimo',
      stream: localStreamRef.current,
      isMuted: false,
      isVideoEnabled: isCameraOn
    }])
    addMessage("Sistema", `🎵 Sala ${newRoomId} creada. ¡Comparte este código!`)
  }

  const joinRoom = async () => {
    if (!roomId.trim()) return
    await startLocalMedia()
    setIsInRoom(true)
    setParticipants([{ 
      id: user?.id || 'local', 
      name: myName || user?.email || 'Anónimo',
      stream: localStreamRef.current,
      isMuted: false,
      isVideoEnabled: isCameraOn
    }])
    addMessage("Sistema", `🎵 Te has unido a la sala ${roomId}`)
  }

  const startLocalMedia = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isCameraOn
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement
      if (localVideo) {
        localVideo.srcObject = stream
      }
      
      addMessage("Sistema", "🎤 Micrófono activado")
      if (isCameraOn) {
        addMessage("Sistema", "📹 Cámara activada")
      }
      
    } catch (error) {
      console.error("Error al acceder al micrófono:", error)
      addMessage("Sistema", "❌ No se pudo acceder al micrófono")
    }
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
          
          const localVideo = document.getElementById('localVideo') as HTMLVideoElement
          if (localVideo) {
            localVideo.srcObject = localStreamRef.current
          }
        } catch (error) {
          console.error("Error al activar la cámara:", error)
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
    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
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
  }

  const addFakeParticipant = () => {
    if (participants.length >= 5) {
      addMessage("Sistema", "⚠️ Sala completa (máximo 5 participantes)")
      return
    }
    
    const fakeNames = ["🎸 Guitarra", "🥁 Batería", "🎹 Piano", "🎤 Vocalista", "🎻 Violín"]
    const usedNames = participants.map(p => p.name)
    const available = fakeNames.filter(n => !usedNames.includes(n))
    
    if (available.length === 0) {
      addMessage("Sistema", "⚠️ No hay más músicos disponibles")
      return
    }
    
    const randomName = available[Math.floor(Math.random() * available.length)]
    setParticipants(prev => [...prev, {
      id: `fake-${Date.now()}`,
      name: randomName,
      stream: null,
      isMuted: false,
      isVideoEnabled: false
    }])
    addMessage("Sistema", `👤 ${randomName} se ha unido a la sala`)
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
            Introduce tu nombre para continuar
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
              placeholder="Código de sala (ej: A1B2C3)"
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
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "white"
    }}>
      <aside style={{
        width: 240,
        padding: "24px 16px",
        background: "rgba(255,255,255,0.03)",
        borderRight: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div style={{ padding: "0 8px 16px", fontSize: 20, fontWeight: "bold", color: "#10b981" }}>
          🎵 Music Collab
        </div>
        <Link href="/" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>🏠 Inicio</Link>
        <Link href="/explore" style={{ padding: "10px 12px", borderRadius: 8, color: "#9ca3af", textDecoration: "none", display: "block" }}>📁 Proyectos</Link>
        <Link href="/jam-web" style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981", textDecoration: "none", display: "block" }}>🎵 Jam Web</Link>
      </aside>

      <main style={{ flex: 1, padding: "20px", maxWidth: "1200px" }}>
        {/* Cabecera */}
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
              👥 {participants.length}/5 participantes
            </span>
            {isRecording && (
              <span style={{ color: "#ef4444", marginLeft: 12 }}>
                🔴 Grabando {formatTime(recordingTime)}
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
              onClick={addFakeParticipant}
              disabled={participants.length >= 5}
              style={{
                padding: "6px 14px",
                background: participants.length < 5 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
                color: participants.length < 5 ? "#10b981" : "#6b7280",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 6,
                cursor: participants.length < 5 ? "pointer" : "not-allowed",
                fontSize: 13
              }}
            >
              ➕ Invitar
            </button>
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

        {/* Videos */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`,
          gap: "16px",
          marginBottom: 16
        }}>
          {/* Video local */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.05)",
            aspectRatio: "4/3",
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
          </div>

          {/* Participantes remotos */}
          {participants.filter(p => p.id !== user?.id && p.id !== 'local').map((p) => (
            <div key={p.id} style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.05)",
              aspectRatio: "4/3",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              {p.stream ? (
                <video
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    background: "#111"
                  }}
                  ref={(el) => {
                    if (el && p.stream) {
                      el.srcObject = p.stream
                    }
                  }}
                />
              ) : (
                <div style={{
                  fontSize: 48,
                  color: "#6b7280"
                }}>
                  🎵
                </div>
              )}
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
                {p.name} {p.isMuted ? "🔇" : "🎤"}
              </div>
            </div>
          ))}
        </div>

        {/* Chat */}
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
          💡 Comparte el código <strong>{roomId}</strong> con otros músicos para que se unan
        </div>
      </main>
    </div>
  )
}
