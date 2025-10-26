// core/hud.js — ฟังก์ชัน HUD ที่ main เรียกใช้
export class HUD{
  setScore(n){ const el=document.getElementById('score'); if(el) el.textContent = n|0; }
  setTime(n){ const el=document.getElementById('time'); if(el) el.textContent = n|0; }
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

  // score popup & flame (เผื่อ main อยากใช้ผ่าน HUD)
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
