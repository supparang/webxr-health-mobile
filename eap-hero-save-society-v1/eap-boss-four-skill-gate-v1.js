/* =========================================================
   EAP Hero Boss Gate v5.0 — Adaptive Multi-Skill Boss Run
   - B1-B5 run Reading -> Listening -> Writing -> Speaking before Boss Clash.
   - Supports EAPBossReplayBankV3 V4.0: 800 generated Boss skill-items.
   - First run = 8 tasks; replay = 12; elite replay = 14.
   - Reading/Listening use multiple rotating MCQs with combo + task progress.
   - Writing/Speaking can contain multiple fresh prompts on replay.
   - Each task sends its own evidence row with item id and run metadata.
   - Writing/Speaking remain formative; pronunciation/grammar are not auto-scored.
========================================================= */
(function () {
  'use strict';

  var VERSION = 'v5.0-adaptive-multi-skill-boss-run';
  var STORAGE_KEY = 'EAP_HERO_PROGRESS_V3';
  var SKILLS = ['Reading', 'Listening', 'Writing', 'Speaking'];
  var SCENARIO_CACHE = {};

  var GATES = {
    1:{title:'Boss Gate 1 · Foundation Check',arc:'S1-S3 · goal, academic words, main idea'},
    2:{title:'Boss Gate 2 · Reading Signals & Summary Check',arc:'S4-S6 · keywords, evidence, summary'},
    3:{title:'Boss Gate 3 · Paragraph & Tone Check',arc:'S7-S9 · paragraph structure and academic tone'},
    4:{title:'Boss Gate 4 · Data, Email & Ethics Check',arc:'S10-S12 · notes, evidence, citation and ethical use'},
    5:{title:'Final Boss · Integrated EAP Performance',arc:'S13-S15 · presentation, Q&A and social solution'}
  };

  var FALLBACK = {
    1:{tag:'Default Goal Builder',reading:'Academic English helps students read sources, explain ideas, and set clear learning goals.',rq:'What is the main message?',ra:'Academic English helps students learn and communicate at university.',rd:['Academic English is only for casual chats.','Students should avoid setting goals.','Sources are not useful for study.'],listening:'First, choose one academic goal. Next, choose one small action. Finally, check your progress.',lq:'What should a learner do after choosing a goal?',la:'Choose one small action.',ld:['Stop studying.','Copy another plan.','Ignore progress.'],writing:'Write 2-4 sentences: one academic goal, one action, and one way to check progress.',speaking:'Speak for 30-45 seconds: introduce your goal, one action, and a closing.'},
    2:{tag:'Default Evidence Check',reading:'A careful reader uses keywords, checks evidence, and writes the central idea in short new words.',rq:'Which action matches the source?',ra:'Find keywords, check evidence, and write a short summary.',rd:['Copy the first sentence only.','Choose a claim because it sounds strong.','Ignore evidence and read the title only.'],listening:'A credible source has a clear author, relevant evidence, and a publication context.',lq:'Which feature was mentioned?',la:'A clear author.',ld:['A colourful page.','A celebrity photo.','A short slogan.'],writing:'Write 2-4 sentences: make one claim, add one detail, and explain why it is relevant.',speaking:'Speak for 30-45 seconds: state a claim, one evidence check, and a conclusion.'},
    3:{tag:'Default Paragraph Builder',reading:'A focused paragraph has a topic sentence, support or evidence, and a closing sentence.',rq:'Which order is correct?',ra:'Topic sentence, support, closing sentence.',rd:['Closing, greeting, new topic.','Random detail, title, question.','Reference list, unrelated opinion, heading.'],listening:'Academic tone is clear and careful. Avoid slang and very strong claims without support.',lq:'What should a writer avoid?',la:'Slang and unsupported strong claims.',ld:['Clear language.','A topic sentence.','One support detail.'],writing:'Write a short paragraph with a topic sentence, one support detail, and a closing.',speaking:'Speak for 30-45 seconds: explain one study strategy with a clear closing.'},
    4:{tag:'Default Data Reporter',reading:'Academic communication reports data accurately, uses a polite purpose, and names sources or AI support honestly.',rq:'Which response follows the source?',ra:'Report data carefully, write politely, and name the source or AI support.',rd:['Change numbers to sound dramatic.','Copy work and say it is original.','Hide where information comes from.'],listening:'Online quiz use rose from 40 percent to 58 percent. Describe the increase, but do not claim a cause without evidence.',lq:'What should the learner do?',la:'Describe the increase carefully.',ld:['Say quizzes caused every improvement.','Ignore the numbers.','Report a decrease.'],writing:'Write 2-4 sentences: describe a data change and one limit.',speaking:'Speak for 30-45 seconds: report one result carefully and close clearly.'},
    5:{tag:'Default Community Solution',reading:'Digital literacy helps students evaluate online information, use evidence responsibly, and explain a practical solution to a social problem.',rq:'Which final response uses the source well?',ra:'Check information, use evidence, and propose a practical solution.',rd:['Share the first online claim without checking.','Give a solution without evidence.','Avoid explaining the social problem.'],listening:'First, name one social problem. Next, add one credible detail. Finally, propose one realistic action.',lq:'What comes before the realistic action?',la:'One credible detail.',ld:['A casual greeting.','A difficult word only.','An unrelated story.'],writing:'Write 3-4 sentences: one social problem, one evidence-based detail, and one realistic action.',speaking:'Speak for 30-45 seconds: present one problem, one detail, one solution, and a conclusion.'}
  };

  function esc(value){ return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function words(value){ return String(value||'').trim().split(/\s+/).filter(Boolean); }
  function wordCount(value){ return words(value).length; }
  function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
  function level(score){ return score>=90?'Excellent':score>=80?'Good':score>=60?'Pass':'Developing'; }
  function gateNo(value){ var n=Number(String(value||'').replace(/\D/g,'')); return GATES[n]?n:1; }
  function readState(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch(_){return {profile:{studentId:'guest',studentName:'Guest',section:'122'}};} }
  function evidenceSync(){ return window.EAPEvidenceSyncV130||window.EAPEvidenceSyncV129||null; }

  function shuffledAnswer(correct,distractors){
    var ds=(distractors||[]).filter(Boolean).slice(0,3);
    while(ds.length<3) ds.push('Related information is mentioned, but it does not answer the task clearly.');
    var items=[{text:correct,correct:true}].concat(ds.map(function(t){return {text:t,correct:false};}));
    for(var i=items.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var tmp=items[i];items[i]=items[j];items[j]=tmp;}
    return {choices:items.map(function(x){return x.text;}),answer:items.findIndex(function(x){return x.correct;})};
  }

  function activeScenario(gate){
    var current=window.EAPBossReplayScenario;
    if(current&&Number(current.gate)===Number(gate)&&current.scenario){SCENARIO_CACHE[gate]=current.scenario;return current.scenario;}
    if(SCENARIO_CACHE[gate]) return SCENARIO_CACHE[gate];
    var fallback=clone(FALLBACK[gate]||FALLBACK[1]);
    fallback.runPlan={mode:'Fallback Run',reading:1,listening:1,writing:1,speaking:1,total:4,runNo:1};
    SCENARIO_CACHE[gate]=fallback;
    window.EAPBossReplayScenario={gate:gate,scenario:fallback};
    return fallback;
  }

  function normalizeMcq(item,legacySource,legacyQ,legacyA,legacyD,index,prefix){
    var x=item||{id:prefix+(index+1),source:legacySource,q:legacyQ,a:legacyA,d:legacyD};
    var mixed=shuffledAnswer(x.a,x.d);
    return {id:x.id||prefix+(index+1),source:x.source||legacySource,question:x.q||legacyQ,choices:mixed.choices,answer:mixed.answer,focus:x.focus||''};
  }

  function gateData(gate){
    var base=clone(GATES[gate]||GATES[1]);
    var sc=activeScenario(gate);
    var run=sc.runItems||{};
    var rItems=(run.reading&&run.reading.length?run.reading:[null]).map(function(item,i){return normalizeMcq(item,sc.reading,sc.rq,sc.ra,sc.rd,i,'B'+gate+'-R');});
    var lItems=(run.listening&&run.listening.length?run.listening:[null]).map(function(item,i){return normalizeMcq(item,sc.listening,sc.lq,sc.la,sc.ld,i,'B'+gate+'-L');});
    var wItems=(run.writing&&run.writing.length?run.writing:[{id:'B'+gate+'-W1',prompt:sc.writing}]).map(function(x,i){return {id:x.id||'B'+gate+'-W'+(i+1),prompt:x.prompt||sc.writing};});
    var sItems=(run.speaking&&run.speaking.length?run.speaking:[{id:'B'+gate+'-S1',prompt:sc.speaking}]).map(function(x,i){return {id:x.id||'B'+gate+'-S'+(i+1),prompt:x.prompt||sc.speaking};});
    base.scenarioTag=sc.tag||'Boss Scenario';
    base.itemMeta=sc.itemMeta||{};
    base.runPlan=sc.runPlan||{mode:'Boss Run',reading:rItems.length,listening:lItems.length,writing:wItems.length,speaking:sItems.length,total:rItems.length+lItems.length+wItems.length+sItems.length,runNo:1};
    base.readingTasks=rItems;
    base.listeningTasks=lItems;
    base.writingTasks=wItems;
    base.speakingTasks=sItems;
    base.writingFrames=sc.writingFrames||['My main point is clear.','One useful detail is included.','This helps me explain the task.'];
    base.speakingFrames=sc.speakingFrames||['Today I will explain my idea.','One important detail is included.','This is useful for my study.'];
    return base;
  }

  function mcqScore(wrongCount){
    if(wrongCount<=0)return {score:100,level:'Excellent',note:'ตอบถูกครั้งแรก · Excellent'};
    if(wrongCount===1)return {score:90,level:'Excellent',note:'ทบทวนแล้วตอบถูก · Excellent'};
    if(wrongCount===2)return {score:82,level:'Good',note:'ตอบถูกหลังลองใหม่ 2 ครั้ง · Good'};
    return {score:75,level:'Pass',note:'ผ่านหลังลองใหม่หลายครั้ง · ควรทบทวน source'};
  }

  function frameSignal(output,frames){
    var lower=String(output||'').toLowerCase(),hits=0;
    (frames||[]).forEach(function(f){var p=String(f||'').toLowerCase().split(/\s+/).filter(Boolean);var a=p.slice(0,3).join(' '),b=p.slice(-3).join(' ');if((a&&lower.indexOf(a)>=0)||(b&&lower.indexOf(b)>=0))hits+=1;});
    return hits;
  }
  function writingScore(output,frames){
    var wc=wordCount(output),fh=frameSignal(output,frames),connectors=/(because|for example|this helps|therefore|however|also|first|next|finally|one useful|one important|this connects|although|while)/i.test(output)?1:0;
    var c={taskComplete:wc>=6?25:Math.round(wc*4),ideas:wc>=22?25:wc>=14?22:wc>=8?18:10,guidanceUse:fh>=2?20:fh===1||connectors?16:12,clarity:wc>=18?20:wc>=10?17:13,completionBonus:wc>=6?10:5};
    var score=clamp(c.taskComplete+c.ideas+c.guidanceUse+c.clarity+c.completionBonus,50,100);
    if(wc>=6)score=Math.max(score,80);if(wc>=10&&(fh>=1||connectors))score=Math.max(score,85);if(wc>=16&&fh>=2)score=Math.max(score,92);if(wc>=24&&fh>=2&&connectors)score=Math.max(score,96);
    return {score:score,level:level(score),note:'Writing rubric: ทำครบโจทย์ = Good ขึ้นไป; เพิ่ม detail, frame/connector และความชัดเจนเพื่อคะแนนสูงขึ้น',components:c};
  }
  function speakingScore(seconds,checklist,note){
    var nw=wordCount(note),checked=['topic','detail','closing'].filter(function(k){return checklist[k];}).length;
    var c={duration:seconds>=40?25:seconds>=30?23:seconds>=20?21:Math.round(seconds*.8),checklist:checked*15,note:nw>=18?20:nw>=10?17:nw>=5?14:4,completionBonus:checked===3&&nw>=5?10:5};
    var score=clamp(c.duration+c.checklist+c.note+c.completionBonus,45,100);
    if(seconds>=20&&checked===3&&nw>=5)score=Math.max(score,85);if(seconds>=30&&checked===3&&nw>=10)score=Math.max(score,92);if(seconds>=40&&checked===3&&nw>=18)score=Math.max(score,96);
    return {score:score,level:level(score),note:'Speaking rubric: เวลา + checklist + note = Good ขึ้นไป; pronunciation/grammar ให้ครู review',components:c};
  }

  function sendEvidence(gate,skill,prompt,output,extras){
    extras=extras||{};var g=gateData(gate);var score=Number(extras.score||100);var itemId=extras.itemId||('B'+gate+'-'+skill+'-'+Date.now());
    var entry={
      rawEvidenceId:'boss-'+gate+'-'+skill+'-'+itemId+'-'+Date.now(),sessionId:'B'+gate,sessionTitle:g.title,skill:skill,evidenceType:'boss_'+skill.toLowerCase()+'_evidence',taskId:itemId,
      score:score,latestScore:score,passed:score>=60,prompt:prompt,output:output,durationSec:extras.durationSec||0,targetRange:extras.targetRange||'',
      teacherReviewRequired:skill==='Speaking',teacherReviewStatus:skill==='Speaking'?'pending_teacher_review':'',oralChecklist:extras.checklist||{},attemptCount:extras.attemptCount||1,
      at:new Date().toISOString(),scoreLevel:extras.level||'',scoreExplanation:extras.note||'',scoringBreakdown:extras.components||{},
      boss:{gate:gate,requiredSkills:SKILLS.slice(),stage:skill,scenarioTag:g.scenarioTag,itemId:itemId,itemIndex:Number(extras.itemIndex||0)+1,itemTotal:Number(extras.itemTotal||1),runMode:g.runPlan.mode,runNo:g.runPlan.runNo||1,runPlan:g.runPlan,itemMeta:g.itemMeta||{}}
    };
    var sync=evidenceSync();if(sync&&typeof sync.submitRaw==='function')sync.submitRaw(entry,readState());
  }

  function playVoice(text){try{window.speechSynthesis.cancel();var v=new SpeechSynthesisUtterance(text);v.lang='en-US';v.rate=.78;window.speechSynthesis.speak(v);}catch(_){} }

  function shell(gate,current,inner,sub){
    var g=gateData(gate),plan=g.runPlan||{};
    document.getElementById('app').innerHTML='<main class="wrap" style="max-width:1100px;margin:auto;padding:20px"><section class="panel" style="margin-top:18px">'+
      '<div class="badges"><span class="pill">Boss Gate '+gate+'</span><span class="pill">'+esc(plan.mode||'Boss Run')+'</span><span class="pill">'+esc(String(plan.total||4))+' Tasks</span><span class="pill">Scenario: '+esc(g.scenarioTag)+'</span></div>'+
      '<h2>'+esc(g.title)+'</h2><p class="lead">'+esc(g.arc)+' · '+esc(sub||'ทำภารกิจครบทั้ง 4 Skills เพื่อเข้าสู่ Boss Clash')+'</p>'+
      '<div class="grid four" style="margin:14px 0">'+SKILLS.map(function(skill,index){var state=index<current?'✓ Complete':index===current?'Current':'Locked';var outline=index===current?'outline:3px solid #73d9e7':'';var n=plan[skill.toLowerCase()]||1;return '<div class="stat" style="'+outline+'"><b>'+esc(skill)+'</b><span>'+state+' · '+n+' task'+(n>1?'s':'')+'</span></div>';}).join('')+'</div>'+inner+'</section></main>';
  }
  function scoreBox(title,r){return '<div class="panel light" style="margin:12px 0;padding:14px"><b>'+esc(title)+': '+r.score+'/100 · '+esc(r.level)+'</b><p class="mini-note">'+esc(r.note)+'</p></div>';}
  function progressBar(label,index,total,combo){var pct=Math.round(((index)/Math.max(1,total))*100);return '<div class="panel light" style="padding:10px 14px;margin:10px 0"><b>'+esc(label)+' '+(index+1)+' / '+total+'</b><span style="float:right">🔥 Combo '+combo+'</span><div style="height:8px;background:#dbeafe;border-radius:99px;margin-top:8px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#38bdf8,#34d399)"></div></div></div>';}

  function choiceStage(gate,kind,itemIndex,combo){
    itemIndex=Number(itemIndex||0);combo=Number(combo||0);
    var g=gateData(gate),tasks=kind==='Reading'?g.readingTasks:g.listeningTasks,task=tasks[itemIndex],stage=kind==='Reading'?0:1,wrong=0;
    if(!task){ if(kind==='Reading')return choiceStage(gate,'Listening',0,combo); return writingStage(gate,0); }
    var listen=kind==='Listening';
    var source='<div class="panel light" style="margin:14px 0"><h3>'+(listen?'🎧 Listening':'📖 Reading')+' · Boss Scenario</h3>'+
      (listen?'<button type="button" class="btn ghost" id="bossPlay">▶ Play audio</button> <button type="button" class="btn ghost" id="bossShowText">Show text support</button><p id="bossTranscript" class="mini-note" style="display:none;margin-top:10px">'+esc(task.source)+'</p>':'<p style="font-size:18px;line-height:1.65">'+esc(task.source)+'</p>')+
      '<p class="mini-note">ตอบถูกครั้งแรกได้คะแนนสูงสุด · ตอบผิดลองใหม่ได้ · ตำแหน่งคำตอบหมุนทุก task</p></div>';
    shell(gate,stage,progressBar(kind+' Challenge',itemIndex,tasks.length,combo)+source+'<h3>'+esc(task.question)+'</h3><div class="grid two">'+task.choices.map(function(c,i){return '<button type="button" class="btn ghost block eap-boss-choice" data-answer="'+i+'" style="margin:7px 0;text-align:left;min-height:76px">'+String.fromCharCode(65+i)+'. '+esc(c)+'</button>';}).join('')+'</div><p id="bossMessage" class="mini-note"></p>',kind+' '+(itemIndex+1)+'/'+tasks.length+' · สะสม Combo เพื่อเพิ่มความเร้าใจ');
    if(document.getElementById('bossPlay'))document.getElementById('bossPlay').addEventListener('click',function(){playVoice(task.source);});
    if(document.getElementById('bossShowText'))document.getElementById('bossShowText').addEventListener('click',function(){var t=document.getElementById('bossTranscript');t.style.display=t.style.display==='none'?'block':'none';});
    if(listen)setTimeout(function(){playVoice(task.source);},280);
    Array.prototype.slice.call(document.querySelectorAll('.eap-boss-choice')).forEach(function(button){button.addEventListener('click',function(){
      if(Number(button.dataset.answer)!==task.answer){wrong+=1;combo=0;document.getElementById('bossMessage').textContent='⚠️ Combo reset · ลองอีกครั้ง: กลับไปดู keyword/evidence หรือฟังอีก 1 รอบ';return;}
      combo+=1;var r=mcqScore(wrong);sendEvidence(gate,kind,task.source,task.choices[task.answer],{score:r.score,level:r.level,note:r.note,attemptCount:wrong+1,itemId:task.id,itemIndex:itemIndex,itemTotal:tasks.length});
      document.getElementById('bossMessage').innerHTML=scoreBox(kind+' Task '+(itemIndex+1),r)+'<p><b>🔥 Combo '+combo+'</b></p>';
      setTimeout(function(){if(itemIndex+1<tasks.length)choiceStage(gate,kind,itemIndex+1,combo);else if(kind==='Reading')choiceStage(gate,'Listening',0,combo);else writingStage(gate,0);},620);
    });});
  }

  function frameButtons(frames){return '<div style="display:grid;gap:8px;margin:12px 0">'+frames.map(function(f,i){return '<button type="button" class="btn ghost eap-boss-frame" data-index="'+i+'" style="text-align:left">＋ '+esc(f)+'</button>';}).join('')+'</div>';}
  function bindFrames(frames,fieldId){Array.prototype.slice.call(document.querySelectorAll('.eap-boss-frame')).forEach(function(b){b.addEventListener('click',function(){var field=document.getElementById(fieldId),value=frames[Number(b.dataset.index)];field.value=field.value.trim()?field.value.trim()+' '+value:value;field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();});});}

  function writingStage(gate,itemIndex){
    itemIndex=Number(itemIndex||0);var g=gateData(gate),tasks=g.writingTasks,task=tasks[itemIndex];if(!task)return speakingStage(gate,0);
    shell(gate,2,progressBar('Writing Mission',itemIndex,tasks.length,0)+'<div class="panel light"><h3>✍️ Writing · Fresh Prompt '+(itemIndex+1)+'/'+tasks.length+'</h3><p>'+esc(task.prompt)+'</p><p class="mini-note">Replay จะเปลี่ยน prompt และ scenario · ทำครบตามโจทย์ขั้นต่ำได้ Good ขึ้นไป</p>'+frameButtons(g.writingFrames)+'<textarea id="bossWriting" rows="6" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Use the sentence frames or write your own answer."></textarea><button type="button" class="btn primary" id="bossSaveWriting">Save task & continue</button><p id="bossWriteMessage" class="mini-note"></p></div>','Writing '+(itemIndex+1)+'/'+tasks.length+' · เขียนคนละ prompt ในรอบ replay');
    bindFrames(g.writingFrames,'bossWriting');
    document.getElementById('bossSaveWriting').addEventListener('click',function(){var output=document.getElementById('bossWriting').value.trim();if(wordCount(output)<6){document.getElementById('bossWriteMessage').textContent='ใช้ sentence frame อย่างน้อย 2 อัน หรือเขียนอย่างน้อย 6 คำก่อน';return;}var r=writingScore(output,g.writingFrames);sendEvidence(gate,'Writing',task.prompt,output,{score:r.score,level:r.level,note:r.note,components:r.components,itemId:task.id,itemIndex:itemIndex,itemTotal:tasks.length});document.getElementById('bossWriteMessage').innerHTML=scoreBox('Writing Task '+(itemIndex+1),r);setTimeout(function(){if(itemIndex+1<tasks.length)writingStage(gate,itemIndex+1);else speakingStage(gate,0);},700);});
  }

  function speakingStage(gate,itemIndex){
    itemIndex=Number(itemIndex||0);var g=gateData(gate),tasks=g.speakingTasks,task=tasks[itemIndex];if(!task)return completeFourSkills(gate);var startedAt=0,timer=null;
    shell(gate,3,progressBar('Speaking Mission',itemIndex,tasks.length,0)+'<div class="panel light"><h3>🗣️ Speaking · Fresh Prompt '+(itemIndex+1)+'/'+tasks.length+'</h3><p>'+esc(task.prompt)+'</p><div class="grid three" style="margin:12px 0">'+g.speakingFrames.map(function(f,i){return '<div class="stat"><b>Cue '+(i+1)+'</b><span>'+esc(f)+'</span></div>';}).join('')+'</div><p><b id="bossSpeakClock">00:00</b> / 00:20 minimum</p><button type="button" class="btn ghost" id="bossStartSpeak">Start speaking timer</button><label style="display:block;margin:12px 0"><input type="checkbox" id="bossTopic"> I stated the topic</label><label style="display:block;margin:12px 0"><input type="checkbox" id="bossDetail"> I gave one source detail</label><label style="display:block;margin:12px 0"><input type="checkbox" id="bossClose"> I used a clear closing</label><textarea id="bossSpeakingNote" rows="4" style="width:100%;padding:14px;border-radius:12px;font:inherit" placeholder="Type 1–2 sentences about what you said."></textarea><p class="mini-note">Replay ใช้ prompt ใหม่ · pronunciation/grammar ให้ครู review ไม่ใช่ auto-score</p><button type="button" class="btn primary" id="bossFinishSpeak">Save task & continue</button><p id="bossSpeakMessage" class="mini-note"></p></div>','Speaking '+(itemIndex+1)+'/'+tasks.length+' · ครู review Boss Speaking ตามหลักฐานจริง');
    document.getElementById('bossStartSpeak').addEventListener('click',function(){if(startedAt)return;startedAt=Date.now();this.textContent='Speaking timer running';timer=setInterval(function(){var s=Math.floor((Date.now()-startedAt)/1000);var el=document.getElementById('bossSpeakClock');if(el)el.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');},250);});
    document.getElementById('bossFinishSpeak').addEventListener('click',function(){var seconds=startedAt?Math.floor((Date.now()-startedAt)/1000):0,note=document.getElementById('bossSpeakingNote').value.trim(),check={spoke:seconds>=20,topic:document.getElementById('bossTopic').checked,detail:document.getElementById('bossDetail').checked,closing:document.getElementById('bossClose').checked};if(!check.spoke||!check.topic||!check.detail||!check.closing||wordCount(note)<5){document.getElementById('bossSpeakMessage').textContent='ทำให้ครบ: พูด 20 วินาที, ติ๊ก 3 checklist และพิมพ์ note อย่างน้อย 5 คำ';return;}if(timer)clearInterval(timer);var r=speakingScore(seconds,check,note);sendEvidence(gate,'Speaking',task.prompt,note,{score:r.score,level:r.level,note:r.note,components:r.components,durationSec:seconds,targetRange:'20-45',checklist:check,itemId:task.id,itemIndex:itemIndex,itemTotal:tasks.length});document.getElementById('bossSpeakMessage').innerHTML=scoreBox('Speaking Task '+(itemIndex+1),r);setTimeout(function(){if(itemIndex+1<tasks.length)speakingStage(gate,itemIndex+1);else completeFourSkills(gate);},760);});
  }

  function completeFourSkills(gate){
    var g=gateData(gate),p=g.runPlan;
    shell(gate,4,'<div class="panel light" style="text-align:center;padding:26px"><h3>✅ '+esc(p.mode||'Boss Run')+' Complete</h3><p>คุณทำ Reading '+g.readingTasks.length+', Listening '+g.listeningTasks.length+', Writing '+g.writingTasks.length+' และ Speaking '+g.speakingTasks.length+' task ครบแล้ว</p><p class="mini-note">รอบหน้า scenario และ item จะหมุนใหม่ พร้อมเพิ่มจำนวน task ใน Rematch/Elite Remix</p><button type="button" class="btn primary" id="enterBossClash">Enter Boss Clash</button></div>','ครบ '+p.total+' tasks · พร้อมเข้าสู่ Boss Clash');
    document.getElementById('enterBossClash').addEventListener('click',function(){var original=window.EAPHero&&window.EAPHero.__bossFourSkillOriginalStart;if(typeof original==='function')original('gate'+gate);});
  }

  function patch(){
    if(!window.EAPHero||typeof window.EAPHero.startGateBoss!=='function'||window.EAPHero.__bossFourSkillV50Patched)return;
    window.EAPHero.__bossFourSkillV50Patched=true;
    window.EAPHero.__bossFourSkillOriginalStart=window.EAPHero.startGateBoss;
    window.EAPHero.startGateBoss=function(gateId){var gate=gateNo(gateId);if(window.EAPBossReplayScenario&&Number(window.EAPBossReplayScenario.gate)!==Number(gate))window.EAPBossReplayScenario=null;choiceStage(gate,'Reading',0,0);};
  }

  var wait=setInterval(function(){patch();if(window.EAPHero&&window.EAPHero.__bossFourSkillV50Patched)clearInterval(wait);},100);
  window.EAPBossFourSkillV4={gates:GATES,start:function(gate){choiceStage(gateNo(gate),'Reading',0,0);},version:VERSION,scoring:{mcqScore:mcqScore,writingScore:writingScore,speakingScore:speakingScore}};
})();