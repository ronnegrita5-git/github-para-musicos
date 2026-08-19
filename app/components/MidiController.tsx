"use client"

import { useState, useEffect } from 'react'
import { useMidi } from '../hooks/useMidi'

interface MidiControllerProps {
  onNoteOn?: (note: number, velocity: number) => void
  onNoteOff?: (note: number) => void
  onControlChange?: (controller: number, value: number) => void
  className?: string
}

export default function MidiController({ 
  onNoteOn, 
  onNoteOff, 
  onControlChange,
  className = '' 
}: MidiControllerProps) {
  const {
    isSupported,
    isConnected,
    devices,
    selectedDevice,
    lastMessage,
    error,
    connectMidi,
    disconnectMidi,
    selectDevice,
    subscribe,
    midiNoteToName,
    midiNoteToFrequency
  } = useMidi()

  const [lastNote, setLastNote] = useState<string>('--')
  const [lastVelocity, setLastVelocity] = useState<number>(0)
  const [isConnecting, setIsConnecting] = useState<boolean>(false)

  // Suscribirse a mensajes MIDI
  useEffect(() => {
    if (!isConnected) return

    const unsubscribe = subscribe((msg) => {
      if (msg.type === 'noteOn') {
        setLastNote(midiNoteToName(msg.note))
        setLastVelocity(msg.velocity)
        if (onNoteOn) onNoteOn(msg.note, msg.velocity)
      } else if (msg.type === 'noteOff') {
        if (onNoteOff) onNoteOff(msg.note)
      } else if (msg.type === 'controlChange') {
        if (onControlChange) onControlChange(msg.note, msg.value || 0)
      }
    })

    return unsubscribe
  }, [isConnected, subscribe, onNoteOn, onNoteOff, onControlChange, midiNoteToName])

  const handleConnect = async () => {
    setIsConnecting(true)
    await connectMidi()
    setIsConnecting(false)
  }

  if (!isSupported) {
    return (
      <div className={className} style={{ padding: '12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
        <p style={{ color: '#ef4444', margin: 0, fontSize: 14 }}>
          ⚠️ Tu navegador no soporta MIDI. Usa Chrome, Edge u Opera.
        </p>
      </div>
    )
  }

  return (
    <div className={className} style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: 20 }}>🎹</span>
          <span style={{ fontWeight: 'bold', color: 'white', fontSize: 14 }}>Controlador MIDI</span>
          {isConnected && (
            <span style={{ fontSize: 12, color: '#10b981' }}>● Conectado</span>
          )}
          {!isConnected && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>○ Desconectado</span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              style={{
                padding: '6px 16px',
                background: isConnecting ? '#444' : '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 'bold'
              }}
            >
              {isConnecting ? '⏳ Conectando...' : '🔌 Conectar MIDI'}
            </button>
          ) : (
            <button
              onClick={disconnectMidi}
              style={{
                padding: '6px 16px',
                background: 'rgba(239,68,68,0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 'bold'
              }}
            >
              🔌 Desconectar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, marginBottom: '12px' }}>
          <p style={{ color: '#ef4444', margin: 0, fontSize: 13 }}>⚠️ {error}</p>
        </div>
      )}

      {isConnected && devices.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <select
            value={selectedDevice || ''}
            onChange={(e) => selectDevice(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #333',
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              fontSize: 13
            }}
          >
            <option value="">Seleccionar dispositivo</option>
            {devices.filter(d => d.type === 'input').map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} {device.id === selectedDevice ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {isConnected && (
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 6,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Última nota:</span>
            <span style={{ fontSize: 18, fontWeight: 'bold', color: '#10b981' }}>{lastNote}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Velocidad:</span>
            <span style={{ fontSize: 14, color: '#fbbf24' }}>{lastVelocity}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Dispositivos:</span>
            <span style={{ fontSize: 13, color: '#9ca3af' }}>{devices.filter(d => d.type === 'input').length}</span>
          </div>
        </div>
      )}

      {!isConnected && !error && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280', fontSize: 14 }}>
          <p>🔌 Conecta un teclado MIDI o controlador</p>
          <p style={{ fontSize: 12 }}>Soporta USB y Bluetooth MIDI</p>
        </div>
      )}
    </div>
  )
}
