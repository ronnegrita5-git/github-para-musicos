'use client';

import { useAuth } from '@/app/context/AuthContext';

export default function UserStatus() {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <a href="/login" style={{ color: '#10b981', textDecoration: 'none' }}>Iniciar sesión</a>
        <a href="/register" style={{ color: '#10b981', textDecoration: 'none' }}>Registrarse</a>
      </div>
    );
  }

  // ✅ Usar user.email directamente (sin first_name)
  const displayName = user.email?.split('@')[0] || 'Usuario';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: '#9ca3af', fontSize: 14 }}>
        👤 {displayName}
      </span>
      <button
        onClick={signOut}
        style={{
          background: 'transparent',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444',
          padding: '4px 12px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
