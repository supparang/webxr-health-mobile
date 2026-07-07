/* CSAI2102 AI Quest — S2 Stable Engine v7.0.1
   Direct event handlers only. No polling, no MutationObserver, no recovery loops.
*/
(()=>{'use strict';
  if(window.__AIQUEST_S2_ENGINE_STABLE_V701__)return;
  window.__AIQUEST_S2_ENGINE_STABLE_V701__=true;
  const $=id=>document.getElementById(id);
  const MID='s2',ACTIVE='CSAI2102_ACTIVE_S2_V674',CORE='CSAI2102_CORE3_MECHANIC_V640',LEGACY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS',STRICT='CSAI2102_CORE3_STRICT_V650',VERSION='v7.0.1-s2-stable';
  let state=null,starting=false,timerId=null;
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const remove=k=>{try{localStorage.removeItem(k)}catch(e){}};
  const shuffle=list=>{const a=[...(list||[])];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const uid=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
  const profile=()=>{try{return window.AIQuestStorage?.getProfile?.()||read('CSAI2102_AIQUEST_PROFILE_V421',{})}catch(e){return {}}};
  const readyProfile=()=>{const p=profile();return !!(String(p.studentId||'').trim()&&String(p.studentName||p.name||'').trim()&&String(p.section||'101')==='101');};
  const priorPassed=()=>{
    const valid=store=>!!((store.completed&&(store.completed.s1||store.completed.m1))||(store.mastered&&(store.mastered.s1||store.mastered.m1))||num(store.stars&&(store.stars.s1||store.stars.m1))>0||num(store.best&&(store.best.s1||store.best.m1))>=60||num(store.bestScore&&(store.bestScore.s1||store.bestScore.m1))>=60);
    return valid(read(CORE,{}))||valid(read(LEGACY,{}));
  };
  const blankSkills=()=>({'PEAS ครบองค์ประกอบ':{correct:0,total:0},'Sensor / Actuator':{correct:0,total:0},'Performance measure':{correct:0,total:0},'Rational action':{correct:0,total:0},'Human oversight':{correct:0,total:0},'Agent concept':{correct:0,total:0},'Sensor reliability':{correct:0,total:0},'Environment':{correct:0,total:0},'Why PEAS':{correct:0,total:0},'Safety Trade-off':{correct:0,total:0},'Rationality':{correct:0,total:0},'Audit trail':{correct:0,total:0},'Scope boundary':{correct:0,total:0},'Case Twist: safe fallback':{correct:0,total:0},'Case Twist: user rights':{correct:0,total:0}});
  function clearTimer(){if(timerId){clearInterval(timerId);timerId=null;}}
  function screen(id){document.querySelectorAll('.screen').forEach(node=>node.classList.remove('on'));const node=$(id);if(node)node.classList.add('on');window.scrollTo({top:0,behavior:'auto'});}
  function toast(text){const node=$('toast');if(!node)return;node.textContent=text;node.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>node.classList.remove('show'),2200);}
  function notice(html,kind){const node=$('saveNote');if(!node)return;node.className='notice '+(kind||'');node.innerHTML=html;}
  function saveRun(){if(!state)return;const snapshot={...state,timer:null,missionId:MID,snapshotAt:Date.now()};write(ACTIVE,snapshot);}
  function clearRun(){remove(ACTIVE);}
  function activeRun(){const saved=read(ACTIVE,null);if(!saved||saved.missionId!==MID||!saved.deck||!Array.isArray(saved.deck.cards)||!saved.deck.cards.length){return null;}saved.index=Math.max(0,num(saved.index));saved.timer=null;return saved;}
  function entry(){
    const p=profile(),open=priorPassed();
    $('sid').value=p.studentId||'';$('name').value=p.studentName||p.name||'';$('section').value='101';
    $('status').textContent=open?'พร้อมเริ่ม':'ยังล็อก';$('status').className='value '+(open?'ok':'warn');
    const deckReady=window.AIQuestS2AgentDeckV672?.semanticDeckReady===true;
    $('entryGate').innerHTML=open&&deckReady?'ผ่าน S1 แล้ว • <b style="color:#bbf7d0">✓ S2 Stable Semantic Deck พร้อมสร้าง</b><br><small>Context 15/15 • Concept 15/15 • Source 15/15 • Prompt pattern 15/15 • Answer slots 4/3/3/3</small>':(open?'กำลังเตรียม S2 Deck…':'ต้องผ่าน S1 ก่อน จึงเปิด S2');
    $('start').disabled=!open||!deckReady;$('start').textContent='▶ สร้าง S2 Deck ใหม่';profileStatus();
  }
  function profileStatus(){const p=profile();if(readyProfile()){$('profileNote').className='notice good';$('profileNote').textContent='✓ พร้อมแล้ว: '+p.studentId+' • '+(p.studentName||p.name)+' • Section 101';}else{$('profileNote').className='notice';$('profileNote').textContent='กรอกรหัสนักศึกษาและชื่อ แล้วกดบันทึกข้อมูลก่อนเริ่ม';}}
  async function saveProfile(){
    const studentId=$('sid').value.trim(),studentName=$('name').value.trim();
    if(!studentId||!studentName){$('profileNote').className='notice bad';$('profileNote').textContent='กรุณากรอกรหัสนักศึกษาและชื่อให้ครบ';return;}
    let p={studentId,studentName,section:'101'};try{p=window.AIQuestStorage?.saveProfile?.(p)||p;}catch(e){}
    let sent=false;try{await window.AIQuestSync?.submitProfile?.(p);sent=true;}catch(e){}
    $('profileNote').className='notice good';$('profileNote').textContent=(sent?'✓ บันทึกและส่งข้อมูลแล้ว: ':'✓ บันทึกในเครื่องแล้ว: ')+p.studentId+' • '+p.studentName+' • Section 101';toast('บันทึก Profile แล้ว');
  }
  function newState(deck){return {attemptId:uid('s2att'),deck,index:0,correct:0,mechanic:0,knowledge:0,twist:0,combo:0,comboMax:0,hints:3,hintsUsed:0,wrong:[],skills:blankSkills(),startedAt:Date.now(),ended:false,saved:false,answered:false,feedbackShown:false,evidence:null,result:null};}
  function start(){
    if(starting)return;
    if(!readyProfile()){toast('กรุณาบันทึกข้อมูลก่อนเริ่ม');$('sid').focus();return;}
    if(!priorPassed()){toast('S2 ยังล็อก ต้องผ่าน S1 ก่อน');entry();return;}
    const factory=window.AIQuestS2AgentDeckV672?.buildDeck;
    if(typeof factory!=='function'){toast('S2 Deck ยังไม่พร้อม ลองรีเฟรชหน้าอีกครั้ง');return;}
    starting=true;const button=$('start'),original=button.textContent;button.disabled=true;button.textContent='กำลังสร้าง S2 Deck…';
    try{const deck=factory();if(!deck?.semanticAudit?.ok||!Array.isArray(deck.cards)||deck.cards.length!==15)throw new Error('S2_DECK_NOT_READY');clearRun();state=newState(deck);$('gameTitle').textContent='S2 • Agent Builder';$('gameSub').textContent=deckLine(deck);screen('game');renderCard();}
    catch(error){console.error('[S2 stable] start error',error);toast('สร้าง S2 Deck ไม่สำเร็จ — ลองกดเริ่มใหม่');}
    finally{button.textContent=original;button.disabled=!priorPassed();starting=false;}
  }
  function deckLine(deck){const a=deck?.semanticAudit||{},slots=(deck?.answerPositionAudit?.plannedSlots||a.answerSlots||[]).join('/');return 'Deck #'+String(deck?.round||'—')+' • 15 เคส / 3 Phase • Context unique '+String(a.contextUnique||0)+'/15 • Concept '+String(a.conceptUnique||0)+'/15 • Source '+String(a.sourceUnique||0)+'/15 • Prompt pattern '+String(a.promptPatternUnique||0)+'/15 • Answer slots '+slots;}
  function seconds(card){return card?.subtype==='map'?58:card?.kind==='twist'?48:card?.kind==='m'?40:34;}
  function renderHud(){
    if(!state)return;const card=state.deck.cards[state.index],pct=Math.max(0,num(state.left)/num(state.maxSec)*100);
    $('hud').innerHTML='<div class="hud"><span class="chip">⏱ '+Math.max(0,num(state.left))+' วินาที</span><span class="chip">'+esc(card.phase)+'</span><span class="chip">🎯 '+(state.index+1)+'/15</span><span class="chip">🔥 x'+state.combo+'</span><span class="chip">🧠 '+state.hints+'</span><div class="bar"><i style="width:'+pct+'%"></i></div></div>';
  }
  function beginClock(sec){clearTimer();if(!state)return;state.left=sec;state.maxSec=sec;renderHud();timerId=setInterval(()=>{if(!state||state.ended||state.answered){clearTimer();return;}state.left--;renderHud();if(state.left<=0){clearTimer();timeout();}},1000);}
  function commonFrame(card,inner){
    $('arena').innerHTML='<section class="arena '+(card.kind==='twist'?'twistArena':'')+'"><div class="arenaHead"><div><h3>🧩 '+esc(card.phase)+'</h3><p class="muted">'+esc(card.kind==='m'?'Mission Mechanic':card.kind==='q'?'Analysis Case':'⚡ Case Twist')+' • '+esc(card.context)+'</p></div><div class="arenaIcon">'+(card.kind==='twist'?'⚡':'🧩')+'</div></div><div class="agentMeter"><span>PERCEPT</span><b>→</b><span>AGENT</span><b>→</b><span>ACTION</span></div>'+inner+'<div class="row actionRow"><button id="next" class="btn" disabled>'+((state.index===14)?'สรุปผลภารกิจ':'เคสถัดไป')+'</button><button id="hint" class="btn secondary">🧠 ขอคำใบ้</button></div><div id="feedback" class="feedback"></div></section>';
    $('next').onclick=advance;$('hint').onclick=()=>hint(card);
  }
  function renderCard(){
    if(!state)return;
    if(state.index>=state.deck.cards.length){finish();return;}
    clearTimer();state.answered=false;state.feedbackShown=false;const card=state.deck.cards[state.index];
    if(card.subtype==='map')renderMap(card);else renderChoice(card);
    saveRun();beginClock(seconds(card));
  }
  function renderMap(card){
    const html=card.cards.map((item,index)=>'<div class="mapRow"><div class="mapCard"><b>ข้อมูล '+(index+1)+'</b><br>'+esc(item.text)+'</div><select class="slotSelect" data-slot="'+index+'"><option value="">เลือกหมวด</option>'+shuffle(card.labels).map(label=>'<option value="'+esc(label)+'">'+esc(label)+'</option>').join('')+'</select></div>').join('');
    commonFrame(card,'<div class="question">'+esc(card.prompt)+'</div><div class="peasLegend">P = ความสำเร็จ &nbsp; E = โลกที่พบ &nbsp; A = สิ่งที่ทำ &nbsp; S = สิ่งที่รับรู้</div><div class="mapBoard">'+html+'</div><button id="checkMap" class="btn good">✓ ตรวจ Agent Board</button>');
    $('checkMap').onclick=()=>{if(!state||state.answered)return;const chosen=[...$('arena').querySelectorAll('.slotSelect')].map(node=>node.value);if(chosen.some(v=>!v)){toast('เลือกหมวดให้ครบก่อน');return;}const correct=card.cards.reduce((sum,item,index)=>sum+(chosen[index]===item.answer?1:0),0);$('arena').querySelectorAll('.slotSelect').forEach((node,index)=>{node.disabled=true;node.classList.add(chosen[index]===card.cards[index].answer?'slotOk':'slotNo');});$('checkMap').disabled=true;const detail='จัด Agent Board ถูกต้อง '+correct+'/4 ข้อ<br>'+esc(card.explain);mark(card,correct>=3,detail,true);};
  }
  function choiceOptions(card){
    const options=shuffle([card.correct,...card.wrong.slice(0,3)]);
    const target=Math.max(0,Math.min(3,num(card.answerSlot)));
    const correctAt=options.indexOf(card.correct);
    if(correctAt>=0&&correctAt!==target){const temp=options[target];options[target]=options[correctAt];options[correctAt]=temp;}
    return options;
  }
  function renderChoice(card){
    const options=choiceOptions(card);
    commonFrame(card,'<div class="question">'+esc(card.prompt)+'</div><div class="choices">'+options.map((option,index)=>'<button class="choice" data-choice="'+index+'">'+esc(option)+'</button>').join('')+'</div>');
    $('arena').querySelectorAll('[data-choice]').forEach(button=>{button.onclick=()=>answerChoice(card,options[num(button.dataset.choice)],false);});
  }
  function markSkill(card,ok){const item=state.skills[card.skill]||(state.skills[card.skill]={correct:0,total:0});item.total++;if(ok)item.correct++;}
  function feedback(html,kind){const node=$('feedback');if(!node)return;node.className='feedback show '+(kind||'');node.innerHTML=html;}
  function mark(card,ok,detail,isHtml){
    if(!state||state.answered||state.ended)return;
    state.answered=true;clearTimer();markSkill(card,ok);
    if(ok){state.correct++;state.combo++;state.comboMax=Math.max(state.comboMax,state.combo);if(card.kind==='m')state.mechanic++;else if(card.kind==='q')state.knowledge++;else state.twist++;}
    else{state.combo=0;state.wrong.push({phase:card.phase,skill:card.skill,prompt:card.prompt,correct:card.correct||'จัดวาง Agent Board ให้ถูกต้อง',explain:card.explain});}
    $('next').disabled=false;const nextText=state.index===14?'สรุปผลภารกิจ →':'เคสถัดไป →';$('next').textContent=nextText;renderHud();feedback(ok?'<b>✅ Agent Decision ถูกต้อง</b><br>'+(isHtml?detail:esc(detail)):'<b>⚠️ Case Intel</b><br>'+(isHtml?detail:esc(detail)),ok?'good':'bad');state.feedbackShown=true;saveRun();
  }
  function answerChoice(card,value,timedOut){
    if(!state||state.answered)return;const ok=value===card.correct;
    $('arena').querySelectorAll('[data-choice]').forEach(node=>{node.disabled=true;if(node.textContent===card.correct)node.classList.add('ok');else if(node.textContent===value)node.classList.add('no');});
    mark(card,ok,timedOut?'หมดเวลา — คำตอบที่เหมาะสมคือ '+card.correct+' • '+card.explain:(ok?card.explain:'คำตอบที่เหมาะสม: '+card.correct+' • '+card.explain),false);
  }
  function timeout(){if(!state||state.answered||state.ended)return;const card=state.deck.cards[state.index];if(card.subtype==='map'){$('arena').querySelectorAll('.slotSelect').forEach(node=>node.disabled=true);const check=$('checkMap');if(check)check.disabled=true;mark(card,false,'หมดเวลา — '+card.explain,false);}else answerChoice(card,null,true);}
  function hint(card){if(!state||state.answered)return;if(state.hints<1){toast('ใช้คำใบ้ครบแล้ว');return;}state.hints--;state.hintsUsed++;const text=card.subtype==='map'?'อ่านคำสำคัญ: P คือความสำเร็จ, E คือโลกที่พบ, A คือสิ่งที่ทำ, S คือสิ่งที่รับรู้':'ตัดตัวเลือกที่เดาสุ่ม ซ่อนข้อจำกัด หรือไม่คำนึงถึงผลกระทบออกก่อน';feedback('<b>🧠 คำใบ้</b><br>'+text,'help');$('hint').disabled=true;renderHud();saveRun();}
  function advance(){if(!state||state.ended||!state.answered)return;clearTimer();$('next').disabled=true;state.answered=false;state.index++;saveRun();renderCard();}
  const ratio=(a,b)=>b?Math.round(a/b*100):0;
  function evidenceBlock(){
    const target=$('evidence');if(!target||!state)return;const selected=state.evidence?.selectedCaseId||'';
    const options=state.deck.cards.map((card,index)=>'<option value="'+esc(card.id)+'" '+(card.id===selected?'selected':'')+'>Case '+(index+1)+' • '+esc(card.context)+' — '+esc(card.skill)+'</option>').join('');
    const card=state.deck.cards.find(item=>item.id===selected);target.innerHTML='<section style="margin-top:14px;padding:13px;border:1px solid rgba(56,189,248,.55);border-radius:15px;background:rgba(56,189,248,.08)"><b>🔗 Reflection Evidence • เลือก Case จาก Deck นี้</b><p class="muted" style="margin:5px 0 10px">เลือก 1 Case ที่เล่นจริง แล้วใช้ Case เดียวกันตอบ Reflection ทั้ง 3 ข้อ</p><select id="s2CaseEvidence" class="input"><option value="">— เลือก Case ที่ใช้เป็นหลักฐาน —</option>'+options+'</select><div id="s2EvidenceStatus" class="notice" style="margin-top:8px">'+(card?'✓ เลือกแล้ว: <b>'+esc(card.context)+'</b><br><small>Phase: '+esc(card.phase)+' • Focus: '+esc(card.skill)+' • Policy: '+esc(card.answerPolicy)+'</small>':'ยังไม่ได้เลือก Case')+'</div></section>';
    $('s2CaseEvidence').onchange=()=>{const value=$('s2CaseEvidence').value;const item=state.deck.cards.find(card=>card.id===value);state.evidence=item?{selectedCaseId:item.id,selectedCaseContext:item.context,selectedCaseSkill:item.skill,selectedCasePolicy:item.answerPolicy,selectedCaseFingerprint:item.answerFingerprint,phase:item.phase}:null;saveRun();evidenceBlock();};
  }
  function finish(){
    if(!state||state.ended)return;state.ended=true;clearTimer();const mechanicPct=ratio(state.mechanic,5),knowledgePct=ratio(state.knowledge,8),twistPct=ratio(state.twist,2),score=Math.round(mechanicPct*.35+knowledgePct*.45+twistPct*.20),pass=score>=60&&state.mechanic>=3&&state.knowledge>=5&&state.twist>=1;state.result={score,pass,mechanicPct,knowledgePct,twistPct,usedSec:Math.max(1,Math.round((Date.now()-state.startedAt)/1000))};saveRun();renderResult();}
  function renderResult(){
    if(!state?.result)return;const r=state.result;
    $('resultTitle').textContent='ผล S2: Agent Builder';$('badge').textContent=r.pass?'✅ ผ่าน Agent Builder แล้ว':'🔁 ยังไม่ผ่าน ลอง Deck ใหม่ได้';$('score').textContent=r.score;$('stars').textContent='★'.repeat(r.score>=85?3:r.score>=70?2:r.score>=60?1:0)+'☆'.repeat(r.score>=85?0:r.score>=70?1:r.score>=60?2:3);$('resultText').textContent=r.pass?'ผ่านครบ: Mechanic ≥3/5 • Analysis ≥5/8 • Case Twist ≥1/2':'ต้องผ่านทั้ง 3 ส่วน: Mechanic ≥3/5 • Analysis ≥5/8 • Case Twist ≥1/2';
    $('summary').innerHTML=[['🧩 Agent Mechanic',state.mechanic+'/5 • '+r.mechanicPct+'%',state.mechanic>=3?'good':'warn'],['📘 Analysis Case',state.knowledge+'/8 • '+r.knowledgePct+'%',state.knowledge>=5?'good':'warn'],['⚡ Case Twist',state.twist+'/2 • '+r.twistPct+'%',state.twist>=1?'good':'warn'],['🔥 Combo สูงสุด','x'+state.comboMax+'/15','good'],['⏱ เวลาที่ใช้',r.usedSec+' วินาที','']].map(row=>'<div class="cell '+row[2]+'"><b>'+row[0]+'</b><br>'+row[1]+'</div>').join('');
    const weak=Object.entries(state.skills).filter(([,item])=>item.total&&item.correct<item.total).map(([name,item])=>'<li><b>'+esc(name)+'</b> '+item.correct+'/'+item.total+'</li>').join('');$('skillIntel').innerHTML=weak?'<b>Agent Skill Intel สำหรับรอบถัดไป</b><ul>'+weak+'</ul>':'<b>Perfect Agent Builder!</b><p class="muted">ทำถูกครบทุกองค์ประกอบใน Deck นี้</p>';
    $('review').innerHTML=state.wrong.length?'<b>Case Intel</b>'+state.wrong.map(item=>'<div class="wrong"><b>'+esc(item.phase)+' • '+esc(item.skill)+'</b><br>'+esc(item.prompt)+'<br><b>คำตอบ/หลักการ:</b> '+esc(item.correct)+'<br>'+esc(item.explain)+'</div>').join(''):'<b>Perfect Deck!</b><p class="muted">ตอบถูกครบทุก Case</p>';
    $('r1').placeholder='อย่างน้อย 55 ตัวอักษร: อธิบาย PEAS หรือหลักฐานจากหนึ่ง Case ที่ใช้ตัดสินใจ';$('r2').placeholder='อย่างน้อย 55 ตัวอักษร: อธิบายการออกแบบ Agent ที่รับผิดชอบและปลอดภัย';$('r3').placeholder='อย่างน้อย 55 ตัวอักษร: ระบุคนที่ควรตรวจทานและสิ่งที่ต้องทบทวน';
    evidenceBlock();notice(state.saved?'✓ ส่งผลเรียบร้อยแล้ว':'เลือก Case และเขียน Reflection ให้ครบ แล้วกดส่งผลเข้า Google Sheets',state.saved?'good':'');$('save').disabled=!!state.saved;$('save').textContent=state.saved?'✓ ส่งผลแล้ว':'ส่งผลเข้า Google Sheets';screen('result');
  }
  function skillSummary(){const out={};Object.entries(state.skills||{}).forEach(([key,item])=>{if(item.total)out[key]={correct:item.correct,total:item.total,accuracy:ratio(item.correct,item.total)};});return out;}
  async function submit(){
    if(!state?.result||state.saved)return;
    const reflections=['r1','r2','r3'].map(id=>$(id).value.trim());
    if(!state.evidence){notice('<b>ยังส่งผลไม่ได้</b><br>กรุณาเลือก 1 Case จาก Deck นี้เป็นหลักฐานก่อน','bad');$('evidence')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(reflections.some(text=>text.replace(/\s/g,'').length<55)){notice('<b>ยังส่งผลไม่ได้</b><br>Reflection ต้องมีอย่างน้อย 55 ตัวอักษรต่อข้อ','bad');return;}
    $('save').disabled=true;$('save').textContent='กำลังบันทึก…';const p=profile(),r=state.result,a=state.deck.semanticAudit||{},e=state.evidence;
    const payload={attemptId:state.attemptId,studentId:p.studentId,studentName:p.studentName||p.name,section:'101',sessionId:'s2',missionId:'s2',missionTitle:'Agent Builder • PEAS',difficulty:state.deck.round>2?'stretch':'core',score:r.score,stars:r.score>=85?3:r.score>=70?2:r.score>=60?1:0,gateStatus:r.pass?'passed':'review',mastered:r.score>=85,usedTimeSec:r.usedSec,accuracy:Math.round(state.correct/15*100),correct:state.correct,total:15,wrong:state.wrong.length,maxCombo:state.comboMax,helpUsed:state.hintsUsed,bossWin:false,reflection1:reflections[0],reflection2:reflections[1],reflection3:reflections[2],clientTs:new Date().toISOString(),schemaVersion:VERSION,runMode:'graded',isPractice:false,isGraded:true,extraJson:{gameplayMode:'s2-agent-builder-stable',replayDeckId:state.deck.id,replayRound:state.deck.round,noRepeatWindow:state.deck.usedWindow,deckTotal:15,mechanicCases:5,knowledgeCases:8,twistCases:2,mechanicCorrect:state.mechanic,knowledgeCorrect:state.knowledge,twistCorrect:state.twist,mechanicAccuracy:r.mechanicPct,quizAccuracy:r.knowledgePct,boardAccuracy:r.twistPct,s2Skills:skillSummary(),passRules:'score>=60,m>=3/5,q>=5/8,t>=1/2',semanticDeckVersion:a.version||'v7.0.1',semanticDeckIntegrity:a,answerPositionAudit:state.deck.answerPositionAudit||null,semanticDeckReady:!!a.ok,contextUniqueCount:num(a.contextUnique),conceptUniqueCount:num(a.conceptUnique),sourceUniqueCount:num(a.sourceUnique),promptPatternUniqueCount:num(a.promptPatternUnique),fingerprintUniqueCount:num(a.fingerprintUnique),replayAudit:{version:'v7.0.1',deckId:state.deck.id,deckRound:state.deck.round,cards:state.deck.cards.map(card=>({context:card.context,skill:card.skill,policy:card.answerPolicy,fingerprint:card.answerFingerprint}))},reflectionEvidenceCaptured:true,reflectionEvidenceBound:true,reflectionEvidence:{version:'v7.0.1',deckId:state.deck.id,deckRound:state.deck.round,...e,integrity:{ok:true,errorCount:0,checks:{selectedFromCompletedDeck:true}}},selectedCaseId:e.selectedCaseId,selectedCaseContext:e.selectedCaseContext,selectedCaseSkill:e.selectedCaseSkill,selectedCasePolicy:e.selectedCasePolicy}};
    let sent=false;try{await window.AIQuestSync?.submitAttempt?.(payload);sent=true;}catch(error){console.warn('[S2 stable] submit queued',error);}
    if(r.pass){const core=read(CORE,{completed:{},best:{}});core.completed=core.completed||{};core.best=core.best||{};core.completed.s2=true;core.best.s2=Math.max(num(core.best.s2),r.score);write(CORE,core);const strict=read(STRICT,{});strict.s2={score:r.score,mechanic:state.mechanic,knowledge:state.knowledge,twist:state.twist,at:Date.now(),version:VERSION};write(STRICT,strict);}
    state.saved=true;$('save').textContent='✓ ส่งผลแล้ว';notice(sent?'✓ ส่งผลเข้า Google Sheets แล้ว':'✓ บันทึกในเครื่องแล้ว ระบบจะซิงก์เมื่อเชื่อมต่อได้','good');clearRun();toast('บันทึกผล S2 แล้ว');
  }
  function exit(){if(confirm('ต้องการออกจาก S2 หรือไม่? ผลรอบนี้จะไม่ถูกบันทึก')){clearTimer();clearRun();state=null;screen('entry');entry();}}
  function replay(){clearTimer();clearRun();state=null;screen('entry');entry();start();}
  function restore(){
    const saved=activeRun();if(!saved)return false;state=saved;if(!state.skills)state.skills=blankSkills();if(state.ended&&state.result){renderResult();toast('คืนหน้าสรุปรอบเดิมแล้ว');return true;}if(state.answered){state.index++;state.answered=false;saveRun();}if(state.index>=state.deck.cards.length){finish();return true;}$('gameTitle').textContent='S2 • Agent Builder';$('gameSub').textContent='คืนรอบ '+deckLine(state.deck)+' • เคส '+(state.index+1)+'/15';screen('game');renderCard();toast('คืน S2 Deck ที่ค้างไว้แล้ว');return true;
  }
  $('saveProfile').onclick=saveProfile;$('start').onclick=start;$('exit').onclick=exit;$('save').onclick=submit;$('replay').onclick=replay;
  window.addEventListener('pagehide',()=>{if(state&&!state.saved)saveRun();});
  entry();restore();
})();