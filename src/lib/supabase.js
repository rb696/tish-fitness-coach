import { createClient } from '@supabase/supabase-js'

// Strip U+FEFF (BOM) and whitespace — Vercel's dashboard silently prepends a BOM
// when a key is pasted in, which makes the browser Headers API throw on every request.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/^﻿/, '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').replace(/^﻿/, '').trim()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
