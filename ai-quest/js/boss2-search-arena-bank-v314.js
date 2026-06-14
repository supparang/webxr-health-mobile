
(function(){
'use strict';
const VERSION='v3.1.4-b2-search-arena-boss';
const S3=[
['bfs','BFS ใน unweighted graph หา shortest path ตามจำนวน edge','ถูก BFS สำรวจเป็นชั้น'],
['dfs','DFS ไม่รับประกัน shortest path','ถูก DFS ลงลึกก่อน'],
['frontier','frontier คือ node ที่รอ expand','ถูก ต้องแยกจาก visited'],
['visited','visited ช่วยกัน cycle/repeated state','ถูก สำคัญใน graph search'],
['path','final path ไม่เท่ากับ expanded order เสมอ','ถูก ต้องใช้ parent chain']
];
const S4=[
['ucs','UCS ใช้ priority queue ตาม cumulative cost','ถูก UCS ใช้ g(n)'],
['bfs_weight','BFS ไม่พอใน weighted graph','ถูก ถ้า cost ต่างกันต้อง UCS'],
['settle','UCS settle เมื่อ pop cost ต่ำสุด','ถูก ไม่ใช่ discover'],
['relax','พบทางถูกกว่าต้อง update cost/parent','ถูก เป็น relaxation'],
['cost','path cost คือผลรวม edge cost','ถูก']
];
const S5=[
['astar','A* ใช้ f=g+h','ถูก'],
['h','admissible heuristic ไม่ overestimate','ถูก'],
['greedy','Greedy ใช้ h-only ไม่เหมือน A*','ถูก'],
['ucs_zero','A* ที่ h=0 เหมือน UCS','ถูก'],
['over','overestimate อาจเสีย optimality','ถูก']
];
const bad=[
'ผิด เพราะ search ทุกแบบให้คำตอบเหมือนกันเสมอ',
'ไม่ต้องสน frontier/visited/path ถ้าเจอ goal แล้ว',
'ใช้จำนวน edge อย่างเดียวพอใน weighted graph ทุกกรณี',
'heuristic ยิ่ง overestimate ยิ่ง optimal เสมอ',
'expanded order คือ final path เสมอ'
];
function make(pool,prefix){let out=[];for(let v=0;v<8;v++)pool.forEach((r,i)=>out.push({id:'b2_'+prefix+'_'+v+'_'+i,familyId:r[0]+'_'+v,phase:prefix,prompt:'Search Arena Boss Claim: “'+r[1]+'”',answer:r[2],distractors:bad.slice(0,3),why:r[2],hint:'เชื่อม S3/S4/S5 ให้ถูก'}));return out}
const ITEMS=make(S3,'S3 Search Core').concat(make(S4,'S4 Cost Search')).concat(make(S5,'S5 Heuristic Search'));
function sh(a){let x=a.slice();for(let i=x.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x}
function buildBoss2Round(d){let n=d==='challenge'?24:d==='hard'?20:d==='easy'?12:16;let s3=sh(ITEMS.filter(x=>x.phase==='S3 Search Core')).slice(0,Math.ceil(n/3));let s4=sh(ITEMS.filter(x=>x.phase==='S4 Cost Search')).slice(0,Math.ceil(n/3));let s5=sh(ITEMS.filter(x=>x.phase==='S5 Heuristic Search')).slice(0,n-s3.length-s4.length);let all=sh(s3.concat(s4,s5));return{version:VERSION,title:'B2 Search Arena Boss',phases:['S3 Search Core','S4 Cost Search','S5 Heuristic Search','Final Search Duel'],state:all.filter((_,i)=>i%4===0),graph:all.filter((_,i)=>i%4===1),maze:all.filter((_,i)=>i%4===2),boss:all.filter((_,i)=>i%4===3),noRepeat:{recentWindow:10,itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)}}}
function resetBoss2History(){}
window.AIQUEST_BOSS2_BANK={VERSION,ITEMS,buildBoss2Round,resetBoss2History,counts:{total:ITEMS.length,s3:ITEMS.filter(x=>x.phase==='S3 Search Core').length,s4:ITEMS.filter(x=>x.phase==='S4 Cost Search').length,s5:ITEMS.filter(x=>x.phase==='S5 Heuristic Search').length}};
window.buildBoss2Round=buildBoss2Round;
console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_BOSS2_BANK.counts);
})();
