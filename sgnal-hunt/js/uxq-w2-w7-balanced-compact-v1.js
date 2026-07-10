/* CSAI2601 UX Quest • W2-W7 Balanced Compact v2
 * Scope: W2-W7 only.
 * v2: Question Stem Rotation
 * - no repeated generic stem such as "เลือกคำตอบที่ตรงกับหน้าที่ของข้อนี้ที่สุด"
 * - rotates mission-specific prompts by node + progress + card context
 * - keeps final W1 readable-card standard, equal-length choice guard, scoring, reason, sheet sync
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search || '');
  const NODE = String(params.get('node') || params.get('id') || '').toUpperCase();
  if (!/^W[2-7]$/.test(NODE)) return;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const badges = {
    W2:'✅ W2 HCD Lab • varied stems / fair choices',
    W3:'✅ W3 Psychology • varied stems / fair choices',
    W4:'✅ W4 Research • varied stems / fair choices',
    W5:'✅ W5 Define/HMW • varied stems / fair choices',
    W6:'✅ W6 Flow Map • varied stems / fair choices',
    W7:'✅ W7 Wireframe • varied stems / fair choices'
  };

  const titles = {
    W2:['HCD Evidence Lab','เลือกหลักฐานที่โยงผู้ใช้ → ปัญหา → ทดลอง'],
    W3:['Psychology Signal','วิเคราะห์ attention, memory, load และ feedback'],
    W4:['Research Detective','แยกหลักฐานจริงออกจาก assumption'],
    W5:['Problem/HMW Studio','นิยามปัญหา root cause และโจทย์ How Might We'],
    W6:['Flow Mapper','จัดเส้นทางงานให้ผู้ใช้ไปต่อได้'],
    W7:['Wireframe Forge','จัด priority, layout, CTA และ mobile']
  };

  const STEMS = {
    W2:[
      'จากสถานการณ์นี้ หลักฐานใดเชื่อมผู้ใช้กับปัญหาได้ตรงที่สุด',
      'ถ้าต้องตัดสินใจแบบ Human-Centered Design ควรเลือกข้อใดก่อน',
      'ข้อใดช่วยให้เข้าใจ need ของผู้ใช้ ไม่ใช่แค่ความเห็นของทีม',
      'เลือกคำตอบที่ใช้ evidence เพื่อพัฒนา solution ได้ปลอดภัยที่สุด',
      'ถ้าจะทดลองรอบถัดไป ควรยึดข้อมูลผู้ใช้ข้อใดมากที่สุด'
    ],
    W3:[
      'พฤติกรรมในเคสนี้สะท้อน attention, memory หรือ cognitive load อย่างไร',
      'ข้อใดอธิบายผลกระทบต่อผู้ใช้ได้ตรงกับหลัก psychology ที่สุด',
      'ถ้าผู้ใช้สับสน จุดใดควรแก้เพื่อลดภาระทางความคิดก่อน',
      'เลือกคำตอบที่เชื่อม feedback กับการรับรู้ของผู้ใช้ได้ชัดที่สุด',
      'หลักฐานใดช่วยบอกว่าปัญหาเกิดจาก perception หรือ memory load'
    ],
    W4:[
      'ข้อมูลใดเป็น research evidence ไม่ใช่ assumption ของทีม',
      'ถ้าต้องสรุป insight จากผู้ใช้จริง ควรเลือกข้อใด',
      'ข้อใดช่วยแยก observation ออกจาก interpretation ได้ดีที่สุด',
      'ก่อนตัดสินใจออกแบบ ควรตรวจหลักฐานข้อใดก่อน',
      'คำตอบใดลด bias จากการเดาหรือสรุปเร็วเกินไป'
    ],
    W5:[
      'จากสถานการณ์นี้ อะไรคือ root cause ที่ควรแก้ก่อน',
      'ข้อใดอธิบายสาเหตุหลัก ไม่ใช่อาการปลายทาง',
      'ถ้าจะเขียน HMW ให้ตรงปัญหา ควรเลือกฐานคิดข้อใด',
      'ตัวเลือกใดเชื่อม problem statement กับ evidence ได้ดีที่สุด',
      'ถ้าต้องลดปัญหาซ้ำ ควรแก้จุดใดก่อนสร้าง solution',
      'คำตอบใดช่วยเปลี่ยน complaint ให้เป็นโจทย์ออกแบบที่ทำต่อได้',
      'ข้อใดเป็นการ frame ปัญหาโดยไม่กระโดดไป solution เร็วเกินไป'
    ],
    W6:[
      'จาก flow นี้ จุดใดควรถูกจัดลำดับเพื่อให้ผู้ใช้ไปต่อได้',
      'ข้อใดลด friction ใน user journey ได้ตรงที่สุด',
      'ถ้าผู้ใช้หลุดจาก flow ควรแก้ checkpoint ใดก่อน',
      'คำตอบใดเชื่อม step, decision และ feedback ได้ชัดที่สุด',
      'เลือกสิ่งที่ทำให้ path ของผู้ใช้สมเหตุสมผลขึ้น'
    ],
    W7:[
      'ใน wireframe นี้ องค์ประกอบใดควรมี priority สูงสุด',
      'ถ้าหน้าจอบนมือถือพื้นที่จำกัด ควรวางอะไรให้ชัดก่อน',
      'ข้อใดทำให้ CTA, layout และ hierarchy ใช้งานง่ายขึ้น',
      'เลือกคำตอบที่แก้ปัญหา visual priority ได้ตรงที่สุด',
      'ถ้าผู้ใช้ต้องตัดสินใจเร็ว wireframe ควรเน้นจุดใด'
    ]
  };

  const HINTS = {
    W2:['คำใบ้: มองหา evidence ที่โยง user need กับ action ได้จริง','คำใบ้: HCD เริ่มจากผู้ใช้ ไม่ใช่ความชอบของทีม','คำใบ้: evidence ที่ดีต้องช่วยทดลองต่อได้'],
    W3:['คำใบ้: ดูว่าโหลดทางความคิดเกิดจากอะไร','คำใบ้: feedback ที่ดีช่วยให้ผู้ใช้รู้สถานะ','คำใบ้: อย่าแก้ visual อย่างเดียวถ้าปัญหาอยู่ที่ memory/load'],
    W4:['คำใบ้: evidence ต้องมาจากสิ่งที่ผู้ใช้ทำหรือพูดจริง','คำใบ้: ระวัง assumption ที่ฟังดูน่าเชื่อแต่ไม่มีหลักฐาน','คำใบ้: insight ต้องเชื่อม observation กับ meaning'],
    W5:['คำใบ้: Root cause ต้องเชื่อมกับ problem statement ไม่ใช่อาการปลายทาง','คำใบ้: HMW ที่ดีไม่ควรล็อก solution เร็วเกินไป','คำใบ้: เลือกสิ่งที่ลดปัญหาซ้ำ ไม่ใช่แก้เฉพาะหน้า'],
    W6:['คำใบ้: flow ที่ดีลดจุดสะดุดและบอก next step ชัด','คำใบ้: ดูว่าผู้ใช้หลุดจากขั้นตอนไหน','คำใบ้: อย่าเพิ่ม step ถ้าไม่ได้ลด friction'],
    W7:['คำใบ้: mobile wireframe ต้องชัดเรื่อง priority และ CTA','คำใบ้: hierarchy สำคัญกว่าการใส่ทุกอย่างให้ครบ','คำใบ้: layout ที่ดีช่วยให้ผู้ใช้ตัดสินใจได้เร็ว']
  };

  function injectStyle(){
    let st = $('#uxq-w2-w7-balanced-compact-v1-style');
    if(!st){ st = document.createElement('style'); st.id = 'uxq-w2-w7-balanced-compact-v1-style'; document.head.appendChild(st); }
    st.textContent = `
      body .shell{width:min(1180px,100%)!important;}
      body .question{padding:18px 20px!important;border-radius:20px!important;}
      body .question .options, body .verify .options{
        display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;margin-top:14px!important;
      }
      body .question .option, body .verify .option{
        min-height:104px!important;height:auto!important;max-height:none!important;padding:14px!important;border-radius:16px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;overflow:hidden!important;background:linear-gradient(150deg,rgba(8,24,52,.78),rgba(5,15,35,.78))!important;
      }
      body .question .option b, body .verify .option b,
      body .question .option strong, body .verify .option strong{
        display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important;overflow:hidden!important;font-size:clamp(.88rem,1.02vw,.98rem)!important;line-height:1.3!important;margin:0!important;padding:0!important;overflow-wrap:break-word!important;
      }
      body .question .option span, body .verify .option span,
      body .question .option small, body .verify .option small,
      body .question .option p, body .verify .option p{display:none!important;}
      body .question .prompt{font-size:1.34rem!important;line-height:1.3!important;margin:0 0 7px!important;}
      body .question .instruction{font-size:.95rem!important;line-height:1.5!important;margin:0 0 10px!important;}
      body .question .hint{padding:10px 12px!important;line-height:1.38!important;min-height:0!important;}
      body .question .utility{margin-top:12px!important;align-items:stretch!important;}
      body .question .btn{min-height:44px!important;padding:10px 14px!important;}
      .uxqW2W7BalancedBadge{display:inline-flex;width:max-content;max-width:100%;padding:6px 10px;margin:6px 0 10px;border-radius:999px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.58);color:#d8ffe7;font-weight:950;font-size:.74rem;box-shadow:0 0 0 1px rgba(255,255,255,.04) inset;}
      .uxqW2W7StemBadge{display:inline-flex;width:max-content;max-width:100%;padding:5px 9px;margin:0 0 8px;border-radius:999px;background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.46);color:#dff7ff;font-weight:900;font-size:.72rem;letter-spacing:.02em;}
      .uxqW2W7Panel{border:1px solid rgba(110,231,255,.35)!important;background:linear-gradient(135deg,rgba(12,54,86,.58),rgba(39,31,83,.48))!important;}
      @media(max-width:980px){body .question .options, body .verify .options{grid-template-columns:repeat(2,minmax(0,1fr))!important;}body .question .option, body .verify .option{min-height:96px!important;}}
      @media(max-width:640px){body .question .options, body .verify .options{grid-template-columns:1fr!important;}body .question .option, body .verify .option{min-height:auto!important;}}
    `;
  }

  const hash = (s) => {
    let h = 2166136261;
    String(s || '').split('').forEach((ch)=>{ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); });
    return h >>> 0;
  };
  const clean = (s) => String(s || '').replace(/\s+/g,' ').trim();

  function currentStep(){
    const text = clean(($('.progress') || $('[class*="progress"]') || document.body).textContent || '');
    const m = text.match(/(\d+)\s*\/\s*(\d+)/);
    return m ? Number(m[1] || 1) : 1;
  }

  function rotateStem(){
    const q = $('.question');
    if(!q) return;
    const prompt = $('.prompt', q) || $('h2', q) || $('h3', q);
    if(!prompt) return;
    const pool = STEMS[NODE] || STEMS.W5;
    const step = currentStep();
    const caseText = clean(($('[class*="case"]', q) || q).textContent).slice(0, 90);
    const idx = hash(`${NODE}|${step}|${caseText}|stem-v2`) % pool.length;
    const stem = pool[idx];
    const old = clean(prompt.textContent);
    const generic = /เลือกคำตอบที่ตรงกับหน้าที่ของข้อนี้ที่สุด|อ่านสถานการณ์.*เลือกคำตอบ|เลือกคำตอบ.*หลักฐาน|เลือกข้อที่ถูกต้อง|เลือกคำตอบที่เหมาะสม/.test(old);
    if(generic || !prompt.dataset.uxqStemV2 || prompt.dataset.uxqStemKey !== `${NODE}-${step}`){
      prompt.textContent = stem;
      prompt.dataset.uxqStemV2 = '1';
      prompt.dataset.uxqStemKey = `${NODE}-${step}`;
    }
    let badge = $('.uxqW2W7StemBadge', q);
    if(!badge){
      badge = document.createElement('div');
      badge.className = 'uxqW2W7StemBadge';
      const anchor = $('.uxqW2W7BalancedBadge', q) || q.firstChild;
      q.insertBefore(badge, anchor ? anchor.nextSibling : q.firstChild);
    }
    badge.textContent = '✅ varied question stem: no repeated generic prompt';
  }

  function rotateHint(){
    const hint = $('.question .hint');
    if(!hint) return;
    const pool = HINTS[NODE] || HINTS.W5;
    const step = currentStep();
    const idx = hash(`${NODE}|${step}|hint-v2`) % pool.length;
    const old = clean(hint.textContent);
    if(/Root cause นี้เชื่อมกับ problem statement อย่างไร|คำใบ้|hint/i.test(old) || !hint.dataset.uxqHintV2){
      hint.textContent = pool[idx];
      hint.dataset.uxqHintV2 = '1';
    }
  }

  function cleanSpoilerText(){
    $$('.question .option, .verify .option').forEach((card) => {
      card.querySelectorAll('span, small, p').forEach((x) => x.style.setProperty('display','none','important'));
      const b = card.querySelector('b,strong');
      if(!b) return;
      let text = clean(b.textContent);
      text = text
        .replace(/^เลือกคำตอบที่ตรงกับหน้าที่ของข้อนี้ที่สุด\s*/,'')
        .replace(/^อ่านสถานการณ์\s*แล้วเลือกคำตอบที่มีเหตุผลจากหลักฐานมากที่สุด\s*/,'')
        .replace(/\s*โดยเชื่อมจากหลักฐาน\s*→\s*decision\s*→\s*สิ่งที่จะปรับ.*$/,'')
        .replace(/\s*และต้องรู้ next step อะไร$/,'')
        .replace(/\s*อย่างไร$/,'')
        .trim();
      if(text.length > 86) text = text.slice(0, 84).trim() + '…';
      if(text) b.textContent = text;
    });
  }

  function decorate(){
    const q = $('.question');
    if(!q) return;
    q.classList.add('uxqW2W7Panel');
    q.style.setProperty('padding','18px 20px','important');

    const existing = $('.uxqW2W7BalancedBadge', q);
    if(!existing){
      const badge = document.createElement('div');
      badge.className = 'uxqW2W7BalancedBadge';
      badge.textContent = badges[NODE] || '✅ varied stems / fair choices';
      q.insertBefore(badge, q.firstChild);
    } else {
      existing.textContent = badges[NODE] || '✅ varied stems / fair choices';
    }

    const panelTitle = $('.uxqMechanicPanel strong', q);
    const panelText = $('.uxqMechanicPanel span', q);
    if(panelTitle && titles[NODE]) panelTitle.textContent = titles[NODE][0];
    if(panelText && titles[NODE]) panelText.textContent = titles[NODE][1];

    rotateStem();
    rotateHint();

    $$('.question .options,.verify .options').forEach(el=>{
      el.style.setProperty('display','grid','important');
      el.style.setProperty('grid-template-columns','repeat(4,minmax(0,1fr))','important');
      el.style.setProperty('gap','12px','important');
      el.style.setProperty('align-items','stretch','important');
      el.style.setProperty('margin-top','14px','important');
    });
    $$('.question .option,.verify .option').forEach(el=>{
      el.style.setProperty('min-height','104px','important');
      el.style.setProperty('height','auto','important');
      el.style.setProperty('max-height','none','important');
      el.style.setProperty('padding','14px','important');
      el.style.setProperty('overflow','hidden','important');
      const b = el.querySelector('b,strong');
      if(b){
        b.style.setProperty('display','-webkit-box','important');
        b.style.setProperty('-webkit-line-clamp','3','important');
        b.style.setProperty('-webkit-box-orient','vertical','important');
        b.style.setProperty('overflow','hidden','important');
        b.style.setProperty('font-size','.94rem','important');
        b.style.setProperty('line-height','1.3','important');
      }
    });
    cleanSpoilerText();
  }

  let timer = 0;
  function run(){ clearTimeout(timer); timer = setTimeout(()=>{ injectStyle(); decorate(); }, 20); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
  new MutationObserver(run).observe(document.documentElement, {childList:true, subtree:true, characterData:true, attributes:true});
})();