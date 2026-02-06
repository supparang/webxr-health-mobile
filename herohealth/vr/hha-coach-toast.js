// === /herohealth/vr/hha-coach-toast.js ===
// HHA Universal Coach Toast — v1.0.0
// Listens: window 'hha:coach' events
// Supports payload keys:
//   { msg, tag } (Plate style)
//   { text, mood } (Groups style)
// Also accepts: { message, role, severity }
// Rate-limit + queue to avoid spam
// Safe-area friendly, VR-safe overlay (doesn't block clicks unless needed)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__HHA_COACH_TOAST_LOADED__) return;
  WIN.__HHA_COACH_TOAST_LOADED__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // Configurable via global
  // window.HHA_COACH_CONFIG = { minGapMs: 520, showMs: 2100, maxQueue: 4 }
  const CFG = Object.assign({
    minGapMs: 520,
    showMs: 2100,
    maxQueue: 4
  }, WIN.HHA_COACH_CONFIG || {});

  const S = {
    lastShowAt: 0,
    showing: false,
    q: []
  };

  function ensureStyle(){
    if (DOC.getElementById('hha-coach-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-coach-style';
    st.textContent = `
      .hhaCoachWrap{
        position:fixed;
        left:12px; right:12px;
        bottom: calc(12px + env(safe-area-inset-bottom));
        z-index: 99997;
        pointer-events: none;
        display:flex;
        justify-content:center;
      }
      .hhaCoachWrap[hidden]{ display:none !important; }
      .hhaCoachToast{
        width:min(520px, 96vw);
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.90);
        box-shadow: 0 18px 55px rgba(0,0,0,.35);
        overflow:hidden;
        transform: translateY(16px) scale(.98);
        opacity: 0;
        transition: transform 180ms ease, opacity 160ms ease;
        display:flex;
        gap:10px;
        align-items:flex-start;
        padding: 12px 12px;
      }
      .hhaCoachToast.show{
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .hhaCoachAvatar{
        width:42px; height:42px;
        border-radius: 14px;
        flex: 0 0 auto;
        display:flex; align-items:center; justify-content:center;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(148,163,184,.10);
        font-size: 22px;
      }
      .hhaCoachMain{ flex:1 1 auto; min-width: 0; }
      .hhaCoachTag{
        font-weight: 900;
        font-size: 12px;
        color: rgba(148,163,184,.95);
        margin-bottom: 3px;
        display:flex;
        align-items:center;
        gap:8px;
      }
      .hhaCoachPill{
        display:inline-flex;
        padding:2px 8px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.16);
        background: rgba(148,163,184,.10);
        font-size: 11px;
        color: rgba(148,163,184,.95);
      }
      .hhaCoachMsg{
        font-weight: 900;
        font-size: 14px;
        color: #e5e7eb;
        line-height: 1.28;
        word-break: break-word;
      }
      /* mood accents */
      .mood-neutral .hhaCoachAvatar{ background: rgba(148,163,184,.12); }
      .mood-happy   .hhaCoachAvatar{ background: rgba(34,197,94,.16); border-color: rgba(34,197,94,.22); }
      .mood-fever   .hhaCoachAvatar{ background: rgba(245,158,11,.18); border-color: rgba(245,158,11,.25); }
      .mood-sad     .hhaCoachAvatar{ background: rgba(239,68,68,.14); border-color: rgba(239,68,68,.22); }
      .mood-info    .hhaCoachAvatar{ background: rgba(59,130,246,.14); border-color: rgba(59,130,246,.22); }
    `;
    DOC.head.appendChild(st);
  }

  function ensureDom(){
    ensureStyle();
    let w = DOC.getElementById('hhaCoachWrap');
    if (w) return w;
    w = DOC.createElement('div');
    w.id = 'hhaCoachWrap';
    w.className = 'hhaCoachWrap';
    w.hidden = true;

    w.innerHTML = `
      <div class="hhaCoachToast mood-neutral" id="hhaCoachToast" role="status" aria-live="polite">
        <div class="hhaCoachAvatar" id="hhaCoachAvatar">🙂</div>
        <div class="hhaCoachMain">
          <div class="hhaCoachTag">
            <span id="hhaCoachTag">Coach</span>
            <span class="hhaCoachPill" id="hhaCoachPill">TIP</span>
          </div>
          <div class="hhaCoachMsg" id="hhaCoachMsg">…</div>
        </div>
      </div>
    `;
    DOC.body.appendChild(w);
    return w;
  }

  function moodToEmoji(mood){
    mood = String(mood||'neutral').toLowerCase();
    if (mood === 'happy' || mood === 'good') return '😄';
    if (mood === 'fever' || mood === 'warn') return '🔥';
    if (mood === 'sad' || mood === 'bad') return '🥲';
    if (mood === 'info') return '💡';
    return '🙂';
  }

  function normalizePayload(detail){
    const d = (detail && typeof detail === 'object') ? detail : {};

    // support both styles
    const msg =
      (d.msg != null ? d.msg :
      (d.text != null ? d.text :
      (d.message != null ? d.message : '')));

    const tag =
      (d.tag != null ? d.tag :
      (d.role != null ? d.role :
      (d.title != null ? d.title : 'Coach')));

    const mood =
      (d.mood != null ? d.mood :
      (d.severity != null ? d.severity : 'neutral'));

    // category pill
    // allow caller send { pill:'MINI' } or { type:'judge' }
    const pill = d.pill || d.type || d.kind || 'TIP';

    return {
      msg: String(msg || '').trim(),
      tag: String(tag || 'Coach').trim(),
      mood: String(mood || 'neutral').trim(),
      pill: String(pill || 'TIP').trim()
    };
  }

  function enqueue(payload){
    if(!payload.msg) return;
    S.q.push(payload);
    if (S.q.length > CFG.maxQueue) S.q.shift();
  }

  function render(payload){
    const wrap = ensureDom();
    const toast = DOC.getElementById('hhaCoachToast');
    const elA = DOC.getElementById('hhaCoachAvatar');
    const elTag = DOC.getElementById('hhaCoachTag');
    const elPill = DOC.getElementById('hhaCoachPill');
    const elMsg = DOC.getElementById('hhaCoachMsg');

    const mood = String(payload.mood || 'neutral').toLowerCase();
    toast.className = `hhaCoachToast mood-${mood}`;

    elA.textContent = moodToEmoji(mood);
    elTag.textContent = payload.tag || 'Coach';

    // nicer pill text
    const pill = (payload.pill || 'TIP').toUpperCase();
    elPill.textContent = pill.length > 12 ? pill.slice(0,12) : pill;

    elMsg.textContent = payload.msg;

    wrap.hidden = false;
    requestAnimationFrame(()=>toast.classList.add('show'));
  }

  function hide(){
    const wrap = DOC.getElementById('hhaCoachWrap');
    const toast = DOC.getElementById('hhaCoachToast');
    if(!wrap || !toast) return;
    toast.classList.remove('show');
    setTimeout(()=>{ try{ wrap.hidden = true; }catch(_){ } }, 190);
  }

  function pump(){
    if (S.showing) return;
    if (!S.q.length) return;

    const t = nowMs();
    const gap = t - S.lastShowAt;
    if (gap < CFG.minGapMs){
      setTimeout(pump, (CFG.minGapMs - gap) + 8);
      return;
    }

    const payload = S.q.shift();
    S.showing = true;
    S.lastShowAt = nowMs();

    render(payload);

    setTimeout(()=>{
      hide();
      setTimeout(()=>{
        S.showing = false;
        pump();
      }, 210);
    }, clamp(payload.showMs ?? CFG.showMs, 900, 6000));
  }

  function onCoach(ev){
    const payload = normalizePayload(ev && ev.detail);
    // optional: allow disabling in research mode
    const run = String(qs('run','')||'').toLowerCase();
    if (run === 'research' || run === 'study'){
      // still allow if explicitly forced
      if (!payload.force) return;
    }
    enqueue(payload);
    pump();
  }

  WIN.addEventListener('hha:coach', onCoach, { passive:true });

  // expose helper
  WIN.HHA_CoachToast = {
    show: (msg, mood='neutral', tag='Coach', pill='TIP')=>{
      onCoach({ detail:{ msg, mood, tag, pill, force:true } });
    },
    setConfig: (cfg)=>{ try{ Object.assign(CFG, cfg||{}); }catch(_){ } }
  };
})();