/* VIGIL — behaviour
   Everything here is driven by how far down the visitor has scrolled.
   stage 0-2: an ordinary product page. 3-5: things drift. 6: below the footer. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noHover = matchMedia('(hover: none)').matches;
  const t0 = performance.now();
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const state = {
    stage: 0, maxStage: 0,
    turned: false,      // the ending has played and the visitor went back up
    scared: false,      // the ending has fired
    locked: false,      // a full-screen overlay is up
    px: innerWidth / 2, py: innerHeight / 2,
  };

  const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const elapsed = () => {
    const s = Math.floor((performance.now() - t0) / 1000), m = Math.floor(s / 60);
    return m ? `${m} min ${s % 60} sec` : `${s} seconds`;
  };
  const inView = el => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight;
  };

  /* ================= sound (all synthesized, no files) ================= */
  const Sound = (() => {
    let ctx = null, master, lp, droneGain, ringGain, noiseBuf, muted = false, level = 0;
    const DRONE = [0, 0, .05, .1, .17, .25, .34];
    const CUT = [80, 80, 100, 130, 180, 260, 380];
    const RING = [0, 0, 0, .0015, .004, .007, .011];

    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);

      // low drone: detuned saws under a slowly breathing lowpass
      lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 80; lp.Q.value = 5;
      droneGain = ctx.createGain(); droneGain.gain.value = 0;
      lp.connect(droneGain); droneGain.connect(master);
      [[55, 'sawtooth', .3], [55.7, 'sawtooth', .3], [82.6, 'sawtooth', .16], [110.4, 'sawtooth', .12], [155.6, 'triangle', .12], [27.5, 'sine', .9]]
        .forEach(([f, type, g]) => {
          const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
          const gn = ctx.createGain(); gn.gain.value = g;
          o.connect(gn); gn.connect(lp); o.start();
        });
      const lfo = ctx.createOscillator(); lfo.frequency.value = .07;
      const lfoG = ctx.createGain(); lfoG.gain.value = 28;
      lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();

      // thin high ringing, like ears after too long awake
      ringGain = ctx.createGain(); ringGain.gain.value = 0; ringGain.connect(master);
      [3120, 3151, 4233].forEach(f => { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(ringGain); o.start(); });

      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      setStage(level);
    }

    function setStage(s) {
      level = s;
      if (!ctx) return;
      const t = ctx.currentTime;
      droneGain.gain.setTargetAtTime(DRONE[s], t, 1.2);
      lp.frequency.setTargetAtTime(CUT[s], t, 1.5);
      ringGain.gain.setTargetAtTime(RING[s], t, 2);
    }

    function noise() { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; return n; }

    function thud(power = 1) {
      if (!ctx) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(32, t + .3);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.8 * power, t + .012);
      g.gain.exponentialRampToValueAtTime(.0001, t + .55);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + .6);
    }

    function buzz() { // the lights cutting out
      if (!ctx) return;
      const t = ctx.currentTime, n = noise(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2;
      g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
      n.connect(bp); bp.connect(g); g.connect(master); n.start(t); n.stop(t + .2);
    }

    function whisper() {
      if (!ctx) return;
      const t = ctx.currentTime, dur = rand(.7, 1.7), n = noise();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5;
      bp.frequency.setValueAtTime(rand(1400, 2600), t);
      bp.frequency.linearRampToValueAtTime(rand(1800, 3400), t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
      const syl = Math.floor(rand(3, 8));
      for (let i = 0; i < syl; i++) {
        const a = t + dur * i / syl, w = dur / syl;
        g.gain.linearRampToValueAtTime(rand(.03, .1), a + w * .3);
        g.gain.linearRampToValueAtTime(.004, a + w * .95);
      }
      g.gain.linearRampToValueAtTime(0, t + dur + .1);
      n.connect(bp); bp.connect(g);
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner(); p.pan.value = Math.random() < .5 ? -.9 : .9;
        g.connect(p); p.connect(master);
      } else g.connect(master);
      n.start(t); n.stop(t + dur + .2);
    }

    function scream() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.setValueAtTime(.0001, t); out.gain.exponentialRampToValueAtTime(.9, t + .03);
      out.gain.setValueAtTime(.9, t + .95); out.gain.exponentialRampToValueAtTime(.0001, t + 1.35);
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 4); }
      shaper.curve = curve;
      shaper.connect(out); out.connect(master);
      [311, 466, 622, 933, 1270].forEach(f => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(f * .7, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.25, t + .22);
        o.frequency.linearRampToValueAtTime(f * 1.04, t + 1.3);
        const vib = ctx.createOscillator(); vib.frequency.value = rand(11, 17);
        const vg = ctx.createGain(); vg.gain.value = f * .05;
        vib.connect(vg); vg.connect(o.frequency);
        const g = ctx.createGain(); g.gain.value = .22;
        o.connect(g); g.connect(shaper);
        o.start(t); vib.start(t); o.stop(t + 1.4); vib.stop(t + 1.4);
      });
      const n = noise(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1200; ng.gain.value = .5;
      n.connect(hp); hp.connect(ng); ng.connect(shaper); n.start(t); n.stop(t + 1.4);
      // everything else drops out, so the silence afterwards is total
      droneGain.gain.cancelScheduledValues(t); droneGain.gain.setTargetAtTime(0, t + 1.2, .05);
      ringGain.gain.cancelScheduledValues(t); ringGain.gain.setTargetAtTime(0, t + 1.2, .05);
    }

    function toggle() {
      muted = !muted;
      if (!muted) init();
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, .05);
      return muted;
    }

    return { init, setStage, thud, buzz, whisper, scream, toggle, get on() { return !!ctx && !muted; } };
  })();

  // Browsers only allow sound after a click or key press, so start on the first one.
  const firstGesture = () => Sound.init();
  addEventListener('pointerdown', firstGesture, { passive: true });
  addEventListener('keydown', firstGesture);
  const soundBtn = $('#sound');
  soundBtn.addEventListener('click', e => {
    e.stopPropagation();
    const muted = Sound.toggle();
    soundBtn.classList.toggle('muted', muted);
    soundBtn.setAttribute('aria-pressed', String(!muted));
  });

  /* ================= stage ================= */
  const stageEls = $$('[data-s]');
  const TITLES = [
    'VIGIL — Zero Sugar Energy Drink',
    'VIGIL — Zero Sugar Energy Drink',
    'VIGIL — Stay Up',
    'VIGIL — Stay Up. Stay Up.',
    'VIGIL — are you still up',
    "don't sleep",
    "it's in the hallway",
  ];
  const favicon = $('#favicon');
  const EYE_ICON = 'data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#050505'/>" +
    "<path d='M6 32Q32 8 58 32Q32 56 6 32Z' fill='#e8e2d0'/><circle cx='32' cy='32' r='12' fill='#8f1414'/><circle cx='32' cy='32' r='5' fill='#000'/></svg>");

  function computeStage() {
    const mid = innerHeight * .55;
    let s = 0;
    for (const el of stageEls) if (el.getBoundingClientRect().top <= mid) s = +el.dataset.s;
    return s;
  }

  function updateTitle() {
    if (document.hidden && state.maxStage >= 2) {
      document.title = state.maxStage >= 5 ? "it's still here" : 'come back';
    } else {
      document.title = state.turned ? 'VIGIL — it came up with you' : TITLES[state.stage];
    }
  }
  document.addEventListener('visibilitychange', updateTitle);

  function setStage(s) {
    state.stage = s;
    root.dataset.stage = s;
    if (s > state.maxStage) {
      state.maxStage = s;
      if (s === 4) cookieShow(1);
      if (s === 6) cookieShow(2);
      if (s >= 5) favicon.href = EYE_ICON;
    }
    Sound.setStage(state.turned ? Math.max(s, 3) : s);
    updateTitle();
    applyMutations(false);
  }

  /* ================= text that changes when you are not looking ================= */
  const mutables = $$('[data-m1],[data-m2],[data-m3],[data-m4],[data-m5],[data-m6],[data-m7]');
  function wanted(el) {
    const top = state.turned ? 7 : state.maxStage;
    let txt = null;
    for (let n = 1; n <= top; n++) { const v = el.dataset['m' + n]; if (v != null) txt = v; }
    return txt;
  }
  // force = true during a blackout, when nobody can see the swap
  function applyMutations(force) {
    for (const el of mutables) {
      const w = wanted(el);
      if (w == null || el.dataset.now === w) continue;
      const visible = inView(el);
      const live = el.hasAttribute('data-live');
      if (visible && !force && !live) continue;
      el.textContent = w;
      el.dataset.now = w;
      if (visible && !force) {
        el.classList.add('glitching');
        setTimeout(() => el.classList.remove('glitching'), 400);
      }
    }
  }
  setInterval(() => applyMutations(false), 500);

  // a blink: the screen goes black for a moment, and things move while it is
  const blinkEl = $('.fx-blink');
  function blink() {
    if (reduce) { applyMutations(true); return; }
    blinkEl.classList.add('on');
    setTimeout(() => applyMutations(true), 30);
    setTimeout(() => blinkEl.classList.remove('on'), rand(70, 120));
  }
  (function scheduleBlink() {
    setTimeout(() => {
      if (state.stage >= 4 && !state.locked && !document.hidden) blink();
      scheduleBlink();
    }, rand(9000, 20000));
  })();

  // single words that are briefly wrong
  const SLIPS = ['awake', 'awake', 'still awake', "don't sleep", 'behind you', 'the hallway', 'awake'];
  (function scheduleSlip() {
    setTimeout(() => {
      if (state.stage >= 3 && state.stage <= 5 && !state.locked) {
        const pool = $$('.c').filter(el => inView(el) && !el.children.length && !el.dataset.slip);
        if (pool.length) {
          const el = pick(pool), before = el.textContent, words = before.split(' ');
          if (words.length > 3) {
            words[Math.floor(rand(1, words.length - 1))] = pick(SLIPS);
            const wrong = words.join(' ');
            el.textContent = wrong; el.dataset.slip = '1';
            setTimeout(() => {
              if (el.textContent === wrong) el.textContent = before;
              delete el.dataset.slip;
            }, rand(160, 520));
          }
        }
      }
      scheduleSlip();
    }, rand(1800, 5200));
  })();

  // whispers once it gets dark
  (function scheduleWhisper() {
    setTimeout(() => {
      if ((state.stage >= 5 || state.turned) && !state.locked && !document.hidden) Sound.whisper();
      scheduleWhisper();
    }, rand(5000, 13000));
  })();

  /* ================= ordinary website things ================= */
  const revealIO = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
  }, { threshold: .12 });
  $$('.reveal, .void-line').forEach(el => revealIO.observe(el));

  document.addEventListener('click', e => {
    const dead = e.target.closest('a[href="#"]');
    if (dead) e.preventDefault();
    const add = e.target.closest('[data-add]');
    if (add) {
      add.textContent = 'Added ✓';
      setTimeout(() => { add.textContent = state.maxStage >= 5 ? 'It knows' : 'Add to cart'; }, 1400);
    }
    const notify = e.target.closest('[data-notify]');
    if (notify) notify.textContent = "We'll find you";
  });

  /* cookie banner (it also happens to be the first thing people click) */
  const cookie = $('#cookie'), cookieText = $('#cookie-text'), cookieBtns = $('#cookie-btns');
  cookie.addEventListener('click', e => { if (e.target.closest('[data-cookie]')) cookie.classList.add('gone'); });
  function cookieShow(n) {
    if (state.turned) return;
    if (n === 1) {
      cookieText.textContent = 'We use cookies to know when you fall asleep.';
      cookieBtns.innerHTML = '<button class="btn btn-small btn-primary" type="button" data-cookie>Accept</button><button class="btn btn-small btn-ghost" type="button" data-cookie>Accept</button>';
    } else {
      cookieText.textContent = `You have been awake on this page for ${elapsed()}. We are keeping count.`;
      cookieBtns.innerHTML = '<button class="btn btn-small btn-primary" type="button" data-cookie>I know</button>';
    }
    cookie.classList.remove('gone');
  }

  /* ================= nutrition label ================= */
  const awakeClock = $('#awake-clock');
  function tickAwake() {
    // counted from 7:00 yesterday morning, the last time you plausibly woke up rested
    const now = new Date(), since = new Date(now);
    since.setDate(now.getDate() - 1); since.setHours(7, 0, 0, 0);
    const s = Math.floor((now - since) / 1000);
    const pad = n => String(n).padStart(2, '0');
    awakeClock.textContent = `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  }
  tickAwake(); setInterval(tickAwake, 1000);

  const nfIO = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    nfIO.disconnect();
    const odd = [...$$('.nf-odd'), ...$$('.nf-odd-inline')];
    odd.forEach((el, i) => setTimeout(() => el.classList.add('show'), 2600 + i * 1500));
  }, { threshold: .6 });
  nfIO.observe($('#nf'));

  /* ================= stats that do not stop ================= */
  function countTo(el, to, ms) {
    const start = performance.now();
    (function step(now) {
      const p = clamp((now - start) / ms, 0, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }
  const statsIO = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    statsIO.disconnect();
    const h = $('#st-hours'), hl = $('#st-hours-label'), f = $('#st-focus'), fl = $('#st-focus-label'), cl = $('#st-crash-label');
    countTo(h, 6, 1200); countTo(f, 94, 1500);
    setTimeout(() => {
      let v = 6, rate = .35, last = performance.now();
      (function up(now) {
        const dt = Math.min(1, (now - last) / 1000); last = now;
        rate = Math.min(rate * (1 + dt * .22), 900);
        v += rate * dt;
        h.textContent = Math.floor(v).toLocaleString();
        if (v >= 30) hl.textContent = 'hours awake';
        else if (v >= 9) hl.textContent = 'hours and counting';
        if (v < 87600) requestAnimationFrame(up);
        else hl.textContent = 'hours awake. it stopped counting.';
      })(last);
    }, 4200);
    setTimeout(() => {
      let v = 94;
      const id = setInterval(() => {
        f.textContent = ++v;
        if (v >= 100) { clearInterval(id); fl.textContent = 'could not stop focusing'; }
      }, 650);
    }, 6000);
    setTimeout(() => { cl.textContent = 'participants have slept since'; }, 11000);
  }, { threshold: .5 });
  statsIO.observe($('#stats'));

  const chartCard = $('#chart-card');
  const lineV = $('.line-vigil'), lineE = $('.line-escape');
  [lineV, lineE].forEach(l => { const len = l.getTotalLength(); l.style.strokeDasharray = len; l.style.strokeDashoffset = len; });
  const chartIO = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    chartIO.disconnect();
    chartCard.classList.add('drawn');
    lineV.style.transition = 'stroke-dashoffset 1.8s ease';
    lineV.style.strokeDashoffset = 0;
    // a few seconds later the line leaves the chart, and then the card
    setTimeout(() => {
      chartCard.classList.add('escaped');
      lineE.style.transition = 'stroke-dashoffset 14s cubic-bezier(.5, 0, .9, .5)';
      lineE.style.strokeDashoffset = 0;
    }, 4500);
  }, { threshold: .45 });
  chartIO.observe(chartCard);

  /* ================= reviewers ================= */
  function avatar(L) {
    const bg = ['#ffd9ae', '#bfe3ff', '#dccfff', '#cfcfc4', '#a9a99f', '#55554f', '#111110'][L];
    const skin = ['#f1c39c', '#b97f56', '#e7b592', '#dcc6b2', '#cdc2b6', '#c7c4b9', '#000'][L];
    const hair = ['#3a2416', '#15110f', '#7a3b1d', '#4a4038', '#2c2a27', '#1a1917', '#000'][L];
    const shirt = ['#10120c', '#2b5fd9', '#e2553d', '#6d6d64', '#4c4c46', '#262623', '#000'][L];
    const rw = [0, 0, 0, 3.6, 4.8, 6.2, 0][L], rp = [1.9, 1.9, 1.9, 1.7, 1.4, 1, 1.5][L];
    const eye = x =>
      (rw ? `<circle cx="${x}" cy="29" r="${rw}" fill="${L >= 5 ? '#f3e7df' : '#fff'}"/>` : '') +
      (L >= 5 ? `<path d="M${x - 6} 29h3M${x + 3} 27l3-1M${x - 1} 34l-1 2" stroke="#b3261e" stroke-width=".5"/>` : '') +
      `<circle class="pupil" data-max="${rw ? (rw - rp - .4).toFixed(2) : .8}" cx="${x}" cy="29" r="${rp}" fill="${L === 6 ? '#fff' : '#14110f'}"/>`;
    const bags = L >= 4 && L < 6 ? `<path d="M19.5 ${30.5 + rw}q5 3 10 0M34.5 ${30.5 + rw}q5 3 10 0" stroke="#7d6f6a" stroke-width="1" fill="none" opacity=".7"/>` : '';
    const mouth = [
      '<path d="M26.5 37.5q5.5 4.5 11 0" stroke="#7a3d2c" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
      '<path d="M26.5 37.5q5.5 4.5 11 0" stroke="#5a2a1e" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
      '<path d="M26.5 37.5q5.5 4.5 11 0" stroke="#7a3d2c" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
      '<path d="M27 39.5h10" stroke="#6b4a40" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
      '<path d="M22 38q10 9 20 0z" fill="#fff" stroke="#5a2a22" stroke-width="1.1"/><path d="M27 39v3M32 39.5v4M37 39v3" stroke="#5a2a22" stroke-width=".6"/>',
      '<path d="M18.5 37q13.5 15 27 0q-13.5 5-27 0z" fill="#1a0808"/><path d="M21 38.8q11 4.2 22 0" stroke="#e9e2d2" stroke-width="2.3" fill="none" stroke-dasharray="2.2 .7"/>',
      '',
    ][L];
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="${bg}"/>` +
      `<path d="M6 64Q6 47 32 47Q58 47 58 64Z" fill="${shirt}"/><circle cx="32" cy="30" r="16" fill="${skin}"/>` +
      `<path d="M15 27Q14 9 32 9Q50 9 49 27Q44 17 32 17Q20 17 15 27Z" fill="${hair}"/>` +
      eye(24.5) + eye(39.5) + bags + mouth + '</svg>';
  }
  const avatars = $$('.avatar').map(el => {
    el.innerHTML = avatar(+el.dataset.av);
    return { el, pupils: $$('.pupil', el) };
  });
  function trackPupils() {
    for (const a of avatars) {
      const r = a.el.getBoundingClientRect();
      const dx = state.px - (r.left + r.width / 2), dy = state.py - (r.top + r.height * .45);
      const d = Math.hypot(dx, dy) || 1;
      for (const p of a.pupils) {
        const m = +p.dataset.max * Math.min(1, d / 120);
        p.setAttribute('transform', `translate(${(dx / d * m).toFixed(2)} ${(dy / d * m).toFixed(2)})`);
      }
    }
  }
  const youQuote = $('#you-quote');
  const youIO = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting)
      youQuote.textContent = `It's ${clock()}. You're reading reviews for an energy drink. You already know you're not going to sleep tonight.`;
  });
  youIO.observe(youQuote);

  /* ================= faq answers that type themselves ================= */
  $$('.faq details').forEach(d => d.addEventListener('toggle', () => {
    const p = $('[data-typed]', d);
    if (!p || !d.open || p.dataset.done) return;
    p.dataset.done = '1';
    const text = p.dataset.typed;
    let i = 0;
    (function type() {
      p.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(type, text[i - 1] === '.' ? 420 : rand(28, 70));
    })();
  }));

  /* ================= the form ================= */
  const email = $('#email'), CHANT = " can't sleep i";
  email.addEventListener('focus', () => { email.placeholder = 'you@awake'; });
  email.addEventListener('input', () => {
    const v = email.value;
    if (v.length <= 4) return;
    let s = v.slice(0, 4);
    while (s.length < v.length) s += CHANT;
    email.value = s.slice(0, v.length);
  });
  $('#join-form').addEventListener('submit', e => {
    e.preventDefault();
    $('#join-msg').textContent = `You're already on the list. You signed up at 3:14 am. You don't remember doing it.`;
    email.value = '';
    email.placeholder = 'thank you';
  });
  const agree = $('#agree');
  agree.addEventListener('change', () => {
    if (agree.checked) return;
    setTimeout(() => { agree.checked = true; $('#agree-text').textContent = 'I agree to stay awake. (You already agreed.)'; }, 700);
  });

  /* ================= below the page ================= */
  const voidTime = $('#void-time');
  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) voidTime.textContent = `it's ${clock()}. you've been here ${elapsed()}.`;
  }).observe(voidTime);

  /* ---------- the dark: a wall you can only read by torchlight ---------- */
  const dark = $('#dark'), wall = $('#dark-wall'), eyesLayer = $('#dark-eyes');
  const DIARY = [
    [8, 5, "day 1 — can't sleep. feel amazing.", -2],
    [48, 12, 'day 4 — still feel amazing', 1.5],
    [12, 21, 'day 9 — there is a sound when the can is closed', -1],
    [42, 30, 'day 16 — something stands in the hallway', 2],
    [9, 39, "day 31 — it doesn't blink so i don't blink", -3],
    [30, 48, "DON'T SHINE THE LIGHT AT THEM", 0, 'big red'],
    [46, 55, 'it makes more of them', 3],
    [10, 63, "they close their eyes so you'll think they left", -1.5],
    [44, 72, 'day ?? — i gave it a can. it said thank you.', 1],
    [16, 81, "it's so tired", -2, 'big'],
    [22, 92, 'THE HALLWAY IS RIGHT BELOW YOU', 0, 'big red'],
  ];
  (function buildWall() {
    const frag = document.createDocumentFragment();
    const add = (x, y, text, r, cls, size) => {
      const el = document.createElement('span');
      el.className = 'scrawl' + (cls ? ' ' + cls : '');
      el.textContent = text;
      el.style.left = x + '%'; el.style.top = y + '%';
      el.style.setProperty('--r', r + 'deg');
      if (size) { el.style.fontSize = size + 'rem'; el.style.opacity = rand(.3, .8).toFixed(2); }
      frag.appendChild(el);
    };
    for (let i = 0; i < 54; i++)
      add(rand(0, 86), rand(0, 98), pick(['awake', 'awake', 'AWAKE', 'awake awake', 'still awake']), rand(-14, 14), 'word', rand(1.1, 4.4));
    for (let i = 0; i < 12; i++) add(rand(2, 84), rand(2, 96), '|||||', rand(-6, 6), 'tally', rand(1.8, 3));
    for (const [x, y, text, r, cls] of DIARY) add(x, y, text, r, cls);
    wall.appendChild(frag);
  })();

  const lightR = () => Math.min(250, innerWidth * .36);
  const eyes = [];
  function placeEye(e, visibleOnly) {
    const r = dark.getBoundingClientRect();
    const lx = state.lx - r.left, ly = state.ly - r.top;
    let lo = 30, hi = r.height - 30;
    if (visibleOnly) { lo = Math.max(30, -r.top + 30); hi = Math.min(r.height - 30, innerHeight - r.top - 30); }
    if (hi <= lo) { lo = 30; hi = r.height - 30; }
    let x, y, n = 0;
    do { x = rand(30, r.width - 30); y = rand(lo, hi); }
    while (++n < 24 && Math.hypot(x - lx, y - ly) < lightR() * 1.3);
    e.x = x; e.y = y;
    e.el.style.left = x + 'px'; e.el.style.top = y + 'px';
  }
  function spawnEye(visibleOnly) {
    const el = document.createElement('div');
    el.className = 'eyes';
    el.innerHTML = '<i></i><i></i>';
    el.style.setProperty('--d', rand(0, 7).toFixed(2) + 's');
    el.style.setProperty('--z', rand(.6, 1.5).toFixed(2));
    eyesLayer.appendChild(el);
    const e = { el, shut: false, x: 0, y: 0 };
    placeEye(e, visibleOnly);
    eyes.push(e);
  }
  state.lx = state.px; state.ly = state.py;

  function updateDark(now) {
    const r = dark.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0) return;
    if (!eyes.length) for (let i = 0; i < 9; i++) spawnEye(false);
    const R = lightR(), lx = state.lx - r.left, ly = state.ly - r.top;
    wall.style.setProperty('--mx', lx.toFixed(1) + 'px');
    wall.style.setProperty('--my', ly.toFixed(1) + 'px');
    wall.style.setProperty('--lr', (R + Math.sin(now / 90) * 3).toFixed(1) + 'px'); // the torch is not steady
    for (const e of eyes) {
      if (e.shut || Math.hypot(e.x - lx, e.y - ly) > R * .8) continue;
      e.shut = true;
      e.el.classList.add('shut');
      setTimeout(() => {
        placeEye(e, true);
        e.shut = false; e.el.classList.remove('shut');
        if (eyes.length < 24) spawnEye(true);   // shining the light on one makes another
      }, rand(900, 2600));
    }
  }

  /* ---------- the hallway ---------- */
  let faceN = 0;
  function faceMarkup(withBody) {
    const id = 'face' + (++faceN);
    let teeth = '';
    for (let i = 0; i < 8; i++) {
      const off = Math.abs(i - 3.5);
      teeth += `<rect x="${(171 + i * 7.4).toFixed(1)}" y="${(375 + off * 2.2).toFixed(1)}" width="5.6" height="${(13 - off).toFixed(1)}" rx="1.5" fill="#cfc8b4"/>`;
    }
    const body = withBody
      ? '<path d="M150 510C120 556 62 578 50 640L30 1120Q26 1190 40 1262L52 1264Q54 1190 70 1130L100 770L110 1400H290L300 770L330 1130Q346 1190 348 1264L360 1262Q374 1190 370 1120L350 640C338 578 280 556 250 510Z" fill="#040403" stroke="#1a1915" stroke-width="3"/>'
      : '';
    return `<svg class="face" viewBox="0 0 400 ${withBody ? 1400 : 560}" aria-hidden="true">
      <defs>
        <radialGradient id="${id}s" cx="50%" cy="36%" r="66%">
          <stop offset="0" stop-color="#e6e2d3"/><stop offset=".42" stop-color="#b9b5a4"/><stop offset=".78" stop-color="#5c594f"/><stop offset="1" stop-color="#191815"/>
        </radialGradient>
        <filter id="${id}w" x="-20%" y="-10%" width="140%" height="120%">
          <feTurbulence class="turb" type="fractalNoise" baseFrequency="0.016 0.028" numOctaves="2" seed="3" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="24"/>
          <feGaussianBlur stdDeviation="1.2"/>
        </filter>
      </defs>
      ${body}
      <g filter="url(#${id}w)">
        <path class="head" d="M200 28C302 28 336 130 331 242C327 344 290 472 200 532C110 472 73 344 69 242C64 130 98 28 200 28Z" fill="url(#${id}s)"/>
        <ellipse class="socket" cx="136" cy="230" rx="50" ry="58" fill="#050504"/>
        <ellipse class="socket" cx="268" cy="238" rx="46" ry="63" fill="#050504"/>
        <path d="M128 286q-5 60 2 124M274 300q7 52-1 104" stroke="#0c0c0b" stroke-width="5" opacity=".5" fill="none" stroke-linecap="round"/>
        <path d="M191 318q5 12 0 22M211 318q-5 12 0 22" stroke="#3a3832" stroke-width="4" fill="none" stroke-linecap="round"/>
        <g class="mouth"><ellipse cx="200" cy="420" rx="38" ry="50" fill="#030303"/>${teeth}</g>
      </g>
      <circle class="fpupil" cx="139" cy="236" r="5" fill="#fff"/>
      <circle class="fpupil" cx="265" cy="244" r="4" fill="#fff"/>
    </svg>`;
  }

  const approach = $('#approach'), stageEl = $('#stage'), fig = $('#figure'), caption = $('#caption');
  const scareEl = $('#scare'), endcard = $('#endcard'), endLines = $('#end-lines'), endBtn = $('#end-btn'), peek = $('#peek');
  fig.innerHTML = faceMarkup(true);
  scareEl.innerHTML = faceMarkup(false);
  peek.innerHTML = faceMarkup(false);

  const SCALES = [.1, .13, .17, .22, .3, .4, .55, .75, 1, 1.3];
  const CAPS = [
    "there's the hallway.",
    'you left the light on.',
    '',
    'it has been awake as long as you have.',
    "don't scroll.",
    'it only moves when you scroll.',
    'stop.',
    'stop.',
    's t o p',
    '',
  ];
  let step = -1, bonus = 0, idleTimer = null, beatTimer = null;

  function goStep(n, text) {
    step = n;
    stageEl.classList.add('off');
    Sound.buzz();
    setTimeout(() => {
      fig.style.setProperty('--s', SCALES[n]);
      stageEl.dataset.step = n;
      caption.textContent = text != null ? text : CAPS[n];
      Sound.thud(.5 + n * .06);
    }, 70);
    setTimeout(() => stageEl.classList.remove('off'), reduce ? 90 : rand(150, 280));
    clearTimeout(idleTimer);
    if (n >= 5 && n < SCALES.length - 1 && bonus < 2) {
      // "it only moves when you scroll" is not true
      idleTimer = setTimeout(() => {
        if (state.scared || state.turned || !inView(approach) || step >= SCALES.length - 1) return;
        bonus++;
        goStep(step + 1, 'that was a lie.');
      }, 6500);
    }
  }

  function heartbeat() {
    if (beatTimer) return;
    (function beat() {
      if (state.scared || state.turned || !inView(approach)) { beatTimer = null; return; }
      const k = clamp(step, 0, 9) / 9;
      Sound.thud(.35 + k * .4);
      setTimeout(() => Sound.thud(.22 + k * .3), 170);
      beatTimer = setTimeout(beat, 1150 - k * 720);
    })();
  }

  function updateApproach() {
    const r = approach.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0) return;
    const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
    if (state.turned) {
      caption.textContent = p > .55 ? 'you took it upstairs with you.' : 'the hallway is empty now.';
      return;
    }
    if (state.scared) return;
    heartbeat();
    const want = Math.min(SCALES.length - 1, Math.floor(p * SCALES.length) + bonus);
    if (want > step) goStep(want);       // it never steps back
    if (p > .965 && step >= SCALES.length - 1) scare();
  }

  // the warped edges of the face crawl a little
  let seed = 3;
  const turbs = $$('.turb');
  if (!reduce) setInterval(() => {
    if (state.locked || inView(approach) || state.turned) { seed = seed % 90 + 1; turbs.forEach(t => t.setAttribute('seed', seed)); }
  }, 120);

  function scare() {
    state.scared = true; state.locked = true;
    clearTimeout(idleTimer);
    root.classList.add('locked');
    cookie.classList.add('gone');
    scareEl.hidden = false;
    Sound.scream();
    setTimeout(() => scareEl.classList.add('cut'), 1300);      // cut to black, and silence
    setTimeout(() => { scareEl.hidden = true; showEnd(); }, 3200);
  }

  function showEnd() {
    endcard.hidden = false;
    const lines = [
      'you can stop scrolling now.',
      `it's ${clock()}.`,
      `you were down here for ${elapsed()}.`,
      'it was with you the whole time.',
      'it is so glad you stayed up.',
    ];
    lines.forEach((text, i) => setTimeout(() => {
      const p = document.createElement('p');
      p.textContent = text;
      endLines.appendChild(p);
      requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('in')));
    }, 700 + i * 1900));
    setTimeout(() => endBtn.classList.add('in'), 700 + lines.length * 1900 + 400);
  }
  endBtn.addEventListener('mouseenter', () => { endBtn.textContent = "it's coming with you"; });
  endBtn.addEventListener('mouseleave', () => { endBtn.textContent = 'go back up'; });
  endBtn.addEventListener('click', () => {
    state.turned = true; state.locked = false;
    root.classList.add('turned');
    root.classList.remove('locked');
    endcard.hidden = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
    applyMutations(true);
    setStage(0);
    schedulePeek();
  });

  // after the ending, something watches from the edge of the window and hides when you look
  let peekTimer = null;
  function schedulePeek() {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      peek.style.top = rand(18, 62) + 'vh';
      peek.classList.add('out');
    }, rand(5000, 11000));
  }
  function updatePeek() {
    if (!state.turned || !peek.classList.contains('out')) return;
    const r = peek.getBoundingClientRect();
    if (Math.hypot(state.px - r.left, state.py - (r.top + r.height / 2)) < 260) {
      peek.classList.remove('out');
      schedulePeek();
    }
  }

  /* ================= main loop ================= */
  let scrollDirty = true;
  addEventListener('scroll', () => { scrollDirty = true; }, { passive: true });
  addEventListener('resize', () => { scrollDirty = true; });
  addEventListener('pointermove', e => { state.px = e.clientX; state.py = e.clientY; }, { passive: true });

  const reviews = $('#reviews');
  function frame(now) {
    if (scrollDirty) {
      scrollDirty = false;
      const s = computeStage();
      if (s !== state.stage) setStage(s);
      root.classList.toggle('deep', dark.getBoundingClientRect().top < innerHeight * .6);
      updateApproach();
    }
    // with no mouse (phones), the torch drifts on its own
    if (noHover) {
      state.lx = innerWidth / 2 + Math.sin(now / 1100) * innerWidth * .22;
      state.ly = innerHeight * .45 + Math.cos(now / 1700) * innerHeight * .16;
    } else { state.lx = state.px; state.ly = state.py; }
    updateDark(now);
    if (inView(reviews)) trackPupils();
    updatePeek();
    requestAnimationFrame(frame);
  }
  setStage(computeStage());
  requestAnimationFrame(frame);
})();
