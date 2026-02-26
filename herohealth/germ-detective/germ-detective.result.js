// === /herohealth/germ-detective/germ-detective.result.js ===

export function ensureResultModalDOM(){
  if(document.getElementById('gdResultModal')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="gdResultModal" class="gd-modal" hidden aria-hidden="true" role="dialog" aria-labelledby="gdResultTitle">
      <div class="gd-modal__backdrop" data-close="1"></div>
      <section class="gd-modal__card">
        <header class="gd-modal__head">
          <div>
            <h3 id="gdResultTitle" style="margin:0">🕵️‍♀️ สรุปผลคดี Germ Detective</h3>
            <div class="mut" id="gdResultSubline">-</div>
          </div>
          <button class="btn" id="gdResultCloseBtn" type="button">ปิด</button>
        </header>

        <div class="gd-modal__body">
          <section class="gd-panel">
            <div class="head"><strong>📊 คะแนนรวม</strong><small id="gdResultRank">-</small></div>
            <div class="body">
              <div class="result-grid">
                <div class="result-item"><div class="mut">Total</div><div id="gdScoreTotal">-</div></div>
                <div class="result-item"><div class="mut">Accuracy</div><div id="gdScoreAccuracy">-</div></div>
                <div class="result-item"><div class="mut">Chain</div><div id="gdScoreChain">-</div></div>
                <div class="result-item"><div class="mut">Speed</div><div id="gdScoreSpeed">-</div></div>
                <div class="result-item"><div class="mut">Verification</div><div id="gdScoreVerify">-</div></div>
                <div class="result-item"><div class="mut">Intervention</div><div id="gdScoreIntervention">-</div></div>
                <div class="result-item" style="grid-column:1/-1"><div class="mut">Mission</div><div id="gdScoreMission">-</div></div>
                <div class="result-item" style="grid-column:1/-1"><div class="mut">Graph Chain</div><div id="gdScoreGraphChain">-</div></div>
                <div class="result-item" style="grid-column:1/-1"><div class="mut">Research Replay</div><div id="gdResearchReplayInfo">-</div></div>
              </div>
            </div>
          </section>

          <section class="gd-panel">
            <div class="head"><strong>🏅 Badges</strong><small id="gdResultBadgeMeta">-</small></div>
            <div class="body"><div id="gdResultBadges" class="badge-row"></div></div>
          </section>
        </div>

        <footer class="gd-modal__foot">
          <button class="btn" id="gdBtnPlayAgain" type="button">เล่นอีกครั้ง</button>
          <button class="btn" id="gdBtnCopySummary" type="button">คัดลอกสรุป</button>
          <button class="btn good" id="gdBtnBackHub" type="button">กลับ HUB</button>
        </footer>
      </section>
    </div>
  `;
  document.body.appendChild(wrap.firstElementChild);
}

export function openResult(){ const m=document.getElementById('gdResultModal'); if(!m) return; m.hidden=false; m.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
export function closeResult(){ const m=document.getElementById('gdResultModal'); if(!m) return; m.hidden=true; m.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

function pill(label, tier){
  const d = document.createElement('div');
  d.className = `gd-badge-pill ${tier||''}`.trim();
  d.textContent = label;
  return d;
}

export function computeBadges(ctx){
  const { P, GD, score } = ctx;
  const badges = [];
  const total = Number(score?.final || 0);
  if(total >= 85) badges.push({ key:'super_sleuth', label:'🕵️ Super Sleuth', tier:'epic' });
  if(score?.mission?.allClear) badges.push({ key:'mission_all_clear', label:'🎯 Mission All Clear', tier:'rare' });
  if((score?.intervention?.efficiency||0) >= 75) badges.push({ key:'budget_master', label:'🧰 Budget Master', tier:'rare' });
  if((score?.intervention?.strategy||0) >= 75) badges.push({ key:'smart_cleaner', label:'🧠 Smart Cleaner', tier:'' });
  if((score?.graph?.inferredChain?.length||0) >= 3) badges.push({ key:'chain_builder', label:'🕸️ Chain Builder', tier:'' });
  if((GD.ai?.riskScore || 999) <= 35) badges.push({ key:'risk_crusher', label:'📉 Risk Crusher', tier:'' });
  if(P.run === 'research') badges.push({ key:'research_run', label:'🧪 Research Replay', tier:'' });
  return badges;
}

export function renderResult(ctx){
  const { P, GD, score, hubURL } = ctx;
  const set = (id, val)=>{ const e=document.getElementById(id); if(e) e.textContent = (val==null?'-':String(val)); };

  set('gdResultSubline', `${P.scene} • ${P.diff} • ${P.run} • pid=${P.pid} • seed=${P.seed}`);
  set('gdResultRank', `Rank ${score.rank || '-'}`);
  set('gdScoreTotal', score.final ?? '-');
  set('gdScoreAccuracy', score.accuracy?.score ?? '-');
  set('gdScoreChain', score.chain?.score ?? '-');
  set('gdScoreSpeed', score.speed?.score ?? '-');
  set('gdScoreVerify', score.verification?.score ?? '-');
  set('gdScoreIntervention', score.intervention ? `${score.intervention.score} (S:${score.intervention.strategy}/E:${score.intervention.efficiency})` : '-');
  set('gdScoreMission', score.mission ? `${score.mission.completedObjectives}/${score.mission.totalObjectives} • +${score.mission.bonusPoints}` : '-');
  set('gdScoreGraphChain', score.graph?.inferredChain?.length ? score.graph.inferredChain.join(' → ') : '-');
  set('gdResearchReplayInfo', (P.run === 'research') ? `deterministic ✅ • ${window.__GD_RESEARCH_SEED_BASE__ || '-'}` : 'play mode');

  const badges = computeBadges({ P, GD, score });
  set('gdResultBadgeMeta', `${badges.length} badges`);
  const box = document.getElementById('gdResultBadges');
  if(box){
    box.innerHTML = '';
    badges.forEach(b=> box.appendChild(pill(b.label, b.tier)));
  }

  // wiring buttons
  document.getElementById('gdResultCloseBtn')?.addEventListener('click', closeResult, { once:false });
  document.getElementById('gdBtnBackHub')?.addEventListener('click', ()=> location.href = hubURL(), { once:false });
  document.getElementById('gdBtnPlayAgain')?.addEventListener('click', ()=>{
    const u = new URL(location.href);
    if(P.run !== 'research') u.searchParams.set('seed', String(Date.now()));
    location.href = u.pathname + u.search;
  }, { once:false });

  document.getElementById('gdBtnCopySummary')?.addEventListener('click', async ()=>{
    const txt = [
      `Germ Detective Summary`,
      `Scene: ${P.scene} | Diff: ${P.diff} | Run: ${P.run} | PID: ${P.pid}`,
      `Seed: ${P.seed}`,
      `Score: ${score.final} | Rank: ${score.rank}`,
      `Chain: ${(score.graph?.inferredChain||[]).join(' -> ') || '-'}`,
    ].join('\n');
    try{ await navigator.clipboard.writeText(txt); }catch{}
  }, { once:false });

  const modal = document.getElementById('gdResultModal');
  modal?.addEventListener('click', (ev)=>{
    if(ev.target?.dataset?.close === '1') closeResult();
  }, { once:false });

  openResult();
}