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
    if (els.combo) els.combo.textContent = combo|0;
    if (els.time)  els.time.textContent  = time|0;
  }
  function setCoach(msg){ if(!els.coach || !els.coachText) return;
    els.coachText.textContent = msg; els.coach.classList.add('show'); }
  function hideCoach(){ els.coach?.classList.remove('show'); }
  function setFever(on){ /* add fever glow if want */ }
  function dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160); }

  function setQuestChips(list=[]){
    if(!els.questHost) return;
    els.questHost.innerHTML = list.map(q=>{
      const pct = Math.min(100, Math.round((q.progress|0)/(q.need||1)*100));
      return `<li style="display:inline-flex;gap:6px;align-items:center;margin:4px 6px 0 0;
               padding:6px 10px;border:1px solid #1a2c47;border-radius:999px;background:#0f1d31">
        <span>${q.icon||'⭐'}</span>
        <span style="font:800 12px ui-rounded">${q.label||q.id}</span>
        <span style="opacity:.9">${q.progress||0}/${q.need||0}</span>
        <i style="display:inline-block;width:66px;height:6px;border-radius:5px;background:#0a1f37;overflow:hidden">
          <b style="display:block;height:100%;width:${pct}%;background:#2dd4bf"></b>
        </i>
      </li>`;
    }).join('');
  }
  function markQuestDone(qid){ /* optional glow */ }

  function showHydration(zone='OK', pct=50){
    // simple needle: use toast/target or custom UI
    // (ปล่อยให้ hydration.js วาด overlay bar แยก)
  }

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
