"use strict";

function resultPayload(sec) {
  const summary = {
    itemId: '__summary__',
    kind: 'category_forest_summary',
    playerId: identity.playerId,
    passportRotation: assignment.passportRotation,
    assessmentRotation: assignment.assessmentRotation,
    randomSeed: assignment.randomSeed,
    randomSeedHex: assignment.randomSeedHex,
    assignmentVersion: assignment.assignmentVersion,
    wordSetId,
    itemOrder: S.mainItems.map(item => item.id),
    categorySet: S.cats,
    firstTryCorrect: S.firstTryCorrect,
    firstTryAccuracy: Math.round(S.firstTryCorrect / 10 * 100),
    finalMastery: 100,
    rescueItems: [...S.missed.keys()],
    rescueCorrect: S.rescueCorrect,
    rescueTotal: S.rescueTotal,
    wrongAttempts: S.wrong,
    bestCombo: S.bestCombo,
    rushBonus: S.rushBonus,
    autoSpeechCount: S.autoSpeechCount,
    replaySpeechCount: S.replaySpeechCount,
    totalSpeechCount: S.speechCount,
    durationMs: sec * 1000,
    clientPoints: S.score,
    sourceVersion: VERSION
  };
  return {
    playerId: identity.playerId,
    nickname: identity.nickname,
    stageId: STAGE_ID,
    score: S.firstTryCorrect,
    total: 10,
    durationMs: sec * 1000,
    clientPoints: S.score,
    answers: [summary, ...S.events],
    sourceVersion: VERSION,
    wordSetId,
    itemOrder: summary.itemOrder,
    passportRotation: assignment.passportRotation,
    assessmentRotation: assignment.assessmentRotation,
    randomSeed: assignment.randomSeed
  };
}

async function submitResult(sec) {
  const status = document.getElementById('saveStatus');
  if (!submitEnabled || !authority?.submitGame) {
    if (status) {
      status.textContent = 'โหมดทดสอบ • ยังไม่ส่งผลเข้าระบบ';
      status.className = 'save-status';
    }
    return;
  }
  if (S.submitting || S.receipt) return;
  S.submitting = true;
  if (status) {
    status.textContent = 'กำลังบันทึกผลไป Firebase และปลดล็อกด่านถัดไป…';
    status.className = 'save-status';
  }
  try {
    const response = await authority.submitGame(resultPayload(sec));
    if (!response?.ok) throw new Error(response?.error || 'SUBMIT_FAILED');
    const firebaseSaved = response.mode === 'firebase' || response.authority?.mode === 'firebase';
    const done = document.getElementById('done');
    if (firebaseSaved) {
      S.receipt = response.receiptId || response.resultId || 'firebase-saved';
      S.submitError = '';
      if (status) {
        status.textContent = `บันทึก Firebase สำเร็จ • ${response.passed ? 'ผ่านด่าน' : 'ต้องทบทวนอีกครั้ง'} • Accuracy ${response.accuracy}%`;
        status.className = 'save-status ok';
      }
      if (done) done.textContent = 'Back to Passport';
    } else {
      S.submitError = response.firebaseError || 'FIREBASE_FALLBACK_ONLY';
      if (status) {
        status.textContent = 'บันทึกชั่วคราวบนเครื่องแล้ว • Firebase ยังไม่พร้อม จึงยังไม่ยืนยันผลข้ามเครื่อง';
        status.className = 'save-status bad';
      }
      const retry = document.getElementById('retrySave');
      if (retry) retry.hidden = false;
    }
  } catch (error) {
    console.error(error);
    S.submitError = String(error.message || error);
    if (status) {
      status.textContent = `บันทึก Firebase ไม่สำเร็จ: ${S.submitError}`;
      status.className = 'save-status bad';
    }
    const retry = document.getElementById('retrySave');
    if (retry) retry.hidden = false;
  } finally {
    S.submitting = false;
  }
}

function finish() {
  clearInterval(S.timer);
  clearTimeout(S.autoSpeakTimer);
  window.speechSynthesis?.cancel?.();
  const sec = Math.max(1, Math.floor((Date.now() - S.started) / 1000));
  const first = Math.round(S.firstTryCorrect / 10 * 100);
  const rank = first >= 90 ? 'S' : first >= 80 ? 'A' : first >= 70 ? 'B' : 'C';
  const message = S.rescueTotal
    ? `คุณจำแนกถูกตั้งแต่ครั้งแรก <strong>${S.firstTryCorrect} จาก 10 คำ</strong><br>ช่วยคำที่หลงป่าสำเร็จ <strong>${S.rescueCorrect} จาก ${S.rescueTotal} คำ</strong>`
    : `คุณจำแนกถูกตั้งแต่ครั้งแรก <strong>10 จาก 10 คำ</strong><br>ไม่มีคำศัพท์หลงป่า — ยอดเยี่ยมมาก!`;
  shell(`<div class="summary"><div class="series">LEXICON X CHALLENGE • GAME 2</div><div class="rank">${rank}</div><h1>Forest Cleared!</h1><h2>Category Forest • Portal Mission</h2>${S.rescueTotal ? `<div class="rescue-banner">LOST WORDS RESCUE • ${S.rescueCorrect}/${S.rescueTotal}</div>` : '<div class="perfect">PERFECT FOREST</div>'}<div class="summary-grid"><div class="stat"><small>FIRST-TRY</small><strong>${first}%</strong></div><div class="stat"><small>FINAL MASTERY</small><strong>100%</strong></div><div class="stat"><small>SCORE</small><strong>${S.score}</strong></div><div class="stat"><small>BEST COMBO</small><strong>×${Math.max(1, S.bestCombo)}</strong></div><div class="stat"><small>RUSH BONUS</small><strong>+${S.rushBonus}</strong></div><div class="stat"><small>MISSION SET</small><strong>${assignment.passportRotation || 'P1'}</strong></div></div><div class="learning-card">${message}<br><span style="color:#9bc8ba">เวลา ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} • ฟังเสียง ${S.speechCount} ครั้ง • Set ${wordSetId}</span></div><div id="saveStatus" class="save-status">${submitEnabled ? 'เตรียมบันทึกผลไป Firebase…' : 'โหมดทดสอบ • ยังไม่ส่งผลเข้าระบบ'}</div><div class="summary-actions"><button id="again" class="btn primary">Play Another Forest</button><button id="retrySave" class="btn secondary" hidden>Retry Firebase Save</button><button id="done" class="btn secondary">${fromPassport ? 'Back to Passport' : 'Back to Test Hub'}</button></div></div>`);
  document.getElementById('again').onclick = begin;
  document.getElementById('done').onclick = hub;
  document.getElementById('retrySave').onclick = () => submitResult(sec);
  setTimeout(() => document.getElementById('again').scrollIntoView({ block: 'nearest' }), 80);
  submitResult(sec);
}

document.getElementById('back').onclick = hub;
document.getElementById('exit').onclick = hub;
window.CATEGORY_FOREST = { version: VERSION, state: S, identity, assignment, wordSetId };
intro();
