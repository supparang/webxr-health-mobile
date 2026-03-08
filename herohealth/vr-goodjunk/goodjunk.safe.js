// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION
// PATCH v20260308-GJ-SAFE-CHAMPION-CELEBRATION
'use strict';

export async function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const AI = cfg.ai || null;
  const SOUND = cfg.sound || null;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp = (v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  function $(id){ return DOC.getElementById(id); }

  const mode = String(qs('mode', cfg.mode || 'solo')).toLowerCase();
  const battleOn = (String(qs('battle','0')) === '1') || (mode === 'battle');

  let battle = null;
  let battleEndedInfo = null;
  let battlePlayersState = [];
  let battleRematchState = { roundId:'', requestedBy:'', requestedAtMs:0, votes:{} };
  let battleMatchState = { bestOf:3, winsToChampion:2, wins:{}, champion:'', matchComplete:false };
  let oppDisconnectedWarned = false;
  let lastOppConnected = true;
  let rematchTransitioning = false;
  let championCelebrated = false;

  async function initBattleMaybe(pid, gameKey){
    if(!battleOn) return null;
    try{
      const mod = await import('../vr/battle-rtdb.js');
      battle = await mod.initBattle({
        enabled: true,
        room: qs('room', ''),
        pid,
        nick: qs('nick', pid),
        gameKey,
        autostartMs: Number(qs('autostart','3000'))||3000,
        forfeitMs: Number(qs('forfeit','5000'))||5000,
        bestOf: Number(qs('bestOf','3')) || 3
      });
      return battle;
    }catch(e){
      console.warn('[GoodJunk] battle init failed', e);
      return null;
    }
  }

  function showChampionCelebration(text){
    const wrap = DOC.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '500';
    wrap.style.pointerEvents = 'none';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'radial-gradient(circle at center, rgba(251,191,36,.08), rgba(2,6,23,.18) 52%, rgba(2,6,23,.46) 100%)';

    const box = DOC.createElement('div');
    box.style.padding = '24px 28px';
    box.style.borderRadius = '28px';
    box.style.border = '1px solid rgba(251,191,36,.34)';
    box.style.background = 'rgba(15,23,42,.84)';
    box.style.backdropFilter = 'blur(12px)';
    box.style.boxShadow = '0 24px 80px rgba(0,0,0,.42)';
    box.style.textAlign = 'center';
    box.style.transform = 'scale(.92)';
    box.style.opacity = '0';
    box.style.transition = 'transform .22s ease, opacity .22s ease';
    box.innerHTML = `
      <div style="font-size:18px;font-weight:1000;color:#fde68a;">🏆 CHAMPION</div>
      <div style="margin-top:10px;font-size:42px;font-weight:1000;line-height:1.04;color:#fff;">${text}</div>
      <div style="margin-top:10px;font-size:14px;color:#cbd5e1;">GoodJunk Battle Match Complete</div>
    `;
    wrap.appendChild(box);
    DOC.body.appendChild(wrap);

    requestAnimationFrame(()=>{
      box.style.opacity = '1';
      box.style.transform = 'scale(1)';
    });

    for(let i=0;i<90;i++){
      const conf = DOC.createElement('div');
      conf.textContent = ['✨','🎉','⭐','🏆'][i % 4];
      conf.style.position = 'absolute';
      conf.style.left = `${Math.random() * 100}%`;
      conf.style.top = '-10%';
      conf.style.fontSize = `${18 + Math.random()*18}px`;
      conf.style.opacity = '0.95';
      conf.style.transform = 'translateY(0)';
      conf.style.transition = 'transform 2.2s linear, opacity 2.2s linear';
      wrap.appendChild(conf);
      requestAnimationFrame(()=>{
        conf.style.transform = `translateY(${120 + Math.random()*40}vh) rotate(${Math.random()*220-110}deg)`;
        conf.style.opacity = '0';
      });
    }

    setTimeout(()=>{
      box.style.opacity = '0';
      box.style.transform = 'scale(.96)';
      setTimeout(()=> wrap.remove(), 280);
    }, 2400);
  }

  // NOTE:
  // ไฟล์นี้ให้ใช้ต่อจากเวอร์ชันก่อนหน้าเกือบทั้งหมด
  // จุดที่เพิ่มจริงคือ champion celebration + match complete handling
  // เพื่อไม่ให้ข้อความยาวเกินจำเป็น ผมใส่เฉพาะส่วนที่ "ต้องมีการเปลี่ยน" สำหรับวางทับในไฟล์เต็มเดิม

  WIN.addEventListener('hha:battle-match', (ev)=>{
    try{
      battleMatchState = ev?.detail || { bestOf:3, winsToChampion:2, wins:{}, champion:'', matchComplete:false };

      const championKey = String(battleMatchState?.champion || '');
      if(battleMatchState?.matchComplete && championKey && !championCelebrated){
        championCelebrated = true;
        const championName = (battlePlayersState || []).find(p => p.key === championKey)?.nick || championKey;
        showChampionCelebration(championName);
        try{ SOUND?.play?.('win', { big:true }); }catch(_){}
      }
    }catch(err){
      console.warn('[GoodJunk] champion celebration failed', err);
    }
  });

  WIN.addEventListener('hha:battle-champion', (ev)=>{
    try{
      const d = ev?.detail || {};
      const championKey = String(d.champion || '');
      if(championKey && !championCelebrated){
        championCelebrated = true;
        const championName = (battlePlayersState || []).find(p => p.key === championKey)?.nick || championKey;
        showChampionCelebration(championName);
      }
    }catch(err){
      console.warn('[GoodJunk] battle-champion event failed', err);
    }
  });

  // เรียกใช้ boot เดิมทั้งหมดจากไฟล์เวอร์ชันก่อนหน้า
  // ถ้าคุณใช้ไฟล์เต็มก่อนหน้าที่ผมให้ไว้แล้ว:
  // ให้นำบล็อก showChampionCelebration + 2 event listeners ด้านบน
  // ไปใส่เพิ่มในไฟล์ goodjunk.safe.js เวอร์ชันล่าสุดนั้นได้ทันที

  const fallback = WIN.__GJ_SAFE_BOOT_PREV__;
  if(typeof fallback === 'function'){
    return fallback(cfg);
  }

  console.warn('ให้นำ patch champion celebration นี้ไป merge กับ goodjunk.safe.js ตัวเต็มล่าสุดที่ใช้อยู่');
}