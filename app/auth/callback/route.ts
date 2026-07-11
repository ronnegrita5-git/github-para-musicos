import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Crear un cliente de Supabase específico para el callback (sin cookies)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  
  // Si no hay código, redirigir al login
  if (!code) {
    console.error('❌ No se recibió código')
    return NextResponse.redirect(new URL('/login?error=no-code', request.url))
  }

  try {
    // Intercambiar el código por una sesión
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ Error intercambiando código:', error.message)
      return NextResponse.redirect(new URL('/login?error=auth', request.url))
    }

    console.log('✅ Sesión establecida para:', data.user?.email)
    
    // Redirigir al dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url))
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return NextResponse.redirect(new URL('/login?error=server', request.url))
  }
}
