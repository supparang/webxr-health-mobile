/* CSAI2601 UX Quest • Anti-Length Bias v2
 * Runs after near-miss distractors and before mini-game boards.
 * Rebalances the current visible option labels, including labels rewritten by near-miss.
 * Correctness IDs stay untouched; scoring/strict/sheet remain unchanged.
 */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const text=(el)=>String(el?.textContent||'').trim();
  const qp=()=>new URLSearchParams(location.search||'');
  const node=()=>String(qp().get('node')||qp().get('id')||'W1').toUpperCase();
  const tags={W1:['task','goal','feedback','proof'],W2:['evidence','assumption','user','test'],W3:['mental model','load','feedback','repair'],W4:['question','pain point','persona','observe'],W5:['insight','root cause','HMW','concept'],W6:['sitemap','navigation','path','recovery'],W7:['priority','layout','CTA','mobile'],W8:['chain','mismatch','revision','rationale'],W9:['pattern','state','naming','system'],W10:['responsive','a11y','focus','check'],W11:['color','type','contrast','spacing'],W12:['state','microcopy','recovery','prevent'],W13:['task link','interaction','error path','prototype'],W14:['finding','severity','fix','retest'],W15:['narrative','evidence','proof','defense'],B1:['UX','HCD','psychology','proof'],B2:['persona','problem','flow','wireframe'],B3:['pattern','responsive','a11y','visual'],B4:['state','prototype','evidence','retest']};
  const filler=['ตรวจจากหลักฐานใน case','ดูผลต่อ task หลัก','เทียบกับ user goal','อย่าใช้ความชอบตัดสิน','ตรวจว่า evidence พอไหม','ดูว่าลด friction จริงไหม','คิดถึง next step ของผู้ใช้','วัดผลได้หลังปรับ'];
  function h(s){let x=0;String(s||'').split('').forEach(c=>{x=((x<<5)-x+c.charCodeAt(0))|0;});return Math.abs(x);}
  function clean(s){return String(s||'').replace(/\s+/g,' ').replace(/\s+•\s+(ตรวจจากหลักฐานใน case|ดูผลต่อ task หลัก|เทียบกับ user goal|อย่าใช้ความชอบตัดสิน|ตรวจว่า evidence พอไหม|ดูว่าลด friction จริงไหม|คิดถึง next step ของผู้ใช้|วัดผลได้หลังปรับ).*$/,'').trim();}
  function limit(s,max){s=clean(s); if(s.length<=max)return s; const cut=s.slice(0,max+1); const pos=Math.max(cut.lastIndexOf(' '),cut.lastIndexOf('→'),cut.lastIndexOf('/'),cut.lastIndexOf(',')); return (pos>22?cut.slice(0,pos):cut.slice(0,max)).replace(/[,:;→\-/]+$/,'').trim()+'…';}
  function isCorrect(btn){return /^c\d+/i.test(String(btn?.dataset?.choice||''));}
  function round(){const m=text($('.hud .meter b')).match(/^(\d+)\s*\/\s*\d+/);return m?Number(m[1]):1;}
  function tag(i){const list=tags[node()]||tags.W1;return list[i%list.length];}
  function fill(seed,i){return filler[(h(seed)+i)%filler.length];}
  function balance(){const q=$('.question'); if(!q||$('.verify')||$('.feedback'))return; const buttons=$$('.question > .options .option[data-choice]'); if(buttons.length<4)return; const visible=buttons.map(btn=>clean(text($('b',btn)))); const mark=[node(),round(),text($('.top .pill')),visible.join('|')].join('::'); if(q.dataset.antiLengthV2Mark===mark)return; const lens=visible.map(x=>x.length); const max=Math.max(...lens), min=Math.min(...lens); const target=Math.max(40,Math.min(56,Math.round((max+min)/2)+6)); const seed=mark;
    buttons.forEach((btn,i)=>{const b=$('b',btn); if(!b)return; let label=limit(visible[i],46); if(label.length<target-10) label=`${label} • ${fill(seed,i)}`; label=limit(label,Math.max(52,Math.min(66,target+10))); b.textContent=label; btn.setAttribute('data-choice-tag',tag(i)); btn.dataset.lengthBalancedV2=isCorrect(btn)?'correct':'distractor';});
    const after=buttons.map(btn=>text($('b',btn)).length); q.dataset.antiLengthV2Mark=mark; q.dataset.lengthSpreadAfterV2=String(Math.max(...after)-Math.min(...after)); q.dataset.correctWasLongestBeforeV2=String(lens[buttons.findIndex(isCorrect)]===max);
  }
  function style(){if($('#uxq-anti-length-bias-v2-style'))return; const s=document.createElement('style'); s.id='uxq-anti-length-bias-v2-style'; s.textContent=`.question .option[data-choice-tag]{display:grid;align-content:start;gap:5px}.question .option[data-choice-tag] b{min-height:3.05em;display:block;line-height:1.32}.question .option[data-choice-tag]::after{content:attr(data-choice-tag);justify-self:start;border:1px solid rgba(181,205,255,.25);border-radius:999px;padding:3px 7px;color:#cfe0ff;background:rgba(255,255,255,.06);font-size:.72rem;font-weight:850}`; document.head.appendChild(s);}
  let t=0; function schedule(){clearTimeout(t); t=setTimeout(()=>{style();balance();},62);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule(); new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
