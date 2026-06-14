
/*
  CSAI2102 AI Quest
  PATCH v3.3.3 S3 Max Search Bank
  ------------------------------------------------------------
  S3: State Space / BFS / DFS / Frontier / Visited / Goal Test
  Max bank + generated trace/debug tasks
*/
(function(){
  'use strict';

  const VERSION = 'v3.3.3-search3-max-bank';
  const RECENT_KEY = 'CSAI2102_AIQUEST_S3_RECENT_V291';
  const RECENT_WINDOW = 10;

  const CONCEPT_TEMPLATES = [
    ['state_space','state ใน search problem คืออะไร?','ข้อมูลที่บอกสถานะปัจจุบันของปัญหา เช่น ตำแหน่ง/เมือง/ช่อง','คะแนนรวมของผู้เล่น','สีพื้นหลังของเกม','จำนวนครั้งที่เปิดเว็บ','state คือ representation ของสถานการณ์ปัจจุบัน'],
    ['initial_state','initial state คืออะไร?','สถานะเริ่มต้นก่อนเริ่ม search','สถานะเป้าหมายสุดท้าย','ทุกเส้นทางที่เป็นไปได้','node ที่แพงที่สุด','initial state คือจุดตั้งต้นของปัญหา'],
    ['actions','actions ใน search problem คืออะไร?','การกระทำที่พา state หนึ่งไป state ถัดไป','รายการ goal ทั้งหมด','คะแนนของ node','ชื่อ algorithm','actions สร้าง successor states'],
    ['transition','transition model ใช้ทำอะไร?','บอกผลลัพธ์ของ action ว่าจะไป state ใด','ตัดสินว่า heuristic ดีไหม','สุ่มคำตอบ','บอกชื่อผู้เรียน','transition อธิบาย state change'],
    ['goal_test','goal test ใช้ตรวจอะไร?','ตรวจว่าสถานะปัจจุบันเป็นเป้าหมายแล้วหรือยัง','ตรวจว่า edge มีสีอะไร','ตรวจว่าเริ่มจากตรงไหน','ตรวจว่าใช้มือถือรุ่นใด','goal test คือเงื่อนไขจบ search'],
    ['path_cost','path cost คืออะไร?','ค่ารวมของการเดินตาม path หนึ่ง','จำนวนทุก node ใน graph','ชื่อ path','ความสวยของแผนที่','path cost สำคัญเมื่อ edge มีค่าใช้จ่าย'],
    ['frontier','frontier คืออะไร?','ชุด node ที่ค้นพบแล้วแต่ยังรอ expand','node ที่ถูก expand เสร็จแล้วทั้งหมด','goal เท่านั้น','edge ทั้งหมดใน graph','frontier คือคิว/สแตกของงานที่รอทำ'],
    ['visited','visited/closed set มีไว้เพื่ออะไร?','กัน expand state เดิมซ้ำและลด loop','ทำให้ BFS เป็น DFS','เพิ่มจำนวนคำถาม','แทน goal test','visited ลดงานซ้ำและกัน cycle'],
    ['expand','expand node หมายถึงอะไร?','นำ node ออกจาก frontier แล้วสร้าง successor','ลบ graph ทั้งหมด','เลือกคำตอบสุ่ม','เปลี่ยนชื่อ node','expand คือการขยาย node'],
    ['successor','successor คืออะไร?','state ถัดไปที่เกิดจาก action','start node เท่านั้น','goal node เท่านั้น','node ที่แพงที่สุด','successor คือผลลัพธ์ของการกระทำ'],
    ['bfs_queue','BFS ใช้ frontier แบบใด?','queue / FIFO','stack / LIFO','priority by heuristic','สุ่มทุกครั้ง','BFS สำรวจเป็นชั้นจึงใช้ queue'],
    ['dfs_stack','DFS ใช้ frontier แบบใด?','stack / LIFO หรือ recursion','queue / FIFO','priority by cost','ไม่มี frontier','DFS ลงลึกก่อนจึงใช้ stack'],
    ['bfs_shortest','BFS รับประกัน shortest path เมื่อใด?','เมื่อ graph เป็น unweighted หรือทุก edge cost เท่ากัน','เมื่อ edge cost ติดลบ','เมื่อไม่มี visited','เมื่อ heuristic สูง','BFS shortest ในจำนวน edge'],
    ['dfs_not_shortest','DFS รับประกัน shortest path หรือไม่?','ไม่รับประกัน shortest path','รับประกันเสมอ','รับประกันเมื่อชื่อ node สั้น','รับประกันเมื่อ graph ใหญ่','DFS ลงลึกก่อน อาจเจอ path ไม่สั้นสุด'],
    ['cycle','graph ที่มี cycle ต้องระวังอะไร?','อาจวนซ้ำถ้าไม่มี visited/closed set','จะไม่มี goal','BFS ใช้ไม่ได้เสมอ','DFS กลายเป็น UCS','cycle ต้องกัน visited'],
    ['neighbor_order','neighbor order มีผลอย่างไร?','มีผลต่อลำดับ trace และบางครั้ง path ที่เจอก่อน','ไม่มีผลใด ๆ','ทำให้ goal หาย','ทำให้ cost เป็นลบ','order เปลี่ยน trace ได้'],
    ['tree_graph','tree search กับ graph search ต่างกันตรงไหน?','graph search ใช้ explored/visited กัน state ซ้ำ','tree search ใช้ priority queue เสมอ','graph search ไม่มี goal','tree search ไม่มี start','graph search ระวัง repeated states'],
    ['complete','algorithm complete หมายถึงอะไร?','ถ้ามีคำตอบ จะหาเจอภายใต้เงื่อนไขที่กำหนด','หา shortest เสมอ','เร็วที่สุดเสมอ','ไม่ใช้ memory','complete คือรับประกันหา solution เจอ'],
    ['optimal','algorithm optimal หมายถึงอะไร?','รับประกันพบคำตอบที่ดีที่สุดตาม cost/criteria','หาเจอเร็วที่สุด','ใช้ memory น้อยสุด','ไม่ต้องมี goal','optimal คือคุณภาพคำตอบดีที่สุด'],
    ['memory','BFS มักใช้ memory อย่างไรเมื่อ branching สูง?','ใช้มากเพราะเก็บ frontier เป็นชั้นกว้าง','ใช้น้อยกว่า DFS เสมอ','ไม่ใช้ memory','ใช้เฉพาะ goal','BFS frontier โตเร็วใน graph กว้าง'],
    ['dfs_depth','DFS เสี่ยงอะไรเมื่อ depth ลึกมาก?','อาจลงลึกนานหรือไม่จบถ้าไม่มี limit','จะ shortest เสมอ','จะเร็วกว่า BFS เสมอ','ไม่ต้องใช้ visited','DFS ต้องระวัง depth/cycle'],
    ['depth_limit','depth-limited search ช่วยอะไร?','จำกัดความลึกเพื่อกัน DFS ลงลึกเกินไป','ทำให้ BFS ใช้ cost','ลบ goal test','เพิ่ม edge cost','depth limit คุม DFS'],
    ['iterative_deepening','iterative deepening รวมข้อดีอะไร?','ใช้ memory แบบ DFS แต่ค่อย ๆ เพิ่ม depth เพื่อหา shallow solution','ใช้ heuristic อย่างเดียว','เป็น UCS แบบหนึ่ง','ไม่มี repeated search','IDDFS เหมาะเมื่อ depth คำตอบไม่รู้'],
    ['trace_vs_path','visited/expanded order ต่างจาก final path อย่างไร?','trace คือ node ที่ expand ตามลำดับ ส่วน final path คือเส้นทางคำตอบ','เหมือนกันทุกครั้ง','final path คือทุก node','trace ใช้เฉพาะ BFS','ต้องแยกการสำรวจกับคำตอบ'],
    ['queue_update','ใน BFS เมื่อ expand node ต้องทำอะไรกับ neighbor ใหม่?','เพิ่มท้าย queue ถ้ายังไม่เคยพบ/visited','เพิ่มหน้า queue เสมอ','ทิ้งทั้งหมด','เลือก goal เท่านั้น','BFS enqueue neighbor ตาม order'],
    ['stack_update','ใน DFS เมื่อใช้ stack ต้องระวังอะไรกับ neighbor order?','การ push order ส่งผลต่อ node ที่ pop ถัดไป','order ไม่มีผล','ต้อง sort by cost','ต้องใช้ queue','DFS trace sensitive ต่อ order'],
    ['reachable','reachable state คืออะไร?','state ที่ไปถึงได้จาก initial state ผ่าน actions','state ทุกตัวในจักรวาล','goal เท่านั้น','state ที่ชื่อสั้น','reachable คือเข้าถึงได้จริง'],
    ['dead_end','dead end ใน search คืออะไร?','state ที่ไม่มี successor ไปต่อได้','state ที่เป็น start','state ที่ cost ต่ำสุด','frontier ทั้งหมด','dead end ต้อง backtrack/ลอง node อื่น'],
    ['branching','branching factor คืออะไร?','จำนวน successor เฉลี่ยต่อ state','จำนวน goal','ความลึกสูงสุดเท่านั้น','คะแนนเฉลี่ย','branching factor ส่งผลต่อเวลา/memory'],
    ['solution_depth','solution depth คืออะไร?','ความลึกของ goal ที่พบจาก start','จำนวน graph ทั้งหมด','ชื่อ node goal','จำนวน algorithm','depth มีผลต่อ BFS/DFS'],
    ['uninformed','BFS/DFS เป็น uninformed search เพราะอะไร?','ไม่ใช้ heuristic ความรู้พิเศษไป goal','ใช้ h(n) เสมอ','ใช้ neural network','ใช้ training data เสมอ','uninformed ใช้โครงสร้างปัญหาเท่านั้น'],
    ['state_representation','state representation ที่ดีควรเป็นอย่างไร?','พอเพียงต่อการตัดสิน action/goal และไม่ใส่ข้อมูลเกินจำเป็น','ยาวที่สุดเท่าที่ทำได้','มี emoji มากที่สุด','สุ่มค่า','representation ต้องพอดีกับ problem'],
    ['problem_formulation','problem formulation ประกอบด้วยอะไร?','initial state, actions, transition, goal test, path cost','แค่ชื่อ algorithm','แค่คะแนน','แค่คำตอบสุดท้าย','formulation ทำให้ search ทำงานได้'],
    ['frontier_empty','ถ้า frontier ว่างแต่ยังไม่เจอ goal แปลว่าอะไร?','ไม่มี solution ที่ reachable ตาม actions ที่กำหนด','goal เจอแล้ว','algorithm optimal แล้วเสมอ','ต้องลบ visited','frontier empty = หมดทางสำรวจ'],
    ['multiple_goals','ถ้ามีหลาย goal BFS จะเจออะไร?','goal ที่ตื้นที่สุดตามลำดับ search/neighbor order','goal ที่ cost ต่ำสุดเสมอ','goal ที่ชื่อสั้นสุด','goal สุดท้ายเสมอ','BFS หา shallowest goal ใน unweighted'],
    ['dfs_first_goal','DFS เจอ goal แรกแปลว่า optimal ไหม?','ไม่จำเป็น อาจมี path สั้นกว่าที่ไม่ได้สำรวจ','ใช่เสมอ','ใช่เมื่อ graph มี cycle','ใช่เมื่อไม่มี heuristic','DFS first goal ไม่รับประกัน optimal'],
    ['bfs_layers','BFS layer หมายถึงอะไร?','กลุ่ม node ที่มีระยะจำนวน edge เท่ากันจาก start','กลุ่ม node ที่ cost เท่ากันเสมอ','กลุ่ม goal ทั้งหมด','กลุ่ม visited เฉพาะ DFS','BFS expand ทีละชั้น'],
    ['dfs_backtrack','DFS backtracking คืออะไร?','เมื่อทางตันหรือจบ branch แล้วกลับไปลองทางเลือกก่อนหน้า','การใช้ queue','การลบ goal','การ sort cost','DFS ต้องย้อนกลับเมื่อ branch หมด'],
    ['parent_pointer','parent pointer ใช้ทำอะไร?','สร้าง final path จาก goal ย้อนกลับ start','นับจำนวนทั้งหมด','แทน frontier','แทน heuristic','parent เก็บที่มาของ node'],
    ['duplicate_state','duplicate state ควรจัดการอย่างไร?','ตรวจ visited/frontier เพื่อไม่ขยายซ้ำโดยไม่จำเป็น','ขยายซ้ำเสมอ','ถือว่าเป็น goal','ลบ start','duplicate เพิ่มงานและ loop'],
    ['correctness','การ trace search ที่ดีควรรายงานอะไร?','frontier/expanded/visited และ final path แยกกัน','เฉพาะคะแนน','เฉพาะสี node','เฉพาะชื่อผู้เล่น','trace ต้องโปร่งใส']
  ];

  function conceptItems(){
    const contexts = [
      ['maze','ในเกมเขาวงกต','ช่อง/ตำแหน่งของตัวละคร'],
      ['map','ในแผนที่เมือง','เมืองปัจจุบัน'],
      ['robot','ในหุ่นยนต์ส่งของ','ตำแหน่งและของที่ถืออยู่'],
      ['puzzle','ใน puzzle เลื่อนช่อง','การจัดเรียงชิ้น puzzle'],
      ['web','ในเว็บนำทางบทเรียน','หน้าปัจจุบันและเป้าหมายบทเรียน']
    ];
    const out=[];
    CONCEPT_TEMPLATES.forEach((r,i)=>{
      contexts.forEach((c,j)=>{
        out.push({
          id:'s3_concept_'+String(i+1).padStart(2,'0')+'_'+j,
          familyId:r[0]+'_'+j,
          phase:'State Space',
          prompt:c[1]+' '+r[1],
          context:'ตัวอย่าง state ที่เหมาะสม: '+c[2],
          answer:r[2],
          distractors:[r[3],r[4],r[5]],
          why:r[6],
          hint:'แยก state, action, goal, frontier, visited และ path ให้ชัด'
        });
      });
    });
    return out;
  }

  const GRAPH_SEEDS = [];
  const rawGraphs = [
    ['branch_left',{A:['B','C'],B:['D','E'],C:['F'],D:[],E:['G'],F:['G'],G:[]},'A','G'],
    ['diamond',{S:['A','B'],A:['C','D'],B:['D','E'],C:['G'],D:['G'],E:['G'],G:[]},'S','G'],
    ['deep_trap',{S:['A','B'],A:['C'],C:['D'],D:['E'],E:['G'],B:['G'],G:[]},'S','G'],
    ['wide',{S:['A','B','C'],A:['D'],B:['E'],C:['F'],D:['G'],E:['G'],F:['G'],G:[]},'S','G'],
    ['cycle_guard',{S:['A','B'],A:['S','C'],B:['D'],C:['G'],D:['A','G'],G:[]},'S','G'],
    ['two_goals',{S:['A','B'],A:['C','G'],B:['D'],C:['E'],D:['G'],E:['G'],G:[]},'S','G'],
    ['narrow',{A:['B'],B:['C','D'],C:['E'],D:['F'],E:['G'],F:['G'],G:[]},'A','G'],
    ['shortcut',{S:['A','B'],A:['C'],B:['D','G'],C:['G'],D:['E'],E:['G'],G:[]},'S','G'],
    ['three_layer',{S:['A','B'],A:['C','D'],B:['E','F'],C:['G'],D:['G'],E:['G'],F:['G'],G:[]},'S','G'],
    ['dfs_win',{S:['A','B'],A:['G'],B:['C'],C:['D'],D:['G'],G:[]},'S','G'],
    ['ladder',{S:['A','B'],A:['C'],B:['D'],C:['E'],D:['F'],E:['G'],F:['G'],G:[]},'S','G'],
    ['loop_branch',{S:['A','B'],A:['C','S'],B:['D'],C:['E'],D:['E'],E:['G'],G:[]},'S','G'],
    ['late_goal',{S:['A','B','C'],A:['D'],B:['E'],C:['G'],D:['G'],E:['F'],F:['G'],G:[]},'S','G'],
    ['merge',{S:['A','B'],A:['C'],B:['C','D'],C:['E'],D:['E'],E:['G'],G:[]},'S','G'],
    ['dead_end',{S:['A','B'],A:['C'],B:['D'],C:[],D:['E'],E:['G'],G:[]},'S','G'],
    ['multi_path',{S:['A','B','C'],A:['G'],B:['D'],C:['E'],D:['G'],E:['F'],F:['G'],G:[]},'S','G'],
    ['deep_left',{S:['A','B'],A:['C'],C:['D'],D:['E'],E:['F'],F:['G'],B:['G'],G:[]},'S','G'],
    ['deep_right',{S:['A','B'],A:['G'],B:['C'],C:['D'],D:['E'],E:['F'],F:['G'],G:[]},'S','G'],
    ['cross',{S:['A','B'],A:['C','D'],B:['D','E'],C:['F'],D:['F'],E:['G'],F:['G'],G:[]},'S','G'],
    ['fan_in',{S:['A','B','C'],A:['D'],B:['D'],C:['D'],D:['E','F'],E:['G'],F:['G'],G:[]},'S','G']
  ];
  rawGraphs.forEach((g,i)=>{
    GRAPH_SEEDS.push({id:'g'+String(i+1).padStart(2,'0'), familyId:g[0], title:'Search Map '+String.fromCharCode(65+i), graph:g[1], start:g[2], goal:g[3]});
  });

  const BOSS_TEMPLATES = [
    ['bfs_shortest','BFS หาเส้นทางสั้นที่สุดเมื่อทุก edge cost เท่ากัน','ถูก เพราะ BFS สำรวจเป็นชั้นตามจำนวน edge','BFS shortest ใน unweighted graph'],
    ['bfs_weighted','BFS หา cost ต่ำสุดได้เสมอใน weighted graph','ไม่ถูก ถ้า cost ต่างกันควรใช้ UCS','BFS นับ edge ไม่ใช่ cost'],
    ['dfs_shortest','DFS รับประกัน shortest path เสมอ','ไม่ถูก DFS ลงลึกก่อนจึงไม่รับประกัน shortest','DFS first goal อาจไม่ดีที่สุด'],
    ['frontier_visited','frontier กับ visited คือสิ่งเดียวกัน','ไม่ถูก frontier คือรอ expand ส่วน visited คือ expanded/กันซ้ำ','ต้องแยกสองชุดนี้'],
    ['visited_cycle','graph มี cycle ไม่ต้องใช้ visited ก็ปลอดภัย','ไม่ถูก อาจวน loop หรือ expand ซ้ำมาก','cycle ต้องกัน repeated state'],
    ['goal_test','goal test คือการตรวจว่าสถานะปัจจุบันตรงเป้าหมายหรือไม่','ถูก goal test เป็นเงื่อนไขจบ','goal test ชี้ว่าพบคำตอบแล้ว'],
    ['state_action','actions คือการเปลี่ยนจาก state ไป successor','ถูก actions ทำให้เกิด state ถัดไป','actions สร้าง successor'],
    ['neighbor_order','neighbor order ไม่มีผลกับ trace','ไม่ถูก order มีผลต่อลำดับ expand และ path ที่เจอก่อน','trace sensitive ต่อ order'],
    ['trace_path','visited order คือ final path เสมอ','ไม่ถูก final path ต้องใช้ parent chain','trace กับ path ต่างกัน'],
    ['frontier_empty','frontier ว่างแล้วยังไม่เจอ goal แปลว่าไม่มี reachable solution','ถูก เพราะไม่มี node ให้สำรวจต่อ','frontier empty = search หมดทาง'],
    ['tree_graph','graph search ใช้ visited เพื่อลด state ซ้ำ','ถูก repeated states ต้องจัดการ','graph search กัน duplicate'],
    ['dfs_memory','DFS มักใช้ memory น้อยกว่า BFS ใน graph กว้าง','โดยทั่วไปถูก แต่ต้องระวัง depth/cycle','DFS memory ตาม depth'],
    ['bfs_memory','BFS อาจใช้ memory มากเมื่อ branching สูง','ถูก frontier โตเป็นชั้นกว้าง','BFS memory สูง'],
    ['iddfs','Iterative deepening ใช้ depth limit เพิ่มทีละระดับ','ถูก เป็นการผสมข้อดี DFS/BFS บางส่วน','IDDFS เพิ่ม depth ทีละรอบ'],
    ['deadend','DFS เจอ dead end แล้วต้อง backtrack','ถูก ต้องย้อนกลับลอง branch อื่น','backtracking เป็นส่วนหนึ่งของ DFS'],
    ['duplicate','duplicate state ไม่เคยเป็นปัญหา','ไม่ถูก duplicate ทำให้ซ้ำหรือ loop','ต้องตรวจ visited/frontier'],
    ['parent','parent pointer ใช้ reconstruct path','ถูก เก็บที่มาของ node','parent ใช้สร้าง final path'],
    ['complete','BFS complete ใน finite branching graph ที่ solution finite','ถูกภายใต้เงื่อนไขเหมาะสม','BFS หา solution เจอถ้ามีและ finite'],
    ['optimal','optimal แปลว่าพบคำตอบดีที่สุดตาม metric','ถูก เช่น shortest path/cost ต่ำสุด','optimal คือคุณภาพคำตอบ'],
    ['uninformed','BFS/DFS ไม่ใช้ heuristic ไป goal','ถูก จึงเป็น uninformed search','ไม่ใช้ h(n)']
  ];

  function bossItems(){
    const variants = ['ใน maze','ใน route planning','ใน puzzle','ใน robot navigation','ใน game map'];
    const out=[];
    BOSS_TEMPLATES.forEach((r,i)=>{
      variants.forEach((v,j)=>{
        const correct = r[1].startsWith('ถูก') || r[1].startsWith('โดย') ? r[1] : r[1];
        out.push({
          id:'s3_boss_'+String(i+1).padStart(2,'0')+'_'+j,
          familyId:r[0]+'_'+j,
          phase:'Search Boss',
          prompt:'Search Boss Claim '+v+': “'+r[1].replace(/^ถูก\s*/,'').replace(/^ไม่ถูก\s*/,'')+'”',
          answer:correct,
          distractors:[
            'ถูกเสมอ เพราะ search ทุกแบบให้ path เดียวกัน',
            'ไม่ต้องสนใจ frontier/visited ถ้ามี goal',
            'คำตอบคือ expanded order ทั้งหมด ไม่ต้อง reconstruct path'
          ],
          why:r[2],
          hint:'จับ misconception เรื่อง BFS/DFS/frontier/visited/path'
        });
      });
    });
    return out;
  }

  function clone(o){return JSON.parse(JSON.stringify(o));}
  function graphText(seed){return Object.keys(seed.graph).map(k=>k+'→'+((seed.graph[k]||[]).length?seed.graph[k].join(','):'∅')).join(' | ');}
  function bfs(seed){
    const q=[seed.start], seen=new Set([seed.start]), parent={}, order=[], frontiers=[];
    while(q.length){
      frontiers.push(q.slice());
      const n=q.shift(); order.push(n);
      if(n===seed.goal) break;
      (seed.graph[n]||[]).forEach(x=>{if(!seen.has(x)){seen.add(x); parent[x]=n; q.push(x);}});
    }
    return {order,path:path(parent,seed.start,seed.goal),frontiers};
  }
  function dfs(seed){
    const st=[seed.start], seen=new Set(), parent={}, order=[], frontiers=[];
    while(st.length){
      frontiers.push(st.slice());
      const n=st.pop(); if(seen.has(n)) continue; seen.add(n); order.push(n);
      if(n===seed.goal) break;
      (seed.graph[n]||[]).slice().reverse().forEach(x=>{if(!seen.has(x)){if(parent[x]==null) parent[x]=n; st.push(x);}});
    }
    return {order,path:path(parent,seed.start,seed.goal),frontiers};
  }
  function path(parent,start,goal){
    const out=[goal]; let cur=goal, guard=0;
    while(cur!==start && guard++<50){cur=parent[cur]; if(cur==null) return []; out.push(cur);}
    return out.reverse();
  }

  function graphItems(){
    const out=[];
    GRAPH_SEEDS.forEach(seed=>{
      [['BFS',bfs(seed)],['DFS',dfs(seed)]].forEach(pair=>{
        const algo=pair[0], tr=pair[1], other=algo==='BFS'?dfs(seed):bfs(seed);
        out.push({id:'s3_trace_'+seed.id+'_'+algo.toLowerCase(),familyId:seed.familyId+'_'+algo.toLowerCase()+'_trace',phase:'BFS/DFS Trace',prompt:`${seed.title}: ใช้ ${algo} จาก ${seed.start} ไป ${seed.goal} expanded order คือข้อใด?`,context:`Graph: ${graphText(seed)}`,answer:tr.order.join(' → '),distractors:[other.order.join(' → '),tr.order.slice().reverse().join(' → '),[seed.start].concat(seed.graph[seed.start]||[]).concat([seed.goal]).filter((v,i,a)=>a.indexOf(v)===i).join(' → ')],why:algo==='BFS'?'BFS ใช้ queue/FIFO สำรวจเป็นชั้น':'DFS ใช้ stack/LIFO ลงลึกก่อน',hint:algo==='BFS'?'ใช้ queue':'ใช้ stack'});
        const f=tr.frontiers[Math.min(1,tr.frontiers.length-1)]||tr.frontiers[0]||[];
        out.push({id:'s3_frontier_'+seed.id+'_'+algo.toLowerCase(),familyId:seed.familyId+'_'+algo.toLowerCase()+'_frontier',phase:'Frontier Debug',prompt:`${seed.title}: หลักการจัด frontier ของ ${algo} คือข้อใด?`,context:`Graph: ${graphText(seed)} | ตัวอย่าง frontier: ${f.join(', ')}`,answer:algo==='BFS'?'ใช้ queue: node ที่เข้า frontier ก่อนถูก expand ก่อน':'ใช้ stack/recursion: node ล่าสุดถูก expand ก่อน',distractors:['ใช้ priority queue ตาม cost เสมอ','เลือก goal ทันทีเมื่อเห็นโดยไม่สน frontier','สุ่ม node จาก frontier ทุกครั้ง'],why:'โครงสร้าง frontier กำหนดพฤติกรรมของ search',hint:'BFS=queue, DFS=stack'});
      });
      const b=bfs(seed), d=dfs(seed);
      out.push({id:'s3_path_'+seed.id,familyId:seed.familyId+'_path',phase:'Maze Path',prompt:`${seed.title}: final path แบบ BFS จาก ${seed.start} ไป ${seed.goal} คือข้อใด?`,context:`Graph: ${graphText(seed)}`,answer:b.path.join(' → '),distractors:[d.path.join(' → '),b.order.join(' → ')+' (expanded order)',[seed.start].concat(seed.graph[seed.start]||[]).concat([seed.goal]).join(' → ')],why:'final path ใช้ parent chain ไม่ใช่ expanded order',hint:'แยก path กับ trace'});
      out.push({id:'s3_error_'+seed.id,familyId:seed.familyId+'_error',phase:'Trace Error Debug',prompt:`${seed.title}: ถ้ามีคนตอบว่า expanded order คือ ${b.path.join(' → ')} ข้อผิดพลาดหลักคืออะไร?`,context:`Graph: ${graphText(seed)}`,answer:'สับสน final path กับ expanded/visited order','distractors':['สับสน start กับ goal','สับสน edge cost กับ heuristic','ไม่มีปัญหา คำตอบนี้ถูกเสมอ'],why:'expanded order อาจมี node ที่ไม่ได้อยู่ใน final path',hint:'path ไม่เท่ากับ trace'});
    });
    return out;
  }

  const STATE_ITEMS = conceptItems();
  const GRAPH_ITEMS = graphItems();
  const BOSS_CLAIMS = bossItems();

  function profileKey(){try{const p=window.AIQuestStorage&&AIQuestStorage.getProfile?AIQuestStorage.getProfile():{};return String((p.studentId||'anon')+'_'+(p.section||'101')).replace(/[^\w-]/g,'_');}catch(e){return 'anon_101';}}
  function hist(){try{const all=JSON.parse(localStorage.getItem(RECENT_KEY)||'{}');return Array.isArray(all[profileKey()])?all[profileKey()]:[];}catch(e){return [];}}
  function writeHist(r){try{const all=JSON.parse(localStorage.getItem(RECENT_KEY)||'{}'),k=profileKey(),l=Array.isArray(all[k])?all[k]:[];l.unshift(r);all[k]=l.slice(0,RECENT_WINDOW);localStorage.setItem(RECENT_KEY,JSON.stringify(all));}catch(e){}}
  function recent(){const itemIds=new Set(),familyIds=new Set();hist().forEach(r=>{(r.itemIds||[]).forEach(x=>itemIds.add(x));(r.familyIds||[]).forEach(x=>familyIds.add(x));});return {itemIds,familyIds};}
  function shuffle(a){const x=a.slice();for(let i=x.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function pick(pool,n,used){const rec=recent(),arr=shuffle(pool),out=[];function sc(it){let s=100+Math.random()*8;if(rec.itemIds.has(it.id))s-=65;if(rec.familyIds.has(it.familyId))s-=40;if(used.has(it.familyId))s-=80;return s;}while(out.length<n&&arr.length){arr.sort((a,b)=>sc(b)-sc(a));let c=arr.shift();out.push(clone(c));used.add(c.familyId);}return out;}
  function countsFor(d){if(d==='challenge')return{state:6,trace:5,maze:4,debug:4,boss:4};if(d==='hard')return{state:5,trace:5,maze:4,debug:3,boss:4};if(d==='easy')return{state:4,trace:3,maze:2,debug:2,boss:2};return{state:5,trace:4,maze:3,debug:3,boss:3};}
  function buildSession3Round(difficulty){
    const c=countsFor(difficulty||'normal'), used=new Set();
    const state=pick(STATE_ITEMS,c.state,used);
    const trace=pick(GRAPH_ITEMS.filter(x=>x.phase==='BFS/DFS Trace'),c.trace,used);
    const maze=pick(GRAPH_ITEMS.filter(x=>x.phase==='Maze Path'),c.maze,used);
    const debug=pick(GRAPH_ITEMS.filter(x=>x.phase==='Frontier Debug'||x.phase==='Trace Error Debug'),c.debug,used);
    const boss=pick(BOSS_CLAIMS,c.boss,used);
    const graph=trace.concat(debug);
    const all=state.concat(graph,maze,boss);
    writeHist({ts:new Date().toISOString(),difficulty:difficulty||'normal',itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)});
    return {version:VERSION,title:'S3 Search Maze MAX',phases:['State Space','BFS/DFS Trace','Maze Path','Frontier Debug','Trace Error Debug','Search Boss'],state,graph,maze,boss,noRepeat:{recentWindow:RECENT_WINDOW,itemIds:all.map(x=>x.id),familyIds:all.map(x=>x.familyId)}};
  }
  function resetSession3History(){try{const all=JSON.parse(localStorage.getItem(RECENT_KEY)||'{}');delete all[profileKey()];localStorage.setItem(RECENT_KEY,JSON.stringify(all));}catch(e){}}
  window.AIQUEST_SEARCH3_BANK={VERSION,STATE_ITEMS,GRAPH_ITEMS,BOSS_CLAIMS,buildSession3Round,resetSession3History,counts:{state:STATE_ITEMS.length,trace:GRAPH_ITEMS.filter(x=>x.phase==='BFS/DFS Trace').length,maze:GRAPH_ITEMS.filter(x=>x.phase==='Maze Path').length,frontier:GRAPH_ITEMS.filter(x=>x.phase==='Frontier Debug').length,error:GRAPH_ITEMS.filter(x=>x.phase==='Trace Error Debug').length,boss:BOSS_CLAIMS.length,total:STATE_ITEMS.length+GRAPH_ITEMS.length+BOSS_CLAIMS.length}};
  window.buildSession3Round=buildSession3Round;
  console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_SEARCH3_BANK.counts);
})();
