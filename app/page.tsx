import Link from 'next/link'

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'black',
      color: 'white',
      padding: '20px'
    }}>
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎵</h1>
      <h2>GitHub para Músicos</h2>
      <p style={{ color: '#888', marginBottom: 30 }}>Colabora con otros músicos en tiempo real</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/login" style={{
          padding: '14px 32px',
          background: '#10b981',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 18,
          fontWeight: 'bold'
        }}>
          🔑 Iniciar sesión
        </Link>
        <Link href="/explore" style={{
          padding: '14px 32px',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 18,
          fontWeight: 'bold',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          🔍 Explorar
        </Link>
      </div>
    </div>
  )
}
