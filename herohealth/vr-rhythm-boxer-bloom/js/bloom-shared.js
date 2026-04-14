// /herohealth/vr-rhythm-boxer-bloom/js/bloom-shared.js
'use strict';

(function (W) {
  const D = W.document;

  function q(searchParams, key, fallback = '') {
    const v = searchParams.get(key);
    return v == null || v === '' ? fallback : v;
  }

  function clamp(v, a, b) {
    v = Number(v);
    if (!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function avg(arr) {
    if (!Array.isArray(arr) || !arr.length) return 0;
    return arr.reduce((s, x) => s + Number(x || 0), 0) / arr.length;
  }

  function resolveView(rawView) {
    const raw = String(rawView || '').toLowerCase();
    const touchDevice =
      (W.matchMedia && W.matchMedia('(pointer: coarse)').matches) ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    if (raw === 'pc' || raw === 'mobile' || raw === 'cvr') return raw;
    return touchDevice ? 'mobile' : 'pc';
  }

  function createParams(searchParams, extraDefaults = {}) {
    const defaults = {
      pid: 'anon',
      name: 'Player',
      studyId: '',
      diff: 'normal',
      time: '60',
      seed: String(Date.now()),
      view: '',
      run: 'play',
      hub: '../fitness-zone.html',
      back: '../vr-rhythm-boxer-bloom/index.html',
      next: '../vr-rhythm-boxer-main/boxer.html',
      zone: 'fitness',
      cat: 'fitness',
      cooldown: '1',
      gate: '1',
      autoNext: '',
      planDay: '',
      planSlot: '',
      theme: 'rhythmboxer'
    };

    const merged = Object.assign({}, defaults, extraDefaults);
    const out = {};

    Object.keys(merged).forEach((key) => {
      out[key] = q(searchParams, key, merged[key]);
    });

    out.time = Number(out.time || 60);
    out.seed = Number(out.seed || Date.now());
    out.view = resolveView(out.view);

    return out;
  }

  function passthroughUrl(base, searchParams, extra = {}) {
    const u = new URL(base, W.location.href);

    const allow = [
      'pid', 'name', 'studyId', 'diff', 'time', 'seed', 'view', 'run',
      'hub', 'zone', 'cat', 'theme', 'planDay', 'planSlot',
      'cooldown', 'gate', 'autoNext',
      'debug', 'api', 'log', 'studentKey', 'schoolCode',
      'classRoom', 'studentNo', 'nickName', 'teacher',
      'teacherMode', 'export', 'exportMode'
    ];

    for (const key of allow) {
      const v = searchParams.get(key);
      if (v != null && v !== '') u.searchParams.set(key, v);
    }

    Object.entries(extra).forEach(([key, value]) => {
      if (value == null || value === '') return;
      u.searchParams.set(key, String(value));
    });

    return u.toString();
  }

  function setCommonLinks(cfg) {
    const {
      searchParams,
      backEl,
      hubTopEl,
      hubEl,
      mainGameEl,
      nextEl,
      backHref,
      hubHref,
      nextHref,
      mainGameHref
    } = cfg;

    if (backEl) backEl.href = passthroughUrl(backHref || '../vr-rhythm-boxer-bloom/index.html', searchParams);
    if (hubTopEl) hubTopEl.href = passthroughUrl(hubHref || q(searchParams, 'hub', '../fitness-zone.html'), searchParams);
    if (hubEl) hubEl.href = passthroughUrl(hubHref || q(searchParams, 'hub', '../fitness-zone.html'), searchParams);
    if (nextEl) nextEl.href = passthroughUrl(nextHref || q(searchParams, 'next', '../vr-rhythm-boxer-main/boxer.html'), searchParams);
    if (mainGameEl) mainGameEl.href = passthroughUrl(mainGameHref || '../vr-rhythm-boxer-main/boxer.html', searchParams);
  }

  function showFeedback(el, text, duration = 420) {
    if (!el) return;
    el.textContent = text || '';
    el.classList.add('show');
    clearTimeout(el.__hideTimer);
    el.__hideTimer = setTimeout(() => {
      el.classList.remove('show');
      el.textContent = '';
    }, duration);
  }

  function startCountdown(countdownWrap, countdownNum, seconds, onDone) {
    if (!countdownWrap || !countdownNum) {
      onDone && onDone();
      return;
    }

    const t0 = performance.now();

    function step(now) {
      const left = seconds - Math.floor((now - t0) / 1000);
      countdownNum.textContent = String(Math.max(1, left));

      if ((now - t0) >= seconds * 1000) {
        countdownWrap.classList.add('hidden');
        onDone && onDone();
        return;
      }
      W.requestAnimationFrame(step);
    }

    W.requestAnimationFrame(step);
  }

  function saveSummary(gameKey, pid, payload) {
    try {
      W.localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(payload));
      W.localStorage.setItem(`HHA_LAST_SUMMARY:${gameKey}:${pid}`, JSON.stringify(payload));

      const histKey = `HHA_SUMMARY_HISTORY:${gameKey}:${pid}`;
      const hist = JSON.parse(W.localStorage.getItem(histKey) || '[]');
      hist.push(payload);
      W.localStorage.setItem(histKey, JSON.stringify(hist.slice(-30)));
    } catch (_) {}
  }

  function readSummary(gameKey, pid) {
    try {
      const raw = W.localStorage.getItem(`HHA_LAST_SUMMARY:${gameKey}:${pid}`);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function readLastSummary() {
    try {
      const raw = W.localStorage.getItem('HHA_LAST_SUMMARY');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  async function loadVrUiIfNeeded(view) {
    if (view !== 'cvr') return;
    try {
      await import('../vr/vr-ui.js?v=20260307b');
    } catch (err) {
      console.warn('[RBBloom] vr-ui import failed', err);
    }
  }

  function attachCvrInput(opts) {
    const state = opts.state;
    const onShoot = opts.onShoot;
    const onRecenter = opts.onRecenter;

    W.addEventListener('deviceorientation', (ev) => {
      if (typeof ev.gamma === 'number') state.gamma = ev.gamma;
    });

    W.addEventListener('mousemove', (ev) => {
      const ratio = ev.clientX / Math.max(1, W.innerWidth);
      state.gamma = (ratio * 80) - 40;
    });

    W.addEventListener('hha:shoot', () => {
      onShoot && onShoot();
    });

    W.addEventListener('hha:recenter', () => {
      onRecenter && onRecenter();
    });
  }

  function makeCvrFocusLoop(state, getCount, onIndexChange) {
    return function loop() {
      const raw = state.gamma || 0;
      state.gammaSmooth += (raw - state.gammaSmooth) * 0.14;
      const g = clamp(state.gammaSmooth - state.gammaOffset, -40, 40);

      const count = Math.max(1, Number(getCount() || 1));
      const index = clamp(Math.floor(((g + 40) / 80) * count), 0, count - 1);

      const now = performance.now();
      if (now >= state.laneLockUntil && index !== state.cvrIndex) {
        state.cvrIndex = index;
        state.laneLockUntil = now + 90;
        onIndexChange && onIndexChange(index);
      } else if (now >= state.laneLockUntil) {
        onIndexChange && onIndexChange(state.cvrIndex);
      }

      W.requestAnimationFrame(loop);
    };
  }

  function reCenterCvr(state, feedbackEl) {
    state.gammaOffset = state.gammaSmooth || 0;
    showFeedback(feedbackEl, 'RECENTER');
  }

  function accuracy(correct, total) {
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }

  W.RBBloom = {
    q,
    clamp,
    avg,
    nowIso,
    resolveView,
    createParams,
    passthroughUrl,
    setCommonLinks,
    showFeedback,
    startCountdown,
    saveSummary,
    readSummary,
    readLastSummary,
    loadVrUiIfNeeded,
    attachCvrInput,
    makeCvrFocusLoop,
    reCenterCvr,
    accuracy
  };
})(window);