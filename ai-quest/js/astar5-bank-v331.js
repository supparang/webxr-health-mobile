
(function(){
'use strict';
const VERSION='v3.3.1-astar5-max-bank', KEY='CSAI2102_AIQUEST_S5_RECENT_V300';
const CONCEPT=[];
const rows=[
['formula','A* ใช้ค่าใดจัด priority?','f(n)=g(n)+h(n)','h เท่านั้น','g เท่านั้น','จำนวน edge','A* รวม cost ที่เดินมาแล้วกับ heuristic'],
['g','g(n) คืออะไร?','cost สะสมจาก start ถึง n','heuristic ถึง goal','จำนวน node','ชื่อ node','g คือ cost จริง'],
['h','h(n) คืออะไร?','estimate จาก n ไป goal','cost จาก start','expanded order','frontier','h คือ heuristic'],
['admissible','admissible heuristic คืออะไร?','ไม่ overestimate cost จริง','overestimate เสมอ','สุ่มค่า','ติดลบเสมอ','admissible รักษา optimality'],
['consistent','consistent heuristic ช่วยอะไร?','ลดปัญหา reopen และทำให้ f สอดคล้องตาม edge','ทำให้ DFS shortest','ลบ frontier','ไม่ต้องมี goal','consistent ช่วย closed set'],
['ucs','h=0 ทุก node A* เหมือนอะไร?','UCS','DFS','Greedy','BFS only','f=g+0'],
['greedy','Greedy ต่างจาก A* อย่างไร?','Greedy ใช้ h ส่วน A* ใช้ g+h','เหมือนกัน','A* ใช้ h เท่านั้น','Greedy ใช้ g+h','A* ถ่วงดุล cost+heuristic'],
['over','heuristic overestimate เสี่ยงอะไร?','เสีย optimality','เร็วและถูกเสมอ','กลายเป็น BFS','ไม่มีผล','overestimate หลอก search'],
['goal','ควรหยุด A* เมื่อใด?','เมื่อ goal ถูก pop/selected อย่างเหมาะสม','เมื่อเห็น goal ครั้งแรกเสมอ','เมื่อ h(start)=0','เมื่อ expand start','ต้องระวัง discover goal'],
['path','final path ต่างจาก expanded order อย่างไร?','path คือ parent chain ส่วน expanded order คือ trace','เหมือนกันเสมอ','path คือทุก node','expanded คือคำตอบ','trace/path ต่างกัน']
];
['maze','route planning','robot','game map','campus'].forEach((ctx,j)=>rows.forEach((r,i)=>CONCEPT.push({id:'s5_c_'+i+'_'+j,familyId:r[0]+'_'+j,phase:'A* Concept',prompt:`ใน ${ctx}: ${r[1]}`,answer:r[2],distractors:[r[3],r[4],r[5]],why:r[6],hint:'ดู g, h, f=g+h'})));
const raw=[
['good',{S:[['A',1],['B',4]],A:[['C',2],['G',8]],B:[['D',1]],C:[['G',3]],D:[['G',2]],G:[]},{S:5,A:4,B:2,C:2,D:1,G:0}],
['greedytrap',{S:[['A',5],['B',1]],A:[['G',5]],B:[['C',1]],C:[['G',3]],G:[]},{S:4,A:1,B:3,C:1,G:0}],
['zero',{S:[['A',2],['B',1]],A:[['G',5]],B:[['C',2]],C:[['G',2]],G:[]},{S:0,A:0,B:0,C:0,G:0}],
['tie',{S:[['A',2],['B',2]],A:[['C',2]],B:[['D',2]],C:[['G',2]],D:[['G',2]],G:[]},{S:5,A:3,B:3,C:1,D:1,G:0}],
['wide',{S:[['A',1],['B',3],['C',2]],A:[['G',6]],B:[['E',2]],C:[['E',5]],E:[['G',2]],G:[]},{S:6,A:5,B:3,C:4,E:1,G:0}],
['longcheap',{S:[['A',1],['X',5]],A:[['B',1]],B:[['C',1]],C:[['G',2]],X:[['G',1]],G:[]},{S:5,A:4,B:3,C:2,X:1,G:0}],
['detour',{S:[['A',2],['B',1]],A:[['C',2]],B:[['D',5]],C:[['G',3]],D:[['G',1]],G:[]},{S:7,A:4,B:6,C:3,D:2,G:0}],
['reopen',{S:[['A',5],['B',1]],B:[['A',1],['C',4]],A:[['G',3]],C:[['G',2]],G:[]},{S:5,A:2,B:4,C:1,G:0}],
['branch',{S:[['A',2],['B',3]],A:[['D',2],['G',7]],B:[['C',1]],C:[['G',3]],D:[['G',2]],G:[]},{S:5,A:3,B:3,C:1,D:1,G:0}],
['late',{S:[['A',1],['G',9]],A:[['B',1]],B:[['C',1]],C:[['G',3]],G:[]},{S:6,A:4,B:3,C:2,G:0}]
];
const MAPS=[];for(let r=0;r<6;r++)raw.forEach((x,i)=>MAPS.push({id:'a'+r+'_'+i,familyId:x[0]+'_'+r,title:'A* Map '+(r+1)+'-'+(i+1),start:'S',goal:'G',edges:x[1],h:x[2]}));
function gt(m){return Object.keys(m.edges).map(k=>k+'→'+((m.edges[k]||[]).length?(m.edges[k]||[]).map(e=>e[0]+':'+e[1]).join(','):'∅')).join(' | ')+' | h='+Object.keys(m.h).map(k=>k+':'+m.h[k]).join(',')}
function astar(m){let open=[{n:m.start,g:0,f:m.h[m.start]||0,p:[m.start]}],best={[m.start]:0},closed=new Set(),ord=[];while(open.length){open.sort((a,b)=>a.f-b.f||(m.h[a.n]||0)-(m.h[b.n]||0)||a.n.localeCompare(b.n));let c=open.shift();if(closed.has(c.n))continue;closed.add(c.n);ord.push(c.n);if(c.n===m.goal)return{order:ord,path:c.p,cost:c.g};(m.edges[c.n]||[]).forEach(([n,w])=>{let ng=c.g+w,nf=ng+(m.h[n]||0);if(best[n]==null||ng<best[n]){best[n]=ng;open.push({n,g:ng,f:nf,p:c.p.concat([n])})}})}return{order:ord,path:[],cost:999}}
function greedy(m){let open=[{n:m.start,p:[m.start]}],seen=new Set(),ord=[];while(open.length){open.sort((a,b)=>(m.h[a.n]||0)-(m.h[b.n]||0)||a.n.localeCompare(b.n));let c=open.shift();if(seen.has(c.n))continue;seen.add(c.n);ord.push(c.n);if(c.n===m.goal)return{order:ord,path:c.p};(m.edges[c.n]||[]).forEach(([n])=>open.push({n,p:c.p.concat([n])}))}return{order:ord,path:[]}}
const GRAPH=[];MAPS.forEach(m=>{let a=astar(m),g=greedy(m);GRAPH.push({id:'s5_trace_'+m.id,familyId:m.familyId+'_trace',phase:'A* Trace',prompt:`${m.title}: A* expanded order คือข้อใด?`,context:`Graph: ${gt(m)}`,answer:a.order.join(' → '),distractors:[g.order.join(' → '),a.order.slice().reverse().join(' → '),[m.start].concat((m.edges[m.start]||[]).map(e=>e[0])).concat([m.goal]).join(' → ')],why:'A* เลือก f=g+h ต่ำสุด',hint:'คำนวณ f=g+h'});
GRAPH.push({id:'s5_path_'+m.id,familyId:m.familyId+'_path',phase:'A* Path',prompt:`${m.title}: final path ของ A* คือข้อใด?`,context:`Graph: ${gt(m)}`,answer:`${a.path.join(' → ')} (cost ${a.cost})`,distractors:[g.path.join(' → ')+' (greedy)',a.order.join(' → ')+' (expanded)',`${m.start} → ${m.goal}`],why:'final path คือ parent chain',hint:'แยก path/trace'});
GRAPH.push({id:'s5_compare_'+m.id,familyId:m.familyId+'_compare',phase:'A* vs Greedy',prompt:`${m.title}: A* vs Greedy ข้อใดถูก?`,context:`Graph: ${gt(m)}`,answer:'A* ใช้ g+h ส่วน Greedy ใช้ h เป็นหลัก',distractors:['เหมือนกันทุกกรณี','A* ใช้ h อย่างเดียว','Greedy ใช้ g+h'],why:'A* ไม่ใช่ h-only',hint:'A*=g+h'});
GRAPH.push({id:'s5_quality_'+m.id,familyId:m.familyId+'_quality',phase:'Heuristic Debug',prompt:`${m.title}: ถ้า heuristic ประเมินเกินจริงมากเกินไป เสี่ยงอะไร?`,context:`Graph: ${gt(m)}`,answer:'A* อาจเสีย optimality และเลือก path ผิด',distractors:['รับประกัน optimal มากขึ้น','กลายเป็น BFS เสมอ','ไม่มีผลต่อ frontier'],why:'heuristic ต้อง admissible เพื่อ optimality',hint:'ดู overestimate'});});
const B=[];let claims=[['formula','A* ใช้ h อย่างเดียว','ไม่ถูก A* ใช้ g+h','formula'],['zero','h=0 ทำให้ A* เหมือน UCS','ถูก เพราะ f=g','ucs'],['over','overestimate ปลอดภัยเสมอ','ไม่ถูก อาจเสีย optimality','admissible'],['greedy','Greedy optimal เหมือน A*','ไม่ถูก Greedy ใช้ h-only','greedy'],['path','final path คือ expanded order','ไม่ถูก path คือ parent chain','path'],['consistent','consistent heuristic ช่วย closed set','ถูก ลดปัญหา reopen','consistent'],['goal','เห็น goal แล้วหยุดทันทีเสมอ','ไม่ควร ต้องดู pop/selected','goal'],['tie','tie-break ไม่มีผลต่อ trace','ไม่ถูก trace เปลี่ยนได้','tie'],['gonly','ใช้ g อย่างเดียวคือ A* เต็มรูปแบบ','ไม่ถูก g-only คือ UCS','ucs'],['hgoal','h(goal) ควรเป็น 0','ถูก เพราะไม่มี cost เหลือไป goal','heuristic']];
for(let v=0;v<5;v++)claims.forEach((r,i)=>B.push({id:'s5_boss_'+v+'_'+i,familyId:r[3]+'_'+v,phase:'A* Boss',prompt:'A* Boss Claim: “'+r[1]+'”',answer:r[2],distractors:['ถูกเสมอเพราะ heuristic ดี','ไม่ต้องสน g/h/f','BFS ดีกว่าทุกกรณี'],why:r[3],hint:'จับ misconception A*'}));
function clone(o){return JSON.parse(JSON.stringify(o))}
function sh(a){let x=a.slice();for(let i=x.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function pick(p,n){return sh(p).slice(0,n).map(clone)}
function countsFor(d){if(d==='challenge')return{state:6,graph:6,maze:5,boss:5};if(d==='hard')return{state:5,graph:6,maze:4,boss:4};if(d==='easy')return{state:4,graph:3,maze:3,boss:2};return{state:5,graph:5,maze:4,boss:3}}
function buildSession5Round(d){let c=countsFor(d||'normal'),state=pick(CONCEPT,c.state),graph=pick(GRAPH.filter(x=>x.phase==='A* Trace'||x.phase==='Heuristic Debug'),c.graph),maze=pick(GRAPH.filter(x=>x.phase==='A* Path'||x.phase==='A* vs Greedy'),c.maze),boss=pick(B,c.boss);let all=state.concat(graph,maze,boss);return{version:VERSION,title:'S5 A* MAX',phases:['A* Concept','A* Trace','A* Path','A* vs Greedy','Heuristic Debug','A* Boss'],state,graph,maze,boss,noRepeat:{recentWindow:10,itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)}}}
function resetSession5History(){try{localStorage.removeItem(KEY)}catch(e){}}
window.AIQUEST_ASTAR5_BANK={VERSION,CONCEPT_ITEMS:CONCEPT,GRAPH_ITEMS:GRAPH,BOSS_CLAIMS:B,buildSession5Round,resetSession5History,counts:{concept:CONCEPT.length,graph:GRAPH.length,boss:B.length,total:CONCEPT.length+GRAPH.length+B.length}};
window.buildSession5Round=buildSession5Round;
console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_ASTAR5_BANK.counts);
})();
