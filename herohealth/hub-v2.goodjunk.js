/* =========================================================
   HeroHealth Hub v2 GoodJunk Widget
   PATCH v20260411a-hub-clean
   ========================================================= */
(function (W, D) {
  'use strict';

  const SNAPSHOT_KEY = 'HHA_GJ_HUB_SNAPSHOT';

  function safeParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function readSnapshot() {
    try {
      const raw = W.localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      return safeParse(raw, null);
    } catch (_) {
      return null;
    }
  }

  function clearSnapshot() {
    try {
      W.localStorage.removeItem(SNAPSHOT_KEY);
    } catch (_) {}
  }

  function byId(id) {
    return D.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = String(value ?? '');
  }

  function setWidth(id, valuePct) {
    const el = byId(id);
    if (!el) return;
    const n = Number(valuePct || 0);
    const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
    el.style.width = pct + '%';
  }

  function show(id) {
    const el = byId(id);
    if (el) el.hidden = false;
  }

  function hide(id) {
    const el = byId(id);
    if (el) el.hidden = true;
  }

  function clearChildren(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function makeChip(text) {
    const chip = D.createElement('span');
    chip.className = 'gj-chip';
    chip.textContent = text;
    return chip;
  }

  function normalizeRecentList(snapshot) {
    const recent = Array.isArray(snapshot?.archive?.recent)
      ? snapshot.archive.recent
      : [];

    return recent
      .filter(Boolean)
      .map((item) => {
        const group = String(item?.group || '').trim();
        const label = String(item?.label || '').trim();
        return { group, label };
      })
      .filter((item) => item.group || item.label);
  }

  function renderRecentChips(snapshot) {
    const box = byId('gjRecentChips');
    if (!box) return;

    clearChildren(box);

    const items = normalizeRecentList(snapshot).slice(0, 8);
    if (!items.length) {
      box.appendChild(makeChip('ยังไม่มี collection ล่าสุด'));
      return;
    }

    items.forEach((item) => {
      const label = item.group && item.label
        ? `${item.group}: ${item.label}`
        : (item.label || item.group || '-');
      box.appendChild(makeChip(label));
    });
  }

  function renderPlanChips() {
    const box = byId('gjNextPlanChips');
    if (!box) return;

    clearChildren(box);
    box.appendChild(makeChip('Zone First'));
    box.appendChild(makeChip('Then Game'));
    box.appendChild(makeChip('Then Mode'));
  }

  function renderFeaturedBits(snapshot) {
    const targetLabel = String(snapshot?.target?.label || '').trim();
    const recentItems = normalizeRecentList(snapshot);

    if (targetLabel) {
      setText('nutriFeatured', targetLabel);
    }

    if (recentItems.length) {
      show('nutriRecentPill');
      setText('nutriRecentText', recentItems[0].label || recentItems[0].group || '-');
    } else {
      hide('nutriRecentPill');
      setText('nutriRecentText', '-');
    }
  }

  function renderTodayHint(snapshot) {
    const next = byId('todayNextGame');
    if (!next) return;

    const targetLabel = String(snapshot?.target?.label || '').trim();
    next.textContent = targetLabel ? `ไป Nutrition Zone • ${targetLabel}` : 'เข้า Nutrition Zone';
  }

  function renderCard(snapshot) {
    const pctRaw = Number(snapshot?.archive?.completionPct || 0);
    const pct = Number.isFinite(pctRaw) ? Math.max(0, Math.min(100, pctRaw)) : 0;

    const hallRank = String(snapshot?.archive?.hallRank || 'Rookie');
    const rewardTitle = String(snapshot?.reward?.title || 'ยังไม่มี reward ล่าสุด');
    const rewardBadge = String(snapshot?.reward?.badge || '📚');
    const rivalLabel = String(snapshot?.rivalry?.label || '-');
    const deckTier = String(snapshot?.rivalry?.deckTier || '-');
    const targetLabel = String(snapshot?.target?.label || '-');
    const nextReason = String(
      snapshot?.nextPlan?.reason || 'เข้า Nutrition Zone แล้วค่อยเลือกเกมและโหมด'
    );

    setText('gjArchiveBadge', `📚 ${hallRank}`);
    setText('gjArchiveReward', `${rewardBadge} ${rewardTitle}`);
    setText('gjArchivePct', `${pct}%`);
    setText('gjHallRank', hallRank);
    setText('gjRivalArc', rivalLabel);
    setText('gjDeckTier', deckTier);
    setText('gjArchiveTarget', targetLabel || '-');
    setText('gjNextPlanTitle', 'Open Nutrition Zone');
    setText('gjNextPlanReason', nextReason);

    setWidth('gjArchiveFill', pct);
    renderPlanChips();
    renderRecentChips(snapshot);
    renderFeaturedBits(snapshot);
    renderTodayHint(snapshot);
  }

  function patchActionLinks() {
    if (!W.HHHubRoutes) return;

    const nutritionUrl = W.HHHubRoutes.buildZoneUrl('nutrition');
    W.HHHubRoutes.patchAnchorHref('gjQuickRematchBtn', nutritionUrl);
    W.HHHubRoutes.patchAnchorHref('gjOpenLauncherBtn', nutritionUrl);
    W.HHHubRoutes.patchAnchorHref('btnPlayNutrition', nutritionUrl);
  }

  function render() {
    patchActionLinks();
    renderCard(readSnapshot());
  }

  function bindOpenNutritionButton(id) {
    const el = byId(id);
    if (!el || el.__hhBound) return;

    el.__hhBound = true;
    el.addEventListener('click', function () {
      if (W.HHHubRoutes) {
        W.HHHubRoutes.setLastZone('nutrition');
      }
    });
  }

  function bindClearButton() {
    const clearBtn = byId('gjClearSnapshotBtn');
    if (!clearBtn || clearBtn.__hhBound) return;

    clearBtn.__hhBound = true;
    clearBtn.addEventListener('click', function () {
      clearSnapshot();
      render();
    });
  }

  function bind() {
    bindOpenNutritionButton('gjQuickRematchBtn');
    bindOpenNutritionButton('gjOpenLauncherBtn');
    bindClearButton();
  }

  function getDebugState() {
    const snapshot = readSnapshot();
    return {
      key: SNAPSHOT_KEY,
      hasSnapshot: !!snapshot,
      snapshot
    };
  }

  W.HHHubGoodJunk = {
    readSnapshot,
    clearSnapshot,
    render,
    bind,
    getDebugState
  };
})(window, document);
