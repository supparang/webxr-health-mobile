// game/core/hud.js
// HUD เดียวจบ ไม่มีประกาศซ้ำ

export class HUD {
  // --- Score / Time / Combo ---
  setScore(v){ const e=document.getElementById('score'); if(e) e.textContent=(v|0); }
  setTime(v){  const e=document.getElementById('time');  if(e) e.textContent=(v|0); }
  setCombo(v){
    const e=document.getElementById('combo'); if(!e) return;
    e.textContent = (typeof v==='number') ? ('x'+v) : v;
  }
  setMode(v){ const e=document.getElementById('modeName');     if(e) e.textContent=v; }
  setDiff(v){ const e=document.getElementById('difficulty');   if(e) e.textContent=v; }

  // --- Fever bar/label ---
  setFeverProgress(p01){
    const bar=document.getElementById('feverBar'); if(!bar) return;
    const pct=Math.max(0,Math.min(1,+p01||0))*100;
    bar.style.width=pct+'%';
  }
  fever(show){
    const f=document.getElementById('fever'); if(!f) return;
    f.style.display = show ? 'inline-block' : 'none';
    f.classList.toggle('pulse', !!show);
  }

  // --- Hydration HUD ---
  showHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='block'; }
  hideHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='none'; }
  setHydration(percent, zone){
    const bar=document.getElementById('hydroBar');
    const lab=document.getElementById('hydroLabel');
    this.showHydration();
    if(bar) bar.style.width=Math.max(0,Math.min(100,percent|0))+'%';
    if(lab){
      const txt = zone==='ok' ? 'พอดี' : zone==='low' ? 'น้อยไป' : zone==='high' ? 'มากไป' : '';
      lab.textContent = `${percent|0}% ${txt}`.trim();
    }
  }

  // --- Target / Pills (groups & plate) ---
  showTarget(){ const w=document.getElementById('targetWrap');    if(w) w.style.display='block'; }
  hideTarget(){ const w=document.getElementById('targetWrap');    if(w) w.style.display='none'; }
  setTargetBadge(text){ const el=document.getElementById('targetBadge'); if(el) el.textContent=text ?? '—'; }

  showPills(){ const w=document.getElementById('plateTracker');   if(w) w.style.display='block'; }
  hidePills(){ const w=document.getElementById('plateTracker');   if(w) w.style.display='none'; }

  // --- Fallback score FX (ถ้าไม่มีเอนจิน FX) ---
  popScore(x,y,tag,minor,color='#7fffd4'){
    const el=document.createElement('div');
    el.className='scoreBurst';
    el.style.left=x+'px'; el.style.top=y+'px'; el.style.color=color;
    el.textContent=tag;
    if(minor){ const m=document.createElement('span'); m.className='minor'; m.textContent=minor; el.appendChild(m); }
    document.body.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch{} }, 900);
  }
  burstFlame(x,y,strong=false){
    const el=document.createElement('div');
    el.className='flameBurst'+(strong?' strong':'');
    el.style.left=x+'px'; el.style.top=y+'px';
    document.body.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch{} }, 900);
  }
}
