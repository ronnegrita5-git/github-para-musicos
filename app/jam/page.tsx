import JamSession from "@/app/components/JamSession"

export default function JamPage() {
  return (
    <div style={{
      maxWidth: 900,
      margin: '0 auto',
      padding: '20px',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a, #1a1a1a)',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: 30,
        paddingTop: 20,
      }}>
        <h1 style={{
          color: 'white',
          fontSize: 36,
          margin: 0,
          background: 'linear-gradient(135deg, #10b981, #3b82f6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          🎵 Jam Session en Vivo
        </h1>
        <p style={{ color: '#6b7280', fontSize: 16, marginTop: 8 }}>
          Toca en tiempo real con otros músicos
        </p>
      </div>
      
      <JamSession />
    </div>
  )
}
