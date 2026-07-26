'use client';

import { useState, useEffect } from 'react';

interface Track {
  id: string;
  name: string;
  audio_url?: string;
}

interface ForkModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  tracks: Track[];
  userId: string;
  onForkCreated: () => void;
}

export default function ForkModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  tracks,
  userId,
  onForkCreated
}: ForkModalProps) {
  const [forkName, setForkName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForkName(`${projectName} - Fork`);
      setSelectedTracks(tracks.map(t => t.id));
      setError('');
    }
  }, [isOpen, projectName, tracks]);

  if (!isOpen) return null;

  const handleTrackToggle = (trackId: string) => {
    setSelectedTracks(prev =>
      prev.includes(trackId)
        ? prev.filter(id => id !== trackId)
        : [...prev, trackId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTracks.length === tracks.length) {
      setSelectedTracks([]);
    } else {
      setSelectedTracks(tracks.map(t => t.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/projects/${projectId}/fork`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          name: forkName,
          isPublic,
          selectedTracks
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear fork');
      }

      onForkCreated();
      onClose();
      alert('✅ Fork creado exitosamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear fork');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)'
    }}>
      <div style={{ 
        background: "#1f2937", 
        borderRadius: "12px", 
        padding: "24px", 
        maxWidth: "500px", 
        width: "90%",
        maxHeight: "90vh",
        overflowY: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "white" }}>
            🔀 Fork de {projectName}
          </h2>
          <button
            onClick={onClose}
            style={{ color: "#9ca3af", background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ background: "#ef4444", color: "white", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", color: "#d1d5db", fontSize: "14px", fontWeight: "500", marginBottom: "4px" }}>
              Nombre del fork
            </label>
            <input
              type="text"
              value={forkName}
              onChange={(e) => setForkName(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "#374151",
                border: "1px solid #4b5563",
                borderRadius: "6px",
                color: "white"
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "flex", alignItems: "center", color: "#d1d5db" }}>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              🌍 Público
            </label>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ color: "#d1d5db", fontSize: "14px", fontWeight: "500" }}>
                Selecciona pistas a incluir:
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{ color: "#60a5fa", background: "none", border: "none", fontSize: "14px", cursor: "pointer" }}
              >
                {selectedTracks.length === tracks.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>
            <div style={{ 
              background: "#374151", 
              borderRadius: "6px", 
              padding: "8px", 
              maxHeight: "150px", 
              overflowY: "auto"
            }}>
              {tracks.map((track) => (
                <label key={track.id} style={{ display: "flex", alignItems: "center", color: "#d1d5db", padding: "4px 0" }}>
                  <input
                    type="checkbox"
                    checked={selectedTracks.includes(track.id)}
                    onChange={() => handleTrackToggle(track.id)}
                    style={{ marginRight: "8px" }}
                  />
                  🎵 {track.name}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{ 
                flex: 1,
                padding: "8px 16px", 
                background: "#4b5563", 
                color: "white", 
                border: "none", 
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ 
                flex: 1,
                padding: "8px 16px", 
                background: "#10b981", 
                color: "white", 
                border: "none", 
                borderRadius: "6px",
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.5 : 1
              }}
            >
              {loading ? 'Creando...' : '🔀 Crear Fork'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
