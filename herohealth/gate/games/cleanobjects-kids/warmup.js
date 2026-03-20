// === /herohealth/gate/games/cleanobjects-kids/warmup.js ===
// Clean Objects Kids — Warmup
// CHILD-FRIENDLY / SAFE
// PATCH v20260320-CLEANOBJECTS-KIDS-WARMUP

'use strict';

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html !== undefined) n.innerHTML = html;
  return n;
}

function esc(s=''){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}

export async function mount(root, ctx, api){
  root.innerHTML = '';

  const wrap = el('div', 'coKidsGate coKidsWarmup');
  wrap.innerHTML = `
    <div class="coKidsGateCard">
      <div class="coKidsGateBadge">WARMUP</div>

      <div class="coKidsGateHero">
        <div class="coKidsGateIcon">🧽</div>
        <div>
          <div class="coKidsGateTitle">วอร์มอัปก่อนเล่น Clean Objects Kids</div>
          <div class="coKidsGateSub">
            เกมนี้มี <b>4 ด่าน</b> และด่านสุดท้ายคือ <b>Boss Mission</b>
          </div>
        </div>
      </div>

      <div class="coKidsGateSteps">
        <div class="coKidsGateStep"><span>1</span> มองหาจุดที่ควรเช็ดก่อน</div>
        <div class="coKidsGateStep"><span>2</span> ด่านจะยากขึ้นทีละนิด</div>
        <div class="coKidsGateStep"><span>3</span> ด่านสุดท้ายต้องหยุดการระบาดให้ได้</div>
      </div>

      <div class="coKidsGateTip">
        แตะปุ่มเริ่ม แล้วเล่นให้ครบทุกด่านนะ ✨
      </div>

      <div class="coKidsGateStats">
        <div class="coKidsStat">
          <div class="coKidsStatK">เวลาเตรียมตัว</div>
          <div class="coKidsStatV" id="coKidsWarmTime">6</div>
        </div>
        <div class="coKidsStat">
          <div class="coKidsStatK">ด่าน</div>
          <div class="coKidsStatV">4</div>
        </div>
        <div class="coKidsStat">
          <div class="coKidsStatK">เป้าหมาย</div>
          <div class="coKidsStatV">เช็ดให้ถูก</div>
        </div>
      </div>

      <div class="coKidsGateBtns">
        <button type="button" class="coKidsBtn coKidsBtnPrimary" id="coKidsWarmStart">
          เริ่มเกม
        </button>
      </div>
    </div>
  `;

  root.appendChild(wrap);

  let done = false;
  let secLeft = 6;
  let timer = 0;

  const timeEl = wrap.querySelector('#coKidsWarmTime');
  const btnStart = wrap.querySelector('#coKidsWarmStart');

  function setStats(){
    api?.setStats?.({
      time: secLeft,
      score: 0,
      miss: 0,
      acc: '0%'
    });
    api?.setSub?.('วอร์มอัปก่อนเริ่มเกม');
    api?.setDailyState?.('NEW');
  }

  function finishNow(){
    if(done) return;
    done = true;
    clearInterval(timer);

    api?.finish?.({
      ok: true,
      title: 'พร้อมแล้ว!',
      subtitle: 'ไปเล่น Clean Objects Kids ต่อได้เลย',
      lines: [
        'เริ่มจากด่านง่ายก่อน',
        'เล่นให้ครบ 4 ด่าน',
        'ด่านสุดท้ายมี Boss Mission'
      ],
      buffs: {
        kids: '1',
        diff: 'kids'
      }
    });
  }

  function tick(){
    secLeft = Math.max(0, secLeft - 1);
    if(timeEl) timeEl.textContent = String(secLeft);
    setStats();

    if(secLeft <= 0){
      finishNow();
    }
  }

  btnStart?.addEventListener('click', finishNow);

  setStats();
  timer = setInterval(tick, 1000);

  return {
    start(){},
    destroy(){
      clearInterval(timer);
    }
  };
}

export default mount;