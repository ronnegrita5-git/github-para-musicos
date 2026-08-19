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

// ============ VISUALIZADOR DE VOLUMEN ============
function VolumeIndicator({ stream, label }: { stream: MediaStream | null, label?: string }) {
  const [volume, setVolume] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number>()
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!stream) return

    const initAudio = async () => {
      try {
        const ctx = new AudioContext()
        audioContextRef.current = ctx
        const analyser = ctx.createAnalyser()
        const source = ctx.createMediaStreamSource(stream)
        source.connect(analyser)
        analyser.fftSize = 256
        analyserRef.current = analyser

        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const updateVolume = () => {
          if (!analyserRef.current) return
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          setVolume(average / 255)
          animationRef.current = requestAnimationFrame(updateVolume)
        }
        updateVolume()
      } catch (e) {
        console.log('Error en visualizador:', e)
      }
    }

    initAudio()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [stream])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 20 }}>
        {[...Array(15)].map((_, i) => {
          const height = Math.max(2, volume * 25 * (i / 15 + 0.15))
          const isActive = volume > 0.05
          return (
            <div
              key={i}
              style={{
                width: 3,
                height: Math.min(height, 20),
                background: isActive ? '#10b981' : 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                transition: 'height 0.08s ease'
              }}
            />
          )
        })}
      </div>
      {label && (
        <span style={{ fontSize: 10, color: volume > 0.05 ? '#10b981' : '#6b7280' }}>
          {volume > 0.05 ? '🔊' : '🔇'}
        </span>
      )}
    </div>
  )
}

// ============ EFECTOS DE AUDIO ============
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
        if (audioContextRef.current) {
          await audioContextRef.current.close()
          audioContextRef.current = null
          isConnectedRef.current = false
        }
        
        const ctx = new AudioContext()
        audioContextRef.current = ctx
        
        const source = ctx.createMediaStreamSource(stream)
        
        const comp = ctx.createDynamicsCompressor()
        comp.threshold.value = compressor.threshold
        comp.ratio.value = compressor.ratio
        comp.attack.value = compressor.attack
        comp.release.value = compressor.release
        compressorRef.current = comp
        
        const bass = ctx.createBiquadFilter()
        bass.type = 'lowshelf'
        bass.frequency.value = 200
        bass.gain.value = eq.bass
        
        const mid = ctx.createBiquadFilter()
        mid.type = 'peaking'
        mid.frequency.value = 1000
        mid.Q.value = 1
        mid.gain.value = eq.mid
        
        const treble = ctx.createBiquadFilter()
        treble.type = 'highshelf'
        treble.frequency.value = 5000
        treble.gain.value = eq.treble
        
        eqRefs.current = [bass, mid, treble]
        
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

  useEffect(() => {
    if (compressorRef.current && isConnectedRef.current) {
      compressorRef.current.threshold.value = compressor.threshold
      compressorRef.current.ratio.value = compressor.ratio
      compressorRef.current.attack.value = compressor.attack
      compressorRef.current.release.value = compressor.release
    }
  }, [compressor])

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
      
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: '80px' }}>
          <label style={{ fontSize: 11, color: '#6b7280' }}>🔊 Bass</label>
          <input type="range" min="-12" max="12" step="1" value={eq.bass} onChange={(e) => setEq(prev => ({ ...prev, bass: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#10b981' }} />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{eq.bass}dB</span>
        </div>
        <div style={{ flex: 1, minWidth: '80px' }}>
          <label style={{ fontSize: 11, color: '#6b7280' }}>🎵 Mid</label>
          <input type="range" min="-12" max="12" step="1" value={eq.mid} onChange={(e) => setEq(prev => ({ ...prev, mid: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#10b981' }} />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{eq.mid}dB</span>
        </div>
        <div style={{ flex: 1, minWidth: '80px' }}>
          <label style={{ fontSize: 11, color: '#6b7280' }}>🔊 Treble</label>
          <input type="range" min="-12" max="12" step="1" value={eq.treble} onChange={(e) => setEq(prev => ({ ...prev, treble: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#10b981' }} />
          <span style={{ fontSize: 10, color: '#6b7280' }}>{eq.treble}dB</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '60px' }}>
          <label style={{ fontSize: 10, color: '#6b7280' }}>Threshold</label>
          <input type="range" min="-40" max="0" step="1" value={compressor.threshold} onChange={(e) => setCompressor(prev => ({ ...prev, threshold: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#10b981' }} />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{compressor.threshold}dB</span>
        </div>
        <div style={{ flex: 1, minWidth: '60px' }}>
          <label style={{ fontSize: 10, color: '#6b7280' }}>Ratio</label>
          <input type="range" min="1" max="20" step="0.5" value={compressor.ratio} onChange={(e) => setCompressor(prev => ({ ...prev, ratio: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#10b981' }} />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{compressor.ratio}:1</span>
        </div>
        <div style={{ flex: 1, minWidth: '60px' }}>
          <label style={{ fontSize: 10, color: '#6b7280' }}>Gain</label>
          <input type="range" min="0" max="20" step="1" value={compressor.gain} onChange={(e) => setCompressor(prev => ({ ...prev, gain: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#10b981' }} />
          <span style={{ fontSize: 9, color: '#6b7280' }}>{compressor.gain}dB</span>
        </div>
      </div>
    </div>
  )
}

// ============ COMPONENTE PRINCIPAL ============
export default function JamWebPage() {
  const { user } = useAuth()
  
  // Estado de usuario
  const [myName, setMyName] = useState("")
  const [isNameSet, setIsNameSet] = useState(false)
  
  // Estado de la sala
  const [roomId, setRoomId] = useState("")
  const [isInRoom, setIsInRoom] = useState(false)
  const [roomName, setRoomName] = useState("")
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null)
  const [selectedInstrument, setSelectedInstrument] = useState<string>("")
  const [roomCategory, setRoomCategory] = useState<string>("")
  const [isListener, setIsListener] = useState(false)
  
  // Estado de la Jam
  const [messages, setMessages] = useState<any[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [participants, setParticipants] = useState<any[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [audioTest, setAudioTest] = useState<string>("")
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [monitorVolume, setMonitorVolume] = useState(1.0)
  const [view, setView] = useState<'browse' | 'room'>('browse')
  const [publicSessions, setPublicSessions] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [showRequests, setShowRequests] = useState(false)
  const [inactivityWarning, setInactivityWarning] = useState(false)
  
  // Refs
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<any>(null)
  const userIdRef = useRef<string>("")
  const audioContextRef = useRef<AudioContext | null>(null)
  const monitorGainRef = useRef<GainNode | null>(null)
  
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastHeartbeatRef = useRef<number>(Date.now())
  const lastActivityRef = useRef<number>(Date.now())
  const inactivityCheckRef = useRef<NodeJS.Timeout | null>(null)
  
  const HEARTBEAT_INTERVAL = 15000
  const HEARTBEAT_TIMEOUT = 45000
  const INACTIVITY_LIMIT = 10 * 60 * 1000
  const INACTIVITY_WARNING = 9 * 60 * 1000

  const PEER_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }

  const addMessage = (user: string, text: string) => {
    setMessages(prev => [...prev, { id: Date.now().toString(), user, text, timestamp: Date.now() }])
    registerActivity()
  }

  const registerActivity = () => {
    lastActivityRef.current = Date.now()
    setInactivityWarning(false)
  }

  const sendHeartbeat = async () => {
    if (!isAdmin || !roomId) return
    
    try {
      await supabase
        .from('jam_sessions')
        .update({ 
          updated_at: new Date().toISOString(),
          is_active: true
        })
        .eq('id', roomId)
        .eq('owner_id', user?.id)
      
      lastHeartbeatRef.current = Date.now()
      console.log('💓 Heartbeat enviado')
    } catch (error) {
      console.error('Error en heartbeat:', error)
    }
  }

  const checkHeartbeat = async () => {
    if (!isAdmin || !roomId) return
    
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeatRef.current
    
    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.log('⏰ Heartbeat perdido - cerrando sala')
      addMessage("Sistema", "⏰ Sala cerrada por ausencia del administrador")
      await deleteRoomSilent()
      leaveRoom()
    }
  }

  const checkInactivity = async () => {
    if (!isAdmin || !roomId) return
    
    const timeSinceLastActivity = Date.now() - lastActivityRef.current
    
    if (timeSinceLastActivity > INACTIVITY_WARNING && timeSinceLastActivity < INACTIVITY_LIMIT) {
      setInactivityWarning(true)
      addMessage("Sistema", "⚠️ La sala se cerrará en 1 minuto por inactividad")
    }
    
    if (timeSinceLastActivity > INACTIVITY_LIMIT) {
      console.log('⏰ Sala cerrada por inactividad (10 minutos)')
      addMessage("Sistema", "⏰ Sala cerrada por inactividad (10 minutos)")
      await deleteRoomSilent()
      leaveRoom()
    }
  }

  const deleteRoomSilent = async () => {
    try {
      await supabase
        .from('jam_sessions')
        .delete()
        .eq('id', roomId)
      
      await supabase
        .from('jam_requests')
        .delete()
        .eq('jam_id', roomId)
      
      await supabase
        .from('jam_members')
        .delete()
        .eq('jam_id', roomId)
      
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('jamRoomId')
        sessionStorage.removeItem('jamIsAdmin')
      }
      
      console.log('🗑️ Sala eliminada:', roomId)
    } catch (error) {
      console.error('Error eliminando sala:', error)
    }
  }

  const deleteRoom = async () => {
    if (!isAdmin || !roomId) return
    if (confirm('⚠️ ¿Eliminar esta sala permanentemente?')) {
      await deleteRoomSilent()
      leaveRoom()
    }
  }

  const leaveRoom = async () => {
    if (isAdmin && roomId) {
      await supabase
        .from('jam_sessions')
        .update({ is_active: false })
        .eq('id', roomId)
    }
    
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
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    if (inactivityCheckRef.current) {
      clearInterval(inactivityCheckRef.current)
      inactivityCheckRef.current = null
    }
    
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('jamRoomId')
      sessionStorage.removeItem('jamIsAdmin')
    }
    
    setIsInRoom(false)
    setView('browse')
    setRoomId("")
    setParticipants([])
    setMessages([])
    setIsMuted(false)
    setIsAdmin(false)
    setIsListener(false)
    setRoomCategory("")
    setAudioTest("")
    setInactivityWarning(false)
    loadPublicSessions()
  }

  useEffect(() => {
    if (isInRoom && isAdmin) {
      lastHeartbeatRef.current = Date.now()
      lastActivityRef.current = Date.now()
      
      heartbeatIntervalRef.current = setInterval(() => {
        sendHeartbeat()
      }, HEARTBEAT_INTERVAL)
      
      const heartbeatCheck = setInterval(() => {
        checkHeartbeat()
      }, 10000)
      
      inactivityCheckRef.current = setInterval(() => {
        checkInactivity()
      }, 30000)
      
      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
        clearInterval(heartbeatCheck)
        if (inactivityCheckRef.current) {
          clearInterval(inactivityCheckRef.current)
          inactivityCheckRef.current = null
        }
      }
    }
  }, [isInRoom, isAdmin, roomId])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isAdmin && roomId) {
        navigator.sendBeacon(
          '/api/jam/close',
          JSON.stringify({ roomId, userId: user?.id })
        )
        console.log('🚪 beforeunload - cerrando sala')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isAdmin, roomId, user?.id])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isAdmin && roomId) {
        navigator.sendBeacon(
          '/api/jam/close',
          JSON.stringify({ roomId, userId: user?.id })
        )
        console.log('🚪 visibilitychange - cerrando sala')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAdmin, roomId, user?.id])

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
        audioContextRef.current.close()
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

  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection(PEER_CONFIG)
    peerConnectionsRef.current.set(targetId, pc)

    if (!isListener && localStreamRef.current) {
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

  const createRoom = async (category: CategoryKey) => {
    if (!selectedInstrument) {
      addMessage("Sistema", "⚠️ Selecciona un instrumento")
      return
    }

    const newRoomId = crypto.randomUUID()
    setRoomId(newRoomId)
    setIsAdmin(true)
    setIsListener(false)
    setSelectedCategory(category)
    setRoomCategory(category)
    userIdRef.current = user?.id || `local-${Date.now()}`
    
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('jamRoomId', newRoomId)
      sessionStorage.setItem('jamIsAdmin', 'true')
    }
    
    const ok = await startLocalStream()
    if (!ok) return
    
    try {
      const { error } = await supabase
        .from('jam_sessions')
        .insert({
          id: newRoomId,
          name: roomName || `Jam ${newRoomId.slice(0, 6)}`,
          visibility: visibility,
          owner_id: user?.id,
          category: category,
          instrument: selectedInstrument,
          description: `Sala de ${category}`,
          max_participants: 10,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error guardando sala:', error)
        addMessage("Sistema", `⚠️ Error: ${error.message}`)
        return
      }
      
      addMessage("Sistema", `✅ Sala guardada`)
    } catch (error: any) {
      console.error('Error:', error)
      addMessage("Sistema", `⚠️ Error: ${error.message}`)
      return
    }
    
    setIsInRoom(true)
    setView('room')
    setParticipants([{ 
      id: userIdRef.current, 
      name: myName || user?.email || 'Anónimo',
      instrument: selectedInstrument,
      isAdmin: true
    }])
    
    addMessage("Sistema", `👑 ${myName} creó la sala (${visibility})`)
    subscribeToRoom(newRoomId, category)
    
    if (isAdmin) {
      loadRequests(newRoomId)
    }
    
    registerActivity()
  }

  const joinAsListener = async (sessionId: string) => {
    if (!user) {
      alert('Debes iniciar sesión para escuchar')
      return
    }

    setIsAdmin(false)
    setIsListener(true)
    userIdRef.current = user?.id || `local-${Date.now()}`
    setRoomId(sessionId)
    
    setIsInRoom(true)
    setView('room')
    setParticipants([])
    
    addMessage("Sistema", `🎧 ${myName} está escuchando la Jam`)
    subscribeToRoom(sessionId, 'moderna')
    
    const session = publicSessions.find(s => s.id === sessionId)
    if (session) {
      setRoomName(session.name || sessionId.slice(0, 6))
      setRoomCategory(session.category || 'moderna')
    }
    
    registerActivity()
  }

  const joinRoom = async (sessionId: string) => {
    if (!selectedInstrument) {
      addMessage("Sistema", "⚠️ Selecciona un instrumento")
      return
    }

    const session = publicSessions.find(s => s.id === sessionId)
    if (session && session.visibility === 'private') {
      const confirmJoin = confirm('Esta sala es privada. ¿Quieres solicitar unión al administrador?')
      if (confirmJoin) {
        await requestToJoin(sessionId)
      }
      return
    }

    setIsAdmin(false)
    setIsListener(false)
    userIdRef.current = user?.id || `local-${Date.now()}`
    
    const ok = await startLocalStream()
    if (!ok) return
    
    setIsInRoom(true)
    setView('room')
    setParticipants([{ 
      id: userIdRef.current, 
      name: myName || user?.email || 'Anónimo',
      instrument: selectedInstrument,
      isAdmin: false
    }])
    addMessage("Sistema", `🎵 ${myName} se unió`)
    subscribeToRoom(sessionId, session?.category || 'moderna')
    
    registerActivity()
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
              isAdmin: payload.isAdmin || false
            }]
          }
          return prev
        })
        setTimeout(() => {
          if (payload.id !== userIdRef.current) {
            createOffer(payload.id)
          }
        }, 1000)
        registerActivity()
      })
      .on('broadcast', { event: 'user-left' }, ({ payload }) => {
        addMessage("Sistema", `👤 ${payload.name} salió`)
        setParticipants(prev => prev.filter(p => p.id !== payload.id))
        const pc = peerConnectionsRef.current.get(payload.id)
        if (pc) { pc.close(); peerConnectionsRef.current.delete(payload.id) }
        registerActivity()
      })
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        if (payload.targetId === userIdRef.current) {
          handleOffer(payload.fromId, payload.offer)
        }
        registerActivity()
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        if (payload.targetId === userIdRef.current) {
          handleAnswer(payload.fromId, payload.answer)
        }
        registerActivity()
      })
      .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
        if (payload.targetId === userIdRef.current) {
          handleIceCandidate(payload.fromId, payload.candidate)
        }
        registerActivity()
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        addMessage(payload.user, payload.text)
        registerActivity()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: { 
              id: userIdRef.current, 
              name: myName || 'Anónimo',
              instrument: isListener ? 'Oyente' : selectedInstrument,
              isAdmin: isAdmin
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
    registerActivity()
  }

  const sendMessage = () => {
    if (!inputMessage.trim()) return
    
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'message',
        payload: {
          user: myName || user?.email || 'Anónimo',
          text: inputMessage.trim()
        }
      })
    }
    
    addMessage(myName || user?.email || 'Anónimo', inputMessage)
    setInputMessage("")
    registerActivity()
  }

  const loadRequests = async (jamId: string) => {
    try {
      const { data, error } = await supabase
        .from('jam_requests')
        .select('*')
        .eq('jam_id', jamId)
        .eq('status', 'pending')

      if (error) throw error
      setRequests(data || [])
    } catch (error) {
      console.error('Error cargando solicitudes:', error)
    }
  }

  const requestToJoin = async (sessionId: string) => {
    if (!user) {
      alert('Debes iniciar sesión')
      return
    }

    try {
      const { error } = await supabase
        .from('jam_requests')
        .insert({
          jam_id: sessionId,
          user_id: user.id,
          user_name: myName || user.email,
          instrument: selectedInstrument || 'Sin instrumento',
          status: 'pending'
        })

      if (error) throw error
      alert('✅ Solicitud enviada al administrador')
    } catch (error) {
      console.error('Error:', error)
      alert('❌ Error al enviar solicitud')
    }
  }

  const approveRequest = async (requestId: string, jamId: string) => {
    try {
      await supabase
        .from('jam_requests')
        .update({ status: 'approved' })
        .eq('id', requestId)
      
      loadRequests(jamId)
      addMessage("Sistema", "✅ Solicitud aceptada")
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const rejectRequest = async (requestId: string, jamId: string) => {
    try {
      await supabase
        .from('jam_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
      
      loadRequests(jamId)
      addMessage("Sistema", "❌ Solicitud rechazada")
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const loadPublicSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('jam_sessions')
        .select('*')
        .eq('visibility', 'public')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPublicSessions(data || [])
    } catch (error) {
      console.error('Error cargando sesiones:', error)
    }
  }

  useEffect(() => {
    if (view === 'browse') {
      loadPublicSessions()
    }
  }, [view])

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
          <p style={{ color: "#6b7280", marginBottom: 16 }}>Introduce tu nombre para la Jam</p>
          <input type="text" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Tu nombre" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 16, marginBottom: 16 }} onKeyPress={(e) => e.key === "Enter" && myName.trim() && setIsNameSet(true)} />
          <button onClick={() => { if (myName.trim()) setIsNameSet(true) }} disabled={!myName.trim()} style={{ width: "100%", padding: "14px", background: myName.trim() ? "#10b981" : "#444", color: "white", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: myName.trim() ? "pointer" : "not-allowed" }}>Entrar</button>
        </div>
      </div>
    )
  }

  if (view === 'browse') {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>🎵 Jam Sessions</h1>
        <p style={{ color: "#6b7280", marginBottom: 20 }}>Encuentra salas públicas o crea tu propia Jam</p>

        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "16px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#10b981", fontSize: 16 }}>🎸 Crear nueva Jam</h3>
          
          <div style={{ marginBottom: 8 }}>
            <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Nombre de la sala" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 14, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: "12px", marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#9ca3af", fontSize: 14 }}>
                <input type="radio" name="visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
                🌍 Pública
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#9ca3af", fontSize: 14 }}>
                <input type="radio" name="visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
                🔒 Privada
              </label>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select value={selectedCategory || ''} onChange={(e) => setSelectedCategory(e.target.value as CategoryKey)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", flex: 1 }}>
              <option value="">Selecciona categoría</option>
              {Object.entries(CATEGORIES).map(([key, cat]) => (
                <option key={key} value={key}>{cat.emoji} {cat.name}</option>
              ))}
            </select>
            <select value={selectedInstrument} onChange={(e) => setSelectedInstrument(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "rgba(255,255,255,0.05)", color: "white", flex: 1 }}>
              <option value="">Selecciona instrumento</option>
              {selectedCategory && CATEGORIES[selectedCategory]?.instruments.map((inst) => (
                <option key={inst} value={inst}>{getInstrumentEmoji(inst)} {inst}</option>
              ))}
            </select>
          </div>
          
          <button onClick={() => { if (selectedCategory && selectedInstrument) createRoom(selectedCategory) }} disabled={!selectedCategory || !selectedInstrument} style={{ width: "100%", marginTop: 8, padding: "12px", background: (selectedCategory && selectedInstrument) ? "#10b981" : "#444", color: "white", border: "none", borderRadius: 8, fontWeight: "bold", cursor: (selectedCategory && selectedInstrument) ? "pointer" : "not-allowed" }}>
            🎸 Crear sala {visibility === 'public' ? 'pública' : 'privada'}
          </button>
        </div>

        <h3 style={{ margin: "0 0 12px 0", color: "#9ca3af", fontSize: 16 }}>🌍 Salas públicas activas</h3>
        
        {publicSessions.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No hay salas públicas activas</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {publicSessions.map((session) => (
              <div key={session.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div>
                    <div style={{ fontWeight: "bold", color: "white" }}>{session.name || session.id.slice(0, 6)}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      👤 {session.owner_id?.slice(0, 8) || 'Anónimo'} · 🎵 {session.category || 'Sin categoría'}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {session.owner_id !== user?.id && (
                      <>
                        <button 
                          onClick={() => joinAsListener(session.id)} 
                          style={{ padding: "6px 14px", background: "#8b5cf6", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                        >
                          🎧 Escuchar
                        </button>
                        <button 
                          onClick={() => requestToJoin(session.id)} 
                          style={{ padding: "6px 14px", background: "#fbbf24", color: "black", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}
                        >
                          📩 Solicitar
                        </button>
                      </>
                    )}
                    <button onClick={() => {
                      setRoomId(session.id)
                      setRoomCategory(session.category || 'moderna')
                      setSelectedCategory(session.category as CategoryKey || 'moderna')
                      joinRoom(session.id)
                    }} style={{ padding: "6px 14px", background: "#10b981", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      Unirse
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0a0a0a", color: "white", padding: "16px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <span style={{ color: "#10b981", fontWeight: "bold" }}>🎵 {roomName || 'Sala'}</span>
          <span style={{ color: "#fbbf24", marginLeft: 12 }}>{roomCategory ? CATEGORIES[roomCategory as CategoryKey]?.name || roomCategory : "Sin categoría"}</span>
          <span style={{ color: "#6b7280", marginLeft: 12 }}>👥 {participants.length}</span>
          {isAdmin && <span style={{ color: "#fbbf24", marginLeft: 12 }}>👑 Admin</span>}
          {isListener && <span style={{ color: "#8b5cf6", marginLeft: 12 }}>🎧 Oyente</span>}
          {inactivityWarning && isAdmin && (
            <span style={{ marginLeft: 12, color: "#ef4444", fontSize: 12, fontWeight: "bold" }}>⚠️ Cierre por inactividad</span>
          )}
          <span style={{ marginLeft: 12, fontSize: 12, color: audioTest?.includes("✅") ? "#10b981" : "#ef4444" }}>{audioTest}</span>
          {isMonitoring && <span style={{ marginLeft: 12, fontSize: 12, color: "#10b981" }}>🔊 {Math.round(monitorVolume * 100)}%</span>}
          {isAdmin && requests.length > 0 && (
            <button onClick={() => setShowRequests(!showRequests)} style={{ marginLeft: 12, padding: "2px 10px", background: "#fbbf24", color: "black", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 11 }}>
              📩 {requests.length}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {!isListener && (
            <>
              <button onClick={toggleMute} style={{ padding: "6px 14px", background: isMuted ? "#ef4444" : "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>{isMuted ? "🔇" : "🎤"}</button>
              <button onClick={toggleMonitoring} style={{ padding: "6px 14px", background: isMonitoring ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.05)", color: isMonitoring ? "#10b981" : "#6b7280", border: isMonitoring ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.1)", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>{isMonitoring ? "🔊" : "🔇"}</button>
              {isMonitoring && (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input type="range" min="0" max="2" step="0.01" value={monitorVolume} onChange={(e) => updateMonitorVolume(parseFloat(e.target.value))} style={{ width: 100, accentColor: "#10b981" }} />
                  <span style={{ fontSize: 11, color: "#6b7280", minWidth: 35 }}>{Math.round(monitorVolume * 100)}%</span>
                </div>
              )}
            </>
          )}
          {isAdmin && (
            <>
              <button 
                onClick={deleteRoom} 
                style={{ padding: "6px 14px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: "bold" }}
              >
                🗑️ Eliminar
              </button>
              <button 
                onClick={() => {
                  registerActivity()
                  addMessage("Sistema", "🔄 Actividad registrada")
                }} 
                style={{ padding: "6px 14px", background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
              >
                🔄 Mantener activa
              </button>
            </>
          )}
          <button onClick={leaveRoom} style={{ padding: "6px 14px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      </div>

      {isAdmin && showRequests && requests.length > 0 && (
        <div style={{ background: "rgba(251,191,36,0.1)", borderRadius: 8, padding: "12px", border: "1px solid rgba(251,191,36,0.2)", marginBottom: "12px" }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#fbbf24", fontSize: 14 }}>📩 Solicitudes pendientes</h4>
          {requests.map((req) => (
            <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 13 }}>{req.user_name} - {req.instrument}</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => approveRequest(req.id, req.jam_id)} style={{ padding: "2px 12px", background: "#10b981", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>✅</button>
                <button onClick={() => rejectRequest(req.id, req.jam_id)} style={{ padding: "2px 12px", background: "#ef4444", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>❌</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "12px", border: "1px solid rgba(255,255,255,0.05)", marginBottom: "12px" }}>
        <h3 style={{ margin: "0 0 8px 0", color: "#9ca3af", fontSize: 14 }}>🎵 Participantes</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {participants.map((p) => {
            const isLocal = p.id === userIdRef.current
            const hasStream = isLocal && localStreamRef.current !== null
            const isRemote = !isLocal && peerConnectionsRef.current.has(p.id)
            
            return (
              <div key={p.id} style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "10px", 
                padding: "6px 10px", 
                background: isLocal ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)", 
                borderRadius: 6, 
                border: isLocal ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.05)" 
              }}>
                <span style={{ fontSize: 20 }}>{getInstrumentEmoji(p.instrument)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: isLocal ? "bold" : "normal", color: "white", fontSize: 13 }}>
                    {p.name} {isLocal && "(tú)"}{p.isAdmin && " 👑"}{p.isListener && " 🎧"}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{p.instrument}</div>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isLocal && hasStream && (
                    <VolumeIndicator stream={localStreamRef.current} label="tú" />
                  )}
                  {isRemote && (
                    <VolumeIndicator stream={null} label="remoto" />
                  )}
                  {isLocal && !hasStream && (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>⏳</span>
                  )}
                  {!isLocal && !isRemote && (
                    <span style={{ fontSize: 11, color: "#6b7280" }}>⏳</span>
                  )}
                  
                  {p.id !== userIdRef.current && (
                    <span style={{ 
                      fontSize: 12, 
                      color: peerConnectionsRef.current.has(p.id) ? "#10b981" : "#fbbf24"
                    }}>
                      {peerConnectionsRef.current.has(p.id) ? "🔗" : "⏳"}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!isListener && localStreamRef.current && <AudioEffects stream={localStreamRef.current} />}

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

      <div style={{ marginTop: 12, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
        💡 {roomId.slice(0, 6)} {isAdmin && '· 🔑 Eres el administrador'}
        {isListener && '· 🎧 Estás escuchando'}
      </div>
    </div>
  )
}
