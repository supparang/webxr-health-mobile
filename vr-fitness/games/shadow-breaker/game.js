(function(){
  "use strict";

  // =============== DOM ===============
  const $ = (s)=>document.querySelector(s);
  const UI = {
    btnStart: $('#btnStart'),
    btnPause: $('#btnPause'),
    btnEnd:   $('#btnEnd'),
    result:   $('#resultPanel'),
    starWrap: $('#starWrap'),
    // HUD
    lblTime:  $('#lblTime'),
    lblScore: $('#lblScore'),
    lblCombo: $('#lblCombo'),
    lblMaxCombo: $('#lblMaxCombo'),
    lblAcc:   $('#lblAccuracy'),
    // Result mirror (ถ้ามีใน DOM)
    resScore:    $('#resScore'),
    resMaxCombo: $('#resMaxCombo'),
    resAcc:      $('#resAcc'),
    resDiff:     $('#resDiff'),
    // Difficulty
    selDiff:  $('#selDiff')
  };

  // =============== Game State ===============
  const Game = {
    state: 'idle',            // idle|running|paused|finished
    initTime: 85,             // เซ็ตตามความยาก
    startedAt: 0,
    pauseAt: 0,
    pauseOffset: 0,           // เวลาที่หยุดไปทั้งหมด (ms)

    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    total: 0,                 // จำนวนเป้าที่ควรตีทั้งหมด (ไว้คำนวณ accuracy)
    accuracy: 0,              // 0..1
    raf: 0,

    // ตัวอย่างข้อมูลสปอว์น (mock) — ให้แทนที่ด้วยลอจิกจริงของคุณ
    pattern: [],
    nextIdx: 0
  };

  // =============== Audio (Autoplay Guard) ===============
  const AudioMgr = (()=> {
    let unlocked = false;
    let bgm;
    function ensure(){
      if (bgm) return;
      bgm = new Audio('../assets/bgm_shadow.mp3');
      bgm.loop = true;
      bgm.preload = 'auto';
      bgm.volume = 0.65;
    }
    function unlock(){
      if (unlocked) return;
      ensure();
      bgm.play().then(()=>{
        bgm.pause();
        unlocked = true;
      }).catch(()=>{ /* เงียบไว้ รอ gesture ถัดไป */ });
    }
    function onFirstGesture(){ unlock(); }
    function play(){ if (!unlocked) return; bgm.currentTime = 0; bgm.play().catch(()=>{}); }
    function pause(){ bgm?.pause(); }
    function resume(){ if (unlocked && Game.state==='running') bgm?.play().catch(()=>{}); }
    return { onFirstGesture, play, pause, resume };
  })();

  ['click','touchstart','pointerdown','keydown'].forEach(ev=>{
    window.addEventListener(ev, ()=>AudioMgr.onFirstGesture(), { once:true, passive:true });
  });

  // =============== Helpers ===============
  function hideResult(){ UI.result?.classList.remove('is-visible'); UI.result?.setAttribute('aria-hidden','true'); }
  function showResult(){ UI.result?.classList.add('is-visible'); UI.result?.setAttribute('aria-hidden','false'); }

  function diffToTime(){
    const v = (UI.selDiff?.value || 'normal').toLowerCase();
    if (v==='easy')  return 90;
    if (v==='hard')  return 80;
    if (v==='final') return 75;
    return 85; // normal
  }

  function scoreByTiming(timing){
    // ปรับค่าน้ำหนักตามต้องการ
    if (timing==='perfect') return 150;
    if (timing==='good')    return 90;
    return 40; // late/early
  }

  function setStars(n){
    if (!UI.starWrap) return;
    UI.starWrap.innerHTML = '';
    for (let i=0;i<5;i++){
      const s = document.createElement('span');
      s.textContent = i<n ? '★' : '☆';
      UI.starWrap.appendChild(s);
    }
  }

  function updateHUD(){
    UI.lblScore && (UI.lblScore.textContent = Game.score|0);
    UI.lblCombo && (UI.lblCombo.textContent = Game.combo|0);
    UI.lblMaxCombo && (UI.lblMaxCombo.textContent = Game.maxCombo|0);
    UI.lblAcc   && (UI.lblAcc.textContent   = Game.total ? Math.round(Game.hits*100/Game.total)+'%' : '0%');

    if (UI.lblTime){
      const t = Math.max(0, Game.initTime - ((performance.now() - Game.startedAt - Game.pauseOffset)/1000));
      UI.lblTime.textContent = Math.ceil(t);
    }
  }

  function mirrorResultToDOM(){
    // เผื่อสะท้อนผลลง panel ถ้ามี element เหล่านี้
    UI.resScore    && (UI.resScore.textContent = Game.score|0);
    UI.resMaxCombo && (UI.resMaxCombo.textContent = Game.maxCombo|0);
    UI.resAcc      && (UI.resAcc.textContent = Math.round(Game.accuracy*100)+'%');
    if (UI.resDiff && UI.selDiff) UI.resDiff.textContent = (UI.selDiff.value||'normal').toUpperCase();
  }

  function dispatchFinishedEvent(){
    const detail = {
      score: Game.score,
      maxCombo: Game.maxCombo,
      accuracy: Game.accuracy
    };
    document.dispatchEvent(new CustomEvent('shadowbreaker:finished', { detail }));
  }

  // =============== Core Controls ===============
  function resetState(){
    cancelAnimationFrame(Game.raf);
    Game.state = 'idle';
    Game.pauseAt = 0;
    Game.pauseOffset = 0;

    Game.initTime = diffToTime();
    Game.startedAt = 0;

    Game.score = 0;
    Game.combo = 0;
    Game.maxCombo = 0;
    Game.hits = 0;
    Game.total = 0;
    Game.accuracy = 0;

    Game.pattern = [];
    Game.nextIdx = 0;

    // TODO: ล้างเป้า/โมเดล/อีเวนต์เฉพาะเกมที่ค้างอยู่ (ถ้ามี)
    hideResult();
    updateHUD();
  }

  function startGame(){
    if (Game.state === 'running') return;
    resetState();
    Game.state = 'running';
    Game.startedAt = performance.now();

    // เตรียมแพทเทิร์นตัวอย่าง (แทนที่ด้วยลอจิกจริงของคุณ)
    prepareMockPattern();

    AudioMgr.play();
    loop();
  }

  function finishGame(){
    if (Game.state === 'finished') return;
    Game.state = 'finished';
    cancelAnimationFrame(Game.raf);

    Game.accuracy = Game.total ? (Game.hits / Game.total) : 0;

    // เกณฑ์ดาวตัวอย่าง (ปรับได้)
    let stars = 0;
    if (Game.score > 3000) stars++;
    if (Game.score > 5000) stars++;
    if (Game.accuracy > 0.60) stars++;
    if (Game.accuracy > 0.80) stars++;
    if (Game.accuracy > 0.92) stars++;

    setStars(stars);
    mirrorResultToDOM();
    showResult();
    AudioMgr.pause();

    dispatchFinishedEvent();
  }

  function pauseGame(){
    if (Game.state !== 'running') return;
    Game.state = 'paused';
    Game.pauseAt = performance.now();
    cancelAnimationFrame(Game.raf);
    AudioMgr.pause();
  }

  function resumeGame(){
    if (Game.state !== 'paused') return;
    Game.state = 'running';
    Game.pauseOffset += (performance.now() - Game.pauseAt);
    loop();
    AudioMgr.resume();
  }

  // =============== Loop ===============
  function loop(){
    if (Game.state !== 'running') return;
    Game.raf = requestAnimationFrame(loop);

    // หมดเวลา → จบเกม
    const t = Game.initTime - ((performance.now() - Game.startedAt - Game.pauseOffset)/1000);
    if (t <= 0){ finishGame(); return; }

    // อัปเดตเป้า (ตัวอย่าง)
    updatePattern();

    // TODO: ตรวจชน/ตรวจHitจริง (raycaster/hitbox/hand/controller)
    // ตัวอย่างการตีโดน/พลาด:
    // onHit({ type:'normal', timing:'perfect' });
    // onHit({ type:'bomb' });
    // onMiss();

    updateHUD();
  }

  // =============== Game Logic (ตัวอย่าง/สาย mock) ===============
  function prepareMockPattern(){
    // สร้างเป้าแบบง่าย ๆ: ทุก 0.8s มีเป้า 1 อัน และสุ่มเป็น bomb ~10%
    Game.pattern.length = 0;
    const dur = Game.initTime;
    let t = 0.8;
    while (t < dur - 0.5){
      Game.pattern.push({
        t,                            // วินาทีที่ควรตี
        type: Math.random() < 0.1 ? 'bomb' : 'normal',
        lane: Math.random() < 0.5 ? 'L' : 'R'
      });
      t += 0.8;
    }
    Game.nextIdx = 0;
    Game.total = Game.pattern.filter(x=>x.type!=='bomb').length; // นับเฉพาะเป้าปกติสำหรับ accuracy
  }

  function updatePattern(){
    // เมื่อถึงเวลา target.t ใกล้กับเวลาปัจจุบัน → ถือว่ามีเป้า active
    // ในเดโมนี้ เราจะ "จำลอง" การตีโดนอัตโนมัติแบบสุ่มเล็กน้อย เพื่อให้ HUD เปลี่ยนค่าได้
    const nowSec = (performance.now() - Game.startedAt - Game.pauseOffset)/1000;
    while (Game.nextIdx < Game.pattern.length && Game.pattern[Game.nextIdx].t <= nowSec){
      const target = Game.pattern[Game.nextIdx++];
      // จำลอง: โอกาสโดน 85%, ถ้าโดนสุ่ม timing
      const hit = Math.random() < 0.85;
      if (hit){
        if (target.type === 'bomb'){
          // โดน bomb → ตัดคอมโบทันที (ไม่ลดสกอร์)
          Game.combo = 0;
        }else{
          const timing = (Math.random()<0.5)? 'perfect' : 'good';
          onHit({ type:'normal', timing });
        }
      }else{
        // พลาด (เฉพาะเป้าปกติ) → รีเซ็ตคอมโบเล็กน้อย
        if (target.type !== 'bomb'){
          Game.combo = 0;
        }
      }
    }
  }

  function onHit(target){
    if (target.type === 'bomb'){
      Game.combo = 0; // ตัดคอมโบทันที
      updateHUD();
      return;
    }
    // เป้าปกติ
    Game.hits++;
    const add = scoreByTiming(target.timing || 'good');
    Game.score += add;
    Game.combo++;
    Game.maxCombo = Math.max(Game.maxCombo, Game.combo);
    updateHUD();
  }

  // =============== Events ===============
  UI.btnStart?.addEventListener('click', startGame);
  UI.btnPause?.addEventListener('click', ()=> (Game.state==='running' ? pauseGame() : resumeGame()));
  UI.btnEnd  ?.addEventListener('click', finishGame);

  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && Game.state==='running') pauseGame();
  });

  // เริ่มต้นหน้า: ซ่อนผลลัพธ์ + อัปเดต HUD เริ่มต้น
  hideResult();
  updateHUD();
})();
