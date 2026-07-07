/* CSAI2102 AI Quest — Core Case Picker Source v6.8.9
   Guarantees that a completed Core replay deck is available to the static Case picker.
   Preferred source: exact persistent deck snapshot written at deck creation.
   Fallback source: reconstruct exact card IDs from replay history for legacy completed decks.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_CASE_PICKER_SOURCE_V689__)return;
  window.__AIQUEST_CORE_CASE_PICKER_SOURCE_V689__=true;
  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  if(MID!=='s1'&&MID!=='m1')return;
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const HISTORY='CSAI2102_CORE3_REPLAY_DECKS_V650';
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const tidy=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const user=()=>String(profile().studentId||'guest').replace(/[^a-z0-9_-]/gi,'_');
  const persistentKey=()=>('CSAI2102_CORE_EVIDENCE_DECK_V689_'+MID+'_'+user());
  const clone=value=>JSON.parse(JSON.stringify(value));
  const hash=value=>{let n=0;for(const char of String(value||''))n=(n*31+char.charCodeAt(0))>>>0;return n};
  const shuffle=list=>Array.isArray(list)?list.slice():[];
  const places=['ศูนย์คัดกรองอีเมลภาควิชา','ห้องสมุดดิจิทัล','ศูนย์บริการชุมชน','คลินิกมหาวิทยาลัย','ร้านค้าปลีกชุมชน','ระบบรถรับส่งมหาวิทยาลัย','ศูนย์แนะแนวอาชีพ','โรงอาหารอัจฉริยะ','ศูนย์กีฬา','ห้องปฏิบัติการวิทยาศาสตร์','ระบบทุนการศึกษา','ศูนย์บริการนักศึกษา','ศูนย์สุขภาพชุมชน','สำนักงานทะเบียน','ศูนย์ข้อมูลเทศบาล','ศูนย์อาสาสมัคร','โรงพยาบาลสัตว์มหาวิทยาลัย','ศูนย์เรียนรู้ผู้สูงอายุ','ศูนย์จัดการพลังงาน','ศูนย์ควบคุมจราจร','ศูนย์รับแจ้งเหตุ','ศูนย์คัดแยกขยะ','ศูนย์บริการผู้พิการ','ตลาดชุมชนดิจิทัล'];
  const uniquePlaces=['ศูนย์คัดกรองอีเมลภาควิชา','ห้องสมุดดิจิทัล','ศูนย์บริการชุมชน','คลินิกมหาวิทยาลัย','ร้านค้าปลีกชุมชน','ระบบรถรับส่งมหาวิทยาลัย','ศูนย์แนะแนวอาชีพ','โรงอาหารอัจฉริยะ','ศูนย์กีฬา','ห้องปฏิบัติการวิทยาศาสตร์','ระบบทุนการศึกษา','ศูนย์บริการนักศึกษา','ศูนย์สุขภาพชุมชน','สำนักงานทะเบียน','ศูนย์ข้อมูลเทศบาล','ศูนย์อาสาสมัคร','โรงพยาบาลสัตว์มหาวิทยาลัย','ศูนย์เรียนรู้ผู้สูงอายุ','ศูนย์จัดการพลังงาน','ศูนย์ควบคุมจราจร','ศูนย์รับแจ้งเหตุ','ศูนย์คัดแยกขยะ','ศูนย์บริการผู้พิการ','ตลาดชุมชนดิจิทัล','ศูนย์ตรวจคุณภาพน้ำ','ศูนย์ดูแลอาคารอัจฉริยะ','ศูนย์จัดการห้องเรียน','ศูนย์ติดตามอุปกรณ์','ศูนย์ช่วยเหลือฉุกเฉิน','ศูนย์ประเมินการเข้าถึงบริการ'];
  const lenses=['ตรวจข้อมูลรับเข้า','ตั้งเกณฑ์การตัดสินใจ','สื่อสารข้อจำกัด','ตรวจผลกระทบต่อผู้ใช้','บันทึกหลักฐาน','ส่งต่อ human review','จัดการข้อมูลไม่ครบ','คุ้มครองสิทธิ์ผู้ใช้','ตรวจผลก่อนแจ้ง','เปรียบเทียบทางเลือก','ทดสอบกรณีพิเศษ','ติดตามผลหลังให้คำแนะนำ','จำกัดขอบเขตการตัดสินใจอัตโนมัติ','ใช้ทางเลือกปลอดภัยเมื่อไม่แน่ใจ','จัดลำดับผู้ใช้ตามเงื่อนไข'];
  const lure={foundation:['เลือกแบบสุ่ม','ใช้ผลลัพธ์ทันทีโดยไม่ตรวจสอบ','ตัดสินจากข้อความที่ยาวที่สุด'],core:['ละเลยข้อมูลหรือเงื่อนไขสำคัญ','ซ่อนข้อจำกัดจากผู้ใช้','ไม่บันทึกเหตุผลของการตัดสินใจ'],stretch:['ข้ามการตรวจทานแม้ผลกระทบสูง','สรุปจากหลักฐานไม่ครบ','ไม่เปิดทางให้ผู้ใช้ทักท้วงหรืออุทธรณ์']};
  const tierName={foundation:'Foundation',core:'Core',stretch:'Stretch'};
  const safe=text=>String(text||'').replace(/[.]+$/,'')||'แนวทางนี้อาศัยหลักฐานและตรวจสอบผลกระทบได้';
  const wrongs=value=>Array.isArray(value)?value.slice():value?[value]:[];
  function snapshot(deck){
    if(!deck||!Array.isArray(deck.cards)||!deck.cards.length)return null;
    const cards=clone(deck.cards);
    const total=cards.length;
    const mechanics=cards.filter(card=>card.kind==='m').length;
    const knowledge=cards.filter(card=>card.kind==='q').length;
    const twists=cards.filter(card=>card.kind==='twist').length;
    return {missionId:MID,deck:{...clone(deck),cards},index:total,correct:total,mechanic:mechanics,mechanicTotal:mechanics,knowledge:knowledge,knowledgeTotal:knowledge,twist:twists,twistTotal:twists,combo:total,comboMax:total,hints:3,hintsUsed:0,hp:0,wrong:[],answered:true,ended:true,saved:false,timer:null,startedAt:Date.now()-36000,result:{score:100,pass:true,mechanicPct:100,knowledgePct:100,twistPct:100,usedSec:36,recoveredForEvidence:true},recoveredForEvidence:true,recoveredAt:Date.now()};
  }
  function currentActive(){const value=read(ACTIVE,null);return value?.deck?.cards?.length?value:null}
  function lens(card,index){
    const source=(tidy(card?.prompt)+' '+tidy(card?.correct)+' '+tidy(card?.explain)).toLowerCase();
    if(source.includes('อีเมล')||source.includes('สแปม'))return 'คัดกรองอีเมลรายงาน';
    if(source.includes('ปัญญาประดิษฐ์')||/(^|[^a-z])ai([^a-z]|$)/.test(source))return 'แยก AI ออกจากระบบตามกฎ';
    if(source.includes('ตั้งเวลา')||source.includes('กฎคงที่')||source.includes('ระบบอัตโนมัติ'))return 'ตรวจระบบตามกฎที่ตั้งไว้';
    if(source.includes('แนะนำเพลง')||source.includes('พฤติกรรมการฟัง'))return 'ระบบแนะนำจากพฤติกรรมผู้ใช้';
    if(source.includes('ยอมรับผลทันที')||source.includes('อนุมัติผล'))return 'ตรวจทานก่อนอนุมัติผล';
    if(source.includes('ไม่คุ้นเคย')||source.includes('ข้อมูลไม่ครบ'))return 'รับมือข้อมูลไม่ครบหรือไม่คุ้นเคย';
    if(source.includes('ตรวจสอบย้อนหลัง')||source.includes('audit')||source.includes('บันทึก'))return 'บันทึกเหตุผลเพื่อตรวจสอบย้อนหลัง';
    if(source.includes('ผลกระทบสูง')||source.includes('คนตรวจทาน'))return 'ส่งต่อ human review เมื่อผลกระทบสูง';
    if(card?.kind==='twist')return 'จัดการข้อมูลใหม่ก่อนเปิดใช้ระบบ';
    return lenses[hash(String(card?.id||'')+'|'+index)%lenses.length];
  }
  function applyVisibleContexts(deck){
    const used=new Set(),seed=hash(String(deck.id||'')+'|'+String(deck.round||0));
    deck.cards.forEach((card,index)=>{
      const old=tidy(card.context),focus=lens(card,index);let title='';
      for(let offset=0;offset<uniquePlaces.length*2;offset++){
        const place=uniquePlaces[(seed+index*11+offset*7)%uniquePlaces.length],candidate=focus+' • '+place;
        if(!used.has(candidate)){title=candidate;break}
      }
      if(!title)title=focus+' #'+(index+1)+' • '+uniquePlaces[index%uniquePlaces.length];
      used.add(title);card.contextBase=title.split(' • ').slice(1).join(' • ');card.scenarioFocus=focus;card.contextSignature=title;card.context=title;if(old&&String(card.prompt||'').includes(old))card.prompt=String(card.prompt).split(old).join(title);
    });
    deck.contextAudit={version:'v6.8.9',sourceRecovery:true,unique:used.size===deck.cards.length,count:used.size};
    return deck;
  }
  function buildCard(id,index){
    const match=String(id||'').match(/^(m|q|twist)_(\d+)_(\d+)_(\d+)$/);if(!match)return null;
    const kind=match[1],base=Number(match[2]),contextIndex=Number(match[3]),formIndex=Number(match[4]);
    const bank=window.AIQuestS1ThaiV646||{};
    const raw=kind==='m'?(bank.m||[])[base]:(bank.q||[])[base];
    if(!raw)return null;
    const prompt=raw[0],correct=raw[1],wrong=wrongs(raw[2]),explain=String(raw[3]||'');
    const context=places[contextIndex]||places[0];let forms;
    if(kind==='twist')forms=[
      {tier:'stretch',prompt:'⚡ Case Twist — '+context+' พบข้อมูลใหม่หรือผลกระทบสูงก่อนเปิดใช้ระบบ: '+prompt,correct,wrong:[...wrong,...lure.stretch],explain},
      {tier:'stretch',prompt:'⚡ Case Twist — ผู้ใช้ของ '+context+' โต้แย้งผลจากระบบ Case นี้ สิ่งใดเป็นการตอบสนองที่รับผิดชอบที่สุด',correct:'เปิดเผยเหตุผล ข้อจำกัด และให้มีการตรวจทานเมื่อผลกระทบสูง',wrong:['ยืนยันผลเดิมโดยไม่อธิบาย','ซ่อนข้อมูลเพื่อไม่ให้โต้แย้ง','ปิดช่องทางทักท้วง'],explain:'เมื่อผู้ใช้ได้รับผลกระทบ ระบบควรอธิบาย ตรวจสอบได้ และมีคนทบทวนเมื่อจำเป็น'}
    ];else forms=[
      {tier:'foundation',prompt:'สถานการณ์: '+context+' — '+prompt,correct,wrong:[...wrong,...lure.foundation],explain},
      {tier:'core',prompt:'ทีม '+context+' เลือกแนวทาง “'+correct+'” เหตุผลใดอธิบายการตัดสินใจนี้ได้ดีที่สุด',correct:'เพราะ '+safe(explain),wrong:['เพราะไม่จำเป็นต้องใช้หลักฐาน','เพราะระบบอัตโนมัติไม่เคยผิดพลาด','เพราะผลกระทบต่อผู้ใช้ไม่สำคัญ'],explain:'การอธิบายต้องเชื่อมโยงหลักฐาน เหตุผล และผลกระทบของการตัดสินใจ'},
      {tier:'core',prompt:'ก่อนเปิดใช้ระบบของ '+context+' ผู้ดูแลเสนอ “'+(wrong[0]||'เลือกแบบสุ่ม')+'” ควรแก้เป็นแนวทางใด',correct,wrong:[...wrong,...lure.core],explain},
      {tier:'stretch',prompt:'หลังระบบ '+context+' ตัดสินใจตาม Case นี้ สิ่งใดทำให้การตัดสินใจตรวจสอบย้อนหลังได้ดีที่สุด',correct:'บันทึกหลักฐาน เหตุผล การตัดสินใจ และผู้รับผิดชอบ',wrong:['เก็บเฉพาะคะแนนสุดท้าย','ลบข้อมูลเมื่อระบบทำงานเสร็จ','ซ่อนเหตุผลเพื่อให้ระบบดูมั่นใจ'],explain:'การเก็บ audit trail ช่วยตรวจสอบความรับผิดชอบและแก้ไขข้อผิดพลาด'},
      {tier:'stretch',prompt:'ถ้า '+context+' เลือก “'+(wrong[0]||'แนวทางที่ไม่เหมาะสม')+'” แทน “'+correct+'” ความเสี่ยงสำคัญคืออะไร',correct:'อาจตัดสินใจโดยละเลยหลักฐาน ความปลอดภัย หรือการตรวจสอบ',wrong:['ระบบจะถูกต้องมากขึ้นเสมอ','ผู้ใช้ไม่จำเป็นต้องรู้ข้อจำกัด','ไม่มีผลต่อความน่าเชื่อถือ'],explain:'การเลือกแนวทางที่ไม่เหมาะสมอาจเพิ่มความเสี่ยงต่อผู้ใช้และคุณภาพการตัดสินใจ'}
    ];
    const form=forms[formIndex];if(!form)return null;
    const phase=index<5?'Phase 1':index<13?'Phase 2':'Phase 3';
    return {id:String(id),source:(kind==='twist'?'twist':kind)+'_'+base,kind,context,tier:form.tier,phase:phase+' • '+tierName[form.tier],prompt:form.prompt,correct:form.correct,wrong:shuffle(form.wrong).filter(value=>value&&value!==form.correct).slice(0,3),explain:form.explain};
  }
  function recoverFromHistory(){
    const own=read(HISTORY+'_'+user(),null);
    const collections=[];
    if(own)collections.push(own);
    try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'';if(key.startsWith(HISTORY+'_')&&key!==HISTORY+'_'+user()){const value=read(key,null);if(value)collections.push(value)}}}catch(e){}
    let latest=null;
    collections.forEach(history=>{const rounds=[...(history?.s1?.rounds||[]),...(history?.m1?.rounds||[])];rounds.forEach(round=>{if(round?.ids?.length&&round?.deckId&&(!latest||Number(round.at||0)>Number(latest.at||0)))latest=round})});
    if(!latest)return null;
    const cards=latest.ids.map(buildCard).filter(Boolean);if(cards.length!==latest.ids.length)return null;
    return applyVisibleContexts({id:String(latest.deckId),round:Number(latest.round||0),cards,structure:{boss:false,total:cards.length,mechanic:5,knowledge:8,twist:2},usedWindow:4});
  }
  function restore(){
    if(currentActive())return;
    const persistent=read(persistentKey(),null);
    let deck=persistent?.deck?.cards?.length?clone(persistent.deck):null;
    if(!deck)deck=recoverFromHistory();
    if(!deck)return;
    write(ACTIVE,snapshot(deck));
  }
  restore();
})();