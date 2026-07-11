import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    try {
      console.log('🔄 Intercambiando código por sesión...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        console.error('❌ Error intercambiando código:', error)
        return NextResponse.redirect(new URL('/login?error=auth', request.url))
      }
      console.log('✅ Sesión establecida correctamente')
      console.log('👤 Usuario:', data.user?.email)
    } catch (error) {
      console.error('❌ Error inesperado:', error)
      return NextResponse.redirect(new URL('/login?error=server', request.url))
    }
  }

  // Redirigir al dashboard o a la página solicitada
  const redirectUrl = new URL(next, request.url)
  console.log('📍 Redirigiendo a:', redirectUrl.toString())
  return NextResponse.redirect(redirectUrl)
}
