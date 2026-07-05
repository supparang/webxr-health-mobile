/* CSAI2102 AI Quest — Maximum Replay Deck Factory v6.5.2
   Builds genuinely different case forms, not merely shuffled order.
   Normal Deck: 15 cases. Boss Deck: 18 cases. No-repeat window: 4 decks.
*/
(()=>{'use strict';
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const KEY='CSAI2102_CORE3_REPLAY_DECKS_V650';
  const WINDOW=4;
  const copy=v=>Array.isArray(v)?v.slice():[];
  const shuffle=a=>{const x=[...(a||[])];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
  const bank=()=>MID==='s1'?window.AIQuestS1ThaiV646:(window.AIQuestCoreThaiBanksV646||{})[MID];
  const contexts={
    s1:['โรงเรียนอัจฉริยะ','ห้องสมุดดิจิทัล','ศูนย์บริการชุมชน','คลินิกมหาวิทยาลัย','ร้านค้าปลีก','ระบบรถรับส่งมหาวิทยาลัย'],
    s2:['หุ่นยนต์ส่งยา','รถรับส่งอัตโนมัติ','รถเข็นห้องสมุด','โดรนส่งเอกสาร','ระบบจัดคิวผู้ป่วย','หุ่นยนต์คลังสินค้า'],
    s3:['ศูนย์กระจายพัสดุ','ทีมกู้ภัย','รถรับส่งมหาวิทยาลัย','ระบบนำทางผู้พิการ','คลังสินค้า','การวางแผนส่งอาหาร'],
    s4:['บริษัทขนส่ง','ทีมส่งอาหาร','หน่วยกู้ภัย','รถรับส่งมหาวิทยาลัย','คลังสินค้า','ระบบวางแผนพลังงาน'],
    s5:['โดรนสำรวจ','ระบบนำทางมหาวิทยาลัย','หุ่นยนต์คลังสินค้า','รถรับส่งอัตโนมัติ','ทีมกู้ภัย','ระบบส่งเอกสาร'],
    s6:['เกมวางแผน','การแข่งขันเชิงกลยุทธ์','เกมกระดาน','ระบบป้องกันเครือข่าย','การประมูลทรัพยากร','การวางแผนทีมกีฬา'],
    s7:['ศูนย์สุขภาพ','สำนักงานทะเบียน','ระบบช่วยเหลือนักศึกษา','ฝ่ายบุคคล','ศูนย์บริการประชาชน','คลินิก'],
    s8:['คลินิก','ศูนย์ประเมินความเสี่ยง','ฝ่ายทุนการศึกษา','ระบบเตือนภัย','ศูนย์บริการประชาชน','หน่วยคัดกรอง'],
    s9:['ศูนย์บริการ','ฝ่ายวิชาการ','คลินิก','สำนักงานทะเบียน','ระบบช่วยเหลือนักศึกษา','หน่วยตรวจเอกสาร'],
    b1:['ศูนย์บริการประชาชน','ห้องปฏิบัติการ AI','ทีมพัฒนามหาวิทยาลัย','ระบบโรงเรียนอัจฉริยะ','คลินิกมหาวิทยาลัย','ศูนย์ข้อมูลชุมชน'],
    b2:['ทีมพัฒนา AI','ห้องแข่งขันอัลกอริทึม','ศูนย์วางแผนเส้นทาง','ห้องทดลองเกม AI','หน่วยกู้ภัย','ฝ่ายโลจิสติกส์'],
    b3:['ทีมกำกับดูแล AI','ศูนย์วิเคราะห์ข้อมูล','คลินิก','สำนักงานบริการประชาชน','ฝ่ายวิชาการ','ห้องปฏิบัติการ AI']
  };
  const lure={
    foundation:['เลือกแบบสุ่ม','ใช้ผลลัพธ์ทันทีโดยไม่ตรวจสอบ','ตัดสินจากข้อความที่ยาวที่สุด'],
    core:['ละเลยข้อมูลหรือเงื่อนไขสำคัญ','ซ่อนข้อจำกัดจากผู้ใช้','ไม่บันทึกเหตุผลของการตัดสินใจ'],
    stretch:['ข้ามการตรวจทานแม้ผลกระทบสูง','สรุปจากหลักฐานไม่ครบ','ไม่เปิดทางให้ผู้ใช้ทักท้วงหรืออุทธรณ์']
  };
  const thaiTier={foundation:'Foundation',core:'Core',stretch:'Stretch'};
  function profileId(){try{const p=window.AIQuestStorage?.getProfile?.()||{};return String(p.studentId||'guest').replace(/[^a-z0-9_-]/gi,'_')}catch(e){return 'guest'}}
  function load(){try{return JSON.parse(localStorage.getItem(KEY+'_'+profileId())||'{}')}catch(e){return {}}}
  function save(v){try{localStorage.setItem(KEY+'_'+profileId(),JSON.stringify(v))}catch(e){}}
  function rowOf(raw){return {prompt:raw[0],correct:raw[1],wrong:copy(raw[2]),explain:String(raw[3]||'').trim()}}
  function safeExplain(text){const s=String(text||'').replace(/[.]+$/,'');return s||'แนวทางนี้อาศัยหลักฐานและตรวจสอบผลกระทบได้'}
  function makeForms(rows,kind){
    const out=[],scene=contexts[MID]||['สถานการณ์จำลอง A','สถานการณ์จำลอง B','สถานการณ์จำลอง C'];
    (rows||[]).forEach((raw,base)=>{
      const r=rowOf(raw);
      scene.forEach((ctx,ci)=>{
        const forms=[
          {type:'decision',tier:'foundation',prompt:'สถานการณ์: '+ctx+' — '+r.prompt,correct:r.correct,wrong:[...r.wrong,...lure.foundation],explain:r.explain},
          {type:'explain',tier:'core',prompt:'ทีม '+ctx+' เลือกแนวทาง “'+r.correct+'” เหตุผลใดอธิบายการตัดสินใจนี้ได้ดีที่สุด',correct:'เพราะ '+safeExplain(r.explain),wrong:['เพราะไม่จำเป็นต้องใช้หลักฐาน','เพราะระบบอัตโนมัติไม่เคยผิดพลาด','เพราะผลกระทบต่อผู้ใช้ไม่สำคัญ'],explain:'การอธิบายต้องเชื่อมโยงหลักฐาน เหตุผล และผลกระทบของการตัดสินใจ'},
          {type:'repair',tier:'core',prompt:'ก่อนเปิดใช้ระบบของ '+ctx+' ผู้ดูแลเสนอ “'+(r.wrong[0]||'เลือกแบบสุ่ม')+'” ควรแก้เป็นแนวทางใด',correct:r.correct,wrong:[...(r.wrong||[]),...lure.core],explain:r.explain},
          {type:'audit',tier:'stretch',prompt:'หลังระบบ '+ctx+' ตัดสินใจตาม Case นี้ สิ่งใดทำให้การตัดสินใจตรวจสอบย้อนหลังได้ดีที่สุด',correct:'บันทึกหลักฐาน เหตุผล การตัดสินใจ และผู้รับผิดชอบ',wrong:['เก็บเฉพาะคะแนนสุดท้าย','ลบข้อมูลเมื่อระบบทำงานเสร็จ','ซ่อนเหตุผลเพื่อให้ระบบดูมั่นใจ'],explain:'การเก็บ audit trail ช่วยตรวจสอบความรับผิดชอบและแก้ไขข้อผิดพลาด'},
          {type:'counter',tier:'stretch',prompt:'ถ้า '+ctx+' เลือก “'+(r.wrong[0]||'แนวทางที่ไม่เหมาะสม')+'” แทน “'+r.correct+'” ความเสี่ยงสำคัญคืออะไร',correct:'อาจตัดสินใจโดยละเลยหลักฐาน ความปลอดภัย หรือการตรวจสอบ',wrong:['ระบบจะถูกต้องมากขึ้นเสมอ','ผู้ใช้ไม่จำเป็นต้องรู้ข้อจำกัด','ไม่มีผลต่อความน่าเชื่อถือ'],explain:'การเลือกแนวทางที่ไม่เหมาะสมอาจเพิ่มความเสี่ยงต่อผู้ใช้และคุณภาพการตัดสินใจ'}
        ];
        forms.forEach((f,fi)=>out.push({id:kind+'_'+base+'_'+ci+'_'+fi,source:kind+'_'+base,kind,context:ctx,tier:f.tier,prompt:f.prompt,correct:f.correct,wrong:shuffle([...new Set(f.wrong.filter(x=>x&&x!==f.correct))]).slice(0,3),explain:f.explain}));
      });
    });
    return out;
  }
  function makeTwists(rows){
    const out=[],scene=contexts[MID]||['สถานการณ์จำลอง A'];
    (rows||[]).slice(0,12).forEach((raw,base)=>{
      const r=rowOf(raw);
      scene.forEach((ctx,ci)=>{
        out.push({id:'twist_'+base+'_'+ci+'_0',source:'twist_'+base,kind:'twist',context:ctx,tier:'stretch',prompt:'⚡ Case Twist — '+ctx+' พบข้อมูลใหม่หรือผลกระทบสูงก่อนเปิดใช้ระบบ: '+r.prompt,correct:r.correct,wrong:shuffle([...new Set([...(r.wrong||[]),...lure.stretch])]).slice(0,3),explain:r.explain});
        out.push({id:'twist_'+base+'_'+ci+'_1',source:'twist_'+base,kind:'twist',context:ctx,tier:'stretch',prompt:'⚡ Case Twist — ผู้ใช้ของ '+ctx+' โต้แย้งผลจากระบบ Case นี้ สิ่งใดเป็นการตอบสนองที่รับผิดชอบที่สุด',correct:'เปิดเผยเหตุผล ข้อจำกัด และให้มีการตรวจทานเมื่อผลกระทบสูง',wrong:['ยืนยันผลเดิมโดยไม่อธิบาย','ซ่อนข้อมูลเพื่อไม่ให้โต้แย้ง','ปิดช่องทางทักท้วง'],explain:'เมื่อผู้ใช้ได้รับผลกระทบ ระบบควรอธิบาย ตรวจสอบได้ และมีคนทบทวนเมื่อจำเป็น'});
      });
    });
    return out;
  }
  function choose(pool,used,plan){
    const picked=[],selectedSources=new Set();
    plan.forEach(tier=>{
      const options=shuffle(pool.filter(x=>x.tier===tier&&!used.has(x.id)&&!selectedSources.has(x.source)));
      const fallback=shuffle(pool.filter(x=>!used.has(x.id)&&!selectedSources.has(x.source)));
      const card=options[0]||fallback[0]||shuffle(pool.filter(x=>!selectedSources.has(x.source)))[0]||shuffle(pool)[0];
      if(card){picked.push(card);selectedSources.add(card.source);used.add(card.id)}
    });
    return picked;
  }
  function setPhase(cards,label){return cards.map(card=>Object.assign({},card,{phase:label+' • '+thaiTier[card.tier]}))}
  function makeDeck(){
    const b=bank();if(!b)return null;
    const h=load();h[MID]=h[MID]||{rounds:[]};const prior=h[MID].rounds.slice(-WINDOW);const used=new Set(prior.flatMap(r=>r.ids||[]));const round=prior.length?Math.max(...prior.map(r=>Number(r.round)||0))+1:1;
    const mPool=makeForms(b.m||[],'m'),qPool=makeForms(b.q||[],'q'),tPool=makeTwists(b.q||[]);
    let cards,structure;
    if(MID.startsWith('b')){
      const p1=setPhase(choose(mPool,used,['core','core','stretch','core','stretch','stretch']),'Phase 1');
      const p2=setPhase(choose(qPool,used,['core','stretch','core','stretch','core','stretch']),'Phase 2');
      const p3=setPhase(choose(tPool,used,['stretch','stretch','stretch','stretch','stretch','stretch']),'Phase 3');
      cards=[...shuffle(p1),...shuffle(p2),...shuffle(p3)];structure={boss:true,total:18,mechanic:6,knowledge:6,twist:6};
    }else{
      const mechanics=setPhase(choose(mPool,used,round===1?['foundation','foundation','core','core','stretch']:['core','core','stretch','stretch','foundation']),'Phase 1');
      const knowledge=setPhase(choose(qPool,used,round===1?['foundation','foundation','core','core','core','stretch','stretch','stretch']:['core','core','core','stretch','stretch','stretch','foundation','stretch']),'Phase 2');
      const twists=setPhase(choose(tPool,used,['stretch','stretch']),'Phase 3');
      cards=[...shuffle(mechanics),...shuffle(knowledge),...shuffle(twists)];structure={boss:false,total:15,mechanic:5,knowledge:8,twist:2};
    }
    const deck={id:'deck_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),round,cards,structure,usedWindow:WINDOW,pool:{mechanic:mPool.length,knowledge:qPool.length,twist:tPool.length}};
    h[MID].rounds.push({round,at:Date.now(),ids:cards.map(c=>c.id),deckId:deck.id});h[MID].rounds=h[MID].rounds.slice(-WINDOW);save(h);return deck;
  }
  window.AIQuestReplayFactoryV650={makeDeck,getBank:bank,window:WINDOW,version:'v6.5.2',maxReplay:true};
})();