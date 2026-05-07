/* =========================================================
 * /english/js/lesson-final-route-voice-clean.js
 * PATCH v20260507-FINAL-ROUTE-VOICE-CLEAN
 *
 * ✅ เหลือ Mission Route แถวเดียว
 * ✅ เลื่อน S01–S15 ด้วยปุ่ม/ปัดแบบ carousel
 * ✅ ซ่อน route patch เก่าที่ซ้อนกัน
 * ✅ เหลือ voice picker เดียว
 * ✅ เลือกเสียงแล้ว AI Help ใช้เสียงนั้นจริง
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-final-route-voice-clean-v20260507';

  const ROUTE = [
    { id: 'S01', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S02', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S03', skill: 'WRITING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S04', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S05', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S06', skill: 'READING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S07', skill: 'WRITING',   icon: '⌨️', type: 'normal', label: 'PLAY' },
    { id: 'S08', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S09', skill: 'SPEAKING',  icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S10', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S11', skill: 'LISTENING', icon: '🎧', type: 'normal', label: 'PLAY' },
    { id: 'S12', skill: 'WRITING',   icon: '👾', type: 'boss',   label: 'BOSS' },
    { id: 'S13', skill: 'READING',   icon: '📖', type: 'normal', label: 'PLAY' },
    { id: 'S14', skill: 'SPEAKING',  icon: '🎙️', type: 'normal', label: 'PLAY' },
    { id: 'S15', skill: 'LISTENING', icon: '🌐', type: 'final',  label: 'FINAL' }
  ];

  const VOICE_KEY = 'TECHPATH_AIHELP_SELECTED_VOICE_URI';
  const OLD_VOICE_KEY = 'LESSON_AIHELP_SELECTED_VOICE_V1';

  let activeIndex = 0;
  let rail = null;
  let viewport = null;
  let progress = null;
  let didDrag = false;
  let originalSpeak = null;

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function txt(el) {
    return String(el && el.textContent ? el.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function setI(el, prop, value) {
    if (el && el.style) el.style.setProperty(prop, value, 'important');
  }

  function qs(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (e) {
      return d;
    }
  }

  function injectStyle() {
    if (document.getElementById(PATCH_ID + '-style')) return;

    const style = document.createElement('style');
    style.id = PATCH_ID + '-style';
    style.textContent = `
      html, body {
        overflow-x: hidden !important;
        max-width: 100% !important;
      }

      #lessonRouteCarouselForce,
      #lessonRouteFloatNav,
      #lessonRouteRebuildShell,
      #lessonRouteHardControls,
      #lessonRouteRebuildControls,
      #lessonUsVoiceDoctor,
      #lessonAiHelpVoicePicker,
      #lessonAiHelpVoiceBadge,
      #lessonAiHelpVoiceLockBadge,
      #lessonUsVoiceToast {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      #lessonFinalRouteClean {
        width: 100% !important;
        max-width: 100% !important;
        margin: 18px 0 !important;
        padding: 18px !important;
        box-sizing: border-box !important;
        border-radius: 28px !important;
        border: 1px solid rgba(180,224,255,.20) !important;
        background:
          radial-gradient(circle at 20% 10%, rgba(104,226,255,.16), transparent 36%),
          radial-gradient(circle at 88% 24%, rgba(255,96,145,.12), transparent 34%),
          linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.06)) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 18px 52px rgba(0,0,0,.22) !important;
        color: #f0fbff !important;
        position: relative !important;
        z-index: 9000 !important;
      }

      #lessonFinalRouteClean .final-route-title {
        font: 1000 26px/1.15 system-ui,-apple-system,Segoe UI,sans-serif !important;
        margin: 0 0 8px !important;
      }

      #lessonFinalRouteClean .final-route-sub {
        color: rgba(220,238,255,.82) !important;
        font: 900 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif !important;
        margin: 0 0 12px !important;
      }

      #lessonFinalRouteClean .final-route-controls {
        display: grid !important;
        grid-template-columns: 52px 1fr 52px !important;
        gap: 10px !important;
        align-items: center !important;
        margin: 12px 0 10px !important;
      }

      #lessonFinalRouteClean .final-route-btn {
        width: 52px !important;
        height: 42px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(111,232,255,.48) !important;
        background: rgba(255,255,255,.13) !important;
        color: #eaffff !important;
        font: 1000 20px/1 system-ui,-apple-system,Segoe UI,sans-serif !important;
        box-shadow: 0 10px 26px rgba(0,0,0,.28) !important;
      }

      #lessonFinalRouteClean .final-route-progress {
        min-width: 0 !important;
        text-align: center !important;
        color: rgba(231,248,255,.92) !important;
        font: 900 12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif !important;
        padding: 9px 10px !important;
        border-radius: 999px !important;
        border: 1px solid rgba(111,232,255,.25) !important;
        background: rgba(255,255,255,.08) !important;
      }

      #lessonFinalRouteClean .final-route-viewport {
        overflow: hidden !important;
        touch-action: none !important;
        padding: 4px 0 16px !important;
      }

      #lessonFinalRouteClean .final-route-rail {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        gap: 14px !important;
        will-change: transform !important;
        transition: transform .28s cubic-bezier(.2,.9,.2,1) !important;
        padding: 0 8px !important;
      }

      #lessonFinalRouteClean.dragging .final-route-rail {
        transition: none !important;
      }

      #lessonFinalRouteClean .final-route-card {
        flex: 0 0 126px !important;
        width: 126px !important;
        min-width: 126px !important;
        height: 164px !important;
        border-radius: 24px !important;
        border: 1px solid rgba(196,234,255,.24) !important;
        background:
          radial-gradient(circle at 50% 18%, rgba(121,232,255,.18), transparent 38%),
          linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.07)) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 14px 34px rgba(0,0,0,.26) !important;
        color: #f1fbff !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 8px !important;
        text-align: center !important;
        cursor: pointer !important;
        user-select: none !important;
        touch-action: none !important;
      }

      #lessonFinalRouteClean .final-route-card.boss {
        border-color: rgba(255,100,145,.52) !important;
      }

      #lessonFinalRouteClean .final-route-card.final {
        border-color: rgba(255,215,98,.70) !important;
      }

      #lessonFinalRouteClean .final-route-card.active {
        border-color: rgba(105,232,255,.86) !important;
        box-shadow: 0 0 0 2px rgba(105,232,255,.16), 0 16px 40px rgba(0,0,0,.34), 0 0 32px rgba(105,232,255,.16) !important;
      }

      #lessonFinalRouteClean .final-route-icon {
        width: 54px !important;
        height: 54px !important;
        border-radius: 999px !important;
        display: grid !important;
        place-items: center !important;
        background: rgba(4,18,32,.28) !important;
        font-size: 27px !important;
      }

      #lessonFinalRouteClean .final-route-id {
        font-size: 22px !important;
        font-weight: 1000 !important;
        line-height: 1 !important;
      }

      #lessonFinalRouteClean .final-route-skill {
        font-size: 12px !important;
        font-weight: 1000 !important;
        opacity: .86 !important;
      }

      #lessonFinalRouteClean .final-route-label {
        padding: 5px 10px !important;
        border-radius: 999px !important;
        background: rgba(255,255,255,.15) !important;
        font-size: 12px !important;
        font-weight: 1000 !important;
      }

      #lessonFinalRouteClean .final-route-dots {
        display: flex !important;
        justify-content: center !important;
        gap: 5px !important;
        flex-wrap: wrap !important;
      }

      #lessonFinalRouteClean .final-route-dot {
        width: 7px !important;
        height: 7px !important;
        border-radius: 999px !important;
        border: 0 !important;
        padding: 0 !important;
        background: rgba(255,255,255,.25) !important;
      }

      #lessonFinalRouteClean .final-route-dot.active {
        width: 18px !important;
        background: rgba(105,232,255,.9) !important;
      }

      #lessonFinalVoiceClean {
        position: fixed !important;
        right: 10px !important;
        bottom: 88px !important;
        z-index: 999999 !important;
        width: min(430px, calc(100vw - 20px)) !important;
        border-radius: 18px !important;
        border: 1px solid rgba(105,232,255,.40) !important;
        background: rgba(6,18,34,.96) !important;
        color: #eaffff !important;
        box-shadow: 0 18px 48px rgba(0,0,0,.36) !important;
        overflow: hidden !important;
        font: 800 13px/1.45 system-ui,-apple-system,Segoe UI,sans-serif !important;
      }

      #lessonFinalVoiceClean summary {
        cursor: pointer !important;
        padding: 11px 13px !important;
        color: #75eeff !important;
        font-weight: 1000 !important;
      }

      #lessonFinalVoiceClean .voice-body {
        padding: 0 13px 13px !important;
      }

      #lessonFinalVoiceClean select {
        width: 100% !important;
        height: 42px !important;
        border-radius: 14px !important;
        border: 1px solid rgba(105,232,255,.35) !important;
        background: #101f32 !important;
        color: #eaffff !important;
        padding: 0 10px !important;
        font-weight: 900 !important;
      }

      #lessonFinalVoiceClean .voice-actions {
        display: flex !important;
        gap: 8px !important;
        margin-top: 10px !important;
      }

      #lessonFinalVoiceClean button {
        height: 40px !important;
        border-radius: 999px !important;
        border: 0 !important;
        background: #65e8ff !important;
        color: #06202a !important;
        font-weight: 1000 !important;
      }

      @media (max-width: 820px) {
        #lessonFinalRouteClean {
          width: calc(100vw - 20px) !important;
          max-width: calc(100vw - 20px) !important;
          margin-left: auto !important;
          margin-right: auto !important;
          padding: 14px !important;
        }

        #lessonFinalVoiceClean {
          left: 10px !important;
          right: 10px !important;
          bottom: 86px !important;
          width: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function cleanupOldPanels() {
    [
      'lessonRouteCarouselForce',
      'lessonRouteFloatNav',
      'lessonRouteRebuildShell',
      'lessonRouteHardControls',
      'lessonRouteRebuildControls',
      'lessonUsVoiceDoctor',
      'lessonAiHelpVoicePicker',
      'lessonAiHelpVoiceBadge',
      'lessonAiHelpVoiceLockBadge',
      'lessonUsVoiceToast'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        setI(el, 'display', 'none');
        setI(el, 'visibility', 'hidden');
        setI(el, 'pointer-events', 'none');
      }
    });

    const final = document.getElementById('lessonFinalRouteClean');

    Array.from(document.querySelectorAll('section, article, div')).forEach(el => {
      if (!el || el.id === 'lessonFinalRouteClean') return;
      if (final && el.contains(final)) return;
      if (final && final.contains(el)) return;

      const t = txt(el);
      if (/Mission Route/i.test(t) && /\bS0?1\b/i.test(t) && /\bS0?3\b/i.test(t)) {
        setI(el, 'display', 'none');
        setI(el, 'visibility', 'hidden');
        setI(el, 'pointer-events', 'none');
      }
    });
  }

  function findHero() {
    const all = Array.from(document.querySelectorAll('section, article, main > div, .card, .panel, .glass, .hero, div'));
    let best = null;
    let bestArea = 0;

    all.forEach(el => {
      const t = txt(el);
      if (!/future career|CS and AI|problem solving|Hybrid 3D/i.test(t)) return;

      const r = el.getBoundingClientRect();
      const area = r.width * r.height;

      if (area > bestArea) {
        best = el;
        bestArea = area;
      }
    });

    return best;
  }

  function buildRoute() {
    if (document.getElementById('lessonFinalRouteClean')) {
      rail = document.querySelector('#lessonFinalRouteClean .final-route-rail');
      viewport = document.querySelector('#lessonFinalRouteClean .final-route-viewport');
      progress = document.querySelector('#lessonFinalRouteClean .final-route-progress');
      return;
    }

    const shell = document.createElement('section');
    shell.id = 'lessonFinalRouteClean';

    shell.innerHTML = `
      <h2 class="final-route-title">Mission Route: S1 → S15</h2>
      <p class="final-route-sub">ผ่านด่านปกติ ปลดล็อก Boss และไปสู่ Final Network Mission</p>

      <div class="final-route-controls">
        <button class="final-route-btn" id="finalRoutePrev" type="button">←</button>
        <div class="final-route-progress">S01 / S15</div>
        <button class="final-route-btn" id="finalRouteNext" type="button">→</button>
      </div>

      <div class="final-route-viewport">
        <div class="final-route-rail">
          ${ROUTE.map((item, i) => `
            <button class="final-route-card ${esc(item.type)}" type="button" data-index="${i}" data-session="${esc(item.id)}">
              <div class="final-route-icon">${esc(item.icon)}</div>
              <div class="final-route-id">${esc(item.id)}</div>
              <div class="final-route-skill">${esc(item.skill)}</div>
              <div class="final-route-label">${esc(item.label)}</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="final-route-dots">
        ${ROUTE.map((_, i) => `<button class="final-route-dot" type="button" data-dot="${i}"></button>`).join('')}
      </div>
    `;

    const hero = findHero();

    if (hero && hero.parentElement) {
      hero.insertAdjacentElement('afterend', shell);
    } else {
      document.body.insertBefore(shell, document.body.firstChild);
    }

    rail = shell.querySelector('.final-route-rail');
    viewport = shell.querySelector('.final-route-viewport');
    progress = shell.querySelector('.final-route-progress');

    bindRouteControls(shell);
    bindSwipe(shell);
    updateRoute(true);
  }

  function getStep() {
    const card = rail ? rail.querySelector('.final-route-card') : null;
    if (!card) return 140;
    return Math.round(card.getBoundingClientRect().width + 14);
  }

  function clamp(i) {
    return Math.max(0, Math.min(ROUTE.length - 1, Number(i) || 0));
  }

  function updateRoute(instant) {
    if (!rail) return;

    activeIndex = clamp(activeIndex);
    const x = -activeIndex * getStep();

    if (instant) {
      rail.style.transition = 'none';
      rail.style.transform = `translate3d(${x}px,0,0)`;
      requestAnimationFrame(() => {
        rail.style.transition = '';
      });
    } else {
      rail.style.transform = `translate3d(${x}px,0,0)`;
    }

    const item = ROUTE[activeIndex];
    if (progress && item) {
      progress.textContent = `${item.id} / S15 • ${item.type === 'boss' ? 'Boss Mission' : item.type === 'final' ? 'Final Mission' : 'Normal Mission'} • ${item.skill}`;
    }

    document.querySelectorAll('#lessonFinalRouteClean .final-route-card').forEach(card => {
      card.classList.toggle('active', Number(card.dataset.index || 0) === activeIndex);
    });

    document.querySelectorAll('#lessonFinalRouteClean .final-route-dot').forEach(dot => {
      dot.classList.toggle('active', Number(dot.dataset.dot || 0) === activeIndex);
    });
  }

  function go(delta) {
    activeIndex = clamp(activeIndex + delta);
    updateRoute(false);
  }

  function goTo(index) {
    activeIndex = clamp(index);
    updateRoute(false);
  }

  function openSession(sid) {
    const n = Number(String(sid).replace('S', '')) || 1;

    window.LESSON_SESSION = sid;
    window.currentSession = sid;
    window.currentS = n;

    window.dispatchEvent(new CustomEvent('lesson:session-selected', {
      detail: { session: sid, sessionNo: n, source: PATCH_ID }
    }));

    const fns = [
      'selectSession',
      'startSession',
      'loadSession',
      'chooseSession',
      'openSession',
      'playSession',
      'goSession',
      'setSession',
      'startLessonSession'
    ];

    for (const name of fns) {
      if (typeof window[name] === 'function') {
        try { window[name](sid, n); return; } catch (e) {}
        try { window[name](n); return; } catch (e) {}
      }
    }

    const url = new URL(location.href);
    url.searchParams.set('s', String(n));
    url.searchParams.set('session', sid);
    location.href = url.toString();
  }

  function bindRouteControls(shell) {
    shell.querySelector('#finalRoutePrev').addEventListener('click', ev => {
      ev.preventDefault();
      go(-1);
    });

    shell.querySelector('#finalRouteNext').addEventListener('click', ev => {
      ev.preventDefault();
      go(1);
    });

    shell.querySelectorAll('.final-route-card').forEach(card => {
      card.addEventListener('click', ev => {
        ev.preventDefault();

        if (didDrag) return;

        const idx = Number(card.dataset.index || 0);
        const sid = card.dataset.session || ROUTE[idx].id;

        if (idx !== activeIndex) {
          goTo(idx);
          return;
        }

        openSession(sid);
      });
    });

    shell.querySelectorAll('.final-route-dot').forEach(dot => {
      dot.addEventListener('click', ev => {
        ev.preventDefault();
        goTo(Number(dot.dataset.dot || 0));
      });
    });
  }

  function bindSwipe(shell) {
    let down = false;
    let sx = 0;
    let sy = 0;
    let base = 0;
    let moved = false;

    viewport.addEventListener('pointerdown', ev => {
      down = true;
      moved = false;
      didDrag = false;
      sx = ev.clientX;
      sy = ev.clientY;
      base = -activeIndex * getStep();
      shell.classList.add('dragging');
    }, { passive: true });

    viewport.addEventListener('pointermove', ev => {
      if (!down) return;

      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;

      if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(dy)) return;

      moved = true;
      didDrag = true;
      rail.style.transform = `translate3d(${base + dx}px,0,0)`;
      ev.preventDefault();
    }, { passive: false });

    viewport.addEventListener('pointerup', ev => {
      if (!down) return;

      down = false;
      shell.classList.remove('dragging');

      const dx = ev.clientX - sx;

      if (moved && Math.abs(dx) > 36) {
        go(dx < 0 ? 1 : -1);
      } else {
        updateRoute(false);
      }

      setTimeout(() => { didDrag = false; }, 160);
    }, { passive: true });
  }

  function getVoices() {
    try {
      return window.speechSynthesis ? window.speechSynthesis.getVoices() || [] : [];
    } catch (e) {
      return [];
    }
  }

  function isEnglish(v) {
    return String(v.lang || '').toLowerCase().startsWith('en');
  }

  function isUS(v) {
    const s = `${v.name || ''} ${v.lang || ''}`;
    return /en-us|united states|google us|us english|samantha|alex/i.test(s);
  }

  function sortVoices(voices) {
    return voices.filter(isEnglish).sort((a, b) => {
      const au = isUS(a) ? 0 : 1;
      const bu = isUS(b) ? 0 : 1;
      if (au !== bu) return au - bu;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function getSelectedVoice() {
    const selected = localStorage.getItem(VOICE_KEY) || localStorage.getItem(OLD_VOICE_KEY) || '';
    const voices = sortVoices(getVoices());

    if (selected) {
      const found = voices.find(v => v.voiceURI === selected || v.name === selected);
      if (found) return found;
    }

    return voices.find(isUS) || voices[0] || null;
  }

  function buildVoicePicker() {
    if (document.getElementById('lessonFinalVoiceClean')) {
      populateVoicePicker();
      return;
    }

    const box = document.createElement('details');
    box.id = 'lessonFinalVoiceClean';
    box.open = false;

    box.innerHTML = `
      <summary>🔊 เลือกเสียง AI Help</summary>
      <div class="voice-body">
        <div style="font-size:12px;opacity:.82;margin:0 0 8px;">
          เลือกเสียง English ที่เครื่องนี้มีให้ใช้ — เสียง US จะอยู่ด้านบน
        </div>

        <select id="lessonFinalVoiceSelect">
          <option value="">Loading voices...</option>
        </select>

        <div class="voice-actions">
          <button id="lessonFinalVoiceTest" type="button" style="flex:1;">Test Voice</button>
          <button id="lessonFinalVoiceClose" type="button" style="width:86px;background:rgba(255,255,255,.12);color:#eaffff;border:1px solid rgba(105,232,255,.35);">Close</button>
        </div>

        <div id="lessonFinalVoiceNote" style="font-size:12px;opacity:.78;margin-top:8px;"></div>
      </div>
    `;

    document.body.appendChild(box);

    document.getElementById('lessonFinalVoiceSelect').addEventListener('change', function () {
      localStorage.setItem(VOICE_KEY, this.value);
      localStorage.setItem(OLD_VOICE_KEY, this.value);
      speakAIHelpFinal('Voice selected. I will use this voice for AI Help.');
      populateVoicePicker();
    });

    document.getElementById('lessonFinalVoiceTest').addEventListener('click', function () {
      speakAIHelpFinal('Hello. This is the selected voice for AI Help.');
    });

    document.getElementById('lessonFinalVoiceClose').addEventListener('click', function () {
      box.open = false;
    });

    populateVoicePicker();
  }

  function populateVoicePicker() {
    const select = document.getElementById('lessonFinalVoiceSelect');
    const note = document.getElementById('lessonFinalVoiceNote');
    if (!select) return;

    const voices = sortVoices(getVoices());
    const selectedVoice = getSelectedVoice();
    const selectedKey = selectedVoice ? selectedVoice.voiceURI : '';

    if (!voices.length) {
      select.innerHTML = `<option value="">No English voice found yet</option>`;
      if (note) note.innerHTML = 'ยังไม่พบเสียง English ให้กด refresh หน้าอีกครั้ง';
      return;
    }

    select.innerHTML = voices.map(v => {
      const tag = isUS(v) ? '🇺🇸 US • ' : 'EN • ';
      const selected = v.voiceURI === selectedKey ? 'selected' : '';
      return `<option value="${esc(v.voiceURI)}" ${selected}>${esc(tag + v.name + ' (' + v.lang + ')')}</option>`;
    }).join('');

    if (selectedVoice) {
      localStorage.setItem(VOICE_KEY, selectedVoice.voiceURI);
      localStorage.setItem(OLD_VOICE_KEY, selectedVoice.voiceURI);
    }

    if (note) {
      note.innerHTML = `เสียงที่ใช้ตอนนี้: <b>${selectedVoice ? esc(selectedVoice.name) : 'browser default'}</b>`;
    }
  }

  function cleanSpeakText(text) {
    return String(text || '')
      .replace(/[🎯🏠▶️📊🎤📖👾🎧🏆⭐🔥⚡💡✅❌]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function forceVoiceOnUtterance(u) {
    const voice = getSelectedVoice();

    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'en-US';
    } else {
      u.lang = 'en-US';
    }

    return u;
  }

  function speakAIHelpFinal(text, options = {}) {
    const msg = cleanSpeakText(text);
    if (!msg) return false;

    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      return false;
    }

    const u = new SpeechSynthesisUtterance(msg);
    u.rate = Number(options.rate || 0.86);
    u.pitch = Number(options.pitch || 1.02);
    u.volume = Number(options.volume || 1);

    forceVoiceOnUtterance(u);

    try { window.speechSynthesis.cancel(); } catch (e) {}
    window.speechSynthesis.speak(u);

    return true;
  }

  function patchSpeech() {
    if (!window.speechSynthesis || !window.speechSynthesis.speak) return;

    if (!originalSpeak) {
      originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    }

    window.speechSynthesis.speak = function (utterance) {
      try {
        const text = String(utterance && utterance.text ? utterance.text : '');
        const lang = String(utterance && utterance.lang ? utterance.lang : '').toLowerCase();
        const hasEnglish = /[A-Za-z]{3,}/.test(text);

        if (utterance && (hasEnglish || lang.startsWith('en'))) {
          forceVoiceOnUtterance(utterance);
        }
      } catch (e) {}

      return originalSpeak(utterance);
    };

    window.speakAIHelpUS = speakAIHelpFinal;

    window.LessonUSVoice = window.LessonUSVoice || {};
    window.LessonUSVoice.speak = speakAIHelpFinal;
    window.LessonUSVoice.getSelectedVoice = getSelectedVoice;

    window.TechPathVoiceFinal = {
      speak: speakAIHelpFinal,
      getSelectedVoice,
      refresh: populateVoicePicker,
      open: function () {
        buildVoicePicker();
        document.getElementById('lessonFinalVoiceClean').open = true;
      }
    };
  }

  function exposeDebug() {
    window.TechPathFinalClean = {
      next: () => go(1),
      prev: () => go(-1),
      goTo: x => {
        if (typeof x === 'string') {
          const idx = ROUTE.findIndex(r => r.id === x.toUpperCase());
          if (idx >= 0) goTo(idx);
        } else {
          goTo(Number(x || 0));
        }
      },
      voice: () => getSelectedVoice(),
      debug: () => ({
        patch: PATCH_ID,
        route: !!document.getElementById('lessonFinalRouteClean'),
        voicePicker: !!document.getElementById('lessonFinalVoiceClean'),
        selectedVoice: getSelectedVoice() ? {
          name: getSelectedVoice().name,
          lang: getSelectedVoice().lang,
          uri: getSelectedVoice().voiceURI
        } : null,
        activeIndex,
        activeSession: ROUTE[activeIndex]
      })
    };
  }

  function init() {
    injectStyle();
    cleanupOldPanels();
    buildRoute();
    buildVoicePicker();
    patchSpeech();
    exposeDebug();
    updateRoute(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    cleanupOldPanels();
    buildRoute();
    buildVoicePicker();
    patchSpeech();

    if (tries >= 30) clearInterval(timer);
  }, 500);

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      buildVoicePicker();
      populateVoicePicker();
      patchSpeech();
    };
  }
})();
