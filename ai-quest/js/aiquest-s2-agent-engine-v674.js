/* CSAI2102 AI Quest — S2 Agent Builder Student Engine v6.7.6
   Recovery hotfix: unfinished Deck survives refresh; Start never depends on optional decorators.
*/
(()=>{'use strict';
  const $=id=>document.getElementById(id);
  const MID='s2';
  const CORE='CSAI2102_CORE3_MECHANIC_V640';
  const LEGACY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const STRICT='CSAI2102_CORE3_STRICT_V650';
  const ACTIVE='CSAI2102_ACTIVE_S2_V674';
  const VERSION='v6.7.6-s2-agent-recovery';
  let state=null;
  let starting=false;

  const number=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const shuffle=a=>{const x=[...(a||[])];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]]}return x};
  const uid=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
  const read=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value==null?fallback:value}catch(e){return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}};
  const remove=key=>{try{localStorage.removeItem(key)}catch(e){}};

  function profile(){try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return{}}}
  function readyProfile(){const p=profile();return !!(String(p.studentId||'').trim()&&String(p.studentName||p.name||'').trim()&&String(p.section||'101')==='101')}
  function priorPassed(){
    const core=read(CORE,{}),legacy=read(LEGACY,{});
    const hit=store=>!!((store.completed&&((store.completed.s1)||(store.completed.m1)))||(store.mastered&&((store.mastered.s1)||(store.mastered.m1)))||number(store.stars&&((store.stars.s1)||(store.stars.m1)))>0||number(store.best&&((store.best.s1)||(store.best.m1)))>=60||number(store.bestScore&&((store.bestScore.s1)||(store.bestScore.m1)))>=60);
    return hit(core)||hit(legacy);
  }
  function screen(id){document.querySelectorAll('.screen').forEach(node=>node.classList.remove('on'));const node=$(id);if(node)node.classList.add('on');window.scrollTo({top:0,behavior:'smooth'})}
  function toast(text){const node=$('toast');if(!node)return;node.textContent=text;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2400)}
  function notice(text,kind){const node=$('saveNote');if(!node)return;node.className='notice '+(kind||'');node.innerHTML=text}

  function clearRun(){remove(ACTIVE)}
  function saveRun(){
    if(!state)return;
    try{write(ACTIVE,JSON.parse(JSON.stringify({...state,timer:null,missionId:MID,snapshotAt:Date.now()})))}catch(e){}
  }
  function loadRun(){
    const saved=read(ACTIVE,null);
    if(!saved||saved.missionId!==MID||!saved.deck||!Array.isArray(saved.deck.cards)||!saved.deck.cards.length){clearRun();return null}
    saved.timer=null;saved.index=Math.max(0,number(saved.index));return saved;
  }

  function entry(){
    const p=profile(),open=priorPassed();
    $('sid').value=p.studentId||'';$('name').value=p.studentName||p.name||'';$('section').value='101';
    $('status').textContent=open?'พร้อมเริ่ม':'ยังล็อก';$('status').className='value '+(open?'ok':'warn');
    $('entryGate').textContent=open?'ผ่าน S1 แล้ว • เริ่ม S2 ได้':'ต้องผ่าน S1 ก่อน จึงเปิด S2';
    $('start').disabled=!open;$('start').textContent='▶ สร้าง S2 Deck ใหม่';profileStatus();
  }
  function profileStatus(){const p=profile();if(readyProfile()){$('profileNote').className='notice good';$('profileNote').textContent='✓ พร้อมแล้ว: '+p.studentId+' • '+(p.studentName||p.name)+' • Section 101'}else{$('profileNote').className='notice';$('profileNote').textContent='กรอกรหัสนักศึกษาและชื่อ แล้วกดบันทึกข้อมูลก่อนเริ่ม'}}
  async function saveProfile(){
    const id=$('sid').value.trim(),name=$('name').value.trim();
    if(!id||!name){$('profileNote').className='notice bad';$('profileNote').textContent='กรุณากรอกรหัสนักศึกษาและชื่อให้ครบ';return}
    let p={studentId:id,studentName:name,section:'101'};try{p=window.AIQuestStorage?.saveProfile?.(p)||p}catch(e){}
    let sent=false;try{await window.AIQuestSync?.submitProfile?.(p);sent=true}catch(e){}
    $('profileNote').className='notice good';$('profileNote').textContent=(sent?'✓ บันทึกและส่งข้อมูลแล้ว: ':'✓ บันทึกในเครื่องแล้ว: ')+p.studentId+' • '+p.studentName+' • Section 101';toast('บันทึก Profile แล้ว');
  }
  async function waitForDecorators(){
    const ready=window.AIQuestS2DecoratorsReady;
    if(!ready||typeof ready.then!=='function')return;
    try{await Promise.race([ready,new Promise(resolve=>setTimeout(resolve,1600))])}catch(e){}
  }
  function blankSkills(){return {'PEAS ครบองค์ประกอบ':{correct:0,total:0},'Sensor / Actuator':{correct:0,total:0},'Performance measure':{correct:0,total:0},'Rational action':{correct:0,total:0},'Human oversight':{correct:0,total:0},'Agent concept':{correct:0,total:0},'Sensor reliability':{correct:0,total:0},'Environment':{correct:0,total:0},'Why PEAS':{correct:0,total:0},'Trade-off':{correct:0,total:0},'Rationality':{correct:0,total:0},'Audit trail':{correct:0,total:0},'Human override':{correct:0,total:0},'Scope boundary':{correct:0,total:0},'Agent test':{correct:0,total:0}}}
  async function begin(){
    if(starting)return;
    if(!readyProfile()){toast('กรุณาบันทึกข้อมูลก่อนเริ่ม');$('sid').focus();return}
    if(!priorPassed()){toast('S2 ยังล็อก ต้องผ่าน S1 ก่อน');entry();return}
    starting=true;const startBtn=$('start'),original=startBtn.textContent;startBtn.disabled=true;startBtn.textContent='กำลังเตรียม S2 Deck…';
    await waitForDecorators();
    const deck=window.AIQuestS2AgentDeckV672?.buildDeck?.();
    startBtn.textContent=original;startBtn.disabled=!priorPassed();starting=false;
    if(!deck||!Array.isArray(deck.cards)||!deck.cards.length){toast('สร้าง S2 Replay Deck ไม่สำเร็จ — ลองกดเริ่มใหม่ได้ทันที');return}
    clearRun();
    state={attemptId:uid('s2att'),deck,index:0,correct:0,mechanic:0,knowledge:0,twist:0,combo:0,comboMax:0,hints:3,hintsUsed:0,wrong:[],skills:blankSkills(),startedAt:Date.now(),ended:false,saved:false,answered:false,timer:null};
    $('gameTitle').textContent='S2 • Agent Builder';$('gameSub').textContent='Deck #'+deck.round+' • 15 เคส • กันซ้ำ '+deck.usedWindow+' รอบล่าสุด';screen('game');draw();
  }
  function seconds(card){if(card.subtype==='map')return 58;if(card.kind==='twist')return 48;if(card.kind==='m')return 40;return 34}
  function hud(){
    if(!state)return;
    const card=state.deck.cards[state.index],pct=Math.max(0,state.left/state.maxSec*100);
    $('hud').innerHTML='<div class="hud"><span class="chip">⏱ '+Math.max(0,state.left)+' วินาที</span><span class="chip">'+esc(card.phase)+'</span><span class="chip">🎯 '+(state.index+1)+'/15</span><span class="chip">🔥 x'+state.combo+'</span><span class="chip">🧠 '+state.hints+'</span><div class="bar"><i style="width:'+pct+'%"></i></div></div>';
  }
  function clock(sec){
    if(!state)return;
    clearInterval(state.timer);state.left=sec;state.maxSec=sec;hud();
    state.timer=setInterval(()=>{if(!state||state.ended)return;state.left--;hud();if(state.left<=0){clearInterval(state.timer);timeout()}},1000);
  }
  function taskLabel(card){return card.kind==='m'?'Mission Mechanic':card.kind==='q'?'Analysis Case':'⚡ Case Twist'}
  function hint(card){
    if(!state)return;
    if(state.hints<1){toast('ใช้คำใบ้ครบแล้ว');return}
    state.hints--;state.hintsUsed++;const message=card.subtype==='map'?'อ่านคำสำคัญ: P คือความสำเร็จ, E คือโลกที่พบ, A คือสิ่งที่กระทำ, S คือสิ่งที่รับรู้':'ตัดตัวเลือกที่เดาสุ่ม ซ่อนข้อจำกัด หรือไม่คำนึงถึงผลกระทบออกก่อน';feedback('<b>🧠 คำใบ้</b><br>'+message,'help');$('hint').disabled=true;hud();saveRun();
  }
  function frame(card,body){
    $('arena').innerHTML='<section class="arena '+(card.kind==='twist'?'twistArena':'')+'"><div class="arenaHead"><div><h3>🧩 '+esc(card.phase)+'</h3><p class="muted">'+esc(taskLabel(card))+' • '+esc(card.context)+'</p></div><div class="arenaIcon">'+(card.kind==='twist'?'⚡':'🧩')+'</div></div><div class="agentMeter"><span>PERCEPT</span><b>→</b><span>AGENT</span><b>→</b><span>ACTION</span></div>'+body+'<div class="row actionRow"><button id="next" class="btn" disabled>'+(state.index===14?'สรุปผลภารกิจ':'เคสถัดไป')+'</button><button id="hint" class="btn secondary">🧠 ขอคำใบ้</button></div><div id="feedback" class="feedback"></div></section>';
    $('next').onclick=()=>{if(!state||state.ended||!state.answered)return;$('next').disabled=true;state.answered=false;state.index++;saveRun();draw()};
    $('hint').onclick=()=>hint(card);
  }
  function draw(){
    if(!state)return;
    if(state.index>=state.deck.cards.length){finish();return}
    state.answered=false;const card=state.deck.cards[state.index];
    if(card.subtype==='map')drawMap(card);else drawChoice(card);
    saveRun();clock(seconds(card));
  }
  function drawMap(card){
    const selectors=card.cards.map((item,index)=>'<div class="mapRow"><div class="mapCard"><b>ข้อมูล '+(index+1)+'</b><br>'+esc(item.text)+'</div><select class="slotSelect" data-slot="'+index+'"><option value="">เลือกหมวด</option>'+shuffle(card.labels).map(label=>'<option value="'+esc(label)+'">'+esc(label)+'</option>').join('')+'</select></div>').join('');
    frame(card,'<div class="question">'+esc(card.prompt)+'</div><div class="peasLegend">P = ความสำเร็จ &nbsp; E = โลกที่พบ &nbsp; A = สิ่งที่ทำ &nbsp; S = สิ่งที่รับรู้</div><div class="mapBoard">'+selectors+'</div><button id="checkMap" class="btn good">✓ ตรวจ Agent Board</button>');
    $('checkMap').onclick=()=>{const selected=[...document.querySelectorAll('.slotSelect')].map(node=>node.value);if(selected.some(v=>!v)){toast('เลือกหมวดให้ครบทั้ง 4 ข้อก่อน');return}const right=card.cards.reduce((sum,item,index)=>sum+(selected[index]===item.answer?1:0),0);answerMap(card,right,selected)};
  }
  function drawChoice(card){
    const options=shuffle([card.correct,...card.wrong.slice(0,3)]);
    frame(card,'<div class="question">'+esc(card.prompt)+'</div><div class="choices">'+options.map((option,index)=>'<button class="choice" data-choice="'+index+'">'+esc(option)+'</button>').join('')+'</div>');
    document.querySelectorAll('[data-choice]').forEach(node=>node.onclick=()=>answerChoice(card,options[number(node.dataset.choice)],false));
  }
  function skill(card,ok){if(!state.skills[card.skill])state.skills[card.skill]={correct:0,total:0};state.skills[card.skill].total++;if(ok)state.skills[card.skill].correct++}
  function mark(card,ok,detail,trustedHtml){
    if(!state||state.answered||state.ended)return;
    state.answered=true;clearInterval(state.timer);skill(card,ok);
    if(ok){state.correct++;state.combo++;state.comboMax=Math.max(state.comboMax,state.combo);if(card.kind==='m')state.mechanic++;else if(card.kind==='q')state.knowledge++;else state.twist++}
    else{state.combo=0;state.wrong.push({phase:card.phase,skill:card.skill,prompt:card.prompt,correct:card.correct||'จัดวาง PEAS ให้ถูกต้อง',explain:card.explain})}
    $('next').disabled=false;hud();const safeDetail=trustedHtml?String(detail||''):esc(detail||card.explain);feedback(ok?'<b>✅ Agent Decision ถูกต้อง</b><br>'+safeDetail:'<b>⚠️ Case Intel</b><br>'+safeDetail,ok?'good':'bad');saveRun();
  }
  function answerMap(card,right,selected){
    if(!state||state.answered)return;
    document.querySelectorAll('.slotSelect').forEach((node,index)=>{node.disabled=true;node.classList.add(selected[index]===card.cards[index].answer?'slotOk':'slotNo')});$('checkMap').disabled=true;
    const ok=right>=3,correctList=card.cards.map((item,index)=>'<li><b>'+esc(item.answer)+'</b>: '+esc(item.text)+(selected[index]===item.answer?' ✓':' ✦')+'</li>').join(''),prefix=ok?'จัด PEAS ถูกต้อง '+right+'/4 ข้อ':'จัด PEAS ถูกต้อง '+right+'/4 ข้อ — ต้องอย่างน้อย 3/4 จึงผ่าน Mechanic',detail='<div>'+esc(prefix)+'</div><ul class="answerList">'+correctList+'</ul><div>'+esc(card.explain)+'</div>';
    mark(card,ok,detail,true);
  }
  function answerChoice(card,value,isTimeout){
    if(!state||state.answered||state.ended)return;
    const ok=value===card.correct;
    document.querySelectorAll('[data-choice]').forEach(node=>{node.disabled=true;if(node.textContent===card.correct)node.classList.add('ok');else if(node.textContent===value)node.classList.add('no')});
    mark(card,ok,ok?card.explain:(isTimeout?'หมดเวลา — ':'คำตอบที่เหมาะสม: '+card.correct+' • ')+card.explain);
  }
  function timeout(){
    if(!state||state.ended||state.answered)return;
    const card=state.deck.cards[state.index];
    if(card.subtype==='map'){document.querySelectorAll('.slotSelect').forEach(node=>node.disabled=true);$('checkMap').disabled=true;mark(card,false,'หมดเวลา — PEAS ที่ถูกต้องคือ P = ความสำเร็จ, E = สภาพแวดล้อม, A = ตัวกระทำ, S = เซนเซอร์ • '+card.explain)}else answerChoice(card,null,true);
  }
  function feedback(html,kind){const node=$('feedback');if(!node)return;node.className='feedback show '+(kind||'');node.innerHTML=html}
  const ratio=(a,b)=>b?Math.round(a/b*100):0;
  function finish(){
    if(!state||state.ended)return;
    state.ended=true;clearInterval(state.timer);
    const mechanicPct=ratio(state.mechanic,5),knowledgePct=ratio(state.knowledge,8),twistPct=ratio(state.twist,2),score=Math.round(mechanicPct*.35+knowledgePct*.45+twistPct*.20),pass=score>=60&&state.mechanic>=3&&state.knowledge>=5&&state.twist>=1;
    state.result={score,pass,mechanicPct,knowledgePct,twistPct,usedSec:Math.round((Date.now()-state.startedAt)/1000)};saveRun();result();
  }
  function result(){
    if(!state||!state.result)return;
    const r=state.result;$('resultTitle').textContent='ผล S2: Agent Builder';$('badge').textContent=r.pass?'✅ ผ่าน Agent Builder แล้ว':'🔁 ยังไม่ผ่าน ลอง Deck ใหม่ได้';$('score').textContent=r.score;$('stars').textContent='★'.repeat(r.score>=85?3:r.score>=70?2:r.score>=60?1:0)+'☆'.repeat(r.score>=85?0:r.score>=70?1:r.score>=60?2:3);$('resultText').textContent=r.pass?'ผ่านครบ: Mechanic ≥3/5 • Analysis ≥5/8 • Case Twist ≥1/2':'ต้องผ่านทั้ง 3 ส่วน: Mechanic ≥3/5 • Analysis ≥5/8 • Case Twist ≥1/2';
    $('summary').innerHTML=[['🧩 Agent Mechanic',state.mechanic+'/5 • '+r.mechanicPct+'%',state.mechanic>=3?'good':'warn'],['📘 Analysis Case',state.knowledge+'/8 • '+r.knowledgePct+'%',state.knowledge>=5?'good':'warn'],['⚡ Case Twist',state.twist+'/2 • '+r.twistPct+'%',state.twist>=1?'good':'warn'],['🔥 Combo สูงสุด','x'+state.comboMax+'/15','good'],['⏱ เวลาที่ใช้',r.usedSec+' วินาที','']].map(row=>'<div class="cell '+row[2]+'"><b>'+row[0]+'</b><br>'+row[1]+'</div>').join('');
    const weak=Object.entries(state.skills||{}).filter(([,x])=>x.total&&x.correct<x.total).map(([name,x])=>'<li><b>'+esc(name)+'</b> '+x.correct+'/'+x.total+'</li>').join('');
    $('skillIntel').innerHTML=weak?'<b>Agent Skill Intel สำหรับรอบถัดไป</b><ul>'+weak+'</ul>':'<b>Perfect Agent Builder!</b><p class="muted">ทำถูกครบทุกองค์ประกอบใน Deck นี้</p>';
    $('review').innerHTML=state.wrong.length?'<b>Case Intel</b>'+state.wrong.map(item=>'<div class="wrong"><b>'+esc(item.phase)+' • '+esc(item.skill)+'</b><br>'+esc(item.prompt)+'<br><b>คำตอบ/หลักการ:</b> '+esc(item.correct)+'<br>'+esc(item.explain)+'</div>').join(''):'<b>Perfect Deck!</b><p class="muted">ตอบถูกครบทุก Case</p>';
    $('r1').placeholder='อย่างน้อย 55 ตัวอักษร: อธิบาย PEAS หรือหลักฐานจากหนึ่ง Case ที่ใช้ตัดสินใจ';$('r2').placeholder='อย่างน้อย 55 ตัวอักษร: อธิบายการออกแบบ Agent ที่รับผิดชอบและปลอดภัย';$('r3').placeholder='อย่างน้อย 55 ตัวอักษร: ระบุคนที่ควรตรวจทานและสิ่งที่ต้องทบทวน';
    notice(state.saved?'✓ ส่งผลเรียบร้อยแล้ว':'เขียน Reflection เป็นคำตอบของตนเอง แล้วกดส่งผลเข้า Google Sheets',state.saved?'good':'');$('save').disabled=!!state.saved;$('save').textContent=state.saved?'✓ ส่งผลแล้ว':'ส่งผลเข้า Google Sheets';screen('result');
  }
  function skillSummary(){const out={};Object.keys(state.skills||{}).forEach(key=>{const item=state.skills[key];if(item.total)out[key]={correct:item.correct,total:item.total,accuracy:ratio(item.correct,item.total)}});return out}
  async function submit(){
    if(!state||!state.result||state.saved)return;
    const reflections=['r1','r2','r3'].map(id=>$(id).value.trim());
    if(reflections.some(text=>text.replace(/\s/g,'').length<55)){notice('<b>ยังส่งผลไม่ได้</b><br>Reflection ต้องมีอย่างน้อย 55 ตัวอักษรต่อข้อ','bad');return}
    $('save').disabled=true;$('save').textContent='กำลังบันทึก…';
    const p=profile(),r=state.result,payload={attemptId:state.attemptId,studentId:p.studentId,studentName:p.studentName||p.name,section:'101',sessionId:'s2',missionId:'s2',missionTitle:'Agent Builder • PEAS',difficulty:state.deck.round>2?'stretch':'core',score:r.score,stars:r.score>=85?3:r.score>=70?2:r.score>=60?1:0,gateStatus:r.pass?'passed':'review',mastered:r.score>=85,usedTimeSec:r.usedSec,accuracy:Math.round(state.correct/15*100),correct:state.correct,total:15,wrong:state.wrong.length,maxCombo:state.comboMax,helpUsed:state.hintsUsed,bossWin:false,reflection1:reflections[0],reflection2:reflections[1],reflection3:reflections[2],clientTs:new Date().toISOString(),schemaVersion:VERSION,runMode:'graded',isPractice:false,isGraded:true,extraJson:{gameplayMode:'s2-agent-builder',replayDeckId:state.deck.id,replayRound:state.deck.round,noRepeatWindow:state.deck.usedWindow,deckTotal:15,mechanicCases:5,knowledgeCases:8,twistCases:2,mechanicCorrect:state.mechanic,knowledgeCorrect:state.knowledge,twistCorrect:state.twist,mechanicAccuracy:r.mechanicPct,quizAccuracy:r.knowledgePct,boardAccuracy:r.twistPct,s2Skills:skillSummary(),passRules:'score>=60,m>=3/5,q>=5/8,t>=1/2'}};
    let sent=false;try{await window.AIQuestSync?.submitAttempt?.(payload);sent=true}catch(e){}
    if(r.pass){const core=read(CORE,{completed:{},best:{}});core.completed=core.completed||{};core.best=core.best||{};core.completed.s2=true;core.best.s2=Math.max(number(core.best.s2),r.score);write(CORE,core);const strict=read(STRICT,{});strict.s2={score:r.score,mechanic:state.mechanic,knowledge:state.knowledge,twist:state.twist,at:Date.now(),version:VERSION};write(STRICT,strict)}
    state.saved=true;$('save').textContent='✓ ส่งผลแล้ว';notice(sent?'✓ ส่งผลเข้า Google Sheets แล้ว':'✓ บันทึกในเครื่องแล้ว ระบบจะซิงก์เมื่อเชื่อมต่อได้','good');clearRun();toast('บันทึกผล S2 แล้ว');
  }
  function exit(){if(confirm('ต้องการออกจาก S2 หรือไม่? ผลรอบนี้จะไม่ถูกบันทึก')){clearInterval(state?.timer);clearRun();state=null;screen('entry');entry()}}
  function restoreRun(){
    const saved=loadRun();if(!saved)return false;
    state=saved;if(!state.skills)state.skills=blankSkills();
    if(state.ended&&state.result){result();toast('คืนหน้าสรุปรอบเดิมแล้ว');return true}
    if(state.answered){state.index++;state.answered=false}
    if(state.index>=state.deck.cards.length){finish();return true}
    state.ended=false;$('gameTitle').textContent='S2 • Agent Builder';$('gameSub').textContent='คืนรอบ Deck #'+state.deck.round+' • เคส '+(state.index+1)+'/15';screen('game');draw();toast('คืน S2 Deck ที่ค้างไว้แล้ว');return true;
  }

  $('saveProfile').onclick=saveProfile;$('start').onclick=begin;$('exit').onclick=exit;$('save').onclick=submit;$('replay').onclick=()=>{clearInterval(state?.timer);clearRun();state=null;screen('entry');entry();begin()};
  window.addEventListener('pagehide',()=>{if(state&&!state.saved)saveRun()});
  entry();restoreRun();
})();
