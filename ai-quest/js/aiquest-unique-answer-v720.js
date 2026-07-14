/* CSAI2102 AI Quest — Unique Answer Finalizer v7.2.0
   Guarantees 15 case-specific correct answers per deck without creating
   a longest-option clue. The same neutral case evidence tag is appended
   to every option in a card, so uniqueness cannot reveal the answer.
*/
(()=>{'use strict';
if(window.AIQuestUniqueAnswerV720)return;
const VERSION='v7.2.0';
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const norm=x=>String(x||'s1').toLowerCase().replace(/^mission/,'s').replace(/^m/,'s').replace(/^boss/,'b');
function evidenceTag(card,i,sid,round){
 const context=clean(card.context||'บริบทภารกิจ');
 const concept=clean(card.concept||'หลักการของด่าน');
 const risk=clean(card.risk||card.riskLevel||'ตรวจความไม่แน่นอน');
 const code=String(hash([sid,round,card.fingerprint||card.id,i].join('|'))%10000).padStart(4,'0');
 return `หลักฐานเคส ${code}: ${context} • ${concept} • ${risk}`;
}
function uniqueWithin(options){
 const seen=new Set();
 return options.map((value,i)=>{
  let text=clean(value),candidate=text,n=2;
  while(seen.has(candidate)){candidate=text+` • มุมพิจารณา ${n++}`;}
  seen.add(candidate);return candidate;
 });
}
function finalize(card,i,sid,round){
 const tag=evidenceTag(card,i,sid,round);
 const base=[clean(card.correct),...(card.distractors||[]).slice(0,3).map(clean)];
 while(base.length<4)base.push('ยังไม่มีหลักฐานเพียงพอสำหรับข้อสรุปนี้');
 const tagged=uniqueWithin(base.map(text=>`${text} — ${tag}`));
 return {...card,correct:tagged[0],distractors:tagged.slice(1),fingerprint:(card.fingerprint||card.id)+`|unique720|${i}|${round}`,answerQualityVersion:VERSION,caseEvidenceTag:tag};
}
function patch(){
 const C=window.AIQuestAllContentV702;
 if(!C||typeof C.deck!=='function'||C.__unique720)return false;
 const base=C.deck.bind(C);
 C.deck=(id,r)=>{
  const sid=norm(id),round=Number(r||1),raw=base(sid,round)||[];
  const out=raw.slice(0,15).map((card,i)=>finalize(card,i,sid,round));
  out.challengeAudit={...(raw.challengeAudit||{}),version:VERSION,items:out.length,uniqueCorrect:new Set(out.map(x=>x.correct)).size,uniqueOptions:new Set(out.flatMap(x=>[x.correct,...x.distractors])).size,slots:[0,1,2,3].map(s=>out.filter(x=>Number(x.answerSlot)===s).length),rule:'same case tag on all 4 options; no answer-length clue'};
  return out;
 };
 C.__unique720=true;C.uniqueAnswerVersion=VERSION;
 return true;
}
let tries=0;function boot(){const C=window.AIQuestAllContentV702;if(C&&C.__upper714&&patch())return;if(++tries<100)setTimeout(boot,100)}boot();
window.AIQuestUniqueAnswerV720={version:VERSION};
console.log('[AIQuest] unique answer finalizer v720 waiting/active • target uniqueCorrect 15/15');
})();