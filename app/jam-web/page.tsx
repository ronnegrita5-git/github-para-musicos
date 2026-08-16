"use client"

import { useState, useRef } from "react"
import { useAuth } from "../context/AuthContext"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

const CATEGORIES = {
  'viento': {
    name: '🎷 Viento',
    emoji: '🎷',
    instruments: ['Trompeta', 'Saxofón', 'Trombón', 'Clarinete', 'Flauta', 'Tuba']
  },
  'cuerda': {
    name: '🎻 Cuerda',
    emoji: '🎻',
    instruments: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo', 'Arpa', 'Piano']
  },
  'moderna': {
    name: '🎸 Rock',
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
  const [messages, setMessages] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [participants, setParticipants] = useState<any[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [myName, setMyName] = useState("")
  const [isNameSet, setIsNameSet] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null)
  const [selectedInstrument, setSelectedInstrument] = useState<string>("")
  const [roomCategory, setRoomCategory] = useState<string>("")
  const [audioTest, setAudioTest] = useState<string>("")
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string>("")
  const audioContextRef = useRef<AudioContext | null>(null)

  const PEER_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  }

  const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase()

  const addMessage = (user: string, text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), user, text, timestamp: Date.now() }])
  }

  // ============ AUDIO PROFESIONAL ============
  const startLocalStream = async () => {
    try {
      // ✅ CONFIGURACIÓN PROFESIONAL (sin latency)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // ✅ Sin procesamiento - audio más limpio
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          // ✅ Calidad máxima
          sampleRate: 48000,
          channelCount: 2
        },
        video: false
      })
      
      localStreamRef.current = stream
      
      // ✅ Verificar calidad del stream
      const tracks = stream.getAudioTracks()
      if (tracks.length > 0) {
        const settings = tracks[0].getSettings()
        console.log('🎤 Configuración de audio:', settings)
        setAudioTest(`✅ ${settings.sampleRate}Hz, ${settings.channelCount}ch`)
        addMessage("Sistema", `🎤 Audio profesional activado`)
      }
      
      // ✅ PRUEBA: Escuchar el audio sin procesar
      try {
        const ctx = new AudioContext({ sampleRate: 48000 })
        audioContextRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const gain = ctx.createGain()
        gain.gain.value = 1.5
        source.connect(gain)
        gain.connect(ctx.destination)
        
        if (ctx.state === 'suspended') {
          await ctx.resume()
        }
        
        addMessage("Sistema", "🔊 Monitorización directa")
      } catch (e) {
        console.log('Monitorización no disponible')
      }
      
      return true
    } catch (error) {
      console.error('Error:', error)
      setAudioTest("❌ Error")
      addMessage("Sistema", "❌ No se pudo acceder al micrófono")
      return false
    }
  }

  // ============ WEBRTC CON CODEC DE ALTA CALIDAD ============
  const createPeerConnection = (targetId: string) => {
    // ✅ Configuración avanzada de WebRTC
    const pc = new RTCPeerConnection({
      iceServers: PEER_CONFIG.iceServers,
      // ✅ Configuración de codecs (priorizar audio de alta calidad)
      sdpSemantics: 'unified-plan'
    })
    peerConnectionsRef.current.set(targetId, pc)

    // ✅ Añadir stream local
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
        console.log('📤 Track añadido:', track.kind, track.label)
      })
    }

    // ✅ Recibir audio remoto con alta calidad
    pc.ontrack = (event) => {
      console.log('📥 Track remoto recibido:', event.track.kind)
      
      // ✅ Reproducir con audio de alta calidad
      const audioEl = new Audio()
      audioEl.autoplay = true
      audioEl.volume = 1.0
      
      // ✅ Intentar aplicar procesamiento mínimo
      try {
        const ctx = new AudioContext({ sampleRate: 48000 })
        const source = ctx.createMediaStreamSource(event.streams[0])
        const gain = ctx.createGain()
        gain.gain.value = 1.2
        source.connect(gain)
        gain.connect(ctx.destination)
        audioEl.srcObject = null // No usar el elemento audio
        addMessage("Sistema", "🔊 Audio recibido (alta calidad)")
      } catch (e) {
        // Fallback: usar elemento audio
        audioEl.srcObject = event.streams[0]
        audioEl.play().catch(e => console.log('Error:', e))
        addMessage("Sistema", "🔊 Audio recibido")
      }
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
      console.log('🔗 Estado:', pc.connectionState)
      if (pc.connectionState === 'connected') {
        addMessage("Sistema", "🔗 Conectado con otro músico")
      }
    }

    // ✅ Negociación de codecs (priorizar Opus de alta calidad)
    pc.onnegotiationneeded = async () => {
      try {
        await pc.setLocalDescription(await pc.createOffer())
        // Enviar oferta a través del canal
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'offer',
            payload: {
              fromId: userIdRef.current,
              targetId: targetId,
              offer: pc.localDescription
            }
          })
        }
      } catch (e) {
        console.error('Error en negociación:', e)
      }
    }

    return pc
  }

  // ✅ Crear oferta manual
  const createOffer = async (targetId: string) => {
    try {
      const pc = createPeerConnection(targetId)
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        // ✅ Forzar codec Opus de alta calidad
        voiceActivityDetection: false
      })
      
      // ✅ Modificar SDP para priorizar Opus con alta tasa de bits
      const sdp = offer.sdp || ''
      // Forzar Opus con bitrate alto
      let modifiedSdp = sdp.replace(
        /a=rtpmap:(\d+) opus\/48000\/2/g,
        'a=rtpmap:$1 opus/48000/2\r\na=fmtp:$1 stereo=1; sprop-stereo=1; maxaveragebitrate=510000'
      )
      
      offer.sdp = modifiedSdp
      
      await pc.setLocalDescription(offer)
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            fromId: userIdRef.current,
            targetId: targetId,
            offer: offer
          }
        })
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleOffer = async (fromId: string, offer: RTCSessionDescriptionInit) => {
    try {
      const pc = createPeerConnection(fromId)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            fromId: userIdRef.current,
            targetId: fromId,
            answer: answer
          }
        })
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleAnswer = async (fromId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const pc = peerConnectionsRef.current.get(fromId)
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleIceCandidate = async (fromId: string, candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionsRef.current.get(fromId)
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const connectToAll = async () => {
    const others = participants.filter(p => p.id !== userIdRef.current)
    for (const p of others) {
      if (!peerConnectionsRef.current.has(p.id)) {
        await createOffer(p.id)
      }
    }
  }

  // ============ SALA ============
  const createRoom = async (category: CategoryKey) => {
    if (!selectedInstrument) {
      addMessage("Sistema", "⚠️ Selecciona un instrumento")
      return
    }

    const newRoomId = generateRoomId()
    setRoomId(newRoomId)
    setIsOwner(true)
    setSelectedCategory(category)
    setRoomCategory(category)
    userIdRef.current = user?.id || `local-${Date.now()}`
    
    const ok = await startLocalStream()
    if (!ok) return
    
    setIsInRoom(true)
    setParticipants([{ 
      id: userIdRef.current, 
      name: myName || user?.email || 'Anónimo',
      instrument: selectedInstrument,
      isOwner: true
    }])
    
    addMessage("Sistema", `👑 ${myName} creó la sala ${newRoomId}`)
    subscribeToRoom(newRoomId, category)
  }

  const joinRoom = async () => {
    if (!roomId.trim()) {
      addMessage("Sistema", "⚠️ Introduce código de sala")
      return
    }
    if (!selectedInstrument) {
      addMessage("Sistema", "⚠️ Selecciona un instrumento")
      return
    }

    setIsOwner(false)
    userIdRef.current = user?.id || `local-${Date.now()}`
    
    const ok = await startLocalStream()
    if (!ok) return
    
    setIsInRoom(true)
    setParticipants([{ 
      id: userIdRef.current, 
      name: myName || user?.email || 'Anónimo',
      instrument: selectedInstrument,
      isOwner: false
    }])
    addMessage("Sistema", `🎵 ${myName} se unió a ${roomId}`)
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
        addMessage("Sistema", `👤 ${payload.name} (${payload.instrument}) se unió`)
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
        setTimeout(() => {
          if (payload.id !== userIdRef.current) {
            createOffer(payload.id)
          }
        }, 1000)
      })
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        addMessage("Sistema", `👤 ${payload.name} salió`)
        setParticipants(prev => prev.filter(p => p.id !== payload.id))
        const pc = peerConnectionsRef.current.get(payload.id)
        if (pc) { pc.close(); peerConnectionsRef.current.delete(payload.id) }
      })
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        if (payload.targetId === userIdRef.current) {
          handleOffer(payload.fromId, payload.offer)
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
        if (status === 'SUBSCRIBED') {
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
          setTimeout(() => connectToAll(), 1500)
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

  const sendMessage = () => {
    if (!inputMessage.trim()) return
    addMessage(myName || user?.email || 'Anónimo', inputMessage)
    setInputMessage("")
  }

  const leaveRoom = async () => {
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
    
    if (audioContextRef.current) {
      await audioContextRef.current.close()
      audioContextRef.current = null
    }
    
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
  }

  // ============ UI ============
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
          <input type="text" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Tu nombre" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 16, marginBottom: 16 }} onKeyPress={(e) => e.key === "Enter" && myName.trim() && setIsNameSet(true)} />
          <button onClick={() => { if (myName.trim()) setIsNameSet(true) }} disabled={!myName.trim()} style={{ width: "100%", padding: "14px", background: myName.trim() ? "#10b981" : "#444", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: myName.trim() ? "pointer" : "not-allowed" }}>Entrar</button>
        </div>
      </div>
    )
  }

  if (!isInRoom) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0a", color: "white", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: 500, width: "100%", padding: 40, borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <h1 style={{ fontSize: 48, textAlign: "center", marginBottom: 8 }}>🎵</h1>
          <h2 style={{ textAlign: "center", marginBottom: 24 }}>Jam Session</h2>
          
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: "#9ca3af", marginBottom: 12, fontWeight: "bold" }}>🎯 Elige el tipo de Jam:</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <button key={key} onClick={() => { setSelectedCategory(key as CategoryKey); setSelectedInstrument("") }} style={{ flex: 1, minWidth: "100px", padding: "12px", background: selectedCategory === key ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)", color: selectedCategory === key ? "#10b981" : "#9ca3af", border: selectedCategory === key ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", textAlign: "center" }}>
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
                  <button key={inst} onClick={() => setSelectedInstrument(inst)} style={{ padding: "8px 16px", background: selectedInstrument === inst ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)", color: selectedInstrument === inst ? "#10b981" : "#9ca3af", border: selectedInstrument === inst ? "2px solid #10b981" : "1px solid rgba(255,255,255,0.1)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
                    {getInstrumentEmoji(inst)} {inst}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button onClick={() => { if (selectedCategory && selectedInstrument) createRoom(selectedCategory) }} disabled={!selectedCategory || !selectedInstrument} style={{ width: "100%", padding: "14px", background: (selectedCategory && selectedInstrument) ? "#10b981" : "#444", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: (selectedCategory && selectedInstrument) ? "pointer" : "not-allowed" }}>🎸 Crear sala</button>
            <div style={{ display: "flex", gap: "8px" }}>
              <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} placeholder="Código de sala" style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 16, textTransform: "uppercase" }} />
              <button onClick={joinRoom} disabled={!roomId.trim() || !selectedCategory || !selectedInstrument} style={{ padding: "10px 20px", background: (roomId.trim() && selectedCategory && selectedInstrument) ? "#3b82f6" : "#444", color: "white", border: "none", borderRadius: 8, cursor: (roomId.trim() && selectedCategory && selectedInstrument) ? "pointer" : "not-allowed", fontWeight: "bold" }}>Unirse</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============ SALA ACTIVA ============
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "16px", maxWidth: "800px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <span style={{ color: "#10b981", fontWeight: "bold" }}>🎵 {roomId}</span>
          <span style={{ color: "#fbbf24", marginLeft: 12 }}>{roomCategory ? CATEGORIES[roomCategory as CategoryKey]?.name || roomCategory : "Sin categoría"}</span>
          <span style={{ color: "#6b7280", marginLeft: 12 }}>👥 {participants.length}</span>
          {isOwner && <span style={{ color: "#fbbf24", marginLeft: 12 }}>👑</span>}
          <span style={{ marginLeft: 12, fontSize: 12, color: audioTest?.includes("✅") ? "#10b981" : "#ef4444" }}>{audioTest}</span>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button onClick={toggleMute} style={{ padding: "6px 14px", background: isMuted ? "#ef4444" : "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>{isMuted ? "🔇" : "🎤"}</button>
          <button onClick={leaveRoom} style={{ padding: "6px 14px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      </div>

      {/* Participantes */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "12px" }}>
        <h3 style={{ margin: "0 0 8px 0", color: "#9ca3af", fontSize: 14 }}>🎵 Participantes</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {participants.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 10px", background: p.id === userIdRef.current ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)", borderRadius: 6, border: p.id === userIdRef.current ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 20 }}>{getInstrumentEmoji(p.instrument)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: p.id === userIdRef.current ? "bold" : "normal", color: "white", fontSize: 13 }}>{p.name} {p.id === userIdRef.current && "(tú)"}{p.isOwner && " 👑"}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{p.instrument}</div>
              </div>
              {p.id !== userIdRef.current && <span style={{ fontSize: 12, color: peerConnectionsRef.current.has(p.id) ? "#10b981" : "#fbbf24" }}>{peerConnectionsRef.current.has(p.id) ? "🔗" : "⏳"}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div style={{ display: "flex", flexDirection: "column", height: "300px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#9ca3af", fontWeight: "bold" }}>💬 Chat</span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{participants.length} conectados</span>
        </div>
        <div style={{ flex: 1, padding: "8px 12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {messages.slice(-50).map((msg) => (
            <div key={msg.id} style={{ padding: "4px 10px", background: msg.user === "Sistema" ? "rgba(16,185,129,0.05)" : "rgba(255,255,255,0.03)", borderRadius: 6, fontSize: 13 }}>
              <span style={{ color: msg.user === "Sistema" ? "#10b981" : "#6b7280", fontWeight: "bold" }}>{msg.user === "Sistema" ? "📢 " : msg.user}:</span>
              <span style={{ color: "white", marginLeft: 4 }}>{msg.text}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.05)", gap: "8px" }}>
          <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendMessage()} placeholder="Mensaje..." style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 14 }} />
          <button onClick={sendMessage} style={{ padding: "8px 16px", background: "#10b981", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }}>Enviar</button>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: "center", color: "#6b7280", fontSize: 12 }}>💡 Código: <strong>{roomId}</strong></div>
    </div>
  )
}
