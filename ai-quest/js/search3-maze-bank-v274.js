/*
  CSAI2102 AI Quest
  PATCH v2.7.4 Session 3 Search Maze Bank
  ------------------------------------------------------------
  S3: BFS / DFS / State Space / Goal Test
  - no-repeat by itemId + familyId
  - generated graph tasks with deterministic BFS/DFS orders
*/
(function(){
  'use strict';

  const VERSION = 'v2.7.4-search3-maze-bank';
  const RECENT_KEY = 'CSAI2102_AIQUEST_S3_RECENT_V270';
  const RECENT_WINDOW = 6;

  const STATE_ITEMS = [
    ['state_space','เกมเขาวงกต 4x4 ถ้าตัวละครอยู่ที่ช่อง (row,col) และเดินได้ 4 ทิศ สิ่งใดคือ state ที่เหมาะที่สุด?','ตำแหน่งปัจจุบันของตัวละคร เช่น (2,3)','คะแนนรวมของผู้เล่น','สีของผนังในแผนที่','จำนวนครั้งที่กดปุ่มทั้งหมด','state คือข้อมูลที่บอกสถานะปัจจุบันของปัญหาให้ search algorithm ทำงานต่อได้'],
    ['initial_state','โจทย์หาเส้นทางจากห้องเรียนไปโรงอาหาร initial state คืออะไร?','จุดเริ่มต้น เช่น ห้องเรียน','จุดหมายปลายทาง เช่น โรงอาหาร','เส้นทางที่สั้นที่สุด','จำนวนทางแยกทั้งหมด','initial state คือสถานะเริ่มต้นก่อน search'],
    ['goal_test','ในเกมหาทางออกจาก maze goal test ควรถามอะไร?','ตอนนี้อยู่ที่ช่องทางออกหรือยัง','มีผนังกี่ช่องในแผนที่','เริ่มจากช่องไหน','เดินได้กี่ทิศ','goal test ใช้ตรวจว่าสถานะปัจจุบันเป็นเป้าหมายแล้วหรือไม่'],
    ['actions','ใน route planning actions คืออะไร?','การเคลื่อนจากเมืองหนึ่งไปเมืองที่เชื่อมต่อกัน','รายชื่อเมืองทั้งหมดในแผนที่','เมืองปลายทางเท่านั้น','จำนวนเส้นทางที่เคยลอง','actions คือสิ่งที่ทำจาก state หนึ่งเพื่อไป state ถัดไป'],
    ['frontier','BFS/DFS ใช้ frontier เพื่อทำอะไร?','เก็บ state ที่ค้นพบแล้วแต่ยังไม่ได้ขยาย','เก็บเฉพาะ goal state','ลบ state ที่เคยเยี่ยมชมทั้งหมด','เก็บคะแนนของนักศึกษา','frontier คือขอบเขตของ node ที่รอถูก expand'],
    ['visited','ทำไม search algorithm ต้องมี visited set?','เพื่อไม่วนกลับไปขยาย state เดิมซ้ำจนเกิด loop','เพื่อทำให้ DFS กลายเป็น BFS','เพื่อเก็บเฉพาะเส้นทางที่สั้นที่สุดเสมอ','เพื่อแทน goal test','visited ช่วยกัน loop และลดงานซ้ำ'],
    ['bfs_queue','BFS ใช้โครงสร้างข้อมูลใดกับ frontier?','Queue: เข้าก่อนออกก่อน','Stack: เข้าหลังออกก่อน','Priority queue ตาม cost','Hash table อย่างเดียว','BFS expand เป็นชั้น ๆ จึงใช้ queue'],
    ['dfs_stack','DFS ใช้โครงสร้างข้อมูลใดกับ frontier?','Stack หรือ recursion: เข้าหลังออกก่อน','Queue: เข้าก่อนออกก่อน','Priority queue ตาม heuristic','ตารางคะแนน','DFS ลงลึกก่อนจึงใช้ stack/recursion'],
    ['bfs_shortest','BFS ให้ shortest path เมื่อใด?','เมื่อทุก edge มี cost เท่ากันหรือมองเป็น unweighted graph','เมื่อ edge cost ต่างกันมาก','เมื่อใช้ heuristic ดี','เมื่อไม่มี visited set','BFS shortest เฉพาะกรณี unweighted/equal cost'],
    ['dfs_complete','DFS เสี่ยงปัญหาอะไรใน graph ที่มี cycle ถ้าไม่ใช้ visited?','อาจวนลูปหรือไปลึกไม่จบ','จะหา shortest path เสมอ','จะเร็วกว่า BFS เสมอ','ไม่ต้องใช้ memory เลย','DFS ต้องระวัง cycle และความลึก'],
    ['expansion_order','เมื่อกำหนด neighbor order เป็นซ้ายไปขวา ทำไมผล BFS/DFS อาจเปลี่ยนเมื่อเปลี่ยน order?','เพราะ frontier รับ node ตามลำดับ neighbor ที่กำหนด','เพราะ goal เปลี่ยนเอง','เพราะ visited set หายไป','เพราะ BFS ไม่ใช้ graph','ลำดับ neighbor ส่งผลต่อลำดับการ expand'],
    ['path_vs_order','ลำดับ visited กับ final path ต่างกันอย่างไร?','visited order คือ node ที่ expand ตามลำดับ ส่วน final path คือเส้นทางจาก start ไป goal','เหมือนกันเสมอ','final path คือทุก node ใน graph','visited order ใช้เฉพาะ DFS เท่านั้น','ต้องแยกการสำรวจกับเส้นทางคำตอบ']
  ].map((row,i)=>({
    id:'s3_state_'+String(i+1).padStart(3,'0'),
    familyId:row[0],
    phase:'State Space',
    prompt:row[1],
    answer:row[2],
    distractors:[row[3],row[4],row[5]],
    why:row[6],
    hint:'ดูว่าโจทย์ถาม state / initial / goal / action / frontier / visited / BFS / DFS'
  }));

  const GRAPH_SEEDS = [
    {id:'g01', familyId:'branch_left', title:'Map A', graph:{A:['B','C'],B:['D','E'],C:['F'],D:[],E:['G'],F:['G'],G:[]}, start:'A', goal:'G'},
    {id:'g02', familyId:'diamond', title:'Map B', graph:{S:['A','B'],A:['C','D'],B:['D','E'],C:['G'],D:['G'],E:['G'],G:[]}, start:'S', goal:'G'},
    {id:'g03', familyId:'deep_trap', title:'Map C', graph:{S:['A','B'],A:['C'],C:['D'],D:['E'],E:['G'],B:['G'],G:[]}, start:'S', goal:'G'},
    {id:'g04', familyId:'wide', title:'Map D', graph:{S:['A','B','C'],A:['D'],B:['E'],C:['F'],D:['G'],E:['G'],F:['G'],G:[]}, start:'S', goal:'G'},
    {id:'g05', familyId:'cycle_guard', title:'Map E', graph:{S:['A','B'],A:['S','C'],B:['D'],C:['G'],D:['A','G'],G:[]}, start:'S', goal:'G'},
    {id:'g06', familyId:'two_goals', title:'Map F', graph:{S:['A','B'],A:['C','G'],B:['D'],C:['E'],D:['G'],E:['G'],G:[]}, start:'S', goal:'G'},
    {id:'g07', familyId:'narrow', title:'Map G', graph:{A:['B'],B:['C','D'],C:['E'],D:['F'],E:['G'],F:['G'],G:[]}, start:'A', goal:'G'},
    {id:'g08', familyId:'shortcut', title:'Map H', graph:{S:['A','B'],A:['C'],B:['D','G'],C:['G'],D:['E'],E:['G'],G:[]}, start:'S', goal:'G'},
    {id:'g09', familyId:'three_layer', title:'Map I', graph:{S:['A','B'],A:['C','D'],B:['E','F'],C:['G'],D:['G'],E:['G'],F:['G'],G:[]}, start:'S', goal:'G'},
    {id:'g10', familyId:'dfs_win', title:'Map J', graph:{S:['A','B'],A:['G'],B:['C'],C:['D'],D:['G'],G:[]}, start:'S', goal:'G'}
  ];

  const BOSS_CLAIMS = [
    ['bfs_shortest','BFS หาเส้นทางสั้นที่สุดเสมอแม้ edge cost ไม่เท่ากัน','ไม่ถูก BFS shortest เมื่อ graph เป็น unweighted หรือ edge cost เท่ากัน ถ้า cost ต่างกันควรใช้ UCS','BFS shortest เฉพาะ unweighted/equal cost'],
    ['dfs_shortest','DFS เหมาะใช้หา shortest path ใน maze เสมอ','ไม่ถูก DFS ลงลึกก่อน จึงอาจเจอ goal เร็วแต่ไม่รับประกัน shortest path','DFS ไม่รับประกันเส้นทางสั้นสุด'],
    ['frontier_confusion','frontier คือ node ที่ visit แล้วทั้งหมด','ไม่ถูก frontier คือ node ที่ค้นพบแล้วแต่รอ expand ส่วน visited คือขยายแล้ว/กันซ้ำ','frontier กับ visited ต้องแยกกัน'],
    ['visited_loop','visited set ไม่จำเป็นใน graph ที่มี cycle','ไม่ถูก graph ที่มี cycle ถ้าไม่มี visited อาจวนซ้ำไม่จบ','visited ใช้กัน loop'],
    ['queue_stack','BFS และ DFS ต่างกันแค่ชื่อ algorithm แต่ใช้ frontier เหมือนกันทุกอย่าง','ไม่ถูก BFS ใช้ queue ส่วน DFS ใช้ stack/recursion ทำให้ลำดับสำรวจต่างกัน','โครงสร้าง frontier ทำให้พฤติกรรมต่างกัน'],
    ['goal_test','goal test คือการดูว่า path สวยหรือไม่','ไม่ถูก goal test ตรวจว่าสถานะปัจจุบันเป็นเป้าหมายตามเงื่อนไขหรือยัง','goal test คือเงื่อนไขจบ'],
    ['state_action','actions คือรายชื่อ state ทั้งหมดใน graph','ไม่ถูก actions คือการกระทำที่พา state ปัจจุบันไป state ถัดไป','state กับ action ต่างกัน'],
    ['neighbor_order','neighbor order ไม่มีผลกับ BFS/DFS เลย','ไม่ถูก เมื่อมีหลายตัวเลือก ลำดับ neighbor ส่งผลต่อลำดับ visit และบางครั้งต่อ path ที่เจอก่อน','neighbor order ส่งผลต่อ trace'],
    ['memory','BFS ใช้ memory น้อยกว่า DFS เสมอ','ไม่เสมอ BFS มักใช้ memory มากใน graph กว้าง เพราะเก็บ frontier เป็นชั้น ๆ','BFS memory สูงใน branching มาก'],
    ['complete','DFS complete เสมอในทุก graph','ไม่จริง DFS อาจไม่ complete ใน infinite depth หรือ cycle ถ้าไม่จำกัด/ไม่มี visited','DFS ต้องคุม depth/cycle']
  ].map((row,i)=>({
    id:'s3_boss_'+String(i+1).padStart(3,'0'),
    familyId:row[0],
    phase:'Search Boss',
    prompt:'Search Boss Claim: “'+row[1]+'”',
    answer:row[2],
    distractors:[
      'ถูก เพราะ search algorithm ทุกแบบให้ผลเท่ากันถ้า start และ goal เดียวกัน',
      'ถูก เพราะ visited set จะแก้ปัญหาทุกอย่างและทำให้ path สั้นที่สุดเสมอ',
      'ไม่ต้องสนใจ frontier เพราะ graph มีคำตอบอยู่แล้ว'
    ],
    why:row[3],
    hint:'ดูคำว่า BFS/DFS/frontier/visited/goal test แล้วจับ misconception'
  }));

  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function bfs(seed){
    const graph = seed.graph, start = seed.start, goal = seed.goal;
    const q = [start], visited = new Set([start]), parent = {};
    const order = [];
    while(q.length){
      const node = q.shift();
      order.push(node);
      if(node === goal) break;
      (graph[node] || []).forEach(n => {
        if(!visited.has(n)){
          visited.add(n);
          parent[n] = node;
          q.push(n);
        }
      });
    }
    return {order, path:reconstruct(parent, start, goal)};
  }

  function dfs(seed){
    const graph = seed.graph, start = seed.start, goal = seed.goal;
    const stack = [start], visited = new Set(), parent = {};
    const order = [];
    while(stack.length){
      const node = stack.pop();
      if(visited.has(node)) continue;
      visited.add(node);
      order.push(node);
      if(node === goal) break;
      const ns = (graph[node] || []).slice().reverse();
      ns.forEach(n => {
        if(!visited.has(n)){
          if(parent[n] == null) parent[n] = node;
          stack.push(n);
        }
      });
    }
    return {order, path:reconstruct(parent, start, goal)};
  }

  function reconstruct(parent, start, goal){
    if(start === goal) return [start];
    const path = [goal];
    let cur = goal;
    let guard = 0;
    while(cur !== start && guard++ < 50){
      cur = parent[cur];
      if(cur == null) return [];
      path.push(cur);
    }
    return path.reverse();
  }

  function graphText(seed){
    return Object.keys(seed.graph).map(k => k + '→' + (seed.graph[k].length ? seed.graph[k].join(',') : '∅')).join(' | ');
  }

  function makeGraphItems(){
    const items = [];
    GRAPH_SEEDS.forEach(seed => {
      ['BFS','DFS'].forEach(algo => {
        const trace = algo === 'BFS' ? bfs(seed) : dfs(seed);
        const other = algo === 'BFS' ? dfs(seed) : bfs(seed);
        items.push({
          id:'s3_graph_'+seed.id.toLowerCase()+'_'+algo.toLowerCase(),
          familyId:seed.familyId+'_'+algo.toLowerCase(),
          phase:'BFS/DFS Trace',
          prompt:`${seed.title}: ถ้าใช้ ${algo} จาก ${seed.start} ไป ${seed.goal} ลำดับ visited จนเจอ goal คือข้อใด?`,
          context:`Graph: ${graphText(seed)}`,
          answer:trace.order.join(' → '),
          distractors:[
            other.order.join(' → '),
            trace.order.slice().reverse().join(' → '),
            [seed.start].concat((seed.graph[seed.start] || []).slice().reverse()).concat([seed.goal]).filter((v,i,a)=>a.indexOf(v)===i).join(' → ')
          ],
          why:`${algo === 'BFS' ? 'BFS ใช้ queue สำรวจเป็นชั้น ๆ' : 'DFS ใช้ stack/recursion ลงลึกก่อน'} ตาม neighbor order ที่กำหนด`,
          hint:algo === 'BFS' ? 'ใช้ queue: node ที่เข้า frontier ก่อนถูก expand ก่อน' : 'ใช้ stack: node ล่าสุดถูก expand ก่อน'
        });
      });

      const b = bfs(seed);
      const d = dfs(seed);
      items.push({
        id:'s3_path_'+seed.id.toLowerCase(),
        familyId:seed.familyId+'_path',
        phase:'Maze Path',
        prompt:`${seed.title}: ใน graph นี้ ถ้าต้องการ path แบบ BFS จาก ${seed.start} ไป ${seed.goal} ควรได้ path ใด?`,
        context:`Graph: ${graphText(seed)}`,
        answer:b.path.join(' → '),
        distractors:[
          d.path.join(' → '),
          b.order.join(' → '),
          [seed.start].concat((seed.graph[seed.start] || [])).concat([seed.goal]).filter((v,i,a)=>a.indexOf(v)===i).join(' → ')
        ],
        why:'BFS path คือ parent chain จาก goal ย้อนกลับ start ไม่ใช่ visited order ทั้งหมด',
        hint:'อย่าสับสน visited order กับ final path'
      });
    });
    return items;
  }

  const GRAPH_ITEMS = makeGraphItems();

  function profileKey(){
    try{
      const p = window.AIQuestStorage && AIQuestStorage.getProfile ? AIQuestStorage.getProfile() : {};
      return String((p.studentId || 'anon') + '_' + (p.section || '101')).replace(/[^\w-]/g,'_');
    }catch(error){ return 'anon_101'; }
  }

  function readHistory(){
    try{
      const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      const key = profileKey();
      return Array.isArray(all[key]) ? all[key] : [];
    }catch(error){ return []; }
  }

  function writeHistory(entry){
    try{
      const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      const key = profileKey();
      const list = Array.isArray(all[key]) ? all[key] : [];
      list.unshift(entry);
      all[key] = list.slice(0, RECENT_WINDOW);
      localStorage.setItem(RECENT_KEY, JSON.stringify(all));
    }catch(error){}
  }

  function recentSets(){
    const itemIds = new Set();
    const familyIds = new Set();
    readHistory().forEach(round => {
      (round.itemIds || []).forEach(id => itemIds.add(id));
      (round.familyIds || []).forEach(id => familyIds.add(id));
    });
    return {itemIds, familyIds};
  }

  function shuffle(array){
    const a = array.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function pick(pool, count, usedFamilies){
    const recent = recentSets();
    const result = [];
    const candidates = shuffle(pool);
    function score(item){
      let s = 100 + Math.random()*8;
      if(recent.itemIds.has(item.id)) s -= 60;
      if(recent.familyIds.has(item.familyId)) s -= 35;
      if(usedFamilies.has(item.familyId)) s -= 70;
      return s;
    }
    while(result.length < count && candidates.length){
      candidates.sort((a,b)=>score(b)-score(a));
      const chosen = candidates.shift();
      result.push(clone(chosen));
      usedFamilies.add(chosen.familyId);
    }
    return result;
  }

  function countsFor(diff){
    if(diff === 'challenge') return {state:5, graph:5, maze:4, boss:4};
    if(diff === 'hard') return {state:4, graph:5, maze:3, boss:4};
    if(diff === 'easy') return {state:3, graph:3, maze:2, boss:2};
    return {state:4, graph:4, maze:3, boss:3};
  }

  function buildSession3Round(difficulty){
    const c = countsFor(difficulty || 'normal');
    const used = new Set();
    const state = pick(STATE_ITEMS, c.state, used);
    const graph = pick(GRAPH_ITEMS.filter(x=>x.phase==='BFS/DFS Trace'), c.graph, used);
    const maze = pick(GRAPH_ITEMS.filter(x=>x.phase==='Maze Path'), c.maze, used);
    const boss = pick(BOSS_CLAIMS, c.boss, used);
    const all = state.concat(graph, maze, boss);
    writeHistory({
      ts:new Date().toISOString(),
      difficulty:difficulty || 'normal',
      itemIds:all.map(x=>x.id),
      familyIds:all.map(x=>x.familyId)
    });
    return {
      version:VERSION,
      title:'S3 Search Maze',
      phases:['State Space','BFS/DFS Trace','Maze Path','Search Boss'],
      state, graph, maze, boss,
      noRepeat:{recentWindow:RECENT_WINDOW,itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)}
    };
  }

  function resetSession3History(){
    try{
      const all = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
      delete all[profileKey()];
      localStorage.setItem(RECENT_KEY, JSON.stringify(all));
    }catch(error){}
  }

  window.AIQUEST_SEARCH3_BANK = {
    VERSION,
    STATE_ITEMS,
    GRAPH_ITEMS,
    BOSS_CLAIMS,
    buildSession3Round,
    resetSession3History,
    counts:{
      state:STATE_ITEMS.length,
      graph:GRAPH_ITEMS.filter(x=>x.phase==='BFS/DFS Trace').length,
      maze:GRAPH_ITEMS.filter(x=>x.phase==='Maze Path').length,
      boss:BOSS_CLAIMS.length,
      total:STATE_ITEMS.length + GRAPH_ITEMS.length + BOSS_CLAIMS.length
    }
  };

  window.buildSession3Round = buildSession3Round;
  console.log('[AIQuest] ' + VERSION + ' loaded', window.AIQUEST_SEARCH3_BANK.counts);
})();
