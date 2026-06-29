/* EAP Hero v1z102 – Session UI Audit & Layout Normalizer
   Makes every Session Path use one responsive visual structure.
   Does not change learning tasks, scores, pass rules, unlocks, portfolio, or teacher data.
*/
(() => {
  'use strict';
  const app=()=>document.getElementById('app');
  let timer=null;
  function text(el){return String(el?.innerText||'').replace(/\s+/g,' ').trim();}
  function inPath(){const t=text(app()); return /Pass progress:|Core Mission|Support Mission|Session Goal|Start Reading|Start Writing|Start Listening|Start Speaking/.test(t);}
  function addClass(el,name){if(el&&!el.classList.contains(name))el.classList.add(name);}
  function findSessionCard(el){
    let node=el;
    for(let i=0;node&&i<7;i++,node=node.parentElement){
      const t=text(node);
      if(/Session Goal|Useful words|Expected answer|Challenge:/.test(t) && node.children.length>2) return node;
    }
    return el;
  }
  function normalizeMissionCards(root){
    const cards=[...root.querySelectorAll('.session-mission-card')];
    const parents=new Map();
    cards.forEach(card=>{
      addClass(card,'eap-audit-mission-card');
      const p=card.parentElement;
      if(p) parents.set(p,(parents.get(p)||0)+1);
      const first=card.firstElementChild;
      if(first && !card.querySelector('.eap-audit-card-kicker')){
        const label=document.createElement('span'); label.className='eap-audit-card-kicker';
        label.textContent=/Reading/i.test(text(card))?'1 · SCOUT':/Writing|Listening|Speaking/i.test(text(card))?'2 · BUILD':'MISSION';
        card.insertBefore(label,first);
      }
    });
    parents.forEach((count,parent)=>{ if(count>=2) addClass(parent,'eap-audit-mission-grid'); });
  }
  function normalizeGoalCards(root){
    const candidates=[...root.querySelectorAll('div,section,article')].filter(el=>{
      const t=text(el); return t.includes('Session Goal')&&t.includes('Useful words')&&t.includes('Challenge:')&&el.children.length>=3;
    });
    const chosen=[];
    candidates.forEach(el=>{
      const card=findSessionCard(el);
      if(card&&!chosen.includes(card)) chosen.push(card);
    });
    const groups=new Map();
    chosen.forEach(card=>{addClass(card,'eap-audit-goal-card'); const p=card.parentElement;if(p)groups.set(p,(groups.get(p)||0)+1);});
    groups.forEach((count,p)=>{if(count>=2)addClass(p,'eap-audit-goal-grid');});
  }
  function normalizeButtons(root){
    [...root.querySelectorAll('button')].forEach(btn=>{
      const t=text(btn);
      if(/Start (Reading|Writing|Listening|Speaking)/.test(t)) addClass(btn,'eap-audit-start-btn');
      if(/Back to Map|My Learning Report/.test(t)) addClass(btn,'eap-audit-nav-btn');
    });
  }
  function scoreIntegrity(root){
    const panel=[...root.querySelectorAll('div,section,article')].find(el=>{
      const t=text(el);return /Pass progress: \d+\/\d+ skills complete/.test(t)&&/\d+\/100/.test(t);
    });
    if(!panel || panel.querySelector('.eap-audit-score-note')) return;
    const scores=[...text(panel).matchAll(/(\d{1,3})\/100/g)].map(m=>Number(m[1]));
    const saysComplete=/Pass progress: (\d+)\/(\d+) skills complete/.exec(text(panel));
    if(saysComplete&&Number(saysComplete[1])===Number(saysComplete[2])&&scores.some(n=>n<60)){
      const note=document.createElement('div');note.className='eap-audit-score-note';
      note.innerHTML='🗂 <b>Prior completion retained.</b> คะแนนที่เห็นเป็น evidence ของรอบปัจจุบัน/ข้อมูลเดิมที่กู้ได้ จึงไม่ใช้เปลี่ยนสถานะผ่านย้อนหลัง';
      panel.appendChild(note);
    }
  }
  function routeHeader(root){
    if(root.querySelector('.eap-audit-route-header')||!inPath())return;
    const firstCard=root.querySelector('.session-mission-card')||root.querySelector('.eap-audit-goal-card');
    if(!firstCard)return;
    const wrap=document.createElement('section');wrap.className='eap-audit-route-header';
    wrap.innerHTML='<div><span>MISSION ROUTE</span><h3>One clear path. Two focused skills. One confident rescue.</h3><p>เริ่ม Core ก่อน แล้วทำ Support เพื่อเชื่อมความเข้าใจ ไม่ต้องอ่านทุกกล่องพร้อมกัน</p></div><div class="eap-audit-route-steps"><b>1<br><small>Scout</small></b><i></i><b>2<br><small>Build</small></b><i></i><b>3<br><small>Rescue</small></b></div>';
    firstCard.parentElement?.insertBefore(wrap,firstCard.parentElement.firstChild);
  }
  function fix(){
    const root=app();if(!root||!inPath())return;
    normalizeMissionCards(root);normalizeGoalCards(root);normalizeButtons(root);scoreIntegrity(root);routeHeader(root);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(fix,35);}
  function boot(){
    const root=app();if(!root)return setTimeout(boot,100);
    new MutationObserver(schedule).observe(root,{childList:true,subtree:true});schedule();
  }
  boot();
})();
