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
  instrument: string
  isOwner: boolean
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
    'Trompeta': '🎺', 'Saxofón': '🎷', 'Trombón': '🎺',
    'Clarinete': '🎵', 'Flauta': '🎵', 'Tuba': '🎵',
    'Violín': '🎻', 'Viola': '🎻', 'Violonchelo': '🎻',
    'Contrabajo': '🎻', 'Arpa': '🎵', 'Piano': '🎹',
    'Guitarra': '🎸', 'Bajo': '🎸', 'Batería': '🥁',
    'Teclado': '🎹', 'Voz': '🎤', 'Sintetizador': '🎹'
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
  const [myName, setMyName] = useState("")
  const [isNameSet, setIsNameSet] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null)
  const [selectedInstrument, setSelectedInstrument] = useState<string>("")
  const [roomCategory, setRoomCategory] = useState<string>("")
  const [audioTest, setAudioTest] = useState<string>("")
  const [peerStatus, setPeerStatus] = useState<Record<string, string>>({})
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<any>(null)
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const userIdRef = useRef<string>("")

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const PEER_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }

  const setUsername = () => {
    if (myName.trim()) {
      setIsNameSet(true)
      addMessage("Sistema", `👤 ${myName} se ha unido`)
    }
  }

  // ✅ Iniciar stream local
  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      })
      
      localStreamRef.current = stream
      const audioTracks = stream.getAudioTracks()
      
      if (audioTracks.length === 0) {
        setAudioTest("❌ No hay tracks de audio")
        return
      }
      
      setAudioTest("✅ Micrófono conectado")
      addMessage("Sistema", "🎤 Micrófono conectado")
      
    } catch (error) {
      console.error('Error al acceder al micrófono:', error)
      setAudioTest("❌ Error: No se pudo acceder al micrófono")
      addMessage("Sistema", "❌ No se pudo acceder al micrófono")
    }
  }

  // ✅ Crear conexión peer
  const createPeerConnection = (targetId: string, targetName: string) => {
    const pc = new RTCPeerConnection(PEER_CONFIG)
    peerConnectionsRef.current.set(targetId, pc)

    // ✅ Añadir stream local
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    // ✅ Recibir audio remoto
    pc.ontrack = (event) => {
      console.log(`📥 Audio recibido de ${targetName}`)
      
      let audioEl = audioElementsRef.current.get(targetId)
      if (!audioEl) {
        audioEl = new Audio()
        audioEl.autoplay = true
        audioEl.volume = 0.8
        audioElementsRef.current.set(targetId, audioEl)
      }
      audioEl.srcObject = event.streams[0]
      audioEl.play().catch(e => console.log('Error playing audio:', e))
      
      setPeerStatus(prev => ({
        ...prev,
        [targetId]: '✅ Audio recibido'
      }))
    }

    // ✅ ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            fromId: userIdRef.current,
            targetId: targetId,
            candidate: event.candidate
          }
        })
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`🔗 Conexión con ${targetName}: ${pc.connectionState}`)
      setPeerStatus(prev => ({
        ...prev,
        [targetId]: pc.connectionState === 'connected' ? '✅ Conectado' : `⏳ ${pc.connectionState}`
      }))
    }

    return pc
  }

  // ✅ Crear oferta
  const createOffer = async (targetId: string, targetName: string) => {
    try {
      console.log(`📤 Creando oferta para ${targetName}`)
      const pc = createPeerConnection(targetId, targetName)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            fromId: userIdRef.current,
            fromName: myName,
            targetId: targetId,
            offer: offer
          }
        })
      }
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }

  // ✅ Manejar oferta
  const handleOffer = async (fromId: string, fromName: string, offer: RTCSessionDescriptionInit) => {
    try {
      console.log(`📥 Oferta recibida de ${fromName}`)
      const pc = createPeerConnection(fromId, fromName)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            fromId: userIdRef.current,
            fromName: myName,
            targetId: fromId,
            answer: answer
          }
        })
      }
    } catch (error) {
      console.error('Error handling offer:', error)
    }
  }

  // ✅ Manejar respuesta
  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnectionsRef.current.get(fromId)
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        console.log(`📥 Respuesta procesada de ${fromId}`)
      }
    } catch (error) {
      console.error('Error handling answer:', error)
    }
  }

  // ✅ Manejar ICE candidate
  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionsRef.current.get(fromId)
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
    }
  }

  // ✅ Conectar con todos los participantes
  const connectToAll = async () => {
    const others = participants.filter(p => p.id !== userIdRef.current)
    
    for (const p of others) {
      if (!peerConnectionsRef.current.has(p.id)) {
        console.log(`🔗 Conectando con ${p.name} (${p.id})`)
        await createOffer(p.id, p.name)
      }
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
    
    userIdRef.current = user?.id || `local-${Date.now()}`
    
    await startLocalStream()
    setIsInRoom(true)
    
    setParticipants([{ 
      id: userIdRef.current, 
      name: myName || user?.email || 'Anónimo',
      instrument: selectedInstrument,
      isOwner: true
    }])
    
    addMessage("Sistema", `👑 ${myName} ha creado la sala ${newRoomId}`)
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
    userIdRef.current = user?.id || `local-${Date.now()}`
    
    await startLocalStream()
    setIsInRoom(true)
    setParticipants([{ 
      id: userIdRef.current, 
      name: myName || user?.email || 'Anónimo',
      instrument: selectedInstrument,
      isOwner: false
    }])
    addMessage("Sistema", `🎵 ${myName} se ha unido a la sala ${roomId}`)
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
        addMessage("Sistema", `👤 ${payload.name} (${payload.instrument}) se ha unido`)
        setParticipants(prev => {
          if (!prev.find(p => p.id === payload.id)) {
            return [...prev, { 
              id: payload.id, 
              name: payload.name, 
              instrument: payload.instrument || 'Sin instrumento',
              isOwner: payload.isOwner || false
            }]
          }
          return prev
        })
        
        // ✅ Conectar con el nuevo usuario
        setTimeout(() => {
          if (payload.id !== userIdRef.current) {
            createOffer(payload.id, payload.name)
          }
        }, 1000)
      })
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        addMessage("Sistema", `👤 ${payload.name} ha salido`)
        setParticipants(prev => prev.filter(p => p.id !== payload.id))
        
        const pc = peerConnectionsRef.current.get(payload.id)
        if (pc) { pc.close(); peerConnectionsRef.current.delete(payload.id) }
        const audio = audioElementsRef.current.get(payload.id)
        if (audio) { audio.pause(); audio.srcObject = null; audioElementsRef.current.delete(payload.id) }
        setPeerStatus(prev => { const newStatus = {...prev}; delete newStatus[payload.id]; return newStatus })
      })
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        if (payload.targetId === userIdRef.current) {
          handleOffer(payload.fromId, payload.fromName, payload.offer)
        }
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        if (payload.targetId === userIdRef.current) {
          handleAnswer(payload.fromId, payload.answer)
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
        if (payload.targetId === userIdRef.current) {
          handleIceCandidate(payload.fromId, payload.candidate)
        }
      })
      .subscribe((status) => {
        console.log('🔊 Canal:', status)
        if (status === 'SUBSCRIBED') {
          // ✅ Anunciar presencia
          channel.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: { 
              id: userIdRef.current, 
              name: myName || 'Anónimo',
              instrument: selectedInstrument,
              isOwner: isOwner
            }
          })
          
          // ✅ Conectar con participantes existentes
          setTimeout(() => {
            connectToAll()
          }, 1500)
        }
      })
  }

  const toggleMute = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0]
      if (track) {
        track.enabled = !track.enabled
        setIsMuted(!isMuted)
        addMessage("Sistema", isMuted ? "🎤 Micrófono activado" : "🔇 Micrófono desactivado")
      }
    }
  }

  const addMessage = (user: string, text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), user, text, timestamp: Date.now() }])
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
        payload: { id: userIdRef.current, name: myName || 'Anónimo' }
      })
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    
    peerConnectionsRef.current.forEach(pc => pc.close())
    peerConnectionsRef.current.clear()
    audioElementsRef.current.forEach(audio => { audio.pause(); audio.srcObject = null })
    audioElementsRef.current.clear()
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    
    setIsInRoom(false)
    setRoomId("")
    setParticipants([])
    setMessages([])
    setIsMuted(false)
    setIsOwner(false)
    setSelectedCategory(null)
    setSelectedInstrument("")
    setRoomCategory("")
    setAudioTest("")
    setPeerStatus({})
  }

  if (!user) {
    return (
      <div style={{ padding: 40, color: "white", textAlign: "center" }}>
        <p>🔒 Debes iniciar sesión</p>
        <Link href="/login" style={{ color: "#10b981" }}>Iniciar sesión</Link>
      </div>
    )
  }

  if (!isNameSet) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: 400, width: "100%", padding: 40, borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
          <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎵</h1>
          <h2 style={{ marginBottom: 24 }}>Jam Session</h2>
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="Tu nombre"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 16, marginBottom: 16 }}
            onKeyPress={(e) => e.key === "Enter" && setUsername()}
          />
          <button onClick={setUsername} disabled={!myName.trim()} style={{ width: "100%", padding: "14px", background: myName.trim() ? "#10b981" : "#444", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: myName.trim() ? "pointer" : "not-allowed" }}>
            Entrar
          </button>
        </div>
      </div>
    )
  }

  if (!isInRoom) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: 600, width: "100%", padding: 40, borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h1 style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🎵</h1>
          <h2 style={{ textAlign: "center", marginBottom: 24 }}>Jam Session</h2>
          
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: "#9ca3af", marginBottom: 12, fontWeight: "bold" }}>🎯 Elige el tipo de Jam:</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <button key={key} onClick={() => { setSelectedCategory(key as CategoryKey); setSelectedInstrument("") }} style={{ flex: 1, minWidth: "120px", padding: "12px 16px", background: selectedCategory === key ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)", color: selectedCategory === key ? "#10b981" : "#9ca3af", border: selectedCategory === key ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", textAlign: "center" }}>
                  <div style={{ fontSize: 28 }}>{cat.emoji}</div>
                  <div style={{ fontSize: 13 }}>{cat.name}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedCategory && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: "#9ca3af", marginBottom: 12, fontWeight: "bold" }}>🎸 Elige tu instrumento:</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {CATEGORIES[selectedCategory].instruments.map((inst) => (
                  <button key={inst} onClick={() => setSelectedInstrument(inst)} style={{ padding: "8px 16px", background: selectedInstrument === inst ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)", color: selectedInstrument === inst ? "#10b981" : "#9ca3af", border: selectedInstrument === inst ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                    {getInstrumentEmoji(inst)} {inst}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button onClick={() => { if (selectedCategory && selectedInstrument) createRoom(selectedCategory) else addMessage("Sistema", "⚠️ Selecciona categoría e instrumento") }} disabled={!selectedCategory || !selectedInstrument} style={{ width: "100%", padding: "14px", background: (selectedCategory && selectedInstrument) ? "#10b981" : "#444", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: (selectedCategory && selectedInstrument) ? "pointer" : "not-allowed" }}>
              🎸 Crear sala
            </button>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="Código de sala" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 16, textTransform: "uppercase" }} />
              <button onClick={joinRoom} disabled={!roomId.trim() || !selectedCategory || !selectedInstrument} style={{ padding: "10px 20px", background: (roomId.trim() && selectedCategory && selectedInstrument) ? "#3b82f6" : "#444", color: "white", border: "none", borderRadius: 8, cursor: (roomId.trim() && selectedCategory && selectedInstrument) ? "pointer" : "not-allowed", fontWeight: "bold" }}>
                Unirse
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "16px", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <span style={{ color: "#10b981", fontWeight: "bold" }}>🎵 Sala: {roomId}</span>
          <span style={{ color: "#fbbf24", marginLeft: 12, fontSize: 14, fontWeight: "bold" }}>{roomCategory ? CATEGORIES[roomCategory as CategoryKey]?.name || roomCategory : "Sin categoría"}</span>
          <span style={{ color: "#6b7280", marginLeft: 12, fontSize: 13 }}>👥 {participants.length}</span>
          {isOwner && <span style={{ color: "#fbbf24", marginLeft: 12, fontSize: 13 }}>👑 Dueño</span>}
          {audioTest && <span style={{ marginLeft: 12, fontSize: 12, color: audioTest.includes("✅") ? "#10b981" : "#ef4444" }}>{audioTest}</span>}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button onClick={toggleMute} style={{ padding: "4px 12px", background: isMuted ? "#ef4444" : "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>{isMuted ? "🔇" : "🎤"}</button>
          <button onClick={leaveRoom} style={{ padding: "4px 12px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>✕ Salir</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", flex: 1 }}>
        <div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "16px", border: "1px solid rgba(255,255,255,0.05)", minHeight: "200px" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#9ca3af", fontSize: 14 }}>🎵 Participantes</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {participants.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", background: p.id === userIdRef.current ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)", borderRadius: 6, border: p.id === userIdRef.current ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 24 }}>{getInstrumentEmoji(p.instrument)}</span>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: p.id === userIdRef.current ? "bold" : "normal", color: "white" }}>{p.name} {p.id === userIdRef.current && "(tú)"}{p.isOwner && " 👑"}</div><div style={{ fontSize: 12, color: "#6b7280" }}>{p.instrument}</div></div>
                  {p.id !== userIdRef.current && <span style={{ fontSize: 11, color: peerStatus[p.id]?.includes('✅') ? "#10b981" : "#fbbf24" }}>{peerStatus[p.id] || "⏳ Conectando..."}</span>}
                </div>
              ))}
            </div>
          </div>
          
          <div style={{ marginTop: "12px", padding: "12px 16px", background: "rgba(16,185,129,0.05)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.1)" }}>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>🎧 <strong>Usa cascos</strong> para evitar feedback.</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", height: "400px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#9ca3af", fontWeight: "bold" }}>💬 Chat</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{participants.length} conectados</span>
          </div>
          <div style={{ flex: 1, padding: "12px 16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ padding: "4px 12px", background: msg.user === "Sistema" ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 14 }}>
                <span style={{ color: msg.user === "Sistema" ? "#10b981" : "#6b7280", fontWeight: "bold" }}>{msg.user === "Sistema" ? "📢 " : msg.user}:</span>
                <span style={{ color: "white", marginLeft: 4 }}>{msg.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", gap: "8px" }}>
            <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} placeholder="Escribe un mensaje..." style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 14 }} />
            <button onClick={sendMessage} style={{ padding: "8px 16px", background: "#10b981", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>Enviar</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: "center", color: "#6b7280", fontSize: 12 }}>💡 Comparte el código <strong>{roomId}</strong> con otros músicos</div>
    </div>
  )
}
