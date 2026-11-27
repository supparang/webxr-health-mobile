import {
  AGE_GOAL_PROFILES,
  ALLERGEN_LABELS,
  DISH_CATEGORIES,
  FOOD_GROUP_LABELS,
  MEAL_TYPES,
  PACKAGED_BARCODE_CATALOG,
  PROVENANCE,
  THAI_FOOD_CATALOG,
  UNKNOWN_DISH_ID,
  buildMealRecord,
  clampPortionMultiplier,
  demoClassifyImage,
  detectTrayAllergens,
  evaluateGdaLabel,
  getDishById,
  getLocalDateKey,
  lookupBarcodeFixture,
  recordsToCsv,
  resolveGoalProfile,
  scaleComboNutrition,
  searchDishes,
  summarizeDailyRecords,
  summarizeSevenDayTrend,
  updateMealRecord,
} from './nutrition.js';
import {
  EXPERIMENT_ARMS,
  applyClarificationAdjustments,
  getDishUncertaintyMeta,
  normalizeArm,
  parseExperimentParams,
  researchTrialsToCsv,
  selectClarificationQuestions,
  summarizeExperimentByArm,
} from './experiment.js';
import {
  ABC_BENCHMARK_CASES,
  BENCHMARK_STRATA,
  evaluateTrialAgainstBenchmark,
  getBenchmarkById,
  summarizeBenchmarkByArm,
} from './benchmark.js';
import { APP_CONFIG } from './config.js';

const STORAGE_KEY = 'nutrilens_th_meal_history_v1';
const PROFILE_STORAGE_KEY = 'nutrilens_th_profile_v1';
const STUDY_STORAGE_KEY = 'nutrilens_th_study_v1';

const MAX_RAW_UPLOAD_BYTES = 25 * 1024 * 1024; // Accept large mobile photos and auto-compress
const MAX_FINAL_BYTES = 5 * 1024 * 1024;
const COMPRESS_TRIGGER_BYTES = 1200 * 1024;
const MAX_IMAGE_DIMENSION = 1280;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const OUTCOME_LABELS = Object.freeze({
  matched: 'พบเมนูที่ตรงกัน',
  uncertain: 'ไม่แน่ใจ — กรุณาค้นหาหรือเลือกเมนูเอง',
  not_food: 'ไม่พบอาหารในภาพนี้',
});

const LEVEL_LABELS = Object.freeze({
  low: 'อยู่ในเกณฑ์ดี',
  moderate: 'ปานกลาง',
  high: 'ค่อนข้างสูง',
});

const TREND_METRICS = Object.freeze({
  kcal: { label: 'พลังงาน (kcal)', unit: 'kcal' },
  sodiumMg: { label: 'โซเดียม (มก.)', unit: 'มก.' },
  proteinG: { label: 'โปรตีน (ก.)', unit: 'ก.' },
  totalCount: { label: 'จำนวนมื้อ', unit: 'มื้อ' },
});

function normalizeApiBase(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : '';
}

function loadInitialStudyConfig() {
  const urlParams = parseExperimentParams(window.location.search);
  let saved = {};
  try {
    const raw = window.localStorage.getItem(STUDY_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw) || {};
  } catch {
    saved = {};
  }
  return {
    arm: urlParams.arm || normalizeArm(saved.arm || 'B'),
    participantId: urlParams.participantId || saved.participantId || '',
    sessionId: urlParams.sessionId || saved.sessionId || '',
    studyAccessCode: urlParams.accessCode || saved.studyAccessCode || '',
    remoteApiBase:
      urlParams.apiBase ||
      normalizeApiBase(saved.remoteApiBase) ||
      normalizeApiBase(APP_CONFIG.DEFAULT_AI_API_BASE),
    armLocked: Boolean(urlParams.locked),
  };
}

const initialStudy = loadInitialStudyConfig();

const state = {
  mode: 'demo', // 'demo' | 'ai'
  captureTab: 'photo', // 'photo' | 'gda' | 'benchmark'
  arm: initialStudy.arm, // 'A' | 'B' | 'C'
  participantId: initialStudy.participantId,
  sessionId: initialStudy.sessionId,
  studyAccessCode: initialStudy.studyAccessCode,
  remoteApiBase: initialStudy.remoteApiBase,
  armLocked: initialStudy.armLocked,
  activeBenchmarkId: null,
  activeQuestions: [],
  clarificationAnswers: {},
  trialTiming: {
    scanStartedAt: 0,
    resultReadyAt: 0,
    tapCount: 0,
    initialFoodId: UNKNOWN_DISH_ID,
    portionUncertainty: 'medium',
  },
  perceivedEase: null,
  perceivedConfidence: null,
  serverHealth: {
    reachable: false,
    aiConfigured: false,
    provider: '',
    model: '',
    accessCodeRequired: false,
  },
  profileSettings: loadProfileSettings(),
  selectedImage: null, // { dataUrl, filename, presetId, sizeBytes, compressionNote, benchmarkId }
  scanning: false,
  scanResult: null,
  dishSearchQuery: '',
  dishCategory: 'all',
  // Multi-dish tray: index 0 is primary scanned/selected dish
  trayItems: [], // [{ uid, foodId, customFoodName, portionMultiplier }]
  selectedMealType: inferDefaultMealType(),
  gdaFromFixture: false,
  filterMealType: 'all',
  trendMetric: 'kcal',
  editingRecordId: null,
  history: loadHistory(),
  barcodeStream: null,
  barcodeLoopActive: false,
  deferredInstallPrompt: null,
};

const els = {
  modeDemoBtn: document.getElementById('modeDemoBtn'),
  modeAiBtn: document.getElementById('modeAiBtn'),
  serverStatusPill: document.getElementById('serverStatusPill'),
  installPwaBtn: document.getElementById('installPwaBtn'),
  modeNotice: document.getElementById('modeNotice'),

  armBtns: Array.from(document.querySelectorAll('.arm-btn')),
  toggleStudyMetaBtn: document.getElementById('toggleStudyMetaBtn'),
  studyMetaDrawer: document.getElementById('studyMetaDrawer'),
  armDescriptionText: document.getElementById('armDescriptionText'),
  participantIdInput: document.getElementById('participantIdInput'),
  sessionIdInput: document.getElementById('sessionIdInput'),
  studyAccessCodeInput: document.getElementById('studyAccessCodeInput'),
  remoteApiUrlInput: document.getElementById('remoteApiUrlInput'),
  copyLinkBtns: Array.from(document.querySelectorAll('[data-copy-arm]')),
  copyLinkFeedback: document.getElementById('copyLinkFeedback'),

  profileSummaryTitle: document.getElementById('profileSummaryTitle'),
  profileSummaryMeta: document.getElementById('profileSummaryMeta'),
  profileAllergenSummary: document.getElementById('profileAllergenSummary'),
  toggleProfileBtn: document.getElementById('toggleProfileBtn'),
  profileDrawer: document.getElementById('profileDrawer'),
  ageProfileChips: document.getElementById('ageProfileChips'),
  customGoalGrid: document.getElementById('customGoalGrid'),
  customKcalInput: document.getElementById('customKcalInput'),
  customProteinInput: document.getElementById('customProteinInput'),
  customSodiumInput: document.getElementById('customSodiumInput'),
  customSugarInput: document.getElementById('customSugarInput'),
  focusLowSodium: document.getElementById('focusLowSodium'),
  focusLowSugar: document.getElementById('focusLowSugar'),
  focusHighProtein: document.getElementById('focusHighProtein'),
  allergenCheckGrid: document.getElementById('allergenCheckGrid'),

  tabPhotoBtn: document.getElementById('tabPhotoBtn'),
  tabGdaBtn: document.getElementById('tabGdaBtn'),
  tabBenchmarkBtn: document.getElementById('tabBenchmarkBtn'),
  photoPane: document.getElementById('photoPane'),
  gdaPane: document.getElementById('gdaPane'),
  benchmarkPane: document.getElementById('benchmarkPane'),
  benchmarkSelectedBanner: document.getElementById('benchmarkSelectedBanner'),
  runBenchmarkScanBtn: document.getElementById('runBenchmarkScanBtn'),
  benchmarkGrid: document.getElementById('benchmarkGrid'),

  dropzone: document.getElementById('dropzone'),
  emptyStage: document.getElementById('emptyStage'),
  previewImage: document.getElementById('previewImage'),
  previewCaption: document.getElementById('previewCaption'),
  previewMetaChip: document.getElementById('previewMetaChip'),
  compressionBadge: document.getElementById('compressionBadge'),
  scanOverlay: document.getElementById('scanOverlay'),
  clearImageBtn: document.getElementById('clearImageBtn'),

  cameraInput: document.getElementById('cameraInput'),
  fileInput: document.getElementById('fileInput'),
  cameraBtn: document.getElementById('cameraBtn'),
  uploadBtn: document.getElementById('uploadBtn'),
  scanBtn: document.getElementById('scanBtn'),
  uploadError: document.getElementById('uploadError'),
  sampleGrid: document.getElementById('sampleGrid'),

  barcodeInput: document.getElementById('barcodeInput'),
  lookupBarcodeBtn: document.getElementById('lookupBarcodeBtn'),
  startBarcodeCamBtn: document.getElementById('startBarcodeCamBtn'),
  stopBarcodeCamBtn: document.getElementById('stopBarcodeCamBtn'),
  barcodeCamBox: document.getElementById('barcodeCamBox'),
  barcodeVideo: document.getElementById('barcodeVideo'),
  barcodeFeedback: document.getElementById('barcodeFeedback'),
  barcodeSampleChips: document.getElementById('barcodeSampleChips'),
  gdaCapKcal: document.getElementById('gdaCapKcal'),
  gdaCapKcalPct: document.getElementById('gdaCapKcalPct'),
  gdaCapSugar: document.getElementById('gdaCapSugar'),
  gdaCapSugarPct: document.getElementById('gdaCapSugarPct'),
  gdaCapFat: document.getElementById('gdaCapFat'),
  gdaCapFatPct: document.getElementById('gdaCapFatPct'),
  gdaCapSodium: document.getElementById('gdaCapSodium'),
  gdaCapSodiumPct: document.getElementById('gdaCapSodiumPct'),
  gdaNameInput: document.getElementById('gdaNameInput'),
  gdaKcalInput: document.getElementById('gdaKcalInput'),
  gdaSugarInput: document.getElementById('gdaSugarInput'),
  gdaFatInput: document.getElementById('gdaFatInput'),
  gdaSodiumInput: document.getElementById('gdaSodiumInput'),
  gdaProteinInput: document.getElementById('gdaProteinInput'),
  gdaServingsInput: document.getElementById('gdaServingsInput'),
  saveGdaBtn: document.getElementById('saveGdaBtn'),
  gdaSaveFeedback: document.getElementById('gdaSaveFeedback'),

  provenanceBadge: document.getElementById('provenanceBadge'),
  resultPlaceholder: document.getElementById('resultPlaceholder'),
  resultContent: document.getElementById('resultContent'),
  step2ScenarioBanner: document.getElementById('step2ScenarioBanner'),
  allergenAlert: document.getElementById('allergenAlert'),
  outcomeBanner: document.getElementById('outcomeBanner'),
  outcomeTitle: document.getElementById('outcomeTitle'),
  confidenceTag: document.getElementById('confidenceTag'),
  outcomeReason: document.getElementById('outcomeReason'),
  componentsRow: document.getElementById('componentsRow'),

  clarificationBox: document.getElementById('clarificationBox'),
  clarificationTitle: document.getElementById('clarificationTitle'),
  clarificationCountPill: document.getElementById('clarificationCountPill'),
  clarificationSub: document.getElementById('clarificationSub'),
  questionList: document.getElementById('questionList'),
  adjustmentStrip: document.getElementById('adjustmentStrip'),
  manualEditControls: document.getElementById('manualEditControls'),

  dishSearchInput: document.getElementById('dishSearchInput'),
  dishCategoryChips: document.getElementById('dishCategoryChips'),
  dishSelect: document.getElementById('dishSelect'),
  customDishGroup: document.getElementById('customDishGroup'),
  customDishInput: document.getElementById('customDishInput'),
  portionChips: Array.from(document.querySelectorAll('.portion-chip')),
  portionInput: document.getElementById('portionInput'),
  portionGramsText: document.getElementById('portionGramsText'),

  trayCount: document.getElementById('trayCount'),
  addCompanionToggleBtn: document.getElementById('addCompanionToggleBtn'),
  companionPicker: document.getElementById('companionPicker'),
  companionSelect: document.getElementById('companionSelect'),
  addCompanionBtn: document.getElementById('addCompanionBtn'),
  quickSideBtns: Array.from(document.querySelectorAll('.quick-side-btn')),
  trayList: document.getElementById('trayList'),

  nutritionBlock: document.getElementById('nutritionBlock'),
  kcalValue: document.getElementById('kcalValue'),
  barProtein: document.getElementById('barProtein'),
  barCarbs: document.getElementById('barCarbs'),
  barFat: document.getElementById('barFat'),
  proteinVal: document.getElementById('proteinVal'),
  carbsVal: document.getElementById('carbsVal'),
  fatVal: document.getElementById('fatVal'),
  sodiumVal: document.getElementById('sodiumVal'),
  sodiumLevel: document.getElementById('sodiumLevel'),
  sugarVal: document.getElementById('sugarVal'),
  sugarLevel: document.getElementById('sugarLevel'),
  fiberVal: document.getElementById('fiberVal'),
  foodGroupsRow: document.getElementById('foodGroupsRow'),
  tipsList: document.getElementById('tipsList'),
  swapLine: document.getElementById('swapLine'),
  aiSafetyBox: document.getElementById('aiSafetyBox'),

  mealTypeGroup: document.getElementById('mealTypeGroup'),
  mealNoteInput: document.getElementById('mealNoteInput'),
  easeRatingPills: document.getElementById('easeRatingPills'),
  confRatingPills: document.getElementById('confRatingPills'),
  saveMealBtn: document.getElementById('saveMealBtn'),
  saveFeedback: document.getElementById('saveFeedback'),

  todayDateLabel: document.getElementById('todayDateLabel'),
  dailyKcal: document.getElementById('dailyKcal'),
  dailyKcalBar: document.getElementById('dailyKcalBar'),
  dailyKcalSub: document.getElementById('dailyKcalSub'),
  dailyProtein: document.getElementById('dailyProtein'),
  dailyProteinBar: document.getElementById('dailyProteinBar'),
  dailyProteinSub: document.getElementById('dailyProteinSub'),
  dailySodium: document.getElementById('dailySodium'),
  dailySodiumBar: document.getElementById('dailySodiumBar'),
  dailySodiumSub: document.getElementById('dailySodiumSub'),
  dailyCount: document.getElementById('dailyCount'),
  dailyModeBreakdown: document.getElementById('dailyModeBreakdown'),

  armCompareGrid: document.getElementById('armCompareGrid'),

  trendMetricBtns: Array.from(document.querySelectorAll('.trend-metric-btn')),
  trendSvgWrap: document.getElementById('trendSvgWrap'),

  historyFilterRow: document.getElementById('historyFilterRow'),
  exportResearchCsvBtn: document.getElementById('exportResearchCsvBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  emptyHistory: document.getElementById('emptyHistory'),
  historyList: document.getElementById('historyList'),
};

function inferDefaultMealType() {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history.slice(0, 250)));
  } catch {
    // Keep safely in memory if storage quota exceeded
  }
}

function loadProfileSettings() {
  const fallback = {
    profileId: 'adult',
    customKcal: 2000,
    customProteinG: 50,
    customSodiumMg: 2000,
    customSugarG: 24,
    focusLowSodium: false,
    focusLowSugar: false,
    focusHighProtein: false,
    allergens: [],
  };
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return fallback;
  }
}

function persistProfileSettings() {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(state.profileSettings));
  } catch {
    // Ignore quota errors
  }
}

function activeGoal() {
  return resolveGoalProfile(state.profileSettings);
}

function formatNumber(n) {
  return Number(n).toLocaleString('th-TH');
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatTimeTh(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getMealLabel(mealId) {
  return MEAL_TYPES.find((m) => m.id === mealId)?.labelTh || 'มื้ออาหาร';
}

function makeUid() {
  return `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function showUploadError(message) {
  if (!message) {
    els.uploadError.hidden = true;
    els.uploadError.textContent = '';
    return;
  }
  els.uploadError.textContent = message;
  els.uploadError.hidden = false;
}

function showSaveFeedback(message) {
  if (!message) {
    els.saveFeedback.hidden = true;
    els.saveFeedback.textContent = '';
    return;
  }
  els.saveFeedback.textContent = message;
  els.saveFeedback.hidden = false;
}

function showBarcodeFeedback(message, isError = false) {
  if (!message) {
    els.barcodeFeedback.hidden = true;
    els.barcodeFeedback.textContent = '';
    return;
  }
  els.barcodeFeedback.className = isError ? 'alert alert-error' : 'alert alert-info';
  els.barcodeFeedback.textContent = message;
  els.barcodeFeedback.hidden = false;
}

function showGdaFeedback(message) {
  if (!message) {
    els.gdaSaveFeedback.hidden = true;
    els.gdaSaveFeedback.textContent = '';
    return;
  }
  els.gdaSaveFeedback.textContent = message;
  els.gdaSaveFeedback.hidden = false;
}

/* ---------- Profile & Goal UI ---------- */
function renderProfileControls() {
  const goal = activeGoal();
  els.profileSummaryTitle.textContent = goal.labelTh;
  els.profileSummaryMeta.textContent = `เป้า ${formatNumber(goal.kcal)} kcal • โปรตีน ${goal.proteinG} ก. • โซเดียม ≤ ${formatNumber(goal.sodiumMg)} มก. • น้ำตาล ≤ ${goal.sugarG} ก.`;

  if (goal.allergens.length > 0) {
    els.profileAllergenSummary.hidden = false;
    els.profileAllergenSummary.textContent = `แจ้งเตือนแพ้: ${goal.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')}`;
  } else {
    els.profileAllergenSummary.hidden = true;
  }

  // Age profile chips
  els.ageProfileChips.innerHTML = '';
  const options = [
    ...Object.values(AGE_GOAL_PROFILES),
    { id: 'custom', labelTh: 'กำหนดเป้าหมายเอง' },
  ];
  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.textContent = opt.labelTh;
    btn.dataset.profileId = opt.id;
    btn.setAttribute('aria-pressed', String(state.profileSettings.profileId === opt.id));
    btn.addEventListener('click', () => {
      state.profileSettings.profileId = opt.id;
      persistProfileSettings();
      onProfileChanged();
    });
    els.ageProfileChips.appendChild(btn);
  }

  els.customGoalGrid.hidden = state.profileSettings.profileId !== 'custom';
  els.customKcalInput.value = String(state.profileSettings.customKcal);
  els.customProteinInput.value = String(state.profileSettings.customProteinG);
  els.customSodiumInput.value = String(state.profileSettings.customSodiumMg);
  els.customSugarInput.value = String(state.profileSettings.customSugarG);

  els.focusLowSodium.checked = Boolean(state.profileSettings.focusLowSodium);
  els.focusLowSugar.checked = Boolean(state.profileSettings.focusLowSugar);
  els.focusHighProtein.checked = Boolean(state.profileSettings.focusHighProtein);

  els.allergenCheckGrid.innerHTML = '';
  for (const [key, label] of Object.entries(ALLERGEN_LABELS)) {
    const lbl = document.createElement('label');
    lbl.className = 'check-pill';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.allergen = key;
    input.checked = state.profileSettings.allergens.includes(key);
    input.addEventListener('change', () => {
      const next = new Set(state.profileSettings.allergens);
      if (input.checked) next.add(key);
      else next.delete(key);
      state.profileSettings.allergens = Array.from(next);
      persistProfileSettings();
      onProfileChanged();
    });
    lbl.append(input, document.createTextNode(label));
    els.allergenCheckGrid.appendChild(lbl);
  }
}

function onProfileChanged() {
  renderProfileControls();
  renderGdaPreview();
  renderResultPanel();
  renderDailySummary();
  renderSevenDayChart();
}

/* ---------- Dish Search & Selectors ---------- */
function renderDishCategoryChips() {
  els.dishCategoryChips.innerHTML = '';
  for (const cat of DISH_CATEGORIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.textContent = cat.labelTh;
    btn.dataset.category = cat.id;
    btn.setAttribute('aria-pressed', String(state.dishCategory === cat.id));
    btn.addEventListener('click', () => {
      state.dishCategory = cat.id;
      renderDishCategoryChips();
      renderDishSelectOptions();
    });
    els.dishCategoryChips.appendChild(btn);
  }
}

function renderDishSelectOptions() {
  const matches = searchDishes(state.dishSearchQuery, state.dishCategory);
  const currentPrimaryId = state.trayItems[0]?.foodId || UNKNOWN_DISH_ID;

  els.dishSelect.innerHTML = '';

  // Keep currently selected dish available even if search hides it
  const currentDish = getDishById(currentPrimaryId);
  const list = [...matches];
  if (currentDish && !list.some((d) => d.id === currentDish.id)) {
    list.unshift(currentDish);
  }

  for (const dish of list) {
    const opt = document.createElement('option');
    opt.value = dish.id;
    opt.textContent = `${dish.nameTh} (${dish.categoryTh})`;
    els.dishSelect.appendChild(opt);
  }

  const unknownOpt = document.createElement('option');
  unknownOpt.value = UNKNOWN_DISH_ID;
  unknownOpt.textContent = 'ไม่ทราบเมนู / ระบุชื่อเมนูเอง';
  els.dishSelect.appendChild(unknownOpt);

  els.dishSelect.value = currentPrimaryId;
}

function renderCompanionSelectOptions() {
  els.companionSelect.innerHTML = '';
  for (const dish of THAI_FOOD_CATALOG) {
    const opt = document.createElement('option');
    opt.value = dish.id;
    opt.textContent = `${dish.nameTh} (${dish.servingLabel})`;
    els.companionSelect.appendChild(opt);
  }
  els.companionSelect.value = 'sticky_rice';
}

/* ---------- Sample Cards & Meal Types ---------- */
function renderSampleCards() {
  const samples = THAI_FOOD_CATALOG.filter((dish) => Boolean(dish.sampleImage));
  els.sampleGrid.innerHTML = '';

  for (const dish of samples) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sample-card';
    btn.dataset.presetId = dish.id;
    btn.setAttribute('aria-pressed', 'false');

    const img = document.createElement('img');
    img.className = 'sample-thumb';
    img.src = dish.sampleImage;
    img.alt = dish.nameTh;
    img.loading = 'lazy';

    const meta = document.createElement('div');
    meta.className = 'sample-meta';

    const name = document.createElement('span');
    name.className = 'sample-name';
    name.textContent = dish.nameTh;

    const kcal = document.createElement('span');
    kcal.className = 'sample-kcal';
    kcal.textContent = `~${dish.illustrativeNutrients.kcal} kcal (สาธิต)`;

    meta.append(name, kcal);
    btn.append(img, meta);
    btn.addEventListener('click', () => selectSamplePreset(dish));
    els.sampleGrid.appendChild(btn);
  }
}

function renderMealTypeButtons() {
  els.mealTypeGroup.innerHTML = '';
  for (const meal of MEAL_TYPES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn meal-chip';
    btn.dataset.mealType = meal.id;
    btn.textContent = meal.labelTh;
    btn.setAttribute('aria-pressed', String(state.selectedMealType === meal.id));
    btn.addEventListener('click', () => {
      state.selectedMealType = meal.id;
      for (const chip of els.mealTypeGroup.querySelectorAll('.meal-chip')) {
        chip.setAttribute('aria-pressed', String(chip.dataset.mealType === meal.id));
      }
    });
    els.mealTypeGroup.appendChild(btn);
  }
}

function renderHistoryFilters() {
  els.historyFilterRow.innerHTML = '';
  const items = [{ id: 'all', labelTh: 'ทั้งหมด' }, ...MEAL_TYPES];
  for (const item of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.textContent = item.labelTh;
    btn.setAttribute('aria-pressed', String(state.filterMealType === item.id));
    btn.addEventListener('click', () => {
      state.filterMealType = item.id;
      renderHistoryFilters();
      renderHistoryList();
    });
    els.historyFilterRow.appendChild(btn);
  }
}

/* ---------- Capture Tab, Benchmark Suite & Barcode / Thai GDA ---------- */
function setCaptureTab(tab) {
  state.captureTab = tab === 'gda' ? 'gda' : tab === 'benchmark' ? 'benchmark' : 'photo';
  const isPhoto = state.captureTab === 'photo';
  const isGda = state.captureTab === 'gda';
  const isBench = state.captureTab === 'benchmark';

  els.tabPhotoBtn.setAttribute('aria-selected', String(isPhoto));
  els.tabGdaBtn.setAttribute('aria-selected', String(isGda));
  els.tabBenchmarkBtn.setAttribute('aria-selected', String(isBench));

  els.photoPane.hidden = !isPhoto;
  els.gdaPane.hidden = !isGda;
  els.benchmarkPane.hidden = !isBench;

  if (!isGda) {
    stopBarcodeCamera();
  }
}

function updateBenchmarkPressedStates(activeId) {
  for (const btn of els.benchmarkGrid.querySelectorAll('.benchmark-card')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.benchmarkId === activeId));
  }
}

function renderBenchmarkGrid() {
  els.benchmarkGrid.innerHTML = '';
  for (const bm of ABC_BENCHMARK_CASES) {
    const stratum = BENCHMARK_STRATA[bm.stratum];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'benchmark-card';
    btn.dataset.benchmarkId = bm.id;
    btn.setAttribute('aria-pressed', String(state.activeBenchmarkId === bm.id));

    const img = document.createElement('img');
    img.className = 'sample-thumb';
    img.src = bm.imagePath;
    img.alt = bm.titleTh;
    img.loading = 'lazy';

    const body = document.createElement('div');
    body.className = 'benchmark-card-body';

    const top = document.createElement('div');
    top.className = 'benchmark-card-top';

    const idEl = document.createElement('span');
    idEl.className = 'benchmark-id';
    idEl.textContent = bm.id;

    const badge = document.createElement('span');
    badge.className = 'stratum-badge';
    badge.dataset.stratum = bm.stratum;
    badge.textContent = stratum?.labelTh || bm.stratum;

    top.append(idEl, badge);

    const title = document.createElement('span');
    title.className = 'sample-name';
    title.textContent = bm.titleTh;

    body.append(top, title);
    btn.append(img, body);
    btn.addEventListener('click', () => selectBenchmarkCase(bm));
    els.benchmarkGrid.appendChild(btn);
  }
}

async function selectBenchmarkCase(bm) {
  showUploadError('');
  try {
    const res = await fetch(bm.imagePath);
    if (!res.ok) throw new Error('โหลดภาพ Benchmark ไม่สำเร็จ');
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);

    state.activeBenchmarkId = bm.id;
    setSelectedImage({
      dataUrl,
      filename: `${bm.id.toLowerCase()}.jpg`,
      presetId: bm.demoScanOverride.foodId,
      sizeBytes: blob.size,
      compressionNote: '',
      benchmarkId: bm.id,
    });

    updateBenchmarkPressedStates(bm.id);
    els.benchmarkSelectedBanner.hidden = false;
    els.benchmarkSelectedBanner.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = `${bm.id}: ${bm.titleTh}`;
    const txt = document.createTextNode(bm.scenarioPromptTh);
    els.benchmarkSelectedBanner.append(strong, txt);
    els.runBenchmarkScanBtn.disabled = false;
  } catch {
    showUploadError('ไม่สามารถโหลดภาพ Benchmark ได้ กรุณาลองใหม่');
  }
}

function renderBarcodeSampleChips() {
  els.barcodeSampleChips.innerHTML = '';
  for (const prod of PACKAGED_BARCODE_CATALOG) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.dataset.barcode = prod.barcode;
    btn.textContent = prod.productNameTh.split(' (')[0];
    btn.addEventListener('click', () => applyBarcodeProduct(prod));
    els.barcodeSampleChips.appendChild(btn);
  }
}

function applyBarcodeProduct(prod) {
  state.gdaFromFixture = true;
  els.barcodeInput.value = prod.barcode;
  els.gdaNameInput.value = prod.productNameTh;
  els.gdaKcalInput.value = String(prod.gda.kcal);
  els.gdaSugarInput.value = String(prod.gda.sugarG);
  els.gdaFatInput.value = String(prod.gda.fatG);
  els.gdaSodiumInput.value = String(prod.gda.sodiumMg);
  els.gdaProteinInput.value = String(prod.gda.proteinG);
  els.gdaServingsInput.value = '1';
  showBarcodeFeedback(
    `พบสินค้าตัวอย่าง "${prod.productNameTh}" (ค่าตัวอย่างสาธิต — สามารถแก้ตัวเลขให้ตรงกับฉลากจริงบนซองได้)`
  );
  showGdaFeedback('');
  renderGdaPreview();
}

function lookupBarcodeInput() {
  const code = els.barcodeInput.value.replace(/\D+/g, '');
  if (!code) {
    showBarcodeFeedback('กรุณากรอกตัวเลขบาร์โค้ด หรือเลือกสินค้าตัวอย่างด้านล่าง', true);
    return;
  }
  const found = lookupBarcodeFixture(code);
  if (found) {
    applyBarcodeProduct(found);
  } else {
    state.gdaFromFixture = false;
    showBarcodeFeedback(
      `ไม่พบรหัส ${code} ในคลังตัวอย่าง — กรุณากรอกตัวเลขจากฉลาก GDA หน้าซองด้านล่างได้เลย (จะบันทึกเป็น USER_ENTERED_GDA_LABEL)`
    );
  }
}

async function startBarcodeCamera() {
  showBarcodeFeedback('');
  if (typeof window.BarcodeDetector === 'undefined') {
    showBarcodeFeedback(
      'เบราว์เซอร์นี้ยังไม่รองรับ BarcodeDetector API โดยตรง กรุณาพิมพ์รหัสบาร์โค้ดหรือกรอกค่าจากฉลาก GDA ด้านล่างแทน',
      true
    );
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showBarcodeFeedback('ไม่พบสิทธิ์เข้าถึงกล้องในอุปกรณ์นี้ กรุณากรอกบาร์โค้ดด้วยตนเอง', true);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    state.barcodeStream = stream;
    state.barcodeLoopActive = true;
    els.barcodeVideo.srcObject = stream;
    els.barcodeCamBox.hidden = false;
    await els.barcodeVideo.play();

    const detector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
    });
    showBarcodeFeedback('หันกล้องไปที่บาร์โค้ดบนบรรจุภัณฑ์…');

    const scanFrame = async () => {
      if (!state.barcodeLoopActive) return;
      try {
        const codes = await detector.detect(els.barcodeVideo);
        if (codes.length > 0 && codes[0].rawValue) {
          els.barcodeInput.value = codes[0].rawValue;
          stopBarcodeCamera();
          lookupBarcodeInput();
          return;
        }
      } catch {
        // Keep scanning on transient frame errors
      }
      if (state.barcodeLoopActive) {
        requestAnimationFrame(scanFrame);
      }
    };
    requestAnimationFrame(scanFrame);
  } catch {
    stopBarcodeCamera();
    showBarcodeFeedback('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์กล้องหรือกรอกรหัสบาร์โค้ดเอง', true);
  }
}

function stopBarcodeCamera() {
  state.barcodeLoopActive = false;
  if (state.barcodeStream) {
    for (const track of state.barcodeStream.getTracks()) track.stop();
    state.barcodeStream = null;
  }
  els.barcodeVideo.srcObject = null;
  els.barcodeCamBox.hidden = true;
}

function readGdaFormValues() {
  return {
    productNameTh: els.gdaNameInput.value,
    barcode: els.barcodeInput.value,
    kcal: Number(els.gdaKcalInput.value),
    sugarG: Number(els.gdaSugarInput.value),
    fatG: Number(els.gdaFatInput.value),
    sodiumMg: Number(els.gdaSodiumInput.value),
    proteinG: Number(els.gdaProteinInput.value),
    servingsEaten: Number(els.gdaServingsInput.value),
    fromFixture: state.gdaFromFixture,
  };
}

function renderGdaPreview() {
  const gda = evaluateGdaLabel(readGdaFormValues(), activeGoal());
  els.gdaCapKcal.textContent = `${formatNumber(gda.kcal)} kcal`;
  els.gdaCapKcalPct.textContent = `${gda.rdiPct.kcal}%`;
  els.gdaCapKcalPct.dataset.level = gda.rdiPct.kcal >= 35 ? 'high' : gda.rdiPct.kcal >= 20 ? 'moderate' : 'low';

  els.gdaCapSugar.textContent = `${gda.sugarG} ก.`;
  els.gdaCapSugarPct.textContent = `${gda.rdiPct.sugar}%`;
  els.gdaCapSugarPct.dataset.level = gda.levels.sugar;

  els.gdaCapFat.textContent = `${gda.fatG} ก.`;
  els.gdaCapFatPct.textContent = `${gda.rdiPct.fat}%`;
  els.gdaCapFatPct.dataset.level = gda.levels.fat;

  els.gdaCapSodium.textContent = `${formatNumber(gda.sodiumMg)} มก.`;
  els.gdaCapSodiumPct.textContent = `${gda.rdiPct.sodium}%`;
  els.gdaCapSodiumPct.dataset.level = gda.levels.sodium;
}

function saveGdaMeal() {
  const raw = readGdaFormValues();
  if (!String(raw.productNameTh || '').trim()) {
    showGdaFeedback('กรุณากรอกชื่อสินค้าหรือเลือกสินค้าตัวอย่างก่อนบันทึก');
    els.gdaNameInput.focus();
    return;
  }

  const record = buildMealRecord({
    mode: 'gda',
    gdaData: raw,
    mealType: state.selectedMealType,
    note: raw.barcode ? `บาร์โค้ด ${raw.barcode}` : 'บันทึกจากฉลาก GDA',
  });

  state.history.unshift(record);
  persistHistory();
  renderDailySummary();
  renderSevenDayChart();
  renderHistoryList();
  showGdaFeedback(`บันทึก "${record.foodNameTh}" (${formatNumber(record.nutrients.kcal)} kcal) เรียบร้อยแล้ว`);
}

/* ---------- Mode & Server Health ---------- */
function buildApiUrl(endpointPath) {
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  if (state.remoteApiBase) {
    return `${state.remoteApiBase}${cleanPath}`;
  }
  return `.${cleanPath}`;
}

function updateModeUi() {
  els.modeDemoBtn.setAttribute('aria-pressed', String(state.mode === 'demo'));
  els.modeAiBtn.setAttribute('aria-pressed', String(state.mode === 'ai'));

  if (state.mode === 'ai') {
    if (!state.serverHealth.reachable) {
      els.modeNotice.textContent =
        'โหมด AI Vision ต้องเชื่อมต่อ AI Gateway กลาง (เช่น Cloudflare Worker หรือ npm start) — ตั้งค่า GEMINI_API_KEY เพียงครั้งเดียวที่เซิร์ฟเวอร์แล้วระบุ URL ใน config.js (ดู DEPLOY_GEMINI_WORKER.md) หรือสลับใช้โหมดทดลอง (Demo)';
      els.modeNotice.hidden = false;
    } else if (!state.serverHealth.aiConfigured) {
      els.modeNotice.textContent =
        'เชื่อมต่อเซิร์ฟเวอร์ได้แล้ว แต่ยังไม่ได้ตั้งค่า GEMINI_API_KEY หรือ OPENAI_API_KEY ฝั่งเซิร์ฟเวอร์ — คุณสามารถสลับใช้โหมดทดลอง (Demo) ได้ทันที';
      els.modeNotice.hidden = false;
    } else if (state.serverHealth.accessCodeRequired && !state.studyAccessCode) {
      els.modeNotice.textContent =
        'เซิร์ฟเวอร์เปิดล็อกด้วยรหัสรอบทดลอง (Study Code) — กรุณาเปิด "ตั้งค่างานวิจัย / ลิงก์ A-B-C" แล้วกรอกรหัสรอบทดลอง (ไม่ต้องสมัครสมาชิกหรือ Login)';
      els.modeNotice.hidden = false;
    } else {
      els.modeNotice.hidden = true;
    }
  } else {
    els.modeNotice.hidden = true;
  }

  if (state.scanResult) {
    renderResultPanel();
  }
}

function setMode(nextMode) {
  state.mode = nextMode === 'ai' ? 'ai' : 'demo';
  showUploadError('');
  showSaveFeedback('');
  updateModeUi();
}

async function checkServerHealth() {
  try {
    const res = await fetch(buildApiUrl('/api/health'), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('not ok');
    const data = await res.json();
    if (data && data.ok) {
      const providerName =
        data.provider === 'gemini'
          ? 'Gemini AI'
          : data.provider === 'openai'
            ? 'OpenAI Vision'
            : 'AI Server';
      state.serverHealth = {
        reachable: true,
        aiConfigured: Boolean(data.aiConfigured),
        provider: data.provider || '',
        model: data.model || '',
        accessCodeRequired: Boolean(data.accessCodeRequired),
      };
      els.serverStatusPill.dataset.state = data.aiConfigured ? 'ready' : 'static';
      els.serverStatusPill.textContent = data.aiConfigured
        ? `${providerName} พร้อมใช้งาน`
        : 'Server ทำงาน (ยังไม่มี API Key)';
      updateModeUi();
      return;
    }
  } catch {
    // Static host without configured remote Worker
  }
  state.serverHealth = {
    reachable: false,
    aiConfigured: false,
    provider: '',
    model: '',
    accessCodeRequired: false,
  };
  els.serverStatusPill.dataset.state = 'static';
  els.serverStatusPill.textContent = 'โหมด Static (Demo)';
  updateModeUi();
}

/* ---------- Client-side Image Auto-Compression & Upload ---------- */
function updateSamplePressedStates(activePresetId) {
  for (const btn of els.sampleGrid.querySelectorAll('.sample-card')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.presetId === activePresetId));
  }
}

function setSelectedImage({
  dataUrl,
  filename,
  presetId = null,
  sizeBytes = 0,
  compressionNote = '',
  benchmarkId = null,
}) {
  state.activeBenchmarkId = benchmarkId;
  state.selectedImage = { dataUrl, filename, presetId, sizeBytes, compressionNote, benchmarkId };
  showUploadError('');
  showSaveFeedback('');

  els.previewImage.src = dataUrl;
  els.previewImage.hidden = false;
  els.emptyStage.hidden = true;
  els.previewCaption.hidden = false;
  els.clearImageBtn.hidden = false;
  els.dropzone.classList.add('has-image');

  const sizeLabel = sizeBytes > 0 ? ` • ${formatBytes(sizeBytes)}` : '';
  els.previewMetaChip.textContent = `${filename}${sizeLabel}`;

  if (compressionNote) {
    els.compressionBadge.textContent = compressionNote;
    els.compressionBadge.hidden = false;
  } else {
    els.compressionBadge.hidden = true;
    els.compressionBadge.textContent = '';
  }

  els.scanBtn.disabled = false;
  updateSamplePressedStates(benchmarkId ? null : presetId);
  if (!benchmarkId) {
    updateBenchmarkPressedStates(null);
    els.benchmarkSelectedBanner.hidden = true;
    els.runBenchmarkScanBtn.disabled = true;
  }
}

function clearSelectedImage() {
  state.selectedImage = null;
  state.activeBenchmarkId = null;
  state.scanResult = null;
  state.trayItems = [];
  els.previewImage.src = '';
  els.previewImage.hidden = true;
  els.emptyStage.hidden = false;
  els.previewCaption.hidden = true;
  els.compressionBadge.hidden = true;
  els.clearImageBtn.hidden = true;
  els.dropzone.classList.remove('has-image');
  els.scanBtn.disabled = true;
  els.runBenchmarkScanBtn.disabled = true;
  els.benchmarkSelectedBanner.hidden = true;
  els.step2ScenarioBanner.hidden = true;
  els.fileInput.value = '';
  els.cameraInput.value = '';
  updateSamplePressedStates(null);
  updateBenchmarkPressedStates(null);
  showUploadError('');
  showSaveFeedback('');
  els.resultPlaceholder.hidden = false;
  els.resultContent.hidden = true;
  els.provenanceBadge.hidden = true;
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ภาพได้'));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ไฟล์ภาพเสียหายหรือไม่สามารถเปิดได้'));
    img.src = src;
  });
}

async function prepareUploadImage(file) {
  const rawDataUrl = await blobToDataUrl(file);
  let img;
  try {
    img = await loadImageElement(rawDataUrl);
  } catch {
    if (file.size > MAX_FINAL_BYTES) {
      throw new Error('ไฟล์ภาพมีขนาดเกิน 5 MB และไม่สามารถย่อขนาดได้ กรุณาเลือกไฟล์ JPEG/PNG/WebP ที่สมบูรณ์');
    }
    return { dataUrl: rawDataUrl, sizeBytes: file.size, compressionNote: '' };
  }

  const maxSide = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const needsCompress = file.size > COMPRESS_TRIGGER_BYTES || maxSide > 1600;

  if (!needsCompress) {
    return { dataUrl: rawDataUrl, sizeBytes: file.size, compressionNote: '' };
  }

  const scale = maxSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxSide : 1;
  const targetW = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const targetH = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: rawDataUrl, sizeBytes: file.size, compressionNote: '' };
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
  let compressedBytes = Math.floor(((compressedDataUrl.split(',')[1] || '').length * 3) / 4);

  if (compressedBytes > MAX_FINAL_BYTES) {
    compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
    compressedBytes = Math.floor(((compressedDataUrl.split(',')[1] || '').length * 3) / 4);
  }

  if (compressedBytes > MAX_FINAL_BYTES) {
    throw new Error('ไฟล์ภาพมีขนาดใหญ่เกิน 5 MB แม้หลังย่อขนาดแล้ว กรุณาเลือกภาพที่เล็กลง');
  }

  return {
    dataUrl: compressedDataUrl,
    sizeBytes: compressedBytes,
    compressionNote: `ย่อภาพอัตโนมัติ ${formatBytes(file.size)} → ${formatBytes(compressedBytes)}`,
  };
}

async function selectSamplePreset(dish) {
  showUploadError('');
  try {
    const res = await fetch(dish.sampleImage);
    if (!res.ok) throw new Error('โหลดภาพตัวอย่างไม่สำเร็จ');
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    setSelectedImage({
      dataUrl,
      filename: `${dish.id}.jpg`,
      presetId: dish.id,
      sizeBytes: blob.size,
      compressionNote: '',
    });
  } catch {
    showUploadError('ไม่สามารถโหลดภาพอาหารตัวอย่างได้ กรุณาลองอัปโหลดภาพจากเครื่องแทน');
  }
}

async function handleFileSelection(file) {
  if (!file) return;
  showUploadError('');

  const normalizedType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  if (!ALLOWED_TYPES.has(normalizedType)) {
    showUploadError('รองรับเฉพาะไฟล์ภาพ JPEG, PNG หรือ WebP เท่านั้น');
    return;
  }

  if (file.size === 0) {
    showUploadError('ไฟล์ภาพว่างเปล่า กรุณาเลือกไฟล์ใหม่');
    return;
  }

  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    showUploadError('ไฟล์ภาพต้นฉบับใหญ่เกิน 25 MB กรุณาเลือกไฟล์ที่เล็กลง');
    return;
  }

  try {
    const prepared = await prepareUploadImage(file);
    setSelectedImage({
      dataUrl: prepared.dataUrl,
      filename: file.name || 'food-photo.jpg',
      presetId: null,
      sizeBytes: prepared.sizeBytes,
      compressionNote: prepared.compressionNote,
    });
  } catch (err) {
    showUploadError(err?.message || 'เกิดข้อผิดพลาดขณะอ่านหรือย่อขนาดภาพ กรุณาลองใหม่');
  }
}

/* ---------- 3-Arm Research Study Controls & Clarification Engine ---------- */
function persistStudyConfig() {
  try {
    window.localStorage.setItem(
      STUDY_STORAGE_KEY,
      JSON.stringify({
        arm: state.arm,
        participantId: state.participantId,
        sessionId: state.sessionId,
        studyAccessCode: state.studyAccessCode,
        remoteApiBase: state.remoteApiBase,
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

function renderStudyControls() {
  const armMeta = EXPERIMENT_ARMS[state.arm] || EXPERIMENT_ARMS.B;
  for (const btn of els.armBtns) {
    btn.setAttribute('aria-pressed', String(btn.dataset.arm === state.arm));
    btn.disabled = state.armLocked;
  }
  els.armDescriptionText.textContent = state.armLocked
    ? `${armMeta.titleTh} — ${armMeta.descriptionTh} (ล็อกเงื่อนไขจาก URL)`
    : `${armMeta.titleTh} — ${armMeta.descriptionTh}`;
  els.participantIdInput.value = state.participantId;
  els.sessionIdInput.value = state.sessionId;
  els.studyAccessCodeInput.value = state.studyAccessCode;
  els.remoteApiUrlInput.value = state.remoteApiBase;
}

function setExperimentArm(nextArm) {
  if (state.armLocked) return;
  state.arm = normalizeArm(nextArm);
  persistStudyConfig();
  renderStudyControls();
  if (state.scanResult) {
    state.activeQuestions = selectClarificationQuestions(state.arm, state.scanResult);
    state.clarificationAnswers = {};
    renderResultPanel();
  }
}

function renderRatingPills() {
  const renderRow = (container, currentVal, onPick) => {
    container.innerHTML = '';
    for (let score = 1; score <= 5; score += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rating-pill';
      btn.textContent = String(score);
      btn.dataset.score = String(score);
      btn.setAttribute('aria-pressed', String(currentVal === score));
      btn.addEventListener('click', () => {
        state.trialTiming.tapCount += 1;
        onPick(currentVal === score ? null : score);
        renderRatingPills();
      });
      container.appendChild(btn);
    }
  };

  renderRow(els.easeRatingPills, state.perceivedEase, (v) => {
    state.perceivedEase = v;
  });
  renderRow(els.confRatingPills, state.perceivedConfidence, (v) => {
    state.perceivedConfidence = v;
  });
}

function handleClarificationAnswer(question, value) {
  state.trialTiming.tapCount += 1;
  state.clarificationAnswers[question.id] = value;

  if (question.kind === 'dish' && state.trayItems[0]) {
    state.trayItems[0].foodId = value;
    renderDishSelectOptions();
  } else if (question.kind === 'portion' && state.trayItems[0]) {
    const mult = clampPortionMultiplier(value);
    state.trayItems[0].portionMultiplier = mult;
    els.portionInput.value = String(mult);
  }

  renderResultPanel();
}

function renderClarificationPanel(adjustmentLog, baseKcal, finalKcal) {
  const arm = state.arm;
  const armMeta = EXPERIMENT_ARMS[arm];
  const questions = state.activeQuestions || [];
  const answeredCount = questions.filter((q) => Boolean(state.clarificationAnswers[q.id])).length;

  els.clarificationBox.dataset.arm = arm;
  els.clarificationTitle.textContent = armMeta.titleTh;

  if (arm === 'A') {
    els.clarificationCountPill.textContent = '0 ข้อ (ภาพอย่างเดียว)';
    els.clarificationSub.textContent =
      'ระบบ A ใช้ผลจากภาพถ่ายโดยตรงโดยไม่ถามคำถามยืนยันเพิ่มเติม เพื่อวัดความเร็วและค่าพื้นฐานของภาพถ่ายล้วน';
    els.questionList.innerHTML = '';
    els.adjustmentStrip.hidden = true;
    return;
  }

  if (arm === 'B') {
    els.clarificationCountPill.textContent =
      questions.length === 0
        ? '0 ข้อ (ภาพชัดเจน)'
        : `เลือกถาม ${questions.length} ข้อ (ตอบแล้ว ${answeredCount}/${questions.length})`;
    els.clarificationSub.textContent =
      questions.length === 0
        ? 'ภาพอาหารมีความชัดเจนและไม่มีปัจจัยซ่อนเร้นที่มีความไม่แน่นอนสูง จึงข้ามคำถามยืนยันได้ทันที'
        : 'ระบบ B คัดเฉพาะคำถามที่มีความไม่แน่นอนสูงและส่งผลต่อพลังงาน/โซเดียม/น้ำตาลมากที่สุด';
  } else {
    els.clarificationCountPill.textContent = `ชุดคงที่ ${questions.length} ข้อ (ตอบแล้ว ${answeredCount}/${questions.length})`;
    els.clarificationSub.textContent =
      'ระบบ C ถามชุดคำถามมาตรฐานคงที่ครบทั้ง 5 ข้อทุกมื้อ เพื่อเปรียบเทียบความแม่นยำและภาระผู้ใช้กับระบบ B';
  }

  els.questionList.innerHTML = '';
  for (const q of questions) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.questionId = q.id;

    const prompt = document.createElement('div');
    prompt.className = 'question-prompt';
    prompt.textContent = q.promptTh;

    const why = document.createElement('div');
    why.className = 'question-why';
    why.textContent = q.whyTh;

    const optsRow = document.createElement('div');
    optsRow.className = 'category-row';

    const selectedVal =
      state.clarificationAnswers[q.id] ||
      (q.kind === 'dish' ? state.trayItems[0]?.foodId : '') ||
      (q.kind === 'portion' ? String(state.trayItems[0]?.portionMultiplier || 1) : '');

    for (const opt of q.options || []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.dataset.qId = q.id;
      btn.dataset.qVal = opt.value;
      btn.textContent = opt.labelTh;
      btn.setAttribute('aria-pressed', String(selectedVal === opt.value));
      btn.addEventListener('click', () => handleClarificationAnswer(q, opt.value));
      optsRow.appendChild(btn);
    }

    card.append(prompt, why, optsRow);
    els.questionList.appendChild(card);
  }

  if (adjustmentLog && adjustmentLog.length > 0 && state.scanResult?.mode !== 'ai') {
    els.adjustmentStrip.hidden = false;
    els.adjustmentStrip.textContent = `ปรับค่าตามคำตอบยืนยัน (${formatNumber(baseKcal)} → ${formatNumber(finalKcal)} kcal): ${adjustmentLog.join(' • ')}`;
  } else {
    els.adjustmentStrip.hidden = true;
    els.adjustmentStrip.textContent = '';
  }
}

/* ---------- Scan & Multi-Dish Tray ---------- */
function setScanningState(isScanning) {
  state.scanning = isScanning;
  document.body.dataset.scanning = String(isScanning);
  els.scanOverlay.hidden = !isScanning;
  els.scanBtn.disabled = isScanning || !state.selectedImage;
  els.scanBtn.textContent = isScanning ? 'กำลังวิเคราะห์ภาพ…' : 'สแกนวิเคราะห์อาหาร';
  els.runBenchmarkScanBtn.disabled = isScanning || !state.activeBenchmarkId;
  els.runBenchmarkScanBtn.textContent = isScanning
    ? 'กำลังวิเคราะห์กรณี Benchmark…'
    : 'สแกนทดสอบกรณี Benchmark ที่เลือก';
}

async function runScan() {
  if (!state.selectedImage || state.scanning) return;
  showUploadError('');
  showSaveFeedback('');
  setScanningState(true);

  const scanStartedAt = Date.now();
  const activeBm = getBenchmarkById(state.activeBenchmarkId);

  try {
    if (state.mode === 'ai') {
      const headers = { 'Content-Type': 'application/json' };
      if (state.studyAccessCode) {
        headers['X-Study-Code'] = state.studyAccessCode;
      }

      const response = await fetch(buildApiUrl('/api/analyze'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageDataUrl: state.selectedImage.dataUrl }),
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (อาจกำลังใช้งานบน Static Host)');
      }

      if (!response.ok || !payload.ok) {
        throw new Error(payload.messageTh || `ไม่สามารถวิเคราะห์ผ่าน AI ได้ (HTTP ${response.status})`);
      }

      state.scanResult = {
        mode: 'ai',
        provider: payload.provider || '',
        provenance: payload.provenance || PROVENANCE.AI_CLASSIFICATION_ONLY,
        ...payload.result,
      };
    } else {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const demoRes = activeBm
        ? { ...activeBm.demoScanOverride, provenance: PROVENANCE.ILLUSTRATIVE_DEMO }
        : demoClassifyImage({
            filename: state.selectedImage.filename,
            presetId: state.selectedImage.presetId,
          });
      state.scanResult = {
        mode: 'demo',
        ...demoRes,
      };
    }

    const initialFoodId = state.scanResult.foodId || UNKNOWN_DISH_ID;
    const detectedOpenName =
      initialFoodId === UNKNOWN_DISH_ID && state.scanResult.detectedNameTh
        ? String(state.scanResult.detectedNameTh).trim().slice(0, 80)
        : '';
    const initialPortion = clampPortionMultiplier(
      state.scanResult.suggestedPortionMultiplier || 1
    );
    const meta = getDishUncertaintyMeta(initialFoodId, state.scanResult);

    state.dishSearchQuery = '';
    state.dishCategory = 'all';
    els.dishSearchInput.value = '';
    els.customDishInput.value = detectedOpenName;
    state.trayItems = [
      {
        uid: makeUid(),
        foodId: initialFoodId,
        customFoodName: detectedOpenName,
        portionMultiplier: initialPortion,
      },
    ];

    state.activeQuestions = selectClarificationQuestions(state.arm, state.scanResult);
    state.clarificationAnswers = {};
    state.perceivedEase = null;
    state.perceivedConfidence = null;
    state.trialTiming = {
      scanStartedAt,
      resultReadyAt: Date.now(),
      tapCount: 0,
      initialFoodId,
      portionUncertainty: meta.portionUncertainty,
    };

    renderDishCategoryChips();
    renderDishSelectOptions();
    renderRatingPills();
    els.portionInput.value = String(initialPortion);

    renderResultPanel();
  } catch (err) {
    showUploadError(err?.message || 'เกิดข้อผิดพลาดระหว่างการวิเคราะห์ภาพ');
  } finally {
    setScanningState(false);
  }
}

function addDishToTray(foodId) {
  const dish = getDishById(foodId);
  if (!dish) return;
  state.trialTiming.tapCount += 1;
  state.trayItems.push({
    uid: makeUid(),
    foodId: dish.id,
    customFoodName: '',
    portionMultiplier: 1,
  });
  showSaveFeedback('');
  renderResultPanel();
}

function updateTrayItemPortion(uid, nextMult) {
  const target = state.trayItems.find((it) => it.uid === uid);
  if (!target) return;
  state.trialTiming.tapCount += 1;
  target.portionMultiplier = clampPortionMultiplier(nextMult);
  if (state.trayItems[0]?.uid === uid) {
    els.portionInput.value = String(target.portionMultiplier);
  }
  renderResultPanel();
}

function removeTrayItem(uid) {
  if (state.trayItems.length <= 1) return;
  state.trialTiming.tapCount += 1;
  state.trayItems = state.trayItems.filter((it) => it.uid !== uid);
  renderDishSelectOptions();
  if (state.trayItems[0]) {
    els.portionInput.value = String(state.trayItems[0].portionMultiplier);
  }
  renderResultPanel();
}

function syncPortionButtons(primaryMult) {
  for (const btn of els.portionChips) {
    const val = Number(btn.dataset.portion);
    btn.setAttribute('aria-pressed', String(Math.abs(val - primaryMult) < 0.001));
  }
}

function renderTrayList(activeMode) {
  els.trayCount.textContent = String(state.trayItems.length);
  els.trayList.innerHTML = '';

  state.trayItems.forEach((item, index) => {
    const dish = getDishById(item.foodId);
    const li = document.createElement('li');
    li.className = 'tray-item';

    const info = document.createElement('div');
    info.className = 'tray-item-info';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tray-item-name';
    nameSpan.textContent = dish
      ? dish.nameTh
      : item.customFoodName.trim() || 'เมนูไม่ระบุชื่อ';

    const subSpan = document.createElement('span');
    subSpan.className = 'tray-item-sub';
    if (dish && activeMode !== 'ai') {
      const kcal = Math.round(dish.illustrativeNutrients.kcal * item.portionMultiplier);
      subSpan.textContent = `${index === 0 ? 'เมนูหลัก' : 'เมนูร่วม'} • ${dish.servingLabel} × ${item.portionMultiplier} (~${formatNumber(kcal)} kcal)`;
    } else {
      subSpan.textContent = `${index === 0 ? 'เมนูหลัก' : 'เมนูร่วม'} • สัดส่วน ${item.portionMultiplier}×`;
    }

    info.append(nameSpan, subSpan);

    const controls = document.createElement('div');
    controls.className = 'tray-item-controls';

    const sel = document.createElement('select');
    sel.className = 'tray-portion-select';
    sel.setAttribute('aria-label', `ปริมาณของ ${nameSpan.textContent}`);
    for (const mult of [0.5, 1, 1.5, 2]) {
      const opt = document.createElement('option');
      opt.value = String(mult);
      opt.textContent = `${mult}×`;
      sel.appendChild(opt);
    }
    if (![0.5, 1, 1.5, 2].includes(item.portionMultiplier)) {
      const customOpt = document.createElement('option');
      customOpt.value = String(item.portionMultiplier);
      customOpt.textContent = `${item.portionMultiplier}×`;
      sel.appendChild(customOpt);
    }
    sel.value = String(item.portionMultiplier);
    sel.addEventListener('change', () => updateTrayItemPortion(item.uid, sel.value));

    controls.appendChild(sel);

    if (state.trayItems.length > 1) {
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'btn btn-danger-ghost';
      rmBtn.textContent = 'เอาออก';
      rmBtn.addEventListener('click', () => removeTrayItem(item.uid));
      controls.appendChild(rmBtn);
    }

    li.append(info, controls);
    els.trayList.appendChild(li);
  });
}

function renderResultPanel() {
  if (!state.scanResult || state.trayItems.length === 0) {
    els.resultPlaceholder.hidden = false;
    els.resultContent.hidden = true;
    els.provenanceBadge.hidden = true;
    return;
  }

  els.resultPlaceholder.hidden = true;
  els.resultContent.hidden = false;

  const res = state.scanResult;
  const activeMode = res.mode;
  const goal = activeGoal();
  const primary = state.trayItems[0];
  const primaryDish = getDishById(primary.foodId);

  // Show Benchmark scenario prompt if running a benchmark case
  const activeBm = getBenchmarkById(state.activeBenchmarkId);
  if (activeBm) {
    els.step2ScenarioBanner.hidden = false;
    els.step2ScenarioBanner.innerHTML = '';
    const st = document.createElement('strong');
    st.textContent = `กำลังทดสอบ ${activeBm.id}: ${activeBm.titleTh}`;
    els.step2ScenarioBanner.append(st, document.createTextNode(activeBm.scenarioPromptTh));
  } else {
    els.step2ScenarioBanner.hidden = true;
    els.step2ScenarioBanner.textContent = '';
  }

  // In Arm A (Photo-Only baseline), keep flow strictly photo-only (hide manual edit/tray unless unknown)
  els.manualEditControls.hidden = state.arm === 'A' && Boolean(primaryDish);

  els.provenanceBadge.hidden = false;
  els.provenanceBadge.dataset.mode = activeMode;
  els.provenanceBadge.textContent =
    activeMode === 'ai'
      ? `ระบบ ${state.arm} • AI Classification-Only`
      : `ระบบ ${state.arm} • ค่าตัวอย่างสาธิต`;

  const matchedAllergens = detectTrayAllergens(state.trayItems, goal);
  if (matchedAllergens.length > 0) {
    els.allergenAlert.hidden = false;
    els.allergenAlert.textContent = `คำเตือนสารก่อภูมิแพ้: ชุดมื้อนี้อาจมี ${matchedAllergens
      .map((a) => ALLERGEN_LABELS[a])
      .join(', ')} กรุณาตรวจสอบส่วนผสมจริงก่อนรับประทาน`;
  } else {
    els.allergenAlert.hidden = true;
  }

  els.outcomeBanner.dataset.outcome = res.outcome;
  els.outcomeTitle.textContent = OUTCOME_LABELS[res.outcome] || 'ผลการตรวจสอบ';
  els.confidenceTag.textContent = `ความมั่นใจ ${Math.round((res.confidence || 0) * 100)}%`;
  els.outcomeReason.textContent = res.reasonTh || '';

  if (Array.isArray(res.visibleComponentsTh) && res.visibleComponentsTh.length > 0) {
    els.componentsRow.hidden = false;
    els.componentsRow.innerHTML = '';
    for (const comp of res.visibleComponentsTh) {
      const span = document.createElement('span');
      span.className = 'group-pill';
      span.textContent = comp;
      els.componentsRow.appendChild(span);
    }
  } else {
    els.componentsRow.hidden = true;
    els.componentsRow.innerHTML = '';
  }

  els.customDishGroup.hidden = Boolean(primaryDish);
  syncPortionButtons(primary.portionMultiplier);

  if (primaryDish) {
    const estGrams = Math.round(primaryDish.servingGrams * primary.portionMultiplier);
    els.portionGramsText.textContent = `${primaryDish.servingLabel} × ${primary.portionMultiplier} (ประมาณ ${formatNumber(estGrams)} ก.)`;
  } else {
    els.portionGramsText.textContent = `สัดส่วน ${primary.portionMultiplier}×`;
  }

  renderTrayList(activeMode);

  // SAFETY POLICY: AI mode NEVER displays mock/illustrative nutrition fixtures
  if (activeMode === 'ai') {
    renderClarificationPanel([], 0, 0);
    els.nutritionBlock.hidden = true;
    els.aiSafetyBox.hidden = false;
    return;
  }

  els.aiSafetyBox.hidden = true;

  const baseCombo = scaleComboNutrition(state.trayItems, goal);
  if (!baseCombo) {
    renderClarificationPanel([], 0, 0);
    els.nutritionBlock.hidden = true;
    return;
  }

  const { adjustedNutrients, adjustmentLog } =
    state.arm === 'A'
      ? { adjustedNutrients: baseCombo, adjustmentLog: [] }
      : applyClarificationAdjustments(baseCombo, state.clarificationAnswers, activeMode);

  const combo = adjustedNutrients || baseCombo;
  renderClarificationPanel(adjustmentLog, baseCombo.kcal, combo.kcal);

  els.nutritionBlock.hidden = false;

  els.kcalValue.textContent = formatNumber(combo.kcal);
  els.barProtein.style.width = `${combo.macroShares.proteinPct}%`;
  els.barCarbs.style.width = `${combo.macroShares.carbsPct}%`;
  els.barFat.style.width = `${combo.macroShares.fatPct}%`;

  els.proteinVal.textContent = `${combo.proteinG} ก.`;
  els.carbsVal.textContent = `${combo.carbsG} ก.`;
  els.fatVal.textContent = `${combo.fatG} ก.`;

  els.sodiumVal.textContent = `${formatNumber(combo.sodiumMg)} มก.`;
  els.sodiumLevel.dataset.level = combo.levels.sodium;
  els.sodiumLevel.textContent = LEVEL_LABELS[combo.levels.sodium];

  els.sugarVal.textContent = `${combo.sugarG} ก.`;
  els.sugarLevel.dataset.level = combo.levels.sugar;
  els.sugarLevel.textContent = LEVEL_LABELS[combo.levels.sugar];

  els.fiberVal.textContent = `${combo.fiberG} ก.`;

  els.foodGroupsRow.innerHTML = '';
  for (const g of baseCombo.foodGroups) {
    const pill = document.createElement('span');
    pill.className = 'group-pill';
    pill.textContent = FOOD_GROUP_LABELS[g];
    els.foodGroupsRow.appendChild(pill);
  }

  els.tipsList.innerHTML = '';
  for (const tip of baseCombo.tips) {
    const li = document.createElement('li');
    li.textContent = tip;
    els.tipsList.appendChild(li);
  }
  els.swapLine.textContent =
    baseCombo.swaps.length > 0 ? `ทางเลือกสุขภาพดีกว่า: ${baseCombo.swaps[0]}` : '';
}

function saveCurrentMeal() {
  if (!state.scanResult || state.trayItems.length === 0) return;

  const primary = state.trayItems[0];
  const primaryDish = getDishById(primary.foodId);
  const customName = els.customDishInput.value.trim();

  if (!primaryDish && !customName) {
    showSaveFeedback('กรุณาเลือกเมนูอาหาร หรือพิมพ์ชื่อเมนูเองก่อนบันทึก');
    els.customDishInput.focus();
    return;
  }

  primary.customFoodName = customName;

  const record = buildMealRecord({
    mode: state.scanResult.mode,
    items: state.trayItems,
    mealType: state.selectedMealType,
    note: els.mealNoteInput.value,
    scanOutcome: state.scanResult.outcome,
    confidence: state.scanResult.confidence,
  });

  // Apply deterministic clarification adjustments for Demo mode only (never AI mode!)
  let initialNutrients = null;
  if (record.mode !== 'ai' && record.nutrients) {
    initialNutrients = { ...record.nutrients };
    if (state.arm !== 'A') {
      const { adjustedNutrients } = applyClarificationAdjustments(
        record.nutrients,
        state.clarificationAnswers,
        record.mode
      );
      if (adjustedNutrients) {
        record.nutrients = adjustedNutrients;
      }
    }
  }

  const now = Date.now();
  const questions = state.activeQuestions || [];
  const answeredCount = questions.filter((q) => Boolean(state.clarificationAnswers[q.id])).length;

  record.experiment = {
    arm: state.arm,
    participantId: state.participantId,
    sessionId: state.sessionId,
    benchmarkId: state.activeBenchmarkId || '',
    initialFoodId: state.trialTiming.initialFoodId,
    portionUncertainty: state.trialTiming.portionUncertainty,
    dishChanged: primary.foodId !== state.trialTiming.initialFoodId,
    questionsShownCount: questions.length,
    questionsAnsweredCount: answeredCount,
    questionIdsShown: questions.map((q) => q.id),
    answers: { ...state.clarificationAnswers },
    totalDurationMs: state.trialTiming.scanStartedAt ? now - state.trialTiming.scanStartedAt : 0,
    clarificationDurationMs: state.trialTiming.resultReadyAt
      ? now - state.trialTiming.resultReadyAt
      : 0,
    tapCount: state.trialTiming.tapCount,
    perceivedEase: state.perceivedEase,
    perceivedConfidence: state.perceivedConfidence,
    initialNutrients,
  };

  if (state.activeBenchmarkId) {
    record.experiment.benchmarkEval = evaluateTrialAgainstBenchmark(record);
  }

  state.history.unshift(record);
  persistHistory();
  els.mealNoteInput.value = '';
  renderDailySummary();
  renderArmComparison();
  renderSevenDayChart();
  renderHistoryList();
  const bmTag = state.activeBenchmarkId ? ` • ${state.activeBenchmarkId}` : '';
  showSaveFeedback(
    `บันทึก "${record.foodNameTh}" (ระบบ ${state.arm}${bmTag} • ${getMealLabel(record.mealType)}) เรียบร้อยแล้ว`
  );
}

/* ---------- Daily Summary & 7-Day Trend SVG Chart ---------- */
function renderDailySummary() {
  const goal = activeGoal();
  const todayKey = getLocalDateKey();
  els.todayDateLabel.textContent = new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const summary = summarizeDailyRecords(state.history, todayKey, goal);

  els.dailyKcal.textContent = `${formatNumber(summary.kcal)} kcal`;
  els.dailyKcalBar.style.width = `${Math.min(100, summary.rdiPct.kcal)}%`;
  els.dailyKcalBar.dataset.over = String(summary.kcal > goal.kcal);
  els.dailyKcalSub.textContent = `${summary.rdiPct.kcal}% ของเป้าหมาย ${formatNumber(goal.kcal)} kcal`;

  els.dailyProtein.textContent = `${summary.proteinG} ก.`;
  els.dailyProteinBar.style.width = `${Math.min(100, summary.rdiPct.protein)}%`;
  els.dailyProteinSub.textContent = `เป้าหมาย ${goal.proteinG} ก./วัน`;

  els.dailySodium.textContent = `${formatNumber(summary.sodiumMg)} มก.`;
  els.dailySodiumBar.style.width = `${Math.min(100, summary.rdiPct.sodium)}%`;
  els.dailySodiumBar.dataset.warn = String(summary.sodiumMg >= goal.sodiumMg * 0.75 && summary.sodiumMg <= goal.sodiumMg);
  els.dailySodiumBar.dataset.over = String(summary.sodiumMg > goal.sodiumMg);
  els.dailySodiumSub.textContent = `ไม่ควรเกิน ${formatNumber(goal.sodiumMg)} มก./วัน`;

  els.dailyCount.textContent = `${summary.totalCount} มื้อ`;
  els.dailyModeBreakdown.textContent = `Demo ${summary.demoEstimatedCount} • GDA ${summary.gdaLabelCount} • AI ${summary.aiClassificationOnlyCount}`;
}

function renderSevenDayChart() {
  const goal = activeGoal();
  const buckets = summarizeSevenDayTrend(state.history);
  const metric = state.trendMetric;
  const meta = TREND_METRICS[metric] || TREND_METRICS.kcal;

  const targetLineVal =
    metric === 'kcal'
      ? goal.kcal
      : metric === 'sodiumMg'
        ? goal.sodiumMg
        : metric === 'proteinG'
          ? goal.proteinG
          : 3;

  const maxData = Math.max(...buckets.map((b) => b[metric] || 0), 0);
  const scaleMax = Math.max(targetLineVal * 1.15, maxData * 1.15, 1);

  const W = 680;
  const H = 190;
  const padL = 16;
  const padR = 16;
  const padT = 26;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const colW = plotW / buckets.length;
  const barW = Math.min(44, colW * 0.52);

  const goalY = padT + plotH - (targetLineVal / scaleMax) * plotH;

  const barsSvg = buckets
    .map((b, i) => {
      const val = b[metric] || 0;
      const barH = Math.max(val > 0 ? 4 : 2, (val / scaleMax) * plotH);
      const x = padL + i * colW + (colW - barW) / 2;
      const y = padT + plotH - barH;
      const isOver = (metric === 'sodiumMg' || metric === 'kcal') && val > targetLineVal;
      const fill = val === 0 ? '#d8d4c8' : isOver ? '#c26a26' : '#1b5e3f';
      const valLabel = val > 0 ? formatNumber(val) : '0';

      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="6" fill="${fill}" />
          <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="#18231e">${valLabel}</text>
          <text x="${(x + barW / 2).toFixed(1)}" y="${(H - 12).toFixed(1)}" text-anchor="middle" font-size="11" fill="#516058">${b.shortLabel}</text>
        </g>`;
    })
    .join('');

  els.trendSvgWrap.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟแท่งแสดง${meta.label}ย้อนหลัง 7 วัน">
      <line x1="${padL}" y1="${goalY.toFixed(1)}" x2="${W - padR}" y2="${goalY.toFixed(1)}" stroke="#b45309" stroke-width="1.4" stroke-dasharray="5 4" opacity="0.7" />
      <text x="${W - padR}" y="${Math.max(12, goalY - 5).toFixed(1)}" text-anchor="end" font-size="10.5" fill="#92400e">เกณฑ์ ${formatNumber(targetLineVal)} ${meta.unit}</text>
      <line x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" stroke="rgba(24,35,30,0.14)" stroke-width="1" />
      ${barsSvg}
    </svg>`;
}

function renderArmComparison() {
  const byArm = summarizeExperimentByArm(state.history);
  const bmByArm = summarizeBenchmarkByArm(state.history);
  els.armCompareGrid.innerHTML = '';

  for (const armId of ['A', 'B', 'C']) {
    const stat = byArm[armId];
    const bmStat = bmByArm[armId];
    const meta = EXPERIMENT_ARMS[armId];
    const card = document.createElement('div');
    card.className = 'arm-stat-card';
    card.dataset.armStat = armId;

    const title = document.createElement('span');
    title.className = 'arm-stat-title';
    title.textContent = meta.shortLabelTh;

    const line1 = document.createElement('span');
    line1.className = 'arm-stat-line';
    line1.textContent =
      stat.trialCount > 0
        ? `จำนวนทดลอง: ${stat.trialCount} ครั้ง • เฉลี่ย ${stat.avgQuestionsShown} คำถาม`
        : 'ยังไม่มีข้อมูลทดลองในระบบนี้';

    const line2 = document.createElement('span');
    line2.className = 'arm-stat-line';
    const durStr = stat.avgDurationSec !== null ? `${stat.avgDurationSec} วิ.` : '-';
    const easeStr = stat.avgEase !== null ? `${stat.avgEase}/5` : '-';
    const confStr = stat.avgConfidence !== null ? `${stat.avgConfidence}/5` : '-';
    line2.textContent = `เวลาเฉลี่ย ${durStr} • ง่าย ${easeStr} • มั่นใจ ${confStr}`;

    card.append(title, line1, line2);

    if (bmStat.benchmarkCount > 0) {
      const line3 = document.createElement('span');
      line3.className = 'arm-stat-line';
      const maeKcalStr = bmStat.maeKcal !== null ? `MAE ${bmStat.maeKcal} kcal` : 'AI-only';
      const maeSodStr = bmStat.maeSodiumMg !== null ? ` • โซเดียม ${bmStat.maeSodiumMg} มก.` : '';
      line3.textContent = `Benchmark (${bmStat.benchmarkCount}): แม่นเมนู ${bmStat.dishAccuracyPct}% • ${maeKcalStr}${maeSodStr}`;
      card.appendChild(line3);
    }

    els.armCompareGrid.appendChild(card);
  }
}

/* ---------- History List & Inline Edit ---------- */
function deleteRecord(recordId) {
  state.history = state.history.filter((rec) => rec.id !== recordId);
  if (state.editingRecordId === recordId) state.editingRecordId = null;
  persistHistory();
  renderDailySummary();
  renderArmComparison();
  renderSevenDayChart();
  renderHistoryList();
}

function clearAllHistory() {
  if (state.history.length === 0) return;
  state.history = [];
  state.editingRecordId = null;
  persistHistory();
  renderDailySummary();
  renderArmComparison();
  renderSevenDayChart();
  renderHistoryList();
}

function triggerCsvDownload(csvText, filename) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv() {
  if (state.history.length === 0) return;
  triggerCsvDownload(recordsToCsv(state.history), `nutrilens-th-history-${getLocalDateKey()}.csv`);
}

function exportResearchCsv() {
  if (state.history.length === 0) return;
  triggerCsvDownload(
    researchTrialsToCsv(state.history),
    `nutrilens-th-research-abc-${getLocalDateKey()}.csv`
  );
}

function renderHistoryList() {
  const hasAny = state.history.length > 0;
  els.exportCsvBtn.disabled = !hasAny;
  els.exportResearchCsvBtn.disabled = !hasAny;
  els.clearHistoryBtn.disabled = !hasAny;

  const filtered =
    state.filterMealType === 'all'
      ? state.history
      : state.history.filter((rec) => rec.mealType === state.filterMealType);

  if (filtered.length === 0) {
    els.emptyHistory.hidden = false;
    els.emptyHistory.textContent = hasAny
      ? 'ยังไม่มีรายการในมื้อที่เลือก'
      : 'ยังไม่มีรายการอาหารที่บันทึก ลองสแกนและกดบันทึกมื้อแรกของคุณด้านบน';
    els.historyList.hidden = true;
    els.historyList.innerHTML = '';
    return;
  }

  els.emptyHistory.hidden = true;
  els.historyList.hidden = false;
  els.historyList.innerHTML = '';

  for (const rec of filtered) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.recordId = rec.id;

    const rowTop = document.createElement('div');
    rowTop.className = 'history-row-top';

    const main = document.createElement('div');
    main.className = 'history-main';

    const titleRow = document.createElement('div');
    titleRow.className = 'history-title-row';

    const dishEl = document.createElement('span');
    dishEl.className = 'history-dish';
    dishEl.textContent = rec.foodNameTh;

    const mealTag = document.createElement('span');
    mealTag.className = 'tag';
    mealTag.textContent = getMealLabel(rec.mealType);

    const modeTag = document.createElement('span');
    if (rec.mode === 'ai') {
      modeTag.className = 'tag tag-ai';
      modeTag.textContent = 'AI จำแนกเมนูเท่านั้น';
    } else if (rec.mode === 'gda') {
      modeTag.className = 'tag tag-gda';
      modeTag.textContent =
        rec.provenance === PROVENANCE.USER_GDA_LABEL ? 'ฉลาก GDA' : 'GDA ตัวอย่าง';
    } else {
      modeTag.className = 'tag';
      modeTag.textContent = 'Demo สาธิต';
    }

    titleRow.append(dishEl, mealTag, modeTag);

    if (rec.experiment?.arm) {
      const armTag = document.createElement('span');
      armTag.className = 'tag tag-ai';
      armTag.textContent = `ระบบ ${rec.experiment.arm} (${rec.experiment.questionsShownCount ?? 0} ข้อ)`;
      titleRow.appendChild(armTag);
    }

    const meta = document.createElement('span');
    meta.className = 'history-meta';
    const gramsStr = rec.estimatedGrams ? ` (~${formatNumber(rec.estimatedGrams)} ก.)` : '';
    const noteStr = rec.note ? ` • ${rec.note}` : '';
    meta.textContent = `ปริมาณ ${rec.portionMultiplier}×${gramsStr} • ${formatTimeTh(rec.timestamp)}${noteStr}`;

    main.append(titleRow, meta);

    const right = document.createElement('div');
    right.className = 'history-right';

    const kcalEl = document.createElement('span');
    kcalEl.className = 'history-kcal';
    if (rec.mode !== 'ai' && rec.nutrients) {
      kcalEl.textContent = `${formatNumber(rec.nutrients.kcal)} kcal`;
    } else {
      kcalEl.textContent = 'ไม่ระบุสารอาหาร';
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost edit-record-btn';
    editBtn.textContent = state.editingRecordId === rec.id ? 'ปิดแก้ไข' : 'แก้ไข';
    editBtn.addEventListener('click', () => {
      state.editingRecordId = state.editingRecordId === rec.id ? null : rec.id;
      renderHistoryList();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger-ghost delete-record-btn';
    delBtn.textContent = 'ลบ';
    delBtn.setAttribute('aria-label', `ลบรายการ ${rec.foodNameTh}`);
    delBtn.addEventListener('click', () => deleteRecord(rec.id));

    right.append(kcalEl, editBtn, delBtn);
    rowTop.append(main, right);
    li.appendChild(rowTop);

    // Inline edit panel
    if (state.editingRecordId === rec.id) {
      const form = document.createElement('form');
      form.className = 'edit-form';
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = updateMealRecord(rec, {
          foodNameTh: nameIn.value,
          portionMultiplier: portionIn.value,
          mealType: mealSel.value,
          note: noteIn.value,
        });
        state.history = state.history.map((item) => (item.id === rec.id ? updated : item));
        state.editingRecordId = null;
        persistHistory();
        renderDailySummary();
        renderArmComparison();
        renderSevenDayChart();
        renderHistoryList();
      });

      const nameWrap = document.createElement('div');
      const nameLbl = document.createElement('label');
      nameLbl.className = 'field-label';
      nameLbl.textContent = 'ชื่อเมนู';
      const nameIn = document.createElement('input');
      nameIn.className = 'field-control edit-name-input';
      nameIn.type = 'text';
      nameIn.maxLength = 120;
      nameIn.value = rec.foodNameTh;
      nameWrap.append(nameLbl, nameIn);

      const portionWrap = document.createElement('div');
      const portionLbl = document.createElement('label');
      portionLbl.className = 'field-label';
      portionLbl.textContent = 'ปริมาณ (×)';
      const portionIn = document.createElement('input');
      portionIn.className = 'field-control edit-portion-input';
      portionIn.type = 'number';
      portionIn.min = '0.25';
      portionIn.max = '4';
      portionIn.step = '0.25';
      portionIn.value = String(rec.portionMultiplier || 1);
      portionWrap.append(portionLbl, portionIn);

      const mealWrap = document.createElement('div');
      const mealLbl = document.createElement('label');
      mealLbl.className = 'field-label';
      mealLbl.textContent = 'มื้ออาหาร';
      const mealSel = document.createElement('select');
      mealSel.className = 'field-control edit-meal-select';
      for (const m of MEAL_TYPES) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.labelTh;
        mealSel.appendChild(opt);
      }
      mealSel.value = rec.mealType;
      mealWrap.append(mealLbl, mealSel);

      const noteWrap = document.createElement('div');
      const noteLbl = document.createElement('label');
      noteLbl.className = 'field-label';
      noteLbl.textContent = 'บันทึกเพิ่มเติม';
      const noteIn = document.createElement('input');
      noteIn.className = 'field-control edit-note-input';
      noteIn.type = 'text';
      noteIn.maxLength = 140;
      noteIn.value = rec.note || '';
      noteWrap.append(noteLbl, noteIn);

      const actions = document.createElement('div');
      actions.className = 'edit-actions';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'submit';
      saveBtn.className = 'btn btn-secondary save-edit-btn';
      saveBtn.textContent = 'บันทึกการแก้ไข';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.textContent = 'ยกเลิก';
      cancelBtn.addEventListener('click', () => {
        state.editingRecordId = null;
        renderHistoryList();
      });

      actions.append(saveBtn, cancelBtn);
      form.append(nameWrap, portionWrap, mealWrap, noteWrap, actions);
      li.appendChild(form);
    }

    els.historyList.appendChild(li);
  }
}

/* ---------- PWA Setup ---------- */
function setupPwa() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Non-fatal in environments without SW support
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    els.installPwaBtn.hidden = false;
  });

  els.installPwaBtn.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.installPwaBtn.hidden = true;
  });
}

/* ---------- Event Binding ---------- */
function bindEvents() {
  els.modeDemoBtn.addEventListener('click', () => setMode('demo'));
  els.modeAiBtn.addEventListener('click', () => setMode('ai'));

  for (const btn of els.armBtns) {
    btn.addEventListener('click', () => setExperimentArm(btn.dataset.arm));
  }

  els.toggleStudyMetaBtn.addEventListener('click', () => {
    const isHidden = els.studyMetaDrawer.hidden;
    els.studyMetaDrawer.hidden = !isHidden;
    els.toggleStudyMetaBtn.setAttribute('aria-expanded', String(isHidden));
  });

  els.participantIdInput.addEventListener('input', () => {
    state.participantId = els.participantIdInput.value.trim().slice(0, 40);
    persistStudyConfig();
  });

  els.sessionIdInput.addEventListener('input', () => {
    state.sessionId = els.sessionIdInput.value.trim().slice(0, 40);
    persistStudyConfig();
  });

  els.studyAccessCodeInput.addEventListener('input', () => {
    state.studyAccessCode = els.studyAccessCodeInput.value.trim().slice(0, 40);
    persistStudyConfig();
    updateModeUi();
  });

  els.remoteApiUrlInput.addEventListener('change', () => {
    state.remoteApiBase = normalizeApiBase(els.remoteApiUrlInput.value);
    els.remoteApiUrlInput.value = state.remoteApiBase;
    persistStudyConfig();
    checkServerHealth();
  });

  for (const btn of els.copyLinkBtns) {
    btn.addEventListener('click', async () => {
      const targetArm = btn.dataset.copyArm;
      const url = new URL(window.location.href);
      url.searchParams.set('arm', targetArm);
      url.searchParams.set('lock', '1');
      if (state.participantId) url.searchParams.set('pid', state.participantId);
      else url.searchParams.delete('pid');
      if (state.sessionId) url.searchParams.set('session', state.sessionId);
      else url.searchParams.delete('session');
      if (state.studyAccessCode) url.searchParams.set('code', state.studyAccessCode);
      else url.searchParams.delete('code');
      if (state.remoteApiBase) url.searchParams.set('api', state.remoteApiBase);
      else url.searchParams.delete('api');

      const linkStr = url.toString();
      try {
        await navigator.clipboard.writeText(linkStr);
        els.copyLinkFeedback.textContent = `คัดลอกลิงก์ระบบ ${targetArm} แล้ว: ${linkStr}`;
      } catch {
        els.copyLinkFeedback.textContent = `ลิงก์ระบบ ${targetArm}: ${linkStr}`;
      }
      els.copyLinkFeedback.hidden = false;
    });
  }

  els.toggleProfileBtn.addEventListener('click', () => {
    const isHidden = els.profileDrawer.hidden;
    els.profileDrawer.hidden = !isHidden;
    els.toggleProfileBtn.setAttribute('aria-expanded', String(isHidden));
  });

  const bindCustomGoal = (el, key) => {
    el.addEventListener('input', () => {
      state.profileSettings[key] = Number(el.value) || 0;
      persistProfileSettings();
      onProfileChanged();
    });
  };
  bindCustomGoal(els.customKcalInput, 'customKcal');
  bindCustomGoal(els.customProteinInput, 'customProteinG');
  bindCustomGoal(els.customSodiumInput, 'customSodiumMg');
  bindCustomGoal(els.customSugarInput, 'customSugarG');

  const bindFocus = (el, key) => {
    el.addEventListener('change', () => {
      state.profileSettings[key] = el.checked;
      persistProfileSettings();
      onProfileChanged();
    });
  };
  bindFocus(els.focusLowSodium, 'focusLowSodium');
  bindFocus(els.focusLowSugar, 'focusLowSugar');
  bindFocus(els.focusHighProtein, 'focusHighProtein');

  els.tabPhotoBtn.addEventListener('click', () => setCaptureTab('photo'));
  els.tabGdaBtn.addEventListener('click', () => setCaptureTab('gda'));
  els.tabBenchmarkBtn.addEventListener('click', () => setCaptureTab('benchmark'));
  els.runBenchmarkScanBtn.addEventListener('click', runScan);

  els.cameraBtn.addEventListener('click', () => els.cameraInput.click());
  els.uploadBtn.addEventListener('click', () => els.fileInput.click());
  els.clearImageBtn.addEventListener('click', clearSelectedImage);

  els.cameraInput.addEventListener('change', (e) => handleFileSelection(e.target.files?.[0]));
  els.fileInput.addEventListener('change', (e) => handleFileSelection(e.target.files?.[0]));

  els.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropzone.classList.add('is-dragover');
  });
  els.dropzone.addEventListener('dragleave', () => {
    els.dropzone.classList.remove('is-dragover');
  });
  els.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropzone.classList.remove('is-dragover');
    handleFileSelection(e.dataTransfer?.files?.[0]);
  });

  els.scanBtn.addEventListener('click', runScan);

  // Barcode & GDA events
  els.lookupBarcodeBtn.addEventListener('click', lookupBarcodeInput);
  els.startBarcodeCamBtn.addEventListener('click', startBarcodeCamera);
  els.stopBarcodeCamBtn.addEventListener('click', stopBarcodeCamera);

  for (const input of [
    els.gdaNameInput,
    els.gdaKcalInput,
    els.gdaSugarInput,
    els.gdaFatInput,
    els.gdaSodiumInput,
    els.gdaProteinInput,
    els.gdaServingsInput,
  ]) {
    input.addEventListener('input', () => {
      if (input !== els.gdaServingsInput) {
        state.gdaFromFixture = false;
      }
      renderGdaPreview();
    });
  }
  els.saveGdaBtn.addEventListener('click', saveGdaMeal);

  // Searchable dish picker & primary dish selection
  els.dishSearchInput.addEventListener('input', () => {
    state.dishSearchQuery = els.dishSearchInput.value;
    renderDishSelectOptions();
  });

  els.dishSelect.addEventListener('change', () => {
    if (!state.trayItems[0]) return;
    state.trialTiming.tapCount += 1;
    state.trayItems[0].foodId = els.dishSelect.value;
    showSaveFeedback('');
    renderResultPanel();
  });

  els.customDishInput.addEventListener('input', () => {
    if (!state.trayItems[0]) return;
    state.trayItems[0].customFoodName = els.customDishInput.value;
    renderTrayList(state.scanResult?.mode || 'demo');
  });

  for (const btn of els.portionChips) {
    btn.addEventListener('click', () => {
      if (!state.trayItems[0]) return;
      state.trialTiming.tapCount += 1;
      state.trayItems[0].portionMultiplier = clampPortionMultiplier(btn.dataset.portion);
      els.portionInput.value = String(state.trayItems[0].portionMultiplier);
      renderResultPanel();
    });
  }

  els.portionInput.addEventListener('input', () => {
    if (!state.trayItems[0]) return;
    state.trayItems[0].portionMultiplier = clampPortionMultiplier(els.portionInput.value);
    renderResultPanel();
  });

  // Multi-dish tray controls
  els.addCompanionToggleBtn.addEventListener('click', () => {
    els.companionPicker.hidden = !els.companionPicker.hidden;
  });

  els.addCompanionBtn.addEventListener('click', () => {
    addDishToTray(els.companionSelect.value);
    els.companionPicker.hidden = true;
  });

  for (const btn of els.quickSideBtns) {
    btn.addEventListener('click', () => addDishToTray(btn.dataset.sideId));
  }

  // Trend chart metric switcher
  for (const btn of els.trendMetricBtns) {
    btn.addEventListener('click', () => {
      state.trendMetric = btn.dataset.metric;
      for (const b of els.trendMetricBtns) {
        b.setAttribute('aria-pressed', String(b.dataset.metric === state.trendMetric));
      }
      renderSevenDayChart();
    });
  }

  els.saveMealBtn.addEventListener('click', saveCurrentMeal);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.exportResearchCsvBtn.addEventListener('click', exportResearchCsv);
  els.clearHistoryBtn.addEventListener('click', clearAllHistory);
}

function init() {
  renderStudyControls();
  renderProfileControls();
  renderDishCategoryChips();
  renderDishSelectOptions();
  renderCompanionSelectOptions();
  renderSampleCards();
  renderBenchmarkGrid();
  renderBarcodeSampleChips();
  renderGdaPreview();
  renderMealTypeButtons();
  renderRatingPills();
  renderHistoryFilters();
  renderDailySummary();
  renderArmComparison();
  renderSevenDayChart();
  renderHistoryList();
  bindEvents();
  updateModeUi();
  checkServerHealth();
  setupPwa();
}

init();
