'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';

// ✅ Definición de categorías e instrumentos
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

interface MultiUploadProps {
  projectId: string;
  onUploadComplete: () => void;
  projectCategory?: string;
}

export default function MultiUpload({ projectId, onUploadComplete, projectCategory }: MultiUploadProps) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<string>('');
  const [instruments, setInstruments] = useState<string[]>([]);

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

  const handleUpload = async () => {
    if (!user) {
      alert('Debes iniciar sesión');
      return;
    }

    if (files.length === 0) {
      alert('Selecciona al menos un archivo');
      return;
    }

    if (!selectedInstrument) {
      alert('Selecciona un instrumento para las pistas');
      return;
    }

    setUploading(true);

    try {
      for (const file of files) {
        const filePath = `projects/${projectId}/${Date.now()}_${file.name}`;
        
        // Subir a Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('audio')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Obtener URL pública
        const { data: urlData } = supabase.storage
          .from('audio')
          .getPublicUrl(filePath);

        // ✅ Guardar en tracks SIN mime_type
        const { error: insertError } = await supabase
          .from('tracks')
          .insert({
            name: file.name,
            audio_url: urlData.publicUrl,
            project_id: projectId,
            user_id: user.id,
            size: file.size,
            instrument: selectedInstrument
          });

        if (insertError) {
          console.error('Error insertando:', insertError);
          throw insertError;
        }
      }

      alert(`✅ ${files.length} archivo(s) subido(s) como "${selectedInstrument}"`);
      setFiles([]);
      onUploadComplete();
    } catch (error) {
      console.error('Error subiendo archivos:', error);
      alert(`Error al subir archivos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 4 }}>
          🎸 Instrumento:
        </label>
        <select
          value={selectedInstrument}
          onChange={(e) => setSelectedInstrument(e.target.value)}
          style={{
            padding: '6px 12px',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 4,
            color: 'white',
            width: '100%'
          }}
        >
          {instruments.map((inst) => (
            <option key={inst} value={inst}>{inst}</option>
          ))}
        </select>
        {projectCategory && (
          <span style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'block' }}>
            📌 Categoría del proyecto: {CATEGORIES[projectCategory as keyof typeof CATEGORIES]?.name || 'Sin categoría'}
          </span>
        )}
      </div>

      <input
        type="file"
        multiple
        accept="audio/*"
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        style={{ color: '#9ca3af', marginBottom: 8 }}
      />
      {files.length > 0 && (
        <div>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>
            {files.length} archivo(s) seleccionado(s) como "{selectedInstrument}"
          </p>
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedInstrument}
            style={{
              padding: '6px 16px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: (uploading || !selectedInstrument) ? 'default' : 'pointer',
              opacity: (uploading || !selectedInstrument) ? 0.5 : 1
            }}
          >
            {uploading ? 'Subiendo...' : '📤 Subir archivos'}
          </button>
        </div>
      )}
    </div>
  );
}
