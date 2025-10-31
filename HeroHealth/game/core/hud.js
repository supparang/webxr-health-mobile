// === /webxr-health-mobile/HeroHealth/game/core/hud.js ===
// Minimal-but-solid HUD module for HeroHealth
// - Safe DOM lookups (ไม่พังแม้บาง element ไม่มี)
// - Non-blocking HUD (pointer-events กับปุ่มเท่านั้น)
// - Helpers: score/combo/time, coach, fever, target, hydration, plate quota
// - Quests chips, penalty flash, Result modal wiring

function _(id){ return document.getElementById(id); }
function setTxt(el, t){ if(el) el.textContent = (t==null?'':String(t)); }
function show(el, on=true){ if(el) el.style.display = on ? (el.dataset.display||'block') : 'none'; }
function pct(n){ return Math.max(0, Math.min(100, n|0)); }

export function createHUD({ onHome=()=>{}, onReplay=()=>{} } = {}) {
  // ---------- Cache DOM ----------
  const els = {
    hudWrap      : _('hudWrap'),
    score        : _('score'),
    combo        : _('combo'),
    time         : _('time'),
    coach        : _('coachHUD'),
    coachText    : _('coachText'),
    questHost    : _('questChips'),

    // Target / Plate / Hydration
    targetWrap   : _('targetWrap'),
    targetBadge  : _('targetBadge'),
    plateTracker : _('plateTracker'),
    platePills   : _('platePills'),
    hydroWrap    : _('hydroWrap'),
    hydroLabel   : _('hydroLabel'),
    hydroBar     : _('hydroBar'),

    // Fever
    fever        : _('fever'),
    feverBarWrap : _('feverBarWrap'),
    feverBar     : _('feverBar'),

    // Menus / Result
    menu         : _('menuBar'),
    result       : _('result'),
    resultText   : _('resultText'),
    resCore      : _('resCore'),
    resBreakdown : _('resBreakdown'),
    resBoard     : _('resBoard'),
    resMissions  : _('resMissions'),
    resDaily     : _('resDaily'),

    // Buttons
    btnHome      : _('btn_home'),
    btnReplay    : _('btn_replay'),
  };

  // ---------- Score / Combo / Time ----------
  let _score=0, _combo=0, _time=0;
  function setScore(v=0){ _score = v|0; setTxt(els.score, _score); }
  function setCombo(v=0){ _combo = v|0; setTxt(els.combo, 'x'+_combo); }
  function setTime(v=0){ _time = v|0; setTxt(els.time, _time); }
  function updateScore(score=0, combo=0, time=0){
    setScore(score); setCombo(combo); setTime(time);
  }

  // ---------- Coach bubble ----------
  let coachTO=0;
  function setCoach(msg='', ms=1400){
    if(!els.coach || !els.coachText) return;
    setTxt(els.coachText, msg);
    els.coach.classList.add('show');
    clearTimeout(coachTO);
    coachTO = setTimeout(()=>{ els.coach.classList.remove('show'); }, ms|0 || 1200);
  }
  function hideCoach(){
    if(!els.coach) return;
    els.coach.classList.remove('show');
    clearTimeout(coachTO);
  }

  // ---------- Fever ----------
  let _feverOn=false;
  function setFever(on){
    _feverOn=!!on;
    show(els.fever, _feverOn);
    show(els.feverBarWrap, true);
  }
  function setFeverProgress(p01=0){
    const w = pct((p01*100)|0);
    if(els.feverBar) els.feverBar.style.width = w+'%';
  }

  // ---------- Penalty flash ----------
  function dimPenalty(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
  }

  // ---------- Target / Plate / Hydration ----------
  // setTarget('veggies', have, need)
  const mapTH = { veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม' };
  const mapEN = { veggies:'Veggies', fruits:'Fruits', grains:'Grains', protein:'Protein', dairy:'Dairy' };
  function setTarget(group, have=0, need=0, lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase()){
    if(!els.targetWrap || !els.targetBadge) return;
    const label = (lang==='EN'? mapEN[group]: mapTH[group]) || group;
    els.targetBadge.innerHTML = `<b>${label}</b> • ${have|0}/${need|0}`;
    show(els.targetWrap, true);
  }

  // showPlateQuota({ pills: [true,false,...], icon:'🍱' })
  function showPlateQuota({ pills=[], icon='🍱' } = {}){
    if(!els.plateTracker || !els.platePills) return;
    els.platePills.innerHTML = pills.map(ok=>`<i class="pill ${ok?'ok':''}" aria-hidden="true">${icon}</i>`).join('');
    show(els.plateTracker, true);
  }
  function hidePlateQuota(){ show(els.plateTracker, false); }

  // showHydration({ level: -1..+1, label:'—' })
  function showHydration({ level=0, label='—' } = {}){
    show(els.hydroWrap, true);
    if(els.hydroLabel) setTxt(els.hydroLabel, label);
    if(els.hydroBar){
      const w = pct(Math.round((level+1)/2*100)); // -1..+1 → 0..100
      els.hydroBar.style.width = w+'%';
    }
  }
  function hideHydration(){ show(els.hydroWrap, false); }

  // ---------- Quest chips ----------
  function setQuestChips(list=[]){
    if(!els.questHost) return;
    els.questHost.innerHTML = list.map(q=>{
      const prog = (q.progress|0), need = (q.need||0);
      const pctv = need? Math.min(100, Math.round(prog/need*100)) : 0;
      return `<div class="chip ${q.done?'done':''} ${q.fail?'fail':''}" role="status" aria-live="polite">
        <span class="ico">${q.icon||'⭐'}</span>
        <span style="font:800 12px ui-rounded">${q.label||q.id||'Quest'}</span>
        <span style="opacity:.9">${prog}/${need}</span>
        <span class="bar"><i style="width:${pctv}%"></i></span>
      </div>`;
    }).join('');
  }
  function markQuestDone(qid){ /* placeholder: glow or confetti could be added */ }

  // ---------- Result ----------
  function _wipeResult(){
    if(els.resCore) els.resCore.innerHTML = '';
    if(els.resBreakdown) els.resBreakdown.innerHTML = '';
    if(els.resBoard) els.resBoard.innerHTML = '';
    if(els.resMissions) els.resMissions.innerHTML = '';
    if(els.resDaily) els.resDaily.innerHTML = '';
  }

  function showResult({ score=0, combo=0, time=0, missions=[], daily=null, board=null, breakdown=null } = {}){
    if(els.menu) els.menu.style.display='none';
    _wipeResult();

    if(els.resultText){
      els.resultText.textContent = `Score ${score|0} • Max Combo ${combo|0} • Time ${time|0}s`;
    }
    if(els.resCore){
      els.resCore.innerHTML = `
        <div class="tbl">
          <div><b>Score</b> <span>${score|0}</span></div>
          <div><b>Max Combo</b> <span>${combo|0}</span></div>
          <div><b>Time</b> <span>${time|0}s</span></div>
        </div>`;
    }
    if(breakdown && els.resBreakdown){
      els.resBreakdown.innerHTML = `<h4 style="margin:.6rem 0 .25rem">Breakdown</h4>
        <pre class="mono" style="opacity:.9">${typeof breakdown==='string'? breakdown : JSON.stringify(breakdown,null,2)}</pre>`;
    }
    if(board && els.resBoard){
      els.resBoard.innerHTML = `<h4 style="margin:.6rem 0 .25rem">Board</h4>
        <pre class="mono" style="opacity:.9">${typeof board==='string'? board : JSON.stringify(board,null,2)}</pre>`;
    }
    if(missions?.length && els.resMissions){
      els.resMissions.innerHTML = `<h4 style="margin:.6rem 0 .25rem">Missions</h4>
        ${missions.map(m=>`<div>• ${m.title||m.id||'Mission'} — ${m.done?'✅':'—'} ${m.note?('('+m.note+')'):''}</div>`).join('')}`;
    }
    if(daily && els.resDaily){
      els.resDaily.innerHTML = `<h4 style="margin:.6rem 0 .25rem">Daily</h4>
        <div>${daily.text||''}</div>`;
    }

    // bind result buttons (one-shot)
    const homeBtn   = document.querySelector('[data-result="home"]')   || els.btnHome;
    const replayBtn = document.querySelector('[data-result="replay"]') || els.btnReplay;
    if(homeBtn){
      homeBtn.addEventListener('click', ()=>{
        show(els.result,false);
        if(els.menu) els.menu.style.display='block';
        onHome();
      }, { once:true });
    }
    if(replayBtn){
      replayBtn.addEventListener('click', ()=>{
        show(els.result,false);
        onReplay();
      }, { once:true });
    }

    show(els.result, true);
  }

  // ---------- Public API ----------
  return {
    // base
    updateScore, setScore, setCombo, setTime,
    setCoach, hideCoach, setFever, setFeverProgress, dimPenalty,
    // targets / trackers
    setTarget, showPlateQuota, hidePlateQuota,
    showHydration, hideHydration,
    // quests
    setQuestChips, markQuestDone,
    // result
    showResult,
    // raw refs if needed
    els
  };
}
