/* EAP Hero v1z104 – Make S3/S7/S10/S13/S15 match the clean Session Path layout */
(() => {
  'use strict';
  const app=()=>document.getElementById('app');
  const TARGETS=[
    ['Main Idea Hunter','s3'],['Academic Tone Battle','s7'],['Data Description','s10'],['Academic Listening','s13'],['Final Integration','s15']
  ];
  let timer;
  const tx=e=>String(e?.innerText||'').replace(/\s+/g,' ').trim();
  function current(){
    const panel=app()?.querySelector('.session-path-panel');
    const text=tx(panel||app());
    return TARGETS.find(([name])=>text.includes(name))||null;
  }
  function closestCard(el){
    let n=el;
    for(let i=0;n&&i<8;i++,n=n.parentElement){
      const t=tx(n);
      if(/Core Mission|Support Mission|Start Reading|Start Writing|Start Listening|Start Speaking|Continue Reading|Continue Writing|Continue Listening|Continue Speaking/.test(t)&&n.children.length>2)return n;
    }
    return null;
  }
  function fix(){
    const root=app(), panel=root?.querySelector('.session-path-panel'); if(!root||!panel)return;
    root.classList.remove('eap-parity-s3','eap-parity-s7','eap-parity-s10','eap-parity-s13','eap-parity-s15');
    panel.querySelectorAll('.eap-parity-grid,.eap-parity-card,.eap-parity-hero').forEach(el=>el.classList.remove('eap-parity-grid','eap-parity-card','eap-parity-hero'));
    const info=current(); if(!info)return;
    root.classList.add(`eap-parity-${info[1]}`);
    const cards=[];
    panel.querySelectorAll('button').forEach(btn=>{const card=closestCard(btn);if(card&&!cards.includes(card))cards.push(card);});
    const active=cards.slice(0,2);
    active.forEach(card=>card.classList.add('eap-parity-card'));
    if(active.length===2){
      const parent=active[0].parentElement;
      if(parent===active[1].parentElement) parent.classList.add('eap-parity-grid');
    }
    const route=panel.querySelector('.mf-route-board,.eap-audit-route-header');
    if(route) route.classList.add('eap-parity-hero');
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(fix,60);}
  function boot(){const root=app();if(!root)return setTimeout(boot,100);new MutationObserver(schedule).observe(root,{subtree:true,childList:true});schedule();}
  boot();
})();
