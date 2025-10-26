export class HUD{
  setScore(v){const e=document.getElementById('score');if(e)e.textContent=v|0;}
  setCombo(v){const e=document.getElementById('combo');if(e)e.textContent='x'+(v||1);}
  setTime(v){const e=document.getElementById('time');if(e)e.textContent=v|0;}
  setDiff(v){const e=document.getElementById('difficulty');if(e)e.textContent=v;}
  setMode(v){const e=document.getElementById('modeName');if(e)e.textContent=v;}
  fever(a){const e=document.getElementById('fever');if(e)e.style.display=a?'inline-block':'none';}
  setHydration(p,z){
    const bar=document.getElementById('hydroBar');
    const lab=document.getElementById('hydroLabel');
    const wrap=document.getElementById('hydroWrap');
    if(wrap)wrap.style.display='block';
    if(bar)bar.style.width=Math.max(0,Math.min(100,p))+'%';
    if(lab)lab.textContent=Math.round(p)+'% '+(z==='ok'?'พอดี':(z==='low'?'น้อยไป':'มากไป'));
  }
  hideHydration(){const w=document.getElementById('hydroWrap');if(w)w.style.display='none';}
  hideTarget(){const el=document.getElementById('targetWrap');if(el)el.style.display='none';}
  hidePills(){const el=document.getElementById('plateTracker');if(el)el.style.display='none';}
  setFeverProgress(t){const b=document.getElementById('feverBar');if(b)b.style.width=((t||0)*100)+'%';}
}
// core/hud.js — ฟังก์ชัน HUD ที่ main เรียกใช้
export class HUD{
  setScore(n){ const el=document.getElementById('score'); if(el) el.textContent = n; }
  setTime(n){ const el=document.getElementById('time'); if(el) el.textContent = n; }
  setCombo(text){ const el=document.getElementById('combo'); if(el) el.textContent = text; }
  setFeverProgress(p01){
    const el=document.getElementById('feverBar'); if(!el) return;
    el.style.width = Math.round(Math.max(0,Math.min(1,p01))*100)+'%';
  }
  showHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='block'; }
  hideHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='none'; }
  showTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='block'; }
  hideTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='none'; }
  showPills(){ const w=document.getElementById('plateTracker'); if(w) w.style.display='block'; }
  hidePills(){ const w=document.getElementById('plateTracker'); if(w) w.style.display='none'; }
  setTargetBadge(text){ const el=document.getElementById('targetBadge'); if(el) el.textContent = text; }

  // score popup & flame
  popScore(x,y,tag,minor,color='#7fffd4'){
    const el = document.createElement('div');
    el.className='scoreBurst'; el.style.left=x+'px'; el.style.top=y+'px'; el.style.color=color; el.textContent=tag;
    if (minor){ const m=document.createElement('span'); m.className='minor'; m.textContent=minor; el.appendChild(m); }
    document.body.appendChild(el); setTimeout(()=>{ try{el.remove();}catch{} }, 900);
  }
  burstFlame(x,y,strong=false){
    const el = document.createElement('div');
    el.className = 'flameBurst' + (strong?' strong':''); el.style.left=x+'px'; el.style.top=y+'px';
    document.body.appendChild(el); setTimeout(()=>{ try{el.remove();}catch{} }, 900);
  }
}
