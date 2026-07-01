/* =========================================================
   EAP Learning Analytics Dashboard v6
   EAP Hero + EAP Word Quest • Section 122

   REPLACE the contents of EAP_TeacherDashboard.gs with this file.
   Keep Code.gs, EAPHero.gs, EAPWordQuest.gs and EAP_IdentityMap.gs.

   v6 changes
   - Word Quest history is sorted newest first.
   - Every attempt is tagged Latest, Best, or Latest + Best per learner/session.
   - Dashboard averages use best evidence per session, not every replay.
   - Individual evidence keeps the full history without hiding failed attempts.
========================================================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('EAP Analytics')
    .addItem('เปิด Learning Analytics Dashboard', 'showEapTeacherDashboard')
    .addToUi();
}

function showEapTeacherDashboard() {
  const html = HtmlService
    .createHtmlOutputFromFile('EAP_DashboardTeacher')
    .setWidth(1440)
    .setHeight(860);

  SpreadsheetApp.getUi().showModelessDialog(
    html,
    'EAP Learning Analytics Dashboard'
  );
}

function eapTeacherDashboardPage_() {
  return HtmlService
    .createHtmlOutputFromFile('EAP_DashboardTeacher')
    .setTitle('EAP Learning Analytics Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function eapTeacherDashboardJson_(params) {
  return ContentService
    .createTextOutput(JSON.stringify(eapTeacherDashboardData(params || {})))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   MAIN DATA API
========================================================= */

function eapTeacherDashboardData(filters) {
  filters = filters || {};

  const section = text_(filters.section, EAP_CONFIG.DEFAULT_SECTION);
  const query = text_(filters.query || filters.q, '').toLowerCase();
  const wantedStatus = text_(filters.status, '');

  const heroRecords = eapHeroAnalyticsRows_(section);
  const wordRecords = eapWordAnalyticsRows_(section);
  const allLearners = eapBuildLearners_(heroRecords, wordRecords, section);

  let learners = allLearners.slice();

  if (query) {
    learners = learners.filter(function(learner) {
      return [
        learner.studentId,
        learner.studentName,
        learner.section
      ].join(' ').toLowerCase().includes(query);
    });
  }

  if (wantedStatus) {
    learners = learners.filter(function(learner) {
      return learner.status === wantedStatus;
    });
  }

  learners.sort(function(a, b) {
    return String(a.studentName).localeCompare(String(b.studentName)) ||
      String(a.studentId).localeCompare(String(b.studentId));
  });

  const bestWordEvidence = wordRecords.filter(function(record) {
    return record.isBestAttempt;
  });

  const latestWordEvidence = wordRecords.filter(function(record) {
    return record.isLatestAttempt;
  });

  return {
    ok: true,
    version: 'v6.0-LATEST-BEST-EVIDENCE-122',
    section: section,
    generatedAt: now_().iso,

    overview: {
      learners: allLearners.length,
      heroRecords: heroRecords.length,
      wordQuestRecords: wordRecords.length,
      wordQuestUniqueSessions: bestWordEvidence.length,

      heroAverage: eapAverageOrNull_(
        heroRecords
          .filter(function(record) { return !record.legacyCompletion; })
          .map(function(record) { return record.bestScore; })
      ),

      wordQuestAccuracyAverage: eapAverageOrNull_(
        bestWordEvidence
          .filter(function(record) { return record.accuracy !== null; })
          .map(function(record) { return record.accuracy; })
      ),

      wordQuestLatestAccuracyAverage: eapAverageOrNull_(
        latestWordEvidence
          .filter(function(record) { return record.accuracy !== null; })
          .map(function(record) { return record.accuracy; })
      ),

      needsSupport: allLearners.filter(function(learner) {
        return learner.status === 'review';
      }).length
    },

    learners: learners
  };
}

/* =========================================================
   EAP HERO DATA
========================================================= */

function eapHeroAnalyticsRows_(section) {
  const rows = sh_('summary')
    .getDataRange()
    .getValues()
    .slice(1)
    .map(function(row) {
      return rowObject_(H.summary, row);
    })
    .filter(function(row) {
      return text_(row.section) === section;
    });

  return rows.map(function(row) {
    const identity = eapResolveIdentity_(
      'hero',
      row.studentId,
      row.studentName,
      section
    );

    return {
      source: 'hero',
      studentId: identity.studentId,
      studentName: identity.studentName,
      section: section,
      sessionId: eapNormalizeHeroSession_(row.sessionId),
      sessionTitle: text_(row.sessionTitle),
      skill: text_(row.skill),
      bestScore: number_(row.bestScore, 0),
      bestAccuracy: number_(row.bestAccuracy, 0),
      passed: text_(row.passed).toUpperCase() === 'TRUE',
      legacyCompletion: text_(row.legacyCompletion).toUpperCase() === 'TRUE',
      attempts: number_(row.attempts, 0),
      reviewFlag: text_(row.reviewFlag)
    };
  });
}

/* =========================================================
   EAP WORD QUEST DATA
   Raw attempts are retained so the teacher can see history.
========================================================= */

function eapWordAnalyticsRows_(section) {
  try {
    if (typeof eapwqReadAttempts_ !== 'function') {
      return [];
    }

    const rows = eapwqReadAttempts_(section);

    const records = rows.map(function(row, index) {
      const identity = eapResolveIdentity_(
        'wordquest',
        row.studentId,
        row.studentName,
        section
      );

      const rawAccuracy = number_(row.accuracy, -1);

      return {
        source: 'wordquest',
        recordKey: text_(row.fingerprint || row.attemptId || ('word-' + index)),
        fingerprint: text_(row.fingerprint),
        attemptId: text_(row.attemptId),
        studentId: identity.studentId,
        studentName: identity.studentName,
        section: section,
        sessionId: text_(row.sessionId).toUpperCase(),
        sessionTitle: text_(row.sessionTitle),
        sessionType: text_(row.sessionType),
        accuracy: rawAccuracy >= 0 ? rawAccuracy : null,
        score: number_(row.score, 0),
        xp: number_(row.xp, 0),
        passed: bool_(row.passed),
        attempts: number_(row.attempt, 1),
        weakWords: Array.isArray(row.weakWords) ? row.weakWords : [],
        playedAt: text_(row.playedAt),
        aiPrediction: text_(row.aiPrediction),
        aiDifficulty: text_(row.aiDifficulty),
        hintUsed: number_(row.hintUsed, 0),
        isLatestAttempt: false,
        isBestAttempt: false,
        sessionAttemptCount: 1,
        evidenceLabel: ''
      };
    });

    return eapAnnotateWordEvidence_(records);
  } catch (error) {
    return [];
  }
}

/* =========================================================
   WORD QUEST EVIDENCE MODEL
   Latest = most recently played record per learner/session.
   Best = highest accuracy, then score, then latest timestamp.
========================================================= */

function eapAnnotateWordEvidence_(records) {
  const groups = {};

  records.forEach(function(record) {
    const key = [record.studentId, record.sessionId].join('|');
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
  });

  Object.keys(groups).forEach(function(key) {
    const attempts = groups[key];

    attempts.forEach(function(record) {
      record.sessionAttemptCount = attempts.length;
    });

    const latest = attempts.slice().sort(eapCompareWordByTimeDesc_)[0];
    const best = attempts.slice().sort(eapCompareWordBestDesc_)[0];

    if (latest) {
      latest.isLatestAttempt = true;
    }

    if (best) {
      best.isBestAttempt = true;
    }

    attempts.forEach(function(record) {
      const labels = [];
      if (record.isLatestAttempt) labels.push('Latest');
      if (record.isBestAttempt) labels.push('Best');
      record.evidenceLabel = labels.join(' + ');
    });
  });

  return records.sort(eapCompareWordByTimeDesc_);
}

function eapCompareWordByTimeDesc_(a, b) {
  const timeDiff = eapWordTimeMs_(b.playedAt) - eapWordTimeMs_(a.playedAt);
  if (timeDiff !== 0) return timeDiff;

  if (a.isLatestAttempt !== b.isLatestAttempt) {
    return a.isLatestAttempt ? -1 : 1;
  }

  return String(a.studentName).localeCompare(String(b.studentName)) ||
    String(a.sessionId).localeCompare(String(b.sessionId));
}

function eapCompareWordBestDesc_(a, b) {
  const accuracyDiff = eapComparableAccuracy_(b.accuracy) - eapComparableAccuracy_(a.accuracy);
  if (accuracyDiff !== 0) return accuracyDiff;

  const scoreDiff = number_(b.score, 0) - number_(a.score, 0);
  if (scoreDiff !== 0) return scoreDiff;

  return eapWordTimeMs_(b.playedAt) - eapWordTimeMs_(a.playedAt);
}

function eapComparableAccuracy_(value) {
  return value === null || value === undefined ? -1 : number_(value, -1);
}

function eapWordTimeMs_(value) {
  const parsed = new Date(text_(value)).getTime();
  return isFinite(parsed) ? parsed : 0;
}

/* =========================================================
   IDENTITY MAP
========================================================= */

function eapResolveIdentity_(source, studentId, studentName, section) {
  try {
    if (typeof eapCanonicalIdentity_ === 'function') {
      return eapCanonicalIdentity_(source, studentId, studentName, section);
    }
  } catch (error) {
    // Keep original identity when an optional map is unavailable.
  }

  return {
    studentId: text_(studentId),
    studentName: text_(studentName, 'Unknown')
  };
}

/* =========================================================
   UNIFIED LEARNER MODEL
========================================================= */

function eapBuildLearners_(heroRecords, wordRecords, section) {
  const map = {};

  function ensure(studentId, studentName) {
    const id = text_(studentId);
    if (!id) return null;

    if (!map[id]) {
      map[id] = {
        studentId: id,
        studentName: text_(studentName, 'Unknown'),
        section: section,
        hero: {
          records: [],
          avgScore: null,
          recordedThrough: '—',
          bossPasses: []
        },
        wordQuest: {
          records: [],
          avgAccuracy: null,
          avgLatestAccuracy: null,
          avgScore: null,
          weakWords: [],
          bossPasses: [],
          uniqueSessions: 0,
          latestPlayedAt: '',
          latestRecord: null
        },
        status: 'active'
      };
    }

    if (studentName && map[id].studentName === 'Unknown') {
      map[id].studentName = text_(studentName);
    }

    return map[id];
  }

  heroRecords.forEach(function(record) {
    const learner = ensure(record.studentId, record.studentName);
    if (!learner) return;

    learner.hero.records.push(record);
    if (record.passed && eapIsBoss_(record.sessionId)) {
      learner.hero.bossPasses.push(record.sessionId);
    }
  });

  wordRecords.forEach(function(record) {
    const learner = ensure(record.studentId, record.studentName);
    if (!learner) return;

    learner.wordQuest.records.push(record);
    if (record.passed && eapIsBoss_(record.sessionId)) {
      learner.wordQuest.bossPasses.push(record.sessionId);
    }
  });

  return Object.keys(map).map(function(studentId) {
    const learner = map[studentId];

    learner.hero.records.sort(function(a, b) {
      return String(a.sessionId).localeCompare(String(b.sessionId));
    });

    learner.wordQuest.records.sort(eapCompareWordByTimeDesc_);

    const heroReal = learner.hero.records.filter(function(record) {
      return !record.legacyCompletion;
    });

    learner.hero.avgScore = eapAverageOrNull_(
      heroReal.map(function(record) { return record.bestScore; })
    );

    learner.hero.recordedThrough = eapLatestSession_(
      learner.hero.records.map(function(record) { return record.sessionId; })
    );

    learner.hero.bossPasses = eapSortBosses_(learner.hero.bossPasses);

    const bestEvidence = learner.wordQuest.records.filter(function(record) {
      return record.isBestAttempt;
    });

    const latestEvidence = learner.wordQuest.records.filter(function(record) {
      return record.isLatestAttempt;
    });

    learner.wordQuest.uniqueSessions = latestEvidence.length;
    learner.wordQuest.avgAccuracy = eapAverageOrNull_(
      bestEvidence
        .filter(function(record) { return record.accuracy !== null; })
        .map(function(record) { return record.accuracy; })
    );

    learner.wordQuest.avgLatestAccuracy = eapAverageOrNull_(
      latestEvidence
        .filter(function(record) { return record.accuracy !== null; })
        .map(function(record) { return record.accuracy; })
    );

    learner.wordQuest.avgScore = eapAverageOrNull_(
      bestEvidence.map(function(record) { return record.score; })
    );

    learner.wordQuest.latestRecord = learner.wordQuest.records[0] || null;
    learner.wordQuest.latestPlayedAt = learner.wordQuest.latestRecord
      ? learner.wordQuest.latestRecord.playedAt
      : '';

    learner.wordQuest.bossPasses = eapSortBosses_(learner.wordQuest.bossPasses);

    learner.wordQuest.weakWords = eapTopWords_(
      latestEvidence.reduce(function(words, record) {
        return words.concat(record.weakWords || []);
      }, []),
      5
    );

    const heroNeedsSupport = learner.hero.records.some(function(record) {
      return record.reviewFlag === 'needs_support';
    });

    const wordNeedsSupport = latestEvidence.some(function(record) {
      return record.accuracy !== null &&
        record.accuracy < 60 &&
        !record.isBestAttempt &&
        record.sessionAttemptCount >= 2;
    }) || latestEvidence.some(function(record) {
      const sessionAttempts = learner.wordQuest.records.filter(function(candidate) {
        return candidate.sessionId === record.sessionId;
      });
      const best = sessionAttempts.filter(function(candidate) {
        return candidate.isBestAttempt;
      })[0];
      return record.accuracy !== null && record.accuracy < 60 &&
        best && best.accuracy !== null && best.accuracy < 60 &&
        record.sessionAttemptCount >= 2;
    });

    learner.status = heroNeedsSupport || wordNeedsSupport ? 'review' : 'active';

    return learner;
  });
}

/* =========================================================
   STUDENT DETAIL
========================================================= */

function eapTeacherStudentDetail(studentId) {
  const id = text_(studentId);
  const data = eapTeacherDashboardData({
    section: EAP_CONFIG.DEFAULT_SECTION
  });

  const learner = data.learners.filter(function(item) {
    return item.studentId === id;
  })[0];

  if (!learner) {
    return { ok: false, error: 'Student not found' };
  }

  return { ok: true, learner: learner };
}

/* =========================================================
   HELPERS
========================================================= */

function eapNormalizeHeroSession_(value) {
  const raw = text_(value).toUpperCase();
  return /^\d+$/.test(raw) ? 'S' + raw : raw;
}

function eapIsBoss_(sessionId) {
  return /^(B[1-5]|BG[1-5])$/.test(text_(sessionId).toUpperCase());
}

function eapSortBosses_(items) {
  const order = ['B1','B2','B3','B4','B5','BG1','BG2','BG3','BG4','BG5'];
  return eapUnique_(items).sort(function(a, b) {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
}

function eapLatestSession_(sessions) {
  const order = [
    'S1','S2','S3','B1',
    'S4','S5','S6','B2',
    'S7','S8','S9','B3',
    'S10','S11','S12','B4',
    'S13','S14','S15','B5',
    'BG1','BG2','BG3','BG4','BG5'
  ];

  const unique = eapUnique_(sessions);
  if (!unique.length) return '—';

  unique.sort(function(a, b) {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });

  return unique[unique.length - 1];
}

function eapAverage_(values) {
  if (!values || !values.length) return 0;
  const sum = values.reduce(function(total, value) {
    return total + number_(value, 0);
  }, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

function eapAverageOrNull_(values) {
  return values && values.length ? eapAverage_(values) : null;
}

function eapUnique_(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function eapTopWords_(words, limit) {
  const counts = {};
  (words || []).forEach(function(word) {
    const clean = text_(word).toLowerCase();
    if (clean) counts[clean] = (counts[clean] || 0) + 1;
  });

  return Object.keys(counts)
    .sort(function(a, b) {
      return counts[b] - counts[a] || a.localeCompare(b);
    })
    .slice(0, Math.max(1, number_(limit, 5)));
}
