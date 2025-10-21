
export class HUD{
  setScore(v){ const e=document.getElementById('score'); if(e) e.textContent=v|0; }
  setCombo(v){ const e=document.getElementById('combo'); if(e) e.textContent='x'+(v||0); }
  setTime(v){ const e=document.getElementById('time'); if(e) e.textContent=v|0; }
  setDiff(v){ const e=document.getElementById('difficulty'); if(e) e.textContent=v; }
  setMode(v){ const e=document.getElementById('modeName'); if(e) e.textContent=v; }
  fever(a){ const e=document.getElementById('fever'); if(e) e.style.display=a?'inline-block':'none'; }
  setHydration(p,z){ const bar=document.getElementById('hydroBar'); const lab=document.getElementById('hydroLabel'); const wrap=document.getElementById('hydroWrap'); if(wrap) wrap.style.display='block'; if(bar){ bar.style.width=Math.max(0,Math.min(100,p))+'%'; } if(lab){ lab.textContent=Math.round(p)+'% '+(z==='ok'?'พอดี':(z==='low'?'น้อยไป':'มากไป')); } }
  hideHydration(){ const wrap=document.getElementById('hydroWrap'); if(wrap) wrap.style.display='none'; }
  hideTarget(){ const el=document.getElementById('targetWrap'); if(el) el.style.display='none'; }
  hidePills(){ const el=document.getElementById('plateTracker'); if(el) el.style.display='none'; }
}
