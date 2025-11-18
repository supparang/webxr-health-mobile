// js/logger-csv.js
'use strict';

/**
 * createCSVLogger(sessionMeta)
 * - เก็บ event ต่าง ๆ ไว้เป็น rows
 * - เมื่อ finish() → สร้าง Blob CSV + trigger download
 */

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
    'score',
    'combo',
    'miss_count',
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
      e.score ?? '',
      e.combo ?? '',
      e.missCount ?? '',
      e.extra ? JSON.stringify(e.extra) : ''
    ]);
  }

  return {
    logSpawn(info) {
      addRow({
        ...info,
        event: 'spawn',
        result: '',
        score: '',
        combo: '',
        missCount: '',
        extra: null
      });
    },
    logHit(info) {
      addRow({
        ...info,
        event: 'hit',
        missCount: info.missCount ?? '',
        phase: sessionMeta.phase || ''
      });
    },
    logExpire(info) {
      addRow({
        ...info,
        event: 'expire',
        result: 'timeout'
      });
    },
    finish(finalState) {
      if (finalState) {
        addRow({
          event: 'end',
          id: '',
          type: '',
          result: finalState.endedBy || 'unknown',
          score: finalState.score,
          combo: finalState.combo,
          missCount: finalState.missCount,
          t: Date.now(),
          extra: { elapsedMs: finalState.elapsedMs }
        });
      }

      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const baseName = sessionMeta.filePrefix || 'vrfitness_shadowbreaker';
      a.download = `${baseName}_${sessionMeta.playerId || 'anon'}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
}
