
(function(){
  'use strict';
  const VERSION = 'v2.9.0-route-cost-bank';
  const RECENT_KEY = 'CSAI2102_AIQUEST_S4_RECENT_V280';
  const RECENT_WINDOW = 8;

  const CONCEPT_ITEMS = [
    ['ucs_goal','Uniform Cost Search ควรหยุดเมื่อใด?','เมื่อ goal ถูก pop/settle ออกจาก priority queue ด้วย cost ต่ำสุดแล้ว','เมื่อพบ goal เป็น neighbor ครั้งแรก','เมื่อ BFS เจอ goal','เมื่อ frontier มี goal อยู่เฉย ๆ','UCS optimal เมื่อ goal ถูกเลือกออกมาด้วย cumulative cost ต่ำสุด'],
    ['priority_queue','frontier ของ UCS เรียงตามอะไร?','cumulative path cost g(n) จาก start ถึง node','จำนวน edge','ชื่อ node ตามตัวอักษรเท่านั้น','heuristic h(n) อย่างเดียว','UCS ใช้ priority queue ตาม cost สะสม'],
    ['bfs_vs_ucs','weighted graph ทำไม BFS อาจไม่พอ?','เพราะ BFS นับจำนวนก้าว แต่ UCS นับผลรวม cost','เพราะ BFS ไม่ใช้ visited','เพราะ UCS ไม่ใช้ graph','เพราะ goal test ใช้ไม่ได้','เมื่อ edge cost ไม่เท่ากันต้องดู path cost'],
    ['relax','ถ้าพบ node เดิมด้วย cost ที่ถูกกว่า ควรทำอย่างไร?','อัปเดต cost และ parent ของ node นั้น','ทิ้งทันทีเพราะเคยเจอแล้ว','หยุด search','เปลี่ยนเป็น DFS','UCS ต้องเก็บ best cost ที่ดีที่สุดเท่าที่พบ'],
    ['settled','ควร mark node เป็น settled เมื่อใด?','เมื่อ pop ออกจาก priority queue ด้วย cost ต่ำสุด','เมื่อถูกพบเป็น neighbor','ก่อนเริ่มทุก node','เมื่อชื่อ node สั้นที่สุด','settled หมายถึง cost นั้นแน่นอนแล้ว'],
    ['path_cost','path cost คืออะไร?','ผลรวม cost ของ edge ในเส้นทาง','จำนวน node ทั้งหมด','จำนวน visited','คะแนนในเกม','UCS optimize ผลรวม cost'],
    ['tie_break','ถ้า cost เท่ากันหลาย node ต้องทำอย่างไร?','ใช้ tie-break ที่กำหนด เช่น alphabetic หรือ insert order','สุ่มโดยไม่บอก','หยุด search','เลือก goal เสมอ','tie-break ส่งผลต่อ trace'],
    ['negative','UCS/Dijkstra-style ต้องระวัง edge แบบใด?','negative edge cost','positive edge cost','edge cost เท่ากัน','graph มี goal','negative edge อาจทำลาย guarantee'],
    ['parent','final path ของ UCS ได้จากอะไร?','parent chain จาก goal ย้อนกลับ start','visited order ทั้งหมด','frontier ปัจจุบัน','รายชื่อ graph ทั้งหมด','path ไม่ใช่ visited order'],
    ['dijkstra','UCS คล้าย Dijkstra ตรงไหน?','ใช้ priority by cumulative cost ใน graph cost ไม่ติดลบ','ใช้ stack เหมือน DFS','ใช้ heuristic เหมือน A*','ไม่ใช้ cost','Dijkstra/UCS ใช้ g(n) เป็นหลัก']
  ].map((r,i)=>({id:'s4_concept_'+(i+1),familyId:r[0],phase:'Cost Concept',prompt:r[1],answer:r[2],distractors:[r[3],r[4],r[5]],why:r[6],hint:'ดูคำว่า cumulative cost, priority queue, settled หรือ BFS vs UCS'}));

  const GRAPHS = [
    {id:'w01',familyId:'shortcut_expensive',title:'Weighted Map A',start:'S',goal:'G',edges:{S:[['A',1],['B',5]],A:[['C',2],['G',9]],B:[['G',2]],C:[['G',2]],G:[]}},
    {id:'w02',familyId:'few_edges_expensive',title:'Weighted Map B',start:'S',goal:'G',edges:{S:[['A',4],['B',1]],A:[['G',4]],B:[['C',1],['D',5]],C:[['G',4]],D:[['G',1]],G:[]}},
    {id:'w03',familyId:'update_frontier',title:'Weighted Map C',start:'S',goal:'G',edges:{S:[['A',6],['B',2]],A:[['G',2]],B:[['A',1],['C',4]],C:[['G',3]],G:[]}},
    {id:'w04',familyId:'tie_break',title:'Weighted Map D',start:'S',goal:'G',edges:{S:[['A',2],['B',2]],A:[['C',2]],B:[['D',2]],C:[['G',3]],D:[['G',3]],G:[]}},
    {id:'w05',familyId:'deep_cheap',title:'Weighted Map E',start:'S',goal:'G',edges:{S:[['A',1],['B',8]],A:[['C',1]],C:[['D',1]],D:[['G',1]],B:[['G',1]],G:[]}},
    {id:'w06',familyId:'detour',title:'Weighted Map F',start:'S',goal:'G',edges:{S:[['A',3],['B',2]],A:[['E',2]],B:[['C',2],['D',6]],C:[['E',1]],D:[['G',1]],E:[['G',2]],G:[]}},
    {id:'w07',familyId:'reopen_candidate',title:'Weighted Map G',start:'S',goal:'G',edges:{S:[['A',7],['B',1]],B:[['C',1]],C:[['A',1],['G',8]],A:[['G',2]],G:[]}},
    {id:'w08',familyId:'wide_cost',title:'Weighted Map H',start:'S',goal:'G',edges:{S:[['A',2],['B',3],['C',1]],A:[['G',7]],B:[['G',3]],C:[['D',1]],D:[['G',4]],G:[]}},
    {id:'w09',familyId:'late_goal',title:'Weighted Map I',start:'S',goal:'G',edges:{S:[['A',1],['G',10]],A:[['B',1]],B:[['C',1]],C:[['G',2]],G:[]}},
    {id:'w10',familyId:'bfs_wrong',title:'Weighted Map J',start:'S',goal:'G',edges:{S:[['A',1],['B',1]],A:[['G',10]],B:[['C',1]],C:[['G',1]],G:[]}},
    {id:'w11',familyId:'branch_cost',title:'Weighted Map K',start:'S',goal:'G',edges:{S:[['A',2],['B',4]],A:[['D',5],['C',2]],B:[['D',1]],C:[['G',6]],D:[['G',2]],G:[]}},
    {id:'w12',familyId:'cycle_cost',title:'Weighted Map L',start:'S',goal:'G',edges:{S:[['A',2],['B',6]],A:[['B',1],['C',5]],B:[['A',1],['G',5]],C:[['G',1]],G:[]}},
    {id:'w13',familyId:'low_cost_long',title:'Weighted Map M',start:'S',goal:'G',edges:{S:[['A',1],['X',4]],A:[['B',1]],B:[['C',1]],C:[['G',1]],X:[['G',2]],G:[]}},
    {id:'w14',familyId:'frontier_update',title:'Weighted Map N',start:'S',goal:'G',edges:{S:[['A',5],['B',2],['C',8]],B:[['A',1],['D',4]],A:[['D',1]],D:[['G',2]],C:[['G',1]],G:[]}},
    {id:'w15',familyId:'equal_cost_paths',title:'Weighted Map O',start:'S',goal:'G',edges:{S:[['A',2],['B',2]],A:[['G',5]],B:[['C',1]],C:[['G',4]],G:[]}}
  ];

  const BOSS_CLAIMS = [
    ['bfs_weighted','BFS ใช้หาเส้นทาง cost ต่ำสุดได้เสมอใน weighted graph','ไม่ถูก BFS เหมาะกับ unweighted/equal cost ถ้า weight ต่างกันควรใช้ UCS','BFS ไม่ optimize cumulative cost'],
    ['goal_discovery','UCS หยุดได้ทันทีเมื่อค้นพบ goal เป็น neighbor','ไม่ถูก ควรรอจน goal ถูก pop จาก priority queue ด้วย cost ต่ำสุด','พบ goal ครั้งแรกยังอาจไม่ถูกสุด'],
    ['visited_when_found','ใน UCS mark visited ตอนเจอ node ครั้งแรกปลอดภัยเสมอ','ไม่ถูก ควร settle ตอน pop cost ต่ำสุด ไม่ใช่ตอน discover','discover ครั้งแรกอาจแพงกว่า'],
    ['edge_count','path ที่มี edge น้อยที่สุดคือ path cost ต่ำสุดเสมอ','ไม่ถูก weighted graph ต้องดูผลรวม cost','edge น้อยกว่าอาจแพงกว่า'],
    ['negative_edges','UCS ใช้ได้ปลอดภัยกับ negative edge ทุกกรณี','ไม่ถูก UCS/Dijkstra-style ต้องระวัง negative edge','negative edge ทำลาย guarantee'],
    ['tie_break','tie-break ไม่สำคัญเลยใน UCS','ไม่ถูก tie-break อาจเปลี่ยน trace/order แม้ cost optimal ยังถูก','trace ต้องระบุ tie-break'],
    ['heuristic','UCS ใช้ heuristic h(n) เป็นหลัก','ไม่ถูก UCS ใช้ g(n) หรือ cost สะสม ถ้ามี heuristic จะใกล้ A*','UCS ไม่ใช้ heuristic'],
    ['frontier_cost','frontier ของ UCS เก็บแค่ชื่อ node ไม่ต้องเก็บ cost','ไม่ถูก ต้องเก็บ cost สะสมและ parent','priority ต้องใช้ cost'],
    ['parent_chain','คำตอบ UCS คือ visited order ทั้งหมด','ไม่ถูก path คือ parent chain ส่วน visited order คือ trace','path และ trace ต่างกัน'],
    ['all_nodes','UCS ต้อง expand ทุก node ก่อนตอบ goal','ไม่จำเป็น เมื่อ goal ถูก pop ด้วย cost ต่ำสุดแล้วตอบได้','หยุดเมื่อ guarantee optimal goal']
  ].map((r,i)=>({id:'s4_boss_'+(i+1),familyId:r[0],phase:'Cost Boss',prompt:'Cost Boss Claim: “'+r[1]+'”',answer:r[2],distractors:['ถูก เพราะจำนวนก้าวและ cost เหมือนกันเสมอ','ถูก เพราะเมื่อเห็น goal แล้วไม่ต้องดู frontier','ไม่ต้องสนใจ parent/cost เพราะ goal test เพียงพอ'],why:r[3],hint:'ดู BFS/UCS, discover/pop goal, edge count หรือ cumulative cost'}));

  function clone(o){return JSON.parse(JSON.stringify(o));}
  function graphText(seed){return Object.keys(seed.edges).map(k=>k+'→'+((seed.edges[k]||[]).length?(seed.edges[k]||[]).map(e=>e[0]+':'+e[1]).join(','):'∅')).join(' | ');}
  function ucs(seed){
    const pq=[{node:seed.start,cost:0,path:[seed.start]}], best={[seed.start]:0}, settled=new Set(), order=[];
    while(pq.length){
      pq.sort((a,b)=>a.cost-b.cost || a.node.localeCompare(b.node));
      const cur=pq.shift();
      if(settled.has(cur.node)) continue;
      settled.add(cur.node); order.push(cur.node);
      if(cur.node===seed.goal) return {order,cost:cur.cost,path:cur.path};
      (seed.edges[cur.node]||[]).forEach(([n,w])=>{
        const nc=cur.cost+Number(w);
        if(best[n]==null || nc<best[n]){
          best[n]=nc; pq.push({node:n,cost:nc,path:cur.path.concat([n])});
        }
      });
    }
    return {order,cost:Infinity,path:[]};
  }
  function bfsPath(seed){
    const q=[{node:seed.start,path:[seed.start]}], seen=new Set([seed.start]);
    while(q.length){
      const cur=q.shift();
      if(cur.node===seed.goal) return cur.path;
      (seed.edges[cur.node]||[]).forEach(([n])=>{if(!seen.has(n)){seen.add(n);q.push({node:n,path:cur.path.concat([n])});}});
    }
    return [];
  }
  function pathCost(seed,path){
    let c=0;
    for(let i=0;i<path.length-1;i++){
      const e=(seed.edges[path[i]]||[]).find(x=>x[0]===path[i+1]);
      if(!e) return Infinity;
      c+=Number(e[1]);
    }
    return c;
  }
  function makeGraphItems(){
    const items=[];
    GRAPHS.forEach(seed=>{
      const u=ucs(seed), b=bfsPath(seed), bc=pathCost(seed,b);
      items.push({id:'s4_trace_'+seed.id,familyId:seed.familyId+'_trace',phase:'UCS Trace',prompt:`${seed.title}: ใช้ UCS จาก ${seed.start} ไป ${seed.goal} ลำดับ node ที่ถูก pop/settle คือข้อใด?`,context:`Weighted graph: ${graphText(seed)}`,answer:u.order.join(' → '),distractors:[b.join(' → '),u.order.slice().reverse().join(' → '),[seed.start].concat((seed.edges[seed.start]||[]).map(e=>e[0])).concat([seed.goal]).filter((v,i,a)=>a.indexOf(v)===i).join(' → ')],why:'UCS pop node ที่มี cumulative cost ต่ำสุดจาก priority queue',hint:'ใช้ priority queue ตาม cost สะสม'});
      items.push({id:'s4_path_'+seed.id,familyId:seed.familyId+'_path',phase:'Optimal Path',prompt:`${seed.title}: path cost ต่ำสุดจาก ${seed.start} ไป ${seed.goal} คือข้อใด?`,context:`Weighted graph: ${graphText(seed)}`,answer:`${u.path.join(' → ')} (cost ${u.cost})`,distractors:[`${b.join(' → ')} (cost ${bc})`,`${u.order.join(' → ')} (visited order)`,`${seed.start} → ${seed.goal} (ถ้ามี edge โดยตรงเท่านั้น)`],why:'คำตอบคือ parent/path chain ที่มี cost รวมต่ำสุด ไม่ใช่ visited order',hint:'แยก path กับ visited order'});
      items.push({id:'s4_frontier_'+seed.id,familyId:seed.familyId+'_frontier',phase:'Frontier Cost',prompt:`${seed.title}: หลักในการเลือก node ถัดไปใน UCS คืออะไร?`,context:`Weighted graph: ${graphText(seed)}`,answer:'เลือก node ใน frontier ที่มี cumulative cost ต่ำสุด และ update ถ้าพบเส้นทางถูกกว่า',distractors:['เลือก node ที่มีจำนวน edge น้อยสุดเท่านั้น','เลือกตามตัวอักษรโดยไม่สน cost','เลือก goal ทันทีเมื่อเห็นเป็น neighbor'],why:'frontier ของ UCS คือ priority queue ตาม path cost สะสม',hint:'ดู g(n) หรือ cost สะสม'});
      items.push({id:'s4_compare_'+seed.id,familyId:seed.familyId+'_compare',phase:'BFS vs UCS',prompt:`${seed.title}: ถ้า BFS ได้ path ${b.join(' → ')} cost ${bc} แต่ UCS ได้ cost ${u.cost} ควรสรุปอย่างไร?`,context:`Weighted graph: ${graphText(seed)}`,answer:'weighted graph ต้องใช้ UCS เพื่อ optimize cost สะสม ไม่ใช่ดูจำนวน edge อย่างเดียว',distractors:['BFS ถูกกว่าเสมอเพราะจำนวน edge น้อยกว่า','UCS ผิดถ้า path ยาวกว่า','goal เหมือนกัน path ใดก็เหมือนกัน'],why:'weighted graph วัดคุณภาพด้วยผลรวม cost',hint:'S4 คือสะพานจาก BFS ไป UCS'});
    });
    return items;
  }
  const GRAPH_ITEMS=makeGraphItems();

  function profileKey(){try{const p=window.AIQuestStorage&&AIQuestStorage.getProfile?AIQuestStorage.getProfile():{};return String((p.studentId||'anon')+'_'+(p.section||'101')).replace(/[^\w-]/g,'_');}catch(e){return 'anon_101';}}
  function history(){try{const all=JSON.parse(localStorage.getItem(RECENT_KEY)||'{}');return Array.isArray(all[profileKey()])?all[profileKey()]:[];}catch(e){return [];}}
  function writeHistory(round){try{const all=JSON.parse(localStorage.getItem(RECENT_KEY)||'{}');const k=profileKey();const list=Array.isArray(all[k])?all[k]:[];list.unshift(round);all[k]=list.slice(0,RECENT_WINDOW);localStorage.setItem(RECENT_KEY,JSON.stringify(all));}catch(e){}}
  function recentSets(){const itemIds=new Set(),familyIds=new Set();history().forEach(r=>{(r.itemIds||[]).forEach(x=>itemIds.add(x));(r.familyIds||[]).forEach(x=>familyIds.add(x));});return {itemIds,familyIds};}
  function shuffle(a){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function pick(pool,count,used){const rec=recentSets();const arr=shuffle(pool);const res=[];function score(it){let s=100+Math.random()*8;if(rec.itemIds.has(it.id))s-=60;if(rec.familyIds.has(it.familyId))s-=35;if(used.has(it.familyId))s-=70;return s;}while(res.length<count&&arr.length){arr.sort((a,b)=>score(b)-score(a));const c=arr.shift();res.push(clone(c));used.add(c.familyId);}return res;}
  function countsFor(diff){if(diff==='challenge')return {concept:5,trace:5,path:4,frontier:3,boss:4};if(diff==='hard')return {concept:4,trace:5,path:4,frontier:3,boss:3};if(diff==='easy')return {concept:3,trace:3,path:2,frontier:2,boss:2};return {concept:4,trace:4,path:3,frontier:3,boss:3};}
  function buildSession4Round(difficulty){
    const c=countsFor(difficulty||'normal'), used=new Set();
    const state=pick(CONCEPT_ITEMS,c.concept,used);
    const graph=pick(GRAPH_ITEMS.filter(x=>x.phase==='UCS Trace'),c.trace,used);
    const maze=pick(GRAPH_ITEMS.filter(x=>x.phase==='Optimal Path'||x.phase==='Frontier Cost'||x.phase==='BFS vs UCS'),c.path+c.frontier,used);
    const boss=pick(BOSS_CLAIMS,c.boss,used);
    const all=state.concat(graph,maze,boss);
    writeHistory({ts:new Date().toISOString(),difficulty:difficulty||'normal',itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)});
    return {version:VERSION,title:'S4 Route Cost Challenge',phases:['Cost Concept','UCS Trace','Optimal Path','Frontier Cost','BFS vs UCS','Cost Boss'],state,graph,maze,boss,noRepeat:{recentWindow:RECENT_WINDOW,itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)}};
  }
  function resetSession4History(){try{const all=JSON.parse(localStorage.getItem(RECENT_KEY)||'{}');delete all[profileKey()];localStorage.setItem(RECENT_KEY,JSON.stringify(all));}catch(e){}}
  window.AIQUEST_ROUTE4_BANK={VERSION,CONCEPT_ITEMS,GRAPH_ITEMS,BOSS_CLAIMS,buildSession4Round,resetSession4History,counts:{concept:CONCEPT_ITEMS.length,graph:GRAPH_ITEMS.length,boss:BOSS_CLAIMS.length,total:CONCEPT_ITEMS.length+GRAPH_ITEMS.length+BOSS_CLAIMS.length}};
  window.buildSession4Round=buildSession4Round;
  console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_ROUTE4_BANK.counts);
})();
