/* ===== Shadow Breaker · Coach Add-on (DOM-driven, no core edits) =====
   - ติดตั้งโค้ชโดยอ่านค่า HUD (#combo, #time, #phaseLabel, #hudStatus, #results)
   - ทริกเกอร์: เริ่มเกม, คอมโบ 5/10/20/30, พลาดติดกัน, Fever, เข้า Phase 2, ใกล้หมดเวลา, จบเกม
   - ใช้ได้เลยโดยวางต่อท้าย game.js เดิม (ไม่แก้ฟังก์ชันหลัก)
*/
(function(){
  "use strict";

  // ---------- helpers ----------
  const $ = (id)=>document.getElementById(id);
  const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');
  const safeNum = (v, d=0)=>{ const n = parseInt(v,10); return isNaN(n)?d:n; };
  const nowms = ()=> performance.now();

  // ---------- coach UI ----------
  function installCoachUI(){
    if (document.getElementById('sbCoachBox')) return;
    const box=document.createElement('div'); box.id='sbCoachBox';
    Object.assign(box.style,{
      position:'fixed', left:'12px', bottom:'12px', zIndex:9999,
      display:'flex', gap:'8px', alignItems:'center',
      background:'rgba(6,14,24,.82)', border:'1px solid rgba(0,255,170,.25)',
      color:'#dff', padding:'8px 10px', borderRadius:'12px', maxWidth:'56vw',
      font:'600 13px/1.25 system-ui,Segoe UI,Arial'
    });
    const avatar=document.createElement('div');
    Object.assign(avatar.style,{
      width:'36px', height:'36px', borderRadius:'50%',
      background:'radial-gradient(#00c9a7,#006b62)', boxShadow:'0 0 12px rgba(0,255,200,.45) inset'
    });
    const text=document.createElement('div'); text.id='sbCoachText'; text.textContent='พร้อมลุย!';
    box.appendChild(avatar); box.appendChild(text);
    document.body.appendChild(box);
  }
  installCoachUI();

  // ---------- SFX (optional; ถ้าไม่มีไฟล์ จะข้ามแบบเงียบ ๆ) ----------
  function S(p){ try{ const a=new Audio(p); a.preload='auto'; a.crossOrigin='anonymous'; return a; }catch(_){ return {play(){} }; }
  }
  const SFX = {
    go:    S(`${ASSET_BASE}/assets/sfx/coach_go.mp3`),
    nice:  S(`${ASSET_BASE}/assets/sfx/coach_nice.mp3`),
    warn:  S(`${ASSET_BASE}/assets/sfx/coach_warn.mp3`),
    fever: S(`${ASSET_BASE}/assets/sfx/coach_fever.mp3`),
    boss:  S(`${ASSET_BASE}/assets/sfx/coach_boss.mp3`),
    end:   S(`${ASSET_BASE}/assets/sfx/coach_end.mp3`),
    crowd10: S(`${ASSET_BASE}/assets/sfx/crowd10.mp3`),
    crowd20: S(`${ASSET_BASE}/assets/sfx/crowd20.mp3`)
  };

  // ---------- coach speak queue ----------
  const coachQ=[]; let coachBusy=false; let lastCoachAt=0;
  function coachSay(msg, sfx=null, ttl=2100){
    const t=nowms();
    // กันสแปม: เว้นอย่างน้อย 600ms
    if (t - lastCoachAt < 600){ coachQ.push({msg,sfx,ttl}); return; }
    lastCoachAt = t;
    const el = $('sbCoachText'); if(!el) return;
    el.textContent = msg;
    try{ sfx && sfx.play && sfx.play(); }catch(_){}
    if (coachBusy) return;
    coachBusy = true;
    setTimeout(()=>{
      coachBusy = false;
      if (coachQ.length){
        const n = coachQ.shift();
        coachSay(n.msg, n.sfx, n.ttl);
      }
    }, ttl);
  }

  // ---------- DOM watchers ----------
  let lastCombo = 0;
  let missStreak = 0;
  let lastPhase = '1';
  let feverWasOn = false;
  let running = false;      // เดาว่ากำลังเล่นจาก HUD
  let lastTime = 0;
  let startedOnce = false;  // กันพูดซ้ำตอนเริ่ม
  let resultsShown = false;

  function isResultsVisible(){
    const r = $('results'); if(!r) return false;
    return (getComputedStyle(r).display!=='none');
  }
  function isFeverOn(){
    // เกมหลักมี HUD เสริม: ถ้าขึ้นคำว่า FEVER ในกล่องมุมขวาบน
    const hs = $('hudStatus'); if(!hs) return false;
    return /\bFEVER\b/i.test(hs.textContent||'');
  }
  function readCombo(){ return safeNum(($('combo')?.textContent||'0'), 0); }
  function readTime(){ return safeNum(($('time')?.textContent||'0'), 0); }
  function readPhase(){ return ( $('phaseLabel')?.textContent || 'Phase 1' ).replace(/^\D+/,'') || '1'; }

  // ---------- reactions ----------
  function onStart(){
    coachSay('เริ่มจากช้า ๆ โฟกัสจังหวะและเส้นเตือน!', SFX.go, 2400);
  }
  function onComboMilestone(c){
    if (c===5)  coachSay('ดีมาก! จังหวะมาแล้ว!', SFX.nice);
    if (c===10){ coachSay('สุดยอด! รักษาความต่อเนื่อง!', SFX.nice); try{SFX.crowd10.play();}catch(_){} }
    if (c===20){ coachSay('อย่างเทพ! อย่าพลาดนะ!', SFX.nice, 1800); try{SFX.crowd20.play();}catch(_){} }
    if (c===30){ coachSay('โฟกัส! คอมโบสูงมากแล้ว!', SFX.nice, 1800); }
  }
  function onMiss(){
    missStreak++;
    if (missStreak===2) coachSay('ช้าไปนิด ลองตัดเร็วขึ้น!', SFX.warn);
    if (missStreak>=4) coachSay('ลองขยับมือตามแนวสลาชให้ชัด ๆ!', SFX.warn, 2600);
  }
  function onHit(){
    // รีเซ็ต streak เมื่อคอมโบเพิ่ม
    missStreak = 0;
  }
  function onFeverOn(){ coachSay('FEVER มาแล้ว! แต้มคูณ โกยให้สุด!', SFX.fever, 1800); }
  function onPhase2(){ coachSay('Phase 2! ล็อคจังหวะให้แน่น ระวังท่าพิเศษ!', SFX.boss, 2200); }
  function onLowTime(){ coachSay('เหลือเวลาไม่มาก เร่งมือ!', SFX.warn, 1500); }
  function onEnd(gradeText){
    // gradeText: สรุปจากหน้าผลลัพธ์ (ถ้ามี)
    coachSay(`จบเกมแล้ว! ${gradeText||''}`.trim(), SFX.end, 2200);
  }

  // ---------- main poller ----------
  setInterval(()=>{
    // สถานะจบเกม
    const rVisible = isResultsVisible();
    if (rVisible && !resultsShown){
      resultsShown = true;
      // ดึงคะแนนสรุป (ถ้ามี)
      const acc = $('rAcc')?.textContent || '';
      const sc  = $('rScore')?.textContent || '';
      onEnd(`คะแนน ${sc} · ACC ${acc}`);
    } else if (!rVisible){
      resultsShown = false;
    }

    // เวลา / เริ่มเกม
    const t = readTime();
    const combo = readCombo();
    const phase = readPhase();
    const feverNow = isFeverOn();

    // เดาว่า "เริ่มเล่น" เมื่อ time จาก 0/ว่าง กลายเป็น >0 และหน้า results ยังไม่โชว์
    const hasArena = !!document.getElementById('arena');
    const inPlay = hasArena && !rVisible && t>0;
    if (inPlay && !running){
      running = true;
      startedOnce = true;
      lastTime = t;
      onStart();
    } else if (!inPlay && running){
      running = false;
      missStreak = 0;
      lastCombo = 0;
    }

    if (!running) return;

    // time decreasing -> แจ้งเตือนเมื่อเหลือน้อย
    if (t !== lastTime){
      if (t===20 || t===10) onLowTime();
      lastTime = t;
    }

    // fever detect (edge: off -> on)
    if (!feverWasOn && feverNow){
      onFeverOn();
    }
    feverWasOn = feverNow;

    // phase change
    if (phase !== lastPhase){
      if (String(phase)==='2') onPhase2();
      lastPhase = phase;
    }

    // combo logic: เพิ่ม/ลด
    if (combo !== lastCombo){
      if (combo > lastCombo){
        // เพิ่มคอมโบ = โดนโน้ต
        onHit();
        if ([5,10,20,30].includes(combo)) onComboMilestone(combo);
      } else {
        // ลดลง (เช่น กลายเป็น 0) = พลาด
        if (combo===0 && lastCombo>0) onMiss();
      }
      lastCombo = combo;
    }
  }, 250);

})();
