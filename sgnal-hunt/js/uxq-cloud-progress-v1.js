/* UX Quest • Cloud Progress Restore v1
 * Restores best W1–W15 / B1–B4 results from the classroom Sheet by studentId + section + courseId.
 */
(() => {
  'use strict';

  const STATUS_ID = 'uxqCloudProgressStatus';
  const PROFILE_ROW_ID = 'uxqCloudProfileRow';
  const LAST_SYNC_KEY = 'uxq.cloud.progress.lastSync.v1';
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const identity = () => window.UXQIdentity;
  const progressStore = () => window.UXQProgress;

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function ensureStyle(){
    if (document.getElementById('uxq-cloud-progress-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-cloud-progress-style';
    style.textContent = `
      .uxq-cloud-profile{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 11px;border:1px solid rgba(155,205,255,.22);border-radius:13px;background:rgba(7,20,47,.56);color:#eaf3ff}
      .uxq-cloud-profile__info{display:grid;gap:2px;min-width:190px;flex:1}.uxq-cloud-profile__info b{font-size:.83rem}.uxq-cloud-profile__info small{color:#aebfe4;font-size:.72rem;line-height:1.35}
      .uxq-cloud-profile button{min-height:34px;border:1px solid rgba(123,232,255,.38);border-radius:10px;padding:7px 11px;background:rgba(55,154,210,.18);color:#eef8ff;font:inherit;font-size:.76rem;font-weight:900;cursor:pointer}
      .uxq-cloud-profile button:hover{background:rgba(76,194,238,.28)}
      .uxq-cloud-status{position:fixed;right:18px;bottom:18px;z-index:9998;max-width:min(390px,calc(100vw - 36px));padding:11px 14px;border:1px solid rgba(123,232,255,.36);border-radius:13px;background:#10274e;color:#eef8ff;box-shadow:0 18px 44px rgba(0,0,0,.35);font-size:.82rem;line-height:1.45;opacity:0;transform:translateY(8px);pointer-events:none;transition:.2s ease}
      .uxq-cloud-status[data-show="1"]{opacity:1;transform:none}.uxq-cloud-status[data-tone="ok"]{border-color:rgba(84,235,174,.55)}.uxq-cloud-status[data-tone="error"]{border-color:rgba(255,137,159,.58)}
    `;
    document.head.appendChild(style);
  }

  function status(message, tone){
    ensureStyle();
    let box = document.getElementById(STATUS_ID);
    if (!box) {
      box = document.createElement('div');
      box.id = STATUS_ID;
      box.className = 'uxq-cloud-status';
      box.setAttribute('role','status');
      box.setAttribute('aria-live','polite');
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.dataset.tone = tone || '';
    box.dataset.show = '1';
    clearTimeout(status.timer);
    status.timer = setTimeout(() => { box.dataset.show = '0'; }, tone === 'error' ? 7000 : 4200);
  }

  function cleanMissionId(value){ return String(value || '').trim().toLowerCase(); }

  function mergeCloud(cloud){
    const store = progressStore();
    if (!store || !cloud || !cloud.missions) return null;
    const local = store.get();
    const missions = Object.assign({}, local.missions || {});

    Object.keys(cloud.missions).forEach((rawId) => {
      const id = cleanMissionId(rawId);
      if (!store.MISSION_IDS.includes(id)) return;
      const remote = cloud.missions[rawId] || {};
      const previous = missions[id] || {};
      const remoteAttempt = {
        completedAt: remote.lastCompletedAt || remote.completedAt || new Date().toISOString(),
        score: Number(remote.bestScore || remote.score || 0),
        stars: Number(remote.bestStars || remote.stars || 0),
        accuracy: Number(remote.bestAccuracy || remote.accuracy || 0),
        correct: Number(remote.bestCorrect || remote.correct || 0),
        total: Number(remote.total || 0),
        hints: Number(remote.hints || 0),
        durationSec: Number(remote.durationSec || 0),
        passed: Boolean(remote.completed || remote.passed || Number(remote.bestStars || remote.stars || 0) >= 2),
        badge: String(remote.badge || 'cloud restore')
      };
      const history = Array.isArray(previous.history) ? previous.history.slice(-7) : [];
      if (!history.some(x => x && x.completedAt === remoteAttempt.completedAt && Number(x.score || 0) === remoteAttempt.score)) history.push(remoteAttempt);
      missions[id] = {
        id,
        attempts: Math.max(Number(previous.attempts || 0), Number(remote.attempts || 1)),
        completed: Boolean(previous.completed || remoteAttempt.passed),
        bestScore: Math.max(Number(previous.bestScore || 0), remoteAttempt.score),
        bestStars: Math.max(Number(previous.bestStars || 0), remoteAttempt.stars),
        bestAccuracy: Math.max(Number(previous.bestAccuracy || 0), remoteAttempt.accuracy),
        bestCorrect: Math.max(Number(previous.bestCorrect || 0), remoteAttempt.correct),
        lastResult: (!previous.lastCompletedAt || String(remoteAttempt.completedAt) >= String(previous.lastCompletedAt)) ? remoteAttempt : previous.lastResult,
        lastCompletedAt: [previous.lastCompletedAt, remoteAttempt.completedAt].filter(Boolean).sort().pop() || remoteAttempt.completedAt,
        history
      };
    });

    local.missions = missions;
    const saved = store.save(local);
    try {
      localStorage.setItem(LAST_SYNC_KEY, JSON.stringify({
        studentId: cloud.studentId || '', section: cloud.section || '', syncedAt: new Date().toISOString(),
        completedNodes: saved.quest?.completedNodes || 0, nextMission: cloud.nextMission || ''
      }));
    } catch (error) {}
    return saved;
  }

  function jsonp(url){
    return new Promise((resolve, reject) => {
      const callback = '__uxqCloudCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('หมดเวลารอข้อมูลจากระบบ')), 12000);
      function finish(error, value){
        clearTimeout(timer);
        try { delete window[callback]; } catch (e) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(value);
      }
      window[callback] = value => finish(null, value);
      const u = new URL(url);
      u.searchParams.set('callback', callback);
      script.src = u.href;
      script.onerror = () => finish(new Error('เชื่อมต่อระบบเรียกคืนข้อมูลไม่ได้'));
      document.head.appendChild(script);
    });
  }

  async function request(profile){
    const cfg = config();
    if (!cfg.receiverUrl) throw new Error('ยังไม่ได้ตั้งค่า receiverUrl');
    const url = new URL(cfg.receiverUrl);
    url.searchParams.set('action','uxq_student_progress');
    url.searchParams.set('studentId', profile.studentId);
    url.searchParams.set('section', profile.section);
    url.searchParams.set('courseId', cfg.courseId || 'UXQ-ACT1-2026');
    url.searchParams.set('_', Date.now());

    try {
      const response = await fetch(url.href, { method:'GET', cache:'no-store', redirect:'follow' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      return jsonp(url.href);
    }
  }

  async function restore(options){
    const opt = Object.assign({ silent:false }, options || {});
    const id = identity();
    if (!id) throw new Error('UXQIdentity ยังไม่พร้อม');
    let profile = id.get();
    if (!id.isComplete(profile)) {
      profile = await id.open({ title:'เข้าสู่ระบบผู้เรียนและเรียกคืนความก้าวหน้า' });
      if (!profile || profile.guest) return null;
    }
    if (!opt.silent) status('กำลังเรียกคืนความก้าวหน้าของ ' + profile.studentName + '…');
    const result = await request(profile);
    if (!result || !result.ok) throw new Error(result?.error || 'ไม่พบคำตอบจากระบบ');
    const saved = mergeCloud(result);
    const completed = Number(saved?.quest?.completedNodes || 0);
    const next = String(result.nextMission || '').toUpperCase();
    status(result.found
      ? `เรียกคืนแล้ว ${completed}/19 ด่าน${next ? ' • ด่านถัดไป ' + next : ''}`
      : 'ยังไม่พบประวัติเดิม เริ่มเล่นจาก W1 ได้เลย', 'ok');
    renderProfile();
    return result;
  }

  function profileText(){
    const id = identity();
    const p = id?.get?.() || {};
    return id?.isComplete?.(p)
      ? `${p.studentName} • ${p.studentId} • Section ${p.section}`
      : 'ยังไม่ได้ระบุผู้เรียน';
  }

  function mount(){
    ensureStyle();
    if (document.getElementById(PROFILE_ROW_ID)) return;
    const topbar = document.querySelector('.hub-topbar');
    if (!topbar) return;
    const row = document.createElement('div');
    row.id = PROFILE_ROW_ID;
    row.className = 'uxq-cloud-profile';
    row.innerHTML = `<div class="uxq-cloud-profile__info"><b>LEARNER CLOUD PROFILE</b><small id="uxqCloudProfileText"></small></div><button type="button" id="uxqEditProfileBtn">แก้ไข Profile</button><button type="button" id="uxqRestoreProgressBtn">เรียกคืนข้อมูลเดิม</button>`;
    topbar.insertAdjacentElement('afterend', row);
    row.querySelector('#uxqEditProfileBtn').addEventListener('click', async () => {
      const id = identity();
      const updated = await id.open({ title:'แก้ไขข้อมูลผู้เรียน' });
      if (updated && !updated.guest) {
        renderProfile();
        restore().catch(error => status(error.message || String(error), 'error'));
      }
    });
    row.querySelector('#uxqRestoreProgressBtn').addEventListener('click', () => restore().catch(error => status(error.message || String(error), 'error')));
    renderProfile();
  }

  function renderProfile(){
    const el = document.getElementById('uxqCloudProfileText');
    if (el) el.textContent = profileText();
  }

  async function autoRestore(){
    const id = identity();
    if (!id || !id.isComplete(id.get())) return;
    try { await restore({ silent:true }); }
    catch (error) { status('เรียกคืนอัตโนมัติไม่สำเร็จ: ' + (error.message || error), 'error'); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    mount();
    setTimeout(autoRestore, 250);
  });
  window.addEventListener('uxq-profile-updated', renderProfile);
  window.UXQCloudProgress = Object.freeze({ restore, mergeCloud, request });
})();