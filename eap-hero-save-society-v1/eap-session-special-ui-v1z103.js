/* EAP Hero v1z103 – targeted UI polish for S3, S7, S10, S13, S15 only */
(() => {
  'use strict';
  const SPECIAL={
    3:{theme:'spider',label:'MAIN IDEA HUNT',hint:'Find the big idea before small details.'},
    7:{theme:'tone',label:'TONE BATTLE',hint:'Turn casual words into academic power.'},
    10:{theme:'data',label:'DATA DECODER',hint:'Read the trend first. Do not guess the cause.'},
    13:{theme:'listen',label:'LECTURE SIGNAL',hint:'Listen once for topic, then again for key clues.'},
    15:{theme:'final',label:'FINAL SOCIETY CORE',hint:'Connect problem, evidence, and solution.'}
  };
  const app=()=>document.getElementById('app'); let timer=null;
  function getId(){const t=String(app()?.innerText||'');const m=t.match(/(?:Session\s*|S)(1[0-5]|[1-9])\b/i);return Number(m?.[1]||0);}
  function clean(root){root.querySelectorAll('.eap-special-hero').forEach(x=>x.remove());root.classList.remove('eap-special-s3','eap-special-s7','eap-special-s10','eap-special-s13','eap-special-s15');}
  function render(){const root=app();if(!root)return;clean(root);const id=getId(),cfg=SPECIAL[id];if(!cfg)return;
    const panel=root.querySelector('.session-path-panel');if(!panel)return;
    root.classList.add(`eap-special-s${id}`);
    const hero=document.createElement('section');hero.className=`eap-special-hero eap-special-${cfg.theme}`;
    hero.innerHTML=`<div class="eap-special-orb"></div><div><span>${cfg.label}</span><h2>${id===3?'Choose the big idea. Escape the detail trap.':id===7?'Make your sentence sound clear, calm, and academic.':id===10?'Turn graph fog into one clear message.':id===13?'Catch the lecture signal before it disappears.':'Save the Society Core with one evidence-based solution.'}</h2><p>${cfg.hint}</p></div><div class="eap-special-steps"><b>1<br><small>Spot</small></b><i></i><b>2<br><small>Build</small></b><i></i><b>3<br><small>Win</small></b></div>`;
    panel.insertBefore(hero,panel.firstChild);
    [...panel.querySelectorAll('.session-mission-card')].forEach(card=>{card.classList.add('eap-special-card');});
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(render,40);}
  function boot(){const root=app();if(!root)return setTimeout(boot,100);new MutationObserver(schedule).observe(root,{childList:true,subtree:true});schedule();}
  boot();
})();
