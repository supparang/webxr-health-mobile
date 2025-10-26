export class HUD{
  setScore(v){ const e=document.getElementById('score'); if(e) e.textContent=v|0; }
  setCombo(text){ const e=document.getElementById('combo'); if(e) e.textContent=text; }
  setTime(v){ const e=document.getElementById('time'); if(e) e.textContent=v|0; }
  setFeverProgress(p01){ const el=document.getElementById('feverBar'); if(el) el.style.width=((p01||0)*100)+'%'; }
  showHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='block'; }
  hideHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='none'; }
  showTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='block'; }
  hideTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='none'; }
  showPills(){ const w=document.getElementById('plateTracker'); if(w) w.style.display='block'; }
  hidePills(){ const w=document.getElementById('plateTracker'); if(w) w.style.display='none'; }
  setTargetBadge(text){ const el=document.getElementById('targetBadge'); if(el) el.textContent=text; }

  // Mini-Quest chip under FEVER
  setQuestChip(text, kind=''){ const chip=document.getElementById('questChip'); if(!chip) return;
    chip.textContent=text||'—'; chip.style.display='inline-flex';
    chip.classList.remove('ok','warn','bad'); if(kind) chip.classList.add(kind);
  }
  hideQuestChip(){ const chip=document.getElementById('questChip'); if(chip) chip.style.display='none'; }

  // Power-up bar under FEVER
  setPowerStatus(label, remain01){ const bar=document.getElementById('powerBar'); const t=document.getElementById('powerTime')?.firstElementChild; const l=document.getElementById('powerLabel');
    if(!bar||!t||!l) return; bar.style.display='inline-flex'; l.textContent=label||'—'; t.style.width=Math.max(0,Math.min(1,remain01))*100+'%';
  }
  clearPowerStatus(){ const bar=document.getElementById('powerBar'); if(bar) bar.style.display='none'; }

  // Screen flash/dim for fail feedback
  flashScreen(intensity='dim'){ // 'dim' | 'flash'
    if(intensity==='flash'){ document.body.classList.add('flash'); setTimeout(()=>document.body.classList.remove('flash'), 600); return; }
    const d=document.createElement('div'); d.className='screen-dim'; document.body.appendChild(d); setTimeout(()=>{ try{d.remove();}catch{} }, 260);
  }
}
