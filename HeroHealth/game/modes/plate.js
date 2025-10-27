// === Hero Health Academy — modes/plate.js (quota tracker aligned) ===
export const name = 'plate';

// โควตาอย่างง่าย: โปรตีน/ผัก/ธัญพืช/ผลไม้ (ตัวอย่าง)
const GROUPS = [
  { id:'protein', labelTH:'โปรตีน',  labelEN:'Protein',   icon:'🍗' },
  { id:'veggies', labelTH:'ผัก',     labelEN:'Vegetables',icon:'🥦' },
  { id:'grains',  labelTH:'ธัญพืช', labelEN:'Grains',    icon:'🍞' },
  { id:'fruits',  labelTH:'ผลไม้',   labelEN:'Fruits',    icon:'🍎' },
];

const ITEMS = [
  // โปรตีน
  { id:'egg', group:'protein', icon:'🥚' }, { id:'fish', group:'protein', icon:'🐟' }, { id:'beef', group:'protein', icon:'🥩' },
  // ผัก
  { id:'carrot', group:'veggies', icon:'🥕' }, { id:'broccoli', group:'veggies', icon:'🥦' }, { id:'salad', group:'veggies', icon:'🥗' },
  // ธัญพืช
  { id:'rice', group:'grains', icon:'🍚' }, { id:'bread', group:'grains', icon:'🍞' }, { id:'spaghetti', group:'grains', icon:'🍝' },
  // ผลไม้
  { id:'apple', group:'fruits', icon:'🍎' }, { id:'banana', group:'fruits', icon:'🍌' }, { id:'orange', group:'fruits', icon:'🍊' },
];

const ST = {
  lang:'TH',
  quota: { protein:2, veggies:3, grains:2, fruits:2 },
  got:   { protein:0, veggies:0, grains:0, fruits:0 },
  x2Until:0,
};

export function init(gameState, hud, diff){
  ST.lang = localStorage.getItem('hha_lang') || 'TH';
  // ปรับโควตาตามความยาก
  const d = gameState?.difficulty || 'Normal';
  ST.quota = (d==='Easy')? {protein:2, veggies:2, grains:2, fruits:2}
            : (d==='Hard')? {protein:3, veggies:4, grains:3, fruits:3}
            :                {protein:2, veggies:3, grains:2, fruits:2};
  ST.got   = { protein:0, veggies:0, grains:0, fruits:0 };
  showPlateHUD(true);
  renderPills();
}
export function cleanup(){ showPlateHUD(false); }
export function tick(){ /* no-op */ }

export function pickMeta(diff){
  // สุ่มจากทุกกลุ่มเท่า ๆ กัน
  const g = GROUPS[(Math.random()*GROUPS.length)|0].id;
  const pool = ITEMS.filter(x=>x.group===g);
  const it = pool[(Math.random()*pool.length)|0];

  const golden = performance.now() < ST.x2Until;
  const mult = golden ? 2 : 1;

  const lifeBase = diff?.life || 3000;
  const life = Math.min(4500, Math.max(700, lifeBase));

  // good = ยังไม่ครบโควตาของกลุ่มนั้น
  const needMore = (ST.got[g]||0) < (ST.quota[g]||0);

  return {
    id: it.id,
    groupId: g,
    char: it.icon,
    good: needMore,
    life,
    mult,
    golden
  };
}

export function onHit(meta, systems){
  if (meta.good){
    ST.got[meta.groupId] = (ST.got[meta.groupId]||0) + 1;
    renderPills();
    systems.coach?.say?.(t('ลงจานครบขึ้น!', 'Plate filling up!', ST.lang));
    return 'good';
  } else {
    systems.coach?.say?.(t('เกินโควตากลุ่มนี้แล้ว', 'Over quota for this group', ST.lang));
    return 'bad';
  }
}

export function getPowerDurations(){ return { x2:8, freeze:3, magnet:0 }; }
export const powers = {
  x2Target(){ ST.x2Until = performance.now() + 8000; },
  freezeTarget(){ /* main.js */ },
  magnetNext(){ /* not used in plate */ }
};

// ----- HUD helpers -----
function showPlateHUD(show){
  const el = document.getElementById('plateTracker');
  if (el) el.style.display = show ? 'block' : 'none';
  const t = document.getElementById('t_quota');
  if (t) t.textContent = tLang('โควตา','Quota');
}
function renderPills(){
  const host = document.getElementById('platePills'); if (!host) return;
  const parts = [];
  for (const g of GROUPS){
    const need = ST.quota[g.id]||0, have = ST.got[g.id]||0;
    const pill = `<span style="display:inline-block;margin-right:6px">${g.icon} ${have}/${need}</span>`;
    parts.push(pill);
  }
  host.innerHTML = parts.join('');
}

function tLang(th,en){ return (ST.lang==='EN')?en:th; }
function t(th,en,lang){ return lang==='EN'?en:th; }
