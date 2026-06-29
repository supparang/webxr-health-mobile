/* EAP Hero v1z106 – measured layout normalizer for selected sessions */
(() => {
  'use strict';
  const SPECIAL=['Main Idea Hunter','Academic Tone Battle','Data Description','Academic Listening','Final Integration'];
  const SKILLS=['Reading','Writing','Listening','Speaking'];
  const app=()=>document.getElementById('app');
  let timer;
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
  function isSpecial(){return SPECIAL.some(x=>clean(app()?.innerText).includes(x));}
  function skillNode(name){return [...app().querySelectorAll('h1,h2,h3,h4,b,strong,div,span,p')].find(el=>clean(el.textContent)===name)||null;}
  function cardFor(name){
    let node=skillNode(name);
    for(let i=0;node&&i<11;i++,node=node.parentElement){
      const t=clean(node.textContent), r=node.getBoundingClientRect();
      if(t.includes('Session Goal')&&r.width>170&&r.width<460&&r.height>220)return node;
    }
    return null;
  }
  function apply(el,styles){for(const [key,value] of Object.entries(styles))el.style.setProperty(key,value,'important');}
  function normalize(){
    if(!isSpecial())return;
    const panel=app()?.querySelector('.session-path-panel'); if(!panel)return;
    const cards=SKILLS.map(cardFor).filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).slice(0,2);
    if(cards.length!==2)return;
    let grid=panel.querySelector(':scope > .eap-v106-grid');
    if(!grid){grid=document.createElement('div');grid.className='eap-v106-grid';cards[0].parentElement.insertBefore(grid,cards[0]);}
    cards.forEach((card,index)=>{
      if(card.parentElement!==grid)grid.appendChild(card);
      card.classList.add('eap-v106-card');
      apply(card,{display:'flex',flex:'1 1 0',width:'100%',maxWidth:'none',minWidth:'0',minHeight:'430px',boxSizing:'border-box',flexDirection:'column',margin:'0'});
      if(!card.querySelector(':scope > .eap-v106-label')){const label=document.createElement('div');label.className='eap-v106-label';label.textContent=index?'STEP 2 · SUPPORT MISSION':'STEP 1 · CORE MISSION';card.insertBefore(label,card.firstChild);}
      card.querySelectorAll('button').forEach(btn=>apply(btn,{marginTop:'auto',width:'100%',minHeight:'48px'}));
    });
    apply(grid,{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:'16px',width:'100%',maxWidth:'100%',alignItems:'stretch',margin:'16px 0'});
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(normalize,160);}
  function boot(){const root=app();if(!root)return setTimeout(boot,100);new MutationObserver(schedule).observe(root,{childList:true,subtree:true});window.addEventListener('resize',schedule);schedule();}
  boot();
})();
