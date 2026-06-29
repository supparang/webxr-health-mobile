/* =========================================================
   AI Quest S1 AR Practice — Compact Mobile Assist v4.0.6
   Filename retained for existing runtime compatibility.

   Design decision:
   - Desktop: immersive AR remains available.
   - Mobile: AR is a compact assist panel, not a full-screen obstacle.
   - Touch is the primary mobile path; hand tracking is optional evidence.
========================================================= */
(() => {
  'use strict';

  const V = 'v4.0.6-s1-compact-mobile-assist';
  const $ = (id) => document.getElementById(id);
  const K = 'AIQUEST_S1_AR_RESULT_V368';

  const C = {
    ai:['🧠 AI','รู้จำ / เรียนรู้ / ตัดสินใจจากข้อมูล'],
    automation:['⚙️ Automation','ทำตาม trigger หรือขั้นตอนที่ตั้งไว้'],
    sensor:['📡 Sensor-only','ตรวจจับหรือวัดค่าเท่านั้น'],
    rule:['📋 Rule-based','ใช้กฎ IF–THEN แบบตายตัว'],
    prediction:['🔮 Prediction','ใช้ข้อมูลเพื่อคาดการณ์หรือจัดอันดับ']
  };

  const B = [
    ['automatic door with motion trigger','ประตูอัตโนมัติที่เปิดเมื่อมีคนเดินผ่าน','automation',['automation','sensor','ai'],'ประตูเปิดตาม trigger จากเซนเซอร์ จัดเป็น Automation ไม่ใช่ AI','คำว่า trigger บอกว่าระบบทำตามเงื่อนไขที่กำหนดไว้'],
    ['temperature sensor','เซนเซอร์วัดอุณหภูมิ','sensor',['sensor','automation','prediction'],'ระบบนี้รับและรายงานค่า แต่ยังไม่วิเคราะห์หรือตัดสินใจเอง','หน้าที่หลักคือวัดค่า'],
    ['smart camera detects people','กล้องอัจฉริยะตรวจจับคนในภาพ','ai',['ai','sensor','automation'],'Object/person detection เป็นงาน Computer Vision จัดเป็น AI','ต้องแยกคนออกจากภาพ'],
    ['FAQ chatbot answers with IF–THEN rules','แชตบอต FAQ ตอบคำถามด้วยกฎ IF–THEN','rule',['rule','ai','prediction'],'ถ้าตอบด้วยกฎตายตัวโดยไม่เรียนรู้จากข้อมูล จัดเป็น Rule-based','โจทย์บอกชัดว่ามีกฎ IF–THEN'],
    ['movie recommendation system','ระบบแนะนำหนังจากพฤติกรรมผู้ใช้','prediction',['prediction','automation','sensor'],'การแนะนำ/จัดอันดับจากพฤติกรรมผู้ใช้เป็นงาน Prediction','ใช้ข้อมูลเดิมเพื่อเดาว่าผู้ใช้น่าจะชอบอะไร'],
    ['voice assistant understands spoken command','ผู้ช่วยเสียงเข้าใจคำสั่งที่ผู้ใช้พูด','ai',['ai','rule','automation'],'Speech recognition และ language understanding เป็นงาน AI','ต้องตีความเสียง ภาษา และความตั้งใจของผู้ใช้']
  ];

  let q = [];
  let n = 0;
  let ok = 0;
  let wrong = 0;
  let hints = 0;
  let stream = null;
  let startAt = 0;
  let res = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (x) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]));
  const mix = (a) => a.slice().sort(() => Math.random() - .5);
  const mobile = () => window.matchMedia?.('(max-width:600px)').matches;

  function style(){
    if ($('s1style368')) return;
    const e = document.createElement('style');
    e.id = 's1style368';
    e.textContent = `
      .s1entry368{margin:14px 0;padding:16px;border:1px solid #2dd4bf77;border-radius:20px;color:#e6f7ff;background:linear-gradient(135deg,#134e4a99,#0f172ae8)}
      .s1entry368 button{float:right;border:0;border-radius:999px;padding:11px 16px;font-weight:900;background:#99f6e4;color:#042f2e}
      .s1entry368 p{margin:5px 0 0;color:#bae6fd;font-size:12px}

      #s1ar368{position:fixed;inset:0;z-index:100000;display:none;background:#020617;color:#f8fafc;font-family:system-ui,sans-serif}
      #s1ar368.open{display:block}
      #s1ar368 video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);opacity:.7}
      #s1ar368 .fb{position:absolute;inset:0;background:radial-gradient(circle at 18% 10%,#22d3ee44,transparent 35%),linear-gradient(135deg,#071426,#0f172a)}
      #s1ar368 .shade{position:absolute;inset:0;background:linear-gradient(#020617b8,#02061733,#020617d9)}
      #s1ar368 .top{position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;gap:12px;z-index:2}
      #s1ar368 .top b{font-size:18px}
      #s1ar368 button{cursor:pointer}
      #s1ar368 .btn{padding:10px 12px;border:1px solid #ffffff33;border-radius:14px;background:#172033e8;color:#fff;font-weight:900}
      #s1ar368 .center{position:absolute;inset:72px 0 65px;display:flex;align-items:center;justify-content:center;padding:8px;z-index:1}
      #s1ar368 .card{width:min(650px,94vw);max-height:calc(100vh - 145px);overflow:auto;border:1px solid #ffffff33;border-radius:25px;padding:18px;background:#0f172aeb;backdrop-filter:blur(13px);box-shadow:0 24px 60px #0008}
      #s1ar368 .tag{font-size:12px;font-weight:900;color:#bae6fd}
      #s1ar368 h2{font-size:25px;margin:10px 0 3px}
      #s1ar368 .th{margin:0 0 10px;color:#fef3c7;font-weight:800}
      #s1ar368 .how{margin:8px 0 12px;padding:10px;border-radius:13px;background:#22d3ee18;border:1px solid #22d3ee33;color:#cffafe;font-size:13px}
      #s1answers368{display:grid;gap:10px}
      #s1answers368 .ans{min-height:78px;border:2px solid #94a3b855;border-radius:18px;padding:13px 15px;text-align:left;background:#1e293bf2;color:#fff;font-size:18px;font-weight:1000}
      #s1answers368 .ans span{display:block;color:#b6c7dc;font-size:12px;margin-top:4px;font-weight:650}
      #s1answers368 .ans.good{border-color:#86efac;background:#166534cc}
      #s1answers368 .ans.bad{border-color:#fda4af;background:#991b1bcc}
      #s1answers368 .ans.hand-target-v368{border-color:#67e8f9!important;box-shadow:0 0 0 7px #22d3ee2b,0 0 30px #22d3ee77!important;transform:scale(1.015)}
      #s1ar368 .feedback{display:none;margin-top:12px;padding:12px;border:1px solid #94a3b855;border-radius:14px;background:#020617bb;line-height:1.45}
      #s1ar368 .feedback.good{border-color:#86efac99;background:#16653455}
      #s1ar368 .feedback.bad{border-color:#fda4af99;background:#991b1b55}
      #s1ar368 .bottom{position:absolute;left:14px;right:14px;bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;font-weight:900;z-index:2}
      #s1ar368 .mobileCue{display:none}

      /* Compact AR Assist: portrait phone no longer uses an immersive full screen. */
      @media(max-width:600px){
        #s1ar368{inset:auto 10px calc(10px + env(safe-area-inset-bottom,0px));height:min(610px,calc(100svh - 86px));border:1px solid rgba(103,232,249,.42);border-radius:24px;overflow:hidden;background:#0f172a;box-shadow:0 24px 60px rgba(0,0,0,.56)}
        #s1ar368.open{display:block}
        #s1ar368 video,#s1ar368 .fb{inset:auto 12px auto auto;top:74px;width:112px;height:80px;border-radius:16px;border:1px solid rgba(186,230,253,.45);opacity:.82;box-shadow:0 12px 24px rgba(0,0,0,.30)}
        #s1ar368 .fb{background:linear-gradient(135deg,#164e63,#0f172a)}
        #s1ar368 .shade{background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(15,23,42,.96));pointer-events:none}
        #s1ar368 .top{top:0;left:0;right:0;padding:12px 12px 8px;min-height:66px;align-items:flex-start;background:linear-gradient(180deg,#0f172a,#0f172af0)}
        #s1ar368 .top b{display:block;max-width:calc(100vw - 158px);font-size:16px;line-height:1.15}
        #s1ar368 .top > div > div{font-size:11px!important;color:#bbf7d0!important;margin-top:4px;max-width:calc(100vw - 158px)}
        #s1ar368 .top .btn{white-space:nowrap;padding:9px 10px;border-radius:12px;font-size:13px}
        #s1ar368 .center{inset:66px 8px 57px;padding:0;display:block}
        #s1ar368 .card{width:100%;height:100%;max-height:none;padding:12px;border-radius:18px;background:#0f172af8;overflow-y:auto;box-shadow:none}
        #s1ar368 .tag{font-size:11px}
        #s1ar368 h2{font-size:22px;line-height:1.14;margin:8px 118px 4px 0}
        #s1ar368 .th{font-size:16px;line-height:1.35;margin-bottom:8px}
        #s1ar368 .how{font-size:12px;line-height:1.45;padding:8px;margin:7px 0 9px}
        #s1ar368 .mobileCue{display:block;color:#bbf7d0;font-size:11px;font-weight:900;margin:0 0 8px}
        #s1answers368{gap:8px}
        #s1answers368 .ans{min-height:58px;border-radius:15px;padding:10px 12px;font-size:16px;line-height:1.15}
        #s1answers368 .ans span{font-size:11px;margin-top:3px;line-height:1.25}
        #s1ar368 .feedback{font-size:13px;padding:10px;margin-top:9px}
        #s1ar368 .bottom{left:10px;right:10px;bottom:8px;font-size:11px;line-height:1.2}
        #s1ar368 .bottom .btn{padding:8px 9px;border-radius:12px;font-size:12px}
      }
    `;
    document.head.appendChild(e);
  }

  function isS1(){
    const s = (new URLSearchParams(location.search).get('session') || '').toLowerCase();
    return s === 's1' || s === 'm1' || [...document.querySelectorAll('h1,h2,h3')].some((x) => (x.textContent || '').toLowerCase().includes('ai awakening'));
  }

  function mount(){
    if (!isS1() || $('s1entry368')) return;
    style();
    ['s1ArInlineEntryV362','s1ArInlineEntryV364','s1ArInlineEntryV365','s1ArInlineEntryV365B','s1arentry366'].forEach((id) => $(id)?.remove());
    const e = document.createElement('div');
    e.id = 's1entry368';
    e.className = 's1entry368';
    e.innerHTML = `<button id="s1start368">เริ่ม AR Practice</button><b>🖐️ S1 AR Practice: AI Object Scanner</b><p>มือถือ: แตะเลือกได้ทันที • ใช้การชี้มือเป็นตัวช่วยเมื่อสะดวก</p>`;
    const h = $('gameArea') || document.querySelector('.gameArea') || document.querySelector('main') || document.body;
    try { h.insertBefore(e,h.firstElementChild || null); }
    catch (_) { document.body.appendChild(e); }
    $('s1start368').onclick = start;
  }

  function make(){
    if ($('s1ar368')) return;
    const e = document.createElement('section');
    e.id = 's1ar368';
    e.innerHTML = `
      <div id="s1fallback368" class="fb"></div>
      <video id="s1video368" autoplay muted playsinline></video>
      <div class="shade"></div>
      <div class="top">
        <div>
          <b>S1 AR Practice: AI Object Scanner</b>
          <div>Mobile Assist • แตะเลือกได้ทันที • มือเป็นทางเลือก</div>
        </div>
        <button class="btn" id="s1close368">ออกจาก AR</button>
      </div>
      <div class="center"><div id="s1card368" class="card"></div></div>
      <div class="bottom">
        <span id="s1meter368">Ready</span>
        <span><button class="btn" id="s1hint368">AI Help</button> <button class="btn" id="s1skip368">ข้าม AR</button></span>
      </div>`;
    document.body.appendChild(e);
    $('s1close368').onclick = close;
    $('s1hint368').onclick = hint;
    $('s1skip368').onclick = close;
  }

  async function camera(){
    const v = $('s1video368');
    const f = $('s1fallback368');
    try {
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'}},audio:false});
      v.srcObject = stream;
      v.style.display = 'block';
      f.style.display = 'none';
      await v.play();
    } catch (error) {
      console.warn('[S1 AR] camera fallback',error);
      v.style.display = 'none';
      f.style.display = 'block';
    }
  }

  async function start(){
    make();
    q = mix(B);
    n = ok = wrong = hints = 0;
    res = null;
    startAt = Date.now();
    $('s1ar368').classList.add('open');
    await camera();
    draw();
    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-start',{detail:{version:V,total:q.length,mobileAssist:mobile()}}));
  }

  function close(){
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    $('s1ar368')?.classList.remove('open');
  }

  function draw(){
    const a = q[n];
    if (!a) return done();
    const acc = ok + wrong ? Math.round(ok * 100 / (ok + wrong)) : 0;
    $('s1meter368').textContent = `ข้อ ${n+1}/${q.length} • ถูก ${ok} • ${acc}%`;
    $('s1card368').innerHTML = `
      <div class="tag">Object ${n+1}/${q.length} • Compact AR Assist</div>
      <h2>${esc(a[0])}</h2>
      <p class="th">${esc(a[1])}</p>
      <p class="mobileCue">📱 แตะคำตอบได้ทันที • ไม่จำเป็นต้องใช้มือ</p>
      <div class="how">เลือกคำตอบที่เหมาะที่สุด: <b>แตะปุ่มคำตอบได้ทันที</b> หรือใช้มือเล็งในปุ่มจริงแล้วค้างประมาณ 1.8 วินาที</div>
      <div id="s1answers368">${mix(a[3]).map((k) => `<button class="ans" data-a="${k}">${C[k][0]}<span>${C[k][1]}</span></button>`).join('')}</div>
      <div id="s1feedback368" class="feedback"></div>`;
    document.querySelectorAll('#s1answers368 .ans').forEach((button) => button.onclick = () => answer(button.dataset.a));
  }

  function answer(k){
    const a = q[n];
    const yes = k === a[2];
    document.querySelectorAll('#s1answers368 .ans').forEach((button) => {
      button.disabled = true;
      if (button.dataset.a === a[2]) button.classList.add('good');
      else if (button.dataset.a === k) button.classList.add('bad');
    });
    if (yes) ok++; else wrong++;
    const f = $('s1feedback368');
    f.style.display = 'block';
    f.className = 'feedback ' + (yes ? 'good' : 'bad');
    f.innerHTML = `<b>${yes ? 'ถูกต้อง!' : 'ยังไม่ถูก'}</b><br>คำตอบที่เหมาะที่สุดคือ <b>${C[a[2]][0]}</b><br>${a[4]}<div style="margin-top:10px"><button class="btn" id="s1next368">${n === q.length - 1 ? 'สรุปผล AR' : 'ข้อต่อไป'}</button></div>`;
    $('s1next368').onclick = () => { n++; draw(); };
    const acc = Math.round(ok * 100 / (ok + wrong));
    $('s1meter368').textContent = `ข้อ ${n+1}/${q.length} • ถูก ${ok} • ${acc}%`;
  }

  function hint(){
    const a = q[n];
    if (!a) return;
    hints++;
    const f = $('s1feedback368');
    f.style.display = 'block';
    f.className = 'feedback';
    f.innerHTML = `<b>AI Help</b><br>${a[5]}`;
  }

  function done(){
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    const score = Math.round(ok * 100 / q.length);
    res = {
      version:V,sessionId:'s1',missionId:'m1',arMode:true,arCompleted:true,
      total:q.length,correct:ok,wrong,accuracy:score,arScore:score,helpUsed:hints,
      usedSec:Math.round((Date.now()-startAt)/1000),finishedAt:new Date().toISOString(),
      inputMode:mobile() ? 'mobile_touch_or_hand' : 'hand_or_mouse_touch'
    };
    window.AIQUEST_S1_AR_RESULT = res;
    try { localStorage.setItem(K,JSON.stringify(res)); } catch (_) {}
    $('s1card368').innerHTML = `<div class="tag">AR Practice Complete</div><h2>${score >= 85 ? 'AI Scanner Master' : 'S1 AR Complete'}</h2><p class="th">คะแนน ${score}% • ถูก ${ok}/${q.length}</p><div class="how">มือถือสามารถแตะเลือกได้ตลอดเวลา ส่วนการชี้มือเป็นกิจกรรมเสริมสำหรับผู้ที่สะดวกใช้กล้อง</div><button class="btn" id="s1again368">เล่นอีกครั้ง</button> <button class="btn" id="s1back368">กลับ Mission</button>`;
    $('s1again368').onclick = start;
    $('s1back368').onclick = close;
  }

  function boot(){
    style();
    mount();
    setTimeout(mount,1200);
    setTimeout(mount,3000);
    if (['hand','ar','s1'].includes((new URLSearchParams(location.search).get('ar') || '').toLowerCase())) setTimeout(start,650);
  }

  window.AIQUEST_S1_AR_PRACTICE = {version:V,start,close,getResult:() => res};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
  console.log('[AIQuest] '+V+' loaded');
})();
