// game/core/hud.js
// HUD utilities ที่ main.js เรียกใช้ (ฉบับเดียวจบ ไม่ซ้ำประกาศ)

export class HUD {
  // สกอร์ / เวลา / คอมโบ
  setScore(n){ const el=document.getElementById('score'); if(el) el.textContent = n|0; }
  setTime(n){ const el=document.getElementById('time'); if(el) el.textContent = n|0; }
  setCombo(text){ const el=document.getElementById('combo'); if(el) el.textContent = String(text); }

  // ชื่อโหมด/ความยาก (ถ้าอยากอัพเดตผ่าน HUD โดยตรง)
  setDiff(v){ const el=document.getElementById('difficulty'); if(el) el.textContent = v; }
  setMode(v){ const el=document.getElementById('modeName'); if(el) el.textContent = v; }

  // FEVER progress bar (0..1)
  setFeverProgress(p01){
    const el = document.getElementById('feverBar');
    if(!el) return;
    const w = Math.round(Math.max(0, Math.min(1, p01)) * 100);
    el.style.width = w + '%';
  }

  // Hydration HUD
  showHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='block'; }
  hideHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='none'; }
  setHydration(pct, zone){
    const bar = document.getElementById('hydroBar');
    const lab = document.getElementById('hydroLabel');
    const wrap= document.getElementById('hydroWrap');
    if(wrap) wrap.style.display='block';
    if(bar)  bar.style.width = Math.max(0, Math.min(100, pct|0)) + '%';
    if(lab){
      const z = zone==='ok' ? 'พอดี' : (zone==='low' ? 'น้อยไป' : 'มากไป');
      lab.textContent = `${Math.round(pct)}% ${z}`;
    }
  }

  // Target HUD (โหมด groups/plate)
  showTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='block'; }
  hideTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='none'; }
  setTargetBadge(text){ const el=document.getElementById('targetBadge'); if(el) el.textContent = text; }

  // Plate HUD (โหมด plate)
  showPills(){ const w=document.getElementById('plateTracker'); if(w) w.style.display='block'; }
  hidePills(){ const w=document.getElementById('plateTracker'); if(w) w.style.display='none'; }

  // (ถ้าอยากโชว์ FEVER label ผ่าน HUD)
  fever(show){
    const el = document.getElementById('fever');
    if (el) el.style.display = show ? 'inline-block' : 'none';
  }

  // เอฟเฟกต์คะแนน (ถ้าอยากเรียกผ่าน HUD)
  popScore(x,y,tag,minor,color='#7fffd4'){
    const el = document.createElement('div');
    el.className='scoreBurst';
    el.style.left=x+'px'; el.style.top=y+'px';
    el.textContent=tag; el.style.color=color;
    if (minor){
      const m=document.createElement('span');
      m.className='minor'; m.textContent=minor;
      el.appendChild(m);
    }
    document.body.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch{} }, 900);
  }
  burstFlame(x,y,strong=false){
    const el = document.createElement('div');
    el.className='flameBurst' + (strong?' strong':'');
    el.style.left=x+'px'; el.style.top=y+'px';
    document.body.appendChild(el);
    setTimeout(()=>{ try{el.remove();}catch{} }, 900);
  }
}
