"use client"

import { useState, useRef, useEffect } from "react"
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

// ✅ COMPONENTE DE EFECTOS DE AUDIO
function AudioEffects({ stream }: { stream: MediaStream | null }) {
  const [compressor, setCompressor] = useState({
    threshold: -24,
    ratio: 12,
    attack: 0.003,
    release: 0.25,
    gain: 6
  })
  
  const [eq, setEq] = useState({
    bass: 6,
    mid: 0,
    treble: 3
  })
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const compressorRef = useRef<any>(null)
  const eqRefs = useRef<any[]>([])
  const isConnectedRef = useRef(false)

  useEffect(() => {
    if (!stream) return
    
    const setupAudio = async () => {
      try {
        // Cerrar contexto anterior si existe
        if (audioContextRef.current) {
          await audioContextRef.current.close()
          audioContextRef.current = null
          isConnectedRef.current = false
        }
        
        const ctx = new AudioContext()
        audioContextRef.current = ctx
        
        const source = ctx.createMediaStreamSource(stream)
        
        // ✅ COMPRESOR
        const comp = ctx.createDynamicsCompressor()
        comp.threshold.value = compressor.threshold
        comp.ratio.value = compressor.ratio
        comp.attack.value = compressor.attack
        comp.release.value = compressor.release
        compressorRef.current = comp
        
        // ✅ EQ: Bass (lowshelf)
        const bass = ctx.createBiquadFilter()
        bass.type = 'lowshelf'
        bass.frequency.value = 200
        bass.gain.value = eq.bass
        
        // ✅ EQ: Mid (peaking)
        const mid = ctx.createBiquadFilter()
        mid.type = 'peaking'
        mid.frequency.value = 1000
        mid.Q.value = 1
        mid.gain.value = eq.mid
        
        // ✅ EQ: Treble (highshelf)
        const treble = ctx.createBiquadFilter()
        treble.type = 'highshelf'
        treble.frequency.value = 5000
        treble.gain.value = eq.treble
        
        eqRefs.current = [bass, mid, treble]
        
        // ✅ Conectar: source → EQ → compressor → destination
        source.connect(bass)
        bass.connect(mid)
        mid.connect(treble)
        treble.connect(comp)
        comp.connect(ctx.destination)
        
        isConnectedRef.current = true
        
        if (ctx.state === 'suspended') {
          await ctx.resume()
        }
        
        console.log('🎛️ Efectos de audio activados')
      } catch (error) {
        console.error('Error al configurar efectos:', error)
      }
    }
    
    setupAudio()
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
        isConnectedRef.current = false
      }
    }
  }, [stream])

  // ✅ Actualizar compresor en tiempo real
  useEffect(() => {
    if (compressorRef.current && isConnectedRef.current) {
      compressorRef.current.threshold.value = compressor.threshold
      compressorRef.current.ratio.value = compressor.ratio
      compressorRef.current.attack.value = compressor.attack
      compressorRef.current.release.value = compressor.release
    }
  }, [compressor])

  // ✅ Actualizar EQ en tiempo real
  useEffect(() => {
    if (eqRefs.current.length === 3 && isConnectedRef.current) {
      eqRefs.current[0].gain.value = eq.bass
      eqRefs.current[1].gain.value = eq.mid
      eqRefs.current[2].gain.value = eq.treble
    }
  }, [eq])

  if (!stream) return null

  return (
    <div style={{
      padding: '12px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.05)',
      marginTop: '8px'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#10b981', fontSize: 13 }}>
        🎛️ Efectos de Audio
      </h4>
      
      {/* EQ */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: '80px' }}>
          <label style={{ fontSize: 11, color: '#6b7280' }}>🔊 Bass</label>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={eq.bass}
            onChange={(e) => setEq(prev => ({ ...prev, bass: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{eq.bass}dB</span>
        </div>
        <div style={{ flex: 1, minWidth: '80px' }}>
          <label style={{ fontSize: 11, color: '#6b7280' }}>🎵 Mid</label>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={eq.mid}
            onChange={(e) => setEq(prev => ({ ...prev, mid: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{eq.mid}dB</span>
        </div>
        <div style={{ flex: 1, minWidth: '80px' }}>
          <label style={{ fontSize: 11, color: '#6b7280' }}>🔊 Treble</label>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={eq.treble}
            onChange={(e) => setEq(prev => ({ ...prev, treble: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{eq.treble}dB</span>
        </div>
      </div>
      
      {/* Compresor */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '60px' }}>
          <label style={{ fontSize: 10, color: '#6b7280' }}>Threshold</label>
          <input
            type="range"
            min="-40"
            max="0"
            step="1"
            value={compressor.threshold}
            onChange={(e) => setCompressor(prev => ({ ...prev, threshold: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{compressor.threshold}dB</span>
        </div>
        <div style={{ flex: 1, minWidth: '60px' }}>
          <label style={{ fontSize: 10, color: '#6b7280' }}>Ratio</label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={compressor.ratio}
            onChange={(e) => setCompressor(prev => ({ ...prev, ratio: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{compressor.ratio}:1</span>
        </div>
        <div style={{ flex: 1, minWidth: '60px' }}>
          <label style={{ fontSize: 10, color: '#6b7280' }}>Gain</label>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={compressor.gain}
            onChange={(e) => setCompressor(prev => ({ ...prev, gain: Number(e.target.value) }))}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{compressor.gain}dB</span>
        </div>
      </div>
    </div>
  )
}

// ============ COMPONENTE PRINCIPAL ============
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
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [monitorVolume, setMonitorVolume] = useState(1.0)
  
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string>("")
  const audioContextRef = useRef<AudioContext | null>(null)
  const monitorGainRef = useRef<GainNode | null>(null)

  const PEER_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }

  const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase()

  const addMessage = (user: string, text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), user, text, timestamp: Date.now() }])
  }

  // ============ AUDIO CON EFECTOS ============
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
      
      // ✅ Activar monitorización
      await enableMonitoring(stream)
      
      const tracks = stream.getAudioTracks()
      if (tracks.length > 0) {
        const settings = tracks[0].getSettings()
        setAudioTest(`✅ ${settings.sampleRate || 48}kHz`)
      }
      
      addMessage("Sistema", "🎤 Micrófono conectado")
      return true
    } catch (error) {
      console.error('Error:', error)
      setAudioTest("❌ Error")
      addMessage("Sistema", "❌ No se pudo acceder al micrófono")
      return false
    }
  }

  // ✅ MONITORIZACIÓN CON GANANCIA
  const enableMonitoring = async (stream: MediaStream) => {
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
      }
      
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      
      const source = ctx.createMediaStreamSource(stream)
      
      const gain = ctx.createGain()
      gain.gain.value = monitorVolume
      monitorGainRef.current = gain
      
      source.connect(gain)
      gain.connect(ctx.destination)
      
      setIsMonitoring(true)
      
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
      
      addMessage("Sistema", `🔊 Monitorización (${Math.round(monitorVolume * 100)}%)`)
    } catch (error) {
      console.error('Error en monitorización:', error)
    }
  }

  const disableMonitoring = async () => {
    try {
      if (audioContextRef.current) {
        await audioContextRef.current.close()
        audioContextRef.current = null
        monitorGainRef.current = null
        setIsMonitoring(false)
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const updateMonitorVolume = (value: number) => {
    const newVolume = Math.max(0, Math.min(2, value))
    setMonitorVolume(newVolume)
    if (monitorGainRef.current) {
      monitorGainRef.current.gain.value = newVolume
    }
  }

  const toggleMonitoring = async () => {
    if (isMonitoring) {
      await disableMonitoring()
    } else {
      if (localStreamRef.current) {
        await enableMonitoring(localStreamRef.current)
      }
    }
  }

  // ============ WEBRTC ============
  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection(PEER_CONFIG)
    peerConnectionsRef.current.set(targetId, pc)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    pc.ontrack = (event) => {
      const audioEl = new Audio()
      audioEl.autoplay = true
      audioEl.volume = 1.0
      audioEl.srcObject = event.streams[0]
      audioEl.play().catch(e => console.log('Error:', e))
      addMessage("Sistema", "🔊 Audio recibido")
    }

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
      if (pc.connectionState === 'connected') {
        addMessage("Sistema", "🔗 Conectado con otro músico")
      }
    }

    return pc
  }

  const createOffer = async (targetId: string) => {
    try {
      const pc = createPeerConnection(targetId)
      const offer = await pc.createOffer()
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
    await disableMonitoring()
    
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
          {isMonitoring && <span style={{ marginLeft: 12, fontSize: 12, color: "#10b981" }}>🔊 {Math.round(monitorVolume * 100)}%</span>}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button onClick={toggleMute} style={{ padding: "6px 14px", background: isMuted ? "#ef4444" : "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>{isMuted ? "🔇" : "🎤"}</button>
          <button onClick={toggleMonitoring} style={{ padding: "6px 14px", background: isMonitoring ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)", color: isMonitoring ? "#10b981" : "#6b7280", border: isMonitoring ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>{isMonitoring ? "🔊" : "🔇"}</button>
          {isMonitoring && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input type="range" min="0" max="2" step="0.01" value={monitorVolume} onChange={(e) => updateMonitorVolume(parseFloat(e.target.value))} style={{ width: 100, accentColor: "#10b981" }} />
              <span style={{ fontSize: 11, color: "#6b7280", minWidth: 35 }}>{Math.round(monitorVolume * 100)}%</span>
            </div>
          )}
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

      {/* ✅ EFECTOS DE AUDIO */}
      {localStreamRef.current && (
        <AudioEffects stream={localStreamRef.current} />
      )}

      {/* Chat */}
      <div style={{ display: "flex", flexDirection: "column", height: "300px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden", marginTop: "8px" }}>
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
