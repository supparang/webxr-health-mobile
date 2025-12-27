/* === /herohealth/vr/ui-karaoke.js ===
Karaoke UI (Lite) — 2 lines + word highlight + skip
- ROOT.KaraokeUI.play({ lines:[...], durationMs, onDone, title })
- ROOT.KaraokeUI.playGroup(groupId, {mode:'switch'|'boss'})
*/
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  const SONG_FULL = {
    0: ["อาหารหลัก 5 หมู่ของไทย", "ทุกคนจำไว้อย่าได้แปลผัน"],
    1: ["หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ด", "ช่วยให้เติบโตแข็งขัน"],
    2: ["หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล", "จะให้พลัง"],
    3: ["หมู่ 3 กินผักต่างๆ สารอาหารมากมาย", "กินเป็นอาจิณ"],
    4: ["หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้าง", "มีวิตามิน"],
    5: ["หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น", "อบอุ่นร่างกาย"]
  };

  const DEFAULTS = {
    durationMs: 6500,
    mode: 'switch',          // 'switch' | 'boss'
    title: '',
    allowSkip: true
  };

  function ensureUI() {
    let wrap = doc.querySelector('.hha-karaoke');
    if (wrap) return wrap;

    wrap = doc.createElement('div');
    wrap.className = 'hha-karaoke';
    wrap.innerHTML = `
      <div class="hha-karaoke__card">
        <div class="hha-karaoke__top">
          <div class="hha-karaoke__title"></div>
          <button class="hha-karaoke__skip" type="button">ข้าม</button>
        </div>
        <div class="hha-karaoke__lines">
          <div class="hha-karaoke__line" data-ln="0"></div>
          <div class="hha-karaoke__line" data-ln="1"></div>
        </div>
        <div class="hha-karaoke__bar"><i></i></div>
      </div>
    `;
    Object.assign(wrap.style, {
      position: 'fixed',
      left: '0',
      right: '0',
      top: '0',
      zIndex: '9999',
      pointerEvents: 'none',
      display: 'none'
    });

    // styles (inline safety)
    const st = doc.createElement('style');
    st.textContent = `
      .hha-karaoke{ padding: calc(env(safe-area-inset-top,0px) + 10px) 12px 0 12px; }
      .hha-karaoke__card{
        max-width: 720px; margin:0 auto;
        border-radius: 18px;
        background: rgba(2,6,23,.82);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: 0 18px 55px rgba(0,0,0,.40);
        padding: 12px 12px 10px 12px;
        backdrop-filter: blur(10px);
      }
      .hha-karaoke__top{ display:flex; align-items:center; gap:10px; }
      .hha-karaoke__title{
        flex:1; font-weight:800; letter-spacing:.2px;
        color:#e5e7eb; opacity:.95; font-size: 14px;
      }
      .hha-karaoke__skip{
        pointer-events:auto;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(15,23,42,.70);
        color:#e5e7eb;
        font-weight:700;
        padding: 6px 10px;
        font-size: 12px;
      }
      .hha-karaoke__lines{ margin-top:10px; }
      .hha-karaoke__line{
        font-size: 18px;
        line-height: 1.25;
        color:#e5e7eb;
        font-weight: 900;
        text-shadow: 0 10px 30px rgba(0,0,0,.45);
        margin: 6px 0;
        word-break: break-word;
      }
      .hha-karaoke__line span{ opacity:.55; transition: opacity .12s ease, transform .12s ease; display:inline-block; }
      .hha-karaoke__line span.on{ opacity:1; transform: translateY(-1px) scale(1.02); }
      .hha-karaoke__bar{
        margin-top: 10px; height: 6px; border-radius: 999px;
        background: rgba(148,163,184,.18);
        overflow: hidden;
      }
      .hha-karaoke__bar i{
        display:block; height:100%; width:0%;
        background: rgba(34,197,94,.95);
        border-radius: 999px;
        transform: translateZ(0);
      }
      @media (max-width: 420px){
        .hha-karaoke__line{ font-size: 16px; }
      }
    `;
    doc.head.appendChild(st);

    doc.body.appendChild(wrap);
    return wrap;
  }

  function splitWords(line) {
    // keep spaces by rebuilding with trailing space
    const parts = String(line || '').trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts : [''];
  }

  function renderLine(el, line) {
    const words = splitWords(line);
    el.innerHTML = words.map(w => `<span>${escapeHtml(w)} </span>`).join('');
    return el.querySelectorAll('span');
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  function setBar(barI, pct) {
    barI.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }

  let running = null;

  function stopCurrent(reason) {
    if (!running) return;
    const r = running;
    running = null;

    try { r.cleanup && r.cleanup(); } catch(e){}
    try { r.onDone && r.onDone({ reason: reason || 'stop' }); } catch(e){}
  }

  function play(opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const ui = ensureUI();
    const card = ui.querySelector('.hha-karaoke__card');
    const titleEl = ui.querySelector('.hha-karaoke__title');
    const skipBtn = ui.querySelector('.hha-karaoke__skip');
    const line0 = ui.querySelector('.hha-karaoke__line[data-ln="0"]');
    const line1 = ui.querySelector('.hha-karaoke__line[data-ln="1"]');
    const barI  = ui.querySelector('.hha-karaoke__bar i');

    stopCurrent('interrupt');

    const lines = Array.isArray(o.lines) ? o.lines.slice(0,2) : [];
    const L0 = lines[0] || '';
    const L1 = lines[1] || '';

    titleEl.textContent = o.title || (o.mode === 'boss' ? 'Boss Intro 🎤' : 'คาราโอเกะ 5 หมู่ 🎶');
    skipBtn.style.display = o.allowSkip ? 'inline-flex' : 'none';

    const spans0 = renderLine(line0, L0);
    const spans1 = renderLine(line1, L1);

    ui.style.display = 'block';
    ui.style.pointerEvents = 'none';
    skipBtn.style.pointerEvents = o.allowSkip ? 'auto' : 'none';

    // notify (optional) — ถ้าอยาก log ภายหลัง
    doc.dispatchEvent(new CustomEvent('hha:karaoke', { detail: { phase:'start', mode:o.mode, title:titleEl.textContent, lines:[L0,L1] } }));

    const duration = Math.max(1200, Number(o.durationMs) || 6500);
    const start = performance.now();

    // word schedule: first line 55% time, second 45%
    const t0 = Math.floor(duration * 0.55);
    const t1 = duration - t0;

    let tmr = null;
    let raf = null;

    function runWords(spans, tTotal, onDoneLine) {
      const n = Math.max(1, spans.length);
      let i = 0;
      spans.forEach(s => s.classList.remove('on'));
      spans[0] && spans[0].classList.add('on');

      const step = Math.max(70, Math.floor(tTotal / n));
      tmr = setInterval(() => {
        i++;
        spans.forEach(s => s.classList.remove('on'));
        const idx = Math.min(n - 1, i);
        if (spans[idx]) spans[idx].classList.add('on');
        if (i >= n - 1) {
          clearInterval(tmr); tmr = null;
          onDoneLine && onDoneLine();
        }
      }, step);
    }

    function tickBar() {
      const now = performance.now();
      const p = (now - start) / duration;
      setBar(barI, Math.floor(p * 100));
      if (p >= 1) return;
      raf = requestAnimationFrame(tickBar);
    }

    function finish(reason) {
      stopCurrent(reason || 'done');
      ui.style.display = 'none';
      setBar(barI, 0);
      doc.dispatchEvent(new CustomEvent('hha:karaoke', { detail: { phase:'end', reason: reason || 'done', mode:o.mode } }));
    }

    function cleanup() {
      if (tmr) { clearInterval(tmr); tmr = null; }
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      skipBtn.removeEventListener('click', onSkip);
    }

    function onSkip(e) {
      e && e.preventDefault();
      finish('skip');
    }

    skipBtn.addEventListener('click', onSkip);

    running = { cleanup, onDone: o.onDone };

    // animate
    tickBar();
    runWords(spans0, t0, () => {
      runWords(spans1, t1, () => finish('done'));
    });

    return true;
  }

  function playPromise(opts) {
    return new Promise((resolve) => {
      play(Object.assign({}, opts, { onDone: resolve }));
    });
  }

  function playGroup(groupId, opts) {
    const g = Number(groupId) || 0;
    const mode = (opts && opts.mode) || 'switch';
    const lines = SONG_FULL[g] || SONG_FULL[0];
    const durationMs = mode === 'boss' ? 4800 : 6500;
    const title =
      mode === 'boss'
        ? `ก่อนสู้บอส — ทวนหมู่ ${g} ⚔️🎤`
        : `เปลี่ยนหมู่ ${g} 🎶`;

    return playPromise({ lines, durationMs, mode, title, allowSkip: true });
  }

  root.KaraokeUI = {
    play,
    playPromise,
    playGroup,
    stop: stopCurrent
  };
})(typeof window !== 'undefined' ? window : globalThis);