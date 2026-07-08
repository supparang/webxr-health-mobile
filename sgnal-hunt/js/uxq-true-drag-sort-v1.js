/* CSAI2601 UX Quest • True Drag/Sort v1
 * Adds real drag/drop selection boards for W6 Flow, W7 Priority, and W14 Severity.
 * Drop/click a card into the key slot, then press Confirm. The original option button is clicked behind the scenes.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const configs={
    W6:{mode:'FLOW',icon:'🗺️',title:'True Flow Arrange',slot:'NEXT STEP',mission:'ลากการ์ดที่ควรเป็นขั้นต่อไปของ flow ลงช่อง NEXT STEP',lanes:['ENTRY','TASK','RECOVERY','TRAP']},
    W7:{mode:'SORT',icon:'📐',title:'True Priority Sort',slot:'PRIORITY 1',mission:'ลาก element ที่ควรเด่นที่สุดใน wireframe ลงช่อง PRIORITY 1',lanes:['P1','P2','P3','DISTRACTOR']},
    W14:{mode:'RANK',icon:'🧪',title:'True Severity Ranking',slot:'HIGH SEVERITY',mission:'ลาก finding/fix ที่ควรจัดลำดับก่อนลงช่อง HIGH SEVERITY',lanes:['HIGH','MID','LOW','TRAP']}
  };
  function cfg(){return configs[node()]||null;}
  function opts(){return $$('.question > .options .option[data-choice]');}
  function label(btn){return text($('b',btn))||text(btn);}
  function sub(btn){return text($('span',btn))||'ตรวจจากหลักฐานใน case';}
  function round(){return text($('.hud .meter b'))||'Round';}
  function caseId(){return text($('.top .pill'))||'Case';}
  function style(){
    if($('#uxq-drag-sort-style'))return;
    const s=document.createElement('style');s.id='uxq-drag-sort-style';s.textContent=`
      body[data-uxq-drag-sort="1"] .uxqMiniArena{display:none!important}
      .uxqDragArena{border:1px solid rgba(255,209,102,.48);border-radius:24px;background:radial-gradient(circle at top left,rgba(255,209,102,.16),rgba(110,231,255,.09),rgba(7,16,38,.95) 62%);padding:14px;margin:14px 0;display:grid;gap:13px;box-shadow:0 22px 74px rgba(0,0,0,.28)}.uxqDragHead{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}.uxqDragIcon{font-size:2rem}.uxqDragHead b{display:block;color:#fff;font-size:1.1rem}.uxqDragHead span{display:block;color:#d7e6ff;line-height:1.4}.uxqDragMode{border:1px solid rgba(255,209,102,.55);border-radius:999px;padding:7px 10px;color:#ffe7a6;background:rgba(255,209,102,.09);font-weight:950}.uxqDropZone{border:2px dashed rgba(255,209,102,.48);border-radius:18px;padding:13px;min-height:92px;display:grid;gap:8px;align-items:center;background:rgba(255,209,102,.06)}.uxqDropZone[data-filled="1"]{border-style:solid;background:rgba(110,231,255,.09);border-color:rgba(110,231,255,.55)}.uxqDropZone strong{color:#ffe08a}.uxqDropZone em{font-style:normal;color:#cfe0ff}.uxqDragPool{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.uxqDragCard{border:1px solid rgba(181,205,255,.28);border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.1),rgba(110,231,255,.05));padding:11px;color:#f8fbff;text-align:left;display:grid;gap:8px;cursor:grab;min-height:142px}.uxqDragCard:active{cursor:grabbing;transform:scale(.99)}.uxqDragCard[aria-pressed="true"]{border-color:rgba(255,209,102,.72);box-shadow:0 14px 38px rgba(255,209,102,.10)}.uxqDragLane{width:max-content;border:1px solid rgba(110,231,255,.35);border-radius:999px;padding:3px 7px;color:#8fe9ff;background:rgba(110,231,255,.08);font-size:.72rem;font-weight:950}.uxqDragCard b{line-height:1.33}.uxqDragCard small{color:#b9c8e4;line-height:1.38}.uxqDragActions{display:flex;gap:9px;flex-wrap:wrap}.uxqDragActions button{border:0;border-radius:999px;padding:10px 14px;font-weight:950;cursor:pointer}.uxqDragConfirm{background:#ffd166;color:#12203a}.uxqDragReset{background:rgba(255,255,255,.1);color:#f8fbff;border:1px solid rgba(255,255,255,.18)!important}.uxqDragConfirm:disabled{opacity:.45;cursor:not-allowed}.uxqDragHint{color:#ffe8ad;font-weight:850;line-height:1.45}@media(max-width:760px){.uxqDragHead{grid-template-columns:auto 1fr}.uxqDragMode{grid-column:1/-1;width:max-content}.uxqDragPool{grid-template-columns:1fr 1fr}.uxqDragCard{min-height:118px}}`;
    document.head.appendChild(s);
  }
  function card(btn,i,c){
    const d=document.createElement('button');d.type='button';d.className='uxqDragCard';d.draggable=true;d.dataset.choice=btn.dataset.choice||'';d.dataset.index=String(i);d.innerHTML=`<span class="uxqDragLane">${c.lanes[i%c.lanes.length]}</span><b>${label(btn)}</b><small>${sub(btn)}</small>`;
    d.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',d.dataset.index);});
    d.addEventListener('click',()=>select(d));
    return d;
  }
  let selectedIndex='';
  function select(card){
    const arena=card.closest('.uxqDragArena'); if(!arena)return; selectedIndex=card.dataset.index; $$('.uxqDragCard',arena).forEach(x=>x.setAttribute('aria-pressed',String(x===card))); const drop=$('.uxqDropZone',arena); drop.dataset.filled='1'; $('em',drop).textContent=label(opts()[Number(selectedIndex)]); $('.uxqDragConfirm',arena).disabled=false;
  }
  function render(){
    const c=cfg(); if(!c){document.body.removeAttribute('data-uxq-drag-sort');return;} style();
    const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return;
    const buttons=opts(); const options=$('.question > .options'); if(buttons.length<4||!options)return;
    document.body.dataset.uxqDragSort='1';
    const mark=`${node()}|${round()}|${caseId()}|${buttons.map(b=>b.dataset.choice).join(',')}`;
    let arena=$('.uxqDragArena',q); if(arena&&arena.dataset.mark===mark)return; if(arena)arena.remove(); selectedIndex='';
    arena=document.createElement('section'); arena.className='uxqDragArena'; arena.dataset.mark=mark; arena.innerHTML=`<div class="uxqDragHead"><div class="uxqDragIcon">${c.icon}</div><div><b>${c.title}</b><span>${c.mission}</span></div><div class="uxqDragMode">${c.mode}</div></div><div class="uxqDropZone" data-filled="0"><strong>${c.slot}</strong><em>ลากหรือแตะการ์ดที่เลือกมาที่นี่</em></div><div class="uxqDragPool"></div><div class="uxqDragHint">ท้าทาย: ตัวลวงทุกใบใกล้เคียงกัน ต้องเลือกใบที่ตอบหลักฐานใน case ได้ครบที่สุด • ${caseId()}</div><div class="uxqDragActions"><button class="uxqDragConfirm" type="button" disabled>ยืนยันคำตอบ</button><button class="uxqDragReset" type="button">ล้างช่อง</button></div>`;
    const pool=$('.uxqDragPool',arena); buttons.forEach((btn,i)=>pool.appendChild(card(btn,i,c)));
    const drop=$('.uxqDropZone',arena);
    drop.addEventListener('dragover',e=>{e.preventDefault();});
    drop.addEventListener('drop',e=>{e.preventDefault(); const idx=e.dataTransfer.getData('text/plain'); const picked=$(`.uxqDragCard[data-index="${idx}"]`,arena); if(picked)select(picked);});
    $('.uxqDragReset',arena).addEventListener('click',()=>{selectedIndex=''; drop.dataset.filled='0'; $('em',drop).textContent='ลากหรือแตะการ์ดที่เลือกมาที่นี่'; $$('.uxqDragCard',arena).forEach(x=>x.setAttribute('aria-pressed','false')); $('.uxqDragConfirm',arena).disabled=true;});
    $('.uxqDragConfirm',arena).addEventListener('click',()=>{const btn=buttons[Number(selectedIndex)]; if(btn)btn.click();});
    q.insertBefore(arena,options);
  }
  function cleanup(){if($('.verify')||$('.feedback')){$$('.uxqDragArena').forEach(x=>x.remove());document.body.removeAttribute('data-uxq-drag-sort');}}
  let t=0; function schedule(){clearTimeout(t);t=setTimeout(()=>{cleanup();render();},85);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
