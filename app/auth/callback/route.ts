import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log("🚀 Callback iniciado")
  
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  console.log("🔵 Código recibido:", code ? "Sí" : "No")

  if (code) {
    try {
      console.log("🔵 Creando cliente...")
      const supabase = await createClient()
      
      console.log("🔵 Intercambiando código...")
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error("❌ Error:", error)
        return NextResponse.redirect(new URL('/login?error=exchange_failed', requestUrl.origin))
      }
      
      console.log("✅ Sesión intercambiada para:", data.user?.email)
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
      
    } catch (error: any) {
      console.error("❌ Excepción:", error.message)
      return NextResponse.redirect(new URL('/login?error=exception', requestUrl.origin))
    }
  }
  
  return NextResponse.redirect(new URL('/login?error=no_code', requestUrl.origin))
}
