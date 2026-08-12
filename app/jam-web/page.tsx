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
  isSpeaking?: boolean
}

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
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [myName, setMyName] = useState("")
  const [isNameSet, setIsNameSet] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null)
  const [selectedInstrument, setSelectedInstrument] = useState<string>("")
  const [roomCategory, setRoomCategory] = useState<string>("")
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [bpm, setBpm] = useState(120)
  const [isMetronomeOn, setIsMetronomeOn] = useState(false)
  const [speakingLevel, setSpeakingLevel] = useState<Record<string, number>>({})
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const metronomeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

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
      addMessage("Sistema", `👤 ${myName} se ha unido a la jam`)
    }
  }

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const startLocalStream = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: isCameraOn
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      
      // ✅ Configurar analizador para detección de voz
      const ctx = initAudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)
      
      const localVideo = document.getElementById('localVideo') as HTMLVideoElement
      if (localVideo) {
        localVideo.srcObject = stream
      }
      
      addMessage("Sistema", "🎤 Micrófono conectado")
      
      // ✅ Iniciar monitoreo de nivel de voz
      monitorVoiceLevel()
      
    } catch (error) {
      console.error('Error al acceder al micrófono:', error)
      addMessage("Sistema", "❌ No se pudo acceder al micrófono. Permite el acceso en tu navegador.")
    }
  }

  // ✅ Monitorear nivel de voz para mostrar quién está hablando
  const monitorVoiceLevel = () => {
    if (!analyserRef.current) return
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    
    const checkLevel = () => {
      if (!analyserRef.current) return
      
      analyserRef.current.getByteFrequencyData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      const average = sum / dataArray.length
      const level = average / 255
      
      setSpeakingLevel(prev => ({
        ...prev,
        [user?.id || 'local']: level
      }))
      
      // ✅ Enviar nivel de voz a otros participantes
      if (channelRef.current && level > 0.1) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'voice-level',
          payload: { 
            userId: user?.id, 
            level: level 
          }
        })
      }
      
      setTimeout(checkLevel, 100)
    }
    
    checkLevel()
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
              category: payload.category || category,
              isSpeaking: false
            }]
          }
          return prev
        })
      })
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        addMessage("Sistema", `👤 ${payload.name} ha salido`)
        setParticipants(prev => prev.filter(p => p.id !== payload.id))
      })
      .on('broadcast', { event: 'voice-level' }, ({ payload }) => {
        setSpeakingLevel(prev => ({
          ...prev,
          [payload.userId]: payload.level
        }))
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

  // ✅ Metrónomo
  const toggleMetronome = () => {
    if (isMetronomeOn) {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current)
        metronomeIntervalRef.current = null
      }
      setIsMetronomeOn(false)
      addMessage("Sistema", "🔇 Metrónomo desactivado")
    } else {
      const ctx = initAudioContext()
      setIsMetronomeOn(true)
      
      let count = 0
      metronomeIntervalRef.current = setInterval(() => {
        if (!isMetronomeOn) return
        
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        
        const isAccent = count % 4 === 0
        oscillator.frequency.value = isAccent ? 880 : 440
        gain.gain.value = 0.3
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.05)
        
        count++
      }, 60000 / bpm)
      
      addMessage("Sistema", `🎵 Metrónomo activado a ${bpm} BPM`)
    }
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
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    
    if (metronomeIntervalRef.current) {
      clearInterval(metronomeIntervalRef.current)
      metronomeIntervalRef.current = null
    }
    
    setIsInRoom(false)
    setRoomId("")
    setParticipants([])
    setMessages([])
    setIsMuted(false)
    setIsCameraOn(false)
    setIsOwner(false)
    setSelectedCategory(null)
    setSelectedInstrument("")
    setRoomCategory("")
    setIsMetronomeOn(false)
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
          <h2 style={{ marginBottom: 24 }}>Jam Session</h2>
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
          <h2 style={{ textAlign: "center", marginBottom: 24 }}>Jam Session</h2>
          
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
              🎸 Crear sala de ensayo
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

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column",
      minHeight: "100vh", 
      background: "#0a0a0a", 
      color: "white",
      padding: "16px",
      maxWidth: "1200px",
      margin: "0 auto"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "16px",
        padding: "12px 16px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        flexWrap: "wrap",
        gap: "8px"
      }}>
        <div>
          <span style={{ color: "#10b981", fontWeight: "bold" }}>
            🎵 Sala: {roomId}
          </span>
          <span style={{ color: "#fbbf24", marginLeft: 12, fontSize: 14, fontWeight: "bold" }}>
            {roomCategory ? CATEGORIES[roomCategory as CategoryKey]?.name || roomCategory : "Sin categoría"}
          </span>
          <span style={{ color: "#6b7280", marginLeft: 12, fontSize: 13 }}>
            👥 {participants.length}
          </span>
          {isOwner && (
            <span style={{ color: "#fbbf24", marginLeft: 12, fontSize: 13 }}>
              👑 Dueño
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            onClick={toggleMute}
            style={{
              padding: "4px 12px",
              background: isMuted ? "#ef4444" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            {isMuted ? "🔇" : "🎤"}
          </button>
          <button
            onClick={toggleCamera}
            style={{
              padding: "4px 12px",
              background: isCameraOn ? "#10b981" : "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12
            }}
          >
            {isCameraOn ? "📹" : "📹 OFF"}
          </button>
          <button
            onClick={toggleMetronome}
            style={{
              padding: "4px 12px",
              background: isMetronomeOn ? "#fbbf24" : "rgba(255,255,255,0.05)",
              color: isMetronomeOn ? "black" : "#6b7280",
              border: isMetronomeOn ? "1px solid #fbbf24" : "1px solid rgba(255,255,255,0.1)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11
            }}
          >
            {isMetronomeOn ? `🎵 ${bpm} BPM` : "🎵 Metrónomo"}
          </button>
          {isOwner && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="range"
                min="40"
                max="200"
                step="1"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                style={{ width: 60, accentColor: "#10b981" }}
              />
            </div>
          )}
          <button
            onClick={leaveRoom}
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
            ✕ Salir
          </button>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: "16px",
        flex: 1
      }}>
        {/* Video principal */}
        <div>
          <div style={{
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
              color: "white",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              {myName} {isMuted ? "🔇" : "🎤"} {isCameraOn ? "📹" : ""}
              {isOwner && " 👑"}
              {speakingLevel[user?.id || 'local'] > 0.1 && " 🔊"}
            </div>
          </div>

          {/* Participantes en miniatura */}
          <div style={{
            display: "flex",
            gap: "8px",
            marginTop: "8px",
            overflowX: "auto",
            padding: "4px"
          }}>
            {participants.filter(p => p.id !== user?.id && p.id !== 'local').map((p) => {
              const level = speakingLevel[p.id] || 0
              const isSpeaking = level > 0.1
              return (
                <div key={p.id} style={{
                  minWidth: "120px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 6,
                  border: isSpeaking ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.05)",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <div style={{ fontSize: 28 }}>{getInstrumentEmoji(p.instrument)}</div>
                  <div style={{ fontSize: 11, color: "white" }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: "#6b7280" }}>{p.instrument}</div>
                  {isSpeaking && (
                    <div style={{ fontSize: 10, color: "#10b981" }}>🔊 Hablando</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Chat */}
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
            <span style={{ fontSize: 11, color: "#6b7280" }}>{participants.length} conectados</span>
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
          
          {/* Control de volumen master (solo dueño) */}
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
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  setMasterVolume(val)
                  if (channelRef.current) {
                    channelRef.current.send({
                      type: 'broadcast',
                      event: 'master-volume',
                      payload: { volume: val }
                    })
                  }
                }}
                style={{
                  flex: 1,
                  accentColor: "#10b981"
                }}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
        💡 Comparte el código <strong>{roomId}</strong> con otros músicos para ensayar juntos
      </div>
    </div>
  )
}
