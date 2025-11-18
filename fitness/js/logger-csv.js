// fitness/js/logger-csv.js
'use strict';

/**
 * createCSVLogger(sessionMeta)
 * - เก็บ event ต่าง ๆ เป็นแถว
 * - finish(finalState) จะเพิ่ม analytics summary ลงแถวสุดท้าย
 * - ถ้าตั้ง SHADOWBREAKER_UPLOAD_URL ไว้ จะลองส่ง CSV ขึ้น cloud ด้วย (ไม่บังคับ)
 */

const CLOUD_UPLOAD_URL = window.SHADOWBREAKER_UPLOAD_URL || '';

export function createCSVLogger(sessionMeta) {
  const rows = [];

  // header
  rows.push([
    'timestamp_ms',
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
      sessionMeta.playerId || '',
      sessionMeta.mode || '',
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
      form.append('playerId', sessionMeta.playerId || '');
      form.append('mode', sessionMeta.mode || '');
      form.append('difficulty', sessionMeta.difficulty || '');
      form.append('phase', sessionMeta.phase || '');
      await fetch(CLOUD_UPLOAD_URL, {
        method: 'POST',
        body: form
      });
    } catch (err) {
      // เงียบ ๆ พอ ไม่ให้เกมล่ม
      console.warn('ShadowBreaker: cloud upload failed', err);
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
        result: 'timeout'
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
          bossIndex: finalState.bossIndex,
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
      const baseName = sessionMeta.filePrefix || 'vrfitness_shadowbreaker';
      const fileName = `${baseName}_${sessionMeta.playerId || 'anon'}_${Date.now()}.csv`;

      // ดาวน์โหลดลงเครื่อง
      const url  = URL.createObjectURL(blob);
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
