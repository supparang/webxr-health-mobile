(()=>{
'use strict';
const VERSION='HSAS-P5-RESEARCH-ASSIGNMENT-V5';
const DOMAINS=['hygiene','nutrition','fitness'];
const QUOTA={easy:2,medium:2,hard:1};
function hash(str){let h=2166136261>>>0;for(let i=0;i<String(str).length;i++){h^=String(str).charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed||123456789;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function shuffle(arr,r){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function gcd(a,b){while(b){const t=a%b;a=b;b=t}return Math.abs(a)}
function strideFor(n,seed){if(n<=1)return 1;let s=(seed%(n-1))+1;while(gcd(s,n)!==1)s=s%n+1;return s}
function orderedPool(pool,salt){return pool.slice().sort((a,b)=>hash(`${salt}|${a.pairId}`)-hash(`${salt}|${b.pairId}`))}
function takeBalanced(pool,count,slot,seed,usedIndicators){
 const ordered=orderedPool(pool,`pool-v5|${seed}`),n=ordered.length;if(!n)return[];
 const stride=strideFor(n,hash(`${seed}|stride`)),picked=[];
 for(let k=0;k<n*2&&picked.length<count;k++){
  const item=ordered[(slot+k*stride)%n];
  if(picked.includes(item))continue;
  if(!usedIndicators.has(item.indicator)){picked.push(item);usedIndicators.add(item.indicator)}
 }
 for(let k=0;k<n&&picked.length<count;k++){const item=ordered[(slot+k*stride)%n];if(!picked.includes(item))picked.push(item)}
 return picked;
}
function assignPairs(bank,{studentId,attemptId,studyId='HEROHEALTH-P5-2026'}){
 const sid=String(studentId||'').trim(),attempt=String(attemptId||'').trim();
 if(!sid)throw new Error('student_id_required');
 const studentSlot=hash(`${studyId}|student|${sid}`),attemptSlot=hash(`${studyId}|attempt|${attempt}`),pairs=[];
 for(const domain of DOMAINS){
  const used=new Set();
  for(const difficulty of ['easy','medium','hard']){
   const pool=bank.filter(x=>x.domain===domain&&x.difficulty===difficulty);
   const slot=(studentSlot+attemptSlot+hash(`${domain}|${difficulty}`))%Math.max(1,pool.length);
   pairs.push(...takeBalanced(pool,QUOTA[difficulty],slot,`${studyId}|${domain}|${difficulty}`,used));
  }
 }
 const selectionSeed=hash(`${VERSION}|selection|${studyId}|${sid}|${attempt}`);
 return{pairs,selectionSeed,studentSlot:studentSlot%100000,attemptSlot:attemptSlot%100000,assignmentMethod:'cyclic-coprime-exposure-balanced',studyId};
}
function balancedCorrectPositions(count,r){
 const base=[];for(let i=0;i<count;i++)base.push(i%4);return shuffle(base,r)
}
function optionPermutation(optionCount,correctOriginal,targetCorrect,r){
 const distractors=[];for(let i=0;i<optionCount;i++)if(i!==correctOriginal)distractors.push(i);
 const perm=shuffle(distractors,r);perm.splice(targetCorrect,0,correctOriginal);return perm
}
function buildItems(pairs,{mode,studentId,attemptId,studyId='HEROHEALTH-P5-2026'}){
 const orderSeed=hash(`${VERSION}|order|${studyId}|${mode}|${studentId}|${attemptId}`),r=rng(orderSeed),ordered=shuffle(pairs,r),targets=balancedCorrectPositions(ordered.length,r);
 const items=ordered.map((pair,index)=>{
  const source=mode==='post'?pair.post:pair.pre,target=targets[index],permutation=optionPermutation(source.options.length,source.answer,target,r);
  return{...pair,...source,displayOptions:permutation.map(originalIndex=>({text:source.options[originalIndex],index:originalIndex})),correctDisplayIndex:target,correctPosition:String.fromCharCode(65+target)};
 });
 const counts=targets.reduce((a,v)=>(a[String.fromCharCode(65+v)]++,a),{A:0,B:0,C:0,D:0});
 return{items,orderSeed,correctPositionDistribution:counts,questionOrder:items.map(x=>x.id),optionOrders:items.map(x=>x.displayOptions.map(o=>o.index))};
}
function overlap(a,b){const A=new Set(a||[]),B=new Set(b||[]);let common=0;A.forEach(x=>{if(B.has(x))common++});return{common,rate:A.size?common/A.size:0}}
window.HHAssessmentEngineV5={VERSION,DOMAINS,QUOTA,hash,rng,shuffle,assignPairs,buildItems,overlap};
})();