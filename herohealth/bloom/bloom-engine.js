// === /herohealth/bloom/bloom-engine.js ===
// Bloom Engine (Universal) — inject Remember→Create as micro-tasks for any HeroHealth game
// v20260223-bloom1
'use strict';

(function(){
  const WIN = window;

  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }
  function safeStr(v, max=200){ v=(v==null)?'':String(v); return v.length>max ? v.slice(0,max-1)+'…' : v; }

  function qsGet(name, d=''){
    try{ return (new URL(location.href)).searchParams.get(name) ?? d; }catch(_){ return d; }
  }
  function qsNum(name, d=0){ const n=Number(qsGet(name,d)); return Number.isFinite(n)?n:d; }
  function absUrl(url){
    if(!url) return '';
    try{ return new URL(url, location.href).toString(); }catch(_){ return url; }
  }
  function buildUrl(base, params){
    const u = new URL(base, location.href);
    Object.entries(params||{}).forEach(([k,v])=>{
      if(v===undefined || v===null || v==='') return;
      u.searchParams.set(k, String(v));
    });
    return u.toString();
  }
  function todayKeyLocal(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function hash32(str){
    let h = 2166136261 >>> 0;
    const s = String(str||'');
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // daily gate lock
  function dailyKey(prefix, pid, cat, theme, bphase){
    const day = todayKeyLocal();
    const p = (pid||'anon').trim() || 'anon';
    return `${prefix}:${p}:${cat||''}:${theme||''}:${bphase||''}:${day}`;
  }
  function isDaily(prefix, pid, cat, theme, bphase){
    try{ return localStorage.getItem(dailyKey(prefix,pid,cat,theme,bphase))==='1'; }catch(_){ return false; }
  }
  function markDaily(prefix, pid, cat, theme, bphase){
    try{ localStorage.setItem(dailyKey(prefix,pid,cat,theme,bphase),'1'); }catch(_){}
  }

  // ------------------------------------------------------------
  // Bloom policy: map zone/theme -> tasks for phases
  // Phases supported: remember, understand, apply, analyze, evaluate, create
  // Each task is a "microgame recipe"
  // ------------------------------------------------------------

  function policy(){
    // You can expand/adjust anytime without touching games.
    return {
      nutrition: {
        goodjunk: {
          remember:  { type:'tap-truefalse', title:'จำให้ได้: ของดี vs ของเสีย', items:[
            {q:'น้ำเปล่าเป็นตัวเลือกที่ดี', ok:true},
            {q:'น้ำอัดลมหวานเหมาะดื่มทุกวัน', ok:false},
            {q:'ผลไม้มีประโยชน์', ok:true},
            {q:'ขนมทอดมันเป็นของดีเสมอ', ok:false},
          ]},
          understand:{ type:'pick-why', title:'เข้าใจเหตุผล', items:[
            {q:'ทำไมควรเลี่ยงน้ำหวาน?', opts:['เพราะน้ำตาลสูง','เพราะสีสวย'], ok:0},
            {q:'ทำไมควรกินผัก?', opts:['ช่วยระบบขับถ่าย','ทำให้หิวน้ำ'], ok:0},
          ]},
          evaluate: { type:'choose-better', title:'เลือกให้คุ้ม', items:[
            {a:'🍎 ผลไม้', b:'🍩 โดนัท', ok:'a', why:'น้ำตาล/ไขมันต่ำกว่า'},
            {a:'🥤 น้ำหวาน', b:'💧 น้ำเปล่า', ok:'b', why:'น้ำตาลต่ำ'},
          ]},
          create:   { type:'mini-plan', title:'สร้าง “1 กติกา” ของตัวเอง', prompt:'วันนี้ฉันจะ… (เช่น ดื่มน้ำเปล่า 1 ขวด)', maxLen:60 }
        },
        groups: {
          remember:  { type:'group-snap', title:'จำหมู่ 1–5', rounds:8 },
          understand:{ type:'pick-why', title:'เข้าใจหมู่', items:[
            {q:'หมู่ 3 คืออะไร?', opts:['ผัก','ไขมัน'], ok:0},
            {q:'หมู่ 2 ให้พลังงานหลักจาก?', opts:['คาร์โบไฮเดรต','วิตามิน'], ok:0},
          ]},
          evaluate: { type:'plate-compare', title:'เทียบจาน: จานไหนสมดุลกว่า?', rounds:5 },
          create:   { type:'mini-checklist', title:'สร้างเช็กลิสต์ 3 ข้อ', prompt:'เช็กลิสต์ “กินให้ครบหมู่”', slots:3 }
        },
        hydration: {
          remember:  { type:'tap-truefalse', title:'จำให้ได้: น้ำสำคัญ', items:[
            {q:'ดื่มน้ำช่วยให้ร่างกายทำงานดีขึ้น', ok:true},
            {q:'ไม่ดื่มน้ำทั้งวันไม่เป็นไร', ok:false},
          ]},
          understand:{ type:'pick-why', title:'เข้าใจสัญญาณร่างกาย', items:[
            {q:'สัญญาณขาดน้ำอาจเป็น?', opts:['ปากแห้ง','หิวขนม'], ok:0},
          ]},
          evaluate: { type:'choose-better', title:'เลือกเครื่องดื่ม', items:[
            {a:'🧋 ชานมหวาน', b:'💧 น้ำเปล่า', ok:'b', why:'น้ำตาลต่ำ'},
          ]},
          create:   { type:'mini-plan', title:'ตั้งเป้าน้ำวันนี้', prompt:'วันนี้ฉันจะดื่มน้ำ…แก้ว', maxLen:20 }
        },
        plate: {
          remember:  { type:'group-snap', title:'หมู่ 1–5 (เร็ว)', rounds:8 },
          understand:{ type:'pick-why', title:'เข้าใจ “จานสมดุล”', items:[
            {q:'จานสมดุลควรมีอะไร?', opts:['หลายหมู่','หมู่เดียว'], ok:0},
          ]},
          evaluate: { type:'plate-compare', title:'เทียบจาน (สมดุล)', rounds:5 },
          create:   { type:'mini-checklist', title:'เมนูในฝัน 3 อย่าง', prompt:'เลือกอาหาร 3 อย่างให้ได้หลายหมู่', slots:3 }
        }
      },

      hygiene: {
        handwash: {
          remember:  { type:'order-steps', title:'จำลำดับล้างมือ', steps:['ถูฝ่ามือ','ถูหลังมือ','ซอกนิ้ว','หลังนิ้ว','นิ้วโป้ง','ปลายนิ้ว/เล็บ'], take:3 },
          understand:{ type:'pick-why', title:'เข้าใจจุดเสี่ยง', items:[
            {q:'ทำไมต้องถูซอกนิ้ว?', opts:['เชื้อชอบซ่อน','เพื่อให้มือหอม'], ok:0},
          ]},
          evaluate: { type:'choose-better', title:'เลือกพฤติกรรมที่ดีกว่า', items:[
            {a:'ล้างมือก่อนกิน', b:'ล้างมือเฉพาะตอนสกปรกมาก', ok:'a', why:'ลดเชื้อก่อนเข้าปาก'},
          ]},
          create:   { type:'mini-checklist', title:'สร้างรูทีน “ก่อนกิน/หลังห้องน้ำ”', prompt:'รูทีนล้างมือ 3 ข้อ', slots:3 }
        },
        brush: {
          remember:  { type:'tap-truefalse', title:'จำให้ได้: แปรงฟัน', items:[
            {q:'ควรแปรงอย่างน้อยวันละ 2 ครั้ง', ok:true},
            {q:'แปรงแรง ๆ ยิ่งดี', ok:false},
          ]},
          understand:{ type:'pick-why', title:'เข้าใจคราบฟัน', items:[
            {q:'คราบสะสมทำให้เกิดอะไร?', opts:['ฟันผุ','ตาแดง'], ok:0},
          ]},
          evaluate: { type:'choose-better', title:'เลือกวิธีที่ดีกว่า', items:[
            {a:'แปรงเบา ๆ ทั่วถึง', b:'แปรงแรงเฉพาะด้านหน้า', ok:'a', why:'ลดเหงือกอักเสบ'},
          ]},
          create:   { type:'mini-plan', title:'ตั้งเป้า “แปรงครบกี่นาที”', prompt:'ฉันจะตั้งเวลาแปรงฟัน…นาที', maxLen:20 }
        },
        maskcough: {
          remember:  { type:'scenario-choice', title:'จำสถานการณ์', rounds:6 },
          understand:{ type:'pick-why', title:'เข้าใจการแพร่เชื้อ', items:[
            {q:'ไอ/จามควรทำอะไร?', opts:['ปิดปาก-จมูก','หัวเราะ'], ok:0},
          ]},
          evaluate: { type:'choose-better', title:'เลือกการตัดสินใจ', items:[
            {a:'ใส่หน้ากากในที่แออัด', b:'ไม่ใส่เพราะร้อน', ok:'a', why:'ลดละอองฝอย'},
          ]},
          create:   { type:'mini-checklist', title:'สร้าง “กติกา 3 ข้อ”', prompt:'กติกามารยาทไอจาม', slots:3 }
        },
        germdetective: {
          remember:  { type:'tap-spot', title:'จำ “จุดเสี่ยง”', spots:['ลูกบิดประตู','รีโมต','โต๊ะกินข้าว','โทรศัพท์','ก๊อกน้ำ'], rounds:7 },
          understand:{ type:'pick-why', title:'เข้าใจหลักฐาน', items:[
            {q:'จุดไหนเสี่ยงเพราะ “หลายคนจับ”', opts:['ลูกบิดประตู','หมอน'], ok:0},
          ]},
          analyze:   { type:'mini-case', title:'วิเคราะห์เส้นทางแพร่', rounds:3 },
          create:   { type:'mini-checklist', title:'สร้างแผน “ทำความสะอาด 3 จุด”', prompt:'วันนี้ฉันจะเช็ด…', slots:3 }
        },
        bath: {
          remember:  { type:'order-steps', title:'จำลำดับอาบน้ำ', steps:['เปียก','ฟอก','ถู','ล้าง','เช็ด'], take:3 },
          understand:{ type:'pick-why', title:'เข้าใจจุดอับ', items:[
            {q:'ทำไมต้องเน้น “หลังหู/ซอกนิ้ว”', opts:['เชื้อ/คราบสะสม','เพื่อความเท่'], ok:0},
          ]},
          evaluate: { type:'choose-better', title:'เลือกให้คุ้ม', items:[
            {a:'ถูจุดอับก่อน', b:'ข้ามเพราะรีบ', ok:'a', why:'ลดคราบสะสม'},
          ]},
          create:   { type:'mini-plan', title:'ตั้งเป้า “จุดอับ 1 จุด”', prompt:'วันนี้ฉันจะไม่ลืมถู…', maxLen:40 }
        },
        cleanobjects: {
          remember:  { type:'tap-spot', title:'จำ “ของที่ควรเช็ด”', spots:['ลูกบิด','สวิตช์ไฟ','รีโมต','โต๊ะ','มือถือ'], rounds:7 },
          understand:{ type:'pick-why', title:'เข้าใจความคุ้ม', items:[
            {q:'ทำไมต้องทำ “ของที่จับบ่อย” ก่อน?', opts:['ลดเชื้อเร็ว','เพราะสวย'], ok:0},
          ]},
          evaluate: { type:'choose-better', title:'จัดลำดับความสำคัญ', items:[
            {a:'รีโมตทีวี', b:'ผนังห้อง', ok:'a', why:'จับบ่อยกว่า'},
          ]},
          create:   { type:'mini-checklist', title:'สร้างรูทีน “บ้านสะอาด 3 ขั้น”', prompt:'รูทีนบ้านสะอาด', slots:3 }
        }
      },

      exercise: {
        shadow: {
          remember:  { type:'tap-truefalse', title:'จำท่าพื้นฐาน', items:[
            {q:'ก่อนชกควรยืนทรงตัว', ok:true},
            {q:'กลั้นหายใจระหว่างชกดีที่สุด', ok:false},
          ]},
          understand:{ type:'pick-why', title:'เข้าใจจังหวะ', items:[
            {q:'ทำไมต้องดู “จังหวะ”', opts:['คุมพลัง/แม่น','เพราะสนุกเฉย ๆ'], ok:0},
          ]},
          apply:    { type:'reaction-left-right', title:'Apply: ซ้าย/ขวา 20 วิ', dur:20 },
          create:   { type:'mini-plan', title:'ตั้งเป้า “วันนี้จะตี/หลบ”', prompt:'วันนี้ฉันจะฝึก…', maxLen:50 }
        },
        rhythm: {
          remember:  { type:'tap-truefalse', title:'จำกติกา', items:[
            {q:'ตีให้ตรงจังหวะถึงจะได้แต้ม', ok:true},
            {q:'ตีมั่ว ๆ ก็ได้คะแนนเท่าเดิม', ok:false},
          ]},
          apply:    { type:'reaction-left-right', title:'Apply: ซ้าย/ขวา', dur:20 },
          evaluate: { type:'choose-better', title:'เลือกกลยุทธ์', items:[
            {a:'คุมจังหวะก่อนเร็ว', b:'รีบอย่างเดียว', ok:'a', why:'คอมโบเสถียรกว่า'},
          ]},
          create:   { type:'mini-checklist', title:'สร้างแผนฝึก 3 ข้อ', prompt:'แผนฝึก Rhythm', slots:3 }
        },
        jumpduck: {
          remember:  { type:'tap-truefalse', title:'จำคำสั่ง', items:[
            {q:'Jump = ขึ้น, Duck = ลง', ok:true},
            {q:'Duck คือกระโดด', ok:false},
          ]},
          apply:    { type:'reaction-jump-duck', title:'Apply: Jump/Duck 20 วิ', dur:20 },
          analyze:  { type:'mini-reflect', title:'วิเคราะห์พลาด', prompt:'พลาดเพราะอะไร? (เช่น ช้า/เผลอ)', maxLen:60 },
          create:   { type:'mini-plan', title:'ตั้งเป้า “พลาดน้อยลง”', prompt:'รอบหน้า ฉันจะ…', maxLen:60 }
        },
        balancehold: {
          remember:  { type:'tap-truefalse', title:'จำหลักทรงตัว', items:[
            {q:'มองจุดนิ่งช่วยทรงตัว', ok:true},
            {q:'แกว่งตัวช่วยให้มั่นคงขึ้น', ok:false},
          ]},
          apply:    { type:'hold-meter', title:'Apply: คุมให้อยู่กลาง', dur:20 },
          evaluate: { type:'mini-reflect', title:'ประเมินตนเอง', prompt:'วันนี้ทรงตัวได้กี่คะแนนจาก 10?', maxLen:10 },
          create:   { type:'mini-plan', title:'ตั้งเป้า Balance', prompt:'ฉันจะฝึก balance…นาที', maxLen:20 }
        },
        planner: {
          remember:  { type:'tap-truefalse', title:'จำหลักวางแผน', items:[
            {q:'แบ่งเป็นช่วงช่วยทำได้จริง', ok:true},
            {q:'ทำอะไรก็ได้ไม่ต้องวางแผน', ok:false},
          ]},
          understand:{ type:'pick-why', title:'เข้าใจการตั้งเป้า', items:[
            {q:'เป้าหมายที่ดีควร…', opts:['ชัดเจนและทำได้','ยาวและยากที่สุด'], ok:0},
          ]},
          create:   { type:'mini-checklist', title:'สร้างแผน 3 ช่วง', prompt:'เช้า/กลางวัน/เย็น', slots:3 }
        }
      }
    };
  }

  function getTask(cat, theme, bphase){
    const P = policy();
    cat = String(cat||'nutrition').toLowerCase().trim();
    theme = String(theme||'').toLowerCase().trim();
    bphase = String(bphase||'remember').toLowerCase().trim();

    const byCat = P[cat] || P.nutrition;
    const byTheme = byCat[theme] || byCat[Object.keys(byCat)[0]] || null;
    if(!byTheme) return null;

    // fallback phase
    return byTheme[bphase] || byTheme.remember || null;
  }

  // deterministic pick helper (for item order etc.)
  function makeRng(seedStr){
    let s = hash32(seedStr) || 1;
    return function(){
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17; s >>>= 0;
      s ^= s << 5;  s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------
  // Public API: runBloomGate({mount, ...})
  // mount must provide: setHUD({time,score,miss,total}), showToast, flashGood/Bad, end(payload)
  // ------------------------------------------------------------
  function runBloomGate(opts){
    opts = opts || {};
    const mount = opts.mount || {};
    const setHUD = mount.setHUD || function(){};
    const end = mount.end || function(){};
    const showToast = mount.showToast || function(){};
    const flashGood = mount.flashGood || function(){};
    const flashBad  = mount.flashBad  || function(){};

    const bphase = String(opts.bphase || qsGet('bphase','remember')).toLowerCase();
    const cat = String(opts.cat || qsGet('cat','nutrition')).toLowerCase();
    const theme = String(opts.theme || qsGet('theme','goodjunk')).toLowerCase();

    const pid = String(opts.pid || qsGet('pid','anon')).trim() || 'anon';
    const run = String(opts.run || qsGet('run','play')).toLowerCase().trim() || 'play';
    const pick = String(opts.pick || qsGet('pick', (run==='research'?'day':'rand'))).toLowerCase().trim();
    const dur = clamp(opts.dur ?? qsNum('dur', 25), 10, 60);

    const dailyPrefix = 'HHA_BLOOM_DONE';
    const dailyDone = isDaily(dailyPrefix, pid, cat, theme, bphase);

    const dayKey = todayKeyLocal();
    const slot = String(qsGet('planSlot','')).toLowerCase().trim();
    const seedStr = `${pid}|${dayKey}|${slot}|${cat}|${theme}|${bphase}|${run}|bloom`;

    const rng = makeRng(seedStr);

    // auto-skip if daily done
    if(dailyDone && mount.autoSkip){
      mount.autoSkip();
      return;
    }

    let started = true;
    let tLeft = dur;
    let score=0, miss=0, total=0;
    let raf=0, lastTs=0;

    function tick(ts){
      if(!started) return;
      if(!lastTs) lastTs = ts;
      const dt = Math.min(0.25, (ts-lastTs)/1000);
      lastTs = ts;
      tLeft = Math.max(0, tLeft - dt);
      setHUD({ time: Math.ceil(tLeft), score, miss, total });
      if(tLeft<=0){
        finish({ ok:1 });
        return;
      }
      raf = requestAnimationFrame(tick);
    }

    function finish(extra){
      if(!started) return;
      started = false;
      cancelAnimationFrame(raf);

      markDaily(dailyPrefix, pid, cat, theme, bphase);

      const payload = Object.assign({
        kind: 'bloom_summary',
        ts: Date.now(),
        dayKey,
        pid,
        run,
        cat,
        theme,
        bphase,
        dur,
        score, miss, total,
        acc: total ? (score/Math.max(1,total)) : 0
      }, extra || {});

      end(payload);
    }

    function pickOne(arr){
      if(!arr || !arr.length) return null;
      const idx = Math.floor(rng() * arr.length);
      return arr[idx];
    }

    // -------- Task runners (microgames) --------
    const task = getTask(cat, theme, bphase) || { type:'tap-truefalse', title:'Bloom', items:[{q:'พร้อมไหม?', ok:true}] };

    // Expose title
    if(mount.setTitle) mount.setTitle(task.title || `Bloom: ${bphase}`);

    // dispatcher
    const type = String(task.type||'').toLowerCase();

    // Helpers to interact from UI layer
    const ui = mount.ui || {}; // { setQuestion(text), setPrompt(text), setOptions([{label, onClick}]), setInput(...) }

    function correct(){
      score++; total++;
      showToast('+1'); flashGood();
    }
    function wrong(){
      miss++; total++;
      showToast('MISS'); flashBad();
    }

    // tap-truefalse
    if(type === 'tap-truefalse'){
      const items = (task.items || []).slice();
      function next(){
        const it = pickOne(items) || items[0] || {q:'—', ok:true};
        ui.setQuestion && ui.setQuestion(it.q);
        ui.setOptions && ui.setOptions([
          { label:'จริง', onClick: ()=>{ (it.ok?correct:wrong)(); next(); } },
          { label:'ไม่จริง', onClick: ()=>{ (!it.ok?correct:wrong)(); next(); } },
        ]);
      }
      next();
    }

    // pick-why
    else if(type === 'pick-why'){
      const items = (task.items || []).slice();
      function next(){
        const it = pickOne(items) || items[0];
        ui.setQuestion && ui.setQuestion(it.q);
        const opts = (it.opts||[]).slice(0,4);
        ui.setOptions && ui.setOptions(opts.map((t,i)=>({
          label: t,
          onClick: ()=>{ (i===Number(it.ok||0) ? correct : wrong)(); next(); }
        })));
      }
      next();
    }

    // choose-better
    else if(type === 'choose-better'){
      const items = (task.items || []).slice();
      function next(){
        const it = pickOne(items) || items[0];
        ui.setQuestion && ui.setQuestion('เลือกอันที่ดีกว่า');
        ui.setPrompt && ui.setPrompt(`${it.a}  VS  ${it.b}${it.why ? `\n(คำใบ้: ${it.why})` : ''}`);
        ui.setOptions && ui.setOptions([
          {label: it.a, onClick: ()=>{ (it.ok==='a'?correct:wrong)(); next(); }},
          {label: it.b, onClick: ()=>{ (it.ok==='b'?correct:wrong)(); next(); }},
        ]);
      }
      next();
    }

    // group-snap (Thai 5 food groups)
    else if(type === 'group-snap'){
      const pool = [
        {emo:'🥚', g:1},{emo:'🐟', g:1},{emo:'🥛', g:1},{emo:'🥜', g:1},
        {emo:'🍚', g:2},{emo:'🍞', g:2},{emo:'🥔', g:2},{emo:'🍠', g:2},
        {emo:'🥦', g:3},{emo:'🥬', g:3},{emo:'🥒', g:3},{emo:'🥕', g:3},
        {emo:'🍎', g:4},{emo:'🍌', g:4},{emo:'🍉', g:4},{emo:'🍊', g:4},
        {emo:'🥑', g:5},{emo:'🧈', g:5},{emo:'🫒', g:5},{emo:'🥥', g:5},
      ];
      const rounds = clamp(task.rounds||8, 4, 30);
      let left = rounds;
      function next(){
        if(left<=0){ finish({ ok:1, done:1 }); return; }
        left--;
        const it = pickOne(pool) || pool[0];
        ui.setQuestion && ui.setQuestion(`อาหาร: ${it.emo} อยู่หมู่ไหน?`);
        ui.setPrompt && ui.setPrompt('หมู่1 โปรตีน • หมู่2 คาร์บ • หมู่3 ผัก • หมู่4 ผลไม้ • หมู่5 ไขมัน');
        ui.setOptions && ui.setOptions([1,2,3,4,5].map(n=>({
          label:`หมู่ ${n}`,
          onClick: ()=>{ (n===it.g?correct:wrong)(); next(); }
        })));
      }
      next();
    }

    // order-steps
    else if(type === 'order-steps'){
      const steps = (task.steps||[]).slice();
      const take = clamp(task.take||3, 2, 6);
      function shuffle(a){
        for(let i=a.length-1;i>0;i--){
          const j = Math.floor(rng()*(i+1));
          [a[i],a[j]]=[a[j],a[i]];
        }
      }
      let order = [];
      function newRound(){
        const s = steps.slice();
        shuffle(s);
        order = s.slice(0,take);
        ui.setQuestion && ui.setQuestion(`แตะตามลำดับ 1 → ${take}`);
        ui.setPrompt && ui.setPrompt(order.map((x,i)=>`${i+1}) ${x}`).join('\n'));
        const opts = order.slice();
        shuffle(opts);
        let idx = 0;
        ui.setOptions && ui.setOptions(opts.map(txt=>({
          label: txt,
          onClick: ()=> {
            if(txt === order[idx]){ correct(); idx++; if(idx>=take) newRound(); }
            else { wrong(); }
          }
        })));
      }
      newRound();
    }

    // scenario-choice (mask/cough quick)
    else if(type === 'scenario-choice'){
      const cases = [
        {q:'อยู่ในที่แออัด', ok:'ใส่หน้ากาก', emo:'😷'},
        {q:'ไอ/จามกะทันหัน', ok:'ปิดปาก-จมูก', emo:'🤧'},
        {q:'อยู่ใกล้คนอื่น', ok:'เว้นระยะ', emo:'↔️'},
        {q:'มือไม่สะอาดหลังจับของ', ok:'ล้างมือ', emo:'🧼'},
      ];
      const actions=['ใส่หน้ากาก','ปิดปาก-จมูก','เว้นระยะ','ล้างมือ'];
      const rounds = clamp(task.rounds||6, 4, 20);
      let left=rounds;
      function next(){
        if(left<=0){ finish({ ok:1, done:1 }); return; }
        left--;
        const it = pickOne(cases) || cases[0];
        ui.setQuestion && ui.setQuestion(`${it.emo} ${it.q}`);
        ui.setOptions && ui.setOptions(actions.map(a=>({
          label:a,
          onClick: ()=>{ (a===it.ok?correct:wrong)(); next(); }
        })));
      }
      next();
    }

    // tap-spot
    else if(type === 'tap-spot'){
      const spots = (task.spots||[]).slice();
      const rounds = clamp(task.rounds||7, 4, 25);
      let left=rounds;
      function next(){
        if(left<=0){ finish({ ok:1, done:1 }); return; }
        left--;
        const it = pickOne(spots) || spots[0] || 'จุดเสี่ยง';
        ui.setQuestion && ui.setQuestion(`จุดเสี่ยง: ${it}`);
        ui.setPrompt && ui.setPrompt('แตะ “ใช่” ถ้าคิดว่าเป็นจุดเสี่ยงที่ควรทำความสะอาดบ่อย');
        ui.setOptions && ui.setOptions([
          {label:'ใช่', onClick: ()=>{ correct(); next(); }},
          {label:'ไม่ใช่', onClick: ()=>{ wrong(); next(); }},
        ]);
      }
      next();
    }

    // mini-case (analyze)
    else if(type === 'mini-case'){
      const rounds = clamp(task.rounds||3, 2, 10);
      let left=rounds;
      function next(){
        if(left<=0){ finish({ ok:1, done:1 }); return; }
        left--;
        // simple chain puzzle
        const cases = [
          {q:'A ไอใส่มือ แล้วจับลูกบิด → B จับลูกบิด', ok:'ลูกบิดประตู'},
          {q:'A จามใส่โต๊ะ → B วางขนมบนโต๊ะ', ok:'โต๊ะ'},
          {q:'A ใช้รีโมต → B ใช้ต่อทันที', ok:'รีโมต'},
        ];
        const it = pickOne(cases) || cases[0];
        const opts = ['ลูกบิดประตู','โต๊ะ','รีโมต','หมอน'];
        ui.setQuestion && ui.setQuestion(`คดี: ${it.q}`);
        ui.setPrompt && ui.setPrompt('หลักฐานสำคัญคือ “จุดสัมผัส” ไหน?');
        ui.setOptions && ui.setOptions(opts.map(o=>({
          label:o,
          onClick: ()=>{ (o===it.ok?correct:wrong)(); next(); }
        })));
      }
      next();
    }

    // reaction-left-right
    else if(type === 'reaction-left-right'){
      const dur2 = clamp(task.dur||20, 10, 45);
      // override local timer by finishing at dur2 if shorter
      let localEnd = Date.now() + dur2*1000;
      function tick2(ts){
        if(!started) return;
        if(Date.now() >= localEnd){ finish({ ok:1, done:1 }); return; }
        raf = requestAnimationFrame(tick2);
      }
      const cmds = ['ซ้าย','ขวา'];
      function next(){
        const cmd = pickOne(cmds) || 'ซ้าย';
        ui.setQuestion && ui.setQuestion(`คำสั่ง: ${cmd}`);
        ui.setOptions && ui.setOptions(cmds.map(c=>({
          label:c,
          onClick: ()=>{ (c===cmd?correct:wrong)(); next(); }
        })));
      }
      next();
      raf = requestAnimationFrame(tick2);
      // start global clock too (keeps HUD time)
    }

    // reaction-jump-duck
    else if(type === 'reaction-jump-duck'){
      const dur2 = clamp(task.dur||20, 10, 45);
      let localEnd = Date.now() + dur2*1000;
      function tick2(ts){
        if(!started) return;
        if(Date.now() >= localEnd){ finish({ ok:1, done:1 }); return; }
        raf = requestAnimationFrame(tick2);
      }
      const cmds = ['JUMP','DUCK'];
      function next(){
        const cmd = pickOne(cmds) || 'JUMP';
        ui.setQuestion && ui.setQuestion(`คำสั่ง: ${cmd}`);
        ui.setOptions && ui.setOptions(cmds.map(c=>({
          label:c,
          onClick: ()=>{ (c===cmd?correct:wrong)(); next(); }
        })));
      }
      next();
      raf = requestAnimationFrame(tick2);
    }

    // hold-meter (apply balance)
    else if(type === 'hold-meter'){
      const dur2 = clamp(task.dur||20, 10, 45);
      let localEnd = Date.now() + dur2*1000;
      let x=0.5, v=0, holding=false;
      ui.setQuestion && ui.setQuestion('กดค้างเพื่อคุมให้อยู่กลาง');
      ui.setPrompt && ui.setPrompt('กด HOLD แล้วคุมให้อยู่กลางให้ได้มากที่สุด');
      ui.setOptions && ui.setOptions([
        {label:'HOLD', onDown:()=>{holding=true;}, onUp:()=>{holding=false;}}
      ]);

      function step(){
        if(!started) return;
        if(Date.now() >= localEnd){ finish({ ok:1, done:1 }); return; }
        v += (rng()-0.5)*0.01;
        if(holding){
          v *= 0.90;
          x += (0.5-x)*0.04;
        }else{
          x += v;
        }
        x = Math.max(0.05, Math.min(0.95, x));
        total++;
        if(holding){
          if(x>=0.45 && x<=0.55) score++; else miss++;
        }
        if(ui.setMeter) ui.setMeter(x);
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // plate-compare (simple)
    else if(type === 'plate-compare'){
      const rounds = clamp(task.rounds||5, 3, 12);
      let left=rounds;

      const plates = [
        {a:['🥦','🍚','🐟'], b:['🍩','🍟','🥤'], ok:'a'},
        {a:['🍎','🥛','🍞'], b:['🍬','🍭','🧋'], ok:'a'},
        {a:['🥦','🍎','🥑'], b:['🍕','🥤','🍩'], ok:'a'},
        {a:['🍚','🐟','🥬'], b:['🍟','🍔','🥤'], ok:'a'},
      ];

      function next(){
        if(left<=0){ finish({ ok:1, done:1 }); return; }
        left--;
        const it = pickOne(plates) || plates[0];
        ui.setQuestion && ui.setQuestion('จานไหนสมดุลกว่า?');
        ui.setPrompt && ui.setPrompt(`A: ${it.a.join(' ')}\nB: ${it.b.join(' ')}`);
        ui.setOptions && ui.setOptions([
          {label:'เลือก A', onClick: ()=>{ (it.ok==='a'?correct:wrong)(); next(); }},
          {label:'เลือก B', onClick: ()=>{ (it.ok==='b'?correct:wrong)(); next(); }},
        ]);
      }
      next();
    }

    // mini-plan (single input)
    else if(type === 'mini-plan'){
      ui.setQuestion && ui.setQuestion(task.title || 'สร้างเป้าหมาย');
      ui.setPrompt && ui.setPrompt(task.prompt || 'พิมพ์เป้าหมายของคุณ');
      ui.setInput && ui.setInput({ placeholder: task.prompt || 'พิมพ์…', maxLen: clamp(task.maxLen||60, 10, 140) });
      ui.setOptions && ui.setOptions([
        {label:'บันทึก', onClick: ()=> {
          const v = ui.getInput ? ui.getInput() : '';
          finish({ ok:1, planText: safeStr(v, 140) });
        }},
        {label:'ข้าม', onClick: ()=> finish({ ok:0, skipped:1 })}
      ]);
    }

    // mini-checklist (3 slots)
    else if(type === 'mini-checklist'){
      const slots = clamp(task.slots||3, 2, 5);
      const values = Array(slots).fill('');
      ui.setQuestion && ui.setQuestion(task.title || 'สร้างเช็กลิสต์');
      ui.setPrompt && ui.setPrompt(task.prompt || 'พิมพ์ทีละข้อ');

      ui.setChecklist && ui.setChecklist({ slots, values });

      ui.setOptions && ui.setOptions([
        {label:'บันทึก', onClick: ()=> {
          const v = ui.getChecklist ? ui.getChecklist() : values;
          finish({ ok:1, checklist: (v||[]).map(x=>safeStr(x,80)).filter(Boolean).slice(0,slots) });
        }},
        {label:'ข้าม', onClick: ()=> finish({ ok:0, skipped:1 })}
      ]);
    }

    // mini-reflect (text input)
    else if(type === 'mini-reflect'){
      ui.setQuestion && ui.setQuestion(task.title || 'สะท้อนผล');
      ui.setPrompt && ui.setPrompt(task.prompt || 'พิมพ์สั้น ๆ');
      ui.setInput && ui.setInput({ placeholder: task.prompt || 'พิมพ์…', maxLen: clamp(task.maxLen||60, 10, 200) });
      ui.setOptions && ui.setOptions([
        {label:'บันทึก', onClick: ()=> {
          const v = ui.getInput ? ui.getInput() : '';
          finish({ ok:1, reflect: safeStr(v, 200) });
        }},
        {label:'ข้าม', onClick: ()=> finish({ ok:0, skipped:1 })}
      ]);
    }

    // fallback
    else {
      ui.setQuestion && ui.setQuestion('Bloom task');
      ui.setPrompt && ui.setPrompt('ยังไม่กำหนด task type นี้');
      ui.setOptions && ui.setOptions([{label:'ไปต่อ', onClick: ()=>finish({ ok:1 })}]);
    }

    // start HUD timer
    setHUD({ time: Math.ceil(tLeft), score, miss, total });
    raf = requestAnimationFrame(tick);
  }

  // export global
  WIN.HHA_BloomEngine = {
    runBloomGate,
    getTask: (cat,theme,bphase)=>getTask(cat,theme,bphase),
    buildUrl,
    absUrl
  };
})();