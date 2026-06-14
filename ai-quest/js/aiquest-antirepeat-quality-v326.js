
(function(){
  'use strict';
  const VERSION='v3.2.6-anti-repeat-quality';
  const HISTORY_KEY='CSAI2102_AIQUEST_QUESTION_HISTORY_V312';
  function pad(n){return String(n).padStart(3,'0');}
  function shuffle(a){const x=a.slice();for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
  function pushUnique(arr,items){if(!Array.isArray(arr))return 0;const ids=new Set(arr.map(x=>x&&x.id).filter(Boolean));let n=0;items.forEach(it=>{if(!it||!it.id||ids.has(it.id))return;arr.push(it);ids.add(it.id);n++;});return n;}
  function sig(it){return [it&&it.prompt,it&&it.label,it&&it.stem,it&&it.claim,it&&it.answer,it&&it.correct].filter(Boolean).join(' | ').slice(0,220);}
  function hist(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}')||{};}catch(e){return{};}}
  function saveHist(h){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h));}catch(e){}}
  function addS3Quality(){
    const b=window.AIQUEST_SEARCH3_BANK;if(!b||!Array.isArray(b.GRAPH_ITEMS))return null;
    const drills=[
      ['BFS','BFS/DFS Trace','ใช้ queue/FIFO สำรวจเป็นชั้น','ใช้ stack/LIFO ลงลึกก่อน','ใช้ h(n) ต่ำสุด','ใช้ g(n)+h(n)'],
      ['DFS','BFS/DFS Trace','ใช้ stack/recursion ลงลึกก่อนแล้ว backtrack','ใช้ queue/FIFO สำรวจเป็นชั้น','ใช้ cost ต่ำสุด','ใช้ heuristic อย่างเดียว'],
      ['FRONTIER','Frontier Debug','frontier คือ node ที่รอ expand และต้องดูโครงสร้าง queue/stack','frontier คือ final path','frontier คือ visited ทั้งหมด','เลือก goal ทันทีเมื่อเห็น'],
      ['VISITED','Trace Error Debug','visited กัน repeated state และ cycle ไม่ใช่คำตอบสุดท้าย','ไม่ต้องใช้ visited ถ้ามี goal','visited คือ heuristic','visited คือ frontier ล่าสุด'],
      ['PATH','Maze Path','final path ต้องย้อน parent chain จาก goal ไป start','expanded order ทั้งหมดคือ path','frontier ล่าสุดคือ path','ทุก node ใน graph คือ path'],
      ['ORDER','Trace Error Debug','neighbor order มีผลต่อ trace จึงต้องตาม order ที่โจทย์กำหนด','neighbor order ไม่มีผลใด ๆ','สุ่ม order ได้','sort เองได้เสมอ']
    ];
    const items=[];
    for(let i=0;i<360;i++){
      const d=drills[i%drills.length];
      const scenario=['maze grid','map graph','robot route','campus path','web navigation','puzzle state'][Math.floor(i/drills.length)%6];
      items.push({id:`s3_quality_${pad(i)}`,familyId:`s3_quality_${d[0]}_${i%90}`,phase:d[1],prompt:`${scenario} Drill ${i+1}: ข้อใดตรงหลัก ${d[0]} มากที่สุด?`,context:'ระวังสับสน visited order, frontier และ final path',answer:d[2],distractors:[d[3],d[4],d[5]],why:`จุดวัดคือ ${d[0]} ไม่ใช่การจำประโยคซ้ำ`,hint:d[0]==='BFS'?'BFS=queue':d[0]==='DFS'?'DFS=stack':'แยก trace/path/frontier'});
    }
    const added=pushUnique(b.GRAPH_ITEMS,items);
    b.counts={state:(b.STATE_ITEMS||[]).length,graph:(b.GRAPH_ITEMS||[]).length,boss:(b.BOSS_CLAIMS||[]).length,total:(b.STATE_ITEMS||[]).length+(b.GRAPH_ITEMS||[]).length+(b.BOSS_CLAIMS||[]).length};
    return {added,counts:b.counts};
  }
  function install(globalName,builderName,buckets){
    const b=window[globalName]; if(!b||typeof b[builderName]!=='function'||b.__antiRepeatV312)return false;
    const orig=b[builderName];
    b[builderName]=function(diff){
      const r=orig.call(b,diff); const h=hist(); const key=globalName+'_'+(diff||'normal');
      const recent=h[key]||{}; const rid=new Set(recent.ids||[]), rfam=new Set(recent.families||[]), rsig=new Set(recent.sig||[]);
      const uid=new Set(), ufam=new Set(), usig=new Set();
      function pool(bucket){
        if(globalName==='AIQUEST_SEARCH3_BANK'){if(bucket==='state')return b.STATE_ITEMS||[]; if(bucket==='boss')return b.BOSS_CLAIMS||[]; return b.GRAPH_ITEMS||[];}
        if(globalName==='AIQUEST_ROUTE4_BANK'||globalName==='AIQUEST_ASTAR5_BANK'){if(bucket==='state')return b.CONCEPT_ITEMS||[]; if(bucket==='boss')return b.BOSS_CLAIMS||[]; return b.GRAPH_ITEMS||[];}
        if(globalName==='AIQUEST_BOSS2_BANK')return b.ITEMS||[]; return [];
      }
      function match(bucket,it){
        if(!it)return true;
        if(globalName==='AIQUEST_SEARCH3_BANK'){if(bucket==='maze')return it.phase==='Maze Path'; if(bucket==='graph')return it.phase!=='Maze Path';}
        if(globalName==='AIQUEST_ROUTE4_BANK'){if(bucket==='maze')return it.phase==='Optimal Path'||it.phase==='BFS vs UCS'; if(bucket==='graph')return it.phase==='UCS Trace'||it.phase==='Frontier Cost';}
        if(globalName==='AIQUEST_ASTAR5_BANK'){if(bucket==='maze')return it.phase==='A* Path'||it.phase==='A* vs Greedy'; if(bucket==='graph')return it.phase==='A* Trace'||it.phase==='Heuristic Debug';}
        return true;
      }
      function score(it){let s=100+Math.random()*10, sg=sig(it); if(rid.has(it.id))s-=80; if(rfam.has(it.familyId))s-=55; if(rsig.has(sg))s-=90; if(uid.has(it.id)||usig.has(sg))s-=999; if(ufam.has(it.familyId))s-=70; return s;}
      function replaceBucket(bucket){
        if(!Array.isArray(r[bucket])||!r[bucket].length)return; const need=r[bucket].length;
        const candidates=shuffle(pool(bucket).filter(it=>match(bucket,it))).sort((a,b)=>score(b)-score(a)); const out=[];
        for(const it of candidates){if(out.length>=need)break; const sg=sig(it); if(uid.has(it.id)||usig.has(sg))continue; out.push(JSON.parse(JSON.stringify(it))); uid.add(it.id); ufam.add(it.familyId||it.id); usig.add(sg);}
        if(out.length===need)r[bucket]=out;
      }
      (buckets||['state','graph','maze','boss']).forEach(replaceBucket);
      const all=[];(buckets||['state','graph','maze','boss']).forEach(k=>{if(Array.isArray(r[k]))all.push(...r[k]);});
      h[key]={ts:new Date().toISOString(),ids:all.map(x=>x.id).filter(Boolean).slice(-80),families:all.map(x=>x.familyId||x.id).filter(Boolean).slice(-80),sig:all.map(sig).filter(Boolean).slice(-80)}; saveHist(h);
      r.noRepeat=Object.assign({},r.noRepeat||{},{antiRepeatVersion:VERSION,historyKey:HISTORY_KEY,recentWindow:80,itemIds:all.map(x=>x.id).filter(Boolean),familyIds:all.map(x=>x.familyId||x.id).filter(Boolean)});
      return r;
    };
    window[builderName]=b[builderName]; b.__antiRepeatV312=true; return true;
  }
  function run(){const report={version:VERSION,s3Quality:addS3Quality(),antiRepeat:{s3:install('AIQUEST_SEARCH3_BANK','buildSession3Round',['state','graph','maze','boss']),s4:install('AIQUEST_ROUTE4_BANK','buildSession4Round',['state','graph','maze','boss']),s5:install('AIQUEST_ASTAR5_BANK','buildSession5Round',['state','graph','maze','boss']),b2:install('AIQUEST_BOSS2_BANK','buildBoss2Round',['state','graph','maze','boss'])}}; window.AIQUEST_ANTI_REPEAT_REPORT=report; console.log('[AIQuest] '+VERSION+' applied',report);}
  run();
})();
