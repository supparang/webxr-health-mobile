// === /HeroHealth/core/main.js (2025-11-12 result overlay with quest badge) ===
export function showResult(detail){
  const old=document.getElementById('resultOverlay'); if(old) old.remove();
  const o=document.createElement('div'); o.id='resultOverlay';
  o.innerHTML=`
  <div class="card">
    <h2>สรุปผล</h2>
    <div class="stars">★★★★★</div>
    <div class="stats">
      <div>โหมด: ${detail.mode}</div>
      <div>ระดับ: ${detail.difficulty}</div>
      <div>คะแนน: ${detail.score.toLocaleString()}</div>
      <div>คอมโบสูงสุด: ${detail.comboMax}</div>
      <div>พลาด: ${detail.misses}</div>
      <div>ใช้เวลา: ${detail.duration}s</div>
      <div class="questBadge">QUESTS ${detail.questsCleared}/${detail.questsTotal}</div>
    </div>
    <div class="btns"><button id="btnHub">กลับ Hub</button><button id="btnRetry">เล่นอีกครั้ง</button></div>
  </div>`;
  document.body.appendChild(o);
  const badge=o.querySelector('.questBadge'); paintQuestBadge(badge,detail.questsCleared,detail.questsTotal);
  o.querySelector('#btnHub').onclick=()=>location.href='../../index.html';
  o.querySelector('#btnRetry').onclick=()=>location.reload();
}
function paintQuestBadge(badge,x,y){
  const r=y?x/y:0;
  badge.style.borderColor=(r>=1)?'#16a34a':(r>=0.5?'#f59e0b':'#ef4444');
  badge.style.background=(r>=1)?'#16a34a22':(r>=0.5?'#f59e0b22':'#ef444422');
  badge.style.color=(r>=1)?'#bbf7d0':(r>=0.5?'#fde68a':'#fecaca');
}
const css=document.createElement('style');css.textContent=`
#resultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:99;}
#resultOverlay .card{background:#1e293b;border-radius:16px;padding:24px;min-width:280px;color:#fff;text-align:center;box-shadow:0 0 20px #000a;}
.questBadge{margin-top:8px;padding:4px 8px;border:2px solid #444;border-radius:8px;display:inline-block;font-weight:600;}
.btns{margin-top:16px;display:flex;justify-content:center;gap:12px;}
.btns button{padding:6px 12px;border-radius:8px;border:none;font-weight:600;cursor:pointer;}
.btns #btnHub{background:#0f172a;color:#fff;}
.btns #btnRetry{background:#22c55e;color:#fff;}
`;document.head.appendChild(css);
