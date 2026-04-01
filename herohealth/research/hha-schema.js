export const HHA_SCHEMA_VERSION = 'hha_research_v1';

export const HHA_STUDENTS_PROFILE_HEADERS = [
  'schema_version',
  'updated_at_iso',

  'pid',
  'study_id',
  'display_name',

  'grade_level',
  'class_room',
  'school_name',
  'gender',
  'age_years',

  'device_type',
  'app_family',
  'last_game_id',
  'last_game_version',
  'last_zone',
  'last_mode',
  'last_director_mode',
  'last_mission_id',
  'last_mission_label',

  'runs_total',
  'stars_total',
  'best_score',
  'last_score',
  'best_combo_overall',
  'perfect_total',
  'timeouts_total',
  'last_run_id'
];

export const HHA_SESSIONS_HEADERS = [
  'schema_version',
  'exported_at_iso',

  'run_id',
  'pid',
  'study_id',

  'app_family',
  'game_id',
  'game_version',
  'zone',
  'mode',

  'mission_id',
  'mission_label',
  'mission_subtitle',

  'director_mode',
  'director_label',
  'director_timer_scale',
  'director_primary_need_scale',
  'director_secondary_need_scale',
  'director_tertiary_need_scale',

  'score_final',
  'stars_final',
  'best_combo',
  'perfect_count',
  'timeout_count',
  'coach_tips_total',
  'coach_last_reason',

  'boss_checks_completed',
  'boss_checks_total',

  'progress_units_completed',
  'progress_units_total',
  'lives_remaining',

  'duration_ms',
  'duration_sec',
  'event_count',

  'phase_ready_enters',
  'phase_ready_clears',
  'phase_ready_timeouts',
  'phase_ready_mistakes',
  'phase_ready_correct_hits',
  'phase_ready_wrong_hits',
  'phase_ready_tips',

  'phase_core1_enters',
  'phase_core1_clears',
  'phase_core1_timeouts',
  'phase_core1_mistakes',
  'phase_core1_correct_hits',
  'phase_core1_wrong_hits',
  'phase_core1_tips',

  'phase_core2_enters',
  'phase_core2_clears',
  'phase_core2_timeouts',
  'phase_core2_mistakes',
  'phase_core2_correct_hits',
  'phase_core2_wrong_hits',
  'phase_core2_tips',

  'phase_core3_enters',
  'phase_core3_clears',
  'phase_core3_timeouts',
  'phase_core3_mistakes',
  'phase_core3_correct_hits',
  'phase_core3_wrong_hits',
  'phase_core3_tips',

  'phase_core4_enters',
  'phase_core4_clears',
  'phase_core4_timeouts',
  'phase_core4_mistakes',
  'phase_core4_correct_hits',
  'phase_core4_wrong_hits',
  'phase_core4_tips',

  'phase_boss_enters',
  'phase_boss_clears',
  'phase_boss_timeouts',
  'phase_boss_mistakes',
  'phase_boss_correct_hits',
  'phase_boss_wrong_hits',
  'phase_boss_tips'
];

export const HHA_EVENTS_HEADERS = [
  'schema_version',
  'exported_at_iso',

  'run_id',
  'pid',
  'study_id',

  'app_family',
  'game_id',
  'game_version',
  'zone',
  'mode',

  'mission_id',
  'mission_label',

  'event_index',
  'at_ms',
  'phase_id',
  'type',

  'entity_id',
  'entity_kind',

  'expected',
  'got',
  'need',
  'target_id',

  'director_mode',
  'combo',
  'base_score',
  'focus',

  'mood',
  'reason',
  'text',

  'adjusted_sec',
  'correct',
  'answer_id',
  'question_id',

  'extra_json'
];

export function hhaPickDeviceType(userAgent = '') {
  return /android|iphone|ipad|mobile/i.test(userAgent) ? 'mobile' : 'desktop';
}

export function hhaCsvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function hhaRowsToCsv(rows) {
  if (!rows?.length) return '';
  const headers = [];
  const seen = new Set();

  rows.forEach(row => {
    Object.keys(row || {}).forEach(k => {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    });
  });

  const lines = [headers.map(hhaCsvEscape).join(',')];
  rows.forEach(row => {
    lines.push(headers.map(h => hhaCsvEscape(row?.[h] ?? '')).join(','));
  });
  return lines.join('\n');
}

export function hhaMapPhaseKey(gameId, phaseId) {
  if (phaseId === 'ready') return 'phase_ready';
  if (phaseId === 'boss') return 'phase_boss';

  const bathMap = {
    wet: 'phase_core1',
    soap: 'phase_core2',
    rinse: 'phase_core3',
    dry: 'phase_core4'
  };

  return bathMap[phaseId] || 'phase_core1';
}

export function hhaCreateEmptyPhaseSummary() {
  return {
    phase_ready: makeBlank(),
    phase_core1: makeBlank(),
    phase_core2: makeBlank(),
    phase_core3: makeBlank(),
    phase_core4: makeBlank(),
    phase_boss: makeBlank()
  };

  function makeBlank() {
    return {
      enters: 0,
      clears: 0,
      timeouts: 0,
      mistakes: 0,
      correct_hits: 0,
      wrong_hits: 0,
      tips: 0
    };
  }
}

export function hhaFoldPhaseStats(rawPhaseStats = {}, gameId = '') {
  const out = hhaCreateEmptyPhaseSummary();

  Object.keys(rawPhaseStats || {}).forEach(phaseId => {
    const src = rawPhaseStats[phaseId] || {};
    const key = hhaMapPhaseKey(gameId, phaseId);
    if (!out[key]) return;

    out[key].enters += Number(src.enters || 0);
    out[key].clears += Number(src.clears || 0);
    out[key].timeouts += Number(src.timeouts || 0);
    out[key].mistakes += Number(src.mistakes || 0);
    out[key].correct_hits += Number(src.correctHits || 0);
    out[key].wrong_hits += Number(src.wrongHits || 0);
    out[key].tips += Number(src.tips || 0);
  });

  return out;
}