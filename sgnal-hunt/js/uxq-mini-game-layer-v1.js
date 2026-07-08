/* CSAI2601 UX Quest • Mini‑Game Layer v1
 * Real student-facing mini game board. It hides the plain option grid and maps
 * card/board clicks back to the original option buttons so scoring, strict gate,
 * reason check, and sheet sync keep working.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();

  const modeMap={
    W1:['SCAN','Friction Scanner','เลือก signal ที่ทำให้ task สะดุดที่สุด','Scan Signal'],
    W2:['LAB','Evidence Lab','เลือกหลักฐานที่ช่วยหยุดการเดาของทีม','Collect Evidence'],
    W3:['DIAGNOSE','Psychology Lab','วินิจฉัย signal ทางจิตวิทยาที่ตรงที่สุด','Diagnose'],
    W4:['DETECT','Research Detective','เลือก clue ที่น่าเชื่อถือที่สุดจากผู้ใช้','Pick Clue'],
    W5:['DEFINE','HMW Forge','หลอม insight ให้เป็น problem/HMW ที่แข็งแรง','Forge Node'],
    W6:['FLOW','Flow Route','เลือก card ถัดไปที่ทำให้ flow ไม่หลุด','Route Step'],
    W7:['SORT','Priority Arena','เลือกสิ่งที่ควรอยู่ priority 1','Rank #1'],
    W8:['REVIEW','Blueprint Board','จับ mismatch หรือ revision ที่ควรแก้ก่อน','Review Move'],
    W9:['SYSTEM','Pattern Matrix','เลือก rule ที่ทำให้ component system แน่นขึ้น','System Move'],
    W10:['AUDIT','Responsive Audit','เลือก issue/fix ที่กระทบ task บนมือถือที่สุด','Audit Hit'],
    W11:['SIGNAL','Visual Signal','เลือก visual decision ที่สื่อความหมายชัดสุด','Tune Signal'],
    W12:['STATE','State Machine','เลือก state/microcopy/recovery ที่ช่วยผู้ใช้ที่สุด','State Move'],
    W13:['LINK','Prototype Linker','เลือก link/state ที่ทำให้ prototype ทดสอบได้จริง','Link Fix'],
    W14:['RANK','Severity Arena','เลือก finding/fix ที่ควรจัดลำดับก่อน','Rank Severity'],
    W15:['DEFEND','Portfolio Defense','เลือก proof/defense ที่ทำให้ case study แข็งแรง','Defend'],
    B1:['BOSS','Foundation Boss','โจมตีบอสด้วยคำตอบที่เชื่อม UI/UX + HCD + Psychology','Boss Strike'],
    B2:['BOSS','Flow Boss','โจมตีบอสด้วย evidence → problem → flow → wireframe','Boss Strike'],
    B3:['BOSS','Interface Boss','โจมตีบอสด้วย system + responsive + accessibility','Boss Strike'],
    B4:['BOSS','Validation Boss','โจมตีบอสด้วย state → prototype → evidence → retest','Boss Strike']
  };
  const icons={SCAN:'🔎',LAB:'🧭',DIAGNOSE:'🧠',DETECT:'🕵️',DEFINE:'💡',FLOW:'🗺️',SORT:'📐',REVIEW:'🧩',SYSTEM:'🧱',AUDIT:'📱',SIGNAL:'🎨',STATE:'⚡',LINK:'🔗',RANK:'🧪',DEFEND:'🏁',BOSS:'👹'};
  const lanes={FLOW:['START','PATH','RECOVERY','TRAP'],SORT:['P1','P2','P3','TRAP'],RANK:['HIGH','MID','LOW','TRAP'],SYSTEM:['PATTERN','STATE','RULE','TRAP'],AUDIT:['MOBILE','A11Y','CHECK','TRAP'],STATE:['STATE','COPY','RECOVER','TRAP'],LINK:['TASK','LINK','ERROR','TRAP'],DEFEND:['STORY','EVIDENCE','PROOF','TRAP'],BOSS:['CORE','CHAIN','DEFENSE','DECOY']};

  function current(){return modeMap[node()]||modeMap.W1;}
  function optButtons(){return $$('.question > .options .option[data-choice]');}
  function labelOf(btn){return text($('b',btn))||text(btn);}
  function subOf(btn){return text($('span',btn))||'อ่าน clue แล้วเลือกให้ตรงกับหลักฐาน';}
  function isBoss(){return /^B[1-4]$/.test(node());}
  function roundText(){return text($('.hud .meter b'))||'Round';}
  function caseText(){return text($('.top .pill'))||'Mission';}
  function style(){
    if($('#uxq-mini-game-style'))return;
    const s=document.createElement('style');s.id='uxq-mini-game-style';s.textContent=`
      .question .options[data-mini-hidden="1"]{position:absolute!important;left:-99999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:.01!important}
      .uxqMiniArena{border:1px solid rgba(110,231,255,.35);border-radius:22px;background:radial-gradient(circle at top left,rgba(110,231,255,.14),rgba(9,20,48,.88) 48%,rgba(7,16,38,.94));padding:14px;margin:14px 0;box-shadow:0 20px 70px rgba(0,0,0,.24);display:grid;gap:12px}.uxqMiniTop{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}.uxqMiniIcon{font-size:2rem}.uxqMiniTitle b{display:block;color:#fff;font-size:1.08rem}.uxqMiniTitle span{display:block;color:#cfe0ff;font-size:.9rem;line-height:1.4}.uxqMiniBadge{border:1px solid rgba(255,209,102,.45);border-radius:999px;padding:7px 10px;color:#ffe7a6;background:rgba(255,209,102,.08);font-weight:950;font-size:.78rem}.uxqMiniMeter{height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.uxqMiniMeter i{display:block;height:100%;width:64%;border-radius:999px;background:linear-gradient(90deg,rgba(110,231,255,.9),rgba(255,209,102,.9))}.uxqMiniBoard{display:grid;gap:10px}.uxqMiniCard{border:1px solid rgba(181,205,255,.26);border-radius:18px;background:linear-gradient(135deg,rgba(255,255,255,.09),rgba(110,231,255,.05));color:#f8fbff;text-align:left;padding:12px;cursor:pointer;display:grid;gap:8px;min-height:128px;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}.uxqMiniCard:hover,.uxqMiniCard:focus{transform:translateY(-2px);border-color:rgba(255,209,102,.58);box-shadow:0 14px 34px rgba(0,0,0,.25)}.uxqMiniCard strong{font-size:1rem;line-height:1.35}.uxqMiniCard small{color:#b9c8e4;line-height:1.4}.uxqMiniLane{display:inline-flex;width:max-content;border:1px solid rgba(110,231,255,.32);border-radius:999px;padding:4px 8px;color:#8fe9ff;background:rgba(110,231,255,.08);font-size:.72rem;font-weight:950}.uxqMiniHint{border:1px dashed rgba(255,209,102,.38);border-radius:14px;padding:9px 10px;color:#ffe8ad;background:rgba(255,209,102,.07);font-weight:800;font-size:.86rem}.uxqMiniArena[data-mode="FLOW"] .uxqMiniBoard{grid-template-columns:1fr}.uxqMiniArena[data-mode="FLOW"] .uxqMiniCard{grid-template-columns:auto 1fr;border-left:8px solid rgba(110,231,255,.65);min-height:92px}.uxqMiniArena[data-mode="FLOW"] .uxqMiniLane{align-self:start}.uxqMiniArena[data-mode="SORT"] .uxqMiniBoard,.uxqMiniArena[data-mode="RANK"] .uxqMiniBoard{grid-template-columns:repeat(4,minmax(0,1fr))}.uxqMiniArena[data-mode="BOSS"]{border-color:rgba(255,95,130,.46);background:radial-gradient(circle at top,rgba(255,95,130,.18),rgba(9,20,48,.92) 52%)}.uxqMiniArena[data-mode="BOSS"] .uxqMiniMeter i{width:78%;background:linear-gradient(90deg,rgba(255,95,130,.95),rgba(255,209,102,.92))}.uxqMiniArena[data-mode="BOSS"] .uxqMiniCard{border-color:rgba(255,95,130,.30)}.uxqMiniArena[data-mode="BOSS"] .uxqMiniLane{border-color:rgba(255,95,130,.45);color:#ffd1dc;background:rgba(255,95,130,.10)}@media(max-width:760px){.uxqMiniTop{grid-template-columns:auto 1fr}.uxqMiniBadge{grid-column:1/-1;width:max-content}.uxqMiniArena[data-mode="SORT"] .uxqMiniBoard,.uxqMiniArena[data-mode="RANK"] .uxqMiniBoard{grid-template-columns:1fr 1fr}.uxqMiniCard{min-height:112px}}`;
    document.head.appendChild(s);
  }
  function laneFor(mode,i){const list=lanes[mode]||lanes.BOSS;return list[i%list.length];}
  function buildCard(btn,i,mode,action){
    const card=document.createElement('button');card.type='button';card.className='uxqMiniCard';card.dataset.choice=btn.dataset.choice||'';
    card.innerHTML=`<span class="uxqMiniLane">${laneFor(mode,i)}</span><div><strong>${labelOf(btn)}</strong><small>${subOf(btn)}</small></div>`;
    card.addEventListener('click',()=>{card.disabled=true;card.style.transform='scale(.98)';setTimeout(()=>btn.click(),80);});
    return card;
  }
  function render(){
    style();
    const q=$('.question');if(!q||$('.verify')||$('.feedback'))return;
    const options=$('.question > .options');const buttons=optButtons();if(!options||buttons.length<4)return;
    const [mode,title,mission,action]=current();
    const mark=`${node()}|${roundText()}|${caseText()}|${buttons.map(b=>b.dataset.choice).join(',')}`;
    let arena=$('.uxqMiniArena',q);
    if(arena&&arena.dataset.mark===mark)return;
    if(arena)arena.remove();
    arena=document.createElement('section');arena.className='uxqMiniArena';arena.dataset.mode=mode;arena.dataset.mark=mark;
    const bossLine=isBoss()?`Boss HP • ${roundText()}`:`Mission heat • ${roundText()}`;
    arena.innerHTML=`<div class="uxqMiniTop"><div class="uxqMiniIcon">${icons[mode]||'🎮'}</div><div class="uxqMiniTitle"><b>${title}</b><span>${mission}</span></div><div class="uxqMiniBadge">${action}</div></div><div class="uxqMiniMeter" aria-label="${bossLine}"><i></i></div><div class="uxqMiniHint">${isBoss()?'เลือกการโจมตีที่เชื่อมหลักฐานหลายชั้นที่สุด':'อ่าน case แล้วเลือกการ์ดที่ตอบภารกิจนี้ได้แม่นที่สุด'} • ${caseText()}</div><div class="uxqMiniBoard"></div>`;
    const board=$('.uxqMiniBoard',arena);buttons.forEach((btn,i)=>board.appendChild(buildCard(btn,i,mode,action)));
    options.dataset.miniHidden='1';
    q.insertBefore(arena,options);
  }
  function cleanup(){if($('.verify')||$('.feedback')){$$('.uxqMiniArena').forEach(x=>x.remove());$$('.question > .options[data-mini-hidden]').forEach(o=>o.removeAttribute('data-mini-hidden'));}}
  let t=0;function schedule(){clearTimeout(t);t=setTimeout(()=>{cleanup();render();},70);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
