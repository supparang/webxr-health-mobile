// === /herohealth/vr-maskcough/maskcough.boot.js ===
// MaskCough BOOT — AI HUD + Big Pop (rate-limited)
// Listens: mc:ai {type, ...}
// Safe: no crash if missing DOM

(function(){
  'use strict';
  const WIN = window, DOC = document;

  function ensureAIHud(){
    let wrap = DOC.getElementById('hud-ai');
    if(wrap) return wrap;

    wrap = DOC.createElement('section');
    wrap.id = 'hud-ai';
    wrap.style.position = 'fixed';
    wrap.style.left = '12px';
    wrap.style.bottom = '12px';
    wrap.style.zIndex = '9999';
    wrap.style.width = 'min(460px, 92vw)';
    wrap.style.border = '1px solid rgba(148,163,184,.18)';
    wrap.style.borderRadius = '20px';
    wrap.style.padding = '10px 12px';
    wrap.style.background = 'rgba(2,6,23,.72)';
    wrap.style.backdropFilter = 'blur(10px)';
    wrap.style.webkitBackdropFilter = 'blur(10px)';
    wrap.style.boxShadow = '0 18px 60px rgba(0,0,0,.35)';
    wrap.style.pointerEvents = 'none';
    wrap.style.opacity = '0';
    wrap.style.transition = 'opacity .18s ease, transform .18s ease';
    wrap.style.transform = 'translateY(6px)';

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div id="ai-emo" style="font-size:18px;line-height:1;">🧠</div>
        <div style="flex:1;min-width:0">
          <div id="ai-title" style="font-weight:950;letter-spacing:.2px;">AI Coach</div>
          <div id="ai-sub" style="margin-top:2px;color:rgba(229,231,235,.82);font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">พร้อมช่วย!</div>
        </div>
        <div id="ai-tag" style="font-size:11px;color:rgba(148,163,184,1);font-weight:900;">TIP</div>
      </div>
      <div id="ai-mini" style="margin-top:8px;color:rgba(229,231,235,.86);font-size:13px;line-height:1.45;">
        แตะ “😷” เพิ่มโล่ · โฟกัส “🤧” ตอนใกล้หมดเวลา = Perfect
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function setAI(msg){
    const wrap = ensureAIHud();
    const emo = DOC.getElementById('ai-emo');
    const title = DOC.getElementById('ai-title');
    const sub = DOC.getElementById('ai-sub');
    const tag = DOC.getElementById('ai-tag');
    const mini = DOC.getElementById('ai-mini');

    if(emo) emo.textContent = msg.emo || '🧠';
    if(title) title.textContent = msg.title || 'AI Coach';
    if(sub) sub.textContent = msg.sub || '';
    if(tag) tag.textContent = msg.tag || 'TIP';
    if(mini) mini.textContent = msg.mini || '';

    wrap.style.opacity = '1';
    wrap.style.transform = 'translateY(0)';
    clearTimeout(setAI._t);
    setAI._t = setTimeout(()=>{
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(6px)';
    }, msg.ms || 1600);
  }

  function bigPop(msg){
    let el = DOC.getElementById('ai-bigpop');
    if(!el){
      el = DOC.createElement('div');
      el.id = 'ai-bigpop';
      el.style.position='fixed';
      el.style.left='50%';
      el.style.top='50%';
      el.style.transform='translate(-50%,-50%) scale(0.96)';
      el.style.zIndex='9999';
      el.style.padding='12px 16px';
      el.style.borderRadius='999px';
      el.style.border='1px solid rgba(148,163,184,.22)';
      el.style.background='rgba(2,6,23,.78)';
      el.style.color='rgba(229,231,235,.95)';
      el.style.fontWeight='950';
      el.style.letterSpacing='.6px';
      el.style.boxShadow='0 18px 60px rgba(0,0,0,.45)';
      el.style.backdropFilter='blur(10px)';
      el.style.webkitBackdropFilter='blur(10px)';
      el.style.pointerEvents='none';
      el.style.opacity='0';
      el.style.transition='opacity .14s ease, transform .14s ease';
      DOC.body.appendChild(el);
    }
    el.textContent = msg.big || msg.title || 'READY!';
    el.style.opacity='1';
    el.style.transform='translate(-50%,-50%) scale(1)';
    clearTimeout(bigPop._t);
    bigPop._t = setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translate(-50%,-50%) scale(0.96)';
    }, msg.bigMs || 900);
  }

  function msgFromType(t, d){
    const mk = (emo,title,sub,mini,tag='TIP',ms=1600,big=null,bigMs=900)=>({emo,title,sub,mini,tag,ms,big,bigMs});
    switch(String(t||'').toLowerCase()){
      case 'boss_start':
        return mk('🦠','BOSS WAVE!','โหมดบอสเริ่มแล้ว','หา “🎯 Weak Spot” แล้วตีให้แตก','BOSS',1800,'BOSS!',900);
      case 'weakspot_on':
        return mk('🎯','WEAK SPOT!','แตะ “🎯” ได้โบนัสแรง','อย่าไปแตะ “🎭” (Decoy)','BOSS',1700,'WEAK!',850);
      case 'laser_warn':
        return mk('⚠️','LASER กำลังมา','อีกแป๊บ “ห้ามแตะ”','นิ่งไว้ รอให้ผ่าน','LASER',1500,'STOP!',850);
      case 'laser_on':
        return mk('🚫','LASER SWEEP!','ห้ามแตะช่วงนี้','รอให้หมด แล้วค่อยลุยต่อ','LASER',1600,'NO HIT!',900);
      case 'shock_on':
        return mk('🎵','SHOCKWAVE!','แตะเฉพาะตอน “วงเขียว”','ตี 1 ครั้งพอ อย่ารัว','SHOCK',1700,'TIMING!',900);
      case 'phase':
        return mk('🔥',`PHASE ${d?.phase||'?'}!`, d?.sub||'','ทำ PERFECT เพื่อเร่ง FEVER','PHASE',1500);
      case 'predict_easy':
        return mk('🫶','ปรับให้ง่ายขึ้น','ระบบช่วยให้ทันมือ','โฟกัส “😷” เก็บโล่ก่อน','AI',1500);
      case 'predict_hard':
        return mk('😈','ปรับให้ท้าทายขึ้น','คุณเริ่มเก่งแล้ว!','ล่าคอมโบ + PERFECT','AI',1500);
      default:
        return null;
    }
  }

  const RL = { lastAny:0, lastBig:0, minAnyMs:260, minBigMs:900 };
  function shouldBig(t){
    t = String(t||'').toLowerCase();
    return (t==='boss_start'||t==='weakspot_on'||t==='laser_on'||t==='shock_on');
  }

  WIN.addEventListener('mc:ai', (ev)=>{
    const d = ev?.detail || {};
    const t = d.type;
    const now = Date.now();
    if(now - RL.lastAny < RL.minAnyMs) return;
    RL.lastAny = now;

    const msg = msgFromType(t, d);
    if(!msg) return;

    setAI(msg);

    if(shouldBig(t)){
      if(now - RL.lastBig < RL.minBigMs) return;
      RL.lastBig = now;
      bigPop(msg);
    }
  });
})();