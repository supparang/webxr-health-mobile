/* CSAI2102 AI Quest — Deck History Recovery v6.8.7
   Recovers a completed S1 replay deck only when the transient active snapshot is absent.
   The recovery uses the exact stored deck id, round and card ids from replay history,
   recreates the original card text, then restores its deterministic visible contexts.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_DECK_HISTORY_RECOVERY_V687__)return;
  window.__AIQUEST_CORE_DECK_HISTORY_RECOVERY_V687__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  if(MID!=='s1'&&MID!=='m1')return;
  const KEY='CSAI2102_CORE3_REPLAY_DECKS_V650',ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const user=()=>String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const hash=v=>{let n=0;for(const ch of String(v||''))n=(n*31+ch.charCodeAt(0))>>>0;return n};
  const shuffle=a=>Array.isArray(a)?a.slice():[];
  const places=['ศูนย์คัดกรองอีเมลภาควิชา','ห้องสมุดดิจิทัล','ศูนย์บริการชุมชน','คลินิกมหาวิทยาลัย','ร้านค้าปลีกชุมชน','ระบบรถรับส่งมหาวิทยาลัย','ศูนย์แนะแนวอาชีพ','โรงอาหารอัจฉริยะ','ศูนย์กีฬา','ห้องปฏิบัติการวิทยาศาสตร์','ระบบทุนการศึกษา','ศูนย์บริการนักศึกษา','ศูนย์สุขภาพชุมชน','สำนักงานทะเบียน','ศูนย์ข้อมูลเทศบาล','ศูนย์อาสาสมัคร','โรงพยาบาลสัตว์มหาวิทยาลัย','ศูนย์เรียนรู้ผู้สูงอายุ','ศูนย์จัดการพลังงาน','ศูนย์ควบคุมจราจร','ศูนย์รับแจ้งเหตุ','ศูนย์คัดแยกขยะ','ศูนย์บริการผู้พิการ','ตลาดชุมชนดิจิทัล'];
  const visiblePlaces=['ศูนย์คัดกรองอีเมลภาควิชา','ห้องสมุดดิจิทัล','ศูนย์บริการชุมชน','คลินิกมหาวิทยาลัย','ร้านค้าปลีกชุมชน','ระบบรถรับส่งมหาวิทยาลัย','ศูนย์แนะแนวอาชีพ','โรงอาหารอัจฉริยะ','ศูนย์กีฬา','ห้องปฏิบัติการวิทยาศาสตร์','ระบบทุนการศึกษา','ศูนย์บริการนักศึกษา','ศูนย์สุขภาพชุมชน','สำนักงานทะเบียน','ศูนย์ข้อมูลเทศบาล','ศูนย์อาสาสมัคร','โรงพยาบาลสัตว์มหาวิทยาลัย','ศูนย์เรียนรู้ผู้สูงอายุ','ศูนย์จัดการพลังงาน','ศูนย์ควบคุมจราจร','ศูนย์รับแจ้งเหตุ','ศูนย์คัดแยกขยะ','ศูนย์บริการผู้พิการ','ตลาดชุมชนดิจิทัล','ศูนย์ตรวจคุณภาพน้ำ','ศูนย์ดูแลอาคารอัจฉริยะ','ศูนย์จัดการห้องเรียน','ศูนย์ติดตามอุปกรณ์','ศูนย์ช่วยเหลือฉุกเฉิน','ศูนย์ประเมินการเข้าถึงบริการ'];
  const m=[
    ['กล้องตรวจจับขยะเรียนรู้จากภาพที่ติดป้ายกำกับจำนวนมาก','เป็น AI เพราะเรียนรู้รูปแบบจากข้อมูล','เป็นระบบตั้งเวลาธรรมดา','AI เรียนรู้รูปแบบจากข้อมูลเดิมเพื่อนำไปทำนายข้อมูลใหม่'],
    ['ไฟถนนเปิดทุกวันเวลา 18.00 น. ตามเวลาที่ตั้งไว้','เป็นระบบอัตโนมัติ','เป็น AI ที่เรียนรู้เอง','ระบบนี้ทำตามกฎตายตัว ไม่ได้เรียนรู้จากข้อมูล'],
    ['ระบบแนะนำเพลงปรับรายการจากพฤติกรรมการฟังของผู้ใช้','เป็น AI ที่ใช้ข้อมูลพฤติกรรม','เป็นปุ่มเปิดเพลงธรรมดา','ระบบใช้ข้อมูลเดิมเพื่อคาดเดาความสนใจ'],
    ['ระบบคัดกรองใบสมัครให้ผลลัพธ์ไม่แน่ใจในบางกรณี','ควรแจ้งข้อจำกัดและให้คนตรวจทาน','ควรซ่อนความไม่แน่ใจเพื่อให้ดูมั่นใจ','งานที่กระทบคนควรสื่อสารความไม่แน่นอนและมีคนตรวจสอบ']
  ];
  const q=[
    ['โมเดลที่เรียนรู้จากภาพเก่าเพื่อติดป้ายกำกับภาพใหม่ คืออะไร','ปัญญาประดิษฐ์ (AI)',['ระบบตั้งเวลา','กฎคงที่อย่างเดียว'],'โมเดลใช้รูปแบบจากข้อมูลเพื่อทำนายภาพใหม่'],
    ['คำสั่ง “เปิดไฟเวลา 18.00 น.” โดยทั่วไปคืออะไร','ระบบอัตโนมัติ',['การเรียนรู้ของเครื่อง','การค้นหาแบบมินิแมกซ์'],'เป็นการทำตามกฎที่ตั้งไว้ล่วงหน้า'],
    ['ข้อใดต้องอาศัยการเรียนรู้รูปแบบจากข้อมูล','คัดกรองสแปมจากอีเมลที่ผู้ใช้รายงาน',['เปิดประตูด้วยรหัสตายตัว','นับเวลาถอยหลัง'],'การคัดกรองสแปมต้องหาแบบแผนจากตัวอย่างเดิม'],
    ['ระบบ AI ที่รับผิดชอบควรทำอย่างไร','เปิดโอกาสให้มนุษย์ตรวจทานเมื่อผลกระทบสูง',['ซ่อนความผิดพลาด','ไม่ต้องอธิบายผลลัพธ์'],'การกำกับโดยมนุษย์ช่วยลดความเสี่ยง'],
    ['เหตุใด AI จึงไม่เท่ากับทุกระบบดิจิทัล','บางระบบทำงานตามกฎคงที่โดยไม่เรียนรู้',['AI ต้องเป็นหุ่นยนต์เสมอ','ระบบดิจิทัลใช้กฎไม่ได้'],'ระบบอัตโนมัติทำงานได้โดยไม่ต้องเรียนรู้จากข้อมูล'],
    ['เมื่อใดควรระวังผลทำนายของ AI มากเป็นพิเศษ','เมื่อเจอข้อมูลที่ไม่คุ้นเคยหรือข้อมูลไม่ครบ',['เมื่อหน้าจอมีสีฟ้า','เมื่อตัวเลือกยาวที่สุด'],'ข้อมูลที่ต่างจากชุดฝึกอาจทำให้ผลคลาดเคลื่อน'],
    ['ผลตรวจใบหน้าที่ใช้ตัดสินสิทธิ์เข้าอาคารควรเป็นอย่างไร','ให้เจ้าหน้าที่ตรวจทานเมื่อมีผลกระทบสำคัญ',['ยอมรับผลทันทีเสมอ','ใช้โดยไม่เก็บหลักฐาน'],'การตัดสินใจที่กระทบสิทธิ์ควรมีการตรวจสอบ'],
    ['ข้อความใดแสดงข้อจำกัดของ AI อย่างเหมาะสม','โมเดลอาจผิดพลาดเมื่อพบกรณีที่ไม่เคยเห็น',['โมเดลถูกต้องเสมอ','ไม่มีใครตั้งคำถามผลได้'],'การแจ้งข้อจำกัดทำให้ใช้งานอย่างรับผิดชอบ']
  ];
  const lure={foundation:['เลือกแบบสุ่ม','ใช้ผลลัพธ์ทันทีโดยไม่ตรวจสอบ','ตัดสินจากข้อความที่ยาวที่สุด'],core:['ละเลยข้อมูลหรือเงื่อนไขสำคัญ','ซ่อนข้อจำกัดจากผู้ใช้','ไม่บันทึกเหตุผลของการตัดสินใจ'],stretch:['ข้ามการตรวจทานแม้ผลกระทบสูง','สรุปจากหลักฐานไม่ครบ','ไม่เปิดทางให้ผู้ใช้ทักท้วงหรืออุทธรณ์']};
  const tier={foundation:'Foundation',core:'Core',stretch:'Stretch'};
  const safe=t=>String(t||'').replace(/[.]+$/,'')||'แนวทางนี้อาศัยหลักฐานและตรวจสอบผลกระทบได้';
  function raw(kind,base,ci,fi){
    const source=kind==='m'?m[base]:q[base];if(!source)return null;
    const ctx=places[ci]||places[0];
    let forms=[];
    if(kind==='twist'){
      forms=[
        {tier:'stretch',prompt:'⚡ Case Twist — '+ctx+' พบข้อมูลใหม่หรือผลกระทบสูงก่อนเปิดใช้ระบบ: '+source[0],correct:source[1],wrong:[...(source[2]||[]),...lure.stretch],explain:source[3]},
        {tier:'stretch',prompt:'⚡ Case Twist — ผู้ใช้ของ '+ctx+' โต้แย้งผลจากระบบ Case นี้ สิ่งใดเป็นการตอบสนองที่รับผิดชอบที่สุด',correct:'เปิดเผยเหตุผล ข้อจำกัด และให้มีการตรวจทานเมื่อผลกระทบสูง',wrong:['ยืนยันผลเดิมโดยไม่อธิบาย','ซ่อนข้อมูลเพื่อไม่ให้โต้แย้ง','ปิดช่องทางทักท้วง'],explain:'เมื่อผู้ใช้ได้รับผลกระทบ ระบบควรอธิบาย ตรวจสอบได้ และมีคนทบทวนเมื่อจำเป็น'}
      ];
    }else{
      const wrong=kind==='m'?[source[2]]:source[2]||[];
      forms=[
        {tier:'foundation',prompt:'สถานการณ์: '+ctx+' — '+source[0],correct:source[1],wrong:[...wrong,...lure.foundation],explain:source[3]},
        {tier:'core',prompt:'ทีม '+ctx+' เลือกแนวทาง “'+source[1]+'” เหตุผลใดอธิบายการตัดสินใจนี้ได้ดีที่สุด',correct:'เพราะ '+safe(source[3]),wrong:['เพราะไม่จำเป็นต้องใช้หลักฐาน','เพราะระบบอัตโนมัติไม่เคยผิดพลาด','เพราะผลกระทบต่อผู้ใช้ไม่สำคัญ'],explain:'การอธิบายต้องเชื่อมโยงหลักฐาน เหตุผล และผลกระทบของการตัดสินใจ'},
        {tier:'core',prompt:'ก่อนเปิดใช้ระบบของ '+ctx+' ผู้ดูแลเสนอ “'+(wrong[0]||'เลือกแบบสุ่ม')+'” ควรแก้เป็นแนวทางใด',correct:source[1],wrong:[...wrong,...lure.core],explain:source[3]},
        {tier:'stretch',prompt:'หลังระบบ '+ctx+' ตัดสินใจตาม Case นี้ สิ่งใดทำให้การตัดสินใจตรวจสอบย้อนหลังได้ดีที่สุด',correct:'บันทึกหลักฐาน เหตุผล การตัดสินใจ และผู้รับผิดชอบ',wrong:['เก็บเฉพาะคะแนนสุดท้าย','ลบข้อมูลเมื่อระบบทำงานเสร็จ','ซ่อนเหตุผลเพื่อให้ระบบดูมั่นใจ'],explain:'การเก็บ audit trail ช่วยตรวจสอบความรับผิดชอบและแก้ไขข้อผิดพลาด'},
        {tier:'stretch',prompt:'ถ้า '+ctx+' เลือก “'+(wrong[0]||'แนวทางที่ไม่เหมาะสม')+'” แทน “'+source[1]+'” ความเสี่ยงสำคัญคืออะไร',correct:'อาจตัดสินใจโดยละเลยหลักฐาน ความปลอดภัย หรือการตรวจสอบ',wrong:['ระบบจะถูกต้องมากขึ้นเสมอ','ผู้ใช้ไม่จำเป็นต้องรู้ข้อจำกัด','ไม่มีผลต่อความน่าเชื่อถือ'],explain:'การเลือกแนวทางที่ไม่เหมาะสมอาจเพิ่มความเสี่ยงต่อผู้ใช้และคุณภาพการตัดสินใจ'}
      ];
    }
    const f=forms[fi];if(!f)return null;
    return {id:(kind==='twist'?'twist':' '+kind).trim()+'_'+base+'_'+ci+'_'+fi,source:(kind==='twist'?'twist':kind)+'_'+base,kind:kind==='twist'?'twist':kind,context:ctx,tier:f.tier,prompt:f.prompt,correct:f.correct,wrong:shuffle(f.wrong||[]).filter(x=>x&&x!==f.correct).slice(0,3),explain:f.explain,phase:'Replay Deck • '+tier[f.tier]};
  }
  function lens(card,index){
    const source=(clean(card?.prompt)+' '+clean(card?.correct)+' '+clean(card?.explain)).toLowerCase();
    if(source.includes('อีเมล')||source.includes('สแปม'))return 'คัดกรองอีเมลรายงาน';
    if(source.includes('ปัญญาประดิษฐ์')||/(^|[^a-z])ai([^a-z]|$)/.test(source))return 'แยก AI ออกจากระบบตามกฎ';
    if(source.includes('ตั้งเวลา')||source.includes('กฎคงที่')||source.includes('ระบบอัตโนมัติ'))return 'ตรวจระบบตามกฎที่ตั้งไว้';
    if(source.includes('แนะนำเพลง')||source.includes('พฤติกรรมการฟัง'))return 'ระบบแนะนำจากพฤติกรรมผู้ใช้';
    if(source.includes('ยอมรับผลทันที')||source.includes('อนุมัติผล'))return 'ตรวจทานก่อนอนุมัติผล';
    if(source.includes('ไม่คุ้นเคย')||source.includes('ข้อมูลไม่ครบ'))return 'รับมือข้อมูลไม่ครบหรือไม่คุ้นเคย';
    if(source.includes('ตรวจสอบย้อนหลัง')||source.includes('audit')||source.includes('บันทึก'))return 'บันทึกเหตุผลเพื่อตรวจสอบย้อนหลัง';
    if(source.includes('ผลกระทบสูง')||source.includes('คนตรวจทาน'))return 'ส่งต่อ human review เมื่อผลกระทบสูง';
    if(card?.kind==='twist')return 'จัดการข้อมูลใหม่ก่อนเปิดใช้ระบบ';
    const labels=['ตรวจข้อมูลรับเข้า','ตั้งเกณฑ์การตัดสินใจ','สื่อสารข้อจำกัด','ตรวจผลกระทบต่อผู้ใช้','บันทึกหลักฐาน','ส่งต่อ human review','จัดการข้อมูลไม่ครบ','คุ้มครองสิทธิ์ผู้ใช้','ตรวจผลก่อนแจ้ง','เปรียบเทียบทางเลือก','ทดสอบกรณีพิเศษ','ติดตามผลหลังให้คำแนะนำ','จำกัดขอบเขตการตัดสินใจอัตโนมัติ','ใช้ทางเลือกปลอดภัยเมื่อไม่แน่ใจ','จัดลำดับผู้ใช้ตามเงื่อนไข'];
    return labels[hash(String(card?.id||'')+'|'+index)%labels.length];
  }
  function enforce(deck){
    const used=new Set(),seed=hash(String(deck.id||'')+'|'+String(deck.round||0));
    deck.cards.forEach((card,index)=>{
      const old=clean(card.context),focus=lens(card,index);let title='';
      for(let offset=0;offset<visiblePlaces.length*2;offset++){
        const place=visiblePlaces[(seed+index*11+offset*7)%visiblePlaces.length],candidate=focus+' • '+place;
        if(!used.has(candidate)){title=candidate;break}
      }
      if(!title)title=focus+' #'+(index+1)+' • '+visiblePlaces[index%visiblePlaces.length];
      used.add(title);card.contextBase=title.split(' • ').slice(1).join(' • ');card.scenarioFocus=focus;card.contextSignature=title;card.context=title;card.prompt=String(card.prompt||'').includes(old)?String(card.prompt).split(old).join(title):card.prompt;
    });
    deck.contextAudit={version:'v6.8.7',historyRecovery:true,unique:used.size===deck.cards.length,count:used.size};return deck;
  }
  function recover(){
    const active=read(ACTIVE,null);if(active?.deck?.cards?.length)return;
    const history=read(KEY+'_'+user(),{}),rounds=history?.s1?.rounds||history?.m1?.rounds||[];
    const last=rounds[rounds.length-1];if(!last?.ids?.length||!last?.deckId)return;
    const cards=[];
    for(const id of last.ids){
      const match=String(id).match(/^(m|q|twist)_(\d+)_(\d+)_(\d+)$/);if(!match)continue;
      const card=raw(match[1],Number(match[2]),Number(match[3]),Number(match[4]));if(card)cards.push(card);
    }
    if(cards.length!==last.ids.length)return;
    const deck=enforce({id:String(last.deckId),round:Number(last.round||0),cards,structure:{boss:false,total:cards.length,mechanic:5,knowledge:8,twist:2},usedWindow:4});
    write(ACTIVE,{missionId:MID,deck,index:cards.length,ended:true,saved:false,recoveredForEvidence:true,recoveredAt:Date.now()});
  }
  recover();
})();
