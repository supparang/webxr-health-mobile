// === core/hud.js (HUD + PowerBar “ไฟลุก”)
export function createHUD({ onHome=()=>{}, onReplay=()=>{} } = {}){
  const elScore = document.getElementById('score');
  const elTime  = document.getElementById('time');
  const result  = document.getElementById('result');
  const resultText = document.getElementById('resultText');
  const menu   = document.getElementById('menuBar');
  const powerBar = document.getElementById('powerBar');

  function updateScore(v=0){ if(elScore) elScore.textContent = v|0; }
  function updateTime(v=0){ if(elTime) elTime.textContent = v|0; }
  function dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160); }

  function updatePowerBar(timers){
    if(!powerBar) return;
    ['x2','freeze','sweep'].forEach(k=>{
      const seg = powerBar.querySelector(`.pseg[data-k="${k}"]`);
      if(!seg) return;
      const s = timers[k]|0;
      seg.classList.toggle('active', s>0);
      seg.querySelector('i')?.style.setProperty('width', s>0?'100%':'0%');
      const sp = seg.querySelector('span');
      if(sp){
        const base = sp.dataset.base || sp.textContent;
        sp.dataset.base = base;
        sp.textContent = s>0 ? `${base} ${s}s` : base;
      }
    });
    const sh = powerBar.querySelector('.pseg[data-k="shield"]');
    if(sh){
      const c = timers.shieldCount|0;
      sh.classList.toggle('active', c>0);
      const sp = sh.querySelector('span');
      if (sp) sp.textContent = `🛡️ x${c}`;
    }
  }

  function showResult({score=0, combo=0}={}){
    if(resultText) resultText.textContent = `Score ${score} • Max Combo ${combo}`;
    if(result) result.style.display = 'flex';
    result?.querySelector('[data-result="home"]')?.addEventListener('click', ()=>{
      result.style.display='none'; menu && (menu.style.display='block'); onHome();
    }, { once:true });
    result?.querySelector('[data-result="replay"]')?.addEventListener('click', ()=>{
      result.style.display='none'; onReplay();
    }, { once:true });
  }

  return { updateScore, updateTime, updatePowerBar, showResult, dimPenalty };
}
