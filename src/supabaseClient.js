import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/* ---------- Password-recovery marker ----------
 * Opening the reset link signs the person in and fires a one-time PASSWORD_RECOVERY event.
 * That event can fire before React has mounted, and the URL tokens are cleared right after,
 * so we catch it here, at load time, and remember it for this browser tab until the new
 * password is saved (or they sign out). Otherwise they would land on the home page signed in.
 */
const KEY = 'dearly_recovering'
const write = (on) => {
  try { on ? sessionStorage.setItem(KEY, '1') : sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

// The signed-in user, read straight from storage. Lets the app open with no connection
// (supabase.getSession() gives up when it can't refresh an expired token).
export const getCachedSession = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!/^sb-.+-auth-token$/.test(k)) continue
      const s = JSON.parse(localStorage.getItem(k))
      if (s?.user?.id && s?.user?.email) return s
    }
  } catch { /* ignore */ }
  return null
}

export const isRecovering = () => {
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}
export const clearRecovering = () => write(false)

if (typeof window !== 'undefined' && /type=recovery/.test(window.location.hash)) write(true)

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') write(true)
  if (event === 'SIGNED_OUT') write(false)
})
