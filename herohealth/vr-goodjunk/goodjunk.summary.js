export function createGoodJunkSummary(root = document.body, options = {}) {
  const el = root.querySelector('#gjSummary');
  if (!el) throw new Error('Missing #gjSummary');

  const refs = {
    root: el,
    icon: el.querySelector('#gjsIcon'),
    title: el.querySelector('#gjsTitle'),
    subtitle: el.querySelector('#gjsSubtitle'),
    result: el.querySelector('#gjsResult'),

    score: el.querySelector('#gjsScore'),
    time: el.querySelector('#gjsTime'),
    miss: el.querySelector('#gjsMiss'),
    combo: el.querySelector('#gjsCombo'),

    goodHit: el.querySelector('#gjsGoodHit'),
    junkHit: el.querySelector('#gjsJunkHit'),
    rank: el.querySelector('#gjsRank'),
    enemyScore: el.querySelector('#gjsEnemyScore'),
    teamScore: el.querySelector('#gjsTeamScore'),
    contribution: el.querySelector('#gjsContribution'),
    attacksSent: el.querySelector('#gjsAttacksSent'),

    bossHpText: el.querySelector('#gjsBossHpText'),
    bossHpBar: el.querySelector('#gjsBossHpBar'),
    teamGoalText: el.querySelector('#gjsTeamGoalText'),
    teamGoalBar: el.querySelector('#gjsTeamGoalBar'),

    chip1: el.querySelector('#gjsChip1'),
    chip2: el.querySelector('#gjsChip2'),
    chip3: el.querySelector('#gjsChip3'),
    feedback: el.querySelector('#gjsFeedback'),

    btnPrimary: el.querySelector('#gjsBtnPrimary'),
    btnSecondary: el.querySelector('#gjsBtnSecondary'),
    btnClose: el.querySelector('#gjsBtnClose')
  };

  const state = {
    mode: options.mode || 'solo',
    view: options.view || 'mobile'
  };

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, Number(v) || 0));
  }

  function setText(node, value) {
    if (!node) return;
    node.textContent = String(value ?? '');
  }

  function setHtml(node, value) {
    if (!node) return;
    node.innerHTML = String(value ?? '');
  }

  function setWidth(node, pct) {
    if (!node) return;
    node.style.width = `${clamp(pct, 0, 100)}%`;
  }

  function setMode(mode = 'solo') {
    state.mode = String(mode || 'solo').toLowerCase();
    refs.root.dataset.mode = state.mode;
  }

  function setView(view = 'mobile') {
    state.view = String(view || 'mobile').toLowerCase();
    refs.root.dataset.view = state.view;
  }

  function open() {
    refs.root.classList.add('is-open');
    refs.root.setAttribute('aria-hidden', 'false');
  }

  function close() {
    refs.root.classList.remove('is-open');
    refs.root.setAttribute('aria-hidden', 'true');
  }

  function setResult(text = 'Finished', tone = 'info') {
    setText(refs.result, text);
    refs.result.className = `gjs__result gjs__result--${tone}`;
  }

  function setChip(node, text, tone = 'info') {
    if (!node) return;
    node.textContent = String(text ?? '');
    node.className = `gjs__chip gjs__chip--${tone}`;
  }

  function bindActions(actions = {}) {
    refs.btnPrimary.onclick = actions.onPrimary || null;
    refs.btnSecondary.onclick = actions.onSecondary || null;
    refs.btnClose.onclick = actions.onClose || close;

    if (actions.primaryLabel) setText(refs.btnPrimary, actions.primaryLabel);
    if (actions.secondaryLabel) setText(refs.btnSecondary, actions.secondaryLabel);
    if (actions.closeLabel) setText(refs.btnClose, actions.closeLabel);
  }

  function updateCommon(data = {}) {
    if ('icon' in data) setText(refs.icon, data.icon);
    if ('title' in data) setText(refs.title, data.title);
    if ('subtitle' in data) setText(refs.subtitle, data.subtitle);

    if ('score' in data) setText(refs.score, data.score);
    if ('time' in data) setText(refs.time, data.time);
    if ('miss' in data) setText(refs.miss, data.miss);
    if ('combo' in data) setText(refs.combo, data.combo);

    if ('goodHit' in data) setText(refs.goodHit, data.goodHit);
    if ('junkHit' in data) setText(refs.junkHit, data.junkHit);

    if ('feedback' in data) {
      setHtml(refs.feedback, `
        <div class="gjs__rowKey">Message</div>
        <div class="gjs__rowVal">${String(data.feedback)}</div>
      `);
    }

    if ('chip1' in data) setChip(refs.chip1, data.chip1.text, data.chip1.tone || 'info');
    if ('chip2' in data) setChip(refs.chip2, data.chip2.text, data.chip2.tone || 'good');
    if ('chip3' in data) setChip(refs.chip3, data.chip3.text, data.chip3.tone || 'warn');
  }

  function updateSolo(data = {}) {
    if ('bossHpPct' in data) {
      setWidth(refs.bossHpBar, data.bossHpPct);
      setText(refs.bossHpText, `${Math.round(Number(data.bossHpPct) || 0)}%`);
    }
  }

  function updateDuet(data = {}) {
    if ('teamScore' in data) setText(refs.teamScore, data.teamScore);
  }

  function updateRace(data = {}) {
    if ('rank' in data) setText(refs.rank, data.rank);
  }

  function updateBattle(data = {}) {
    if ('enemyScore' in data) setText(refs.enemyScore, data.enemyScore);
    if ('attacksSent' in data) setText(refs.attacksSent, data.attacksSent);
  }

  function updateCoop(data = {}) {
    if ('teamScore' in data) setText(refs.teamScore, data.teamScore);
    if ('contribution' in data) setText(refs.contribution, data.contribution);
    if ('teamGoalText' in data) setText(refs.teamGoalText, data.teamGoalText);
    if ('teamGoalPct' in data) setWidth(refs.teamGoalBar, data.teamGoalPct);
  }

  function update(data = {}) {
    if (data.mode) setMode(data.mode);
    if (data.view) setView(data.view);

    updateCommon(data);

    switch (state.mode) {
      case 'solo':
        updateSolo(data);
        break;
      case 'duet':
        updateDuet(data);
        break;
      case 'race':
        updateRace(data);
        break;
      case 'battle':
        updateBattle(data);
        break;
      case 'coop':
        updateCoop(data);
        break;
    }

    if (data.result) {
      setResult(data.result.text || 'Finished', data.result.tone || 'info');
    }

    if (data.actions) {
      bindActions(data.actions);
    }
  }

  setMode(state.mode);
  setView(state.view);

  return {
    el: refs.root,
    refs,
    state,
    open,
    close,
    setMode,
    setView,
    setResult,
    bindActions,
    update
  };
}