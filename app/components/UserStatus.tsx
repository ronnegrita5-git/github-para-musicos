'use client';

import { useAuth } from '@/app/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function UserStatus() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  // Detectar si estamos en una sala de Jam
  const isInJamRoom = pathname?.startsWith('/jam-web');

  const handleSignOut = async () => {
    // ✅ Si estamos en una Jam, intentar eliminar la sala
    if (isInJamRoom) {
      try {
        // Obtener roomId de sessionStorage
        const roomId = typeof window !== 'undefined' 
          ? sessionStorage.getItem('jamRoomId') 
          : null;
        
        const isAdmin = typeof window !== 'undefined' 
          ? sessionStorage.getItem('jamIsAdmin') === 'true' 
          : false;

        if (roomId && isAdmin) {
          console.log('🗑️ Eliminando sala al cerrar sesión:', roomId);
          
          // Eliminar la sala
          await supabase
            .from('jam_sessions')
            .delete()
            .eq('id', roomId);
          
          await supabase
            .from('jam_requests')
            .delete()
            .eq('jam_id', roomId);
          
          await supabase
            .from('jam_members')
            .delete()
            .eq('jam_id', roomId);
          
          // Limpiar sessionStorage
          sessionStorage.removeItem('jamRoomId');
          sessionStorage.removeItem('jamIsAdmin');
          
          console.log('✅ Sala eliminada correctamente');
        }
      } catch (error) {
        console.error('Error eliminando sala:', error);
      }
    }

    // Cerrar sesión
    await signOut();
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <a href="/login" style={{ color: '#10b981', textDecoration: 'none' }}>Iniciar sesión</a>
        <a href="/register" style={{ color: '#10b981', textDecoration: 'none' }}>Registrarse</a>
      </div>
    );
  }

  const displayName = user.email?.split('@')[0] || 'Usuario';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#9ca3af', fontSize: 14 }}>
        👤 {displayName}
        {isInJamRoom && <span style={{ marginLeft: 8, fontSize: 11, color: '#fbbf24' }}>🎵 En Jam</span>}
      </span>
      <button
        onClick={handleSignOut}
        style={{
          background: isInJamRoom ? '#ef4444' : 'transparent',
          border: isInJamRoom ? '1px solid #ef4444' : '1px solid rgba(239,68,68,0.3)',
          color: isInJamRoom ? 'white' : '#ef4444',
          padding: '4px 12px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13
        }}
      >
        {isInJamRoom ? '🚪 Salir y cerrar sala' : 'Cerrar sesión'}
      </button>
    </div>
  );
}
