// ---------- COACH: UI + Logic (bottom-left near Bank; non-blocking clicks) ----------
(function installCoach(){
  const byId = (id)=>document.getElementById(id);

  // ---- state ----
  const COACH = {
    box: null,
    lastSpeak: 0,
    queue: [],
    busy: false,
    minGap: 1200,     // เว้นช่วงพูดขั้นต่ำ
    fadeDelay: 1600,  // ดีเลย์ค่อยจาง
    ttl: 3800,        // อยู่บนหน้าจอก่อนจบการพูด
    sounds: null
  };
  // เผื่อเรียกใช้จากส่วนอื่น
  window.COACH = window.COACH || {};
  Object.assign(window.COACH, {
    say: sayCoach,
    place: placeCoachNearBank,
    show: ()=>{ if(COACH.box) COACH.box.style.display='block'; },
    hide: ()=>{ if(COACH.box) COACH.box.style.display='none'; }
  });

  // ---- SFX (ถ้าโหลดได้) ----
  try{
    const base = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
    COACH.sounds = {
      tip: new Audio(`${base}/assets/sfx/success.wav`),
      crowd: new Audio(`${base}/assets/sfx/combo.wav`)
    };
    Object.values(COACH.sounds).forEach(a=>{ a.preload='auto'; a.crossOrigin='anonymous'; });
  }catch(_){}

  // ---- build box ----
  function ensureBox(){
    if (COACH.box && COACH.box.isConnected) return COACH.box;
    let box = byId('coachBox');
    if(!box){
      box = document.createElement('div');
      box.id = 'coachBox';
      document.body.appendChild(box);
    }
    Object.assign(box.style, {
      position: 'fixed',
      left: '12px',              // fallback bottom-left
      bottom: '12px',
      zIndex: 9995,
      maxWidth: '48vw',
      background: 'rgba(0,0,0,.46)',
      color: '#e6f7ff',
      border: '1px solid rgba(255,255,255,.12)',
      borderRadius: '10px',
      padding: '8px 10px',
      font: '600 12px system-ui',
      lineHeight: '1.25',
      letterSpacing: '.2px',
      pointerEvents: 'none',     // ไม่บังคลิกปุ่ม
      backdropFilter: 'saturate(1.1) blur(2px)',
      boxShadow: '0 6px 16px rgba(0,0,0,.25)',
      transition: 'opacity .2s ease'
    });
    COACH.box = box;
    placeCoachNearBank();
    return box;
  }

  // ---- place near Bank button (if exists) ----
  function placeCoachNearBank(){
    const box = ensureBox();
    const bank = byId('bankBtn');

    if(!bank){
      // fallback: มุมล่างซ้าย
      box.style.left = '12px';
      box.style.bottom = '12px';
      return;
    }
    const r = bank.getBoundingClientRect();

    // วาง “ถัดจากปุ่ม Bank” (ด้านขวา) และยึดระดับเดียวกัน
    const left = Math.max(12, Math.floor(r.right + 8));
    const bottom = Math.max(12, Math.floor(window.innerHeight - r.bottom));
    box.style.left = left + 'px';
    box.style.bottom = bottom + 'px';
  }

  // จัดตำแหน่งซ้ำเมื่อเปลี่ยนขนาด/เลย์เอาต์
  addEventListener('resize', placeCoachNearBank, { passive: true });
  // เผื่อ UI โผล่ช้าหรือเปลี่ยนเลย์เอาต์
  setTimeout(placeCoachNearBank, 0);
  setTimeout(placeCoachNearBank, 300);
  setTimeout(placeCoachNearBank, 900);

  // ---- speak with queue/antispam ----
  function sayCoach(text, opts={}){
    ensureBox();
    const now = performance.now();
    const guard = opts.minGap ?? COACH.minGap;
    // ถ้าพูดถี่เกินเข้าคิวไว้
    if (now - COACH.lastSpeak < guard || COACH.busy){
      COACH.queue.push({text, opts});
      return;
    }
    COACH.lastSpeak = now;
    COACH.busy = true;

    COACH.box.textContent = text;
    COACH.box.style.opacity = '1';

    // เสียงประกอบเบา ๆ
    try{
      if(opts.sfx==='crowd') COACH.sounds?.crowd?.play?.();
      else COACH.sounds?.tip?.play?.();
    }catch(_){}

    // ค่อย ๆ ลดความเด่น
    clearTimeout(sayCoach._fadeT);
    sayCoach._fadeT = setTimeout(()=>{ if(COACH.box){ COACH.box.style.opacity = '.86'; } }, opts.fadeDelay ?? COACH.fadeDelay);

    // ปิดรอบพูด + flush queue
    clearTimeout(sayCoach._doneT);
    sayCoach._doneT = setTimeout(()=>{
      COACH.busy = false;
      if (COACH.queue.length){
        const next = COACH.queue.shift();
        sayCoach(next.text, next.opts||{});
      }
    }, opts.ttl ?? COACH.ttl);

    // reposition เผื่อปุ่มเพิ่ง mount
    placeCoachNearBank();
  }

  // ---- smart auto lines for common events ----
  function coachOnStart(){ sayCoach('พร้อม! เริ่มช้า ๆ แล้วค่อยเร่งจังหวะนะ'); }
  function coachOnPause(){ sayCoach('พักหายใจก่อน แล้วกด Resume ได้เลย'); }
  function coachOnResume(){ sayCoach('ลุยต่อ! โฟกัสจังหวะถัดไป'); }
  function coachOnBank(){ sayCoach('Bank แล้ว! รีเซ็ตคอมโบเพื่อความชัวร์', {sfx:'crowd'}); }
  function coachOnHit(kind){
    if(kind==='perfect')      sayCoach('เป๊ะมาก! รักษาจังหวะแบบนี้ต่อไป');
    else if(kind==='good')    sayCoach('ดี! อีกนิดจะเป๊ะแล้ว');
    else if(kind==='miss')    sayCoach('พลาดนิดหน่อย ไม่เป็นไร จับลมกลับมา');
  }
  function coachOnPhase2(){ sayCoach('Phase 2! หน้าต่างป้องกันแคบลง โฟกัส!'); }
  function coachOnBossDown(){ sayCoach('โหดจัด! ไปบอสถัดไปกัน'); }
  function coachOnResult(){ sayCoach('สรุปผลขึ้นแล้ว ลอง Replay เพื่ออัปสกิล!'); }

  // ---- wire to existing buttons (optional; ไม่บังคับ) ----
  function wireButtons(){
    byId('startBtn')?.addEventListener('click', coachOnStart, {passive:true});
    byId('pauseBtn')?.addEventListener('click', ()=>{
      // ถ้าปุ่มเดียวทำ Pause/Resume สลับ ให้เดาว่า toggle
      const label = byId('pauseBtn')?.textContent?.toLowerCase() || '';
      if(label.includes('resume')) coachOnResume(); else coachOnPause();
    }, {passive:true});
    byId('bankBtn')?.addEventListener('click', coachOnBank, {passive:true});
    byId('replayBtn')?.addEventListener('click', ()=> sayCoach('รอบใหม่! ดูจังหวะเปิดก่อนแล้วค่อยบูสท์'), {passive:true});
    byId('backBtn')?.addEventListener('click', ()=> sayCoach('กลับ Hub… เจอกันใหม่!'), {passive:true});
  }
  wireButtons();

  // ---- public shorthands (ใช้จากเกมเพลย์ได้เลย) ----
  window.COACH.hitPerfect = ()=>coachOnHit('perfect');
  window.COACH.hitGood    = ()=>coachOnHit('good');
  window.COACH.hitMiss    = ()=>coachOnHit('miss');
  window.COACH.phase2     = coachOnPhase2;
  window.COACH.bossDown   = coachOnBossDown;
  window.COACH.results    = coachOnResult;

})();
