/* =========================================================================
   FLETES Y MUDANZAS JC | Interacciones y animaciones
   - Todo lo "extra" (GSAP, Lenis) es mejora progresiva: si una librería no
     carga o el usuario prefiere menos movimiento, la página sigue completa.
   - Para cambiar el número de WhatsApp, edita WA_NUMBER (formato 52 + 10 dígitos)
     y los enlaces wa.me del HTML (están como respaldo si JS está desactivado).
   ========================================================================= */
(() => {
  'use strict';

  const WA_NUMBER = '522299198349';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  let lenis = null;
  let isReady = false;

  /* ---------------------------------------------------------------
     1. Enlaces de WhatsApp con mensaje contextual
     --------------------------------------------------------------- */
  $$('[data-wa]').forEach((a) => { a.href = waLink(a.dataset.wa); });

  /* ---------------------------------------------------------------
     2. Scroll suave (Lenis)
     --------------------------------------------------------------- */
  function initLenis() {
    if (reduced || typeof window.Lenis === 'undefined') return;
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true });
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    lenis.stop(); // se libera cuando termina el preloader
  }

  function scrollToTarget(hash) {
    if (hash === '#inicio') {
      lenis ? lenis.scrollTo(0, { duration: 1.6 }) : window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = $(hash);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.7, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initAnchors() {
    $$('a[href^="#"]').forEach((a) => {
      const hash = a.getAttribute('href');
      if (hash.length < 2) return;
      a.addEventListener('click', (e) => {
        if (!$(hash)) return;
        e.preventDefault();
        setMenu(false);
        scrollToTarget(hash);
      });
    });
  }

  /* ---------------------------------------------------------------
     3. Preloader: camión en marcha + porcentaje real de carga
     --------------------------------------------------------------- */
  function runLoader(onDone) {
    const loader = $('#loader');
    if (!loader) { onDone(); return; }
    const fill = $('#loaderFill');
    const pct = $('#loaderPct');
    const minDur = reduced ? 400 : 2400;
    let loaded = document.readyState === 'complete';
    window.addEventListener('load', () => { loaded = true; }, { once: true });

    const t0 = performance.now();
    let value = 0;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      fill.style.transform = 'scaleX(1)';
      pct.textContent = '100';
      setTimeout(() => {
        loader.classList.add('is-done');
        onDone();
        setTimeout(() => loader.remove(), 1300);
      }, 320);
    };

    const tick = (now) => {
      if (finished) return;
      const t = now - t0;
      const base = Math.min(1, t / minDur) * 100;
      const target = loaded ? base : Math.min(base, 92);
      value += (target - value) * 0.12;
      fill.style.transform = `scaleX(${(value / 100).toFixed(4)})`;
      pct.textContent = String(Math.min(99, Math.round(value)));
      if ((loaded && t >= minDur && value > 99.2) || t > 8000) { finish(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------
     4. Navegación: estado "pegado", menú móvil, barra de progreso
     --------------------------------------------------------------- */
  const burger = $('#burger');
  const menu = $('#menu');

  function setMenu(open) {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    menu.setAttribute('aria-hidden', String(!open));
    if (lenis) (open ? lenis.stop() : isReady && lenis.start());
    root.style.overflow = open ? 'hidden' : '';
  }

  function initNav() {
    const nav = $('#nav');
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:70px;left:0;width:1px;height:1px;pointer-events:none';
    document.body.prepend(sentinel);
    new IntersectionObserver(([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting)).observe(sentinel);

    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
    setMenu(false);

    // barra de progreso de lectura
    const bar = $('#scrollBar');
    const set = (p) => { bar.style.transform = `scaleX(${p.toFixed(4)})`; };
    if (hasGSAP) {
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => set(s.progress) });
    } else {
      let ticking = false;
      window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          set(clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight), 0, 1));
          ticking = false;
        });
      }, { passive: true });
    }
  }

  /* ---------------------------------------------------------------
     5. Revelado al hacer scroll (IntersectionObserver) + titulares por palabra
     --------------------------------------------------------------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.setAttribute('aria-hidden', 'true');
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--i', i++);
            wi.textContent = part;
            w.appendChild(wi);
            frag.appendChild(w);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR') {
          walk(ch);
        }
      });
    };
    walk(el);
    el.setAttribute('aria-label', label);
    el.classList.add('is-split');
  }

  function initReveals() {
    $$('[data-split]').forEach(splitWords);
    const targets = $$('[data-reveal], [data-split]');

    // escalona hermanos que se revelan juntos (listas, tarjetas)
    const groups = new Map();
    targets.forEach((t) => {
      if (!t.hasAttribute('data-reveal')) return;
      const key = t.parentElement;
      groups.set(key, [...(groups.get(key) || []), t]);
    });
    groups.forEach((items) => {
      if (items.length > 1) items.forEach((el, i) => { el.style.transitionDelay = `${i * 90}ms`; });
    });

    if (!('IntersectionObserver' in window)) { targets.forEach((t) => t.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('is-in');
        io.unobserve(el);
        if (el.style.transitionDelay) setTimeout(() => { el.style.transitionDelay = ''; }, 2000);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach((t) => io.observe(t));
  }

  /* ---------------------------------------------------------------
     6. Contadores animados
     --------------------------------------------------------------- */
  function initCounters() {
    if (reduced) return;
    $$('[data-count]').forEach((el) => {
      const end = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      el.textContent = `0${suffix}`;
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const dur = 1900;
        const t0 = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
          el.textContent = `${Math.round(end * eased)}${suffix}`;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: 0.6 });
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------
     7. Botones: relleno desde el cursor, imán, foco de luz en tarjetas
     --------------------------------------------------------------- */
  function initPointerFx() {
    $$('.btn').forEach((b) => {
      const origin = (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--x', `${e.clientX - r.left}px`);
        b.style.setProperty('--y', `${e.clientY - r.top}px`);
      };
      b.addEventListener('pointerenter', origin);
      b.addEventListener('pointerleave', origin);
    });

    if (finePointer && !reduced) {
      $$('[data-magnetic]').forEach((b) => {
        b.addEventListener('pointermove', (e) => {
          const r = b.getBoundingClientRect();
          const x = (e.clientX - r.left - r.width / 2) * 0.16;
          const y = (e.clientY - r.top - r.height / 2) * 0.26;
          b.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        });
        b.addEventListener('pointerleave', () => { b.style.transform = ''; });
      });
    }

    $$('[data-spot]').forEach((t) => {
      t.addEventListener('pointermove', (e) => {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--mx', `${e.clientX - r.left}px`);
        t.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------------------------------------------------------------
     8. Hero: palabra rotativa, red de partículas, inclinación 3D
     --------------------------------------------------------------- */
  function initCycle() {
    const words = $$('.cycle__w');
    if (words.length < 2 || reduced) return;
    let i = 0;
    setInterval(() => {
      if (document.hidden) return;
      const cur = words[i];
      i = (i + 1) % words.length;
      const next = words[i];
      cur.classList.remove('is-on');
      cur.classList.add('is-out');
      next.classList.add('is-on');
      setTimeout(() => { // devuelve la palabra saliente abajo sin animar
        cur.style.transition = 'none';
        cur.classList.remove('is-out');
        void cur.offsetWidth;
        cur.style.transition = '';
      }, 950);
    }, 2900);
  }

  function initNet() {
    const canvas = $('#net');
    const hero = $('#inicio');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, nodes = [], raf = 0, running = false, link = 140;
    const pointer = { x: -999, y: -999 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      link = w < 700 ? 105 : 150;
      const count = clamp(Math.round((w * h) / 21000), 16, 64);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.34, vy: (Math.random() - 0.5) * 0.34,
        r: Math.random() * 1.6 + 1,
      }));
      draw(false);
    };

    const draw = (advance = true) => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        if (advance) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < -10) n.x = w + 10; else if (n.x > w + 10) n.x = -10;
          if (n.y < -10) n.y = h + 10; else if (n.y > h + 10) n.y = -10;
        }
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 83, 159, .5)';
        ctx.fill();
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link) {
            ctx.strokeStyle = `rgba(0, 83, 159, ${((1 - d / link) * 0.2).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const dp = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (dp < link * 1.4) {
          ctx.strokeStyle = `rgba(29, 111, 214, ${((1 - dp / (link * 1.4)) * 0.5).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
          if (advance) { a.x += (pointer.x - a.x) * 0.004; a.y += (pointer.y - a.y) * 0.004; }
        }
      }
    };

    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    const start = () => { if (!running && !reduced) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
      });
      hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = -999; });
    }
    resize();
  }

  function initTilt() {
    if (!finePointer || reduced) return;
    const stage = $('.hero__stage');
    const photo = $('#photo');
    if (!stage || !photo) return;
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      photo.style.setProperty('--ry', `${(px * 9).toFixed(2)}deg`);
      photo.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`);
    });
    stage.addEventListener('pointerleave', () => {
      photo.style.setProperty('--ry', '0deg');
      photo.style.setProperty('--rx', '0deg');
    });
  }

  /* ---------------------------------------------------------------
     9. Escenas con scroll (GSAP + ScrollTrigger)
     --------------------------------------------------------------- */
  function initScrollScenes() {
    if (!hasGSAP || reduced) return;

    // Parallax suave del hero
    gsap.to('.hero__copy', { yPercent: -9, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__bg', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // Parallax de imágenes dentro de su marco
    $$('.px img').forEach((img) => {
      gsap.fromTo(img, { yPercent: -6 }, {
        yPercent: 6, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    initZoom();
    initProcess();
    initManifesto();
  }

  /* Imagen que se abre a pantalla completa mientras se hace scroll */
  function initZoom() {
    const sec = $('.zoom');
    const pin = $('#zoomPin');
    if (!sec || !pin) return;
    const frame = $('#zoomFrame');
    const img = $('#zoomImg');
    const shade = $('#zoomShade');
    const intro = $('#zoomIntro');
    const copy = $('#zoomCopy');
    const mm = gsap.matchMedia();

    mm.add({ wide: '(min-width: 768px)', narrow: '(max-width: 767px)' }, (ctx) => {
      sec.classList.add('is-pin');
      const from = ctx.conditions.wide
        ? 'inset(20% 25% 20% 25% round 16px)'
        : 'inset(25% 7% 27% 7% round 16px)';
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: pin, start: 'top top', end: '+=170%', pin: true, scrub: 0.8, anticipatePin: 1 },
      });
      tl.fromTo(frame, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1 }, 0)
        .fromTo(img, { scale: 1.4 }, { scale: 1, duration: 1 }, 0)
        .to(intro, { opacity: 0, y: -30, duration: 0.3 }, 0)
        .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.45)
        .fromTo(copy, { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.45 }, 0.6)
        .to({}, { duration: 0.25 }); // pausa final para leer
      return () => sec.classList.remove('is-pin');
    });
  }

  /* Proceso: scroll horizontal fijado con camión que avanza por la ruta */
  function initProcess() {
    const sec = $('#proceso');
    const pin = $('#processPin');
    const steps = $('#steps');
    const fill = $('#processFill');
    const truck = $('#processTruck');
    const road = $('#processRoad');
    if (!sec || !pin || !steps) return;
    const mm = gsap.matchMedia();

    mm.add('(min-width: 1024px)', () => {
      sec.classList.add('is-h');
      const travel = () => Math.max(0, steps.scrollWidth - root.clientWidth);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: pin, start: 'top top', end: () => `+=${travel()}`, pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true },
      });
      tl.to(steps, { x: () => -travel() }, 0)
        .to(fill, { scaleX: 1 }, 0)
        .to(truck, { x: () => road.clientWidth - truck.getBoundingClientRect().width }, 0);
      return () => sec.classList.remove('is-h');
    });
  }

  /* Misión: las palabras se encienden al avanzar el scroll */
  function initManifesto() {
    const el = $('#manifesto');
    if (!el) return;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = '';
    text.split(' ').forEach((word, i, arr) => {
      const s = document.createElement('span');
      s.className = 'mw';
      s.textContent = word;
      el.appendChild(s);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.classList.add('is-words');
    gsap.fromTo($$('.mw', el), { opacity: 0.16 }, {
      opacity: 1, ease: 'none', stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: true },
    });
  }

  /* ---------------------------------------------------------------
     10. Flota: acordeón de imágenes
     --------------------------------------------------------------- */
  function initFleet() {
    const wrap = $('#units');
    if (!wrap) return;
    const units = $$('.unit', wrap);
    const activate = (u) => {
      units.forEach((x) => {
        const on = x === u;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-expanded', String(on));
        $('.unit__more', x).inert = !on;
      });
    };
    units.forEach((u, i) => {
      u.setAttribute('role', 'group');
      u.addEventListener('click', () => activate(u));
      u.addEventListener('focusin', () => activate(u));
      if (finePointer) u.addEventListener('pointerenter', () => activate(u));
      u.addEventListener('keydown', (e) => {
        if (e.target !== u) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); units[(i + 1) % units.length].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); units[(i - 1 + units.length) % units.length].focus(); }
      });
    });
    activate(units[0]);
  }

  /* ---------------------------------------------------------------
     11. Mapa de rutas (constelación de destinos desde Veracruz)
     --------------------------------------------------------------- */
  function initMap() {
    const svg = $('#mapSvg');
    const wrap = $('#map');
    const dest = $('#dest');
    const more = $('#destMore');
    const chips = $$('#dest li');
    if (!svg || !wrap || !chips.length) return;

    const NS = 'http://www.w3.org/2000/svg';
    const make = (name, attrs = {}, parent = svg) => {
      const n = document.createElementNS(NS, name);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      parent.appendChild(n);
      return n;
    };

    const [oLat, oLon] = wrap.dataset.origin.split(',').map(Number);
    const minLon = -104.5, maxLon = -86.0, maxLat = 25.9, minLat = 17.4;
    const proj = (lat, lon) => [
      40 + ((lon - minLon) / (maxLon - minLon)) * 920,
      40 + ((maxLat - lat) / (maxLat - minLat)) * 420,
    ];
    const LEFT = new Set(['Xalapa', 'CDMX', 'Quintana Roo']);
    // orden de prioridad para mostrar etiquetas cuando hay poco espacio
    const PRIORITY = ['CDMX', 'Monterrey', 'Villahermosa', 'Yucatán', 'Guadalajara', 'Quintana Roo', 'Puebla', 'Querétaro', 'Xalapa'];

    // silueta estilizada del territorio (lat, lon); los bordes salen del encuadre a propósito
    const LAND = [
      [27.5, -110], [27.5, -97.4], [26.0, -97.15], [25.0, -97.45], [24.0, -97.65], [23.2, -97.78], [22.4, -97.85],
      [21.8, -97.7], [21.2, -97.4], [20.96, -97.35], [20.5, -97.0], [20.2, -96.75], [19.8, -96.45], [19.3, -96.3],
      [19.17, -96.12], [18.8, -95.9], [18.6, -95.1], [18.2, -94.6], [18.15, -94.2], [18.35, -93.4], [18.55, -92.6],
      [18.65, -91.85], [19.35, -90.75], [19.85, -90.55], [20.85, -90.4], [21.28, -89.66], [21.55, -88.3], [21.6, -87.1],
      [21.15, -86.8], [20.2, -87.45], [19.5, -87.4], [18.3, -87.85], [18.5, -88.3], [17.9, -88.9], [17.82, -89.15],
      [17.82, -90.98], [17.3, -91.4], [15.5, -91.4], [15.5, -97.0], [16.6, -98.8], [16.85, -99.9], [17.64, -101.55],
      [17.95, -102.2], [18.7, -103.7], [19.05, -104.3], [19.4, -105.0], [19.9, -106.6],
    ];
    make('path', {
      class: 'm-land',
      d: `M${LAND.map(([la, lo]) => proj(la, lo).map((n) => n.toFixed(1)).join(' ')).join(' L')}Z`,
    });

    const grid = make('g', { class: 'm-grid' });
    for (let x = 40; x <= 960; x += 46) make('line', { x1: x, y1: 18, x2: x, y2: 482 }, grid);
    for (let y = 40; y <= 460; y += 42) make('line', { x1: 18, y1: y, x2: 982, y2: y }, grid);

    const [ox, oy] = proj(oLat, oLon);
    const gArcs = make('g'), gPulses = make('g'), gNodes = make('g'), gLabels = make('g');

    const items = chips.map((li) => {
      const [lat, lon] = li.dataset.ll.split(',').map(Number);
      const [x, y] = proj(lat, lon);
      const dist = Math.hypot(x - ox, y - oy);
      const cx = (ox + x) / 2;
      const cy = (oy + y) / 2 - dist * 0.2;
      const d = `M${ox.toFixed(1)} ${oy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
      const name = li.textContent.trim();
      const major = li.hasAttribute('data-major');
      const left = LEFT.has(name);

      const arc = make('path', { class: 'm-arc', d }, gArcs);
      // pulso que viaja por la ruta; inicio negativo = ya está en marcha desde el primer cuadro
      const dur = 3.4 + Math.random() * 3;
      const pulse = make('circle', { class: 'm-pulse', r: 2.8 }, gPulses);
      make('animateMotion', { dur: `${dur.toFixed(2)}s`, begin: `-${(Math.random() * dur).toFixed(2)}s`, repeatCount: 'indefinite', path: d }, pulse);
      const node = make('circle', { class: 'm-node', cx: x.toFixed(1), cy: y.toFixed(1), r: major ? 5 : 3.4 }, gNodes);
      const label = make('text', {
        class: 'm-label', x: (x + (left ? -9 : 9)).toFixed(1), y: (y + 4).toFixed(1),
        'text-anchor': left ? 'end' : 'start',
      }, gLabels);
      label.textContent = name;
      label.style.opacity = '0';
      return { li, arc, pulse, node, label, name, major, region: li.dataset.region, hl: false };
    });

    // origen: Veracruz (base)
    make('circle', { class: 'm-ring', cx: ox.toFixed(1), cy: oy.toFixed(1), r: 8 });
    make('circle', { class: 'm-origin', cx: ox.toFixed(1), cy: oy.toFixed(1), r: 7 });
    const originLabel = make('text', { class: 'm-label', x: (ox + 14).toFixed(1), y: (oy + 22).toFixed(1) });
    originLabel.textContent = 'Veracruz (base)';
    originLabel.style.fontWeight = '800';

    let region = 'all';
    let fs = 24;

    // coloca etiquetas por prioridad sin que se encimen
    const layoutLabels = () => {
      const placed = [originLabel.getBBox()];
      const pad = fs * 0.35;
      const hits = (a, b) => !(a.x > b.x + b.width + pad || a.x + a.width < b.x - pad || a.y > b.y + b.height + pad || a.y + a.height < b.y - pad);
      const pool = items.filter((it) => region === 'all' ? it.major : it.region === region);
      pool.sort((a, b) => {
        const ia = PRIORITY.indexOf(a.name), ib = PRIORITY.indexOf(b.name);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      const show = new Set();
      pool.forEach((it) => {
        const box = it.label.getBBox();
        if (!placed.some((p) => hits(p, box))) { placed.push(box); show.add(it); }
      });
      items.forEach((it) => { it.label.style.opacity = it.hl || show.has(it) ? '1' : '0'; });
    };

    const fit = () => {
      const width = Math.max(280, svg.getBoundingClientRect().width);
      fs = clamp((1000 / width) * 11.5, 11, 30);
      [...items.map((i) => i.label), originLabel].forEach((l) => { l.style.fontSize = `${fs.toFixed(1)}px`; });
      layoutLabels();
    };
    new ResizeObserver(fit).observe(svg);
    fit();

    // resaltado individual (hover en escritorio, toque en móvil)
    const highlight = (it, on) => {
      it.hl = on;
      it.arc.classList.toggle('is-hl', on);
      it.node.classList.toggle('is-hl', on);
      it.li.classList.toggle('is-hl', on);
      layoutLabels();
    };
    items.forEach((it) => {
      let timer = 0;
      it.li.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') highlight(it, true); });
      it.li.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') highlight(it, false); });
      it.node.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') highlight(it, true); });
      it.node.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') highlight(it, false); });
      it.li.addEventListener('click', () => {
        items.forEach((o) => { if (o !== it && o.hl) highlight(o, false); });
        highlight(it, true);
        clearTimeout(timer);
        timer = setTimeout(() => highlight(it, false), 2600);
      });
    });

    // lista de destinos: en móvil se muestra colapsada
    let expanded = false;
    const syncList = () => {
      const visible = items.filter((it) => !it.li.classList.contains('is-hidden')).length;
      const needs = matchMedia('(max-width: 899px)').matches && visible > 9;
      dest.classList.toggle('is-collapsed', needs && !expanded);
      more.hidden = !needs;
      more.setAttribute('aria-expanded', String(expanded));
      more.textContent = expanded ? 'Ver menos destinos' : `Ver los ${visible} destinos`;
    };
    more.addEventListener('click', () => { expanded = !expanded; syncList(); });
    matchMedia('(max-width: 899px)').addEventListener('change', syncList);

    // filtro por región
    const tabs = $$('.tab');
    tabs.forEach((tab) => tab.addEventListener('click', () => {
      region = tab.dataset.region;
      expanded = false;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-pressed', String(on));
      });
      items.forEach((it) => {
        const match = region === 'all' || it.region === region;
        it.li.classList.toggle('is-hidden', !match);
        [it.arc, it.node, it.pulse, it.label].forEach((n) => n.classList.toggle('is-dim', !match));
      });
      layoutLabels();
      syncList();
    }));
    syncList();

    // las animaciones SMIL se pausan fuera de pantalla
    if (reduced) { svg.pauseAnimations(); return; }
    new IntersectionObserver(([e]) => (e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations())).observe(wrap);
  }

  /* ---------------------------------------------------------------
     12. Preguntas frecuentes (apertura animada)
     --------------------------------------------------------------- */
  function initFaq() {
    $$('.qa').forEach((d) => {
      const summary = $('summary', d);
      const answer = $('.qa__a', d);
      let anim = null;
      summary.addEventListener('click', (e) => {
        if (reduced) return;
        e.preventDefault();
        if (anim) anim.cancel();
        if (!d.open) {
          d.open = true;
          const h = answer.offsetHeight;
          anim = answer.animate({ height: ['0px', `${h}px`] }, { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' });
          anim.onfinish = () => { anim = null; };
        } else {
          const h = answer.offsetHeight;
          anim = answer.animate({ height: [`${h}px`, '0px'] }, { duration: 340, easing: 'cubic-bezier(.7,0,.2,1)' });
          anim.onfinish = () => { d.open = false; anim = null; };
        }
      });
    });
  }

  /* ---------------------------------------------------------------
     13. Formulario de cotización: validación + redirección a WhatsApp
     --------------------------------------------------------------- */
  function initForm() {
    const form = $('#quoteForm');
    if (!form) return;
    const status = $('#formStatus');

    const rules = {
      nombre: (v) => v.trim().length >= 2 || 'Escribe tu nombre para poder atenderte.',
      telefono: (v) => v.replace(/\D/g, '').length >= 10 || 'Escribe un teléfono de 10 dígitos.',
      servicio: (v) => !!v || 'Elige qué necesitas.',
    };

    const validate = (name) => {
      const input = form.elements[name];
      const field = input.closest('.field');
      const err = $('.field__err', field);
      const result = rules[name](input.value);
      const ok = result === true;
      field.classList.toggle('is-bad', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      err.textContent = ok ? '' : result;
      return ok;
    };

    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      input.addEventListener('blur', () => validate(name));
      input.addEventListener('input', () => { if (input.closest('.field').classList.contains('is-bad')) validate(name); });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let first = null;
      Object.keys(rules).forEach((name) => { if (!validate(name) && !first) first = form.elements[name]; });
      if (first) {
        first.focus();
        status.textContent = 'Revisa los campos marcados.';
        return;
      }
      status.textContent = '';

      const d = Object.fromEntries(new FormData(form));
      const fecha = d.fecha ? d.fecha.split('-').reverse().join('/') : '';
      const lines = [
        'Hola, quiero solicitar una cotización con Fletes y Mudanzas JC.',
        '',
        `*Nombre:* ${d.nombre.trim()}`,
        `*Teléfono:* ${d.telefono.trim()}`,
        `*Servicio:* ${d.servicio}`,
      ];
      if (d.origen && d.origen.trim()) lines.push(`*Origen:* ${d.origen.trim()}`);
      if (d.destino && d.destino.trim()) lines.push(`*Destino:* ${d.destino.trim()}`);
      if (fecha) lines.push(`*Fecha aproximada:* ${fecha}`);
      if (d.unidad) lines.push(`*Unidad:* ${d.unidad}`);
      if (d.detalles && d.detalles.trim()) lines.push('', `*Detalles:* ${d.detalles.trim()}`);
      const url = waLink(lines.join('\n'));

      form.classList.add('is-sending');
      const win = window.open(url, '_blank');
      if (win) win.opener = null;
      setTimeout(() => {
        form.classList.remove('is-sending');
        status.innerHTML = win
          ? '¡Listo! Abrimos WhatsApp con tu solicitud.'
          : `Toca <a href="${url}" target="_blank" rel="noopener">aquí para abrir WhatsApp</a> con tu solicitud.`;
        if (!win) location.href = url;
      }, 900);
    });
  }

  /* ---------------------------------------------------------------
     14. Detalles finales: marquesina reactiva, botón flotante, año
     --------------------------------------------------------------- */
  function initMarqueeSpeed() {
    const track = $('.marquee__track');
    if (!lenis || !track || reduced) return;
    const anim = track.getAnimations()[0];
    if (!anim) return;
    lenis.on('scroll', ({ velocity }) => { anim.playbackRate = 1 + Math.min(5, Math.abs(velocity) * 0.4); });
  }

  function initFab() {
    const fab = $('#fab');
    if (!fab) return;
    setTimeout(() => {
      fab.classList.add('is-tip');
      setTimeout(() => fab.classList.remove('is-tip'), 6500);
    }, 5200);
    $('.fab__btn', fab).addEventListener('pointerenter', () => fab.classList.add('is-tip'));
    $('.fab__btn', fab).addEventListener('pointerleave', () => fab.classList.remove('is-tip'));
    $('.fab__btn', fab).addEventListener('focus', () => fab.classList.add('is-tip'));
    $('.fab__btn', fab).addEventListener('blur', () => fab.classList.remove('is-tip'));
  }

  /* ---------------------------------------------------------------
     ARRANQUE
     --------------------------------------------------------------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  initLenis();
  initAnchors();
  initNav();
  initReveals();
  initCounters();
  initPointerFx();
  initTilt();
  initFleet();
  initMap();
  initFaq();
  initForm();
  initScrollScenes();

  runLoader(() => {
    isReady = true;
    root.classList.remove('is-loading');
    root.classList.add('is-ready');
    if (lenis) lenis.start();
    initCycle();
    initNet();
    initMarqueeSpeed();
    initFab();
    if (hasGSAP) {
      ScrollTrigger.refresh();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
      window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    }
  });
})();
