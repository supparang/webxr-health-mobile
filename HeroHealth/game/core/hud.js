// === core/hud.js (minimal HUD object)
export function createHUD({ onHome=()=>{}, onReplay=()=>{} }={}){
  const els = {
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    time : document.getElementById('time'),
    coach: document.getElementById('coachHUD'),
    coachText: document.getElementById('coachText'),
    questHost: document.getElementById('questChips'),
    result: document.getElementById('result'),
    resultText: document.getElementById('resultText'),
    menu: document.getElementById('menuBar'),
  };

  function updateScore(score=0, combo=0, time=0){
    if (els.score) els.score.textContent = score|0;
    if (els.combo) els.combo.textContent = 'x'+(combo|0);
    if (els.time)  els.time.textContent  = time|0;
  }
  function setCoach(msg){ if(!els.coach || !els.coachText) return;
    els.coachText.textContent = msg; els.coach.classList.add('show'); }
  function hideCoach(){ els.coach?.classList.remove('show'); }
  function setFever(on){ /* optional */ }
  function dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160); }

  function setQuestChips(list=[]){
    if(!els.questHost) return;
    els.questHost.innerHTML = list.map(q=>{
      const pct = Math.min(100, Math.round((q.progress|0)/(q.need||1)*100));
      return `<li class="${q.done?'done':''} ${q.fail?'fail':''}">
        <span class="ico">${q.icon||'⭐'}</span>
        <span style="font:800 12px ui-rounded">${q.label||q.id}</span>
        <span style="opacity:.9">${q.progress||0}/${q.need||0}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </li>`;
    }).join('');
  }
  function markQuestDone(qid){ /* optional glow */ }

  function showHydration(){}

  function showResult({score=0, combo=0, quests=[]}={}){
    els.resultText.textContent = `Score ${score} • Max Combo ${combo}`;
    els.result.style.display = 'flex';
    document.querySelector('[data-result="home"]')?.addEventListener('click', ()=>{
      els.result.style.display='none'; els.menu.style.display='block'; onHome();
    }, { once:true });
    document.querySelector('[data-result="replay"]')?.addEventListener('click', ()=>{
      els.result.style.display='none'; onReplay();
    }, { once:true });
  }

  return { updateScore, setCoach, hideCoach, setFever, dimPenalty, setQuestChips, markQuestDone, showHydration, showResult };
}
