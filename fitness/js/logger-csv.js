// fitness/js/logger-csv.js
'use strict';

/**
 * Generic CSV logger สำหรับ VR-Fitness ทุกเกม
 *
 * ใช้ sessionMeta:
 *  - gameId:     'shadow-breaker' | 'rhythm-boxer' | ...
 *  - playerId:   รหัสผู้เล่น / ผู้เข้าร่วม
 *  - mode:       'normal' | 'research'
 *  - difficulty: string
 *  - phase:      เช่น 'pre-test' / 'post-test'
 *  - filePrefix: prefix ไฟล์ CSV (optional)
 *  - uploadUrl:  URL สำหรับอัปโหลดขึ้น cloud (optional)
 *
 * Global:
 *  - window.VRFITNESS_UPLOAD_URL   (upload ทุกเกมใช้ตัวเดียว)
 *  - window.SHADOWBREAKER_UPLOAD_URL (ยังรองรับของเดิม)
 */

export function createCSVLogger(sessionMeta = {}) {
  const gameId = sessionMeta.gameId || 'shadow-breaker';
  const mode   = sessionMeta.mode   || 'normal';

  // ❗ ถ้าไม่ใช่โหมดวิจัย → ไม่ต้องทำอะไรเลย
  if (mode !== 'research') {
    // dummy logger — ป้องกัน error แต่ไม่ log/ไม่ดาวน์โหลด
    return {
      logSpawn () {},
      logHit   () {},
      logExpire() {},
      finish   () {}
    };
  }

  // ---- จากตรงนี้ไป คือโหมดวิจัยเท่านั้น ----

  const rows = [];

  const GLOBAL_UPLOAD =
    window.VRFITNESS_UPLOAD_URL ||
    window.SHADOWBREAKER_UPLOAD_URL ||
    '';

  const CLOUD_UPLOAD_URL = sessionMeta.uploadUrl || GLOBAL_UPLOAD;

  // header
  rows.push([
    'timestamp_ms',
    'game_id',
    'player_id',
    'mode',
    'difficulty',
    'phase',
    'event',
    'target_id',
    'target_type',
    'result',
    'reaction_ms',
    'score',
    'combo',
    'miss_count',
    'player_hp',
    'boss_index',
    'boss_hp',
    'boss_phase',
    'fever_active',
    'extra'
  ]);

  function addRow(e) {
    rows.push([
      e.t ?? Date.now(),
      gameId,
      sessionMeta.playerId || '',
      mode,
      sessionMeta.difficulty || '',
      sessionMeta.phase || '',
      e.event || '',
      e.id ?? '',
      e.type || '',
      e.result || '',
      e.reactionMs ?? '',
      e.score ?? '',
      e.combo ?? '',
      e.missCount ?? '',
      e.playerHP ?? '',
      e.bossIndex ?? '',
      e.bossHP ?? '',
      e.bossPhase || '',
      e.feverActive ? 1 : 0,
      e.extra ? JSON.stringify(e.extra) : ''
    ]);
  }

  async function tryUploadCSV(blob, fileName) {
    if (!CLOUD_UPLOAD_URL) return;
    try {
      const form = new FormData();
      form.append('file', blob, fileName);
      form.append('gameId', gameId);
      form.append('playerId', sessionMeta.playerId || '');
      form.append('mode', mode);
      form.append('difficulty', sessionMeta.difficulty || '');
      form.append('phase', sessionMeta.phase || '');
      await fetch(CLOUD_UPLOAD_URL, { method: 'POST', body: form });
    } catch (err) {
      console.warn('VRFitness CSV cloud upload failed', err);
    }
  }

  return {
    logSpawn(info) {
      addRow({
        ...info,
        event: 'spawn',
        result: '',
        reactionMs: '',
        score: '',
        combo: '',
        missCount: '',
        playerHP: '',
        feverActive: 0,
        extra: null
      });
    },
    logHit(info) {
      addRow({
        ...info,
        event: 'hit'
      });
    },
    logExpire(info) {
      addRow({
        ...info,
        event: 'expire',
        result: info.result || 'timeout'
      });
    },
    async finish(finalState) {
      if (finalState) {
        const a = finalState.analytics || {};
        addRow({
          event: 'end',
          id: '',
          type: '',
          result: finalState.endedBy || 'unknown',
          score: finalState.score,
          combo: finalState.combo,
          missCount: finalState.missCount,
          playerHP: finalState.playerHP,
          bossIndex: finalState.bossIndex ?? '',
          bossHP: '',
          bossPhase: 'end',
          feverActive: 0,
          t: Date.now(),
          extra: {
            elapsedMs: finalState.elapsedMs,
            totalSpawns: a.totalSpawns,
            totalHits: a.totalHits,
            normalHits: a.normalHits,
            decoyHits: a.decoyHits,
            expiredMisses: a.expiredMisses,
            accuracy: a.accuracy,
            avgReactionNormal: a.avgReactionNormal,
            avgReactionDecoy: a.avgReactionDecoy
          }
        });
      }

      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });

      const baseName =
        sessionMeta.filePrefix || `vrfitness_${gameId}`;
      const fileName = `${baseName}_${sessionMeta.playerId || 'anon'}_${Date.now()}.csv`;

      // ดาวน์โหลดลงเครื่อง (เฉพาะโหมดวิจัยเท่านั้น เพราะ mode !== 'research' ถูกตัดไปแล้วด้านบน)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // ส่งขึ้น cloud (ถ้ามี URL)
      tryUploadCSV(blob, fileName);
    }
  };
}