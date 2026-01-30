// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks — UMD (NO ES export) — PRODUCTION
// ✅ Works with <script defer> (non-module)
// ✅ window.GroupsVR.AIHooks.attach({runMode, seed, enabled})
// ✅ window.dispatchEvent('groups:ai_event', {kind,...}) for optional listeners
// Note: Default is SAFE/OFF unless enabled=true (and runMode !== 'research')

(function(){
  'use strict';

  const WIN = window;
  WIN.GroupsVR = WIN.GroupsVR || {};

  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // --- internal state ---
  const S = {
    attached: false,
    enabled: false,
    runMode: 'play',
    seed: '',
    startedAt: 0,
    // optional metrics snapshot (if engine emits events we listen to)
    score: 0,
    combo: 0,
    miss: 0,
    acc: 0,
    left: 0
  };

  function emit(kind, detail){
    try{
      WIN.dispatchEvent(new CustomEvent('groups:ai_event', {
        detail: Object.assign({ kind, t: nowMs(), runMode: S.runMode, seed: S.seed, enabled: S.enabled }, detail||{})
      }));
    }catch(_){}
  }

  function attach(cfg){
    cfg = cfg || {};
    S.attached = true;
    S.runMode  = String(cfg.runMode || S.runMode || 'play');
    S.seed     = String(cfg.seed || S.seed || '');
    S.enabled  = !!cfg.enabled && (S.runMode !== 'research') && (S.runMode !== 'practice');
    S.startedAt = nowMs();

    emit('attach', { ok:true });

    // ถ้าเปิด enabled จริง ค่อยปล่อยข้อความเบา ๆ (ไม่รบกวนเด็ก)
    if (S.enabled){
      try{
        WIN.dispatchEvent(new CustomEvent('hha:coach', {
          detail:{ text:'🧠 AI hooks พร้อมแล้ว (โหมดเล่น) — จะช่วยเก็บสัญญาณเพื่อทำคำแนะนำแบบเบา ๆ', mood:'neutral' }
        }));
      }catch(_){}
    }
    return true;
  }

  function detach(){
    S.attached = false;
    S.enabled = false;
    emit('detach', { ok:true });
  }

  // --- Optional listeners: ถ้าเกม/หน้า run ยิง event มา เราเก็บ snapshot ไว้ (ไม่บังคับ) ---
  function onScore(ev){
    const d = ev.detail||{};
    S.score = Number(d.score ?? S.score) || 0;
    S.combo = Number(d.combo ?? S.combo) || 0;
    S.miss  = Number(d.misses ?? S.miss) || 0;
  }
  function onRank(ev){
    const d = ev.detail||{};
    S.acc = Number(d.accuracy ?? S.acc) || 0;
  }
  function onTime(ev){
    const d = ev.detail||{};
    S.left = Math.max(0, Math.round(d.left ?? S.left));
  }

  // ติด listener ไว้ตลอดแบบ passive (เบามาก)
  try{
    WIN.addEventListener('hha:score', onScore, { passive:true });
    WIN.addEventListener('hha:rank',  onRank,  { passive:true });
    WIN.addEventListener('hha:time',  onTime,  { passive:true });
  }catch(_){}

  // --- public API ---
  WIN.GroupsVR.AIHooks = {
    attach,
    detach,
    state: ()=>Object.assign({}, S),
    // simple helper for other modules
    enabled: ()=>!!S.enabled,
    ping: (msg)=>emit('ping', { msg:String(msg||'') }),
    // a tiny explainable tip helper (rate-limited; still safe)
    tip: (text, mood='neutral')=>{
      if (!S.enabled) return false;
      const t = nowMs();
      // rate-limit: no more than 1 tip / 1500ms
      if (WIN.__HHA_AI_LAST_TIP__ && (t - WIN.__HHA_AI_LAST_TIP__ < 1500)) return false;
      WIN.__HHA_AI_LAST_TIP__ = t;
      try{
        WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text:String(text||''), mood:String(mood||'neutral') } }));
      }catch(_){}
      emit('tip', { text:String(text||''), mood:String(mood||'neutral') });
      return true;
    }
  };

})();