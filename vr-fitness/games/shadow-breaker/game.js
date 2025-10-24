/* ===========================================================
   Shadow Breaker · VR Fitness Academy
   + Coach System (Top-Left)
   + Voice & Text feedback
   + ไม่บังปุ่มเริ่มเกม
   =========================================================== */

(function(){
  "use strict";
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');

  /* -----------------------------------------------------------
     SECTION 1: Core Audio / HUD / Helper
  ----------------------------------------------------------- */
  const SFX = {
    hit: new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    miss: new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    combo: new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui: new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
  };
  Object.values(SFX).forEach(a=>{ try{a.preload='auto';a.crossOrigin='anonymous';}catch(_){ }});

  function floatText(text,color,pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.25;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:200});
    $('arena').appendChild(e);
    setTimeout(()=>{try{e.remove();}catch(_e){}},700);
  }

  /* -----------------------------------------------------------
     SECTION 2: Coach System (Top-Left Corner)
  ----------------------------------------------------------- */
  (function installCoachUI(){
    if($('sbCoachBox')) return;
    const box=document.createElement('div'); box.id='sbCoachBox';
    Object.assign(box.style,{
      position:'fixed',
      left:'14px',
      top:'72px',          // << moved up
      zIndex:9999,
      display:'flex',
      gap:'8px',
      alignItems:'center',
      background:'rgba(6,14,24,.82)',
      border:'1px solid rgba(0,255,170,.25)',
      color:'#dff',
      padding:'8px 10px',
      borderRadius:'12px',
      maxWidth:'52vw',
      font:'600 13px/1.25 system-ui,Segoe UI,Arial'
    });
    const avatar=document.createElement('div');
    Object.assign(avatar.style,{
      width:'36px',height:'36px',borderRadius:'50%',
      background:'radial-gradient(#00c9a7,#006b62)',
      boxShadow:'0 0 12px rgba(0,255,200,.45) inset'
    });
    const text=document.createElement('div'); text.id='sbCoachText'; text.textContent='พร้อมลุย!';
    box.appendChild(avatar); box.appendChild(text);
    document.body.appendChild(box);
  })();

  // เสียงพูดโค้ช (optional)
  function S(p){ try{ const a=new Audio(p); a.preload='auto'; a.crossOrigin='anonymous'; return a; }catch(_){ return {play(){} }; } }
  const CoachSFX = {
    go:    S(`${ASSET_BASE}/assets/sfx/coach_go.mp3`),
    nice:  S(`${ASSET_BASE}/assets/sfx/coach_nice.mp3`),
    warn:  S(`${ASSET_BASE}/assets/sfx/coach_warn.mp3`),
    boss:  S(`${ASSET_BASE}/assets/sfx/coach_boss.mp3`),
    end:   S(`${ASSET_BASE}/assets/sfx/coach_end.mp3`)
  };

  const coachQ=[]; let coachBusy=false; let lastCoachAt=0;
  function coachSay(msg,sfx=null,ttl=2100){
    const t=performance.now();
    if(t-lastCoachAt<600){ coachQ.push({msg,sfx,ttl}); return; }
    lastCoachAt=t;
    const el=$('sbCoachText'); if(!el) return;
    el.textContent=msg;
    try{ sfx&&sfx.play(); }catch(_){}
    if(coachBusy) return;
    coachBusy=true;
    setTimeout(()=>{
      coachBusy=false;
      if(coachQ.length){ const n=coachQ.shift(); coachSay(n.msg,n.sfx,n.ttl); }
    }, ttl);
  }

  /* -----------------------------------------------------------
     SECTION 3: Game Loop Hook (coach reacts to DOM)
  ----------------------------------------------------------- */
  let lastCombo=0, missStreak=0, lastPhase='1', lastTime=0, resultsShown=false;
  function getVal(id){ const e=$(id); return e?parseInt(e.textContent||'0',10):0; }
  function getPhase(){ const e=$('phaseLabel'); return e?e.textContent.replace(/\D+/g,'')||'1':'1'; }
  function isResultsVisible(){ const r=$('results'); return r && getComputedStyle(r).display!=='none'; }

  setInterval(()=>{
    const combo=getVal('combo');
    const t=getVal('time');
    const phase=getPhase();
    const results=isResultsVisible();

    if(results && !resultsShown){
      resultsShown=true;
      const sc=$('rScore')?.textContent||'';
      const acc=$('rAcc')?.textContent||'';
      coachSay(`จบเกมแล้ว! คะแนน ${sc} · ACC ${acc}`, CoachSFX.end, 2600);
    } else if(!results) resultsShown=false;

    // เริ่มเกม
    if(t>0 && lastTime===0){ coachSay('เริ่มจากช้า ๆ จัดท่าให้ดี แล้วฟาด!', CoachSFX.go, 2200); }

    // Combo event
    if(combo!==lastCombo){
      if(combo>lastCombo){
        missStreak=0;
        if([5,10,20,30].includes(combo)) coachSay(`สุดยอด! คอมโบ ${combo}!`, CoachSFX.nice);
      }else{
        if(combo===0 && lastCombo>0){
          missStreak++;
          if(missStreak===2) coachSay('พลาดไปนิด ลองเร็วกว่านี้!', CoachSFX.warn);
          if(missStreak>=4)  coachSay('ใจเย็น โฟกัสมุมโจมตี!', CoachSFX.warn, 2400);
        }
      }
      lastCombo=combo;
    }

    // Phase change
    if(phase!==lastPhase){
      if(phase==='2') coachSay('Phase 2! บอสเริ่มเคลื่อนไหว ระวังท่าใหม่!', CoachSFX.boss, 2400);
      lastPhase=phase;
    }

    // Time countdown
    if(t!==lastTime){
      if(t===20) coachSay('อีก 20 วิ! โกยแต้มเลย!', CoachSFX.nice);
      if(t===10) coachSay('10 วิสุดท้าย! เร่งมือ!', CoachSFX.warn);
      lastTime=t;
    }
  }, 300);

  /* -----------------------------------------------------------
     SECTION 4: Main Game Engine (minimal placeholder)
     (ถ้าคุณมีโค้ดเกมหลักอยู่แล้ว ให้เก็บส่วนนี้ไว้ท้ายไฟล์)
  ----------------------------------------------------------- */

  console.log("✅ Shadow Breaker with Coach loaded.");
})();
