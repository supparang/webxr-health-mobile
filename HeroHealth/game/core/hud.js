// game/core/hud.js
export class HUD{
  setScore(v){ const e=document.getElementById('score'); if(e) e.textContent=v|0; }
  setCombo(text){ const e=document.getElementById('combo'); if(e) e.textContent=text; }
  setTime(v){ const e=document.getElementById('time'); if(e) e.textContent=v|0; }
  setFeverProgress(p01){ const b=document.getElementById('feverBar'); if(b) b.style.width=Math.max(0,Math.min(1,p01))*100+'%'; }
  showHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='block'; }
  hideHydration(){ const w=document.getElementById('hydroWrap'); if(w) w.style.display='none'; }
  showTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='block'; }
  hideTarget(){ const w=document.getElementById('targetWrap'); if(w) w.style.display='none'; }
  hidePills(){ const w=document.getElementById('plateTracker'); if(w) w.style.display='none'; }
  setTargetBadge(text){ const el=document.getElementById('targetBadge'); if(el) el.textContent=text; }

  // 🔹 ใหม่: ใช้ได้ทั้ง groups และโหมดอื่น ๆ ที่อยากแสดง badge
  setTarget(groupKey, have, need){
    const el=document.getElementById('targetBadge');
    if(el){
      if(typeof have==='number' && typeof need==='number'){
        el.textContent = `${groupKey} • ${have}/${need}`;
      }else{
        el.textContent = String(groupKey);
      }
    }
    const wrap=document.getElementById('targetWrap');
    if(wrap) wrap.style.display='inline-flex';
  }

  // Power-ups bar: set seconds left per key (x2/freeze/sweep), 0..N (clamped to 0..100%)
  setPowerTimers(timers){
    const wrap=document.getElementById('powerBar'); if(!wrap) return;
    ['x2','freeze','sweep'].forEach(k=>{
      const seg=wrap.querySelector(`.pseg[data-k="${k}"] i`);
      if(!seg) return;
      const v=Math.max(0,Math.min(10,(timers?.[k]||0))); // assume max 10s
      seg.style.setProperty('--p', v);
      seg.style.position='relative';
      seg.style.overflow='hidden';
      seg.style.setProperty('--w', (v*10)+'%');
      seg.style.background='#0003';
      seg.innerHTML='<span style="display:none"></span>';
      seg.style.setProperty('--barW', (v*10)+'%');
      seg.style.setProperty('--barC', k==='x2'?'linear-gradient(90deg,#ffd54a,#ff8a00)':(k==='freeze'?'linear-gradient(90deg,#66e0ff,#4fc3f7)':'linear-gradient(90deg,#9effa8,#7fffd4)'));
      seg.style.setProperty('--barH','6px');
      seg.style.setProperty('--rad','999px');
      seg.style.cssText += `;--barW:${v*10}%`;
      seg.style.position='relative';
      seg.querySelectorAll('.barfill')?.forEach(n=>n.remove());
      const f=document.createElement('b');
      f.className='barfill';
      f.style.cssText=`position:absolute;left:0;top:0;bottom:0;width:${v*10}%;background:var(--barC);border-radius:999px`;
      seg.appendChild(f);
    });
  }

  // Mini-Quest chips (array of {key, icon, need, progress, remain, done, fail})
  setQuestChips(list){
    const wrap=document.getElementById('questChips'); if(!wrap) return;
    wrap.innerHTML='';
    (list||[]).forEach(q=>{
      const chip=document.createElement('div'); chip.className='chip';
      chip.innerHTML=`<span>${q.icon||'⭐'}</span><span>${q.progress|0}/${q.need|0}</span><div class="bar"><div style="width:${Math.min(100,Math.round((q.progress/q.need)*100))}%"></div></div><span>⏱ ${Math.max(0,q.remain|0)}s</span>`;
      if(q.done && !q.fail) chip.style.borderColor='#7fffd4';
      if(q.fail) chip.style.borderColor='#ff9b9b';
      wrap.appendChild(chip);
    });
  }

  // Coach speech
  say(text){ const el=document.getElementById('coachText'); const box=document.getElementById('coachHUD'); if(!el||!box) return; el.textContent=text; box.style.display='flex'; }

  // Screen feedback
  flashDanger(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),180); }
  dimPenalty(){ document.body.classList.add('dim-penalty'); setTimeout(()=>document.body.classList.remove('dim-penalty'),350); }
}
