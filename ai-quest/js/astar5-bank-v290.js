
(function(){
'use strict';
const VERSION='v2.9.0-astar5-bank', KEY='CSAI2102_AIQUEST_S5_RECENT_V290';
const C=[
['formula','A* ใช้ค่าใดจัด priority?','f(n)=g(n)+h(n)','h(n) อย่างเดียว','จำนวน edge','ชื่อ node','A* รวม cost ที่เดินมาแล้วกับ heuristic'],
['g','g(n) คืออะไร?','cost สะสมจาก start ถึง n','heuristic ไป goal','จำนวน neighbor','visited order','g คือ cost จริงที่ใช้ไปแล้ว'],
['h','h(n) คืออะไร?','ค่าประมาณ cost จาก n ไป goal','cost จาก start ถึง n','จำนวน node','คะแนน','h คือ heuristic ที่เหลือ'],
['admissible','admissible heuristic คืออะไร?','ไม่ประเมินเกิน cost จริง','ประเมินเกินจริงเสมอ','สุ่มได้','ต้องเท่ากับ 0','ไม่ overestimate จึงช่วยรักษา optimality'],
['ucs','ถ้า h(n)=0 ทุก node A* จะเหมือนอะไร?','Uniform Cost Search','DFS','Greedy','BFS แบบไม่มี queue','f=g+0 จึงเป็น UCS'],
['greedy','Greedy Best-First ต่างจาก A* อย่างไร?','Greedy ใช้ h เป็นหลัก ส่วน A* ใช้ g+h','Greedy ใช้ g+h','A* ใช้ h อย่างเดียว','เหมือนกันทุกกรณี','A* คิด cost ที่ใช้ไปแล้วด้วย'],
['goal','A* ควรหยุดเมื่อใด?','เมื่อ goal ถูก pop/selected จาก frontier ภายใต้ heuristic ที่เหมาะสม','เมื่อเห็น goal เป็น neighbor ทันที','เมื่อ h(start)=0','เมื่อเปิด node แรก','ต้องระวัง discover goal เร็วเกินไป'],
['over','heuristic ที่ประเมินเกินจริงเสี่ยงอะไร?','อาจเสีย optimality','ทำให้ดีที่สุดเสมอ','ทำให้เป็น BFS','ไม่มีผล','overestimate อาจหลอก A*'],
['path','final path ต่างจาก expanded order อย่างไร?','path คือ parent chain ส่วน expanded order คือ trace','เหมือนกันเสมอ','expanded order คือคำตอบสุดท้าย','path คือทุก node','ต้องแยก trace กับคำตอบ'],
['tie','ถ้า f เท่ากันหลาย node ทำอย่างไร?','ใช้ tie-break ที่กำหนดและบอกให้ชัด','สุ่มโดยไม่บอก','หยุด search','เลือก goal เสมอ','tie-break ส่งผลต่อ trace']
].map((r,i)=>({id:'s5_c_'+i,familyId:r[0],phase:'A* Concept',prompt:r[1],answer:r[2],distractors:[r[3],r[4],r[5]],why:r[6],hint:'ใช้ g, h, f=g+h'}));
const M=[
{id:'a1',fam:'good_h',title:'A* Map A',s:'S',g:'G',h:{S:5,A:4,B:2,C:2,D:1,G:0},e:{S:[['A',1],['B',4]],A:[['C',2],['G',8]],B:[['D',1]],C:[['G',3]],D:[['G',2]],G:[]}},
{id:'a2',fam:'greedy_trap',title:'A* Map B',s:'S',g:'G',h:{S:4,A:1,B:3,C:1,G:0},e:{S:[['A',5],['B',1]],A:[['G',5]],B:[['C',1]],C:[['G',3]],G:[]}},
{id:'a3',fam:'zero_h',title:'A* Map C',s:'S',g:'G',h:{S:0,A:0,B:0,C:0,G:0},e:{S:[['A',2],['B',1]],A:[['G',5]],B:[['C',2]],C:[['G',2]],G:[]}},
{id:'a4',fam:'tie_f',title:'A* Map D',s:'S',g:'G',h:{S:5,A:3,B:3,C:1,D:1,G:0},e:{S:[['A',2],['B',2]],A:[['C',2]],B:[['D',2]],C:[['G',2]],D:[['G',2]],G:[]}},
{id:'a5',fam:'wide_h',title:'A* Map E',s:'S',g:'G',h:{S:6,A:5,B:3,C:4,E:1,G:0},e:{S:[['A',1],['B',3],['C',2]],A:[['G',6]],B:[['E',2]],C:[['E',5]],E:[['G',2]],G:[]}},
{id:'a6',fam:'long_cheap',title:'A* Map F',s:'S',g:'G',h:{S:5,A:4,B:3,C:2,X:1,G:0},e:{S:[['A',1],['X',5]],A:[['B',1]],B:[['C',1]],C:[['G',2]],X:[['G',1]],G:[]}}
];
const B=[
['formula','A* ใช้ h(n) อย่างเดียว','ไม่ถูก A* ใช้ f(n)=g(n)+h(n)','A* ต้องรวม cost ที่เดินมาแล้ว'],
['zero','ถ้า h=0 ทุก node A* เหมือน UCS','ถูก เพราะ f=g+0','h=0 ทำให้ A* ลดรูปเป็น UCS'],
['over','heuristic เกินจริงปลอดภัยเสมอ','ไม่ถูก อาจเสีย optimality','admissible ต้องไม่เกินจริง'],
['greedy','Greedy optimal เหมือน A*','ไม่ถูก Greedy ใช้ h เป็นหลัก','Greedy ไม่คิด cost ที่จ่ายไปแล้ว'],
['path','final path คือ expanded order','ไม่ถูก final path คือ parent chain','path กับ trace ต่างกัน']
].map((r,i)=>({id:'s5_b_'+i,familyId:r[0],phase:'A* Boss',prompt:'A* Boss Claim: “'+r[1]+'”',answer:r[2],distractors:['ถูกเสมอเพราะ heuristic ดี','ไม่ต้องสนใจ g/h/f','BFS ดีกว่าทุกกรณี'],why:r[3],hint:'ดู A*, UCS, Greedy, heuristic'}));
function clone(o){return JSON.parse(JSON.stringify(o))}
function gt(m){return Object.keys(m.e).map(k=>k+'→'+((m.e[k]||[]).length?(m.e[k]||[]).map(x=>x[0]+':'+x[1]).join(','):'∅')).join(' | ')+' | h='+Object.keys(m.h).map(k=>k+':'+m.h[k]).join(',')}
function astar(m){let open=[{n:m.s,g:0,f:m.h[m.s]||0,p:[m.s]}],best={[m.s]:0},closed=new Set(),ord=[];while(open.length){open.sort((a,b)=>a.f-b.f||(m.h[a.n]||0)-(m.h[b.n]||0)||a.n.localeCompare(b.n));let c=open.shift();if(closed.has(c.n))continue;closed.add(c.n);ord.push(c.n);if(c.n===m.g)return{order:ord,path:c.p,cost:c.g};(m.e[c.n]||[]).forEach(([n,w])=>{let ng=c.g+w,nf=ng+(m.h[n]||0);if(best[n]==null||ng<best[n]){best[n]=ng;open.push({n,g:ng,f:nf,p:c.p.concat([n])})}})}return{order:ord,path:[],cost:999}}
function greedy(m){let open=[{n:m.s,p:[m.s]}],seen=new Set(),ord=[];while(open.length){open.sort((a,b)=>(m.h[a.n]||0)-(m.h[b.n]||0)||a.n.localeCompare(b.n));let c=open.shift();if(seen.has(c.n))continue;seen.add(c.n);ord.push(c.n);if(c.n===m.g)return{order:ord,path:c.p};(m.e[c.n]||[]).forEach(([n])=>open.push({n,p:c.p.concat([n])}))}return{order:ord,path:[]}}
function make(){let items=[];M.forEach(m=>{let a=astar(m),g=greedy(m);items.push({id:'s5_t_'+m.id,familyId:m.fam+'_trace',phase:'A* Trace',prompt:`${m.title}: ใช้ A* จาก ${m.s} ไป ${m.g} expanded order คือข้อใด?`,context:`Graph: ${gt(m)}`,answer:a.order.join(' → '),distractors:[g.order.join(' → '),a.order.slice().reverse().join(' → '),[m.s].concat((m.e[m.s]||[]).map(x=>x[0])).concat([m.g]).join(' → ')],why:'A* เลือก f(n)=g(n)+h(n) ต่ำสุด',hint:'คำนวณ f=g+h'});items.push({id:'s5_p_'+m.id,familyId:m.fam+'_path',phase:'A* Path',prompt:`${m.title}: final path ของ A* คือข้อใด?`,context:`Graph: ${gt(m)}`,answer:`${a.path.join(' → ')} (cost ${a.cost})`,distractors:[g.path.join(' → ')+' (greedy)',a.order.join(' → ')+' (expanded)',`${m.s} → ${m.g}`],why:'final path คือ parent chain ไม่ใช่ expanded order',hint:'แยก path กับ trace'});items.push({id:'s5_g_'+m.id,familyId:m.fam+'_compare',phase:'A* vs Greedy',prompt:`${m.title}: สรุป A* vs Greedy ข้อใดถูก?`,context:`Graph: ${gt(m)}`,answer:'A* ใช้ g+h ส่วน Greedy ใช้ h เป็นหลัก',distractors:['เหมือนกันทุกกรณี','A* ใช้ h อย่างเดียว','Greedy ใช้ g+h'],why:'A* ถ่วงดุล cost ที่ใช้ไปแล้วกับ heuristic',hint:'A* = g+h'});});return items}
const G=make();
function sh(a){let x=a.slice();for(let i=x.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function pick(p,n){return sh(p).slice(0,n).map(clone)}
function countsFor(d){if(d==='challenge')return{c:5,t:5,p:4,b:4};if(d==='hard')return{c:4,t:5,p:4,b:3};if(d==='easy')return{c:3,t:3,p:2,b:2};return{c:4,t:4,p:3,b:3}}
function buildSession5Round(d){let c=countsFor(d||'normal'),state=pick(C,c.c),graph=pick(G.filter(x=>x.phase==='A* Trace'),c.t),maze=pick(G.filter(x=>x.phase!=='A* Trace'),c.p),boss=pick(B,c.b);return{version:VERSION,title:'S5 A* Rescue Mission',phases:['A* Concept','A* Trace','A* Path','A* vs Greedy','A* Boss'],state,graph,maze,boss,noRepeat:{recentWindow:8,itemIds:state.concat(graph,maze,boss).map(x=>x.id),familyIds:state.concat(graph,maze,boss).map(x=>x.familyId)}}}
function resetSession5History(){try{localStorage.removeItem(KEY)}catch(e){}}
window.AIQUEST_ASTAR5_BANK={VERSION,CONCEPT_ITEMS:C,GRAPH_ITEMS:G,BOSS_CLAIMS:B,buildSession5Round,resetSession5History,counts:{concept:C.length,graph:G.length,boss:B.length,total:C.length+G.length+B.length}};
window.buildSession5Round=buildSession5Round;
console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_ASTAR5_BANK.counts);
})();
