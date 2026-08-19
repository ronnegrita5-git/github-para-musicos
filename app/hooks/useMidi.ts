import { useState, useEffect, useRef, useCallback } from 'react'

interface MidiMessage {
  type: 'noteOn' | 'noteOff' | 'controlChange' | 'programChange'
  channel: number
  note: number
  velocity: number
  value?: number
}

interface MidiDevice {
  id: string
  name: string
  type: 'input' | 'output'
}

export function useMidi() {
  const [isSupported, setIsSupported] = useState<boolean>(false)
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [devices, setDevices] = useState<MidiDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
  const [lastMessage, setLastMessage] = useState<MidiMessage | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const midiAccessRef = useRef<any>(null)
  const inputRef = useRef<any>(null)
  const listenersRef = useRef<((msg: MidiMessage) => void)[]>([])

  // Verificar soporte MIDI
  useEffect(() => {
    const checkSupport = () => {
      if (navigator && (navigator as any).requestMIDIAccess) {
        setIsSupported(true)
        return true
      }
      setError('Tu navegador no soporta MIDI. Usa Chrome, Edge u Opera.')
      return false
    }
    checkSupport()
  }, [])

  // Conectar MIDI
  const connectMidi = useCallback(async () => {
    if (!isSupported) {
      setError('MIDI no soportado en este navegador')
      return false
    }

    try {
      const access = await (navigator as any).requestMIDIAccess({
        sysex: false,
        software: true
      })
      
      midiAccessRef.current = access
      
      // Listar dispositivos de entrada
      const inputs: MidiDevice[] = []
      const outputs: MidiDevice[] = []
      
      for (const entry of access.inputs) {
        const input = entry[1]
        inputs.push({
          id: input.id,
          name: input.name || 'Dispositivo MIDI',
          type: 'input'
        })
      }
      
      for (const entry of access.outputs) {
        const output = entry[1]
        outputs.push({
          id: output.id,
          name: output.name || 'Salida MIDI',
          type: 'output'
        })
      }
      
      const allDevices = [...inputs, ...outputs]
      setDevices(allDevices)
      
      if (inputs.length === 0) {
        setError('No se encontraron dispositivos MIDI conectados')
        return false
      }
      
      // Conectar automáticamente al primer dispositivo de entrada
      const firstInput = inputs[0]
      if (firstInput) {
        await selectDevice(firstInput.id)
      }
      
      return true
    } catch (err) {
      console.error('Error conectando MIDI:', err)
      setError('Error al conectar MIDI: ' + (err as Error).message)
      return false
    }
  }, [isSupported])

  // Seleccionar dispositivo
  const selectDevice = useCallback(async (deviceId: string) => {
    if (!midiAccessRef.current) {
      setError('MIDI no inicializado')
      return false
    }

    try {
      // Desconectar dispositivo anterior
      if (inputRef.current) {
        inputRef.current.onmidimessage = null
        inputRef.current = null
      }

      const input = midiAccessRef.current.inputs.get(deviceId)
      if (!input) {
        setError('Dispositivo no encontrado')
        return false
      }

      inputRef.current = input
      setSelectedDevice(deviceId)
      
      // Escuchar mensajes MIDI
      input.onmidimessage = (event: any) => {
        const data = event.data
        const status = data[0] & 0xF0
        const channel = (data[0] & 0x0F) + 1
        const note = data[1]
        const velocity = data[2] || 0
        
        let message: MidiMessage | null = null
        
        switch (status) {
          case 0x90: // Note On
            if (velocity > 0) {
              message = { type: 'noteOn', channel, note, velocity }
            } else {
              message = { type: 'noteOff', channel, note, velocity: 0 }
            }
            break
          case 0x80: // Note Off
            message = { type: 'noteOff', channel, note, velocity }
            break
          case 0xB0: // Control Change
            message = { 
              type: 'controlChange', 
              channel, 
              note: data[1], 
              velocity: 0,
              value: data[2] 
            }
            break
          case 0xC0: // Program Change
            message = { 
              type: 'programChange', 
              channel, 
              note: data[1], 
              velocity: 0,
              value: data[1] 
            }
            break
        }
        
        if (message) {
          setLastMessage(message)
          // Notificar a todos los listeners
          listenersRef.current.forEach(listener => listener(message))
        }
      }
      
      setIsConnected(true)
      setError(null)
      return true
    } catch (err) {
      console.error('Error seleccionando dispositivo:', err)
      setError('Error al seleccionar dispositivo')
      return false
    }
  }, [])

  // Desconectar MIDI
  const disconnectMidi = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.onmidimessage = null
      inputRef.current = null
    }
    setIsConnected(false)
    setSelectedDevice(null)
    setDevices([])
  }, [])

  // Suscribirse a mensajes MIDI
  const subscribe = useCallback((callback: (msg: MidiMessage) => void) => {
    listenersRef.current.push(callback)
    return () => {
      listenersRef.current = listenersRef.current.filter(cb => cb !== callback)
    }
  }, [])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      disconnectMidi()
    }
  }, [disconnectMidi])

  // Nota MIDI a frecuencia
  const midiNoteToFrequency = (note: number): number => {
    return 440 * Math.pow(2, (note - 69) / 12)
  }

  // Nota MIDI a nombre
  const midiNoteToName = (note: number): string => {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const octave = Math.floor(note / 12) - 1
    const noteName = notes[note % 12]
    return `${noteName}${octave}`
  }

  return {
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
    midiNoteToFrequency,
    midiNoteToName
  }
}
