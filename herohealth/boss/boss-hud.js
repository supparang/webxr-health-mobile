// === /herohealth/boss/boss-hud.js — Universal Boss HUD v20260217a ===
'use strict';

function el(tag, cls, txt){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

export function mountBossHUD(opts={}){
  const id = opts.id || 'hh-boss-hud';
  let root = document.getElementById(id);
  if (root) return makeAPI(root);

  root = el('div', 'hh-boss-hud hh-hidden');
  root.id = id;

  const wrap = el('div', 'wrap');
  const row  = el('div', 'row');
  const chips= el('div', 'chips');

  const cTitle = el('span','chip hot'); cTitle.innerHTML = '⚡ <b>BOSS</b>';
  const cHp    = el('span','chip');     cHp.innerHTML = 'HP <b id="hhb-hp">100%</b>';
  const cPreset= el('span','chip cool');cPreset.innerHTML = 'Preset <b id="hhb-preset">—</b>';
  const cSkill = el('span','chip');     cSkill.innerHTML = 'Skill <b id="hhb-skill">—</b>';
  const cFlag  = el('span','chip bad'); cFlag.innerHTML = '<b id="hhb-flag">—</b>';
  cFlag.style.display = 'none';

  const cShield= el('span','chip');     cShield.innerHTML = 'Shield <b id="hhb-shield">—</b>';
  cShield.style.display = 'none';

  chips.append(cTitle,cHp,cPreset,cSkill,cFlag,cShield);

  const bar = el('div','bar');
  const fill= el('div','fill'); fill.id = 'hhb-fill';
  bar.append(fill);

  const hint = el('div','hint'); hint.id='hhb-hint';
  hint.textContent = 'Boss HUD ready';

  row.append(chips);
  wrap.append(row, bar, hint);
  root.append(wrap);
  document.body.append(root);

  return makeAPI(root);
}

function makeAPI(root){
  const hpEl = root.querySelector('#hhb-hp');
  const presetEl = root.querySelector('#hhb-preset');
  const skillEl = root.querySelector('#hhb-skill');
  const fillEl = root.querySelector('#hhb-fill');
  const hintEl = root.querySelector('#hhb-hint');
  const flagWrap = root.querySelector('#hhb-flag')?.parentElement;
  const flagEl = root.querySelector('#hhb-flag');
  const shieldWrap = root.querySelector('#hhb-shield')?.parentElement;
  const shieldEl = root.querySelector('#hhb-shield');

  function show(on=true){
    root.classList.toggle('hh-hidden', !on);
  }

  function setHUD(hud){
    // hud: { hp, preset, skillLabel/skill, reverseOn, shieldNeed, shieldStreak }
    if (!hud) return;
    const hp = Number.isFinite(hud.hp) ? hud.hp : 0;
    const hpPct = clamp(Math.round(hp), 0, 100);

    if (hpEl) hpEl.textContent = hpPct + '%';
    if (fillEl) fillEl.style.transform = `scaleX(${clamp(hp/100,0,1).toFixed(3)})`;
    if (presetEl) presetEl.textContent = String(hud.preset || '—');
    if (skillEl) skillEl.textContent = String(hud.skillLabel || hud.skill || '—');

    // flags
    const flags = [];
    if (hud.reverseOn) flags.push('REVERSE');
    if (hud.skill === 'combo_lock') flags.push('LOCK');
    if (hud.skill === 'stamina_drain') flags.push('DRAIN');
    if (hud.skill === 'fake_callout') flags.push('FAKE');

    if (flagWrap && flagEl){
      if (flags.length){
        flagWrap.style.display = '';
        flagEl.textContent = flags.join(' · ');
      }else{
        flagWrap.style.display = 'none';
      }
    }

    // shield
    if (shieldWrap && shieldEl){
      if ((hud.shieldNeed||0) > 0){
        shieldWrap.style.display = '';
        shieldEl.textContent = `${hud.shieldStreak||0}/${hud.shieldNeed||0}`;
      }else{
        shieldWrap.style.display = 'none';
      }
    }

    if (hintEl){
      if (hpPct <= 0) hintEl.textContent = '🏆 Boss down!';
      else if ((hud.shieldNeed||0) > 0) hintEl.textContent = '🛡️ ต้องถูกติดกันเพื่อแตกโล่';
      else if (hud.reverseOn) hintEl.textContent = '🌀 Reverse: A/B สลับชั่วคราว';
      else hintEl.textContent = '⚡ อ่านสัญญาณ / จังหวะ แล้วกดก่อนเส้น';
    }
  }

  return { show, setHUD };
}