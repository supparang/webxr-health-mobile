// === core/hud.js (extended with PowerUp bar) ===
export function createHUD({ onHome=()=>{}, onReplay=()=>{} }={}) {
  const els = {
    score: document.getElementById('score'),
    time:  document.getElementById('time'),
    result: document.getElementById('result'),
    resultText: document.getElementById('resultText'),
    powerBar: document.getElementById('powerBar'),
  };

  function updateScore(v=0){ if(els.score) els.score.textContent=v|0; }
  function updateTime(v=0){ if(els.time) els.time.textContent=v|0; }

  function updatePowerBar(timers){
    if(!els.powerBar) return;
    ['x2','freeze','sweep'].forEach(k=>{
      const seg=els.powerBar.querySelector(`.pseg[data-k="${k}"]`);
      if(!seg) return;
      const s=timers[k]|0;
      seg.classList.toggle('active',s>0);
      seg.querySelector('i')?.style.setProperty('width',s>0?'100%':'0%');
      const sp=seg.querySelector('span'); if(sp) sp.textContent=s>0?`${sp.dataset.base||sp.textContent} ${s}s`:sp.dataset.base||sp.textContent;
    });
    const sh=els.powerBar.querySelector('.pseg[data-k="shield"]');
    if(sh){
      const c=timers.shieldCount|0;
      sh.classList.toggle('active',c>0);
      sh.querySelector('span').textContent=`🛡️ x${c}`;
    }
  }

  function showResult({score=0,combo=0,time=0,missions=[]}={}){
    els.resultText.textContent=`Score ${score} • Combo ${combo}`;
    els.result.style.display='flex';
    const btnH=document.querySelector('[data-result="home"]');
    const btnR=document.querySelector('[data-result="replay"]');
    if(btnH) btnH.onclick=()=>{els.result.style.display='none'; onHome();};
    if(btnR) btnR.onclick=()=>{els.result.style.display='none'; onReplay();};
  }

  return { updateScore, updateTime, updatePowerBar, showResult };
}
