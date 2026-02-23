// === /herohealth/fitness-planner/storyboard-generator.js ===
// Auto Storyboard + Script Generator (Markdown + JSON) for Chapter 4 report
// Local-only export

'use strict';

function todayKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function safeStr(x){ return (x==null)?'':String(x); }
function dlText(filename, text){
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}
function dlJson(filename, obj){
  dlText(filename, JSON.stringify(obj, null, 2));
}

function baseScreens(){
  // Shared blocks used across steps
  return {
    consent: {
      id:'consent',
      title:'Instruction + Consent Screen',
      intent:'Ethics / Safety / Participant readiness',
      entry:'เปิดครั้งแรกของวันต่อ PID (หรือบังคับด้วย ?consent=1)',
      steps:[
        'แสดงคำชี้แจงสำหรับครู/ผู้ปกครอง + เด็ก',
        'ติ๊กยืนยัน 2 ช่อง (ครู/ผู้ปกครอง + นักเรียน)',
        'ปุ่ม “เริ่มวันนี้” เปิดหลัง countdown 8s',
      ],
      decision_points:[
        { when:'ยกเลิก', then:'กลับหน้า planner / ไม่เริ่มวัน' },
        { when:'ยืนยันครบ', then:'ไป Attention check (research) หรือไปเกมแรก' }
      ],
      feedback:[
        'ปุ่มเริ่มถูกล็อกจนกว่าจะติ๊กครบ + countdown หมด',
        'เก็บ HHA_CONSENT_LAST + HHA_CONSENT_pid_date'
      ],
      exit:'ไปขั้นถัดไปของวัน'
    },

    attn: {
      id:'attn10',
      title:'Attention Check 10s (Tap STAR only)',
      intent:'Data quality gate (cooperation/attention) without measuring skill',
      entry:'เปิดเฉพาะ run=research หรือบังคับด้วย ?attn=1',
      steps:[
        'อธิบายกติกา: แตะเฉพาะ ⭐ ห้ามแตะ 🟦',
        'เริ่ม 10s: สัญญาณสลับ STAR/BLUE (deterministic by seed+pid)',
        'แสดงถูก/ผิด และเวลาเหลือ',
      ],
      decision_points:[
        { when:'ผ่าน (hit>=4 และ false<=1)', then:'บันทึก attention_passed=1' },
        { when:'ไม่ผ่าน', then:'บันทึก attention_passed=0 (ยังเล่นได้ แต่ exclude ใน analysis)' },
        { when:'กดข้าม', then:'skipped=1 (exclude ใน analysis)' },
      ],
      feedback:[
        'แสดงคะแนนย่อยทันที (ถูก/ผิด/เวลา)',
        'เก็บ HHA_ATTENTION_LAST'
      ],
      exit:'ไปเกมแรกของวัน'
    },

    warmup: {
      id:'warmup',
      title:'Warmup Gate (Practice 8–15s)',
      intent:'Reduce injury + equalize readiness',
      entry:'ก่อนเริ่มเกมแรก',
      steps:[
        'แนะนำท่าพื้นฐาน (เช่น ยืนตรง/หายใจ/ทดสอบแตะ/ทดสอบเล็ง)',
        'ให้ฝึกสั้น ๆ 8–15s',
        'ค่อยเข้าสู่เกมจริง'
      ],
      decision_points:[
        { when:'ครบเวลา', then:'เริ่มเกม' },
        { when:'กดข้าม', then:'เริ่มเกม (log skip)' }
      ],
      feedback:[
        'โค้ชให้ข้อความสั้น ๆ แบบ rate-limit',
        'บันทึก warmup_done และ warmup_skip (ถ้ามี)'
      ],
      exit:'เข้าเกมจริง'
    },

    cooldown: {
      id:'cooldown',
      title:'Cooldown Gate (Cool down 8–15s)',
      intent:'Safety + closure',
      entry:'หลังเกมสุดท้าย/ก่อนกลับ hub/dashboard',
      steps:[
        'แนะนำยืดเหยียดเบา ๆ / หายใจลึก',
        'สรุปวันนี้ “คุณทำได้ดีมาก”',
        'ไป End Dashboard'
      ],
      decision_points:[
        { when:'ครบเวลา', then:'ไป End Dashboard' },
        { when:'กดข้าม', then:'ไป End Dashboard' }
      ],
      feedback:[
        'ให้กำลังใจ + badge hook (ถ้าจบวัน)'
      ],
      exit:'End Dashboard'
    },

    dashboard: {
      id:'end_dashboard',
      title:'End Dashboard (Today Summary + Export Pack)',
      intent:'Teacher-facing summary + export raw/analysis',
      entry:'หลังจบวัน หรือกดจาก planner',
      steps:[
        'แสดง sessions ล่าสุด + bucket (OK/YELLOW/RED) + boss outcomes',
        'ปุ่ม Export ANALYSIS Pack (exclude RED/attn fail)',
        'ปุ่ม Export RAW Pack (โปร่งใสทั้งหมด)'
      ],
      decision_points:[
        { when:'ครูเลือก export', then:'ดาวน์โหลดไฟล์ .md / .json / .csv (local)' }
      ],
      feedback:[
        'แสดงคอมเมนต์แนะนำ retest ถ้าเจอ RED',
        'เปิด/ปิด dashboard ได้'
      ],
      exit:'กลับ planner/hub'
    }
  };
}

function gameTemplates(){
  // Templates for 4 exercise games + boss & fatigue guard notes
  return {
    shadow: {
      id:'shadow',
      title:'Shadow Breaker',
      bloom: { domain:'Psychomotor + Cognitive', level:'Apply → Analyze (with decoys/boss patterns)' },
      objective:[
        'ฝึกการตอบสนองไว (RT) และความแม่น (accuracy)',
        'ฝึกยับยั้งการตอบสนองต่อเป้าหลอก (inhibition)',
      ],
      core_loop:[
        'เห็นเป้า → เล็ง/แตะ → ได้คะแนน/คอมโบ',
        'ถ้าโดน bomb/decoy → โดนหักหรือเสียโอกาส',
        'ช่วงท้ายอาจมี boss pattern (storm/feint/shieldbreak)',
      ],
      mechanics:[
        'Targets: normal/bossface/decoy/bomb/heal/shield',
        'MISS นับเฉพาะ target ที่ “นับ miss จริง” (expire เฉพาะบางชนิดไม่โชว์ miss)',
        'AI Coach: micro-tip แบบ rate-limit (ไม่ปรับ difficulty ใน research)',
        'Fatigue guard: ถ้า RT สูง + miss สูงต่อเนื่อง → แนะนำพัก 15s'
      ],
      screens:[
        { name:'Run HUD', content:'score, combo, time, coach bubble, safe-zone spawn' },
        { name:'Boss Summary (ถ้า boss=1)', content:'phase, attacks, shield breaks, outcome' },
        { name:'End Summary', content:'score/hit/miss/rt + back hub' }
      ],
      script: [
        { who:'Coach', line:'พร้อมนะ! เล็งให้ตรงแล้วแตะเร็ว ๆ 🔥' },
        { who:'System', line:'Perfect! (+combo)' },
        { who:'Coach', line:'ระวังเป้าหลอก! ถ้าไม่ชัวร์อย่ารีบแตะ' },
        { who:'System', line:'Boss incoming! โหมดพายุ/หลอกตา เริ่ม!' }
      ],
      decisions:[
        { when:'เลือกยิงเป้าหลอก vs รอ', then:'คะแนน/ความเสี่ยงเปลี่ยน' },
        { when:'boss storm', then:'คุมจังหวะ + หลบ miss' }
      ],
      exit:'End summary router → Back hub/planner'
    },

    rhythm: {
      id:'rhythm',
      title:'Rhythm Boxer',
      bloom: { domain:'Psychomotor + Affective', level:'Apply → Evaluate (timing discipline)' },
      objective:[
        'ฝึกจังหวะ/การประสานมือ-ตา',
        'ฝึกสมาธิตามบีตและการควบคุมแรง/จังหวะ',
      ],
      core_loop:[
        'โน้ตตกสู่ hit line → กด/แตะ/ชกให้ตรงเวลา',
        'ได้ Perfect/Good/Miss + สะสมคะแนน',
        'มี calibration offset (Cal: ms) ให้ปรับก่อนวิจัย',
      ],
      mechanics:[
        '5 lanes (รองรับ 3 lanes)',
        'AI prediction แสดงได้ (research lock: ไม่ปรับยากง่าย)',
        'Fatigue guard: ช่วง miss รัว+RT พุ่ง → พัก 15s'
      ],
      screens:[
        { name:'Lane HUD', content:'score, streak, accuracy, cal ms, time left' },
        { name:'End Summary', content:'timing accuracy + misses + cal offset used' }
      ],
      script:[
        { who:'Coach', line:'ฟังจังหวะ… แล้วชกตอนโน้ตถึงเส้น!' },
        { who:'System', line:'Perfect!' },
        { who:'Coach', line:'ถ้าช้าไปนิด ปรับ Cal ได้เลยนะ' }
      ],
      decisions:[
        { when:'ปรับ Cal', then:'ลดความคลาด timing (ไม่เปลี่ยนความยาก)' }
      ],
      exit:'End summary router → Back hub/planner'
    },

    jumpduck: {
      id:'jumpduck',
      title:'Jump-Duck',
      bloom: { domain:'Psychomotor', level:'Apply → Analyze (pattern read + dodge)' },
      objective:[
        'ฝึกการกระโดด/ย่อหลบและการคาดการณ์อุปสรรค',
        'ฝึกความคล่องตัว (agility) และการอ่าน pattern',
      ],
      core_loop:[
        'อุปสรรคเข้ามาเป็นชุด → ผู้เล่น jump/duck ให้ทัน',
        'คอมโบเพิ่มเมื่อหลบต่อเนื่อง',
        'บางช่วงเป็น pattern หลอก/สองชั้น'
      ],
      mechanics:[
        'Obstacle waves: low/high/mix (seeded)',
        'AI coach ให้ทิป: “ดูเงา/จังหวะชุดถัดไป”',
        'Fatigue guard (ถ้ามี input timing/RT)'
      ],
      screens:[
        { name:'Action HUD', content:'combo, streak, time, coach bubble' },
        { name:'End Summary', content:'streak max + misses + time survived' }
      ],
      script:[
        { who:'Coach', line:'มาแล้ว! ต่ำ=กระโดด สูง=ย่อ!' },
        { who:'System', line:'Nice dodge!' },
        { who:'Coach', line:'อย่ารีบเกินไป ดูชุดถัดไปก่อนนะ' }
      ],
      decisions:[
        { when:'ชุด mix', then:'ต้องตัดสินใจเร็วขึ้น' }
      ],
      exit:'End summary router → Back hub/planner'
    },

    balance: {
      id:'balance',
      title:'Balance Hold',
      bloom: { domain:'Psychomotor + Cognitive', level:'Apply → Evaluate (stability under distraction)' },
      objective:[
        'ฝึกการทรงตัวและการควบคุมความนิ่ง',
        'ฝึกตัดสินใจหลบสิ่งกีดขวางโดยไม่เสียสมดุล',
      ],
      core_loop:[
        'รักษา indicator ให้อยู่ในช่วงปลอดภัย',
        'มี obstacle เข้ามารบกวน → ปรับตัวอย่างนุ่มนวล',
        'คะแนน stability เพิ่มเมื่อคุมได้ต่อเนื่อง'
      ],
      mechanics:[
        'platform + indicator + obstacle layer (DOM-based)',
        'AI coach: micro-tip “ค่อย ๆ ปรับ อย่ากระชาก”',
        'Fatigue guard: ถ้าสั่นหนัก/พลาดรัว → แนะนำพัก'
      ],
      screens:[
        { name:'Stability HUD', content:'stability%, obstacles, time left, coach' },
        { name:'End Summary', content:'avg stability + hits/avoids + misses' }
      ],
      script:[
        { who:'Coach', line:'คุมให้นิ่งไว้… ค่อย ๆ ขยับนะ' },
        { who:'System', line:'Stable streak +1' },
        { who:'Coach', line:'หลบแล้วกลับมานิ่งให้ไว!' }
      ],
      decisions:[
        { when:'obstacle density สูง', then:'เลือก “หลบ” vs “คุมให้นิ่ง”' }
      ],
      exit:'End summary router → Back hub/planner'
    },

    boss: {
      id:'boss',
      title:'Boss Battle (inserted)',
      bloom: { domain:'Cognitive + Psychomotor', level:'Analyze → Evaluate (choose safe actions under pressure)' },
      objective:[
        'ประยุกต์ทักษะเดิมในสถานการณ์กดดัน',
        'อ่านรูปแบบการโจมตีและเลือกตอบโต้ที่เหมาะสม'
      ],
      core_loop:[
        'เข้าช่วง boss → มี attack patterns (storm/feint/shieldbreak)',
        'ผู้เล่นต้องเลือกจังหวะที่ปลอดภัยเพื่อทำคะแนน/ลด HP',
        'จบด้วย CLEAR/FAIL/END'
      ],
      mechanics:[
        'Boss Summary Card หลังจบ (sessionId)',
        'บันทึก phase/attacks/shield breaks',
        'Research lock: boss pattern seeded, ไม่มี adaptive changes'
      ],
      screens:[
        { name:'Boss HUD', content:'HP, phase, warning telegraph, coach tip' },
        { name:'Boss Summary Card', content:'phase timeline + outcome + back hub' }
      ],
      script:[
        { who:'System', line:'⚠️ Boss incoming!' },
        { who:'Coach', line:'รอจังหวะ… แล้วค่อยโจมตีตอนปลอดภัย!' },
        { who:'System', line:'Shield Break!' }
      ],
      decisions:[
        { when:'storm', then:'เลือกหลบ/รอ ไม่ฝืนยิง' },
        { when:'feint', then:'ต้องยับยั้งการตอบสนอง (inhibition)' }
      ],
      exit:'Boss Summary → Back hub/planner'
    }
  };
}

function mkFlowDoc(ctx){
  // ctx: {pid, run, diff, time, seed, orderSeq, bossWhere, consent, attn}
  const screens = baseScreens();
  const games = gameTemplates();

  const ordered = (safeStr(ctx.orderSeq) || 'shadow>rhythm>jumpduck>balance').split('>').filter(Boolean);
  const blocks = [];

  // Day flow blocks
  blocks.push(screens.consent);
  blocks.push(screens.attn);
  blocks.push(screens.warmup);

  for(const id of ordered){
    if(id === 'boss'){
      blocks.push(games.boss);
    } else if(games[id]){
      blocks.push(games[id]);
    } else {
      // fallback unknown
      blocks.push({ id, title:id, core_loop:[], screens:[], script:[], decisions:[], exit:'End summary' });
    }
  }

  blocks.push(screens.cooldown);
  blocks.push(screens.dashboard);

  return { screens, games, blocks };
}

function toMarkdown(ctx, doc){
  const lines = [];
  lines.push(`# HeroHealth Fitness — Storyboard & Script (Auto)`);
  lines.push(`- date: ${todayKey()}`);
  lines.push(`- pid: ${safeStr(ctx.pid)}`);
  lines.push(`- run: ${safeStr(ctx.run)}`);
  lines.push(`- diff: ${safeStr(ctx.diff)}`);
  lines.push(`- time: ${safeStr(ctx.time)}s`);
  lines.push(`- seed: ${safeStr(ctx.seed)}`);
  lines.push(`- order: ${safeStr(ctx.orderSeq)}`);
  lines.push('');

  // Summary table (very report-friendly)
  lines.push(`## Day Flow Overview`);
  lines.push(`| Step | Module | Bloom focus | Key outcome |`);
  lines.push(`|---:|---|---|---|`);
  let i=1;
  for(const b of doc.blocks){
    const bloom = b.bloom ? `${b.bloom.level}` : (b.intent||'');
    const out = b.exit || '';
    lines.push(`| ${i++} | ${b.title || b.id} | ${b.bloom ? `${b.bloom.domain} • ${b.bloom.level}` : bloom} | ${out} |`);
  }
  lines.push('');

  // Detailed storyboard per block
  for(const b of doc.blocks){
    lines.push(`## ${b.title || b.id}`);
    if(b.bloom) lines.push(`- Bloom: **${b.bloom.domain}** — **${b.bloom.level}**`);
    if(b.intent) lines.push(`- Intent: ${b.intent}`);
    if(b.entry) lines.push(`- Entry: ${b.entry}`);

    if(b.objective?.length){
      lines.push(`### Objectives`);
      for(const x of b.objective) lines.push(`- ${x}`);
    }

    if(b.core_loop?.length){
      lines.push(`### Core Gameplay Loop`);
      for(const x of b.core_loop) lines.push(`- ${x}`);
    }

    if(b.mechanics?.length){
      lines.push(`### Mechanics & AI hooks (research-safe)`);
      for(const x of b.mechanics) lines.push(`- ${x}`);
    }

    if(b.steps?.length){
      lines.push(`### Steps (Screen → Action → Feedback)`);
      for(const x of b.steps) lines.push(`- ${x}`);
    }

    if(b.decision_points?.length){
      lines.push(`### Decision Points`);
      for(const d of b.decision_points){
        lines.push(`- When: **${d.when}** → Then: ${d.then}`);
      }
    } else if(b.decisions?.length){
      lines.push(`### Decision Points`);
      for(const d of b.decisions){
        lines.push(`- When: **${d.when}** → Then: ${d.then}`);
      }
    }

    if(b.screens?.length){
      lines.push(`### UI/Screens`);
      for(const s of b.screens){
        lines.push(`- **${s.name}**: ${s.content}`);
      }
    }

    if(b.script?.length){
      lines.push(`### Script (Coach / System)`);
      for(const s of b.script){
        lines.push(`- **${s.who}**: ${s.line}`);
      }
    }

    if(b.feedback?.length){
      lines.push(`### Feedback / Logging`);
      for(const x of b.feedback) lines.push(`- ${x}`);
    }

    if(b.exit) lines.push(`- Exit: ${b.exit}`);
    lines.push('');
  }

  // Research notes (chapter 4-friendly)
  lines.push(`## Research Notes (Data & Quality Controls)`);
  lines.push(`- Deterministic seed: pid+day+seed drives order/patterns (reduces randomness bias).`);
  lines.push(`- Attention check (10s): used as inclusion gate for analysis set (RAW always kept).`);
  lines.push(`- Fatigue guard: safety + data quality; only recommends rest in research (no adaptive difficulty).`);
  lines.push(`- Boss summary: only when boss=1; produces structured boss metrics for reporting.`);
  lines.push('');

  return lines.join('\n');
}

export function generateStoryboardPack(ctx){
  const c = Object.assign({
    pid:'anon',
    run:'play',
    diff:'normal',
    time:80,
    seed:'0',
    orderSeq:'shadow>rhythm>jumpduck>balance',
  }, ctx||{});

  const doc = mkFlowDoc(c);
  const md = toMarkdown(c, doc);

  return { ctx:c, doc, markdown: md };
}

export function downloadStoryboardPack(ctx){
  const pack = generateStoryboardPack(ctx);
  const base = `HHA_storyboard_${todayKey()}_${safeStr(pack.ctx.pid||'anon')}`;

  dlText(`${base}.md`, pack.markdown);
  dlJson(`${base}.json`, { ctx: pack.ctx, doc: pack.doc });

  // also a small "chapter 4 snippet" for quick paste
  const snippet = [
    `### 4.x Storyboard & Script (Auto-generated)`,
    `โครงสร้างการดำเนินเกมใน 1 วันประกอบด้วย Consent → Attention Check (เฉพาะวิจัย) → Warmup → 4 เกมออกกำลังกาย (counterbalanced) พร้อม Boss insertion (เฉพาะวิจัย/กำหนดโดยครู) → Cooldown → End Dashboard และการส่งออกข้อมูล (RAW/ANALYSIS)`,
    `โดยแต่ละเกมมีการออกแบบกิจกรรมตาม Bloom taxonomy ในมิติ Psychomotor และ Cognitive เพื่อส่งเสริมทักษะการตอบสนอง การทรงตัว การประสานงานมือ-ตา และการยับยั้งการตอบสนองต่อสิ่งลวง (inhibition) พร้อมกลไกควบคุมคุณภาพข้อมูล ได้แก่ attention check และ fatigue guard ที่ไม่ปรับความยากในโหมดวิจัย (research lock)`,
    `อ้างอิงรายละเอียด storyboard+script รายโมดูลในไฟล์แนบ (Markdown/JSON)`,
    ``
  ].join('\n');
  dlText(`${base}_chapter4_snippet.md`, snippet);

  return pack;
}