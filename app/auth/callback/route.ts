import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  if (code) {
    try {
      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error('Error intercambiando código:', error)
    }
  }
  
  // Redirigir al dashboard o a la página que corresponda
  const redirectUrl = new URL(next, request.url)
  return NextResponse.redirect(redirectUrl)
}
