// Auth-focused mock: behaviour driven by window.__AUTH set in an init script.
export function createClient(url, key, opts) {
  const A = window.__AUTH || {}; window.__calls = []; const listeners = [];
  let session = null;
  // emulate detectSessionInUrl: implicit-flow tokens in hash -> session, then supabase clears the hash
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access_token')) session = { user: { id: 'u1', email: 'new@example.com' } };
  const fire = e => listeners.forEach(f => f(e, session));
  const from = () => new Proxy({}, { get: (t, k) => k === 'then' ? (r => r({ data: k === 'maybeSingle' ? null : [], error: null })) : () => from() });
  const rpc = () => ({ then: r => r({ data: { weeks: {}, prs: [], movers: [], workouts: 0, sets: 0 }, error: null }) });
  return { from, rpc, auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange(f) { listeners.push(f); },
    signOut: async () => { session = null; fire('SIGNED_OUT'); },
    signInWithPassword: async (p) => { window.__calls.push(['signIn', p]); return A.signIn || { data: {}, error: null }; },
    signUp: async (p) => { window.__calls.push(['signUp', p]); return A.signUp || { data: { user: { identities: [{}] }, session: null }, error: null }; },
    resetPasswordForEmail: async (e, o) => { window.__calls.push(['reset', e, o]); return { data: {}, error: null }; },
    updateUser: async (p) => { window.__calls.push(['update', p]); return { data: {}, error: null }; },
    resend: async (p) => { window.__calls.push(['resend', p]); return { data: {}, error: null }; },
  } };
}
