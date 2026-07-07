/* CSAI2102 AI Quest — Core Hard Context Gate v6.8.2
   Runtime postcondition for every Core replay deck.
   A deck with duplicate visible Case contexts is never allowed to start.
*/
(()=>{'use strict';
  if(window.__AIQUEST_CORE_HARD_CONTEXT_GATE_V682__)return;
  window.__AIQUEST_CORE_HARD_CONTEXT_GATE_V682__=true;

  const MID=String(new URLSearchParams(location.search).get('mission')||'s1').toLowerCase();
  const ACTIVE='CSAI2102_ACTIVE_REPLAY_V674_'+MID;
  const WINDOW=4;
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const tidy=value=>String(value==null?'':value).replace(/\s+/g,' ').trim();
  const hash=value=>{let total=0;for(const ch of String(value||''))total=(total*31+ch.charCodeAt(0))>>>0;return total;};
  const profileId=()=>{try{return String((window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})).studentId||'guest').replace(/[^a-z0-9_-]/gi,'_')}catch(e){return'guest'}};
  const HISTORY='CSAI2102_CORE_CONTEXT_HARD_GATE_V682_'+profileId()+'_'+MID;

  const places={
    s1:['ศูนย์คัดกรองอีเมลภาควิชา','ห้องสมุดดิจิทัล','ศูนย์บริการชุมชน','คลินิกมหาวิทยาลัย','ร้านค้าปลีกชุมชน','ระบบรถรับส่งมหาวิทยาลัย','ศูนย์แนะแนวอาชีพ','โรงอาหารอัจฉริยะ','ศูนย์กีฬา','ห้องปฏิบัติการวิทยาศาสตร์','ระบบทุนการศึกษา','ศูนย์บริการนักศึกษา','ศูนย์สุขภาพชุมชน','สำนักงานทะเบียน','ศูนย์ข้อมูลเทศบาล','ศูนย์อาสาสมัคร','โรงพยาบาลสัตว์มหาวิทยาลัย','ศูนย์เรียนรู้ผู้สูงอายุ','ศูนย์จัดการพลังงาน','ศูนย์ควบคุมจราจร','ศูนย์รับแจ้งเหตุ','ศูนย์คัดแยกขยะ','ศูนย์บริการผู้พิการ','ตลาดชุมชนดิจิทัล','ศูนย์ตรวจคุณภาพน้ำ','ศูนย์ดูแลอาคารอัจฉริยะ','ศูนย์จัดการห้องเรียน','ศูนย์ติดตามอุปกรณ์','ศูนย์ช่วยเหลือฉุกเฉิน','ศูนย์ประเมินการเข้าถึงบริการ'],
    s2:['หุ่นยนต์ส่งยา','รถรับส่งอัตโนมัติ','รถเข็นห้องสมุด','โดรนส่งเอกสาร','ระบบจัดคิวผู้ป่วย','หุ่นยนต์คลังสินค้า','ระบบประตูอัจฉริยะ','หุ่นยนต์ทำความสะอาด','ระบบแนะนำห้องเรียน','จุดตรวจบัตรอัตโนมัติ','หุ่นยนต์ช่วยผู้สูงอายุ','ระบบคัดแยกขยะ','โดรนสำรวจอาคาร','ระบบแจ้งเตือนภัย','รถเข็นอาหารอัตโนมัติ','ระบบจัดคิวโรงอาหาร','แขนกลห้องปฏิบัติการ','ระบบส่งเอกสารภายใน','หุ่นยนต์บริการประชาชน','ระบบนำทางผู้พิการ','รถเข็นเวชภัณฑ์','ระบบตรวจความปลอดภัยอาคาร','หุ่นยนต์ดูแลสวน','ระบบช่วยค้นหาหนังสือ'],
    default:['ศูนย์ปฏิบัติการ A','ศูนย์ปฏิบัติการ B','ศูนย์ปฏิบัติการ C','ศูนย์ปฏิบัติการ D','ศูนย์ปฏิบัติการ E','ศูนย์ปฏิบัติการ F','ศูนย์ปฏิบัติการ G','ศูนย์ปฏิบัติการ H','ศูนย์ปฏิบัติการ I','ศูนย์ปฏิบัติการ J','ศูนย์ปฏิบัติการ K','ศูนย์ปฏิบัติการ L','ศูนย์ปฏิบัติการ M','ศูนย์ปฏิบัติการ N','ศูนย์ปฏิบัติการ O','ศูนย์ปฏิบัติการ P','ศูนย์ปฏิบัติการ Q','ศูนย์ปฏิบัติการ R','ศูนย์ปฏิบัติการ S','ศูนย์ปฏิบัติการ T','ศูนย์ปฏิบัติการ U','ศูนย์ปฏิบัติการ V','ศูนย์ปฏิบัติการ W','ศูนย์ปฏิบัติการ X']
  };
  const lenses=['คัดกรองข้อมูลก่อนให้บริการ','แยก AI ออกจากระบบตามกฎ','ตรวจความเสี่ยงของแนวทาง','สื่อสารข้อจำกัดของระบบ','บันทึกเหตุผลเพื่อตรวจสอบย้อนหลัง','ส่งต่อ human review เมื่อผลกระทบสูง','ตรวจข้อมูลไม่ครบหรือไม่คุ้นเคย','คุ้มครองสิทธิ์และความเป็นธรรม','ประเมินผลก่อนอนุมัติ','เปรียบเทียบทางเลือกก่อนดำเนินการ','กำหนดเงื่อนไขการตัดสินใจ','ทบทวนผลกระทบต่อผู้ใช้','ติดตามผลหลังให้คำแนะนำ','จำกัดขอบเขตการตัดสินใจอัตโนมัติ','ใช้ทางเลือกปลอดภัยเมื่อไม่แน่ใจ','ทดสอบกรณีผิดปกติ','จัดลำดับความสำคัญของผู้ใช้','ตรวจคุณภาพข้อมูลรับเข้า','ยืนยันผลก่อนแจ้งผู้ใช้','รับมือข้อร้องเรียนอย่างโปร่งใส'];

  function history(){
    const current=read(HISTORY,{rounds:[]});
    current.rounds=Array.isArray(current.rounds)?current.rounds.slice(-WINDOW):[];
    return current;
  }
  function hasDuplicate(deck){
    const values=(deck?.cards||[]).map(card=>tidy(card?.context)).filter(Boolean);
    return !values.length||new Set(values).size!==values.length;
  }
  function replaceEverywhere(text,from,to){
    const source=String(text||'');
    return from&&source.includes(from)?source.split(from).join(to):source;
  }
  function semanticLens(card,index){
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
    return lenses[(hash(String(card?.id||'')+'|'+index)%lenses.length)];
  }
  function candidate(deck,card,index,blocked,used){
    const list=places[MID]||places.default;
    const round=Number(deck?.round||0)||1;
    const lens=semanticLens(card,index);
    const seed=hash(String(deck?.id||'')+'|'+String(card?.id||'')+'|'+index+'|'+round);
    for(let offset=0;offset<list.length*3;offset++){
      const place=list[(seed+offset*7)%list.length];
      const title=lens+' • '+place;
      if(!blocked.has(title)&&!used.has(title))return {place,lens,title};
    }
    const place=list[index%list.length];
    return {place,lens:lens+' #'+(index+1),title:lens+' #'+(index+1)+' • '+place};
  }
  function normalize(deck,record){
    if(!deck||!Array.isArray(deck.cards)||!deck.cards.length)return deck;
    const oldHistory=history();
    const blocked=new Set(oldHistory.rounds.flatMap(row=>Array.isArray(row.contexts)?row.contexts:[]));
    const used=new Set();
    deck.cards.forEach((card,index)=>{
      const old=tidy(card?.context);
      const choice=candidate(deck,card,index,blocked,used);
      card.contextBase=choice.place;
      card.scenarioFocus=choice.lens;
      card.context=choice.title;
      card.contextSignature=choice.title;
      card.prompt=replaceEverywhere(card.prompt,old,choice.title);
      card.__hardContextGateV682=true;
      used.add(choice.title);
    });
    deck.contextAudit={version:'v6.8.2',hardGate:true,unique:used.size===deck.cards.length,count:used.size,window:WINDOW};
    if(record){
      const already=oldHistory.rounds.some(row=>String(row.deckId||'')===String(deck.id||''));
      if(!already){oldHistory.rounds.push({deckId:String(deck.id||''),round:Number(deck.round||0),at:Date.now(),contexts:[...used]});oldHistory.rounds=oldHistory.rounds.slice(-WINDOW);write(HISTORY,oldHistory);}
    }
    return deck;
  }
  function ensure(deck,record){
    if(!deck||!Array.isArray(deck.cards)||!deck.cards.length)return deck;
    /* Normalize all decks intentionally: this is stronger than a duplicate-only patch,
       because every card must have a distinct operational identity before it is shown. */
    return normalize(deck,record);
  }
  function patchFactory(){
    const api=window.AIQuestReplayFactoryV650;
    if(!api||api.__hardContextGateV682||typeof api.makeDeck!=='function')return false;
    api.__hardContextGateV682=true;
    const original=api.makeDeck.bind(api);
    api.makeDeck=function(){
      const deck=ensure(original(),true);
      if(hasDuplicate(deck))throw new Error('CORE_CONTEXT_DUPLICATE_BLOCKED');
      return deck;
    };
    return true;
  }
  function normalizeActive(){
    const snapshot=read(ACTIVE,null);
    if(!snapshot?.deck||snapshot.saved)return;
    ensure(snapshot.deck,false);
    write(ACTIVE,snapshot);
  }
  function refreshCards(){
    const deck=read(ACTIVE,null)?.deck;
    if(!deck)return;
    document.querySelectorAll('.cev-case[data-value]').forEach(button=>{
      const card=deck.cards.find(row=>String(row?.id||'')===String(button.dataset.value||''));
      if(!card)return;
      const title=button.querySelector('.cev-context');
      if(title)title.textContent=card.context;
      const detail=button.querySelector('.aiquest-case-prompt-v677,.aiquest-case-prompt-v676');
      if(detail){const prompt=tidy(card.prompt);detail.innerHTML='<b>โจทย์:</b> '+prompt.slice(0,132)+(prompt.length>132?'…':'');}
    });
  }
  function apply(){patchFactory();normalizeActive();refreshCards();}
  new MutationObserver(()=>setTimeout(apply,0)).observe(document.body,{childList:true,subtree:true});
  setInterval(apply,160);apply();
})();
