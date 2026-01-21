/* === /herohealth/vr-groups/ai-hooks.js ===
AI Hooks (attach point) — PRODUCTION
✅ enabled only when ?ai=1 and runMode != research (คุณทำไว้แล้วใน launcher)
✅ Uses AIPredict (browser) if loaded
✅ Coach tips (rate-limited) based on predicted risks
✅ Emits: hha:coach micro-tips (explainable)
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;
  const NS = root.GroupsVR = root.GroupsVR || {};

  function nowMs(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }
  function emit(name, detail){ try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){ } }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  const AIHooks = NS.AIHooks = NS.AIHooks || {};
  let attached = false;

  AIHooks.attach = function(cfg){
    cfg = cfg || {};
    const enabled = !!cfg.enabled;
    if (!enabled) return; // keep off by default

    const runMode = String(cfg.runMode||'play');
    if (runMode === 'research') return;

    const AIP = NS.AIPredict;
    if (!AIP || !AIP.setEnabled) return;

    AIP.setEnabled(true);
    if (attached) return;
    attached = true;

    let lastTipAt = 0;

    root.addEventListener('ai:predict', (ev)=>{
      const d = ev.detail || {};
      if (!d) return;

      const missRisk = clamp(d.missRisk, 0, 1);
      const miniRisk = clamp(d.miniFailRisk, 0, 1);
      const gradeText = String(d.gradeText||'');

      // HUD hint event (optional)
      emit('ai:hud', { missRisk, miniRisk, gradeText });

      // rate-limit coach tips
      const t = nowMs();
      if (t - lastTipAt < 2600) return;

      // explainable micro-tips
      if (miniRisk >= 0.78){
        lastTipAt = t;
        emit('hha:coach', { mood:'fever', text:`AI: MINI เสี่ยงไม่ผ่าน (${Math.round(miniRisk*100)}%) → ช้าลงนิด เล็งให้ตรงก่อนยิง` });
        return;
      }
      if (missRisk >= 0.72){
        lastTipAt = t;
        emit('hha:coach', { mood:'neutral', text:`AI: เสี่ยงพลาดในอีก 5 วิ (${Math.round(missRisk*100)}%) → หยุดยิงมั่ว 1 วิ แล้วค่อยยิง` });
        return;
      }
      // occasional positive reinforcement
      if (missRisk <= 0.28 && miniRisk <= 0.28 && gradeText && gradeText !== 'C'){
        if (t - lastTipAt > 6000){
          lastTipAt = t;
          emit('hha:coach', { mood:'happy', text:`AI: ฟอร์มดี! มีลุ้นเกรด ${gradeText} ✨` });
        }
      }
    }, {passive:true});
  };

})(typeof window!=='undefined'?window:globalThis);