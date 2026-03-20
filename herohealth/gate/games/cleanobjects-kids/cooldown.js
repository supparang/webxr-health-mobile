// === /herohealth/gate/games/cleanobjects-kids/cooldown.js ===
// Clean Objects Kids — Cooldown
// CHILD-FRIENDLY / SAFE
// PATCH v20260320-CLEANOBJECTS-KIDS-COOLDOWN

'use strict';

function el(tag, cls, html){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(html !== undefined) n.innerHTML = html;
  return n;
}

function getLastSummary(){
  try{
    const raw = localStorage.getItem('HHA_LAST_SUMMARY') || '';
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

function pickPraise(summary){
  const score = Number(summary?.score || 0);
  const stars = Number(summary?.metrics?.stars || 0);
  const bossClear = !!summary?.metrics?.bossClear;

  if(bossClear) return 'สุดยอดมาก! ชนะ Boss Mission แล้ว 👾';
  if(stars >= 10) return 'เก่งมาก! วันนี้เล่นได้ยอดเยี่ยม ⭐';
  if(score >= 700) return 'เก่งมาก! เลือกจุดสำคัญได้ดีมาก';
  if(score >= 400) return 'ดีมาก! เล่นได้ดีขึ้นเรื่อย ๆ';
  return 'เก่งแล้ว ลองใหม่อีกรอบก็ได้ ✨';
}

export async function mount(root, ctx, api){
  root.innerHTML = '';

  const sum = getLastSummary();
  const praise = pickPraise(sum);

  const totalCorrect = Number(sum?.metrics?.totalCorrect || 0);
  const totalWrong = Number(sum?.metrics?.totalWrong || 0);
  const stars = Number(sum?.metrics?.stars || 0);
  const bossClear = !!sum?.metrics?.bossClear;

  const wrap = el('div', 'coKidsGate coKidsCooldown');
  wrap.innerHTML = `
    <div class="coKidsGateCard">
      <div class="coKidsGateBadge">COOLDOWN</div>

      <div class="coKidsGateHero">
        <div class="coKidsGateIcon">🌈</div>
        <div>
          <div class="coKidsGateTitle">พักหลังเล่น Clean Objects Kids</div>
          <div class="coKidsGateSub">${praise}</div>
        </div>
      </div>

      <div class="coKidsGateTip">
        หายใจลึก ๆ แล้วเตรียมกลับหน้า HUB ได้เลย 💙
      </div>

      <div class="coKidsGateStats">
        <div class="coKidsStat">
          <div class="coKidsStatK">ถูก</div>
          <div class="coKidsStatV">${totalCorrect}</div>
        </div>
        <div class="coKidsStat">
          <div class="coKidsStatK">พลาด</div>
          <div class="coKidsStatV">${totalWrong}</div>
        </div>
        <div class="coKidsStat">
          <div class="coKidsStatK">ดาวรวม</div>
          <div class="coKidsStatV">${stars}</div>
        </div>
        <div class="coKidsStat">
          <div class="coKidsStatK">Boss</div>
          <div class="coKidsStatV">${bossClear ? 'ผ่าน' : 'ยังไม่ผ่าน'}</div>
        </div>
      </div>

      <div class="coKidsGateBtns">
        <button type="button" class="coKidsBtn coKidsBtnPrimary" id="coKidsCooldownDone">
          กลับ HUB
        </button>
      </div>
    </div>
  `;

  root.appendChild(wrap);

  let done = false;

  function setStats(){
    api?.setStats?.({
      time: 0,
      score: Number(sum?.score || 0),
      miss: totalWrong,
      acc: `${Math.max(0, Math.min(100, totalCorrect + totalWrong > 0 ? Math.round((totalCorrect / (totalCorrect + totalWrong)) * 100) : 0))}%`
    });
    api?.setSub?.('พักสั้น ๆ ก่อนกลับหน้า HUB');
    api?.setDailyState?.('DONE');
  }

  function finishNow(){
    if(done) return;
    done = true;

    api?.finish?.({
      ok: true,
      title: 'พักเสร็จแล้ว!',
      subtitle: 'กลับหน้า HUB ได้เลย',
      lines: [
        praise,
        bossClear ? 'วันนี้หยุดการระบาดสำเร็จแล้ว' : 'ครั้งหน้าลองชนะ Boss Mission ให้ได้นะ',
        'พร้อมเล่นเกมอื่นต่อได้เลย'
      ],
      markDailyDone: true,
      buffs: {
        kids: '1',
        diff: 'kids'
      }
    });
  }

  wrap.querySelector('#coKidsCooldownDone')?.addEventListener('click', finishNow);

  setStats();

  return {
    start(){},
    destroy(){}
  };
}

export default mount;