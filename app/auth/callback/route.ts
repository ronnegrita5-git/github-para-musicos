import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    console.error('❌ No se recibió código')
    return NextResponse.redirect(new URL('/login?error=no-code', request.url))
  }

  try {
    const cookieStore = await cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('❌ Error intercambiando código:', error.message)
      return NextResponse.redirect(new URL('/login?error=auth', request.url))
    }
    
    console.log('✅ Sesión establecida para:', data.user?.email)
    
    // Redirigir a /explore
    return NextResponse.redirect(new URL('/explore', request.url))
    
  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return NextResponse.redirect(new URL('/login?error=server', request.url))
  }
}
