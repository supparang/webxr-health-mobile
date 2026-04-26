// === /english/js/lesson-next-session-fix.js ===
// PATCH v20260424d-LESSON-NEXT-SESSION-FIX
// Add Next Session button after mission pass.

(function () {
  'use strict';

  const VERSION = 'v20260424d-LESSON-NEXT-SESSION-FIX';
  const MAX_S = 15;

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function normalizeSid(v) {
    const raw = String(v || '').trim().toUpperCase();
    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(MAX_S, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }
    const n = Math.max(1, Math.min(MAX_S, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function currentSid() {
    try {
      if (window.LESSON_CURRENT_STATE?.sid) return normalizeSid(window.LESSON_CURRENT_STATE.sid);
      if (window.LESSON_ROUTER?.getStateFromUrl) {
        const st = window.LESSON_ROUTER.getStateFromUrl();
        if (st?.sid) return normalizeSid(st.sid);
      }
    } catch (err) {}

    const p = q();
    return normalizeSid(
      p.get('s') ||
      p.get('sid') ||
      p.get('session') ||
      p.get('unit') ||
      p.get('lesson') ||
      '1'
    );
  }

  function sidNumber(sid) {
    return parseInt(String(sid).replace('S', ''), 10) || 1;
  }

  function recommendedDiff() {
    try {
      const sid = currentSid();
      const d = window.LESSON_ROUTER?.getRecommendedDifficulty?.(sid);
      if (d) return d;
    } catch (err) {}

    const p = q();
    return p.get('diff') || p.get('difficulty') || 'normal';
  }

  function nextUrl() {
    const sid = currentSid();
    const n = sidNumber(sid);

    const url = new URL(location.href);

    if (n >= MAX_S) {
      // จบ S15 แล้ว กลับหน้า English home หรือหน้าเดิมถ้ามี hub
      const hub = q().get('hub');
      if (hub) return hub;

      url.pathname = url.pathname.replace(/\/lesson\.html$/i, '/index.html');
      url.searchParams.set('completed', '1');
      url.searchParams.set('from', 'S15');
      return url.toString();
    }

    const next = `S${n + 1}`;

    url.searchParams.set('s', String(n + 1));
    url.searchParams.set('sid', next);
    url.searchParams.set('diff', recommendedDiff());

    // ให้ router เป็นคนตัดสิน skill ตาม S ไม่ใช้ skill เก่าค้างจาก S ก่อนหน้า
    url.searchParams.delete('skill');
    url.searchParams.delete('stage');
    url.searchParams.delete('mission');
    url.searchParams.delete('type');

    return url.toString();
  }

  function ensureCSS() {
    if ($('#lesson-next-session-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-next-session-css';
    style.textContent = `
      #lessonNextSessionBar{
        position:fixed;
        left:12px;
        right:12px;
        bottom:max(12px, env(safe-area-inset-bottom));
        z-index:2147483647;
        max-width:980px;
        margin:0 auto;
        display:none;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:12px;
        border-radius:22px;
        border:2px solid rgba(34,197,94,.9);
        background:rgba(240,253,244,.98);
        color:#052e16;
        box-shadow:0 18px 60px rgba(0,0,0,.30);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      #lessonNextSessionBar.show{
        display:flex;
      }

      #lessonNextSessionText{
        font-weight:900;
        line-height:1.25;
      }

      #lessonNextSessionText small{
        display:block;
        color:#15803d;
        font-weight:800;
        margin-top:2px;
      }

      #lessonNextSessionBtn{
        border:0;
        border-radius:999px;
        padding:12px 18px;
        font-weight:1000;
        cursor:pointer;
        background:#22c55e;
        color:#052e16;
        box-shadow:0 10px 22px rgba(34,197,94,.26);
        white-space:nowrap;
      }

      #lessonNextSessionBtn:active{
        transform:translateY(1px);
      }

      @media (max-width:640px){
        #lessonNextSessionBar{
          left:8px;
          right:8px;
          bottom:max(8px, env(safe-area-inset-bottom));
          border-radius:18px;
          padding:10px;
        }

        #lessonNextSessionText{
          font-size:13px;
        }

        #lessonNextSessionBtn{
          padding:11px 13px;
          font-size:13px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBar() {
    ensureCSS();

    let bar = $('#lessonNextSessionBar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'lessonNextSessionBar';
    bar.innerHTML = `
      <div id="lessonNextSessionText">
        ✅ ผ่านด่านแล้ว
        <small id="lessonNextSessionSub">ไป Session ต่อไปได้เลย</small>
      </div>
      <button id="lessonNextSessionBtn" type="button">➡ ไปต่อ</button>
    `;

    document.body.appendChild(bar);

    $('#lessonNextSessionBtn').addEventListener('click', function () {
      location.href = nextUrl();
    });

    return bar;
  }

  function showNext(reason) {
    const bar = ensureBar();

    const sid = currentSid();
    const n = sidNumber(sid);
    const next = n >= MAX_S ? 'จบคอร์ส' : `S${n + 1}`;

    const sub = $('#lessonNextSessionSub');
    const btn = $('#lessonNextSessionBtn');

    if (sub) {
      sub.textContent =
        n >= MAX_S
          ? 'ครบ S15 แล้ว กลับหน้าเมนูหลัก'
          : `ต่อไป: ${next}`;
    }

    if (btn) {
      btn.textContent = n >= MAX_S ? '🏠 กลับเมนู' : `➡ ไป ${next}`;
    }

    bar.classList.add('show');

    // กันแผง speaking บังปุ่ม next
    const speakingPanel = $('#lessonSpeakingPanel');
    if (speakingPanel) {
      speakingPanel.classList.add('is-collapsed');
      const toggle = $('#lessonSpeakingToggle');
      if (toggle) toggle.textContent = 'เปิด';
    }

    console.log('[LessonNextSessionFix] show next', VERSION, reason || '', { sid, next });
  }

  function hideNext() {
    const bar = $('#lessonNextSessionBar');
    if (bar) bar.classList.remove('show');
  }

  function checkExistingPass() {
    const passPanel = $('#lessonSpeakingPanel.is-pass');
    const status = $('#lessonSpeakingStatus');
    const score = $('#lessonSpeakingScore');

    const statusText = String(status?.textContent || '');
    const scoreText = String(score?.textContent || '');

    if (
      passPanel ||
      statusText.includes('ผ่าน') ||
      statusText.toLowerCase().includes('pass') ||
      scoreText.includes('100%')
    ) {
      showNext('existing-pass');
    }
  }

  function boot() {
    ensureBar();
    hideNext();

    window.addEventListener('lesson:mission-pass', function (ev) {
      showNext('lesson:mission-pass');
    });

    document.addEventListener('lesson:mission-pass', function (ev) {
      showNext('document lesson:mission-pass');
    });

    window.addEventListener('lesson:speaking-result', function (ev) {
      if (ev?.detail?.passed) showNext('speaking-result');
    });

    document.addEventListener('lesson:speaking-result', function (ev) {
      if (ev?.detail?.passed) showNext('document speaking-result');
    });

    // เผื่อ script โหลดหลังจากผ่านไปแล้ว
    setTimeout(checkExistingPass, 500);
    setTimeout(checkExistingPass, 1500);
    setTimeout(checkExistingPass, 3000);

    window.LESSON_NEXT_SESSION_FIX = {
      version: VERSION,
      show: showNext,
      hide: hideNext,
      nextUrl
    };

    console.log('[LessonNextSessionFix]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
