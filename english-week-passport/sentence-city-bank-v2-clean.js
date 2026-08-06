/* Sentence City • Clean Bank V2
 * 40 manually curated tasks: 10 per task mode.
 * No automatic sentence construction or generated distractors.
 */
(function(global){
  'use strict';

  const BANK_VERSION='2026-08-06-SC-CLEAN-BANK-V2-40';
  const ITEMS=[
    {id:'sc2-a2-fill-01',level:'A2',kind:'Fill the Gap',domain:'health',visual:'💧',prompt:'Students should ___ enough water during hot weather.',tokens:['drink','carry','borrow','paint'],answer:['drink']},
    {id:'sc2-a2-fill-02',level:'A2',kind:'Fill the Gap',domain:'school',visual:'📚',prompt:'Please ___ your homework before class.',tokens:['finish','boil','lock','wear'],answer:['finish']},
    {id:'sc2-a2-fill-03',level:'A2',kind:'Fill the Gap',domain:'travel',visual:'🚌',prompt:'We usually ___ the bus to school.',tokens:['take','draw','wash','build'],answer:['take']},
    {id:'sc2-a2-order-01',level:'A2',kind:'Word Order',domain:'daily life',visual:'🍳',prompt:'Build the breakfast sentence.',tokens:['She','makes','breakfast','every morning'],answer:['She','makes','breakfast','every morning']},
    {id:'sc2-a2-order-02',level:'A2',kind:'Word Order',domain:'school',visual:'🏫',prompt:'Build the English Week sentence.',tokens:['English Week','starts','on Monday'],answer:['English Week','starts','on Monday']},
    {id:'sc2-a2-order-03',level:'A2',kind:'Word Order',domain:'travel',visual:'🎫',prompt:'Build the ticket instruction.',tokens:['Please','keep','your ticket','in a safe place'],answer:['Please','keep','your ticket','in a safe place']},
    {id:'sc2-a2-repair-01',level:'A2',kind:'Repair',domain:'school',visual:'✏️',prompt:'Choose the correct word: She ___ to school every day.',tokens:['go','goes'],answer:['goes'],sourceSentence:'She go to school every day.'},
    {id:'sc2-a2-repair-02',level:'A2',kind:'Repair',domain:'health',visual:'🍎',prompt:'Choose the correct word: He ___ fruit at lunch.',tokens:['eat','eats'],answer:['eats'],sourceSentence:'He eat fruit at lunch.'},
    {id:'sc2-a2-repair-03',level:'A2',kind:'Repair',domain:'environment',visual:'♻️',prompt:'Choose the correct word: They ___ paper at school.',tokens:['recycles','recycle'],answer:['recycle'],sourceSentence:'They recycles paper at school.'},
    {id:'sc2-a2-context-01',level:'A2',kind:'Context',domain:'food',visual:'🍽️',prompt:'At a restaurant, choose the polite order.',tokens:['I would like the vegetable soup, please.','Give me the vegetable soup now.'],answer:['I would like the vegetable soup, please.']},
    {id:'sc2-a2-context-02',level:'A2',kind:'Context',domain:'travel',visual:'🛫',prompt:'At the airport, choose the correct instruction.',tokens:['Please show your passport at the counter.','Please leave your passport under the seat.'],answer:['Please show your passport at the counter.']},
    {id:'sc2-a2-context-03',level:'A2',kind:'Context',domain:'safety',visual:'🚨',prompt:'During a fire drill, choose the safe instruction.',tokens:['Walk calmly to the nearest exit.','Run back to collect your bag.'],answer:['Walk calmly to the nearest exit.']},

    {id:'sc2-a2p-fill-01',level:'A2+',kind:'Fill the Gap',domain:'school',visual:'📝',prompt:'You need to ___ the form before Friday.',tokens:['complete','freeze','float','knock'],answer:['complete']},
    {id:'sc2-a2p-fill-02',level:'A2+',kind:'Fill the Gap',domain:'technology',visual:'📤',prompt:'Please ___ the document to the class folder.',tokens:['upload','taste','sweep','climb'],answer:['upload']},
    {id:'sc2-a2p-fill-03',level:'A2+',kind:'Fill the Gap',domain:'health',visual:'😴',prompt:'Teenagers should get ___ sleep each night.',tokens:['enough','noisy','wooden','empty'],answer:['enough']},
    {id:'sc2-a2p-order-01',level:'A2+',kind:'Word Order',domain:'school',visual:'📅',prompt:'Build the deadline sentence.',tokens:['The project','is due','next Friday'],answer:['The project','is due','next Friday']},
    {id:'sc2-a2p-order-02',level:'A2+',kind:'Word Order',domain:'technology',visual:'🔐',prompt:'Build the online safety instruction.',tokens:['Do not share','personal information','online'],answer:['Do not share','personal information','online']},
    {id:'sc2-a2p-order-03',level:'A2+',kind:'Word Order',domain:'health',visual:'🧘',prompt:'Build the relaxation sentence.',tokens:['Deep breathing','can help','you relax'],answer:['Deep breathing','can help','you relax']},
    {id:'sc2-a2p-repair-01',level:'A2+',kind:'Repair',domain:'school',visual:'📘',prompt:'Choose the correct word: The students ___ ready.',tokens:['was','were'],answer:['were'],sourceSentence:'The students was ready.'},
    {id:'sc2-a2p-repair-02',level:'A2+',kind:'Repair',domain:'travel',visual:'🚌',prompt:'Choose the correct word: We did not ___ the bus.',tokens:['missed','miss'],answer:['miss'],sourceSentence:'We did not missed the bus.'},
    {id:'sc2-a2p-repair-03',level:'A2+',kind:'Repair',domain:'technology',visual:'💻',prompt:'Choose the correct word: She has ___ the program.',tokens:['install','installed'],answer:['installed'],sourceSentence:'She has install the program.'},
    {id:'sc2-a2p-context-01',level:'A2+',kind:'Context',domain:'travel',visual:'🏨',prompt:'At a hotel, choose the polite request.',tokens:['Could I have another room key, please?','Bring me another room key immediately.'],answer:['Could I have another room key, please?']},
    {id:'sc2-a2p-context-02',level:'A2+',kind:'Context',domain:'health',visual:'🩺',prompt:'When speaking to a doctor, choose the clear sentence.',tokens:['The pain started yesterday after lunch.','The meeting started yesterday after lunch.'],answer:['The pain started yesterday after lunch.']},
    {id:'sc2-a2p-context-03',level:'A2+',kind:'Context',domain:'community',visual:'🎪',prompt:'At a school event, choose the volunteer instruction.',tokens:['Please help at the registration desk this morning.','Please buy a ticket at the registration desk this morning.'],answer:['Please help at the registration desk this morning.']},

    {id:'sc2-b1-fill-01',level:'B1',kind:'Fill the Gap',domain:'research',visual:'📊',prompt:'The team must ___ the survey results before presenting them.',tokens:['analyze','decorate','whisper','replace'],answer:['analyze']},
    {id:'sc2-b1-fill-02',level:'B1',kind:'Fill the Gap',domain:'travel',visual:'🚉',prompt:'Passengers should ___ the platform number before boarding.',tokens:['confirm','invent','freeze','paint'],answer:['confirm']},
    {id:'sc2-b1-fill-03',level:'B1',kind:'Fill the Gap',domain:'health',visual:'🥦',prompt:'A balanced diet can ___ your energy levels.',tokens:['improve','cancel','divide','wrap'],answer:['improve']},
    {id:'sc2-b1-order-01',level:'B1',kind:'Word Order',domain:'travel',visual:'🏛️',prompt:'Build the museum tour sentence.',tokens:['The guide','will begin','the museum tour','at 10 a.m.'],answer:['The guide','will begin','the museum tour','at 10 a.m.']},
    {id:'sc2-b1-order-02',level:'B1',kind:'Word Order',domain:'research',visual:'🔬',prompt:'Build the research process sentence.',tokens:['Students collected','the data','before writing','their report'],answer:['Students collected','the data','before writing','their report']},
    {id:'sc2-b1-order-03',level:'B1',kind:'Word Order',domain:'learning',visual:'🧠',prompt:'Build the study habit sentence.',tokens:['Taking short breaks','can improve','focus','during study'],answer:['Taking short breaks','can improve','focus','during study']},
    {id:'sc2-b1-repair-01',level:'B1',kind:'Repair',domain:'research',visual:'📚',prompt:'Choose the correct word: The research ___ a clear pattern.',tokens:['show','shows'],answer:['shows'],sourceSentence:'The research show a clear pattern.'},
    {id:'sc2-b1-repair-02',level:'B1',kind:'Repair',domain:'health',visual:'🏋️',prompt:'Choose the correct word: Regular exercise ___ many benefits.',tokens:['have','has'],answer:['has'],sourceSentence:'Regular exercise have many benefits.'},
    {id:'sc2-b1-repair-03',level:'B1',kind:'Repair',domain:'technology',visual:'🔧',prompt:'Choose the correct word: The update was ___ yesterday.',tokens:['release','released'],answer:['released'],sourceSentence:'The update was release yesterday.'},
    {id:'sc2-b1-context-01',level:'B1',kind:'Context',domain:'travel',visual:'🛬',prompt:'For a delayed flight, choose the clearest announcement.',tokens:['The flight has been delayed because of bad weather.','Passengers may collect their luggage at carousel four.'],answer:['The flight has been delayed because of bad weather.']},
    {id:'sc2-b1-context-02',level:'B1',kind:'Context',domain:'communication',visual:'🤝',prompt:'During a disagreement, choose the constructive response.',tokens:['I understand your point, but I see the issue differently.','Your opinion is wrong, so there is nothing to discuss.'],answer:['I understand your point, but I see the issue differently.']},
    {id:'sc2-b1-context-03',level:'B1',kind:'Context',domain:'business',visual:'📦',prompt:'For a customer complaint, choose the professional response.',tokens:['We apologize for the delay and will replace the item.','The delay was not our problem, so please stop contacting us.'],answer:['We apologize for the delay and will replace the item.']},

    {id:'sc2-b1p-fill-01',level:'B1+',kind:'Fill the Gap',domain:'research',visual:'🔍',prompt:'The findings may ___ that students need more guided practice.',tokens:['indicate','decorate','borrow','fold'],answer:['indicate']},
    {id:'sc2-b1p-order-01',level:'B1+',kind:'Word Order',domain:'research',visual:'📐',prompt:'Build the evidence-based conclusion.',tokens:['The evidence','supports','a cautious interpretation','of the results'],answer:['The evidence','supports','a cautious interpretation','of the results']},
    {id:'sc2-b1p-repair-01',level:'B1+',kind:'Repair',domain:'research',visual:'📈',prompt:'Choose the correct word: The results ___ several possible explanations.',tokens:['suggests','suggest'],answer:['suggest'],sourceSentence:'The results suggests several possible explanations.'},
    {id:'sc2-b1p-context-01',level:'B1+',kind:'Context',domain:'research',visual:'🧪',prompt:'For a research discussion, choose the cautious interpretation.',tokens:['These findings may reflect a short-term effect rather than a permanent change.','These findings prove that the change will be permanent in every situation.'],answer:['These findings may reflect a short-term effect rather than a permanent change.']}
  ];

  const LEVEL_QUOTAS={'A2':3,'A2+':3,'B1':3,'B1+':1};
  const KIND_QUOTAS={'Fill the Gap':3,'Word Order':3,'Repair':2,'Context':2};

  function hash32(value){
    let hash=0x811c9dc5;
    for(const char of String(value)){
      hash^=char.charCodeAt(0);
      hash=Math.imul(hash,0x01000193);
    }
    return hash>>>0;
  }

  function mulberry32(seed){
    let value=seed>>>0;
    return function(){
      value=(value+0x6D2B79F5)>>>0;
      let t=value;
      t=Math.imul(t^(t>>>15),t|1);
      t^=t+Math.imul(t^(t>>>7),t|61);
      return ((t^(t>>>14))>>>0)/4294967296;
    };
  }

  function shuffle(values,random){
    const output=[...values];
    for(let index=output.length-1;index>0;index--){
      const swapIndex=Math.floor(random()*(index+1));
      [output[index],output[swapIndex]]=[output[swapIndex],output[index]];
    }
    return output;
  }

  function expandQuota(quota){
    return Object.entries(quota).flatMap(([key,count])=>Array(count).fill(key));
  }

  function cloneTask(task){
    return {...task,tokens:[...task.tokens],answer:[...task.answer]};
  }

  function validateBank(){
    const errors=[];
    const ids=new Set();
    if(ITEMS.length!==40)errors.push(`item-count:${ITEMS.length}`);
    const expectedLevels={'A2':12,'A2+':12,'B1':12,'B1+':4};
    const expectedKinds={'Fill the Gap':10,'Word Order':10,'Repair':10,'Context':10};

    for(const item of ITEMS){
      if(!item.id||ids.has(item.id))errors.push(`duplicate-id:${item.id}`);
      ids.add(item.id);
      if(!item.prompt||!Array.isArray(item.tokens)||!Array.isArray(item.answer)||!item.answer.length)errors.push(`invalid:${item.id}`);
      if(new Set(item.tokens).size!==item.tokens.length)errors.push(`duplicate-token:${item.id}`);
      for(const value of item.answer)if(!item.tokens.includes(value))errors.push(`answer-not-option:${item.id}:${value}`);
      if(item.kind==='Fill the Gap'&&(item.answer.length!==1||!item.prompt.includes('___')))errors.push(`bad-fill:${item.id}`);
      if(item.kind==='Repair'&&(item.tokens.length!==2||item.answer.length!==1||!item.prompt.includes('___')))errors.push(`bad-repair:${item.id}`);
      if(item.kind==='Context'&&(item.tokens.length!==2||item.answer.length!==1))errors.push(`bad-context:${item.id}`);
      if(item.kind==='Word Order'&&(item.answer.length<3||item.tokens.length!==item.answer.length))errors.push(`bad-order:${item.id}`);
      for(const text of [item.prompt,...item.tokens,...item.answer]){
        if(/\b(?:gla|rin|be ide)\b/i.test(text)||/\s{2,}/.test(text))errors.push(`broken-text:${item.id}:${text}`);
      }
    }

    for(const [level,count] of Object.entries(expectedLevels)){
      const actual=ITEMS.filter(item=>item.level===level).length;
      if(actual!==count)errors.push(`level-count:${level}:${actual}`);
    }
    for(const [kind,count] of Object.entries(expectedKinds)){
      const actual=ITEMS.filter(item=>item.kind===kind).length;
      if(actual!==count)errors.push(`kind-count:${kind}:${actual}`);
    }
    for(const level of Object.keys(expectedLevels)){
      for(const kind of Object.keys(expectedKinds)){
        const minimum=level==='B1+'?1:3;
        const actual=ITEMS.filter(item=>item.level===level&&item.kind===kind).length;
        if(actual<minimum)errors.push(`pool:${level}:${kind}:${actual}`);
      }
    }
    if(errors.length)throw new Error('SENTENCE_CITY_CLEAN_BANK_INVALID\n'+errors.join('\n'));
    return true;
  }

  function createMission(options={}){
    const playerId=String(options.playerId||options.pid||'guest').trim()||'guest';
    const run=String(options.run||options.session||'1');
    const seedText=`${playerId}|sentence-city-clean-v2|${run}|${BANK_VERSION}`;
    const seed=hash32(seedText);
    const random=mulberry32(seed);
    const levels=shuffle(expandQuota(LEVEL_QUOTAS),random);
    const kinds=shuffle(expandQuota(KIND_QUOTAS),random);
    const selected=[];
    const usedIds=new Set();

    for(let index=0;index<10;index++){
      const level=levels[index];
      const kind=kinds[index];
      const candidates=shuffle(ITEMS.filter(item=>item.level===level&&item.kind===kind&&!usedIds.has(item.id)),random);
      const task=candidates[0];
      if(!task)throw new Error(`CLEAN_BANK_SELECTION_FAILED:${level}:${kind}`);
      selected.push(cloneTask(task));
      usedIds.add(task.id);
    }

    const tasks=shuffle(selected,random);
    const setHash=hash32(tasks.map(item=>item.id).join('|')+'|'+seedText);
    return {
      tasks,
      meta:{
        bankVersion:BANK_VERSION,
        bankSize:ITEMS.length,
        playerId,
        run,
        seed,
        setId:`SC2-${setHash.toString(16).padStart(8,'0').toUpperCase()}`,
        itemCount:tasks.length,
        levelDistribution:tasks.reduce((out,item)=>((out[item.level]=(out[item.level]||0)+1),out),{}),
        kindDistribution:tasks.reduce((out,item)=>((out[item.kind]=(out[item.kind]||0)+1),out),{})
      }
    };
  }

  validateBank();
  global.LexiconXSentenceBankV2=Object.freeze({
    version:BANK_VERSION,
    items:Object.freeze(ITEMS.map(item=>Object.freeze(cloneTask(item)))),
    createMission,
    validateBank,
    hash32
  });
})(window);
