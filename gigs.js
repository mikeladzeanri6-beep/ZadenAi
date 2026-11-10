// --- Tab Selection (Global) ---
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((o) => {
      o.setAttribute('aria-selected', o === t ? 'true' : 'false');
    });
  });
});

(() => {
  const C = window.ZADEN_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = C.PROXY_URL || '';

  // --- Toast Notifications ---
  function toast(m) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.remove('show'), 3800);
  }

  // --- Auth: Modes, Validation, Password Toggle, Strength ---
  let signup = false;
  const tabs = $('.tabs');

  function mode(i) {
    signup = !!i;
    tabs?.classList.toggle('s', signup);
    
    const aT = $('#aT');
    const aS = $('#aS');
    const bT = $('#bT');
    const c2 = $('#c2');
    const meter = $('#meter');
    const pw = $('#pw');

    if (aT) aT.textContent = signup ? 'Create your account.' : 'Welcome back.';
    if (aS) aS.textContent = signup ? 'Set up your Zaden workspace in seconds.' : 'Enter your credentials to continue to Zaden.';
    if (bT) bT.textContent = signup ? 'Create account' : 'Enter workspace';
    if (c2) c2.classList.toggle('open', signup);
    if (meter) meter.hidden = !signup;
    if (pw) {
      pw.autocomplete = signup ? 'new-password' : 'current-password';
      pw.placeholder = signup ? 'At least 8 characters' : 'Enter your password';
    }

    $$('.err').forEach((e) => e.classList.remove('on'));
    $$('input.bad').forEach((x) => x.classList.remove('bad'));
  }

  $$('.tab').forEach((t, i) => {
    t.addEventListener('click', () => mode(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const tabsList = $$('.tab');
        const o = tabsList[1 - i];
        o?.click();
        o?.focus();
      }
    });
  });

  function err(id, inp, msg) {
    const e = $(id);
    const x = $(inp);
    if (e) {
      e.textContent = msg || '';
      e.classList.toggle('on', !!msg);
    }
    if (x) {
      x.classList.remove('bad');
      if (msg) {
        void x.offsetWidth;
        x.classList.add('bad');
      }
    }
    return !msg;
  }

  window.zValidate = function () {
    const emailInput = $('#email');
    const pwInput = $('#pw');
    const pw2Input = $('#pw2');
    
    const em = emailInput?.value.trim() || '';
    const pw = pwInput?.value || '';
    let ok = true;

    ok = err('#e1', '#email', /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) ? '' : 'Enter a valid email address.') && ok;
    ok = err('#e2', '#pw', !pw ? 'Enter your password.' : (signup && pw.length < 8 ? 'Use at least 8 characters.' : '')) && ok;
    if (signup && pw2Input) {
      ok = err('#e3', '#pw2', pw2Input.value !== pw ? "Passwords don’t match." : '') && ok;
    }
    if (!ok) $('.bad')?.focus();
    return ok;
  };

  const eyeBtn = $('.eye');
  if (eyeBtn) {
    eyeBtn.onclick = function () {
      const p = $('#pw');
      if (!p) return;
      const h = p.type === 'password';
      p.type = h ? 'text' : 'password';
      this.textContent = h ? 'Hide' : 'Show';
      this.setAttribute('aria-label', h ? 'Hide password' : 'Show password');
    };
  }

  const pwInput = $('#pw');
  pwInput?.addEventListener('input', function () {
    const v = this.value;
    const n = (v.length >= 8) + (/[A-Z]/.test(v) && /[a-z]/.test(v)) + /\d/.test(v) + /[^\w\s]/.test(v);
    $$('#meter i').forEach((i, k) => i.classList.toggle('on', k < n));
  });

  $$('#auth input').forEach((i) => {
    i.addEventListener('input', () => i.classList.remove('bad'));
  });

  // --- Auth Form Submit & Account Verification Check ---
  const authForm = $('#auth');
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (window.zValidate && !window.zValidate()) return;

      const email = $('#email').value.trim();
      const pw = $('#pw').value;

      // If logging in, check if account exists on backend
      if (!signup) {
        try {
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pw })
          });
          
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            
            // If account is not found/available, switch user to signup mode automatically
            if (response.status === 404 || data.notExists) {
              toast('Account not found. Switched to sign up — create your account below.');
              mode(1); // Switch to sign-up tab index (1)
              const tabList = $$('.tab');
              if (tabList[1]) tabList[1].setAttribute('aria-selected', 'true');
              if (tabList[0]) tabList[0].setAttribute('aria-selected', 'false');
              $('#pw').value = '';
              return;
            }

            err('#e1', '#email', data.error || 'Invalid credentials. Please try again.');
            return;
          }
        } catch (errNet) {
          // Network or offline fallback handling if necessary
        }
      }

      // Transition into App workspace upon successful login or sign up
      const btn = $('.btn');
      if (btn) {
        const b = btn.getBoundingClientRect();
        document.body.style.setProperty('--wx', `${b.left + b.width / 2}px`);
        document.body.style.setProperty('--wy', `${b.top + b.height / 2}px`);
      }
      document.body.classList.add('entering');
      setTimeout(() => document.body.classList.add('in'), 650);
      setTimeout(() => document.body.classList.remove('entering'), 1400);
    });
  }

  // --- Ripple Effect ---
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn,.go');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'rip';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });

  // --- Landing: Spotlight, Parallax, Particles ---
  const L = $('.left');
  const orb = $('.orb');
  const cv = $('#fx');
  const g = cv?.getContext('2d');
  let P = [];
  let mx = -999;
  let my = -999;
  let run = true;
  let W = 0;
  let H = 0;
  const dpr = Math.min(devicePixelRatio || 1, 2);

  function size() {
    if (!L || !cv || !g) return;
    const r = L.getBoundingClientRect();
    W = r.width;
    H = r.height;
    cv.width = W * dpr;
    cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const n = Math.round(Math.min(90, (W * H) / 14000));
    P = [];
    for (let i = 0; i < n; i++) {
      P.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.4 + 0.5,
      });
    }
  }

  if (L) {
    size();
    addEventListener('resize', size);
    L.addEventListener('pointermove', (e) => {
      const r = L.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      L.style.setProperty('--lx', `${mx}px`);
      L.style.setProperty('--ly', `${my}px`);
      if (!RM && orb) {
        orb.style.translate = `${((mx / W - 0.5) * -26)}px ${((my / H - 0.5) * -26)}px`;
      }
    });
    L.addEventListener('pointerleave', () => {
      mx = my = -999;
    });
  }

  function tick() {
    if (!run || !g) return;
    g.clearRect(0, 0, W, H);
    
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const dx = p.x - mx;
      const dy = p.y - my;
      const d = Math.hypot(dx, dy);
      
      if (d < 130) {
        p.x += (dx / d) * 1.6;
        p.y += (dy / d) * 1.6;
      }
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      g.fillStyle = 'rgba(141,230,247,.55)';
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, 6.3);
      g.fill();

      for (let j = i + 1; j < P.length; j++) {
        const q = P[j];
        const l = Math.hypot(p.x - q.x, p.y - q.y);
        if (l < 110) {
          g.strokeStyle = `rgba(94,200,224,${0.16 * (1 - l / 110)})`;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(q.x, q.y);
          g.stroke();
        }
      }
    }
    requestAnimationFrame(tick);
  }

  function start() {
    run = !RM && !document.hidden;
    if (run) tick();
    else if (g) g.clearRect(0, 0, W, H);
  }

  start();
  document.addEventListener('visibilitychange', () => {
    if (!run && !document.body.classList.contains('in')) start();
    else if (document.hidden) run = false;
  });

  new MutationObserver(() => {
    if (document.body.classList.contains('in')) run = false;
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // --- App: Nav Pill, Logout, Suggestions, Empty States, Shortcuts ---
  const side = $('.side');
  const pill = $('.pill');

  function place() {
    const n = $('.nav.on');
    if (!n || !side?.offsetParent || !pill) return;
    pill.style.width = `${n.offsetWidth}px`;
    pill.style.height = `${n.offsetHeight}px`;
    pill.style.transform = `translate(${n.offsetLeft}px, ${n.offsetTop}px)`;
  }

  $$('.nav[data-v],.tile').forEach((b) => {
    b.addEventListener('click', () => setTimeout(place, 0));
  });
  addEventListener('resize', place);

  new MutationObserver(() => {
    if (document.body.classList.contains('in')) setTimeout(place, 350);
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const logoutBtn = $('#out');
  if (logoutBtn) {
    logoutBtn.onclick = function () {
      document.body.classList.remove('in', 'entering');
      const pwEl = $('#pw');
      const pw2El = $('#pw2');
      if (pwEl) pwEl.value = '';
      if (pw2El) pw2El.value = '';
      run = !RM;
      start();
    };
  }

  const SG = {
    chatIn: ['Write a product tagline', 'Explain quantum computing simply', 'Give me 5 video ideas'],
    imgIn: ['A glass observatory above a neon sea', 'Macro shot of a dewy fern at sunrise', 'Retro-futuristic city at dusk'],
    vcIn: ['Welcome to the future of storytelling.', 'Good morning, and thanks for listening.'],
    vdIn: ['Slow dolly shot through a rain-soaked alley at night', 'Aerial sweep over misty mountains at dawn'],
  };

  Object.keys(SG).forEach((id) => {
    const t = document.getElementById(id);
    if (!t) return;
    const c = document.createElement('div');
    c.className = 'chips sg';
    
    SG[id].forEach((x) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = x;
      b.onclick = () => {
        t.value = x;
        t.focus();
        t.dispatchEvent(new Event('input'));
      };
      c.appendChild(b);
    });
    
    t.closest('.composer')?.after(c);
    t.addEventListener('input', () => {
      t.style.height = 'auto';
      t.style.height = `${Math.min(t.scrollHeight, 260)}px`;
    });
    t.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        t.closest('.view')?.querySelector('.go')?.click();
      }
    });
  });

  [
    ['imgOut', 'Your images will appear here.'],
    ['vcOut', 'Your voice clips will appear here.'],
    ['vdOut', 'Your videos will appear here.'],
  ].forEach(([id, text]) => {
    const target = document.getElementById(id);
    if (!target) return;
    const e = document.createElement('div');
    e.className = 'empty';
    e.id = `empty-${id}`;
    e.textContent = text;
    target.appendChild(e);
  });

  $$('.tile').forEach((t, i) => {
    t.style.animationDelay = `${0.15 + i * 0.08}s`;
    t.classList.add('on-in');
  });

  // --- Helpers ---
  function busy(b, on) {
    if (!b) return;
    b.disabled = on;
    b.textContent = on ? 'Working…' : b.dataset.l;
  }

  $$('.go').forEach((b) => (b.dataset.l = b.textContent));

  function loadCard(out) {
    const d = document.createElement('div');
    d.className = 'card2 load';
    d.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>Rendering';
    out.prepend(d);
    return d;
  }

  function fill(d, html) {
    d.className = 'card2';
    d.innerHTML = html;
    const media = d.querySelector('img, video, audio');
    if (media?.src) {
      const a = document.createElement('a');
      a.className = 'act';
      a.textContent = 'Download';
      a.href = media.src;
      a.download = `zaden-${Date.now()}`;
      a.target = '_blank';
      a.rel = 'noopener';
      d.appendChild(a);
    }
    const emptyState = document.getElementById(`empty-${d.parentNode.id}`);
    if (emptyState) emptyState.remove();
  }

  function esc(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function demoImg(p) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    let h = 0;
    for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) % 360;

    const gr = g.createLinearGradient(0, 0, 512, 512);
    gr.addColorStop(0, `hsl(${h}, 70%, 55%)`);
    gr.addColorStop(1, `hsl(${h + 80}, 70%, 15%)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);

    for (let j = 0; j < 60; j++) {
      g.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.15})`;
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 512, Math.random() * 60, 0, 7);
      g.fill();
    }
    return c.toDataURL();
  }

  // --- Navigation & Views Helpers ---
  function show(v) {
    $$('.view').forEach((x) => x.classList.toggle('on', x.id === `v-${v}`));
    $$('.nav').forEach((n) => n.classList.toggle('on', n.dataset.v === v));
    const mainEl = $('.main');
    if (mainEl) mainEl.scrollTop = 0;
  }

  $$('.nav').forEach((n) => (n.onclick = () => show(n.dataset.v)));
  $$('.tile').forEach((n) => (n.onclick = () => show(n.dataset.go)));
  $$('[data-style] .chip').forEach((c) => {
    c.onclick = () => {
      $$('[data-style] .chip').forEach((o) => o.classList.remove('on'));
      c.classList.add('on');
    };
  });

  // --- Hover Motion: Spotlight, 3D Tilt, Magnetic Buttons ---
  const app = $('#app');
  if (app) {
    app.addEventListener('pointermove', (e) => {
      app.style.setProperty('--mx', `${e.clientX}px`);
      app.style.setProperty('--my', `${e.clientY}px`);

      const t = e.target.closest('.tile,.card2');
      if (t) {
        const r = t.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        t.style.setProperty('--px', `${x * 100}%`);
        t.style.setProperty('--py', `${y * 100}%`);
        if (t.classList.contains('tile')) {
          t.style.transform = `rotateY(${(x - 0.5) * 12}deg) rotateX(${(0.5 - y) * 12}deg) translateY(-4px)`;
        }
      }

      const m = e.target.closest('.mag');
      if (m) {
        const q = m.getBoundingClientRect();
        m.style.transform = `translate(${(e.clientX - q.left - q.width / 2) * 0.18}px, ${(e.clientY - q.top - q.height / 2) * 0.3}px)`;
      }
    });

    app.addEventListener('pointerout', (e) => {
      const t = e.target.closest('.tile,.mag');
      if (t && !t.contains(e.relatedTarget)) t.style.transform = '';
    });
  }

  // --- CHAT (Gemini) ---
  const hist = [];
  function say(t, c) {
    const m = document.createElement('div');
    m.className = `msg ${c}`;
    m.textContent = t;
    const msgsEl = $('#msgs');
    if (msgsEl) {
      msgsEl.appendChild(m);
      m.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    return m;
  }

  async function chat() {
    const b = $('#chatGo');
    const i = $('#chatIn');
    if (!i) return;
    const t = i.value.trim();
    if (!t) return;

    i.value = '';
    say(t, 'u');
    hist.push({ role: 'user', parts: [{ text: t }] });

    if (!C.GEMINI_API_KEY) {
      hist.pop();
      say('Demo mode: add your Gemini key in config.js to chat for real.', 'a');
      return;
    }

    busy(b, true);
    const w = say('…', 'a');

    try {
      const endpoint = `${base || 'https://generativelanguage.googleapis.com'}/v1beta/models/${C.GEMINI_CHAT_MODEL}:generateContent`;
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': C.GEMINI_API_KEY },
        body: JSON.stringify({ contents: hist }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message || r.status);

      const candidate = j.candidates?.[0]?.content;
      const answer = candidate?.parts?.map((p) => p.text || '').join('') || 'No response (blocked or empty). Try rephrasing.';
      
      w.textContent = answer;
      hist.push({ role: 'model', parts: [{ text: answer }] });
    } catch (e) {
      hist.pop();
      w.textContent = `Could not reach Gemini: ${e.message}`;
    }
    busy(b, false);
  }

  const chatGoBtn = $('#chatGo');
  const chatInInput = $('#chatIn');
  if (chatGoBtn) chatGoBtn.onclick = chat;
  if (chatInInput) {
    chatInInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        chat();
      }
    });
  }

  // --- IMAGES (Gemini Image Model) ---
  const imgGoBtn = $('#imgGo');
  if (imgGoBtn) {
    imgGoBtn.onclick = async function () {
      const b = this;
      const imgInEl = $('#imgIn');
      if (!imgInEl) return;
      const p = imgInEl.value.trim();
      if (!p) return toast('Describe the image first.');

      const st = $('[data-style] .chip.on')?.textContent || '';
      const imgOutEl = $('#imgOut');
      if (!imgOutEl) return;
      const d = loadCard(imgOutEl);
      busy(b, true);

      if (!C.GEMINI_API_KEY) {
        setTimeout(() => {
          fill(d, `<img src="${demoImg(p)}" alt=""><div class="cap">Demo image. Add a Gemini key in config.js. ${esc(p)}</div>`);
          busy(b, false);
        }, 900);
        return;
      }

      try {
        const endpoint = `${base || 'https://generativelanguage.googleapis.com'}/v1beta/models/${C.GEMINI_IMAGE_MODEL}:generateContent`;
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': C.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${p}. Style: ${st}` }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message || r.status);

        const part = j.candidates[0].content.parts.find((x) => x.inlineData);
        if (!part) throw new Error('No image returned. Try rewording the prompt.');

        fill(d, `<img src="data:${part.inlineData.mimeType};base64,${part.inlineData.data}" alt=""><div class="cap">${esc(p)}</div>`);
      } catch (e) {
        d.remove();
        toast(`Image failed: ${e.message}`);
      }
      busy(b, false);
    };
  }

  // --- VOICES (ElevenLabs) ---
  const vcGoBtn = $('#vcGo');
  if (vcGoBtn) {
    vcGoBtn.onclick = async function () {
      const b = this;
      const vcInEl = $('#vcIn');
      if (!vcInEl) return;
      const p = vcInEl.value.trim();
      if (!p) return toast('Paste a script first.');
      if (!C.ELEVENLABS_API_KEY) return toast('Add your ElevenLabs key in config.js to generate voices.');

      const vcOutEl = $('#vcOut');
      if (!vcOutEl) return;
      const d = loadCard(vcOutEl);
      busy(b, true);

      try {
        const endpoint = `${base || 'https://api.elevenlabs.io'}/v1/text-to-speech/${C.ELEVENLABS_VOICE_ID}`;
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': C.ELEVENLABS_API_KEY },
          body: JSON.stringify({ text: p, model_id: 'eleven_multilingual_v2' }),
        });
        if (!r.ok) throw new Error(r.status);

        const u = URL.createObjectURL(await r.blob());
        fill(d, `<audio controls src="${u}"></audio><div class="cap">${esc(p.slice(0, 140))}</div>`);
      } catch (e) {
        d.remove();
        toast(`Voice failed: ${e.message}`);
      }
      busy(b, false);
    };
  }

  // --- VIDEOS (fal.ai Queue) ---
  const vdGoBtn = $('#vdGo');
  if (vdGoBtn) {
    vdGoBtn.onclick = async function () {
      const b = this;
      const vdInEl = $('#vdIn');
      if (!vdInEl) return;
      const p = vdInEl.value.trim();
      if (!p) return toast('Describe the scene first.');
      if (!C.FAL_API_KEY) return toast('Add your fal.ai key in config.js to generate videos.');

      const vdOutEl = $('#vdOut');
      if (!vdOutEl) return;
      const d = loadCard(vdOutEl);
      const headers = { 'Content-Type': 'application/json', Authorization: `Key ${C.FAL_API_KEY}` };
      busy(b, true);

      try {
        const endpoint = `${base || 'https://queue.fal.run'}/${C.FAL_VIDEO_MODEL}`;
        const r = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: p }),
        });
        const q = await r.json();
        if (!r.ok) throw new Error(q.detail || r.status);

        let statusData;
        let attempts = 0;
        while (attempts < 120) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const statusRes = await fetch(q.status_url, { headers });
          statusData = await statusRes.json();
          
          d.textContent = `Rendering… ${(statusData.status || '').toLowerCase().replace('_', ' ')}`;
          if (statusData.status === 'COMPLETED') break;
          if (statusData.status === 'FAILED') throw new Error('render failed');
          attempts++;
        }

        if (attempts >= 120) throw new Error('timed out');

        const responseRes = await fetch(q.response_url, { headers });
        const resObj = await responseRes.json();
        fill(d, `<video controls loop src="${resObj.video.url}"></video><div class="cap">${esc(p)}</div>`);
      } catch (e) {
        d.remove();
        toast(`Video failed: ${e.message}`);
      }
      busy(b, false);
    };
  }
})();