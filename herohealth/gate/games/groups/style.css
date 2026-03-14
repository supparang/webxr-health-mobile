/* === /herohealth/gate/games/groups/cooldown.js ===
   HeroHealth Gate Mini-game
   GAME: groups
   MODE: cooldown
   FULL PATCH v20260314-GATE-GROUPS-COOLDOWN-AUTOSTART-FALLBACK
   ✅ FIX: auto-start fallback if gate-core cache/old version doesn't call controller.start()
   ✅ FIX: child-friendly cooldown review
*/

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-groups';
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function el(tag, cls='', text=''){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(text) n.textContent = text;
  return n;
}

function shuffle(arr, rng=Math.random){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function calcRank(acc){
  if(acc >= 90) return 'S';
  if(acc >= 75) return 'A';
  if(acc >= 60) return 'B';
  if(acc >= 40) return 'C';
  return 'D';
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 97);

  const GROUPS = [
    { key:'g1', label:'หมู่ 1 โปรตีน', short:'โปรตีน' },
    { key:'g2', label:'หมู่ 2 คาร์โบไฮเดรต', short:'แป้ง' },
    { key:'g3', label:'หมู่ 3 ผัก', short:'ผัก' },
    { key:'g4', label:'หมู่ 4 ผลไม้', short:'ผลไม้' },
    { key:'g5', label:'หมู่ 5 ไขมัน', short:'ไขมัน' }
  ];

  const ITEMS = [
    { text:'🥚 ไข่', group:'g1' },
    { text:'🐟 ปลา', group:'g1' },
    { text:'🥛 นม', group:'g1' },
    { text:'🫘 ถั่วแดง', group:'g1' },

    { text:'🍚 ข้าว', group:'g2' },
    { text:'🍞 ขนมปัง', group:'g2' },
    { text:'🥔 มันฝรั่ง', group:'g2' },
    { text:'🌽 ข้าวโพด', group:'g2' },

    { text:'🥬 คะน้า', group:'g3' },
    { text:'🥕 แครอท', group:'g3' },
    { text:'🥒 แตงกวา', group:'g3' },
    { text:'🥦 บรอกโคลี', group:'g3' },

    { text:'🍌 กล้วย', group:'g4' },
    { text:'🍊 ส้ม', group:'g4' },
    { text:'🍉 แตงโม', group:'g4' },
    { text:'🍎 แอปเปิล', group:'g4' },

    { text:'🧈 เนย', group:'g5' },
    { text:'🥥 กะทิ', group:'g5' },
    { text:'🐷 มันหมู', group:'g5' },
    { text:'🛢️ น้ำมันปรุงอาหาร', group:'g5' }
  ];

  const rounds = shuffle(ITEMS, rng).slice(0, 5);

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;
  let ended = false;
  let started = false;

  const plannedTime = Number(ctx.time || 20);
  let timeLeft = plannedTime;

  root.innerHTML = '';

  const wrap = el('div', 'grp-wrap');
  const hero = el('div', 'grp-hero');
  const stage = el('div', 'grp-stage');
  const panelTop = el('div', 'grp-panel');
  const panelBottom = el('div', 'grp-panel');

  hero.innerHTML = `
    <div class="grp-kicker">NUTRITION ZONE • GROUPS • COOLDOWN</div>
    <div class="grp-title">หมู่นี้ควรเลือกอะไร</div>
    <div class="grp-sub">ทบทวนความเข้าใจเรื่องอาหาร 5 หมู่ ด้วยการเลือกตัวอย่างอาหารที่ตรงกับหมวด</div>
  `;

  const target = el('div', 'grp-target', 'เตรียมทบทวน…');
  const prompt = el('div', 'grp-prompt', 'เลือกตัวอย่างอาหารที่ตรงหมวด');
  const choices = el('div', 'grp-choices');
  const note = el('div', 'grp-note', 'Cooldown ใช้เพื่อทบทวนและเชื่อมความเข้าใจก่อนกลับ HUB');

  panelTop.appendChild(target);
  panelBottom.appendChild(prompt);
  panelBottom.appendChild(choices);
  panelBottom.appendChild(note);
  stage.appendChild(panelTop);
  stage.appendChild(panelBottom);
  wrap.appendChild(hero);
  wrap.appendChild(stage);
  root.appendChild(wrap);

  api.logger?.push?.('mini_start', {
    game: 'groups',
    mode: 'cooldown',
    seed: ctx.seed
  });

  api.setStats({
    time: timeLeft,
    score: 0,
    miss: 0,
    acc: '0%'
  });

  function updateHud(){
    const acc = idx > 0 ? Math.round((correct / idx) * 100) : 0;
    api.setStats({
      time: timeLeft,
      score,
      miss,
      acc: `${acc}%`
    });
  }

  function buildChoices(item){
    const correctItem = item;
    const wrongPool = ITEMS.filter(x => x.group !== item.group);
    const wrongs = shuffle(wrongPool, rng).slice(0, 3);
    return shuffle([correctItem, ...wrongs], rng);
  }

  function renderRound(){
    if(ended) return;
    if(idx >= rounds.length){
      finishNow();
      return;
    }

    const item = rounds[idx];
    const groupMeta = GROUPS.find(g => g.key === item.group) || GROUPS[0];

    target.textContent = groupMeta.label;
    prompt.textContent = 'เลือกอาหารที่อยู่ในหมู่นี้';
    choices.innerHTML = '';

    const pickSet = buildChoices(item);

    for(const opt of pickSet){
      const btn = el('button', 'grp-btn ghost', opt.text);
      btn.setAttribute('aria-label', opt.text);

      btn.addEventListener('click', ()=>{
        if(ended) return;

        idx++;

        const isCorrect = opt.text === item.text && opt.group === item.group;

        if(isCorrect){
          score += 10;
          correct++;
        }else{
          score -= 4;
          miss++;
        }

        api.logger?.push?.('mini_answer', {
          game: 'groups',
          mode: 'cooldown',
          round: idx,
          targetGroup: item.group,
          targetGroupLabel: groupMeta.label,
          selected: opt.text,
          selectedGroup: opt.group,
          correctItem: item.text,
          score,
          miss,
          correctCount: correct
        });

        updateHud();
        renderRound();
      });

      choices.appendChild(btn);
    }
  }

  function finishNow(){
    if(ended) return;
    ended = true;
    clearInterval(timer);

    const accuracy = rounds.length > 0 ? Math.round((correct / rounds.length) * 100) : 0;
    const rank = calcRank(accuracy);

    root.innerHTML = `
      <div class="grp-result">
        <div class="grp-badge">🌿 Cooldown Rank ${rank}</div>
        <div class="grp-big">ทบทวนเสร็จแล้ว!</div>
        <div class="grp-list">
          <div class="grp-item">คะแนน: ${score}</div>
          <div class="grp-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="grp-item">ตอบถูก: ${correct}/${rounds.length}</div>
          <div class="grp-item">พลาด: ${miss}</div>
        </div>
        <div class="grp-actions">
          <button class="grp-btn good" id="grpFinishBtn">กลับ HUB</button>
        </div>
      </div>
    `;

    root.querySelector('#grpFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'ทบทวนเสร็จแล้ว!',
        subtitle: 'กลับหน้าหลักได้เลย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          `ตอบถูก: ${correct}/${rounds.length}`,
          `Rank: ${rank}`
        ],
        metrics: {
          score,
          accuracy,
          correct,
          misses: miss,
          rank
        },
        markDailyDone: true
      });
    });
  }

  function startGame(){
    if(started || ended) return;
    started = true;
    renderRound();
  }

  const timer = setInterval(()=>{
    if(ended) return;
    timeLeft--;
    if(timeLeft < 0) timeLeft = 0;
    updateHud();

    if(timeLeft <= 0){
      finishNow();
    }
  }, 1000);

  // fallback: เริ่มเกมทันที เผื่อ gate-core cache อยู่และไม่ได้เรียก start()
  startGame();

  return {
    start(){
      startGame();
    },
    destroy(){
      ended = true;
      clearInterval(timer);
    }
  };
}
