// === /herohealth/vr-bath/ai-hooks.js ===
// BathVR AI Hooks — prediction-only collector (no adaptive)
// v20260304-BATH-AIHOOKS
'use strict';

(function(){
  const WIN = window;

  const st = {
    lastAi: null,
    lastTime: null,
    buf: [],
    maxBuf: 600
  };

  function push(row){
    st.buf.push(row);
    if(st.buf.length > st.maxBuf) st.buf.splice(0, st.buf.length - st.maxBuf);
  }

  // Public helper: export recent AI rows (for debug / research)
  WIN.__BATH_AI_EXPORT__ = function(){
    try{ return JSON.parse(JSON.stringify(st.buf)); }catch(_){ return []; }
  };

  // Listen bath hook
  WIN.addEventListener('bath:hook', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const type = d.type || '';
    const ts = Date.now();

    if(type === 'ai'){
      st.lastAi = d;
      push({ ts, type:'ai', hazardRisk: d.hazardRisk, coach: d.coach, features: d.features || {} });
      return;
    }

    if(type === 'time'){
      st.lastTime = d;
      // join with last AI to make training-ready row
      const ai = st.lastAi || {};
      push({
        ts,
        type:'frame',
        t: d.t,
        stage: d.stage,
        score: d.score,
        clean: d.clean,
        mistake: d.mistake,
        combo: d.combo,
        shield: d.shield,
        cleanMeter: d.cleanMeter,
        germRisk: d.germRisk,
        hazardRisk: (ai.hazardRisk ?? d.hazardRisk ?? null),
        features: (ai.features || null)
      });
      return;
    }

    if(type === 'end'){
      push({ ts, type:'end', summary: d });
      return;
    }

    // keep other events lightweight
    if(type==='judge' || type==='spawn' || type==='stage' || type==='boss_start' || type==='boss_clear' || type==='power'){
      push({ ts, type, data: d });
    }
  });
})();