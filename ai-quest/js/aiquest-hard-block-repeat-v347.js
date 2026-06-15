
(function(){
  'use strict';
  const VERSION='v3.4.7-hard-block-repeat';
  const KEY='CSAI2102_AIQUEST_HARD_BLOCK_HISTORY_V315';

  function clone(o){return JSON.parse(JSON.stringify(o||{}));}
  function pad(n){return String(n).padStart(3,'0');}
  function shuffle(a){const x=(a||[]).slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function readH(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){return{};}}
  function writeH(h){try{localStorage.setItem(KEY,JSON.stringify(h));}catch(e){}}
  function txt(it){return String([it&&it.id,it&&it.prompt,it&&it.label,it&&it.stem,it&&it.claim,it&&it.context,it&&it.answer,it&&it.correct,it&&it.why,it&&it.hint].filter(Boolean).join(' | '));}
  function sig(it){return txt(it).toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ').slice(0,320);}
  function bad(it){
    const t=txt(it).toLowerCase();
    return t.includes('s3_max_graph')||t.includes('s4_max_graph')||t.includes('s5_max_graph')||t.includes('b2_max')
      ||t.includes('max drill')||t.includes('search drill')||t.includes('ucs drill')||t.includes('a* drill')
      ||t.includes('ตรวจ algorithm, frontier structure, visited')
      ||t.includes('ตอบโดยอิงหลักการ')||t.includes('เลือก algorithm/เหตุผลที่ถูกต้อง')
      ||t.includes('ต้องตรวจอะไรเพื่อไม่สับสน')||t.includes('เมื่อต้องเลือก node จาก frontier ควรดูค่าใด')
      ||t.includes('เลือก algorithm ตาม property ของปัญหา');
  }
  function strip(arr){if(!Array.isArray(arr))return 0;const before=arr.length;for(let i=arr.length-1;i>=0;i--){if(bad(arr[i]))arr.splice(i,1);}return before-arr.length;}
  function push(arr,items){if(!Array.isArray(arr))return 0;const ids=new Set(arr.map(x=>x&&x.id).filter(Boolean));let n=0;(items||[]).forEach(it=>{if(!it||!it.id||ids.has(it.id))return;arr.push(it);ids.add(it.id);n++;});return n;}

  const v=['แผนที่มหาวิทยาลัย','maze ในเกม','robot delivery','web navigation','route planner','puzzle state','warehouse robot','emergency exit','campus shuttle','smart building'];
  const S3=[
    ['State Space','state','ในปัญหา maze state ที่เหมาะสมควรแทนด้วยอะไร?','ตำแหน่งปัจจุบันของ agent และข้อมูลที่จำเป็นต่อการตัดสินใจ',['คะแนนรวมของผู้เล่น','สีของ UI','จำนวนครั้งที่กดปุ่ม'],'state ต้องแทนสถานการณ์ของปัญหา'],
    ['State Space','initial','initial state หมายถึงอะไร?','สถานะเริ่มต้นก่อนเริ่มใช้ action เพื่อค้นหา goal',['สถานะหลังเจอ goal','node ทุกตัวใน graph','path ที่ดีที่สุดหลังจบเกม'],'initial state คือจุดตั้งต้น'],
    ['State Space','action','action เช่น ขึ้น/ลง/ซ้าย/ขวา มีหน้าที่อะไร?','เปลี่ยนจาก state หนึ่งไปยัง state ถัดไปตามกติกา',['ตรวจ goal','เรียง heuristic','บันทึกดาว'],'action คือ transition'],
    ['State Space','goal','goal test ควรตอบคำถามใด?','สถานะปัจจุบันตรงกับเงื่อนไขเป้าหมายหรือยัง',['ใช้ stack หรือ queue','ใช้สีใดใน UI','ให้กี่ดาว'],'goal test ตรวจเป้าหมาย'],
    ['BFS/DFS Trace','bfs','BFS ใช้ frontier แบบใด?','queue/FIFO ทำให้สำรวจ node ตามระดับความลึกเป็นชั้น ๆ',['stack/LIFO','h(n) ต่ำสุด','g(n)+h(n)'],'BFS = queue/FIFO'],
    ['BFS/DFS Trace','dfs','DFS ใช้ frontier แบบใด?','stack/LIFO หรือ recursion เพื่อไปลึกก่อนแล้ว backtrack',['queue/FIFO','priority queue ตาม cost','heuristic อย่างเดียว'],'DFS = stack/LIFO'],
    ['BFS/DFS Trace','bfs_short','ทำไม BFS หา shortest path ได้ใน unweighted graph?','เพราะสำรวจทีละระดับ จำนวน edge น้อยกว่าจะถูกเจอก่อน',['ใช้ heuristic ดี','ใช้ edge cost','ลงลึกก่อนเสมอ'],'BFS เหมาะ unweighted shortest path'],
    ['BFS/DFS Trace','dfs_not','ทำไม DFS ไม่รับประกัน shortest path?','เพราะ DFS ลงลึกตาม branch ก่อน อาจเจอ path ยาวก่อน path สั้น',['ไม่มี action','ใช้ queue','ใช้ g+h'],'DFS ไม่ optimize shortest path'],
    ['Frontier Debug','frontier','frontier/open list คืออะไร?','node ที่ค้นพบแล้วแต่ยังรอเลือกมา expand',['node ที่ expand เสร็จแล้ว','final path','goal test'],'frontier ยังรอ expand'],
    ['Frontier Debug','frontier_visited','frontier ต่างจาก visited อย่างไร?','frontier รอ expand ส่วน visited คือ expand แล้วหรือปิดแล้ว',['เหมือนกันเสมอ','frontier คือ path','visited คือ heuristic'],'frontier/open กับ visited/closed ต่างกัน'],
    ['Trace Error Debug','cycle','ไม่ใช้ visited ใน graph มี cycle เสี่ยงอะไร?','วนซ้ำหรือ expand state เดิมหลายรอบจน trace ผิด',['heuristic ดีขึ้น','path สั้นสุดเสมอ','graph กลายเป็น unweighted'],'visited กัน cycle'],
    ['Trace Error Debug','order','โจทย์ให้ neighbor order A ก่อน B แต่ขยาย B ก่อน ผิดตรงไหน?','ไม่เคารพลำดับ neighbor order ทำให้ trace ไม่ตรงโจทย์',['ไม่มีผลทุกกรณี','ทำให้ A* optimal','ทำให้ edge cost เปลี่ยน'],'neighbor order มีผลต่อ trace'],
    ['Trace Error Debug','trace_path','expanded order ต่างจาก final path อย่างไร?','expanded order คือประวัติการขยาย แต่ final path ต้องย้อน parent chain',['เหมือนกันเสมอ','final path คือ frontier ล่าสุด','expanded order คือ h table'],'trace ไม่ใช่ path'],
    ['Maze Path','parent','วิธีสร้าง final path หลังพบ goal คืออะไร?','ย้อน parent chain จาก goal กลับไป start แล้วกลับลำดับเส้นทาง',['ใช้ทุก node ที่ visited','ใช้ทุก node ใน frontier','เรียงชื่อ node'],'path ใช้ parent chain'],
    ['Maze Path','deadend','ถ้า DFS เข้าทางตันควรทำอะไร?','backtrack ไป node ก่อนหน้าที่ยังมี action เหลือ',['หยุดและ fail','เปลี่ยน edge cost','ลบ visited'],'DFS backtrack'],
    ['Search Boss','boss1','Boss Claim: expanded order คือ path สุดท้ายเสมอ ถูกไหม?','ไม่ถูก final path ต้องใช้ parent chain ไม่ใช่ทุก node ที่ expand',['ถูกเสมอ','ถูกถ้ามี visited','ถูกเพราะ frontier คือ path'],'ดัก trace/path'],
    ['Search Boss','boss2','Boss Claim: BFS กับ DFS trace เหมือนกันถ้า start เดียวกัน ถูกไหม?','ไม่ถูก เพราะ frontier structure ต่างกัน queue กับ stack',['ถูกเสมอ','ถูกถ้า graph มี goal','ถูกถ้าใช้ visited'],'BFS/DFS ต่างกัน']
  ];
  const S4=[
    ['Cost Concept','g','UCS ใช้ค่าใดจัด priority?','g(n) หรือ cumulative cost จาก start ถึง node',['h(n) อย่างเดียว','จำนวน edge อย่างเดียว','ชื่อ node'],'UCS ใช้ cost สะสม'],
    ['UCS Trace','pop','UCS เลือก node ต่อไปอย่างไร?','เลือก node ที่มี cumulative cost ต่ำสุดออกมา expand',['node ล่าสุด','heuristic ต่ำสุด','goal ที่เห็นครั้งแรก'],'priority queue by g(n)'],
    ['UCS Trace','goal','ทำไม UCS ไม่หยุดทันทีเมื่อเห็น goal เป็น neighbor?','อาจมี path ไป goal ที่ cost ต่ำกว่ารอใน frontier',['UCS ไม่มี goal test','goal ต้อง visited ทุกครั้ง','BFS ดีกว่า'],'goal ต้องถูก pop'],
    ['Frontier Cost','relax','พบ path ใหม่ไป node เดิมที่ cost ต่ำกว่า ควรทำอะไร?','update cost และ parent ของ node นั้น',['ทิ้ง path ใหม่','เก็บ cost เก่า','เปลี่ยนเป็น DFS'],'relax/update'],
    ['BFS vs UCS','weighted','weighted graph ทำให้ BFS พลาด optimal ได้อย่างไร?','BFS นับจำนวน edge ไม่ใช่ผลรวม cost',['BFS ไม่มี queue','BFS ใช้ heuristic','BFS ไม่ใช้ goal'],'BFS เหมาะ unweighted'],
    ['Optimal Path','path','UCS สร้าง path สุดท้ายจากอะไร?','parent chain ของ goal ที่ถูก pop ด้วย cost ต่ำสุด',['expanded order ทั้งหมด','frontier ทั้งหมด','node น้อยสุดเสมอ'],'path ย้อน parent'],
    ['Cost Boss','claim','Boss Claim: edge น้อยกว่า cost ต่ำกว่าเสมอ ถูกไหม?','ไม่ถูก ใน weighted graph edge น้อยกว่าอาจ cost สูงกว่า',['ถูกเสมอ','ถูกถ้า DFS','ถูกถ้า goal เดียวกัน'],'ต้องรวม edge cost']
  ];
  const S5=[
    ['A* Concept','formula','A* ใช้ค่าใดเลือก node?','f(n)=g(n)+h(n)',['h(n) อย่างเดียว','g(n) อย่างเดียว','จำนวน edge'],'A* รวม cost+estimate'],
    ['A* Trace','pick','node A f=7 และ B f=9 A* ควรเลือกอะไร?','เลือก A เพราะ f(n) ต่ำกว่า',['เลือก B เพราะ h อาจต่ำกว่า','สุ่ม','เลือก goal เท่านั้น'],'priority by f'],
    ['A* vs Greedy','diff','Greedy Best-First ต่างจาก A* อย่างไร?','Greedy ใช้ h(n) เป็นหลัก ส่วน A* ใช้ g(n)+h(n)',['เหมือนกันทุกกรณี','A* ใช้ h อย่างเดียว','ทั้งสองคือ DFS'],'Greedy h-only'],
    ['Heuristic Debug','admiss','admissible heuristic หมายถึงอะไร?','ไม่ประเมิน cost ไป goal สูงเกินจริง',['ประเมินสูงเสมอ','สุ่ม h ได้','ไม่ต้องใช้ g'],'admissible ไม่ overestimate'],
    ['Heuristic Debug','over','ถ้า heuristic overestimate อาจเกิดอะไร?','A* อาจเสีย optimality เพราะมอง path ดีแพงเกินจริง',['optimal มากขึ้น','กลายเป็น BFS','ไม่ต้องใช้ frontier'],'overestimate เสี่ยง'],
    ['A* Path','parent','A* รายงาน final path จากอะไร?','parent chain ของ goal ไม่ใช่ expanded order ทั้งหมด',['ทุก node ที่ expand','frontier ล่าสุด','เรียง node ตาม h'],'path ไม่ใช่ trace'],
    ['A* Trace','tie','ถ้า f เท่ากันสอง node ควรทำอย่างไร?','ใช้ tie-break ที่โจทย์กำหนด เช่น h ต่ำกว่า หรือ order ที่ระบุ',['สุ่มโดยไม่บอก','เลือกชื่อยาวกว่า','หยุด search'],'tie-break ทำให้ตรวจได้'],
    ['A* Boss','claim','Boss Claim: A* คือ Greedy เพราะดู heuristic เหมือนกัน ถูกไหม?','ไม่ถูก A* ใช้ g+h ส่วน Greedy ใช้ h เป็นหลัก',['ถูกเสมอ','ถูกถ้า graph มี goal','ถูกถ้า h=0'],'A* ไม่ใช่ h-only']
  ];
  const B2=[
    ['S3 Search Core','bfs','unweighted shortest path ควรเลือกอะไร?','BFS เพราะสำรวจเป็นชั้นและหา path ที่ edge น้อยสุด',['DFS รับประกันสั้นสุด','Greedy optimal','A* โดยไม่มี h เสมอ'],'เลือกตาม graph property'],
    ['S4 Cost Search','ucs','weighted graph ไม่มี heuristic ควรเลือกอะไร?','UCS เพราะ optimize cumulative cost g(n)',['BFS เสมอ','DFS เสมอ','Greedy ด้วย h'],'weighted ต้องใช้ cost search'],
    ['S5 Heuristic Search','astar','weighted graph มี heuristic ที่ดีควรเลือกอะไร?','A* เพราะใช้ f(n)=g(n)+h(n)',['Greedy h-only optimal เสมอ','DFS ดีที่สุด','BFS ไม่สน weight'],'A* cost+heuristic'],
    ['Final Search Duel','trace','trace กับ final path ต่างกันอย่างไร?','trace คือ expanded order ส่วน final path คือ parent chain',['เหมือนกันเสมอ','trace คือ h table','path คือ frontier'],'สรุป S3-S5'],
    ['Final Search Duel','goal','เห็น goal ใน frontier แล้ว UCS/A* ต้องระวังอะไร?','อย่าหยุดเร็วเกิน ต้องพิจารณา priority ต่ำสุดตาม algorithm',['หยุดทันทีทุกครั้ง','ลบ frontier','เปลี่ยนเป็น DFS'],'goal discovery กับ pop ต่างกัน'],
    ['Final Search Duel','dfs','ถ้าต้องการหาอะไรก็ได้ในพื้นที่ลึกและ memory จำกัด อาจเลือกอะไร?','DFS อาจเหมาะ แต่ไม่รับประกัน shortest path',['BFS เสมอแม้ memory ไม่พอ','A* โดยไม่มี heuristic','UCS โดยไม่สน cost'],'เลือกตามข้อจำกัด']
  ];

  function make(prefix,templates,copies){
    const out=[];
    for(let i=0;i<copies;i++){
      templates.forEach((t,j)=>out.push({
        id:`${prefix}_${pad(i)}_${pad(j)}`,
        familyId:`${prefix}_${t[1]}_${i%150}`,
        phase:t[0],
        prompt:`${v[i%v.length]}: ${t[2]}`,
        answer:t[3],
        distractors:t[4],
        why:t[5],
        hint:t[1],
        context:`hard-block item ${i+1}`
      }));
    }
    return out;
  }

  function rebuild(){
    const report={};
    const b3=window.AIQUEST_SEARCH3_BANK;
    if(b3){const removed={state:strip(b3.STATE_ITEMS),graph:strip(b3.GRAPH_ITEMS),boss:strip(b3.BOSS_CLAIMS)};const added=push(b3.GRAPH_ITEMS,make('s3_hard',S3,50));b3.counts={state:(b3.STATE_ITEMS||[]).length,graph:(b3.GRAPH_ITEMS||[]).length,boss:(b3.BOSS_CLAIMS||[]).length,total:(b3.STATE_ITEMS||[]).length+(b3.GRAPH_ITEMS||[]).length+(b3.BOSS_CLAIMS||[]).length};report.s3={removed,added,counts:b3.counts};}
    const b4=window.AIQUEST_ROUTE4_BANK;
    if(b4){const removed={concept:strip(b4.CONCEPT_ITEMS),graph:strip(b4.GRAPH_ITEMS),boss:strip(b4.BOSS_CLAIMS)};const added=push(b4.GRAPH_ITEMS,make('s4_hard',S4,55));b4.counts={concept:(b4.CONCEPT_ITEMS||[]).length,graph:(b4.GRAPH_ITEMS||[]).length,boss:(b4.BOSS_CLAIMS||[]).length,total:(b4.CONCEPT_ITEMS||[]).length+(b4.GRAPH_ITEMS||[]).length+(b4.BOSS_CLAIMS||[]).length};report.s4={removed,added,counts:b4.counts};}
    const b5=window.AIQUEST_ASTAR5_BANK;
    if(b5){const removed={concept:strip(b5.CONCEPT_ITEMS),graph:strip(b5.GRAPH_ITEMS),boss:strip(b5.BOSS_CLAIMS)};const added=push(b5.GRAPH_ITEMS,make('s5_hard',S5,55));b5.counts={concept:(b5.CONCEPT_ITEMS||[]).length,graph:(b5.GRAPH_ITEMS||[]).length,boss:(b5.BOSS_CLAIMS||[]).length,total:(b5.CONCEPT_ITEMS||[]).length+(b5.GRAPH_ITEMS||[]).length+(b5.BOSS_CLAIMS||[]).length};report.s5={removed,added,counts:b5.counts};}
    const bb=window.AIQUEST_BOSS2_BANK;
    if(bb){const removed={items:strip(bb.ITEMS)};const added=push(bb.ITEMS,make('b2_hard',B2,70));bb.counts={total:(bb.ITEMS||[]).length,s3:bb.ITEMS.filter(x=>x.phase==='S3 Search Core').length,s4:bb.ITEMS.filter(x=>x.phase==='S4 Cost Search').length,s5:bb.ITEMS.filter(x=>x.phase==='S5 Heuristic Search').length,final:bb.ITEMS.filter(x=>x.phase==='Final Search Duel').length};report.b2={removed,added,counts:bb.counts};}
    return report;
  }

  function install(globalName,builderName,buckets){
    const bank=window[globalName]; if(!bank||typeof bank[builderName]!=='function'||bank.__hardBlockRepeatV315)return false;
    const original=bank[builderName];
    bank[builderName]=function(diff){
      const round=original.call(bank,diff);
      const hist=readH(), key=globalName+'_'+(diff||'normal'), r=hist[key]||{};
      const recentIds=new Set(r.ids||[]), recentFam=new Set(r.families||[]), recentSig=new Set(r.sig||[]);
      const usedIds=new Set(), usedFam=new Set(), usedSig=new Set();

      function source(bucket){
        if(globalName==='AIQUEST_SEARCH3_BANK'){if(bucket==='state')return (bank.STATE_ITEMS||[]).filter(x=>!bad(x));if(bucket==='boss')return (bank.BOSS_CLAIMS||[]).filter(x=>!bad(x));return (bank.GRAPH_ITEMS||[]).filter(x=>!bad(x));}
        if(globalName==='AIQUEST_ROUTE4_BANK'){if(bucket==='state')return (bank.CONCEPT_ITEMS||[]).filter(x=>!bad(x));if(bucket==='boss')return (bank.BOSS_CLAIMS||[]).filter(x=>!bad(x));return (bank.GRAPH_ITEMS||[]).filter(x=>!bad(x));}
        if(globalName==='AIQUEST_ASTAR5_BANK'){if(bucket==='state')return (bank.CONCEPT_ITEMS||[]).filter(x=>!bad(x));if(bucket==='boss')return (bank.BOSS_CLAIMS||[]).filter(x=>!bad(x));return (bank.GRAPH_ITEMS||[]).filter(x=>!bad(x));}
        if(globalName==='AIQUEST_BOSS2_BANK')return (bank.ITEMS||[]).filter(x=>!bad(x));
        return [];
      }
      function match(bucket,it){
        if(!it||bad(it))return false;
        if(globalName==='AIQUEST_SEARCH3_BANK'){if(bucket==='maze')return it.phase==='Maze Path';if(bucket==='graph')return ['BFS/DFS Trace','Frontier Debug','Trace Error Debug'].includes(it.phase);}
        if(globalName==='AIQUEST_ROUTE4_BANK'){if(bucket==='maze')return ['Optimal Path','BFS vs UCS'].includes(it.phase);if(bucket==='graph')return ['UCS Trace','Frontier Cost'].includes(it.phase);}
        if(globalName==='AIQUEST_ASTAR5_BANK'){if(bucket==='maze')return ['A* Path','A* vs Greedy'].includes(it.phase);if(bucket==='graph')return ['A* Trace','Heuristic Debug'].includes(it.phase);}
        return true;
      }
      function score(it){const s=sig(it);let v=100+Math.random()*30;if(String(it.id||'').includes('_hard'))v+=80;if(recentIds.has(it.id))v-=140;if(recentFam.has(it.familyId))v-=110;if(recentSig.has(s))v-=200;if(usedIds.has(it.id)||usedSig.has(s))v-=999;if(usedFam.has(it.familyId))v-=150;return v;}
      function replace(bucket){
        if(!Array.isArray(round[bucket])||!round[bucket].length)return;
        const need=round[bucket].length;
        const p=shuffle(source(bucket).filter(it=>match(bucket,it))).sort((a,b)=>score(b)-score(a));
        const pick=[];
        for(const it of p){if(pick.length>=need)break;const s=sig(it);if(usedIds.has(it.id)||usedSig.has(s)||bad(it))continue;pick.push(clone(it));usedIds.add(it.id);usedFam.add(it.familyId||it.id);usedSig.add(s);}
        if(pick.length===need)round[bucket]=pick;else round[bucket]=round[bucket].filter(x=>!bad(x));
      }

      (buckets||['state','graph','maze','boss']).forEach(replace);
      const all=[];(buckets||['state','graph','maze','boss']).forEach(k=>{if(Array.isArray(round[k]))all.push(...round[k]);});
      hist[key]={ts:new Date().toISOString(),ids:all.map(x=>x.id).slice(-220),families:all.map(x=>x.familyId||x.id).slice(-220),sig:all.map(sig).slice(-220)};
      writeH(hist);
      round.noRepeat=Object.assign({},round.noRepeat||{},{hardBlockRepeat:VERSION,recentWindow:220});
      return round;
    };
    window[builderName]=bank[builderName]; bank.__hardBlockRepeatV315=true; return true;
  }

  function run(){
    const report={version:VERSION,cleanup:rebuild(),selector:{
      s3:install('AIQUEST_SEARCH3_BANK','buildSession3Round',['state','graph','maze','boss']),
      s4:install('AIQUEST_ROUTE4_BANK','buildSession4Round',['state','graph','maze','boss']),
      s5:install('AIQUEST_ASTAR5_BANK','buildSession5Round',['state','graph','maze','boss']),
      b2:install('AIQUEST_BOSS2_BANK','buildBoss2Round',['state','graph','maze','boss'])
    }};
    window.AIQUEST_HARD_BLOCK_REPEAT_REPORT=report;
    console.log('[AIQuest] '+VERSION+' applied',report);
  }
  run();
})();
