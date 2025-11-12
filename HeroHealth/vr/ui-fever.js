// === /HeroHealth/vr/ui-fever.js (flame + shield counter under score/combo) ===
let root=null, bar=null, fill=null, flame=null, shieldWrap=null, shieldVal=null;
let active=false, fever=0, shield=0, shieldSum=0;

(function inject(){
  if (document.getElementById('hha-fever-style')) return;
  const st=document.createElement('style'); st.id='hha-fever-style';
  st.textContent =
    '#hha-fever{position:relative;width:min(520px,70vw);height:12px;background:#1f2937;border:1px solid #334155;border-radius:999px;overflow:hidden;box-shadow:inset 0 0 10px rgba(0,0,0,.35)}'+
    '#hha-fever .fill{position:absolute;left:0;top:0;height:100%;width:0%;background:linear-gradient(90deg,#22d3ee,#a78bfa);box-shadow:0 0 18px rgba(59,130,246,.35)}'+
    '#hha-fever.flame .flame{position:absolute;right:-10px;top:-16px;width:26px;height:26px;pointer-events:none;'+
      'background:radial-gradient(closest-side,#ffd166,#fb923c 60%, rgba(0,0,0,0) 70%);'+
      'animation:flameBob .35s infinite alternate ease-in-out, flameGlow .6s infinite ease-in-out}'+
    '@keyframes flameBob{from{transform:translateY(0)}to{transform:translateY(-6px)}}'+
    '@keyframes flameGlow{0%{filter:drop-shadow(0 0 0 rgba(251,146,60,.0))}50%{filter:drop-shadow(0 0 10px rgba(251,146,60,.9))}100%{filter:drop-shadow(0 0 0 rgba(251,146,60,.0))}}'+
    '#hha-shield{margin-top:6px;display:flex;gap:6px;align-items:center;justify-content:center;color:#cbd5e1;font:800 12px system-ui}'+
    '#hha-shield .ico{filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}';
  document.head.appendChild(st);
})();

export function ensureFeverBar(){
  if (root && root.isConnected) return root;
  const dock = document.getElementById('feverBarDock') || document.querySelector('[data-hud="scorebox"]') || document.body;

  root = document.createElement('div'); root.id='hha-fever';
  fill = document.createElement('div'); fill.className='fill';
  flame = document.createElement('div'); flame.className='flame'; // visible when active
  root.appendChild(fill); root.appendChild(flame);

  shieldWrap = document.createElement('div'); shieldWrap.id='hha-shield';
  shieldWrap.innerHTML = '<span class="ico">🛡️</span> <span id="hhaShieldVal">0</span>';
  shieldVal = shieldWrap.querySelector('#hhaShieldVal');

  dock.appendChild(root);
  dock.appendChild(shieldWrap);

  // listen hud-ready to re-dock if HUD recreated
  try{
    window.addEventListener('hha:hud-ready', function(){
      const newDock = document.getElementById('feverBarDock') || document.querySelector('[data-hud="scorebox"]');
      if (newDock && (!root.parentElement || root.parentElement!==newDock)){
        newDock.appendChild(root); newDock.appendChild(shieldWrap);
      }
    });
  }catch(_){}
  return root;
}

export function setFever(n){
  fever = Math.max(0, Math.min(100, Number(n)||0));
  ensureFeverBar();
  if (fill) fill.style.width = fever+'%';
}
export function setFeverActive(on){
  active = !!on; ensureFeverBar();
  if (!root) return;
  if (active){ root.classList.add('flame'); }
  else { root.classList.remove('flame'); }
}
export function setShield(n){
  shield = Math.max(0, Number(n)||0);
  ensureFeverBar();
  if (shieldVal) shieldVal.textContent = String(shieldSum>0 ? `${shield} (+${shieldSum})` : shield);
}
export function addShield(n){
  shieldSum += Math.max(0, Number(n)||0);
  setShield(shield);
}
export default { ensureFeverBar, setFever, setFeverActive, setShield, addShield };
