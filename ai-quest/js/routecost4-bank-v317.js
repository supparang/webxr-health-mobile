
(function(){
'use strict';
const VERSION='v3.1.7-route-cost-max-bank', KEY='CSAI2102_AIQUEST_S4_RECENT_V300';
const CONCEPT=[];
const conceptRows=[
['ucs_goal','UCS ควรหยุดเมื่อใด?','เมื่อ goal ถูก pop/settle จาก priority queue ด้วย cost ต่ำสุด','เมื่อเห็น goal เป็น neighbor ครั้งแรก','เมื่อ BFS เจอ goal','เมื่อ frontier มี goal เฉย ๆ','ต้องรอ guarantee ว่า goal cost ต่ำสุด'],
['priority','frontier ของ UCS เรียงด้วยอะไร?','cumulative path cost g(n)','จำนวน edge','heuristic h(n)','ชื่อ node','UCS ใช้ priority by cost'],
['bfs_weight','ทำไม BFS อาจผิดใน weighted graph?','เพราะ BFS นับจำนวน edge แต่ไม่ optimize cost','เพราะ BFS ไม่มี start','เพราะ UCS ไม่มี frontier','เพราะ goal test ใช้ไม่ได้','weighted graph ต้องดูผลรวม cost'],
['relax','ถ้าพบ node เดิมด้วย cost ต่ำกว่า?','update best cost และ parent','ทิ้งทันที','หยุด search','เปลี่ยนเป็น DFS','ต้องรักษาเส้นทางถูกกว่า'],
['settled','visited/settled ใน UCS ควร mark เมื่อใด?','เมื่อ pop ด้วย cost ต่ำสุด','เมื่อ discover ครั้งแรก','ก่อนเริ่มทุก node','เมื่อชื่อสั้น','settled แปลว่า cost แน่นอน'],
['path_cost','path cost คืออะไร?','ผลรวม cost ของ edge ใน path','จำนวน node ทั้งหมด','สีของ node','expanded order','cost รวมคือเกณฑ์ของ UCS'],
['negative','UCS/Dijkstra-style ระวังอะไร?','negative edge cost','positive edge','goal node','queue','negative edge อาจทำลาย guarantee'],
['tie','cost เท่ากันหลาย node ทำอย่างไร?','ใช้ tie-break ที่กำหนดชัดเจน','สุ่มโดยไม่บอก','หยุดทันที','เลือก goal เสมอ','tie-break มีผลต่อ trace'],
['parent','final path ได้จากอะไร?','parent chain จาก goal ย้อน start','expanded order ทั้งหมด','frontier ล่าสุด','ชื่อ graph','path ไม่ใช่ trace'],
['ucs_dijkstra','UCS คล้าย Dijkstra อย่างไร?','ใช้ priority ตาม cumulative cost ใน graph cost ไม่ติดลบ','ใช้ stack','ใช้ h(n)','ไม่ใช้ cost','Dijkstra/UCS ใช้ g(n)']
];
const contexts=['route planning','robot delivery','game map','campus navigation','network routing'];
conceptRows.forEach((r,i)=>contexts.forEach((c,j)=>CONCEPT.push({id:'s4_c_'+i+'_'+j,familyId:r[0]+'_'+j,phase:'Cost Concept',prompt:`ใน ${c}: ${r[1]}`,answer:r[2],distractors:[r[3],r[4],r[5]],why:r[6],hint:'ดู cumulative cost / priority queue / settled'})));

const MAPS=[];
const raw=[
['shortcut',{S:[['A',1],['B',5]],A:[['C',2],['G',9]],B:[['G',2]],C:[['G',2]],G:[]}],
['few_edges',{S:[['A',4],['B',1]],A:[['G',4]],B:[['C',1],['D',5]],C:[['G',4]],D:[['G',1]],G:[]}],
['update',{S:[['A',6],['B',2]],A:[['G',2]],B:[['A',1],['C',4]],C:[['G',3]],G:[]}],
['tie',{S:[['A',2],['B',2]],A:[['C',2]],B:[['D',2]],C:[['G',3]],D:[['G',3]],G:[]}],
['deepcheap',{S:[['A',1],['B',8]],A:[['C',1]],C:[['D',1]],D:[['G',1]],B:[['G',1]],G:[]}],
['detour',{S:[['A',3],['B',2]],A:[['E',2]],B:[['C',2],['D',6]],C:[['E',1]],D:[['G',1]],E:[['G',2]],G:[]}],
['reopen',{S:[['A',7],['B',1]],B:[['C',1]],C:[['A',1],['G',8]],A:[['G',2]],G:[]}],
['wide',{S:[['A',2],['B',3],['C',1]],A:[['G',7]],B:[['G',3]],C:[['D',1]],D:[['G',4]],G:[]}],
['lategoal',{S:[['A',1],['G',10]],A:[['B',1]],B:[['C',1]],C:[['G',2]],G:[]}],
['bfswrong',{S:[['A',1],['B',1]],A:[['G',10]],B:[['C',1]],C:[['G',1]],G:[]}],
['branch',{S:[['A',2],['B',4]],A:[['D',5],['C',2]],B:[['D',1]],C:[['G',6]],D:[['G',2]],G:[]}],
['cycle',{S:[['A',2],['B',6]],A:[['B',1],['C',5]],B:[['A',1],['G',5]],C:[['G',1]],G:[]}],
['longcheap',{S:[['A',1],['X',4]],A:[['B',1]],B:[['C',1]],C:[['G',1]],X:[['G',2]],G:[]}],
['frontier',{S:[['A',5],['B',2],['C',8]],B:[['A',1],['D',4]],A:[['D',1]],D:[['G',2]],C:[['G',1]],G:[]}],
['equal',{S:[['A',2],['B',2]],A:[['G',5]],B:[['C',1]],C:[['G',4]],G:[]}]
];
for(let r=0;r<4;r++){raw.forEach((x,i)=>MAPS.push({id:'w'+r+'_'+i,familyId:x[0]+'_'+r,title:'Weighted Map '+(r+1)+'-'+(i+1),start:'S',goal:'G',edges:x[1]}));}
function gt(m){return Object.keys(m.edges).map(k=>k+'→'+((m.edges[k]||[]).length?(m.edges[k]||[]).map(e=>e[0]+':'+e[1]).join(','):'∅')).join(' | ')}
function ucs(m){let pq=[{n:m.start,c:0,p:[m.start]}],best={[m.start]:0},closed=new Set(),ord=[];while(pq.length){pq.sort((a,b)=>a.c-b.c||a.n.localeCompare(b.n));let cur=pq.shift();if(closed.has(cur.n))continue;closed.add(cur.n);ord.push(cur.n);if(cur.n===m.goal)return{order:ord,path:cur.p,cost:cur.c};(m.edges[cur.n]||[]).forEach(([n,w])=>{let nc=cur.c+w;if(best[n]==null||nc<best[n]){best[n]=nc;pq.push({n,c:nc,p:cur.p.concat([n])})}})}return{order:ord,path:[],cost:999}}
function bfs(m){let q=[{n:m.start,p:[m.start]}],seen=new Set([m.start]);while(q.length){let c=q.shift();if(c.n===m.goal)return c.p;(m.edges[c.n]||[]).forEach(([n])=>{if(!seen.has(n)){seen.add(n);q.push({n,p:c.p.concat([n])})}})}return[]}
function pc(m,p){let c=0;for(let i=0;i<p.length-1;i++){let e=(m.edges[p[i]]||[]).find(x=>x[0]===p[i+1]);if(!e)return 999;c+=e[1]}return c}
const GRAPH=[];
MAPS.forEach(m=>{let u=ucs(m),b=bfs(m),bc=pc(m,b);
GRAPH.push({id:'s4_trace_'+m.id,familyId:m.familyId+'_trace',phase:'UCS Trace',prompt:`${m.title}: UCS expanded order คือข้อใด?`,context:`Graph: ${gt(m)}`,answer:u.order.join(' → '),distractors:[b.join(' → '),u.order.slice().reverse().join(' → '),[m.start].concat((m.edges[m.start]||[]).map(e=>e[0])).concat([m.goal]).join(' → ')],why:'UCS pop cost ต่ำสุดก่อน',hint:'เรียง frontier ตาม cumulative cost'});
GRAPH.push({id:'s4_path_'+m.id,familyId:m.familyId+'_path',phase:'Optimal Path',prompt:`${m.title}: optimal path ตาม UCS คือข้อใด?`,context:`Graph: ${gt(m)}`,answer:`${u.path.join(' → ')} (cost ${u.cost})`,distractors:[`${b.join(' → ')} (cost ${bc})`,u.order.join(' → ')+' (expanded)',`${m.start} → ${m.goal}`],why:'path คือ parent chain cost ต่ำสุด',hint:'อย่าสับสน path กับ expanded order'});
GRAPH.push({id:'s4_frontier_'+m.id,familyId:m.familyId+'_frontier',phase:'Frontier Cost',prompt:`${m.title}: หลักเลือก node ถัดไปใน UCS คืออะไร?`,context:`Graph: ${gt(m)}`,answer:'เลือก frontier node ที่ cumulative cost ต่ำสุด และ update ถ้าพบทางถูกกว่า',distractors:['เลือกจำนวน edge น้อยสุดเท่านั้น','เลือกตามตัวอักษรโดยไม่สน cost','เลือก goal ทันทีเมื่อเห็น'],why:'UCS ใช้ priority queue by g(n)',hint:'ดู g(n)'});
GRAPH.push({id:'s4_compare_'+m.id,familyId:m.familyId+'_compare',phase:'BFS vs UCS',prompt:`${m.title}: BFS path cost ${bc} แต่ UCS cost ${u.cost} สรุปใดถูก?`,context:`Graph: ${gt(m)}`,answer:'weighted graph ต้องใช้ UCS เพื่อ optimize cost ไม่ใช่จำนวน edge อย่างเดียว',distractors:['BFS ถูกกว่าเสมอ','UCS ผิดถ้า path ยาวกว่า','path ใดก็เหมือนกันถ้า goal เดียว'],why:'weighted graph วัดผลด้วย cost รวม',hint:'BFS vs UCS'});
});
const BOSS=[];
const claims=[
['bfs','BFS หา cost ต่ำสุดใน weighted graph เสมอ','ไม่ถูก ต้องใช้ UCS เมื่อ cost ต่างกัน','BFS นับ edge'],
['discover','UCS หยุดเมื่อเห็น goal เป็น neighbor ได้ทันที','ไม่ถูก ต้องรอ goal ถูก pop ด้วย cost ต่ำสุด','discover goal ยังไม่ guarantee'],
['visited','mark visited ตอน discover ปลอดภัยเสมอใน UCS','ไม่ถูก ควร settle ตอน pop','discover ครั้งแรกอาจแพง'],
['edge','edge น้อยสุดคือ cost ต่ำสุดเสมอ','ไม่ถูก edge แต่ละเส้น cost ต่างกัน','ต้องรวม cost'],
['parent','final path คือ expanded order','ไม่ถูก final path คือ parent chain','trace/path ต่างกัน'],
['tie','tie-break ไม่มีผลกับ trace','ไม่ถูก มีผลต่อลำดับเมื่อ cost เท่ากัน','trace ต้องชัด'],
['negative','UCS ปลอดภัยกับ negative edge ทุกกรณี','ไม่ถูก ต้องระวัง negative cost','negative ทำลาย guarantee'],
['frontier','frontier ไม่ต้องเก็บ cost','ไม่ถูก ต้องเก็บ cumulative cost','priority ใช้ cost'],
['all','UCS ต้อง expand ทุก node ก่อนตอบ','ไม่จำเป็น goal pop แล้วตอบได้','หยุดเมื่อ optimal'],
['dijkstra','UCS และ Dijkstra ไม่เกี่ยวกัน','ไม่ถูก ทั้งคู่ใช้ priority by cost','หลักคล้ายกัน']
];
for(let v=0;v<5;v++)claims.forEach((r,i)=>BOSS.push({id:'s4_boss_'+v+'_'+i,familyId:r[0]+'_'+v,phase:'Cost Boss',prompt:'Cost Boss Claim: “'+r[1]+'”',answer:r[2],distractors:['ถูกเสมอเพราะ search ทุกแบบเหมือนกัน','ไม่ต้องสน frontier/cost','BFS ดีกว่าเสมอ'],why:r[3],hint:'จับ misconception UCS'}));
function clone(o){return JSON.parse(JSON.stringify(o))}
function sh(a){let x=a.slice();for(let i=x.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function pick(p,n){return sh(p).slice(0,n).map(clone)}
function countsFor(d){if(d==='challenge')return{state:6,graph:6,maze:5,boss:5};if(d==='hard')return{state:5,graph:6,maze:4,boss:4};if(d==='easy')return{state:4,graph:3,maze:3,boss:2};return{state:5,graph:5,maze:4,boss:3}}
function buildSession4Round(d){let c=countsFor(d||'normal'),state=pick(CONCEPT,c.state),graph=pick(GRAPH.filter(x=>x.phase==='UCS Trace'||x.phase==='Frontier Cost'),c.graph),maze=pick(GRAPH.filter(x=>x.phase==='Optimal Path'||x.phase==='BFS vs UCS'),c.maze),boss=pick(BOSS,c.boss);let all=state.concat(graph,maze,boss);return{version:VERSION,title:'S4 Route Cost MAX',phases:['Cost Concept','UCS Trace','Optimal Path','Frontier Cost','BFS vs UCS','Cost Boss'],state,graph,maze,boss,noRepeat:{recentWindow:10,itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)}}}
function resetSession4History(){try{localStorage.removeItem(KEY)}catch(e){}}
window.AIQUEST_ROUTE4_BANK={VERSION,CONCEPT_ITEMS:CONCEPT,GRAPH_ITEMS:GRAPH,BOSS_CLAIMS:BOSS,buildSession4Round,resetSession4History,counts:{concept:CONCEPT.length,graph:GRAPH.length,boss:BOSS.length,total:CONCEPT.length+GRAPH.length+BOSS.length}};
window.buildSession4Round=buildSession4Round;
console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_ROUTE4_BANK.counts);
})();
