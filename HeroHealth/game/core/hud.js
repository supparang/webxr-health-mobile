// === HUD core (2025-10-30) ===
// Provides: createHUD({onHome,onReplay}), with methods used by main/modes.

export function createHUD({ onHome=()=>{}, onReplay=()=>{} }={}){
  const $ = (s)=>document.querySelector(s);

  const elScore = $('#score');
  const elTime  = $('#time');
  const elCoach = $('#coachHUD');
  const elCoachTxt = $('#coachText');
  const elToast = $('#toast');
  const elMission = $('#missionLine');
  const elQuestList = $('#questChips');

  const resultModal = $('#result');
  const resultText  = $('#resultText');
  const miniTop     = $('#miniTop');

  function resetScore(s=0,c=0){ if(elScore) elScore.textContent = String(s|0); }
  function updateScore(s, combo/*, tLeft*/){
    if (elScore) elScore.textContent = String(s|0);
    // (ถ้าต้องโชว์คอมโบ แทรก pill เพิ่มเองได้)
  }
  function updateTime(t){
    if (elTime) elTime.textContent = String(t|0);
    // tick sound optional: document.getElementById('sfx-tick')?.play?.();
  }
  function dimPenalty(){
    document.body.classList.add('flash-danger');
    setTimeout(()=>document.body.classList.remove('flash-danger'),160);
  }

  // Coach
  function setCoach(msg){ if(elCoachTxt) elCoachTxt.textContent = msg; }
  function showCoach(v){ if(elCoach) elCoach.classList.toggle('show', !!v); }

  // Quests chips
  function setQuestChips(items=[]){
    if (!elQuestList) return;
    elQuestList.innerHTML = items.map(q=>{
      const pct = q.need? Math.min(100, Math.round((q.progress/q.need)*100)) : 0;
      const cls = q.done? 'style="opacity:.9;filter:saturate(1.1)"' : (q.fail?'style="opacity:.45"':'');
      return `<li ${cls} data-qid="${q.key}" style="display:inline-flex;gap:6px;align-items:center;margin:0 6px 6px 0;
        padding:6px 10px;border-radius:999px;border:1px solid #1a2c47;background:#102038">
        <span>${q.icon||'⭐'}</span>
        <b style="font:800 12px ui-rounded">${q.label||q.key}</b>
        <span style="opacity:.85">${q.progress|0}/${q.need|0}</span>
      </li>`;
    }).join('');
  }
  function markQuestDone(qid){
    const li = elQuestList?.querySelector(`[data-qid="${qid}"]`);
    if (li){ li.style.opacity='1'; li.style.filter='saturate(1.2)'; }
  }

  // Groups target HUD
  function setTarget(groupId, have, need){
    const wrap = document.getElementById('targetWrap');
    const badge= document.getElementById('targetBadge');
    const mapTH={veggies:'ผัก',protein:'โปรตีน',grains:'ธัญพืช',fruits:'ผลไม้',dairy:'นม'};
    if (wrap) wrap.style.display='inline-flex';
    if (badge) badge.textContent = `${mapTH[groupId]||groupId} • ${have|0}/${need|0}`;
  }

  // Hydration bar hookup (optional UI.js handles visuals)
  function showHydration(zone='OK', pct=50){
    // If you have custom visual, wire it here. For now we just ensure toast as hint.
    // no-op for minimalist HUD
  }

  // Result
  function showResult({score=0, combo=0, quests=[]}={}){
    if (resultText) resultText.textContent = `⭐ ${score}  •  Max Combo ${combo}`;
    if (miniTop){
      miniTop.innerHTML = quests.map(q=>{
        const st = q.done ? '✅' : (q.fail?'❌':'—');
        return `<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid #13243d;padding:6px 0">
          <span>${st} ${q.label||q.id}</span>
          <span>${q.prog|0}/${q.need|0}</span>
        </div>`;
      }).join('');
    }
    if (resultModal) resultModal.style.display='flex';
    wireResultButtons();
  }
  function hideResult(){ if(resultModal) resultModal.style.display='none'; }
  function wireResultButtons(){
    resultModal?.querySelector('[data-result="replay"]')?.addEventListener('click', onReplay, { once:true });
    resultModal?.querySelector('[data-result="home"]')?.addEventListener('click', onHome, { once:true });
  }

  // helpers UI sugar
  function toast(msg){ if(!elToast) return; elToast.textContent=msg; elToast.classList.add('show'); setTimeout(()=>elToast.classList.remove('show'), 900); }
  function flashLine(msg){ if(!elMission) return; elMission.textContent=msg; elMission.style.display='block'; setTimeout(()=>elMission.style.display='none', 950); }

  // public API
  return {
    resetScore, updateScore, updateTime, dimPenalty,
    setCoach, showCoach,
    setQuestChips, markQuestDone,
    setTarget, showHydration,
    showResult, hideResult,
    toast, flashLine
  };
}
