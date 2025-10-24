// ---- Helper: รอให้ A-Frame scene พร้อมก่อนค่อยทำงาน (กันกดเร็วเกิน) ----
function onSceneReady(cb){
  const sc = document.querySelector('a-scene');
  if (!sc){ requestAnimationFrame(()=>onSceneReady(cb)); return; }
  if (sc.hasLoaded){ cb(); return; }
  sc.addEventListener('loaded', ()=>cb(), { once:true });
}

// ---- REPLACE ฟังก์ชัน start() เดิมทั้งหมดด้วยเวอร์ชันนี้ ----
function start(){
  if(running) return;
  onSceneReady(()=>{                // รอ scene พร้อม
    // ตั้งค่าความยาก/โรสเตอร์
    const key = getDiffKey();
    D = DIFFS[key] || DIFFS.normal;
    try{ localStorage.setItem('sb_diff', key); }catch(_){}
    ROSTER = makeRoster(key);
    CHAIN_RULE = { minTimeLeft: D.chainMin };

    // รีเซ็ตค่าสถานะทั้งหมด
    window.PERFECT_BONUS=0; window.PARRY_WINDOW=1; window.TIME_SCALE=1; window.EXTRA_BEAM=false;
    rollMutators(1);
    reset();

    // เริ่มจริง
    running = true;
    pingUI('START','#00ffa3');

    // อัพ HUD ความยากบนผลลัพธ์
    const rDiff = byId('rDiff'); 
    if(rDiff) rDiff.textContent = (DIFFS[key]?.title || 'NORMAL') + ' · ' + (ST.title||'');

    // spawn เป้าทันที 1 ชิ้นให้ผู้เล่นเห็นว่ามาแล้ว
    try{ spawnTarget(); }catch(e){ console.warn('spawnTarget error', e); }

    // ตั้งลูปสปอว์นเป้า
    const per = Math.max(480, D.spawnInt*(window.TIME_SCALE||1)); // ช้าพอให้เห็นก่อน
    spawnTimer = setInterval(spawnTarget, per);

    // ตั้งนาฬิกา
    timer = setInterval(()=>{
      timeLeft--; byId('time').textContent = timeLeft;
      if(timeLeft<=0) end();
    }, 1000);

    // เรียกบอสทันที (หน่วงนิดเพื่อให้ HUD/เสียงพร้อม)
    CURRENT_BOSS = 0;
    after(dur(700), ()=> bossSpawn(CURRENT_BOSS));
  });
}

// ---- REPLACE ส่วนผูกปุ่ม (DOMContentLoaded) เดิมด้วยเวอร์ชันนี้ ----
document.addEventListener('DOMContentLoaded', ()=>{
  // ป้องกันผูกซ้ำ: เอา event listener เก่าออกก่อน (ถ้ามี)
  const s = byId('startBtn'), p = byId('pauseBtn'), b = byId('bankBtn'),
        r = byId('replayBtn'), bk = byId('backBtn');

  s?.replaceWith(s.cloneNode(true));
  p?.replaceWith(p.cloneNode(true));
  b?.replaceWith(b.cloneNode(true));
  r?.replaceWith(r.cloneNode(true));
  bk?.replaceWith(bk.cloneNode(true));

  // re-query หลัง clone
  const startBtn = byId('startBtn'),
        pauseBtn = byId('pauseBtn'),
        bankBtn  = byId('bankBtn'),
        replayBtn= byId('replayBtn'),
        backBtn  = byId('backBtn');

  startBtn?.addEventListener('click', start, { passive:true });
  pauseBtn?.addEventListener('click', togglePause, { passive:true });
  bankBtn?.addEventListener('click', bankNow, { passive:true });
  replayBtn?.addEventListener('click', start, { passive:true });
  backBtn?.addEventListener('click', ()=>{ window.location.href = `${ASSET_BASE}/vr-fitness/`; }, { passive:true });

  // เพื่อให้โค้ชวางตัวใหม่หลังปุ่ม mount
  try{ window.COACH?.place?.(); }catch(_){}
});

// ---- แนะนำ: เพิ่ม ping ตอน bossIntro เรียก start แล้วเห็นอะไรเกิดขึ้นแน่ ๆ ----
function bossIntro(){
  const arena=byId('arena');
  const anchor=document.createElement('a-entity');
  anchor.setAttribute('id','bossAnchor');
  anchor.setAttribute('position','0 1.5 -3');
  // ... (เดิมทั้งหมด)
  arena.appendChild(anchor); BOSS.anchor=anchor;

  bossShowUI(true); bossSetHP(BOSS.max);
  play(SFX.boss_roar);
  pingUI(`BOSS: ${BOSS.name}`,'#ffd166'); // <— เพิ่มบรรทัดนี้ไว้ดูสถานะ
  APPX.badge((BOSS.name||'BOSS') + ' · ' + (DIFFS[getDiffKey()]?.title || 'NORMAL') + ' · ' + (ST.title||'')); 
  setPhaseLabel(1);
}
