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
  isOwner: boolean
  volume: number
  instrument: string
  category: string
}

// ✅ Definición de categorías e instrumentos (misma que en proyectos)
const CATEGORIES = {
  'viento': {
    name: '🎷 Banda de Viento',
    emoji: '🎷',
    instruments: ['Trompeta', 'Saxofón', 'Trombón', 'Clarinete', 'Flauta', 'Tuba']
  },
  'cuerda': {
    name: '🎻 Orquesta de Cámara',
    emoji: '🎻',
    instruments: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo', 'Arpa', 'Piano']
  },
  'moderna': {
    name: '🎸 Banda de Rock',
    emoji: '🎸',
    instruments: ['Guitarra', 'Bajo', 'Batería', 'Teclado', 'Voz', 'Sintetizador']
  }
}

type CategoryKey = keyof typeof CATEGORIES

// ✅ Emoji para instrumentos
const getInstrumentEmoji = (instrument: string) => {
  const emojis: Record<string, string> = {
    'Trompeta': '🎺',
    'Saxofón': '🎷',
    'Trombón': '🎺',
    'Clarinete': '🎵',
    'Flauta': '🎵',
    'Tuba': '🎵',
    'Violín': '🎻',
    'Viola': '🎻',
    'Violonchelo': '🎻',
    'Contrabajo': '🎻',
    'Arpa': '🎵',
    'Piano': '🎹',
    'Guitarra': '🎸',
    'Bajo': '🎸',
    'Batería': '🥁',
    'Teclado': '🎹',
    'Voz': '🎤',
    'Sintetizador': '🎹'
  }
  return emojis[instrument] || '🎵'
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
  const [hasRecording, setHasRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [myName, setMyName] = useState("")
  const [isNameSet, setIsNameSet] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [peerCount, setPeerCount] = useState(0)
  const [audioTest, setAudioTest] = useState<string>("")
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [isOwner, setIsOwner] = useState(false)
  
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null)
  const [selectedInstrument, setSelectedInstrument] = useState<string>("")
  const [roomCategory, setRoomCategory] = useState<string>("")
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodesRef = useRef<Map<string, GainNode>>(new Map())

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
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
        source.connect(audioContext.destination)
        
        setAudioTest("✅ Escuchando tu micrófono")
        addMessage("Sistema", "🔊 Monitorización de audio activada. ¡Habla para probar!")
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
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement
      if (localVideo) {
        localVideo.srcObject = stream
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
      setAudioTest("❌ Error: No se pudo acceder al micrófono")
      addMessage("Sistema", "❌ No se pudo acceder al micrófono. Permite el acceso en tu navegador.")
    }
  }

  const createRoom = async (category: CategoryKey) => {
    if (!selectedInstrument) {
      addMessage("Sistema", "⚠️ Selecciona un instrumento primero")
      return
    }

    const newRoomId = generateRoomId()
    setRoomId(newRoomId)
    setIsOwner(true)
    setSelectedCategory(category)
    setRoomCategory(category)
    await startLocalStream()
    setIsInRoom(true)
    
    const categoryName = CATEGORIES[category].name
    setParticipants([{ 
      id: user?.id || 'local', 
      name: myName || user?.email || 'Anónimo',
      isMuted: false,
      isVideoEnabled: isCameraOn,
      isOwner: true,
      volume: 0.8,
      instrument: selectedInstrument,
      category: category
    }])
    
    addMessage("Sistema", `👑 ${myName} ha creado una sala de ${categoryName} con ${selectedInstrument}`)
    subscribeToRoom(newRoomId, category)
  }

  const joinRoom = async () => {
    if (!roomId.trim()) {
      addMessage("Sistema", "⚠️ Introduce un código de sala")
      return
    }
    if (!selectedInstrument) {
      addMessage("Sistema", "⚠️ Selecciona un instrumento primero")
      return
    }

    setIsOwner(false)
    await startLocalStream()
    setIsInRoom(true)
    setParticipants([{ 
      id: user?.id || 'local', 
      name: myName || user?.email || 'Anónimo',
      isMuted: false,
      isVideoEnabled: isCameraOn,
      isOwner: false,
      volume: 0.8,
      instrument: selectedInstrument,
      category: selectedCategory || ''
    }])
    addMessage("Sistema", `🎵 ${myName} se ha unido a la sala ${roomId} con ${selectedInstrument}`)
    subscribeToRoom(roomId, selectedCategory || 'moderna')
  }

  const subscribeToRoom = (roomId: string, category: string) => {
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
        const instrumentEmoji = getInstrumentEmoji(payload.instrument)
        const categoryName = payload.category ? CATEGORIES[payload.category as CategoryKey]?.name || payload.category : 'Sin categoría'
        
        if (payload.isOwner && payload.category) {
          setRoomCategory(payload.category)
          setSelectedCategory(payload.category as CategoryKey)
        }
        
        addMessage("Sistema", `👤 ${payload.name} (${instrumentEmoji} ${payload.instrument}) se ha unido a ${categoryName}`)
        setParticipants(prev => {
          if (!prev.find(p => p.id === payload.id)) {
            return [...prev, { 
              id: payload.id, 
              name: payload.name, 
              isMuted: false, 
              isVideoEnabled: false,
              isOwner: payload.isOwner || false,
              volume: 0.8,
              instrument: payload.instrument || 'Sin instrumento',
              category: payload.category || category
            }]
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
      .on('broadcast', { event: 'mute-user' }, ({ payload }) => {
        if (payload.targetId === user?.id) {
          const isMuted = payload.muted
          setIsMuted(isMuted)
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0]
            if (audioTrack) {
              audioTrack.enabled = !isMuted
            }
          }
          addMessage("Sistema", isMuted ? "🔇 El dueño te ha silenciado" : "🎤 El dueño te ha activado el micrófono")
        }
      })
      .on('broadcast', { event: 'master-volume' }, ({ payload }) => {
        setMasterVolume(payload.volume)
        gainNodesRef.current.forEach((gainNode) => {
          gainNode.gain.value = payload.volume
        })
        addMessage("Sistema", `🎚️ El dueño ha cambiado el volumen master a ${Math.round(payload.volume * 100)}%`)
      })
      .on('broadcast', { event: 'room-category' }, ({ payload }) => {
        setRoomCategory(payload.category)
        setSelectedCategory(payload.category as CategoryKey)
        const categoryName = CATEGORIES[payload.category as CategoryKey]?.name || payload.category
        addMessage("Sistema", `🏷️ La sala ahora es de ${categoryName}`)
      })
      .subscribe((status) => {
        console.log('🔊 Canal de señalización:', status)
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: { 
              id: user?.id || 'local', 
              name: myName || 'Anónimo',
              isOwner: isOwner,
              instrument: selectedInstrument,
              category: category
            }
          })
          
          if (isOwner) {
            setTimeout(() => {
              channel.send({
                type: 'broadcast',
                event: 'room-category',
                payload: { category: category }
              })
            }, 500)
          }
        }
      })
  }

  const muteParticipant = (participantId: string, muted: boolean) => {
    if (!isOwner) {
      addMessage("Sistema", "⚠️ Solo el dueño de la sala puede mutear usuarios")
      return
    }

    const participant = participants.find(p => p.id === participantId)
    if (!participant) return

    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, isMuted: muted } : p
    ))

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'mute-user',
        payload: {
          targetId: participantId,
          muted: muted
        }
      })
    }

    addMessage("Sistema", `🔇 ${participant.name} ha sido ${muted ? 'silenciado' : 'activado'}`)
  }

  const changeParticipantVolume = (participantId: string, volume: number) => {
    if (!isOwner) return
    const newVolume = Math.max(0, Math.min(1, volume))
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, volume: newVolume } : p
    ))
  }

  const changeMasterVolume = (volume: number) => {
    if (!isOwner) return
    const newVolume = Math.max(0, Math.min(1, volume))
    setMasterVolume(newVolume)
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'master-volume',
        payload: { volume: newVolume }
      })
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
        } catch (error) {
          addMessage("Sistema", "❌ No se pudo activar la cámara")
        }
      }
    }
  }

  const startRecording = () => {
    if (!localStreamRef.current) return
    
    recordedChunksRef.current = []
    setHasRecording(false)
    
    const mediaRecorder = new MediaRecorder(localStreamRef.current)
    mediaRecorderRef.current = mediaRecorder
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }
    
    mediaRecorder.onstop = () => {
      if (recordedChunksRef.current.length > 0) {
        setHasRecording(true)
        addMessage("Sistema", "💾 Grabación finalizada. Haz clic en 'Descargar grabación' para guardarla.")
      } else {
        addMessage("Sistema", "⚠️ No se grabó nada. Intenta de nuevo.")
      }
      setIsRecording(false)
      setRecordingTime(0)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    
    mediaRecorder.start()
    setIsRecording(true)
    setRecordingTime(0)
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1)
    }, 1000)
    
    addMessage("Sistema", "🔴 Grabación iniciada")
  }

  const downloadRecording = () => {
    if (recordedChunksRef.current.length === 0) {
      addMessage("Sistema", "⚠️ No hay grabación para descargar")
      return
    }
    
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jam-session-${roomId}-${Date.now()}.webm`
    a.click()
    URL.revokeObjectURL(url)
    addMessage("Sistema", "💾 Grabación descargada")
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
    
    setHasRecording(false)
    recordedChunksRef.current = []
    
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
    setIsOwner(false)
    setSelectedCategory(null)
    setSelectedInstrument("")
    setRoomCategory("")
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
        justifyContent: "center",
        padding: "20px"
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
        justifyContent: "center",
        padding: "20px"
      }}>
        <div style={{
          maxWidth: 600,
          width: "100%",
          padding: 40,
          borderRadius: 16,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)"
        }}>
          <h1 style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🎵</h1>
          <h2 style={{ textAlign: "center", marginBottom: 24 }}>Jam Session Web</h2>
          
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: "#9ca3af", marginBottom: 12, fontWeight: "bold" }}>
              🎯 Elige el tipo de Jam:
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedCategory(key as CategoryKey)
                    setSelectedInstrument("")
                  }}
                  style={{
                    flex: 1,
                    minWidth: "120px",
                    padding: "12px 16px",
                    background: selectedCategory === key ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                    color: selectedCategory === key ? "#10b981" : "#9ca3af",
                    border: selectedCategory === key ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: selectedCategory === key ? "bold" : "normal",
                    textAlign: "center"
                  }}
                >
                  <div style={{ fontSize: 28 }}>{cat.emoji}</div>
                  <div style={{ fontSize: 13 }}>{cat.name}</div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                    {cat.instruments.join(', ')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedCategory && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: "#9ca3af", marginBottom: 12, fontWeight: "bold" }}>
                🎸 Elige tu instrumento:
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {CATEGORIES[selectedCategory].instruments.map((inst) => {
                  const emoji = getInstrumentEmoji(inst)
                  return (
                    <button
                      key={inst}
                      onClick={() => setSelectedInstrument(inst)}
                      style={{
                        padding: "8px 16px",
                        background: selectedInstrument === inst ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)",
                        color: selectedInstrument === inst ? "#10b981" : "#9ca3af",
                        border: selectedInstrument === inst ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 14
                      }}
                    >
                      {emoji} {inst}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={() => {
                if (selectedCategory && selectedInstrument) {
                  createRoom(selectedCategory)
                } else {
                  addMessage("Sistema", "⚠️ Selecciona categoría e instrumento")
                }
              }}
              disabled={!selectedCategory || !selectedInstrument}
              style={{
                width: "100%",
                padding: "14px",
                background: (selectedCategory && selectedInstrument) ? "#10b981" : "#444",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: "bold",
                cursor: (selectedCategory && selectedInstrument) ? "pointer" : "not-allowed"
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
                disabled={!roomId.trim() || !selectedCategory || !selectedInstrument}
                style={{
                  padding: "10px 20px",
                  background: (roomId.trim() && selectedCategory && selectedInstrument) ? "#3b82f6" : "#444",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: (roomId.trim() && selectedCategory && selectedInstrument) ? "pointer" : "not-allowed",
                  fontWeight: "bold"
                }}
              >
                Unirse
              </button>
            </div>
            <p style={{ color: "#6b7280", fontSize: 12, textAlign: "center" }}>
              {selectedCategory && selectedInstrument 
                ? `🎵 ${CATEGORIES[selectedCategory].name} - ${selectedInstrument}` 
                : "Selecciona categoría e instrumento para empezar"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const getCategoryDisplay = () => {
    if (roomCategory && CATEGORIES[roomCategory as CategoryKey]) {
      const cat = CATEGORIES[roomCategory as CategoryKey]
      return `${cat.emoji} ${cat.name}`
    }
    return '🎵 Sin categoría'
  }

  const renderParticipants = () => {
    return participants.map((p) => {
      const isMe = p.id === user?.id || p.id === 'local'
      const instrumentEmoji = getInstrumentEmoji(p.instrument)
      
      return (
        <div key={p.id} style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 10px",
          background: isMe ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)",
          borderRadius: 6,
          border: isMe ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.05)"
        }}>
          <span>{instrumentEmoji}</span>
          <span style={{ flex: 1, color: "white", fontSize: 13, fontWeight: isMe ? "bold" : "normal" }}>
            {p.name} {isMe && "(tú)"}
            {p.isMuted && " 🔇"}
          </span>
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            {p.instrument}
          </span>
          
          {isOwner && !isMe && (
            <>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={p.volume}
                onChange={(e) => changeParticipantVolume(p.id, parseFloat(e.target.value))}
                style={{ width: "60px", accentColor: "#10b981" }}
              />
              <button
                onClick={() => muteParticipant(p.id, !p.isMuted)}
                style={{
                  padding: "2px 8px",
                  background: p.isMuted ? "#10b981" : "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11
                }}
              >
                {p.isMuted ? "🔊" : "🔇"}
              </button>
            </>
          )}
          
          {p.isOwner && (
            <span style={{
              fontSize: 10,
              background: "rgba(251,191,36,0.2)",
              color: "#fbbf24",
              padding: "2px 6px",
              borderRadius: 10
            }}>
              👑
            </span>
          )}
        </div>
      )
    })
  }

  return (
    <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        padding: "10px 16px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        flexWrap: "wrap",
        gap: 8
      }}>
        <div>
          <span style={{ color: "#10b981", fontWeight: "bold" }}>
            🎵 Sala: {roomId}
          </span>
          <span style={{ color: "#fbbf24", marginLeft: 12, fontSize: 14, fontWeight: "bold" }}>
            {getCategoryDisplay()}
          </span>
          <span style={{ color: "#6b7280", marginLeft: 12, fontSize: 13 }}>
            👥 {participants.length}/5
          </span>
          {isOwner && (
            <span style={{ color: "#fbbf24", marginLeft: 12, fontSize: 13 }}>
              👑 Dueño
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button onClick={toggleMute} style={{ padding: "4px 12px", background: isMuted ? "#ef4444" : "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
            {isMuted ? "🔇" : "🎤"}
          </button>
          <button onClick={toggleCamera} style={{ padding: "4px 12px", background: isCameraOn ? "#10b981" : "#6b7280", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
            {isCameraOn ? "📹" : "📹 OFF"}
          </button>
          {!isRecording ? (
            <button onClick={startRecording} style={{ padding: "4px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
              🔴
            </button>
          ) : (
            <button onClick={stopRecording} style={{ padding: "4px 12px", background: "#f59e0b", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
              ⏹
            </button>
          )}
          {hasRecording && !isRecording && (
            <button onClick={downloadRecording} style={{ padding: "4px 12px", background: "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: "bold" }}>
              💾
            </button>
          )}
          <button onClick={leaveRoom} style={{ padding: "4px 12px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
            ✕
          </button>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: "12px"
      }}>
        <div>
          <div style={{
            marginBottom: 12,
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
              {isRecording && " 🔴"}
              {isOwner && " 👑"}
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

          <div style={{
            background: "rgba(255,255,255,0.03)",
            borderRadius: 8,
            padding: "12px 16px",
            border: "1px solid rgba(255,255,255,0.05)"
          }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#9ca3af", fontSize: 14 }}>
              👥 Participantes ({participants.length})
              {isOwner && " - Tienes control sobre el volumen y mute"}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {renderParticipants()}
            </div>
          </div>
        </div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          height: "500px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.05)",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ color: "#9ca3af", fontWeight: "bold" }}>💬 Chat</span>
            {isOwner && (
              <span style={{ fontSize: 11, color: "#fbbf24" }}>👑 Dueño</span>
            )}
          </div>
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
          
          {isOwner && (
            <div style={{
              padding: "8px 12px",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>
              <span style={{ color: "#9ca3af", fontSize: 13, fontWeight: "bold" }}>🎚️ Master</span>
              <span style={{ fontSize: 12, color: "#6b7280", minWidth: "35px" }}>
                {Math.round(masterVolume * 100)}%
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={(e) => changeMasterVolume(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: "#10b981"
                }}
              />
              <span style={{ fontSize: 14, color: "#9ca3af" }}>🔊</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
        💡 Comparte el código <strong>{roomId}</strong> con otros músicos
      </div>
    </div>
  )
}
