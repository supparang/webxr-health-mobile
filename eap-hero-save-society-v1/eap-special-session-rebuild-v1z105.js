/* EAP Hero v1z105 – exact clean two-card layout for S3/S7/S10/S13/S15 */
(() => {
  'use strict';
  const SPECIAL=['Main Idea Hunter','Academic Tone Battle','Data Description','Academic Listening','Final Integration'];
  const app=()=>document.getElementById('app');
  let timer;
  const text=el=>String(el?.innerText||'').replace(/\s+/g,' ').trim();
  function isTarget(){const t=text(app());return SPECIAL.some(name=>t.includes(name));}
  function isMissionCard(el){
    const t=text(el);
    return /\b(Reading|Writing|Listening|Speaking)\b/.test(t) && /Session Goal|Objective:|Useful words|Expected answer|Challenge:/.test(t) && el.children.length>=2;
  }
  function candidates(root){
    const raw=[...root.querySelectorAll('section,article,div')].filter(isMissionCard);
    return raw.filter(el=>!raw.some(other=>other!==el&&other.contains(el)));
  }
  function titleFor(card){
    const t=text(card);
    const m=t.match(/(?:✅\s*)?(Reading|Writing|Listening|Speaking)\b/);
    return m?.[1]||'';
  }
  function run(){
    const root=app(); const panel=root?.querySelector('.session-path-panel');
    if(!panel||!isTarget()) return;
    const cards=candidates(panel).filter(c=>titleFor(c)).slice(0,2);
    if(cards.length!==2) return;
    let grid=panel.querySelector(':scope > .eap-v105-grid');
    if(!grid){
      grid=document.createElement('div');grid.className='eap-v105-grid';
      cards[0].parentElement.insertBefore(grid,cards[0]);
      cards.forEach(card=>grid.appendChild(card));
    }else{
      cards.forEach(card=>{if(card.parentElement!==grid)grid.appendChild(card);});
    }
    cards.forEach((card,index)=>{
      card.classList.add('eap-v105-card');
      card.dataset.v105=index===0?'core':'support';
      if(!card.querySelector(':scope > .eap-v105-tag')){
        const tag=document.createElement('div');tag.className='eap-v105-tag';
        tag.textContent=index===0?'STEP 1 · CORE MISSION':'STEP 2 · SUPPORT MISSION';
        card.insertBefore(tag,card.firstChild);
      }
    });
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(run,80);}
  function boot(){const root=app();if(!root)return setTimeout(boot,100);new MutationObserver(schedule).observe(root,{childList:true,subtree:true});schedule();}
  boot();
})();
