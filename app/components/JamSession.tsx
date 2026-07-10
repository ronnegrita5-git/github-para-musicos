"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "../context/AuthContext"
import Link from "next/link"

// Mapeo de notas a frecuencias
const NOTE_FREQUENCIES: Record<string, number> = {
  'C4': 261.63,
  'C#4': 277.18,
  'D4': 293.66,
  'D#4': 311.13,
  'E4': 329.63,
  'F4': 349.23,
  'F#4': 369.99,
  'G4': 392.00,
  'G#4': 415.30,
  'A4': 440.00,
  'A#4': 466.16,
  'B4': 493.88,
  'C5': 523.25,
}

const NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']

interface JamSessionProps {
  sessionId?: string
}

export default function JamSession({ sessionId = 'default' }: JamSessionProps) {
  const { user } = useAuth()
  const [activeNotes, setActiveNotes] = useState<Set<string>>(new Set())
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState(0)
  const [isMicActive, setIsMicActive] = useState(false)
  const [micVolume, setMicVolume] = useState(50)
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorsRef = useRef<Map<string, OscillatorNode>>(new Map())
  const gainsRef = useRef<Map<string, GainNode>>(new Map())
  
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  // Inicializar AudioContext
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return () => {
      audioContextRef.current?.close()
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Conectar a Supabase Realtime (incluso sin login para escuchar)
  useEffect(() => {
    const channel = supabase.channel(`jam:${sessionId}`)
    
    channel
      .on(
        'broadcast',
        { event: 'note' },
        (payload) => {
          const { note, action, userId, velocity } = payload.payload
          // No reproducir notas propias (si el usuario está logueado)
          if (user && userId === user.id) return
          
          if (action === 'note-on') {
            playNote(note, velocity)
            setActiveNotes(prev => new Set(prev).add(note))
          } else if (action === 'note-off') {
            stopNote(note)
            setActiveNotes(prev => {
              const newSet = new Set(prev)
              newSet.delete(note)
              return newSet
            })
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') {
          setParticipants(1)
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [user, sessionId])

  const playNote = (note: string, velocity: number = 100) => {
    if (!audioContextRef.current) return
    
    const freq = NOTE_FREQUENCIES[note]
    if (!freq) return

    if (oscillatorsRef.current.has(note)) return

    try {
      const ctx = audioContextRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      
      const volume = Math.min(1, velocity / 127)
      gain.gain.value = volume * 0.3
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.start()
      
      oscillatorsRef.current.set(note, osc)
      gainsRef.current.set(note, gain)
      
      setTimeout(() => {
        stopNote(note)
      }, 2000)
      
    } catch (error) {
      console.error('Error al reproducir nota:', error)
    }
  }

  const stopNote = (note: string) => {
    const osc = oscillatorsRef.current.get(note)
    const gain = gainsRef.current.get(note)
    
    if (osc) {
      try {
        if (gain) {
          gain.gain.setValueAtTime(0, audioContextRef.current?.currentTime || 0)
        }
        osc.stop(audioContextRef.current?.currentTime || 0)
      } catch (e) {}
      oscillatorsRef.current.delete(note)
      gainsRef.current.delete(note)
    }
  }

  const sendNote = (note: string, action: 'note-on' | 'note-off', velocity: number = 100) => {
    if (!user) return
    
    const channel = supabase.channel(`jam:${sessionId}`)
    channel.send({
      type: 'broadcast',
      event: 'note',
      payload: {
        note,
        action,
        userId: user.id,
        velocity,
        timestamp: Date.now(),
      },
    })
  }

  const toggleMic = async () => {
    if (!user) {
      alert('Debes iniciar sesión para usar el micrófono')
      return
    }

    if (isMicActive) {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
      }
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect()
        sourceNodeRef.current = null
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
        gainNodeRef.current = null
      }
      setIsMicActive(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } 
      })
      
      mediaStreamRef.current = stream
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      sourceNodeRef.current = source
      
      const gain = audioContextRef.current.createGain()
      gain.gain.value = micVolume / 100
      gainNodeRef.current = gain
      
      source.connect(gain)
      gain.connect(audioContextRef.current.destination)
      
      setIsMicActive(true)
      
    } catch (error) {
      console.error('Error al acceder al micrófono:', error)
      alert('No se pudo acceder al micrófono. Permite el acceso en tu navegador.')
    }
  }

  const updateMicVolume = (value: number) => {
    setMicVolume(value)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = value / 100
    }
  }

  const handleKeyDown = (note: string) => {
    if (!user) return
    
    if (activeNotes.has(note)) return
    
    playNote(note)
    setActiveNotes(prev => new Set(prev).add(note))
    sendNote(note, 'note-on')
  }

  const handleKeyUp = (note: string) => {
    if (!user) return
    
    if (!activeNotes.has(note)) return
    
    stopNote(note)
    setActiveNotes(prev => {
      const newSet = new Set(prev)
      newSet.delete(note)
      return newSet
    })
    sendNote(note, 'note-off')
  }

  return (
    <div style={{
      padding: 20,
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 16,
      border: '1px solid rgba(16, 185, 129, 0.1)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <h3 style={{ color: 'white', margin: 0 }}>
          🎹 Jam Session {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
        </h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: '#6b7280', fontSize: 14 }}>
            👥 {participants} participantes
          </span>
          {!user && (
            <Link href="/login" style={{
              padding: '4px 12px',
              background: '#10b981',
              color: 'white',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 12,
            }}>
              Unirse
            </Link>
          )}
        </div>
      </div>

      {/* 🎤 CONTROLES DEL MICRÓFONO (solo para usuarios logueados) */}
      {user && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={toggleMic}
            style={{
              padding: '8px 20px',
              background: isMicActive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 'bold',
            }}
          >
            {isMicActive ? '🔴 Desactivar micrófono' : '🎤 Activar micrófono'}
          </button>
          
          {isMicActive && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>🔊</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={micVolume}
                  onChange={(e) => updateMicVolume(parseInt(e.target.value))}
                  style={{
                    width: 100,
                    accentColor: '#10b981',
                  }}
                />
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{micVolume}%</span>
              </div>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 1s infinite',
              }} />
            </>
          )}
          <span style={{ color: '#6b7280', fontSize: 12 }}>
            {isMicActive ? '🎤 Micrófono activo' : 'Micrófono desactivado'}
          </span>
        </div>
      )}

      {/* 🎹 TECLADO VIRTUAL */}
      {user ? (
        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          padding: 20,
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 12,
          flexWrap: 'wrap',
        }}>
          {NOTES.map((note) => {
            const isActive = activeNotes.has(note)
            const isBlack = note.includes('#')
            
            return (
              <button
                key={note}
                onMouseDown={() => handleKeyDown(note)}
                onMouseUp={() => handleKeyUp(note)}
                onMouseLeave={() => {
                  if (isActive) handleKeyUp(note)
                }}
                style={{
                  width: isBlack ? 40 : 50,
                  height: isBlack ? 120 : 160,
                  background: isActive 
                    ? '#10b981' 
                    : isBlack 
                      ? '#1a1a1a' 
                      : '#2a2a2a',
                  border: isBlack 
                    ? '1px solid #333' 
                    : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 'bold',
                  transition: 'all 0.1s ease',
                  boxShadow: isActive ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
                  transform: isActive ? 'scale(0.95)' : 'scale(1)',
                  position: 'relative',
                  zIndex: isBlack ? 10 : 1,
                  marginLeft: isBlack ? -15 : 0,
                  marginRight: isBlack ? -15 : 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 10,
                }}
              >
                <span style={{ 
                  fontSize: 10, 
                  color: isBlack ? '#888' : '#666',
                  position: 'absolute',
                  bottom: 8,
                }}>
                  {note}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: 30,
          color: '#6b7280',
          border: '1px dashed rgba(16, 185, 129, 0.2)',
          borderRadius: 12,
        }}>
          <p style={{ fontSize: 18, margin: 0 }}>🎧</p>
          <p style={{ margin: '8px 0 0 0' }}>
            Estás escuchando la jam session
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: 14 }}>
            <Link href="/login" style={{ color: '#10b981' }}>
              Inicia sesión
            </Link> para tocar y usar el micrófono
          </p>
        </div>
      )}

      <div style={{
        marginTop: 16,
        textAlign: 'center',
        color: '#6b7280',
        fontSize: 14,
      }}>
        <p style={{ margin: 0 }}>
          {user ? '🎵 Toca las teclas o usa tu micrófono' : '🎧 Escuchando la jam session en vivo'}
        </p>
        <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>
          {isConnected ? '✅ Conectado a la jam session' : '⏳ Conectando...'}
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
