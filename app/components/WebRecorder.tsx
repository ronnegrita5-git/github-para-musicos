'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';

const CATEGORIES = {
  'viento': {
    name: '🎷 Banda de Viento',
    instruments: ['Trompeta', 'Saxofón', 'Trombón', 'Clarinete', 'Flauta', 'Tuba']
  },
  'cuerda': {
    name: '🎻 Orquesta de Cámara',
    instruments: ['Violín', 'Viola', 'Violonchelo', 'Contrabajo', 'Arpa', 'Piano']
  },
  'moderna': {
    name: '🎸 Banda de Rock',
    instruments: ['Guitarra', 'Bajo', 'Batería', 'Teclado', 'Voz', 'Sintetizador']
  }
}

interface WebRecorderProps {
  projectId: string;
  onRecordingComplete: () => void;
  projectCategory?: string;
}

export default function WebRecorder({ projectId, onRecordingComplete, projectCategory }: WebRecorderProps) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [recordingName, setRecordingName] = useState('Grabación');
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [eqSettings, setEqSettings] = useState({
    bass: 0,
    mid: 0,
    treble: 0
  });
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (projectCategory && CATEGORIES[projectCategory as keyof typeof CATEGORIES]) {
      setInstruments(CATEGORIES[projectCategory as keyof typeof CATEGORIES].instruments);
      setSelectedInstrument(CATEGORIES[projectCategory as keyof typeof CATEGORIES].instruments[0] || '');
    } else {
      const allInstruments = Object.values(CATEGORIES).flatMap(cat => cat.instruments);
      setInstruments(allInstruments);
      setSelectedInstrument(allInstruments[0] || '');
    }
  }, [projectCategory]);

  // ✅ Configuración de calidad de grabación
  const getRecorderOptions = () => {
    switch (recordingQuality) {
      case 'low':
        return { audioBitsPerSecond: 64000, mimeType: 'audio/webm;codecs=opus' };
      case 'medium':
        return { audioBitsPerSecond: 128000, mimeType: 'audio/webm;codecs=opus' };
      case 'high':
      default:
        return { audioBitsPerSecond: 256000, mimeType: 'audio/webm;codecs=opus' };
    }
  };

  // ✅ Iniciar grabación con monitorización
  const startRecording = async () => {
    if (!user) {
      alert('Debes iniciar sesión');
      return;
    }

    if (!selectedInstrument) {
      alert('Selecciona un instrumento para la grabación');
      return;
    }

    try {
      // ✅ Configuración de audio de alta calidad
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
          latency: 0.01
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // ✅ Configurar AudioContext para monitorización y EQ
      const audioContext = new AudioContext({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioContext;

      // ✅ Crear nodos de audio
      const source = audioContext.createMediaStreamSource(stream);
      
      // ✅ Analizador para visualización
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // ✅ Filtros EQ (Bass, Mid, Treble)
      const bassFilter = audioContext.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 200;
      bassFilter.gain.value = eqSettings.bass;

      const midFilter = audioContext.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1;
      midFilter.gain.value = eqSettings.mid;

      const trebleFilter = audioContext.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 5000;
      trebleFilter.gain.value = eqSettings.treble;

      // ✅ Conectar: source → EQ → analyser → destination (monitorización)
      source.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);
      trebleFilter.connect(analyser);
      analyser.connect(audioContext.destination);

      // ✅ Visualización de niveles
      if (canvasRef.current) {
        drawVisualizer(analyser);
      }

      // ✅ Configurar MediaRecorder (desde el source original, sin EQ para la grabación)
      const recorderOptions = getRecorderOptions();
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        setIsMonitoring(false);
        if (analyserRef.current) {
          analyserRef.current = null;
        }
      };

      mediaRecorder.start(1000); // Grabar en segmentos de 1 segundo
      setIsRecording(true);
      setIsMonitoring(true);
      
    } catch (error) {
      console.error('Error al iniciar grabación:', error);
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  };

  // ✅ Visualizador de niveles
  const drawVisualizer = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      if (!isMonitoring && !isRecording) return;
      
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      
      // Fondo
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(0, 0, width, height);
      
      // Barras de frecuencia
      const barWidth = (width / dataArray.length) * 2.5;
      let x = 0;
      
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        
        // Color según nivel
        const intensity = dataArray[i] / 255;
        const r = intensity > 0.5 ? 16 : 16;
        const g = intensity > 0.5 ? 185 : 185 - (intensity * 100);
        const b = intensity > 0.5 ? 129 - (intensity * 100) : 129;
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
      
      requestAnimationFrame(draw);
    };
    
    draw();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  const uploadRecording = async () => {
    if (!audioURL || !user) return;

    if (!selectedInstrument) {
      alert('Selecciona un instrumento para la grabación');
      return;
    }

    try {
      const response = await fetch(audioURL);
      const blob = await response.blob();
      
      // ✅ Convertir a WAV para mejor calidad
      const audioContext = new AudioContext({ sampleRate: 48000 });
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // ✅ Crear WAV
      const wavBlob = await audioBufferToWav(audioBuffer);
      
      const filePath = `projects/${projectId}/recording_${Date.now()}.wav`;
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, wavBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('audio')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('tracks')
        .insert({
          name: recordingName || 'Grabación',
          audio_url: urlData.publicUrl,
          project_id: projectId,
          user_id: user.id,
          size: wavBlob.size,
          mime_type: 'audio/wav',
          instrument: selectedInstrument
        });

      if (insertError) throw insertError;

      alert(`✅ Grabación subida como "${selectedInstrument}"`);
      setAudioURL(null);
      setRecordingName('Grabación');
      onRecordingComplete();
    } catch (error) {
      console.error('Error subiendo grabación:', error);
      alert('Error al subir la grabación');
    }
  };

  // ✅ Convertir AudioBuffer a WAV
  const audioBufferToWav = (audioBuffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve) => {
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const length = audioBuffer.length * numberOfChannels * 2;
      const buffer = new ArrayBuffer(44 + length);
      const view = new DataView(buffer);

      // Escribir cabecera WAV
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + length, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numberOfChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numberOfChannels * 2, true);
      view.setUint16(32, numberOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(view, 36, 'data');
      view.setUint32(40, length, true);

      // Escribir datos de audio
      const offset = 44;
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        let index = offset + channel * 2;
        for (let i = 0; i < audioBuffer.length; i++) {
          const sample = Math.max(-1, Math.min(1, channelData[i]));
          view.setInt16(index, sample * 0x7FFF, true);
          index += numberOfChannels * 2;
        }
      }

      resolve(new Blob([buffer], { type: 'audio/wav' }));
    });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  return (
    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      {/* Selector de instrumento */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          type="text"
          value={recordingName}
          onChange={(e) => setRecordingName(e.target.value)}
          placeholder="Nombre de la grabación"
          style={{
            padding: '6px 12px',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 4,
            color: 'white',
            flex: 1,
            minWidth: 150
          }}
        />
        <select
          value={selectedInstrument}
          onChange={(e) => setSelectedInstrument(e.target.value)}
          style={{
            padding: '6px 12px',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 4,
            color: 'white',
            minWidth: 120
          }}
        >
          {instruments.map((inst) => (
            <option key={inst} value={inst}>{inst}</option>
          ))}
        </select>
      </div>

      {/* ✅ Controles de EQ */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>🔊 Bass</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={eqSettings.bass}
            onChange={(e) => setEqSettings(prev => ({ ...prev, bass: Number(e.target.value) }))}
            style={{ width: 60, accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 10, color: '#6b7280', minWidth: 20 }}>{eqSettings.bass}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>🎵 Mid</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={eqSettings.mid}
            onChange={(e) => setEqSettings(prev => ({ ...prev, mid: Number(e.target.value) }))}
            style={{ width: 60, accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 10, color: '#6b7280', minWidth: 20 }}>{eqSettings.mid}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: 11, color: '#6b7280' }}>🔊 Treble</span>
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={eqSettings.treble}
            onChange={(e) => setEqSettings(prev => ({ ...prev, treble: Number(e.target.value) }))}
            style={{ width: 60, accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 10, color: '#6b7280', minWidth: 20 }}>{eqSettings.treble}</span>
        </div>
      </div>

      {/* ✅ Selector de calidad */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>Calidad:</span>
        {['low', 'medium', 'high'].map((q) => (
          <button
            key={q}
            onClick={() => setRecordingQuality(q as any)}
            style={{
              padding: '2px 10px',
              background: recordingQuality === q ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
              color: recordingQuality === q ? '#10b981' : '#6b7280',
              border: recordingQuality === q ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 10
            }}
          >
            {q === 'low' ? '📱 Baja' : q === 'medium' ? '📀 Media' : '💿 Alta'}
          </button>
        ))}
      </div>

      {/* ✅ Visualizador de niveles */}
      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        style={{
          width: '100%',
          height: '60px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: 4,
          marginBottom: 8,
          display: 'block'
        }}
      />

      {/* Controles de grabación */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {!isRecording && !audioURL && (
          <button
            onClick={startRecording}
            disabled={!selectedInstrument}
            style={{
              padding: '6px 16px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: selectedInstrument ? 'pointer' : 'default',
              opacity: selectedInstrument ? 1 : 0.5
            }}
          >
            🔴 Grabar {isMonitoring ? '(monitorizando)' : ''}
          </button>
        )}
        {isRecording && (
          <button
            onClick={stopRecording}
            style={{
              padding: '6px 16px',
              background: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            ⏹ Detener
          </button>
        )}
        {audioURL && (
          <>
            <audio controls src={audioURL} style={{ height: 36, flex: 1 }} />
            <button
              onClick={uploadRecording}
              style={{
                padding: '6px 16px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              📤 Subir como "{selectedInstrument}"
            </button>
          </>
        )}
      </div>
      
      {isMonitoring && (
        <div style={{ marginTop: 4, fontSize: 11, color: '#10b981' }}>
          🎧 Monitorización activa - Escuchas lo que grabas en tiempo real
        </div>
      )}
    </div>
  );
}
