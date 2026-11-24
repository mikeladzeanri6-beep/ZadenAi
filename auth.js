// Loads AFTER app.js. Handles login, sign up, Google, password reset and logout with Supabase Auth.
(() => {
  const C = window.ZADEN_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const toast = (m) => (window.zToast ? window.zToast(m) : alert(m));

  if (!window.supabase || !C.SUPABASE_URL || C.SUPABASE_URL.includes('YOUR_')) {
    toast('Setup needed: add your Supabase URL and public key to config.js.');
    return;
  }

  // A password-reset link must show the "new password" box, not drop the user into the app.
  let recovering = /type=recovery/.test(location.hash);

  const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const Z = (window.Z = { sb });

  Z.refreshCredits = async () => {
    const el = $('#credits');
    const { data: { session } } = await sb.auth.getSession();
    if (!el || !session) return;
    const { data } = await sb.from('profiles').select('credits').eq('id', session.user.id).maybeSingle();
    if (data) el.textContent = `Credits: ${data.credits}`;
  };

  const isSignup = () => $('.tabs')?.classList.contains('s');
  const showErr = (msg) => {
    const e = $('#e1');
    if (e) { e.textContent = msg; e.classList.add('on'); }
  };

  let entered = false;
  function enter(instant) {
    if (entered || recovering) return;
    entered = true;
    window.zEnter?.(instant);
    Z.refreshCredits();
    window.zLoadHistory?.();
    if (location.hash.includes('access_token') || location.search.includes('code=')) {
      history.replaceState(null, '', location.pathname); // keep tokens out of the address bar
    }
  }

  // --- Email + password ---
  $('#auth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (window.zValidate && !window.zValidate()) return;
    const email = $('#email').value.trim();
    const password = $('#pw').value;
    const btn = $('#auth .btn');
    btn.disabled = true;
    try {
      if (isSignup()) {
        const { data, error } = await sb.auth.signUp({
          email, password, options: { emailRedirectTo: location.origin + location.pathname },
        });
        if (error) return showErr(error.message);
        if (data.user && data.user.identities?.length === 0) {
          return showErr('An account with this email already exists. Log in instead.');
        }
        if (data.session) enter(false);
        else toast('Check your email and confirm your address, then log in.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          return showErr(/not confirmed/i.test(error.message)
            ? 'Please confirm your email first. Check your inbox.'
            : 'Incorrect email or password.');
        }
        enter(false);
      }
    } catch {
      showErr('Could not reach the server. Check your connection and try again.');
    } finally {
      btn.disabled = false;
    }
  });

  // --- Google ---
  $('#gBtn')?.addEventListener('click', async () => {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: location.origin + location.pathname },
    });
    if (error) toast(error.message);
  });

  // --- Forgot password ---
  $('#forgot')?.addEventListener('click', async () => {
    const email = $('#email').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return showErr('Enter your email above first.');
    await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    toast('If an account exists for that email, a reset link is on its way.'); // same message either way
  });

  // --- Set a new password after clicking the emailed link ---
  function showReset() { $('#reset')?.classList.add('open'); $('#np')?.focus(); }
  $('#resetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = $('#np').value;
    const err = $('#npE');
    if (p.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
    const { error } = await sb.auth.updateUser({ password: p });
    if (error) { err.textContent = error.message; return; }
    recovering = false;
    $('#reset').classList.remove('open');
    history.replaceState(null, '', location.pathname);
    toast('Password updated.');
    enter(false);
  });

  // --- Logout: end the session, then reload so chat history and media leave memory ---
  const out = $('#out');
  if (out) out.onclick = async () => { await sb.auth.signOut(); location.replace(location.pathname); };

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; showReset(); }
    else if (event === 'SIGNED_IN' && session) enter(false);
  });

  sb.auth.getSession().then(({ data: { session } }) => {
    if (recovering) showReset();
    else if (session) enter(true); // returning user: go straight in, no animation
  });
})();
