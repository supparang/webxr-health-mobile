
(function(){
  'use strict';
  const VERSION='v3.2.3-b2-specific-bank';
  const KEY='CSAI2102_AIQUEST_B2_SPECIFIC_HISTORY_V316';

  function pad(n){return String(n).padStart(3,'0');}
  function clone(o){return JSON.parse(JSON.stringify(o||{}));}
  function shuffle(a){const x=(a||[]).slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function readH(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){return{};}}
  function writeH(h){try{localStorage.setItem(KEY,JSON.stringify(h));}catch(e){}}
  function textOf(it){return String([it&&it.id,it&&it.phase,it&&it.prompt,it&&it.answer,it&&it.why,it&&it.hint].filter(Boolean).join(' | '));}
  function sig(it){return textOf(it).toLowerCase().replace(/\d+/g,'#').replace(/\s+/g,' ').slice(0,320);}
  function badB2(it){
    const t=textOf(it).toLowerCase();
    return t.includes('เลือกตาม property ของปัญหา')
      || t.includes('search arena boss')
      || t.includes('เลือก algorithm/เหตุผลที่ถูกต้อง')
      || t.includes('integrated search')
      || t.includes('b2 รวม s3-s5')
      || t.includes('expanded order คือ final path')
      || t.includes('search ทุกแบบเหมือนกัน')
      || t.includes('เห็น goal แล้วหยุดได้ทุกแบบ')
      || t.includes('b2max_')
      || t.includes('b2_max')
      || t.includes('b2_deep')
      || t.includes('b2_hard');
  }
  function pushUnique(arr,items){
    if(!Array.isArray(arr))return 0;
    const ids=new Set(arr.map(x=>x&&x.id).filter(Boolean));
    let n=0;
    (items||[]).forEach(it=>{if(!it||!it.id||ids.has(it.id))return;arr.push(it);ids.add(it.id);n++;});
    return n;
  }

  const scenarios=[
    ['S3 Search Core','bfs_unweighted','แผนที่ทุก edge มีน้ำหนักเท่ากัน ต้องหา path ที่จำนวน edge น้อยสุด','เลือก BFS เพราะ graph เป็น unweighted และ BFS สำรวจเป็นชั้น จึงเจอ path ที่ edge น้อยสุด',['เลือก DFS เพราะลงลึกก่อนจึงสั้นสุดเสมอ','เลือก UCS เพราะต้องใช้ cost แม้ทุก edge เท่ากัน','เลือก Greedy เพราะ h-only รับประกัน shortest path'],'BFS เหมาะกับ shortest path ใน unweighted graph'],
    ['S3 Search Core','dfs_memory','พื้นที่ค้นหาลึกมาก ต้องการหา solution สักทางและยอมรับว่าอาจไม่สั้นที่สุด','เลือก DFS ได้ เพราะลงลึกและใช้ memory น้อยกว่า BFS แต่ไม่รับประกัน shortest path',['เลือก BFS เสมอแม้ memory ไม่พอ','เลือก UCS ทั้งที่ไม่มี cost ต่างกัน','เลือก A* โดยไม่มี heuristic'],'DFS เหมาะบางบริบทแต่มีข้อจำกัด'],
    ['S3 Search Core','trace_path','นักศึกษาส่ง expanded order ทั้งหมดเป็น final path','ตอบว่าผิด เพราะ expanded order คือ trace ส่วน final path ต้องย้อน parent chain',['ตอบว่าถูก เพราะ expanded order คือ path เสมอ','ใช้ frontier ล่าสุดเป็น path','ใช้ visited set ทั้งหมดเป็น path'],'trace กับ path เป็นคนละสิ่ง'],
    ['S3 Search Core','neighbor_order','โจทย์กำหนด neighbor order A,B,C แต่คำตอบ BFS ขยาย C ก่อน A','ตอบว่าผิด เพราะต้องเคารพ neighbor order ที่โจทย์กำหนด',['ตอบว่าถูก เพราะ order ไม่มีผลทุกกรณี','ใช้ h ต่ำสุดแทน','final path เหมือนกันเสมอจึงไม่เป็นไร'],'neighbor order มีผลต่อ trace'],
    ['S4 Cost Search','ucs_weighted','ทาง S-A-G มี 2 edge cost รวม 20 แต่ S-B-C-G มี 3 edge cost รวม 8','เลือก UCS เพราะต้องหา path cost ต่ำสุด ไม่ใช่ path ที่ edge น้อยสุด',['เลือก BFS เพราะ edge น้อยกว่าต้องดีที่สุด','เลือก DFS เพราะเส้นทางยาวกว่า','เลือก Greedy เพราะไม่ต้องดู cost ที่เดินมา'],'weighted graph ต้อง optimize cumulative cost'],
    ['S4 Cost Search','ucs_goal_pop','UCS เห็น goal ใน frontier cost 15 แต่มี node อื่นใน frontier cost 5','ยังไม่ควรหยุด ต้อง pop node cost ต่ำสุดก่อน เพราะอาจเจอทางไป goal ที่ถูกกว่า',['หยุดทันทีเมื่อเห็น goal','เลือก goal เพราะชื่อ goal สำคัญกว่า priority','เปลี่ยนเป็น DFS เพื่อจบเร็ว'],'UCS ตอบเมื่อ goal ถูก pop ด้วย cost ต่ำสุด'],
    ['S4 Cost Search','ucs_relax','พบทางไป X เดิม cost 12 แล้วพบทางใหม่ cost 7','ต้อง update cost และ parent ของ X เป็นทาง cost 7',['เก็บ cost 12 เพราะพบก่อน','ลบ X ออกจาก graph','ไม่ต้องสน parent เพราะมี visited แล้ว'],'relax/update ทำให้ได้ path cost ต่ำกว่า'],
    ['S4 Cost Search','bfs_vs_ucs','มีคนบอกว่า BFS กับ UCS เหมือนกันในทุก weighted graph','ไม่ถูก BFS นับจำนวน edge ส่วน UCS ใช้ cumulative cost',['ถูก เพราะทั้งคู่มี frontier','ถูกเมื่อมี goal เดียว','DFS คือ UCS แบบเร็วกว่า'],'BFS/UCS ต่างกันเมื่อ edge cost ไม่เท่ากัน'],
    ['S5 Heuristic Search','astar_formula','A มี g=4,h=3 และ B มี g=2,h=6 ใน A* ควรเลือกอะไร','เลือก A เพราะ f(A)=7 ต่ำกว่า f(B)=8',['เลือก B เพราะ g ต่ำกว่า','เลือก B เพราะ h สูงกว่า','สุ่มได้เพราะยังไม่ใช่ goal'],'A* เลือกตาม f(n)=g(n)+h(n)'],
    ['S5 Heuristic Search','greedy_vs_astar','ระบบเลือก node ที่ h(n) ต่ำสุดอย่างเดียวโดยไม่สน cost ที่เดินมา','นี่คือ Greedy Best-First มากกว่า A* เพราะ A* ต้องใช้ g(n)+h(n)',['นี่คือ A* แน่นอนเพราะมี heuristic','นี่คือ UCS เพราะมี frontier','นี่คือ BFS เพราะเลือกทีละ node'],'Greedy h-only ต่างจาก A*'],
    ['S5 Heuristic Search','admissible','heuristic ประเมินระยะไป goal สูงกว่าความจริงหลายครั้ง','heuristic นี้ไม่ admissible และอาจทำให้ A* เสีย optimality',['ยิ่งประเมินสูงยิ่ง optimal','ทำให้ A* กลายเป็น BFS','ทำให้ไม่ต้องใช้ g(n)'],'admissible heuristic ต้องไม่ overestimate'],
    ['S5 Heuristic Search','astar_tie','A* มี node สองตัว f เท่ากัน และโจทย์ให้ tie-break ด้วย h ต่ำกว่า','เลือก node ที่ h ต่ำกว่า เพราะต้องทำตาม tie-break ที่โจทย์กำหนด',['สุ่มได้เสมอเพราะ f เท่ากัน','เลือก node ที่ชื่อยาวกว่า','หยุด search ทันที'],'tie-break ทำให้ trace ตรวจได้'],
    ['Final Search Duel','city_ucs','ระบบนำทางในเมือง ถนนมีระยะจริงต่างกัน แต่ยังไม่มี heuristic','เลือก UCS เพราะ edge มี cost ต่างกันและต้องหา cumulative cost ต่ำสุด',['เลือก BFS เพราะทุกถนนคือ edge หนึ่งเส้น','เลือก DFS เพราะมีหลายซอย','เลือก Greedy เพราะไม่มี heuristic ก็ยังใช้ h ได้'],'weighted ไม่มี heuristic → UCS'],
    ['Final Search Duel','route_astar','ระบบนำทางมีระยะที่เดินมาแล้วและระยะเส้นตรงประมาณถึง goal','เลือก A* เพราะใช้ g(n) จากระยะที่เดินมาแล้วรวมกับ h(n) ที่ประมาณถึง goal',['เลือก Greedy เพราะไม่ต้องดูระยะที่เดินมา','เลือก BFS เพราะแผนที่มี node','เลือก DFS เพราะลงลึกได้เร็ว'],'มี cost + heuristic → A*'],
    ['Final Search Duel','wrong_stop','ใน UCS/A* นักศึกษาหยุดทันทีเมื่อ goal ถูกเพิ่มเข้า frontier','เตือนว่าอาจหยุดเร็วเกิน ต้องพิจารณาตาม priority จน goal ถูกเลือกออกมาอย่างถูกเงื่อนไข',['ถูกเสมอเมื่อเห็น goal','goal ไม่ควรถูกใช้เลย','ควรลบ frontier ทั้งหมด'],'goal discovery ไม่เท่ากับ goal selected/popped'],
    ['Final Search Duel','settled_order','รายงาน settled order เป็น optimal path','ผิด settled/expanded order คือการลำดับประมวลผล ไม่ใช่ path สุดท้าย',['ถูก เพราะ settled order คือ path เสมอ','ถูกถ้าใช้ heuristic','ถูกถ้า cost ทุก edge เป็นบวก'],'settled order กับ optimal path ต่างกัน']
  ];

  const variants=['กรณีแผนที่มหาวิทยาลัย','กรณีเกม maze','กรณีหุ่นยนต์ส่งของ','กรณีระบบนำทางในอาคาร','กรณี web crawler','กรณี puzzle search','กรณี warehouse route','กรณี emergency exit'];

  function makeBank(){
    const items=[];
    for(let i=0;i<34;i++){
      scenarios.forEach((s,j)=>items.push({
        id:`b2_specific_${pad(i)}_${pad(j)}`,
        familyId:`b2_specific_${s[1]}_${i%34}`,
        phase:s[0],
        prompt:`${variants[i%variants.length]}: ${s[2]}`,
        answer:s[3],
        distractors:s[4],
        why:s[5],
        hint:s[1],
        context:`B2 specific scenario ${i+1}`
      }));
    }
    return items;
  }

  function rebuildB2(){
    const bank=window.AIQUEST_BOSS2_BANK;
    if(!bank||!Array.isArray(bank.ITEMS))return null;
    const before=bank.ITEMS.length;
    for(let i=bank.ITEMS.length-1;i>=0;i--){
      if(badB2(bank.ITEMS[i])) bank.ITEMS.splice(i,1);
    }
    const afterStrip=bank.ITEMS.length;
    const added=pushUnique(bank.ITEMS,makeBank());
    bank.counts={
      total:bank.ITEMS.length,
      s3:bank.ITEMS.filter(x=>x.phase==='S3 Search Core').length,
      s4:bank.ITEMS.filter(x=>x.phase==='S4 Cost Search').length,
      s5:bank.ITEMS.filter(x=>x.phase==='S5 Heuristic Search').length,
      final:bank.ITEMS.filter(x=>x.phase==='Final Search Duel').length
    };
    return {before,afterStrip,added,counts:bank.counts};
  }

  function installB2Builder(){
    const bank=window.AIQUEST_BOSS2_BANK;
    if(!bank||typeof bank.buildBoss2Round!=='function'||bank.__b2SpecificV316)return false;
    const original=bank.buildBoss2Round;
    bank.buildBoss2Round=function(diff){
      const oldRound=original.call(bank,diff);
      const need={
        state:Array.isArray(oldRound.state)?oldRound.state.length:3,
        graph:Array.isArray(oldRound.graph)?oldRound.graph.length:3,
        maze:Array.isArray(oldRound.maze)?oldRound.maze.length:3,
        boss:Array.isArray(oldRound.boss)?oldRound.boss.length:3
      };
      const hist=readH(), key='b2_'+(diff||'normal'), r=hist[key]||{};
      const recentIds=new Set(r.ids||[]), recentFam=new Set(r.families||[]), recentSig=new Set(r.sig||[]);
      const usedIds=new Set(), usedFam=new Set(), usedSig=new Set();

      function pick(phase,count){
        const pool=shuffle((bank.ITEMS||[]).filter(it=>it.phase===phase&&!badB2(it)));
        pool.sort((a,b)=>{
          function score(it){
            const s=sig(it);
            let v=100+Math.random()*30;
            if(String(it.id||'').includes('b2_specific'))v+=90;
            if(recentIds.has(it.id))v-=150;
            if(recentFam.has(it.familyId))v-=120;
            if(recentSig.has(s))v-=220;
            if(usedIds.has(it.id)||usedSig.has(s))v-=999;
            if(usedFam.has(it.familyId))v-=160;
            return v;
          }
          return score(b)-score(a);
        });
        const out=[];
        for(const it of pool){
          if(out.length>=count)break;
          const s=sig(it);
          if(usedIds.has(it.id)||usedSig.has(s)||badB2(it))continue;
          out.push(clone(it));
          usedIds.add(it.id);usedFam.add(it.familyId||it.id);usedSig.add(s);
        }
        return out;
      }

      const round=Object.assign({},oldRound);
      round.state=pick('S3 Search Core',need.state);
      round.graph=pick('S4 Cost Search',need.graph);
      round.maze=pick('S5 Heuristic Search',need.maze);
      round.boss=pick('Final Search Duel',need.boss);
      const all=[...round.state,...round.graph,...round.maze,...round.boss];
      hist[key]={ts:new Date().toISOString(),ids:all.map(x=>x.id).slice(-260),families:all.map(x=>x.familyId||x.id).slice(-260),sig:all.map(sig).slice(-260)};
      writeH(hist);
      round.noRepeat=Object.assign({},round.noRepeat||{},{b2SpecificVersion:VERSION,recentWindow:260});
      return round;
    };
    window.buildBoss2Round=bank.buildBoss2Round;
    bank.__b2SpecificV316=true;
    return true;
  }

  function run(){
    const report={version:VERSION,rebuildB2:rebuildB2(),builderInstalled:installB2Builder()};
    window.AIQUEST_B2_SPECIFIC_REPORT=report;
    console.log('[AIQuest] '+VERSION+' applied',report);
  }
  run();
})();
