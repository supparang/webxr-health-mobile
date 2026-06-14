
(function(){
  'use strict';

  const VERSION='v3.2.5-deep-anti-repeat';
  const HISTORY_KEY='CSAI2102_AIQUEST_DEEP_HISTORY_V314';

  function pad(n){return String(n).padStart(3,'0');}
  function clone(o){return JSON.parse(JSON.stringify(o||{}));}
  function shuffle(a){const x=(a||[]).slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function pushUnique(arr,items){if(!Array.isArray(arr))return 0;const ids=new Set(arr.map(x=>x&&x.id).filter(Boolean));let n=0;(items||[]).forEach(it=>{if(!it||!it.id||ids.has(it.id))return;arr.push(it);ids.add(it.id);n++;});return n;}
  function readHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}')||{};}catch(e){return {};}}
  function writeHistory(h){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h));}catch(e){}}
  function textOf(it){return String([it&&it.prompt,it&&it.label,it&&it.stem,it&&it.claim,it&&it.answer,it&&it.correct,it&&it.why].filter(Boolean).join(' | '));}
  function sig(it){return textOf(it).toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ').slice(0,260);}
  function isBadGeneric(it){
    const t=textOf(it).toLowerCase();
    return t.includes('max drill')
      || t.includes('เลือกคำตอบที่ตรงหลักการที่สุด')
      || t.includes('ตรวจ algorithm, frontier structure, visited')
      || t.includes('ตอบโดยอิงหลักการ ไม่ใช่จำคำสำคัญ')
      || t.includes('เลือก algorithm/เหตุผลที่ถูกต้อง')
      || t.includes('max question banks');
  }
  function removeBadGeneric(arr){
    if(!Array.isArray(arr)) return {removed:0};
    const before=arr.length;
    for(let i=arr.length-1;i>=0;i--){
      const it=arr[i]||{};
      if(String(it.id||'').includes('_max_') && isBadGeneric(it)) arr.splice(i,1);
    }
    return {removed:before-arr.length};
  }

  const s3Templates=[
    ['BFS/DFS Trace','bfs_queue','Graph มี start S และ neighbor order ซ้าย→ขวา ถ้าใช้ BFS ต้องเลือก node จาก frontier อย่างไร?','เลือก node ที่เข้าคิวก่อนออกก่อนแบบ FIFO และสำรวจเป็นชั้น',['เลือก node ล่าสุดแบบ stack','เลือก h(n) ต่ำสุด','เลือก cost รวมต่ำสุด'],'BFS ใช้ queue/FIFO จึงต่างจาก DFS/UCS/A*'],
    ['BFS/DFS Trace','dfs_stack','ถ้า DFS เดินลง branch แรกจนตันแล้วถอยกลับ ข้อใดคือหลักที่ถูก?','ใช้ stack/recursion แบบ LIFO และ backtrack เมื่อไปต่อไม่ได้',['ใช้ queue แบบ FIFO','เลือก cost ต่ำสุด','เลือก heuristic ต่ำสุด'],'DFS เน้นลงลึกก่อน ไม่ได้ optimize shortest path'],
    ['Frontier Debug','frontier','node ที่ค้นพบแล้วแต่ยังไม่ถูก expand เรียกว่าอะไร?','frontier/open list คือ candidate ที่รอเลือกมา expand',['visited set ที่ expand แล้ว','final path จาก start ถึง goal','heuristic table'],'frontier ยังรอเลือก ส่วน visited คือ expand แล้ว'],
    ['Trace Error Debug','visited','ใน graph ที่มี cycle ถ้าไม่ใช้ visited/closed set จะเกิดอะไร?','อาจ expand state ซ้ำหรือวน loop ทำให้ trace ผิด',['heuristic จะดีขึ้น','path จะสั้นสุดเสมอ','weighted graph จะกลายเป็น unweighted'],'visited ช่วยกัน repeated state/cycle'],
    ['Maze Path','path_trace','เหตุใด expanded order ไม่ใช่ final path เสมอ?','final path ต้องย้อน parent chain จาก goal กลับไป start',['final path คือทุก node ที่ visited','final path คือ frontier ล่าสุด','final path คือ node ที่ชื่อเรียง alphabet'],'trace คือประวัติการ expand แต่ path คือ parent chain'],
    ['Trace Error Debug','neighbor_order','ถ้าโจทย์กำหนด neighbor order เป็น A ก่อน B แต่ขยาย B ก่อน จะเกิดอะไร?','trace อาจผิด เพราะ BFS/DFS ต้องเคารพ neighbor order ที่โจทย์กำหนด',['ไม่มีผลในทุกกรณี','ทำให้ A* optimal ขึ้น','ทำให้ edge cost เปลี่ยน'],'tie/order มีผลต่อ expanded order และ path ที่พบก่อน'],
    ['State Space','state','ในปัญหา maze state ที่เหมาะสมควรแทนด้วยอะไร?','ตำแหน่งปัจจุบันของ agent และข้อมูลที่จำเป็นต่อการตัดสินใจ',['คะแนนรวมของผู้เล่น','สีของ UI','จำนวนครั้งที่กดปุ่ม'],'state ต้องอธิบายสถานการณ์ของปัญหา'],
    ['State Space','goal_test','goal test ต่างจาก action อย่างไร?','goal test ตรวจว่าสถานะปัจจุบันบรรลุเป้าหมายหรือไม่ ส่วน action เปลี่ยน state',['goal test คือการสุ่ม action','action คือคำตอบสุดท้ายเท่านั้น','สองอย่างเหมือนกันทุกกรณี'],'ต้องแยก component ของ search problem']
  ];
  const s4Templates=[
    ['Cost Concept','ucs_priority','ใน UCS frontier ควรจัดลำดับด้วยค่าใด?','ค่า g(n) หรือ cumulative cost จาก start ถึง node',['จำนวน edge เท่านั้น','heuristic h(n) เท่านั้น','ชื่อ node ตาม alphabet'],'UCS ใช้ priority queue ตาม cost สะสม'],
    ['UCS Trace','goal_pop','ทำไม UCS ไม่ควรตอบทันทีตอนเห็น goal เป็น neighbor ครั้งแรก?','ต้องรอให้ goal ถูก pop ด้วย cost ต่ำสุดจาก priority queue ก่อน',['เพราะ UCS ไม่ใช้ goal test','เพราะ goal ต้องถูก visited ทุกครั้ง','เพราะ BFS ดีกว่าเสมอ'],'weighted graph อาจมีเส้นทางไป goal ที่ถูกกว่ารออยู่'],
    ['Frontier Cost','relax','ถ้าพบทางไป node X ใหม่ที่ cost ต่ำกว่าเดิมควรทำอย่างไร?','update cost และ parent ของ X ใน frontier',['ทิ้งทางใหม่เสมอ','เก็บทั้งสองโดยไม่เทียบ cost','เปลี่ยนเป็น DFS'],'นี่คือการปรับเส้นทางที่ถูกกว่า'],
    ['BFS vs UCS','weighted','เหตุใด BFS อาจไม่เหมาะกับ weighted graph?','BFS ลดจำนวน edge แต่ไม่รับประกัน cumulative cost ต่ำสุด',['BFS ไม่มี frontier','BFS ใช้ h(n) มากเกินไป','BFS ใช้ negative edge เท่านั้น'],'UCS จำเป็นเมื่อ edge cost ต่างกัน'],
    ['Optimal Path','parent_cost','เมื่อ UCS ได้ goal แล้ว path ที่ถูกต้องสร้างจากอะไร?','ย้อน parent chain ของ node ที่มี cost ต่ำสุดจนถึง start',['ใช้ expanded order ทั้งหมด','ใช้ node ใน frontier ทั้งหมด','ใช้ path ที่มี node น้อยสุดเสมอ'],'parent chain เก็บเส้นทางดีที่สุดที่พบ']
  ];
  const s5Templates=[
    ['A* Concept','formula','A* ใช้ค่าใดในการเลือก node จาก frontier?','f(n)=g(n)+h(n)',['h(n) อย่างเดียว','g(n) อย่างเดียวทุกกรณี','จำนวน edge อย่างเดียว'],'A* รวม cost ที่เดินมาแล้วกับ estimate ที่เหลือ'],
    ['A* vs Greedy','greedy','A* ต่างจาก Greedy Best-First อย่างไร?','A* ใช้ g(n)+h(n) ส่วน Greedy ใช้ h(n) เป็นหลัก',['A* ใช้ h(n) อย่างเดียวเหมือนกัน','Greedy ใช้ g(n)+h(n) เสมอ','ทั้งสองคือ DFS'],'นี่คือ misconception หลักของ heuristic search'],
    ['Heuristic Debug','overestimate','ถ้า heuristic overestimate cost จริง อาจเกิดผลอะไรกับ A*?','อาจเสีย optimality เพราะประเมินทางที่ดีแพงเกินจริง',['รับประกัน optimal มากขึ้น','กลายเป็น BFS ทันที','ทำให้ไม่ต้องใช้ g(n)'],'admissible heuristic ไม่ควร overestimate'],
    ['A* Path','parent','A* พบ goal แล้วจะรายงานเส้นทางอย่างไรให้ถูก?','ใช้ parent chain ของ goal ไม่ใช่ expanded order ทั้งหมด',['ใช้ทุก node ที่เคยถูก expand','ใช้ frontier ล่าสุด','เรียง node ตาม f จากมากไปน้อย'],'path กับ trace เป็นคนละสิ่ง'],
    ['A* Trace','tiebreak','เมื่อ node สองตัวมี f(n) เท่ากันควรทำอย่างไร?','ใช้ tie-break ที่โจทย์กำหนด เช่น h ต่ำกว่า หรือ order ที่ระบุ',['สุ่มเสมอโดยไม่บอก','เลือก node ที่มีชื่อยาวกว่า','หยุด search ทันที'],'tie-break ทำให้ trace ตรวจได้']
  ];
  const b2Templates=[
    ['S3 Search Core','unweighted','ถ้า graph ไม่มี weight และต้องการ shortest path ตามจำนวน edge ควรเลือกอะไร?','BFS เพราะสำรวจเป็นชั้นและเหมาะกับ unweighted shortest path',['DFS เพราะลงลึกก่อนจึงสั้นสุดเสมอ','UCS โดยไม่สน cost','Greedy เพราะเร็วกว่าเสมอ'],'เลือก algorithm จาก property ของปัญหา'],
    ['S4 Cost Search','weighted','ถ้า edge cost ไม่เท่ากันและไม่มี heuristic ควรเลือกอะไร?','UCS เพราะเลือก frontier ด้วย cumulative cost g(n)',['BFS เสมอ','DFS เสมอ','Greedy ด้วย h(n)'],'weighted graph ต้อง optimize cost'],
    ['S5 Heuristic Search','heuristic','ถ้ามี heuristic ที่เชื่อถือได้และต้องการหาเส้นทาง cost ต่ำควรใช้อะไร?','A* โดยใช้ f(n)=g(n)+h(n)',['Greedy h-only รับประกัน optimal เสมอ','DFS เพราะ memory น้อยจึง optimal','BFS โดยไม่สน weight'],'A* รวม cost จริงกับ estimate'],
    ['Final Search Duel','trace_path','ข้อใดถูกต้องเมื่อเปรียบเทียบ trace และ final path?','trace คือ order การ expand ส่วน final path คือเส้นทางที่ย้อนจาก parent chain',['สองอย่างเหมือนกันเสมอ','trace คือ heuristic table','final path คือทุก node ใน frontier'],'สรุป misconception จาก S3-S5'],
    ['Final Search Duel','goal_timing','เห็น goal ใน frontier แล้ว algorithm ใดต้องระวังไม่หยุดเร็วเกิน?','UCS/A* ต้องระวัง เงื่อนไขปกติคือ goal ถูกเลือกออกจาก frontier ตาม priority แล้ว',['ทุก algorithm ต้องหยุดทันทีเมื่อเห็น goal','DFS รับประกัน optimal เสมอ','BFS ไม่ต้องมี goal test'],'goal discovery กับ goal expansion ไม่เหมือนกัน']
  ];

  function makeItems(prefix,templates,copies){
    const variants=['กรณีแผนที่มหาวิทยาลัย','กรณี maze ในเกม','กรณี robot delivery','กรณี web navigation','กรณี route planner','กรณี puzzle state'];
    const items=[];
    for(let i=0;i<copies;i++){
      templates.forEach((t,j)=>{
        items.push({id:`${prefix}_${pad(i)}_${pad(j)}`,familyId:`${prefix}_${t[1]}_${i%80}`,phase:t[0],prompt:`${variants[i%variants.length]}: ${t[2]}`,context:`variant ${i+1} • ${t[1]}`,answer:t[3],distractors:t[4],why:t[5],hint:t[1]});
      });
    }
    return items;
  }

  function rebuildS3(){const b=window.AIQUEST_SEARCH3_BANK;if(!b)return null;removeBadGeneric(b.GRAPH_ITEMS);removeBadGeneric(b.STATE_ITEMS);removeBadGeneric(b.BOSS_CLAIMS);const added=pushUnique(b.GRAPH_ITEMS,makeItems('s3_deep',s3Templates,55));b.counts={state:(b.STATE_ITEMS||[]).length,graph:(b.GRAPH_ITEMS||[]).length,boss:(b.BOSS_CLAIMS||[]).length,total:(b.STATE_ITEMS||[]).length+(b.GRAPH_ITEMS||[]).length+(b.BOSS_CLAIMS||[]).length};return{added,counts:b.counts};}
  function rebuildS4(){const b=window.AIQUEST_ROUTE4_BANK;if(!b)return null;removeBadGeneric(b.GRAPH_ITEMS);removeBadGeneric(b.CONCEPT_ITEMS);removeBadGeneric(b.BOSS_CLAIMS);const added=pushUnique(b.GRAPH_ITEMS,makeItems('s4_deep',s4Templates,60));b.counts={concept:(b.CONCEPT_ITEMS||[]).length,graph:(b.GRAPH_ITEMS||[]).length,boss:(b.BOSS_CLAIMS||[]).length,total:(b.CONCEPT_ITEMS||[]).length+(b.GRAPH_ITEMS||[]).length+(b.BOSS_CLAIMS||[]).length};return{added,counts:b.counts};}
  function rebuildS5(){const b=window.AIQUEST_ASTAR5_BANK;if(!b)return null;removeBadGeneric(b.GRAPH_ITEMS);removeBadGeneric(b.CONCEPT_ITEMS);removeBadGeneric(b.BOSS_CLAIMS);const added=pushUnique(b.GRAPH_ITEMS,makeItems('s5_deep',s5Templates,60));b.counts={concept:(b.CONCEPT_ITEMS||[]).length,graph:(b.GRAPH_ITEMS||[]).length,boss:(b.BOSS_CLAIMS||[]).length,total:(b.CONCEPT_ITEMS||[]).length+(b.GRAPH_ITEMS||[]).length+(b.BOSS_CLAIMS||[]).length};return{added,counts:b.counts};}
  function rebuildB2(){const b=window.AIQUEST_BOSS2_BANK;if(!b)return null;removeBadGeneric(b.ITEMS);const added=pushUnique(b.ITEMS,makeItems('b2_deep',b2Templates,80));b.counts={total:(b.ITEMS||[]).length,s3:b.ITEMS.filter(x=>x.phase==='S3 Search Core').length,s4:b.ITEMS.filter(x=>x.phase==='S4 Cost Search').length,s5:b.ITEMS.filter(x=>x.phase==='S5 Heuristic Search').length,final:b.ITEMS.filter(x=>x.phase==='Final Search Duel').length};return{added,counts:b.counts};}

  function installDeepSelector(globalName,builderName,buckets){
    const b=window[globalName]; if(!b||typeof b[builderName]!=='function'||b.__deepAntiRepeatV314)return false;
    const original=b[builderName];
    b[builderName]=function(diff){
      const round=original.call(b,diff);
      const hist=readHistory(); const key=globalName+'_'+(diff||'normal'); const r=hist[key]||{};
      const recentIds=new Set(r.ids||[]), recentFam=new Set(r.families||[]), recentSig=new Set(r.sig||[]);
      const usedIds=new Set(), usedFam=new Set(), usedSig=new Set();
      function pool(bucket){
        if(globalName==='AIQUEST_SEARCH3_BANK'){if(bucket==='state')return b.STATE_ITEMS||[];if(bucket==='boss')return b.BOSS_CLAIMS||[];return b.GRAPH_ITEMS||[];}
        if(globalName==='AIQUEST_ROUTE4_BANK'){if(bucket==='state')return b.CONCEPT_ITEMS||[];if(bucket==='boss')return b.BOSS_CLAIMS||[];return b.GRAPH_ITEMS||[];}
        if(globalName==='AIQUEST_ASTAR5_BANK'){if(bucket==='state')return b.CONCEPT_ITEMS||[];if(bucket==='boss')return b.BOSS_CLAIMS||[];return b.GRAPH_ITEMS||[];}
        if(globalName==='AIQUEST_BOSS2_BANK')return b.ITEMS||[];return [];
      }
      function wanted(bucket,it){
        if(!it||isBadGeneric(it))return false;
        if(globalName==='AIQUEST_SEARCH3_BANK'){if(bucket==='maze')return it.phase==='Maze Path';if(bucket==='graph')return ['BFS/DFS Trace','Frontier Debug','Trace Error Debug'].includes(it.phase);}
        if(globalName==='AIQUEST_ROUTE4_BANK'){if(bucket==='maze')return ['Optimal Path','BFS vs UCS'].includes(it.phase);if(bucket==='graph')return ['UCS Trace','Frontier Cost'].includes(it.phase);}
        if(globalName==='AIQUEST_ASTAR5_BANK'){if(bucket==='maze')return ['A* Path','A* vs Greedy'].includes(it.phase);if(bucket==='graph')return ['A* Trace','Heuristic Debug'].includes(it.phase);}
        return true;
      }
      function score(it){const s=sig(it);let v=100+Math.random()*20;if(recentIds.has(it.id))v-=90;if(recentFam.has(it.familyId))v-=65;if(recentSig.has(s))v-=110;if(usedIds.has(it.id))v-=999;if(usedFam.has(it.familyId))v-=85;if(usedSig.has(s))v-=999;if(String(it.id||'').includes('_deep'))v+=25;return v;}
      function replace(bucket){
        if(!Array.isArray(round[bucket])||!round[bucket].length)return;
        const need=round[bucket].length;
        const p=shuffle(pool(bucket).filter(it=>wanted(bucket,it))).sort((a,b)=>score(b)-score(a));
        const picked=[];
        for(const it of p){if(picked.length>=need)break;const s=sig(it);if(usedIds.has(it.id)||usedSig.has(s))continue;picked.push(clone(it));usedIds.add(it.id);usedFam.add(it.familyId||it.id);usedSig.add(s);}
        if(picked.length===need)round[bucket]=picked;
      }
      (buckets||['state','graph','maze','boss']).forEach(replace);
      const all=[];(buckets||['state','graph','maze','boss']).forEach(k=>{if(Array.isArray(round[k]))all.push(...round[k]);});
      hist[key]={ts:new Date().toISOString(),ids:all.map(x=>x.id).slice(-140),families:all.map(x=>x.familyId||x.id).slice(-140),sig:all.map(sig).slice(-140)};writeHistory(hist);
      round.noRepeat=Object.assign({},round.noRepeat||{},{deepAntiRepeat:VERSION,recentWindow:140});
      return round;
    };
    window[builderName]=b[builderName]; b.__deepAntiRepeatV314=true; return true;
  }

  function run(){
    const report={version:VERSION,cleanup:{s3:rebuildS3(),s4:rebuildS4(),s5:rebuildS5(),b2:rebuildB2()},selector:{s3:installDeepSelector('AIQUEST_SEARCH3_BANK','buildSession3Round',['state','graph','maze','boss']),s4:installDeepSelector('AIQUEST_ROUTE4_BANK','buildSession4Round',['state','graph','maze','boss']),s5:installDeepSelector('AIQUEST_ASTAR5_BANK','buildSession5Round',['state','graph','maze','boss']),b2:installDeepSelector('AIQUEST_BOSS2_BANK','buildBoss2Round',['state','graph','maze','boss'])}};
    window.AIQUEST_DEEP_ANTI_REPEAT_REPORT=report; console.log('[AIQuest] '+VERSION+' applied',report);
  }
  run();
})();
