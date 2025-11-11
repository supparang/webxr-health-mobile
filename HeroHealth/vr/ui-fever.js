// === /HeroHealth/vr/ui-fever.js (2025-11-10) ===
// HUD: Fever bar + Shield badge + Glow flame

function $(s){ return document.querySelector(s); }

export function ensureFeverBar(){
  if ($('#feverWrap')) return $('#feverWrap');

  const wrap = document.createElement('div');
  wrap.id = 'feverWrap';
  Object.assign(wrap.style, {
    position:'fixed', left:'50%', top:'56px', transform:'translateX(-50%)',
    width:'min(540px,86vw)', height:'12px', background:'#0b1222',
    border:'1px solid #334155', borderRadius:'999px', overflow:'hidden',
    zIndex:'910'
  });
  const fill = document.createElement('div');
  fill.id = 'feverFill';
  Object.assign(fill.style, {
    height:'100%', width:'0%',
    transition:'width .15s ease-out',
    background:'linear-gradient(90deg,#37d67a,#06d6a0)'
  });
  wrap.appendChild(fill);
  document.body.appendChild(wrap);

  // Shield badge
  if (!$('#shieldChip')){
    const chip = document.createElement('div');
    chip.id = 'shieldChip';
    chip.textContent = '🛡️ x0';
    Object.assign(chip.style, {
      position:'fixed', right:'16px', top:'16px',
      background:'#0f172acc', border:'1px solid #334155',
      borderRadius:'12px', padding:'8px 12px', fontWeight:'800',
      color:'#e8eefc', zIndex:'910'
    });
    document.body.appendChild(chip);
  }
  return wrap;
}

export function setFever(pct){
  ensureFeverBar();
  const p = Math.max(0, Math.min(100, Math.round(pct||0)));
  const fill = $('#feverFill'); if (fill) fill.style.width = p + '%';
}

export function setShield(n){
  ensureFeverBar();
  const chip = $('#shieldChip'); if (!chip) return;
  chip.textContent = '🛡️ x' + (n|0);
  chip.style.opacity = n>0 ? '1' : '.55';
}

export function setFeverActive(on){
  ensureFeverBar();
  const scorePill = $('#score');
  const wrap = $('#feverWrap');
  if (on){
    if (wrap) wrap.classList.add('fever-on');
    if (scorePill) scorePill.classList.add('fever-on');
  }else{
    if (wrap) wrap.classList.remove('fever-on');
    if (scorePill) scorePill.classList.remove('fever-on');
  }
}
export const setFlame = setFeverActive; // alias

// Minimal CSS glow (inject once)
(function(){
  if (document.getElementById('fever-css')) return;
  const st = document.createElement('style');
  st.id = 'fever-css';
  st.textContent = `
    .fever-on{ box-shadow:0 0 0 3px #ffd16655, 0 0 18px #ffd166aa; }
  `;
  document.head.appendChild(st);
})();
export default { ensureFeverBar, setFever, setFeverActive, setFlame, setShield };
