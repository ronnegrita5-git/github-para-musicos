'use client';

import { useEffect, useRef, useState } from 'react';

interface Track {
  id: string;
  name: string;
  audio_url: string;
  instrument?: string;
  duration?: number;
}

interface NativeSequencerProps {
  tracks: Track[];
  selectedTracks: Set<string>;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
  onLoopToggle: () => void;
  loopEnabled: boolean;
  masterVolume: number;
  onMasterVolumeChange: (value: number) => void;
  trackVolumes: Record<string, number>;
  onTrackVolumeChange: (trackId: string, value: number) => void;
}

export default function NativeSequencer({
  tracks,
  selectedTracks,
  isPlaying,
  onPlay,
  onStop,
  onLoopToggle,
  loopEnabled,
  masterVolume,
  onMasterVolumeChange,
  trackVolumes,
  onTrackVolumeChange
}: NativeSequencerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // ✅ Calcular duración total
  useEffect(() => {
    const selected = tracks.filter(t => selectedTracks.has(t.id));
    let maxDuration = 0;
    selected.forEach(track => {
      if (track.duration && track.duration > maxDuration) {
        maxDuration = track.duration;
      }
    });
    setTotalDuration(maxDuration || 1);
  }, [tracks, selectedTracks]);

  // ✅ Controlar reproducción
  useEffect(() => {
    if (isPlaying) {
      // Simular progreso
      const startTime = Date.now() - currentTime * 1000;
      
      const updateProgress = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const newTime = Math.min(elapsed, totalDuration);
        setCurrentTime(newTime);
        
        if (newTime < totalDuration) {
          animationRef.current = requestAnimationFrame(updateProgress);
        } else {
          if (loopEnabled) {
            setCurrentTime(0);
            // Reiniciar el bucle
            const newStart = Date.now();
            const loopUpdate = () => {
              const loopElapsed = (Date.now() - newStart) / 1000;
              const loopTime = Math.min(loopElapsed, totalDuration);
              setCurrentTime(loopTime);
              if (loopTime < totalDuration) {
                animationRef.current = requestAnimationFrame(loopUpdate);
              } else {
                // Repetir loop
                setCurrentTime(0);
                const restart = Date.now();
                const restartLoop = () => {
                  const restartElapsed = (Date.now() - restart) / 1000;
                  const restartTime = Math.min(restartElapsed, totalDuration);
                  setCurrentTime(restartTime);
                  if (restartTime < totalDuration) {
                    animationRef.current = requestAnimationFrame(restartLoop);
                  }
                };
                animationRef.current = requestAnimationFrame(restartLoop);
              }
            };
            animationRef.current = requestAnimationFrame(loopUpdate);
          } else {
            onStop();
          }
        }
      };
      
      animationRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isPlaying, totalDuration, loopEnabled]);

  // ✅ Formatear tiempo
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  const visibleTracks = tracks.filter(t => selectedTracks.has(t.id));

  if (visibleTracks.length === 0) {
    return (
      <div style={{
        padding: '20px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'center',
        color: '#6b7280'
      }}>
        <p>🎵 Selecciona al menos una pista para ver el secuenciador</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: '16px',
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.05)'
    }}>
      {/* ✅ CONTROLES SUPERIORES - TODOS VISIBLES */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '12px',
        padding: '8px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 6
      }}>
        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#10b981' }}>
          🎛️ Secuenciador
        </span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {visibleTracks.length} pistas · {formatTime(totalDuration)}
        </span>
        
        <div style={{ flex: 1 }} />
        
        {/* Volumen Master */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            style={{ width: 80, accentColor: '#10b981' }}
          />
          <span style={{ fontSize: 11, color: '#6b7280', minWidth: 30 }}>
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        
        {/* Loop */}
        <button
          onClick={onLoopToggle}
          style={{
            padding: '4px 10px',
            background: loopEnabled ? '#10b981' : 'rgba(255,255,255,0.05)',
            color: loopEnabled ? 'white' : '#6b7280',
            border: loopEnabled ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          {loopEnabled ? '🔁 Loop' : '➡️ Loop'}
        </button>
        
        {/* Stop */}
        <button
          onClick={onStop}
          style={{
            padding: '6px 14px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold'
          }}
        >
          ⏹
        </button>
        
        {/* Play/Pause */}
        <button
          onClick={onPlay}
          style={{
            padding: '6px 14px',
            background: isPlaying ? '#fbbf24' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold'
          }}
        >
          {isPlaying ? '⏸' : '▶️'}
        </button>
      </div>

      {/* ✅ BOTONES DE NAVEGACIÓN */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        justifyContent: 'center',
        flexWrap: 'wrap',
        padding: '4px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 6
      }}>
        <button
          onClick={() => setCurrentTime(0)}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14
          }}
          title="Inicio"
        >
          ⏮️
        </button>
        <button
          onClick={() => setCurrentTime(Math.max(0, currentTime - 5))}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14
          }}
          title="-5s"
        >
          ⏪
        </button>
        <button
          onClick={() => setCurrentTime(Math.min(totalDuration, currentTime + 5))}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14
          }}
          title="+5s"
        >
          ⏩
        </button>
        <button
          onClick={() => setCurrentTime(totalDuration)}
          style={{
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.05)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14
          }}
          title="Fin"
        >
          ⏭️
        </button>
      </div>

      {/* ✅ LÍNEA DE TIEMPO */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: '#6b7280',
          marginBottom: '2px'
        }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            setCurrentTime(percentage * totalDuration);
          }}
          style={{
            width: '100%',
            height: '16px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: `${progressPercentage}%`,
            height: '100%',
            background: 'rgba(16,185,129,0.3)',
            borderRadius: 4
          }} />
          <div style={{
            position: 'absolute',
            left: `${progressPercentage}%`,
            top: 0,
            width: '3px',
            height: '100%',
            background: '#10b981',
            borderRadius: 2,
            transform: 'translateX(-1.5px)'
          }} />
        </div>
      </div>

      {/* ✅ LISTA DE PISTAS */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        {visibleTracks.map((track) => {
          const volume = trackVolumes[track.id] || 0.8;
          return (
            <div key={track.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <span style={{ fontSize: 14 }}>🎵</span>
              <span style={{
                fontSize: 12,
                color: 'white',
                fontWeight: 'bold',
                minWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {track.name}
              </span>
              {track.instrument && (
                <span style={{
                  fontSize: 10,
                  color: '#10b981',
                  background: 'rgba(16,185,129,0.1)',
                  padding: '2px 8px',
                  borderRadius: 10
                }}>
                  {track.instrument}
                </span>
              )}
              <div style={{ flex: 1 }} />
              {track.duration && (
                <span style={{ fontSize: 10, color: '#6b7280', minWidth: 40 }}>
                  {formatTime(track.duration)}
                </span>
              )}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onTrackVolumeChange(track.id, parseFloat(e.target.value))}
                style={{ width: 50, accentColor: '#10b981' }}
              />
              <span style={{ fontSize: 10, color: '#6b7280', minWidth: 30 }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
