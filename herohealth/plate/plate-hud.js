// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (PRODUCTION)
// ✅ Listens: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ Safe: if element missing -> skip
// ✅ Adds: Judge/Toast overlay for clarity (good/warn/bad)
// ✅ No conflict with plate.safe.js (can be redundant, but safe)

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC) return;

  if(root.__HHA_PLATE_HUD_BOUND__) return;
  root.__HHA_PLATE_HUD_BOUND__ = true;

  // ---------------- utils ----------------
  const qs = (id)=>DOC.getElementById(id);
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const setText = (id, v)=>{
    const el = qs(id);
    if(el) el.textContent = String(v);
  };
  const setWidthPct = (id, pct)=>{
    const el = qs(id);
    if(el) el.style.width = `${clamp(pct,0,100)}%`;
  };
  const fmtPct = (x)=>`${Math.round((Number(x)||0))}%`;

  // ---------------- toast/judge layer ----------------
  function ensureToast(){
    let wrap = DOC.querySelector('.hha-plate-toast');
    if(wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'hha-plate-toast';
    wrap.style.cssText = `
      position:fixed;
      left:50%;
      top:calc(env(safe-area-inset-top, 0px) + 12px);
      transform:translateX(-50%);
      z-index:88;
      pointer-events:none;
      display:flex;
      flex-direction:column;
      gap:8px;
      align-items:center;
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function toast(text, kind){
    if(!text) return;
    const wrap = ensureToast();
    const el = DOC.createElement('div');
    const k = String(kind||'info');

    let bg = 'rgba(2,6,23,.72)';
    let bd = 'rgba(148,163,184,.18)';
    let glow = 'rgba(0,0,0,.35)';

    if(k === 'good'){ bg='rgba(34,197,94,.16)'; bd='rgba(34,197,94,.30)'; glow='rgba(34,197,94,.12)'; }
    else if(k === 'warn'){ bg='rgba(245,158,11,.16)'; bd='rgba(245,158,11,.30)'; glow='rgba(245,158,11,.10)'; }
    else if(k === 'bad'){ bg='rgba(239,68,68,.16)'; bd='rgba(239,68,68,.30)'; glow='rgba(239,68,68,.10)'; }

    el.textContent = String(text);
    el.style.cssText = `
      max-width:min(720px, calc(100vw - 22px));
      padding:10px 12px;
      border-radius:999px;
      border:1px solid ${bd};
      background:${bg};
      backdrop-filter: blur(10px);
      color:rgba(229,231,235,.98);
      font: 1100 13px/1.2 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
      box-shadow: 0 18px 44px ${glow}, 0 22px 70px rgba(0,0,0,.35);
      letter-spacing:.01em;
      opacity:0;
      transform: translateY(-6px) scale(.98);
      transition: opacity .12s ease, transform .12s ease;
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
    `;
    wrap.appendChild(el);

    // animate in
    requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    });

    // auto remove
    clearTimeout(el._t);
    el._t = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px) scale(.98)';
      setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 200);
    }, (k==='bad' ? 950 : 720));
  }

  // ---------------- coach image mapping ----------------
  function setCoach(mood){
    const img = qs('coachImg');
    if(!img) return;

    const m = String(mood||'neutral');
    const map = {
      happy: './img/coach-happy.png',
      neutral: './img/coach-neutral.png',
      sad: './img/coach-sad.png',
      fever: './img/coach-fever.png'
    };
    img.src = map[m] || map.neutral;
  }

  // ---------------- event handlers ----------------
  function onScore(d){
    if(!d || d.game !== 'plate') return;

    // core stats
    if(d.score != null) setText('uiScore', d.score);
    if(d.combo != null) setText('uiCombo', d.combo);
    if(d.comboMax != null) setText('uiComboMax', d.comboMax);
    if(d.miss != null) setText('uiMiss', d.miss);

    // plate state
    if(d.plateHave != null) setText('uiPlateHave', d.plateHave);
    if(Array.isArray(d.gCount)){
      setText('uiG1', d.gCount[0]||0);
      setText('uiG2', d.gCount[1]||0);
      setText('uiG3', d.gCount[2]||0);
      setText('uiG4', d.gCount[3]||0);
      setText('uiG5', d.gCount[4]||0);
    }

    // grade + acc
    if(d.accuracyGoodPct != null) setText('uiAcc', fmtPct(d.accuracyGoodPct));
    if(d.grade) setText('uiGrade', d.grade);

    // time
    if(d.timeLeftSec != null) setText('uiTime', Math.ceil(Number(d.timeLeftSec)||0));

    // fever/shield
    if(d.fever != null) setWidthPct('uiFeverFill', d.fever);
    if(d.shield != null) setText('uiShieldN', d.shield);
  }

  function onTime(d){
    if(!d || d.game !== 'plate') return;
    if(d.timeLeftSec != null) setText('uiTime', Math.ceil(Number(d.timeLeftSec)||0));
  }

  function onQuest(d){
    if(!d || d.game !== 'plate') return;

    const goal = d.goal;
    const mini = d.mini;

    if(goal && goal.title != null){
      setText('uiGoalTitle', goal.title);
      setText('uiGoalCount', `${goal.cur||0}/${goal.target||0}`);
      const pct = (goal.target ? ((goal.cur||0)/(goal.target||1)*100) : 0);
      setWidthPct('uiGoalFill', pct);
    }

    if(mini && mini.title != null){
      setText('uiMiniTitle', mini.title || '—');
      // uiMiniCount is used as "cleared/total" by safe.js; we won't override if not provided
      if(mini.timeLeft != null){
        setText('uiMiniTime', `${Math.ceil(Number(mini.timeLeft)||0)}s`);
        const dur = Number(mini.target)||0;
        const left = Number(mini.timeLeft)||0;
        const pct = (dur>0 ? ((dur-left)/dur*100) : 0);
        setWidthPct('uiMiniFill', pct);
      }else{
        setText('uiMiniTime', '--');
        setWidthPct('uiMiniFill', 0);
      }
    }
  }

  function onCoach(d){
    if(!d || d.game !== 'plate') return;
    if(d.msg != null) setText('coachMsg', d.msg);
    if(d.mood) setCoach(d.mood);
  }

  function onJudge(d){
    if(!d || d.game !== 'plate') return;
    const text = d.text || d.msg || '';
    const kind = d.kind || 'info';
    toast(text, kind);
  }

  function onEnd(d){
    if(!d || d.game !== 'plate') return;
    const s = d.summary || null;
    if(!s) return;

    // If plate.safe.js already shows result, this just reinforces correctness
    setText('rMode', s.runMode || 'play');
    setText('rGrade', s.grade || 'C');
    setText('rScore', s.scoreFinal || 0);
    setText('rMaxCombo', s.comboMax || 0);
    setText('rMiss', s.misses || 0);
    setText('rPerfect', (s.fastHitRatePct != null ? Math.round(s.fastHitRatePct)+'%' : '0%'));
    setText('rGoals', `${s.goalsCleared||0}/${s.goalsTotal||0}`);
    setText('rMinis', `${s.miniCleared||0}/${s.miniTotal||0}`);

    if(s.plate && Array.isArray(s.plate.counts)){
      setText('rG1', s.plate.counts[0]||0);
      setText('rG2', s.plate.counts[1]||0);
      setText('rG3', s.plate.counts[2]||0);
      setText('rG4', s.plate.counts[3]||0);
      setText('rG5', s.plate.counts[4]||0);
      setText('rGTotal', s.plate.total || (s.plate.counts.reduce((a,b)=>a+(b||0),0)));
    }
  }

  // ---------------- bind ----------------
  root.addEventListener('hha:score', (ev)=>{ try{ onScore(ev.detail||{}); }catch(e){} }, { passive:true });
  root.addEventListener('hha:time', (ev)=>{ try{ onTime(ev.detail||{}); }catch(e){} }, { passive:true });
  root.addEventListener('quest:update', (ev)=>{ try{ onQuest(ev.detail||{}); }catch(e){} }, { passive:true });
  root.addEventListener('hha:coach', (ev)=>{ try{ onCoach(ev.detail||{}); }catch(e){} }, { passive:true });
  root.addEventListener('hha:judge', (ev)=>{ try{ onJudge(ev.detail||{}); }catch(e){} }, { passive:true });
  root.addEventListener('hha:end', (ev)=>{ try{ onEnd(ev.detail||{}); }catch(e){} }, { passive:true });

  // ---------------- initial polish ----------------
  // If overlay exists at load, ensure preview labels are readable (safe no-op)
  try{
    const u = new URL(location.href);
    const diff = (u.searchParams.get('diff') || 'normal').toLowerCase();
    const time = (u.searchParams.get('time') || '90');
    const run  = (u.searchParams.get('run') || u.searchParams.get('runMode') || 'play').toLowerCase();
    setText('uiDiffPreview', diff);
    setText('uiTimePreview', time);
    setText('uiRunPreview', run);
  }catch(e){}

})(window);