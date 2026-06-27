/* AI Quest S2 AR Agent Builder v3.8.7
   Real hand detection + dwell selection.
   Controls: point index fingertip over an answer for ~0.9 sec.
   Touch/mouse click remains available as fallback.
*/
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEY = "AIQUEST_S2_AR_RESULT_V387";
  const ITEMS = [
    ["Smart irrigation controller","เลือก PEAS ส่วนที่เป็น Sensor","Soil moisture sensor",["Soil moisture sensor","Water pump","Keep plants healthy","Farm field"],"Sensor คือสิ่งที่ agent ใช้รับรู้สภาพแวดล้อม"],
    ["Smart irrigation controller","เลือก PEAS ส่วนที่เป็น Actuator","Water pump",["Water pump","Rain forecast","Farm field","Water-saving score"],"Actuator คือสิ่งที่ agent ใช้กระทำกับ environment"],
    ["Smart irrigation controller","เลือก PEAS ส่วนที่เป็น Performance","Water-saving score",["Water-saving score","Soil moisture sensor","Farm field","Water pump"],"Performance measure บอกว่าทำได้ดีแค่ไหน"],
    ["Food delivery route planner","Environment ของ agent คืออะไร?","Road map, traffic and orders",["Road map, traffic and orders","GPS location sensor","Driver navigation screen","Fast delivery score"],"Environment คือโลกหรือบริบทที่ agent ทำงานอยู่"],
    ["Student support chatbot","ข้อใดอธิบาย Rational Agent ได้ดีที่สุด?","เลือกคำตอบที่คาดว่าจะช่วยผู้ใช้ได้ดีที่สุดจากข้อมูลที่มี",["เลือกคำตอบที่คาดว่าจะช่วยผู้ใช้ได้ดีที่สุดจากข้อมูลที่มี","ตอบเหมือนเดิมทุกครั้ง","ต้องรู้ทุกอย่างก่อนตอบ","ทำงานเร็วที่สุดเสมอ"],"Rational agent เลือก action ที่คาดว่าดีที่สุดจากข้อมูลที่มี"],
    ["Autonomous vacuum robot","ข้อใดเป็น percept ของ agent?","ตำแหน่งสิ่งกีดขวางจากเซนเซอร์",["ตำแหน่งสิ่งกีดขวางจากเซนเซอร์","การหมุนล้อ","พื้นสะอาดที่สุด","ห้องนั่งเล่น"],"Percept คือข้อมูลที่ agent รับเข้ามาจาก sensor"]
  ];

  let questions = [], index = 0, correct = 0, helpUsed = 0, startedAt = 0;
  let stream = null, hands = null, raf = 0, answerLocked = false;
  let hoverKey = "", hoverSince = 0, handReady = false;

  const mix = (a) => a.slice().sort(() => Math.random() - .5);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

  function ensureUI(){
    if($("s2ar387")) return;
    const root = document.createElement("section");
    root.id = "s2ar387";
    root.style.cssText = "display:none;position:fixed;inset:0;z-index:100500;background:#020617;color:#fff;font-family:system-ui";
    root.innerHTML = `
      <video id="s2v387" autoplay muted playsinline style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42;transform:scaleX(-1)"></video>
      <canvas id="s2c387" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform:scaleX(-1)"></canvas>
      <div style="position:absolute;inset:0;background:linear-gradient(#020617d8,#02061755,#020617e8);pointer-events:none"></div>
      <div style="position:absolute;top:14px;left:14px;right:14px;display:flex;justify-content:space-between;gap:12px">
        <div><b>S2 AR Practice: Agent Builder</b><div style="font-size:12px;color:#ddd6fe">PEAS • Percept • Rational Agent</div><div id="s2hand387" style="margin-top:7px;font-size:12px;background:#172554cc;border:1px solid #60a5fa66;border-radius:999px;padding:6px 9px;display:inline-block">Hand: กำลังเตรียมกล้อง…</div></div>
        <button id="s2close387">ออกจาก AR</button>
      </div>
      <div style="position:absolute;inset:94px 0 70px;display:grid;place-items:center;padding:10px">
        <div id="s2card387" style="width:min(680px,95vw);max-height:calc(100vh - 175px);overflow:auto;padding:18px;border:1px solid #c4b5fd66;border-radius:25px;background:#0f172aef"></div>
      </div>
      <div style="position:absolute;bottom:12px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span id="s2meter387"></span><button id="s2help387">AI Help</button>
      </div>`;
    document.body.appendChild(root);
    $("s2close387").onclick = close;
    $("s2help387").onclick = hint;
  }

  function setHandStatus(text, ok){
    const e = $("s2hand387");
    if(!e) return;
    e.textContent = text;
    e.style.borderColor = ok ? "#86efac88" : "#fbbf2488";
    e.style.background = ok ? "#14532dcc" : "#78350fcc";
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(s => s.src === src);
      if(existing){ resolve(); return; }
      const s = document.createElement("script");
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadHands(){
    if(window.Hands) return true;
    try{
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js");
      return !!window.Hands;
    }catch(err){
      console.warn("[S2 AR] MediaPipe unavailable", err);
      return false;
    }
  }

  function resizeCanvas(){
    const video = $("s2v387"), canvas = $("s2c387");
    if(!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  function drawHand(results){
    const canvas = $("s2c387");
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.save(); ctx.clearRect(0,0,canvas.width,canvas.height);

    const landmarks = results.multiHandLandmarks && results.multiHandLandmarks[0];
    if(!landmarks){
      setHandStatus("Hand: ไม่พบมือ • ใช้เมาส์/ทัชได้", false);
      hoverKey = ""; hoverSince = 0;
      ctx.restore();
      return;
    }

    handReady = true;
    setHandStatus("Hand: พบมือ • ชี้ค้างที่ตัวเลือกเพื่อเลือก", true);

    const tip = landmarks[8];
    const x = (1 - tip.x) * window.innerWidth;
    const y = tip.y * window.innerHeight;

    ctx.beginPath();
    ctx.arc(tip.x * canvas.width, tip.y * canvas.height, 16, 0, Math.PI * 2);
    ctx.fillStyle = "#34d399"; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = "#ffffff"; ctx.stroke();

    const btns = [...document.querySelectorAll("#s2choices387 button[data-a]")];
    let target = null;
    for(const b of btns){
      if(b.disabled) continue;
      const r = b.getBoundingClientRect();
      if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){ target = b; break; }
    }

    btns.forEach(b => b.style.outline = "");
    if(!target){
      hoverKey = ""; hoverSince = 0;
      ctx.restore();
      return;
    }

    target.style.outline = "4px solid #fbbf24";
    const key = target.dataset.a;
    if(hoverKey !== key){
      hoverKey = key; hoverSince = performance.now();
    }
    const elapsed = performance.now() - hoverSince;
    setHandStatus(`Hand: ชี้ค้างเพื่อเลือก ${Math.max(0, Math.ceil((900-elapsed)/100)/10)}s`, true);
    if(elapsed >= 900 && !answerLocked) answer(key, "hand");
    ctx.restore();
  }

  async function startCameraAndHands(){
    const video = $("s2v387");
    try{
      stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"user"}},audio:false});
      video.srcObject = stream;
      await video.play();
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas, {passive:true});
    }catch(err){
      console.warn("[S2 AR] camera fallback", err);
      video.style.display = "none";
      $("s2c387").style.display = "none";
      setHandStatus("Hand: เปิดกล้องไม่ได้ • ใช้เมาส์/ทัชได้", false);
      return;
    }

    const loaded = await loadHands();
    if(!loaded){
      setHandStatus("Hand: โหลดตัวตรวจจับไม่สำเร็จ • ใช้เมาส์/ทัชได้", false);
      return;
    }

    hands = new Hands({locateFile:(file) => "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + file});
    hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:.62,minTrackingConfidence:.58});
    hands.onResults(drawHand);

    async function loop(){
      if(!hands || !$("s2ar387") || $("s2ar387").style.display === "none") return;
      if(video.readyState >= 2){
        try{ await hands.send({image:video}); }catch(err){ console.warn("[S2 AR] hand frame error", err); }
      }
      raf = requestAnimationFrame(loop);
    }
    loop();
  }

  async function start(){
    ensureUI();
    questions = mix(ITEMS); index = correct = helpUsed = 0; startedAt = Date.now();
    answerLocked = false; hoverKey = ""; hoverSince = 0; handReady = false;
    $("s2ar387").style.display = "block";
    draw();
    await startCameraAndHands();
    window.dispatchEvent(new CustomEvent("aiquest:s2-ar-start"));
  }

  function stopCamera(){
    cancelAnimationFrame(raf); raf = 0;
    if(stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    if(hands && hands.close){ try{ hands.close(); }catch(_){} }
    hands = null;
    window.removeEventListener("resize", resizeCanvas);
  }

  function close(){
    stopCamera();
    $("s2ar387")?.style.setProperty("display","none");
  }

  function draw(){
    const item = questions[index];
    if(!item){ done(); return; }
    answerLocked = false; hoverKey = ""; hoverSince = 0;
    $("s2meter387").textContent = `Mission ${index+1}/${questions.length} • Correct ${correct} • Help ${helpUsed}`;
    const choices = mix(item[3]);
    $("s2card387").innerHTML = `
      <div style="font-size:12px;font-weight:900;color:#ddd6fe">AGENT BUILDER ${index+1}/${questions.length}</div>
      <h2>${esc(item[0])}</h2>
      <p style="padding:10px;border-radius:14px;background:#22d3ee14;border:1px solid #22d3ee33"><b>โจทย์:</b> ${esc(item[1])}</p>
      <p style="font-size:13px;color:#cbd5e1">ใช้มือชี้ค้างที่คำตอบประมาณ 1 วินาที หรือคลิก/แตะปุ่มได้</p>
      <div id="s2choices387" style="display:grid;gap:10px">
        ${choices.map(a => `<button data-a="${esc(a)}" style="min-height:64px;text-align:left;padding:12px;border:2px solid #94a3b855;border-radius:17px;background:#1e293bf2;color:white;font-size:16px;font-weight:900">${esc(a)}</button>`).join("")}
      </div><div id="s2fb387" style="margin-top:12px"></div>`;
    document.querySelectorAll("#s2choices387 button").forEach(b => b.onclick = () => answer(b.dataset.a, "mouse_touch"));
  }

  function answer(value, mode){
    if(answerLocked) return;
    answerLocked = true;
    const item = questions[index], yes = value === item[2];
    document.querySelectorAll("#s2choices387 button").forEach(b => {
      b.disabled = true;
      b.style.outline = "";
      b.style.borderColor = b.dataset.a === item[2] ? "#86efac" : (b.dataset.a === value ? "#fda4af" : "#94a3b855");
      if(b.dataset.a === item[2]) b.style.background = "#166534cc";
      else if(b.dataset.a === value) b.style.background = "#991b1bcc";
    });
    if(yes) correct++;
    $("s2fb387").innerHTML = `<div style="padding:12px;border-radius:14px;background:${yes?"#16653455":"#991b1b55"};border:1px solid ${yes?"#86efac99":"#fda4af99"}"><b>${yes?"ถูกต้อง!":"ยังไม่ถูก"}</b><br>${esc(item[4])}<br><small>Input: ${mode === "hand" ? "Hand dwell" : "Mouse / Touch"}</small><div style="margin-top:10px"><button id="s2next387">${index===questions.length-1?"สรุป AR":"ข้อต่อไป"}</button></div></div>`;
    $("s2next387").onclick = () => { index++; draw(); };
  }

  function hint(){
    const item = questions[index]; if(!item) return;
    helpUsed++;
    $("s2fb387").innerHTML = `<div style="padding:12px;border-radius:14px;background:#22d3ee14;border:1px solid #22d3ee33"><b>AI Help:</b><br>จำ PEAS: P=วัดผล, E=โลก, A=สิ่งที่กระทำ, S=สิ่งที่รับรู้</div>`;
  }

  function done(){
    stopCamera();
    const score = Math.round(correct * 100 / questions.length);
    const result = {
      version:"v3.8.7-s2-ar-hand-dwell",
      sessionId:"s2", missionId:"m2", arCompleted:true,
      total:questions.length, correct, wrong:questions.length-correct,
      accuracy:score, arScore:score, helpUsed,
      usedSec:Math.round((Date.now()-startedAt)/1000),
      finishedAt:new Date().toISOString(),
      inputMode: handReady ? "hand_or_mouse_touch" : "mouse_touch"
    };
    window.AIQUEST_S2_AR_RESULT = result;
    try{localStorage.setItem(KEY, JSON.stringify(result));}catch(_){}
    $("s2card387").innerHTML = `<div style="font-size:12px;font-weight:900;color:#ddd6fe">AR Practice Complete</div><h2>${score>=85?"Agent Builder Master":"S2 AR Complete"}</h2><p>คะแนน ${score}% • ถูก ${correct}/${questions.length}</p><button id="s2again387">ฝึกซ้ำ</button> <button id="s2back387">กลับ Session 2</button>`;
    $("s2again387").onclick = start;
    $("s2back387").onclick = () => { close(); location.href = "index.html?session=s2"; };
  }

  const p = new URLSearchParams(location.search);
  if((p.get("session")||"").toLowerCase()==="s2" && (p.get("ar")||"").toLowerCase()==="agent"){
    setTimeout(start, 350);
  }
  window.AIQUEST_S2_AR_PRACTICE = {start, version:"v3.8.7"};
})();