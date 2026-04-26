// === /herohealth/gate/plate-gate-copy.js ===
// Plate Solo gate wording patch
// PATCH v20260425-PLATE-GATE-COPY-FINAL
// ใช้ร่วมกับ /herohealth/warmup-gate.html
// ทำงานเฉพาะ game=plate หรือ path/next ที่เป็น plate เท่านั้น

(function(){
  'use strict';

  const PATCH = 'v20260425-PLATE-GATE-COPY-FINAL';

  function qs(name, fallback=''){
    try{
      return new URL(location.href).searchParams.get(name) ?? fallback;
    }catch(_){
      return fallback;
    }
  }

  function clean(v, d=''){
    v = String(v ?? '').trim();
    return v || d;
  }

  const phase = clean(qs('phase'), 'warmup').toLowerCase();
  const game = clean(qs('game'), '');
  const zone = clean(qs('zone'), '');
  const next = clean(qs('next'), '');
  const diff = clean(qs('diff'), 'normal');
  const time = clean(qs('time'), '90');
  const playerName = clean(qs('name'), 'Hero');

  const isPlate =
    game === 'plate' ||
    zone === 'nutrition' && next.includes('/plate/') ||
    location.href.includes('game=plate') ||
    next.includes('/herohealth/plate/plate-vr.html');

  if(!isPlate) return;

  const isCooldown = phase === 'cooldown';
  const isWarmup = !isCooldown;

  function $(selector){
    return document.querySelector(selector);
  }

  function setText(selector, text){
    const el = $(selector);
    if(el) el.textContent = text;
  }

  function setHtml(selector, html){
    const el = $(selector);
    if(el) el.innerHTML = html;
  }

  function findByTextLike(...words){
    const all = [...document.querySelectorAll('h1,h2,h3,p,div,span,strong,button')];
    return all.find(el => {
      const t = (el.textContent || '').trim().toLowerCase();
      return words.some(w => t.includes(String(w).toLowerCase()));
    });
  }

  function safeReplaceText(oldWords, newText){
    const el = findByTextLike(...oldWords);
    if(el) el.textContent = newText;
  }

  function setDocTheme(){
    document.documentElement.style.setProperty('--plate-gate-accent', '#7fcfff');
    document.documentElement.style.setProperty('--plate-gate-gold', '#ffd45f');
    document.body.dataset.plateGatePatch = PATCH;
    document.body.classList.add('plate-gate');
    document.body.classList.toggle('plate-gate-warmup', isWarmup);
    document.body.classList.toggle('plate-gate-cooldown', isCooldown);
  }

  function injectStyle(){
    if(document.getElementById('plateGateCopyStyle')) return;

    const style = document.createElement('style');
    style.id = 'plateGateCopyStyle';
    style.textContent = `
      body.plate-gate{
        background:
          radial-gradient(circle at 12% 10%, rgba(255,212,95,.24), transparent 24%),
          radial-gradient(circle at 88% 12%, rgba(127,207,255,.24), transparent 22%),
          linear-gradient(180deg,#f7fcff,#fffef9) !important;
      }

      .plateGateBox{
        margin:12px auto;
        padding:14px;
        max-width:760px;
        border-radius:22px;
        border:1px solid #f0ddb0;
        background:linear-gradient(180deg,#fffdf6,#fff9ef);
        color:#334155;
        box-shadow:0 10px 22px rgba(0,0,0,.06);
      }

      .plateGateTitle{
        font-weight:1000;
        font-size:18px;
        color:#284255;
        margin-bottom:6px;
      }

      .plateGateText{
        color:#60727f;
        font-weight:800;
        line-height:1.45;
        font-size:14px;
      }

      .plateGateSteps{
        display:grid;
        gap:10px;
        margin-top:12px;
      }

      .plateGateStep{
        display:flex;
        gap:10px;
        align-items:flex-start;
        padding:10px 12px;
        border-radius:16px;
        background:#fff;
        border:1px solid #dbeaf4;
      }

      .plateGateIcon{
        width:36px;
        height:36px;
        border-radius:14px;
        display:grid;
        place-items:center;
        background:#eef8ff;
        font-size:19px;
        flex:0 0 auto;
      }

      .plateGateStep strong{
        display:block;
        color:#2d4859;
        font-size:14px;
        margin-bottom:2px;
      }

      .plateGateStep span{
        display:block;
        color:#6d7d8b;
        font-size:13px;
        line-height:1.35;
        font-weight:750;
      }

      .plateGateMission{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin-top:12px;
      }

      .plateGatePill{
        min-height:32px;
        padding:0 10px;
        border-radius:999px;
        background:#fff;
        border:1px solid #eadbb4;
        color:#7b6121;
        font-size:13px;
        font-weight:900;
        display:inline-flex;
        align-items:center;
      }

      @media (max-width:640px){
        .plateGateBox{
          margin:10px 8px;
          padding:12px;
          border-radius:20px;
        }

        .plateGateTitle{
          font-size:17px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function injectPlateCopyBox(){
    if(document.getElementById('plateGateCopyBox')) return;

    const mount =
      document.querySelector('main') ||
      document.querySelector('.card') ||
      document.querySelector('.gate-card') ||
      document.querySelector('.container') ||
      document.body;

    const box = document.createElement('section');
    box.id = 'plateGateCopyBox';
    box.className = 'plateGateBox';

    if(isWarmup){
      box.innerHTML = `
        <div class="plateGateTitle">🍽️ เตรียมพร้อมก่อนเข้า Plate Solo</div>
        <div class="plateGateText">
          ${playerName} จะได้เล่นเกมจัดจานแบบล็อกเป้าหมายไว้บนจอตลอดเวลา
          ดู Goal ให้ชัดก่อนเริ่ม แล้วแตะเฉพาะอาหารที่ตรงกับหมู่ที่กำหนด
        </div>

        <div class="plateGateMission">
          <span class="plateGatePill">เวลา ${time} วินาที</span>
          <span class="plateGatePill">ระดับ ${diff}</span>
          <span class="plateGatePill">Goal เห็นตลอด</span>
        </div>

        <div class="plateGateSteps">
          <div class="plateGateStep">
            <div class="plateGateIcon">🎯</div>
            <div>
              <strong>ดูเป้าหมายรอบนี้</strong>
              <span>เกมจะบอกชัดว่าให้เก็บหมู่อาหารอะไร เช่น โปรตีน ผัก ผลไม้ หรือไขมันดี</span>
            </div>
          </div>

          <div class="plateGateStep">
            <div class="plateGateIcon">👆</div>
            <div>
              <strong>แตะเฉพาะอาหารที่ตรงกับ Goal</strong>
              <span>ถ้าเป็นอาหารคนละหมู่หรือตัวหลอก ให้ปล่อยผ่าน อย่าแตะ</span>
            </div>
          </div>

          <div class="plateGateStep">
            <div class="plateGateIcon">🏆</div>
            <div>
              <strong>เก็บให้ครบ แล้วไปสรุปผล</strong>
              <span>หลังจบเกมจะมีสรุปผล ลองคิดอีกนิด และสร้างจานของตัวเองต่อ</span>
            </div>
          </div>
        </div>
      `;
    }else{
      box.innerHTML = `
        <div class="plateGateTitle">🌿 พักสั้น ๆ หลังเล่น Plate Solo</div>
        <div class="plateGateText">
          เก่งมาก ${playerName} ตอนนี้พักสายตา หายใจช้า ๆ แล้วทบทวนว่า
          รอบเมื่อกี้ Goal คือหมู่อาหารอะไร และเราแตะถูกมากแค่ไหน
        </div>

        <div class="plateGateMission">
          <span class="plateGatePill">สรุปผลแล้ว</span>
          <span class="plateGatePill">พักก่อนกลับ Hub</span>
          <span class="plateGatePill">Nutrition Zone</span>
        </div>

        <div class="plateGateSteps">
          <div class="plateGateStep">
            <div class="plateGateIcon">😌</div>
            <div>
              <strong>พักสายตา 5 วินาที</strong>
              <span>มองออกจากจอเล็กน้อย แล้วหายใจเข้าออกช้า ๆ</span>
            </div>
          </div>

          <div class="plateGateStep">
            <div class="plateGateIcon">🧠</div>
            <div>
              <strong>ทบทวนสิ่งที่เรียนรู้</strong>
              <span>อาหารแต่ละอย่างอยู่หมู่ไหน และอะไรที่ไม่ควรแตะในรอบนั้น</span>
            </div>
          </div>

          <div class="plateGateStep">
            <div class="plateGateIcon">🏠</div>
            <div>
              <strong>กลับ Nutrition Zone หรือ Hub</strong>
              <span>กลับไปเลือกกิจกรรมถัดไป หรือเล่นซ้ำเพื่อเก็บคะแนนให้ดีขึ้น</span>
            </div>
          </div>
        </div>
      `;
    }

    if(mount === document.body){
      document.body.insertBefore(box, document.body.firstChild);
    }else{
      mount.insertBefore(box, mount.children[1] || null);
    }
  }

  function patchKnownText(){
    if(isWarmup){
      document.title = 'HeroHealth • Plate Warmup';
      safeReplaceText(
        ['warmup', 'เตรียม', 'พร้อม'],
        'เตรียมพร้อมก่อนเข้า Plate Solo'
      );
      safeReplaceText(
        ['เริ่ม', 'continue', 'start'],
        'เริ่ม Plate Solo'
      );
      safeReplaceText(
        ['ถัดไป', 'next'],
        'ไปหน้าเล่น Plate Solo'
      );
    }else{
      document.title = 'HeroHealth • Plate Cooldown';
      safeReplaceText(
        ['cooldown', 'พัก', 'ผ่อน'],
        'พักสั้น ๆ หลังเล่น Plate Solo'
      );
      safeReplaceText(
        ['กลับ', 'hub', 'finish'],
        'กลับ Nutrition Zone'
      );
      safeReplaceText(
        ['เสร็จ', 'done'],
        'จบกิจกรรม Plate Solo'
      );
    }
  }

  function patchButtons(){
    const buttons = [...document.querySelectorAll('button,a')];

    buttons.forEach(btn => {
      const txt = (btn.textContent || '').trim().toLowerCase();

      if(isWarmup){
        if(
          txt.includes('start') ||
          txt.includes('เริ่ม') ||
          txt.includes('ต่อ') ||
          txt.includes('next')
        ){
          btn.textContent = 'เริ่ม Plate Solo';
        }
      }else{
        if(
          txt.includes('กลับ') ||
          txt.includes('hub') ||
          txt.includes('finish') ||
          txt.includes('done') ||
          txt.includes('ต่อ')
        ){
          btn.textContent = 'กลับ Nutrition Zone';
        }
      }
    });
  }

  function preserveContextInLinks(){
    const keepKeys = [
      'pid','name','studyId','section','session_code',
      'diff','time','seed','hub','view','run','zone','game','mode','log'
    ];

    document.querySelectorAll('a[href]').forEach(a => {
      try{
        const u = new URL(a.getAttribute('href'), location.href);
        keepKeys.forEach(k => {
          const v = qs(k, '');
          if(v && !u.searchParams.get(k)) u.searchParams.set(k, v);
        });
        a.href = u.toString();
      }catch(_){}
    });
  }

  function run(){
    setDocTheme();
    injectStyle();
    patchKnownText();
    injectPlateCopyBox();
    patchButtons();
    preserveContextInLinks();

    setTimeout(() => {
      patchKnownText();
      patchButtons();
      preserveContextInLinks();
    }, 350);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run);
  }else{
    run();
  }
})();