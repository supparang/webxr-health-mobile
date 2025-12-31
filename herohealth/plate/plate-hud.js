// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (HHA Standard) — PRODUCTION
// ✅ Listen: hha:score, quest:update, hha:coach, hha:judge, hha:end, hha:time, hha:adaptive
// ✅ Safe: element missing -> skip
// ✅ H++++: judge toast + perfect pop + spark + fever-high class + combo30 class + result SSS glow
// ✅ No double bind (guard)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // ---- guard: no double bind
  if (root.__HHA_PLATE_HUD_BOUND__) return;
  root.__HHA_PLATE_HUD_BOUND__ = true;

  // ---- helpers
  function qs(id){ return doc.getElementById(id); }
  function setText(id, v){
    const el = qs(id);
    if (el) el.textContent = String(v);
  }
  function setWidth(id, pct){
    const el = qs(id);
    if (el) el.style.width = `${Math.max(0, Math.min(100, Number(pct)||0))}%`;
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // =========================
  // Judge Toast (top-center)
  // =========================
  let toast = doc.querySelector('.hha-judge');
  if(!toast){
    toast = doc.createElement('div');
    toast.className = 'hha-judge';
    toast.textContent = '';
    doc.body.appendChild(toast);
  }

  function showToast(text, kind='info', ms=850){
    if(!toast) return;
    toast.classList.remove('good','warn','bad','perfect','show');
    if(kind) toast.classList.add(kind);
    toast.textContent = String(text||'');
    // restart animation-ish
    void toast.offsetWidth;
    toast.classList.add('show');

    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=>{
      toast.classList.remove('show');
    }, Math.max(250, ms|0));
  }

  // =========================
  // Perfect Pop + Spark (center-ish)
  // =========================
  function perfectPop(label, isMega){
    const el = doc.createElement('div');
    el.className = 'hha-perfect' + (isMega ? ' mega' : '');
    el.textContent = label || (isMega ? 'MEGA!' : 'PERFECT!');
    el.style.left = '50%';
    el.style.top  = '55%';
    doc.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);

    // spark
    const s = doc.createElement('div');
    s.className = 'hha-spark';
    s.style.left = '50%';
    s.style.top  = '55%';
    doc.body.appendChild(s);
    setTimeout(()=>{ try{ s.remove(); }catch(_){ } }, 650);
  }

  // =========================
  // State cache (optional)
  // =========================
  let last = {
    score:0, combo:0, comboMax:0, miss:0,
    fever:0, shield:0, grade:'C', acc:0,
    timeLeftSec:null
  };

  function applyBodyClasses(){
    // FEVER pressure
    doc.body.classList.toggle('fever-high', (last.fever >= 70));
    // COMBO high vibe
    doc.body.classList.toggle('hha-combo30', (last.combo >= 30));
    // Slowmo vibe (ไว้ให้เกมอื่น/อนาคตใช้ได้) — เปิดเมื่อ fever สูงมาก
    doc.body.classList.toggle('hha-slowmo', (last.fever >= 90));
  }

  // =========================
  // Event handlers
  // =========================
  function onScore(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d || d.game !== 'plate') return;

    last.score = Number(d.score)||0;
    last.combo = Number(d.combo)||0;
    last.comboMax = Number(d.comboMax)||0;
    last.miss = Number(d.miss)||0;
    last.fever = clamp(d.fever,0,100);
    last.shield = clamp(d.shield,0,99);
    last.grade = String(d.grade || 'C');
    last.acc = clamp(d.accuracyGoodPct,0,100);
    if (d.timeLeftSec != null) last.timeLeftSec = Number(d.timeLeftSec)||0;

    // HUD (เผื่อ plate.safe.js ยังไม่อัปเดต / หรืออยากให้ binder ช่วย)
    setText('uiScore', last.score);
    setText('uiCombo', last.combo);
    setText('uiComboMax', last.comboMax);
    setText('uiMiss', last.miss);
    setText('uiGrade', last.grade);
    setText('uiAcc', `${Math.round(last.acc)}%`);
    if(last.timeLeftSec != null) setText('uiTime', Math.ceil(last.timeLeftSec));

    // plateHave & gCount (ถ้ามี)
    if (typeof d.plateHave === 'number') setText('uiPlateHave', d.plateHave);
    if (Array.isArray(d.gCount) && d.gCount.length >= 5){
      setText('uiG1', d.gCount[0]||0);
      setText('uiG2', d.gCount[1]||0);
      setText('uiG3', d.gCount[2]||0);
      setText('uiG4', d.gCount[3]||0);
      setText('uiG5', d.gCount[4]||0);
    }

    // fever/shield
    setWidth('uiFeverFill', last.fever);
    setText('uiShieldN', last.shield);

    applyBodyClasses();
  }

  function onQuest(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d || d.game !== 'plate') return;

    // Goal
    if(d.goal){
      setText('uiGoalTitle', d.goal.title ?? '—');
      setText('uiGoalCount', `${d.goal.cur ?? 0}/${d.goal.target ?? 0}`);
      const pct = (d.goal.target>0) ? ((d.goal.cur/d.goal.target)*100) : 0;
      setWidth('uiGoalFill', pct);
    }

    // Mini
    if(d.mini){
      setText('uiMiniTitle', d.mini.title ?? '—');
      const tl = d.mini.timeLeft;
      if(tl == null) setText('uiMiniTime', '--');
      else setText('uiMiniTime', `${Math.ceil(Math.max(0, tl))}s`);

      // miniCount ใน plate.safe.js อาจคุมเอง แต่ binder กันหาย
      if(qs('uiMiniCount')){
        // ถ้าไม่มีข้อมูลรวม ก็แค่โชว์ 0/0
        const cur = (typeof d.mini.cur === 'number') ? d.mini.cur : 0;
        const tgt = (typeof d.mini.target === 'number') ? d.mini.target : 0;
        setText('uiMiniCount', `${cur}/${tgt}`);
      }

      // Fill = time progress
      if(typeof d.mini.target === 'number' && d.mini.target > 0 && typeof tl === 'number'){
        const pct = ((d.mini.target - tl) / d.mini.target) * 100;
        setWidth('uiMiniFill', pct);
      } else {
        setWidth('uiMiniFill', 0);
      }
    }
  }

  function onCoach(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d || d.game !== 'plate') return;

    const msg = d.msg ?? '';
    setText('coachMsg', msg);

    const mood = String(d.mood || 'neutral');
    const img = qs('coachImg');
    if(img){
      const map = {
        happy: './img/coach-happy.png',
        neutral:'./img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[mood] || map.neutral;
    }
  }

  function onJudge(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d || d.game !== 'plate') return;

    const text = String(d.text || '');
    const kind = String(d.kind || 'info');

    // toast
    // map kind -> css class
    const k =
      (kind === 'good') ? 'good' :
      (kind === 'warn') ? 'warn' :
      (kind === 'bad')  ? 'bad'  :
      (kind === 'perfect') ? 'perfect' : '';

    showToast(text, k, (k==='bad'? 950 : 780));

    // Perfect pop (ถ้า event ยิงมาเป็น kind perfect หรือมีคำว่า PERFECT/MEGA)
    if(kind === 'perfect' || /PERFECT/i.test(text)){
      const mega = /MEGA/i.test(text) || /🔥/.test(text);
      perfectPop(mega ? 'MEGA!' : 'PERFECT!', mega);
    }
  }

  function onEnd(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d || d.game !== 'plate') return;

    const summary = d.summary || null;
    if(!summary) return;

    // result SSS glow
    const back = qs('resultBackdrop');
    if(back){
      back.classList.toggle('sss', String(summary.grade||'') === 'SSS');
    }
  }

  function onTime(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d || d.game !== 'plate') return;
    if(d.timeLeftSec != null){
      last.timeLeftSec = Number(d.timeLeftSec)||0;
      setText('uiTime', Math.ceil(last.timeLeftSec));
    }
  }

  // optional debug: adaptive
  function onAdaptive(ev){
    const d = (ev && ev.detail) ? ev.detail : null;
    if(!d || d.game !== 'plate') return;
    // ถ้าจะโชว์ debug ในอนาคตค่อยเพิ่ม element ได้
  }

  // =========================
  // Bind events
  // =========================
  root.addEventListener('hha:score', onScore);
  root.addEventListener('quest:update', onQuest);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:judge', onJudge);
  root.addEventListener('hha:end', onEnd);
  root.addEventListener('hha:time', onTime);
  root.addEventListener('hha:adaptive', onAdaptive);

})(window);