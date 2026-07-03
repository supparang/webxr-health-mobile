/* =========================================================
   EAP Hero A2–B1 Task Scaffold v2
   S1–S15: A2 Foundation → A2+ Bridge → B1 Core → B1+ Stretch
   Presentation layer only: it adds source-linked clarity, word banks,
   sentence frames, and optional stretch without changing core scores,
   unlock rules, portfolio ownership, or the existing replay model.
========================================================= */
(function () {
  'use strict';

  var BANK = function () {
    return (window.EAP_GOLD_AUTHORED_BANK && window.EAP_GOLD_AUTHORED_BANK.sessions) || {};
  };

  var LESSONS = {
    1: {title:'Academic Goal',goal:'Say one academic goal and one realistic practice action.',bank:['goal','improve','practise','each week'],writing:['My academic goal is to improve reading.','I will practise by reading one short source each week.','This can help me make progress.'],speaking:['Today I will talk about my academic goal.','I will practise by reading one short source each week.','This can help my university study.'],stretch:'Add one reason with because.'},
    2: {title:'Academic Vocabulary',goal:'Choose one academic word or phrase, its meaning, and one short use.',bank:['conduct research','significant','analyze','indicate'],writing:['One useful academic phrase is conduct research.','It means to do a study.','Our group can conduct research on study habits.'],speaking:['Today I will use one academic phrase.','Conduct research means to do a study.','This phrase is useful in university work.'],stretch:'Explain why this phrase is more suitable than an informal phrase.'},
    3: {title:'Main Idea',goal:'Find one main idea and one supporting detail.',bank:['main idea','detail','topic','support'],writing:['The main idea is about the topic.','One detail supports this idea.','This detail helps me understand the source.'],speaking:['Today I will explain the main idea.','One supporting detail is important.','This detail supports the topic.'],stretch:'Add a cautious inference with may or might.'},
    4: {title:'Keywords & Signals',goal:'Spot one keyword or signal word and explain a simple connection.',bank:['keyword','however','therefore','because'],writing:['One useful signal word is however.','It shows a contrast between two ideas.','This signal helps me follow the source.'],speaking:['Today I will explain one signal word.','However shows a contrast.','This helps me understand the reading.'],stretch:'Use the signal word in one new sentence.'},
    5: {title:'Critical Reading',goal:'Separate a claim from one evidence detail.',bank:['claim','evidence','fact','opinion'],writing:['The claim is about the topic.','One evidence detail is in the source.','We should check the evidence carefully.'],speaking:['Today I will check one claim.','I will look for one evidence detail.','This helps me make a careful decision.'],stretch:'State one limitation of the source.'},
    6: {title:'Summary',goal:'Give the main idea in short new words.',bank:['summary','main idea','own words','source'],writing:['The source is about the main topic.','One key point is important for students.','In short, the source gives one useful study idea.'],speaking:['Today I will give a short summary.','The main idea is about the topic.','This is the key point in my own words.'],stretch:'Add one detail but do not copy the source sentence.'},
    7: {title:'Academic Tone',goal:'Choose a clear and more academic sentence.',bank:['formal','clear','careful','suggest'],writing:['Academic tone should be clear and careful.','I can use a formal word in my sentence.','This makes my writing more appropriate.'],speaking:['Today I will explain academic tone.','Academic tone is clear and careful.','This is useful for university writing.'],stretch:'Change one informal phrase into a more academic phrase.'},
    8: {title:'Paragraph Structure',goal:'Put topic, support, example, and closing in a clear order.',bank:['topic sentence','support','example','closing'],writing:['A paragraph starts with a topic sentence.','Then I add one support or example.','Finally, I write a closing sentence.'],speaking:['Today I will explain paragraph order.','First is the topic sentence, then support.','Finally, the paragraph has a closing.'],stretch:'Add one linking word such as for example or therefore.'},
    9: {title:'Paragraph Writing',goal:'Build one short paragraph with one clear support.',bank:['topic','reason','example','closing'],writing:['One useful study strategy is to review key words.','For example, I can review five words after class.','This strategy can support my academic reading.'],speaking:['Today I will present one study strategy.','For example, I can review key words after class.','This can support my reading.'],stretch:'Add a second support sentence using also.'},
    10: {title:'Data Description',goal:'Describe one trend accurately without guessing a cause.',bank:['increased','decreased','from','to'],writing:['The data show an increase.','The number changed from one value to another value.','The data do not prove a cause.'],speaking:['Today I will report one trend.','The number increased from one value to another.','We should describe the data carefully.'],stretch:'Use indicate or suggest instead of prove.'},
    11: {title:'Academic Email',goal:'Write one polite and clear request.',bank:['Dear','I am writing to','Could you','Thank you'],writing:['Dear Teacher,','I am writing to ask about the assignment.','Thank you for your help.'],speaking:['Today I will make a polite request.','I can say I am writing to ask about the assignment.','Thank you is a clear closing.'],stretch:'Add one reason for the request.'},
    12: {title:'Citation & Ethics',goal:'Use one source idea responsibly in new words.',bank:['source','own words','cite','AI support'],writing:['The source gives one useful idea.','I can explain this idea in my own words.','I should name the source or AI support honestly.'],speaking:['Today I will explain responsible source use.','I can use my own words and name the source.','This is honest academic work.'],stretch:'Add a short source signal such as According to the source.'},
    13: {title:'Academic Listening',goal:'Listen twice: main point first, detail second.',bank:['main point','keyword','detail','lecture'],writing:['The main point is about the topic.','One keyword is important in the lecture.','This detail helps me understand the message.'],speaking:['Today I will explain one lecture message.','The main point is about the topic.','One detail helps me understand it.'],stretch:'Explain one connection between the main point and the detail.'},
    14: {title:'Academic Presentation',goal:'Present one point, one support, and one closing.',bank:['today','for example','evidence','in conclusion'],writing:['Today I will present one useful point.','For example, one support is in the source.','In conclusion, this idea is useful for students.'],speaking:['Today I will present one useful point.','For example, one support is in the source.','In conclusion, this idea is useful for students.'],stretch:'Add one short audience signpost: First, Next, or Finally.'},
    15: {title:'Final Integration',goal:'Connect one problem, one evidence detail, and one practical action.',bank:['problem','evidence','solution','action'],writing:['One social problem is false information online.','Students can check the author and evidence.','This is one practical action for safer information use.'],speaking:['Today I will present one social problem.','Students can check the author and evidence.','This is one realistic action.'],stretch:'Add why the action may help the community.'}
  };

  var MEANINGS = {
    'conduct research':'do a study','make research':'do a study','significant':'important or meaningful','analyze':'study carefully','analysis':'careful study of information','analytical':'related to careful study','indicate':'show or suggest','prove':'show something is certainly true','evidence':'information that supports an idea','claim':'an idea that needs support','main idea':'the most important message','keyword':'an important topic word','summary':'a short version of the main points','paraphrase':'say the same idea in new words','citation':'a source signal in academic work','however':'but or in contrast','therefore':'because of that or as a result','source':'where information comes from'
  };

  function clean(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]; }); }
  function app() { return document.getElementById('app'); }
  function appText() { return clean((app() || document.body).innerText || ''); }

  function context() {
    var text = appText();
    if (/Evidence Saved|Boss Defeated|Try Again|Player Status|Campus Map|Learning Analytics/i.test(text)) return null;
    if (/Boss Gate|Final Boss|Boss Clash|Four-Skill Evidence/i.test(text)) return null;
    var sessionMatch = text.match(/\bS(?:ession)?\s*0?(1[0-5]|[1-9])\b/i) || text.match(/\bSession\s*:?[\s]*(1[0-5]|[1-9])\b/i);
    var skillMatch = text.match(/\b(Reading|Writing|Listening|Speaking)\s+Mission\b/i) || text.match(/\b(Reading|Writing|Listening|Speaking)\s+Evidence\b/i);
    if (!sessionMatch || !skillMatch) return null;
    var session = Number(sessionMatch[1]);
    var skill = skillMatch[1].charAt(0).toUpperCase() + skillMatch[1].slice(1).toLowerCase();
    return {session:session,skill:skill,lesson:LESSONS[session] || LESSONS[1]};
  }

  function sourceFor(session) {
    var sessions = BANK();
    var sources = sessions[String(session)] && sessions[String(session)].sources;
    if (!Array.isArray(sources) || !sources.length) return null;
    var text = appText(), found = null;
    sources.forEach(function(source){
      var score = 0;
      if (source.id && text.indexOf(source.id) >= 0) score += 12;
      if (source.title && text.indexOf(source.title) >= 0) score += 8;
      var start = clean(source.passage || '').slice(0,48);
      if (start && text.indexOf(start) >= 0) score += 8;
      if (score && (!found || score > found.score)) found = {source:source,score:score};
    });
    return found ? found.source : sources[0];
  }

  function phraseFrom(source, lesson) {
    var text = clean((source && (source.passage || source.specificPassage)) || ''), quotes = [];
    text.replace(/[“"]([^”"]{2,110})[”"]/g, function(_, item){ quotes.push(clean(item).replace(/[.]+$/, '')); return _; });
    if (quotes.length) return quotes.sort(function(a,b){return b.length-a.length;})[0];
    if (source && Array.isArray(source.keywords) && source.keywords.length) return clean(source.keywords[0]);
    return lesson.bank[0];
  }

  function meaningFor(phrase, source) {
    var value = clean(phrase).toLowerCase();
    if (MEANINGS[value]) return MEANINGS[value];
    var matched = Object.keys(MEANINGS).find(function(key){ return value.indexOf(key) >= 0 || key.indexOf(value) >= 0; });
    if (matched) return MEANINGS[matched];
    if (source && source.main) return 'an important idea in this source';
    return 'an important academic idea';
  }
  function sourceTopic(source, lesson) { return clean((source && (source.title || (source.keywords && source.keywords[0]))) || lesson.title); }
  function shortDetail(source, fallback) { var text = clean((source && (source.evidence || source.specificPassage || source.passage)) || fallback); return text.length > 110 ? text.slice(0,107).replace(/\s+\S*$/, '') + '…' : text; }

  function framesFor(ctx, source) {
    var lesson = ctx.lesson, phrase = phraseFrom(source,lesson), meaning = meaningFor(phrase,source), topic = sourceTopic(source,lesson), detail = shortDetail(source,phrase);
    if (ctx.skill === 'Reading') return [phrase + '.', 'It means ' + meaning + '.', 'In this source, ' + phrase + ' is useful.'];
    if (ctx.skill === 'Listening') return ['I heard: ' + phrase + '.', 'The main point is about ' + topic + '.', 'One detail is: ' + detail];
    if (ctx.skill === 'Speaking') return lesson.speaking.slice();
    return lesson.writing.slice();
  }

  function visibleFields() {
    return Array.prototype.slice.call(document.querySelectorAll('#app textarea, #app input[type="text"]')).filter(function(field){ return field.offsetParent !== null && !field.disabled && !/bossWriting|bossSpeakingNote|speakingNote/i.test(field.id || ''); });
  }
  function emit(field) { try{field.dispatchEvent(new Event('input',{bubbles:true}));}catch(_){} try{field.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){} }
  function placeText(field,text) { if(!field) return; var current=clean(field.value); field.value=current ? current+' '+text : text; emit(field); field.focus(); }
  function toast(message) { var old=document.getElementById('eap-a2b1-toast'); if(old) old.remove(); var node=document.createElement('div'); node.id='eap-a2b1-toast'; node.textContent=message; node.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100010;background:#0e7490;color:#fff;padding:10px 14px;border-radius:12px;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.24)'; document.body.appendChild(node); setTimeout(function(){if(node.parentNode)node.remove();},2200); }
  function copyText(text) { if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){toast('Sentence frame copied. Speak it, then adapt one word.');}).catch(function(){toast(text);}); } else { toast(text); } }

  function addCss() {
    if (document.getElementById('eap-a2b1-scaffold-style')) return;
    var style=document.createElement('style'); style.id='eap-a2b1-scaffold-style';
    style.textContent=['.eap-a2b1-guide{margin:14px 0 18px;padding:16px;border:2px solid #79d6e8;border-radius:18px;background:linear-gradient(135deg,#edfcff,#f7fbff);color:#102033;box-shadow:0 8px 24px rgba(20,85,116,.11)}','.eap-a2b1-head{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}', '.eap-a2b1-guide h3{margin:0;font-size:18px}.eap-a2b1-guide p{margin:7px 0;color:#40586f;line-height:1.5}', '.eap-a2b1-pill{display:inline-block;padding:5px 9px;border-radius:999px;background:#dff7ed;color:#087f5b;font-size:12px;font-weight:900}', '.eap-a2b1-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}', '.eap-a2b1-step{padding:10px;border-radius:12px;background:#fff;border:1px solid #d3e7ef}', '.eap-a2b1-step b{display:block;font-size:13px;margin-bottom:5px}.eap-a2b1-step span{font-size:12px;color:#5a6d7d}', '.eap-a2b1-add{display:block;width:100%;margin-top:8px;padding:8px 9px;border:1px solid #8ec8dc;border-radius:9px;background:#fff;color:#17375e;text-align:left;font:800 13px system-ui,-apple-system,sans-serif;cursor:pointer}', '.eap-a2b1-add:hover{background:#e6f9ff}.eap-a2b1-bank{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.eap-a2b1-chip{padding:6px 9px;border:1px solid #bae2eb;border-radius:999px;background:#fff;color:#24546b;font:800 12px system-ui,-apple-system,sans-serif;cursor:pointer}', '.eap-a2b1-note{margin-top:10px;padding:9px 10px;border-radius:10px;background:#fff6d7;color:#765400;font-size:12px;font-weight:750}', '.eap-a2b1-stretch{margin-top:10px;border:1px dashed #7d71c9;border-radius:10px;padding:9px 10px;color:#4b3d94;font-size:12px}', '.eap-a2b1-field-help{margin:8px 0 5px;padding:8px 10px;border-left:4px solid #60c5db;background:#effcff;color:#31566d;font-size:13px;font-weight:700;border-radius:7px}', '.eap-a2b1-speaking-bank{margin:12px 0;padding:11px;border:1px solid #86d9e8;border-radius:12px;background:#edfcff;color:#10394d}.eap-a2b1-speaking-bank b{display:block;margin-bottom:7px}', '@media(max-width:760px){.eap-a2b1-steps{grid-template-columns:1fr}}'].join('');
    document.head.appendChild(style);
  }

  function fieldHelp(skill, slot) {
    var lists={Reading:['Step 1: พิมพ์เฉพาะคำหรือวลีสำคัญจาก source.','Step 2: ใช้กรอบ It means … แล้วอธิบายสั้น ๆ.','Step 3: เขียน 1 ประโยคใช้คำนี้.'],Writing:['Step 1: เริ่มด้วย sentence frame 1 ประโยค.','Step 2: เพิ่ม source detail หรือ example 1 จุด.','Step 3: ปิดด้วยประโยคสั้น ๆ.'],Listening:['Step 1: ฟังรอบแรกเพื่อจับคำสำคัญ 1 คำ.','Step 2: ฟังรอบสองเพื่อจับใจความหลัก.','Step 3: บอก detail สั้น ๆ 1 จุด.']};
    return (lists[skill] || lists.Reading)[slot] || 'ใช้คำตอบสั้นและชัดเจน.';
  }
  function addFieldHelp(fields,skill) { fields.slice(0,3).forEach(function(field,index){ var marker='eap-a2b1-help-'+(field.id||index); var old=field.parentNode && field.parentNode.querySelector('[data-eap-a2b1-help="'+marker+'"]'); if(old){old.textContent=fieldHelp(skill,index);return;} var help=document.createElement('div'); help.className='eap-a2b1-field-help'; help.dataset.eapA2b1Help=marker; help.textContent=fieldHelp(skill,index); field.insertAdjacentElement('beforebegin',help); }); }

  function guideCard(ctx,source,fields) {
    var old=document.getElementById('eap-a2b1-guide-v2'); if(old)old.remove();
    var legacy=document.getElementById('eap-learning-ladder-card'); if(legacy)legacy.remove();
    var lesson=ctx.lesson, frames=framesFor(ctx,source), phrases=lesson.bank.slice(0,4), card=document.createElement('section');
    card.id='eap-a2b1-guide-v2'; card.className='eap-a2b1-guide';
    card.innerHTML='<div class="eap-a2b1-head"><div><h3>🪜 Easy Path · '+esc(ctx.skill)+'</h3><p><b>S'+ctx.session+' · '+esc(lesson.title)+':</b> '+esc(lesson.goal)+'</p></div><span class="eap-a2b1-pill">A2 Foundation → A2+ Bridge</span></div><div class="eap-a2b1-steps"><div class="eap-a2b1-step"><b>1. Choose one clue</b><span>เลือกคำหรือวลีจาก source ก่อน</span><button type="button" class="eap-a2b1-add" data-slot="0">＋ '+esc(frames[0])+'</button></div><div class="eap-a2b1-step"><b>2. Use a short frame</b><span>ตอบด้วย 1 ประโยคสั้น ๆ</span><button type="button" class="eap-a2b1-add" data-slot="1">＋ '+esc(frames[1])+'</button></div><div class="eap-a2b1-step"><b>3. Build one simple use</b><span>เพิ่มประโยคสรุปหรือการใช้</span><button type="button" class="eap-a2b1-add" data-slot="2">＋ '+esc(frames[2])+'</button></div></div><div class="eap-a2b1-bank"><b style="width:100%;font-size:12px">Word bank · แตะเพื่อใช้เป็นคำใบ้:</b>'+phrases.map(function(word){return '<button type="button" class="eap-a2b1-chip" data-word="'+esc(word)+'">'+esc(word)+'</button>';}).join('')+'</div><div class="eap-a2b1-note">งาน Foundation ให้ใช้ source clue + short frame ได้เลย · แก้คำให้ตรงกับ source ของรอบนี้ก่อนกด Submit</div><details class="eap-a2b1-stretch"><summary><b>B1+ Stretch (เลือกทำได้ ไม่เพิ่มหรือลดคะแนน)</b></summary><div style="margin-top:6px">'+esc(lesson.stretch)+'</div></details>';
    card.querySelectorAll('.eap-a2b1-add').forEach(function(button){ button.addEventListener('click',function(){var slot=Number(button.dataset.slot||0);if(!fields.length){copyText(frames[slot]);return;}placeText(fields[Math.min(slot,fields.length-1)],frames[slot]);}); });
    card.querySelectorAll('.eap-a2b1-chip').forEach(function(button){ button.addEventListener('click',function(){var word=button.dataset.word||'';if(fields.length)placeText(fields[0],word);else copyText(word);}); });
    var anchor=fields[0] && fields[0].closest('.panel, section, div');
    if(anchor)anchor.insertAdjacentElement('beforebegin',card); else if(app())app().insertAdjacentElement('afterbegin',card);
  }

  function speakingBank(ctx,source) {
    var text=appText();
    if(/Say it simply/i.test(text)){
      var old=document.getElementById('eap-a2b1-speaking-bank-v2');if(old)old.remove();
      var lesson=ctx.lesson,target=Array.prototype.slice.call(document.querySelectorAll('#app button,#app div,#app section')).find(function(el){return clean(el.textContent)==='Say it simply';});
      var host=target && target.closest('section,div'); if(!host)return;
      var box=document.createElement('div');box.id='eap-a2b1-speaking-bank-v2';box.className='eap-a2b1-speaking-bank';
      box.innerHTML='<b>Easy word bank · เลือก 2 cue แล้วพูดตาม frame</b>'+lesson.bank.slice(0,4).map(function(word){return '<button type="button" class="eap-a2b1-chip" data-copy="'+esc(word)+'">'+esc(word)+'</button>';}).join(' ')+'<div style="margin-top:8px;font-size:12px">B1+ Stretch เป็น optional: '+esc(lesson.stretch)+'</div>';
      box.querySelectorAll('[data-copy]').forEach(function(button){button.addEventListener('click',function(){copyText(button.dataset.copy||'');});});
      host.insertAdjacentElement('afterend',box);return;
    }
    guideCard(ctx,source,visibleFields());
  }

  function apply() {
    addCss();var ctx=context();
    if(!ctx){var guide=document.getElementById('eap-a2b1-guide-v2');if(guide)guide.remove();var bank=document.getElementById('eap-a2b1-speaking-bank-v2');if(bank)bank.remove();return;}
    var source=sourceFor(ctx.session);
    if(ctx.skill==='Speaking'){speakingBank(ctx,source);return;}
    var fields=visibleFields();guideCard(ctx,source,fields);addFieldHelp(fields,ctx.skill);
  }

  var timer;
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,100);}
  window.EAPA2B1TaskScaffoldV2={apply:apply,lessons:LESSONS};
  window.addEventListener('load',schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
