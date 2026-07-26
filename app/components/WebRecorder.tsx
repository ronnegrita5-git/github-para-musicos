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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error al iniciar grabación:', error);
      alert('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
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
      
      const filePath = `projects/${projectId}/recording_${Date.now()}.wav`;
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, blob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('audio')
        .getPublicUrl(filePath);

      // ✅ Guardar en tracks SIN mime_type
      const { error: insertError } = await supabase
        .from('tracks')
        .insert({
          name: recordingName || 'Grabación',
          audio_url: urlData.publicUrl,
          project_id: projectId,
          user_id: user.id,
          size: blob.size,
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

  return (
    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
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
            🔴 Grabar
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
            <audio controls src={audioURL} style={{ height: 36 }} />
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
    </div>
  );
}
