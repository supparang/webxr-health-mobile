export function bindLanding(startCb, coach){
  const landing=document.getElementById('landing'); const startBtn=document.getElementById('startBtn'); let picked='zane';
  landing.addEventListener('click',(e)=>{ const card=e.target.closest('.heroCard'); if(card){ picked=card.getAttribute('data-hero'); [...landing.querySelectorAll('.heroCard')].forEach(c=>c.style.outline=''); card.style.outline='3px solid #0ff'; } });
  startBtn.addEventListener('click',()=>{ coach.setHero(picked); landing.style.transition='opacity .5s ease'; landing.style.opacity='0'; setTimeout(()=>{ landing.style.display='none'; startCb(); }, 520); try{ document.getElementById('sfx-hero')?.play(); }catch{} });
}