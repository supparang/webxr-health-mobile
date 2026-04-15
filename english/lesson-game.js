import { missionDB } from "./lesson-data.js";
import { initFirebaseRuntime, onAuthStateChanged, ref, get, set, onValue } from "./lesson-firebase.js";
import { $, setValueAttr } from "./lesson-ui.js";

        let currentMission = null;
        let missionTimer; let timeLeft = 60; let gameScore = 0; let systemHP = 100;
        let isGameOver = false; let comboCount = 0;
        let gameDifficulty = 'normal'; 
        let consecutiveWins = 0; let consecutiveLosses = 0; // ตัวแปรเก็บประวัติสำหรับ AI Adaptive Difficulty

        const aiDirector = {
            pressure: 0,
            support: 0,
            mood: 'STEADY',
            note: 'AI กำลังดูจังหวะการเล่นของคุณ',
            lastMissionScore: 0
        };

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function getBaseTimeForMissionType(type) {
            if (type === 'speaking') return 40;
            if (type === 'reading') return 30;
            if (type === 'listening') return 35;
            if (type === 'writing') return 45;
            return 35;
        }

        function getDifficultyTimeMod() {
            return gameDifficulty === 'easy' ? 15 : (gameDifficulty === 'hard' ? -15 : 0);
        }

        function getAdaptiveTimeBonus() {
            let bonus = 0;
            bonus += aiDirector.support * 4;
            bonus -= aiDirector.pressure * 3;
            if (systemHP <= 35) bonus += 6;
            if (consecutiveLosses >= 2) bonus += 4;
            if (consecutiveWins >= 2) bonus -= 2;
            return clamp(bonus, -10, 14);
        }

        function getAdaptiveSpeakAllowance() {
            const base = gameDifficulty === 'easy' ? 3 : (gameDifficulty === 'normal' ? 1 : 0);
            const bonus = Math.max(aiDirector.support - aiDirector.pressure, 0);
            return clamp(base + bonus, 0, 5);
        }

        function getAdaptiveDamageAdjustment() {
            let mod = 0;
            mod -= aiDirector.support * 4;
            mod += aiDirector.pressure * 3;
            if (systemHP <= 35) mod -= 5;
            return clamp(mod, -10, 10);
        }

        function getAdaptiveBossHpAdjustment() {
            if (aiDirector.support >= 2) return -1;
            if (aiDirector.pressure >= 3) return 1;
            return 0;
        }

        function setAIDirector(mood, note, pressure = aiDirector.pressure, support = aiDirector.support) {
            aiDirector.mood = mood;
            aiDirector.note = note;
            aiDirector.pressure = clamp(pressure, 0, 3);
            aiDirector.support = clamp(support, 0, 3);
            renderAIDirector();
        }

        function renderAIDirector() {
            const stateEl = document.getElementById('ai-director-state');
            const subEl = document.getElementById('ai-director-sub');
            if (!stateEl || !subEl) return;

            const tension = aiDirector.pressure - aiDirector.support;
            stateEl.textContent = `${aiDirector.mood}  P:${aiDirector.pressure} S:${aiDirector.support}`;
            subEl.textContent = aiDirector.note;

            stateEl.style.color =
                tension >= 2 ? '#ff7675' :
                tension <= -2 ? '#55efc4' :
                '#ffffff';
        }

        function onMissionLoadedForAI(mission) {
            if (!mission) return;
            const totalTime = getBaseTimeForMissionType(mission.type) + getDifficultyTimeMod() + getAdaptiveTimeBonus();
            const allow = getAdaptiveSpeakAllowance();
            const bossAdj = isUnitFinal(mission.id) ? getAdaptiveBossHpAdjustment() : 0;
            setAIDirector(
                aiDirector.mood,
                `เวลา ${clamp(totalTime, 18, 80)}วิ • พูดอนุโลม ${allow} คำ • Final Boss ${bossAdj >= 0 ? '+' : ''}${bossAdj} HP`,
                aiDirector.pressure,
                aiDirector.support
            );
        }

        function onMissionSuccessForAI() {
            if (timeLeft >= 18 || comboCount >= 2) {
                setAIDirector(
                    'CHALLENGE UP',
                    'AI เห็นว่าคุณเริ่มคล่องแล้ว — จะเร่งจังหวะขึ้นนิดหนึ่ง',
                    aiDirector.pressure + 1,
                    aiDirector.support - 1
                );
            } else {
                setAIDirector(
                    'STEADY',
                    'ยังคงบาลานซ์อยู่ — รักษาจังหวะนี้ต่อไป',
                    aiDirector.pressure,
                    aiDirector.support
                );
            }
        }

        function onMissionFailForAI(reason = 'damage') {
            const note = reason === 'timeout'
                ? 'AI เห็นว่าเวลาเริ่มกดดัน — จะผ่อนเวลาให้ในด่านถัดไป'
                : 'AI จะช่วยผ่อนเกมให้เล็กน้อยในด่านถัดไป';
            setAIDirector(
                'SUPPORT MODE',
                note,
                aiDirector.pressure - 1,
                aiDirector.support + 1
            );
        }

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const TECHPATH_PROGRESS_KEY = 'TECHPATH_VR_PROGRESS_V1';
        let clearedMissions = loadClearedMissions();
        let lastMissionId = null;

        function loadClearedMissions() {
            try {
                const raw = localStorage.getItem(TECHPATH_PROGRESS_KEY);
                const arr = raw ? JSON.parse(raw) : [];
                return Array.isArray(arr) ? arr : [];
            } catch (e) {
                return [];
            }
        }

        function saveClearedMissions() {
            try {
                localStorage.setItem(TECHPATH_PROGRESS_KEY, JSON.stringify(clearedMissions));
            } catch (e) {}
        }

        function markMissionCleared(id) {
            if (!clearedMissions.includes(id)) {
                clearedMissions.push(id);
                clearedMissions.sort((a, b) => a - b);
                saveClearedMissions();
            }
        }

        function isUnitFinal(id) {
            return id === 5 || id === 10 || id === 15;
        }

        function getNextMissionId(id) {
            return id >= missionDB.length ? 1 : id + 1;
        }

        function refreshMissionWallProgress() {
            missionDB.forEach((mGroup) => {
                const box = document.getElementById(`mission-box-${mGroup.id}`);
                const label = document.getElementById(`mission-text-${mGroup.id}`);
                if (!box || !label) return;

                const basePrefix = isUnitFinal(mGroup.id) ? '👑 FINAL: ' : ((mGroup.id % 3 === 0) ? '🔥 BOSS: ' : '');
                const cleared = clearedMissions.includes(mGroup.id);

                label.setAttribute('value', `${cleared ? '✅ ' : ''}${basePrefix}${mGroup.title}\n(${mGroup.type})`);
                box.setAttribute('material', 'opacity', cleared ? 1 : 0.8);

                if (cleared) {
                    box.setAttribute('animation__pulse', 'property: scale; to: 1.05 1.05 1.05; dir: alternate; dur: 1200; loop: true');
                } else {
                    box.removeAttribute('animation__pulse');
                    box.setAttribute('scale', '1 1 1');
                }
            });
            syncProfileUI();
        }



        const SESSION_STATS_KEY = 'TECHPATH_VR_SESSION_STATS_V1';
        let sessionStats = loadSessionStats();
        let missionRun = null;

        function loadSessionStats() {
            try {
                const raw = localStorage.getItem(SESSION_STATS_KEY);
                const data = raw ? JSON.parse(raw) : null;
                return {
                    totalAttempts: Number(data && data.totalAttempts) || 0,
                    totalClears: Number(data && data.totalClears) || 0,
                    totalFails: Number(data && data.totalFails) || 0,
                    bossClears: Number(data && data.bossClears) || 0,
                    bestCombo: Number(data && data.bestCombo) || 0,
                    lastAIMood: typeof (data && data.lastAIMood) === 'string' ? data.lastAIMood : 'STEADY',
                    missionTypeWins: Object.assign({ speaking: 0, reading: 0, listening: 0, writing: 0 }, data && data.missionTypeWins ? data.missionTypeWins : {}),
                    unitClears: Object.assign({ 5: 0, 10: 0, 15: 0 }, data && data.unitClears ? data.unitClears : {})
                };
            } catch (e) {
                return {
                    totalAttempts: 0,
                    totalClears: 0,
                    totalFails: 0,
                    bossClears: 0,
                    bestCombo: 0,
                    lastAIMood: 'STEADY',
                    missionTypeWins: { speaking: 0, reading: 0, listening: 0, writing: 0 },
                    unitClears: { 5: 0, 10: 0, 15: 0 }
                };
            }
        }

        function saveSessionStats() {
            try {
                localStorage.setItem(SESSION_STATS_KEY, JSON.stringify(sessionStats));
            } catch (e) {}
        }

        function renderHubStatsBoard() {
            const body = document.getElementById('hub-stats-body');
            if (!body) return;

            const topType = Object.entries(sessionStats.missionTypeWins).sort((a, b) => b[1] - a[1])[0] || ['speaking', 0];
            body.textContent =
                `Attempts: ${sessionStats.totalAttempts}
Clears: ${sessionStats.totalClears} | Fails: ${sessionStats.totalFails}
Boss Clears: ${sessionStats.bossClears}
Best Combo: x${sessionStats.bestCombo}
Top Skill: ${String(topType[0]).toUpperCase()} (${topType[1]})
AI Mood ล่าสุด: ${sessionStats.lastAIMood}`;
        }

        function resetSummaryPanel() {
            const panel = document.getElementById('summary-panel');
            if (panel) panel.style.display = 'none';
        }

        function showEndSummary(success, extraLines = []) {
            const panel = document.getElementById('summary-panel');
            const title = document.getElementById('summary-title');
            const body = document.getElementById('summary-body');
            if (!panel || !title || !body) return;

            const missionType = currentMission && currentMission.type ? currentMission.type.toUpperCase() : 'UNKNOWN';
            const missionName = currentMission && currentMission.title ? currentMission.title : 'Mission';
            const lines = [
                `Mission: ${missionName}`,
                `Type: ${missionType}`,
                `Score: ${gameScore}`,
                `HP: ${systemHP}%`,
                `Combo Peak: x${Math.max(comboCount, sessionStats.bestCombo)}`,
                `AI Mood: ${aiDirector.mood}`
            ].concat(extraLines || []);

            title.textContent = success ? 'MISSION SUMMARY ✅' : 'MISSION SUMMARY ⚠️';
            title.style.color = success ? '#2ed573' : '#ff6b81';
            body.textContent = lines.join('\n');
            panel.style.display = 'block';
        }

        function recordMissionStart(mission) {
            missionRun = {
                missionId: mission && mission.id,
                missionType: mission && mission.type,
                startedScore: gameScore,
                startedHp: systemHP,
                aiMoodAtStart: aiDirector.mood
            };
            sessionStats.totalAttempts += 1;
            sessionStats.lastAIMood = aiDirector.mood;
            saveSessionStats();
            renderHubStatsBoard();
        }

        function recordMissionSuccess() {
            sessionStats.totalClears += 1;
            sessionStats.lastAIMood = aiDirector.mood;
            if (currentMission && currentMission.type && sessionStats.missionTypeWins[currentMission.type] != null) {
                sessionStats.missionTypeWins[currentMission.type] += 1;
            }
            if (currentMission && isUnitFinal(currentMission.id)) {
                sessionStats.bossClears += 1;
                sessionStats.unitClears[currentMission.id] = (sessionStats.unitClears[currentMission.id] || 0) + 1;
            }
            saveSessionStats();
            renderHubStatsBoard();
        }

        function recordMissionFail() {
            sessionStats.totalFails += 1;
            sessionStats.lastAIMood = aiDirector.mood;
            saveSessionStats();
            renderHubStatsBoard();
        }

        const PROFILE_LOCAL_KEY = 'TECHPATH_VR_PROFILE_V1';
        const AVATAR_META = {
            '🧑‍💻': { label: 'ฟรี', unlock: function() { return true; } },
            '🤖': { label: 'ปลดล็อกเมื่อ Streak 3', unlock: function() { return currentRewardStreak >= 3; } },
            '👩‍🚀': { label: 'ปลดล็อกเมื่อ Streak 7', unlock: function() { return currentRewardStreak >= 7; } },
            '🦾': { label: 'ปลดล็อกเมื่อ Clear 5', unlock: function() { return clearedMissions.length >= 5; } },
            '🧠': { label: 'ปลดล็อกเมื่อ Streak 14 + Clear 12', unlock: function() { return currentRewardStreak >= 14 && clearedMissions.length >= 12; } }
        };
        const ALLOWED_AVATARS = Object.keys(AVATAR_META);
        let currentRewardStreak = 0;
        let playerProfile = loadLocalProfile();

        function loadLocalProfile() {
            try {
                const raw = localStorage.getItem(PROFILE_LOCAL_KEY);
                const data = raw ? JSON.parse(raw) : null;
                const candidate = data && ALLOWED_AVATARS.includes(data.avatar) ? data.avatar : '🧑‍💻';
                return {
                    avatar: candidate,
                    name: data && typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 24) : 'Hero'
                };
            } catch (e) {
                return { avatar: '🧑‍💻', name: 'Hero' };
            }
        }

        function saveLocalProfile() {
            try {
                localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(playerProfile));
            } catch (e) {}
        }

        function isAvatarUnlocked(avatar) {
            const meta = AVATAR_META[avatar];
            return !!(meta && meta.unlock());
        }

        function getUnlockedAvatars() {
            return ALLOWED_AVATARS.filter(isAvatarUnlocked);
        }

        function normalizeSelectedAvatar() {
            if (!isAvatarUnlocked(playerProfile.avatar)) {
                playerProfile.avatar = getUnlockedAvatars()[0] || '🧑‍💻';
            }
        }

        function syncProfileUI() {
            normalizeSelectedAvatar();

            const avatarHud = document.getElementById('player-avatar-hud');
            const vrAvatar = document.getElementById('vr-profile-avatar');
            const vrName = document.getElementById('vr-profile-name');
            const profileNameInput = document.getElementById('profile-name-input');
            const scoreNameInput = document.getElementById('player-name-input');
            const unlockHint = document.getElementById('unlock-hint');

            if (avatarHud) avatarHud.textContent = playerProfile.avatar;
            if (vrAvatar) vrAvatar.setAttribute('value', playerProfile.avatar);
            if (vrName) vrName.setAttribute('value', `Name: ${playerProfile.name}`);
            if (profileNameInput && document.activeElement !== profileNameInput) profileNameInput.value = playerProfile.name;
            if (scoreNameInput && !scoreNameInput.value.trim()) scoreNameInput.value = playerProfile.name;

            let nextGoal = [];
            if (currentRewardStreak < 3) nextGoal.push(`Streak ${3 - currentRewardStreak} วันเพื่อปลด 🤖`);
            else if (currentRewardStreak < 7) nextGoal.push(`Streak อีก ${7 - currentRewardStreak} วันเพื่อปลด 👩‍🚀`);
            if (clearedMissions.length < 5) nextGoal.push(`Clear อีก ${5 - clearedMissions.length} ด่านเพื่อปลด 🦾`);
            if (!(currentRewardStreak >= 14 && clearedMissions.length >= 12)) {
                if (currentRewardStreak < 14) nextGoal.push(`Streak อีก ${14 - currentRewardStreak} วัน`);
                if (clearedMissions.length < 12) nextGoal.push(`Clear อีก ${12 - clearedMissions.length} ด่าน`);
            }
            if (unlockHint) {
                unlockHint.textContent = nextGoal.length
                    ? `เป้าหมายถัดไป: ${nextGoal.slice(0,2).join(' • ')}`
                    : 'ปลดล็อก avatar ครบแล้ว!';
            }

            ALLOWED_AVATARS.forEach((avatar, i) => {
                const chip = document.getElementById(`avatar-chip-${i + 1}`);
                if (!chip) return;
                const unlocked = isAvatarUnlocked(avatar);
                chip.classList.toggle('active', avatar === playerProfile.avatar);
                chip.classList.toggle('locked', !unlocked);
                chip.title = unlocked ? `เลือก ${avatar}` : (AVATAR_META[avatar] ? AVATAR_META[avatar].label : 'Locked');
            });
        }

        async function loadPlayerProfile() {
            syncProfileUI();
            if (!currentUser || !db) return;

            const profileRef = ref(db, ['artifacts', appId, 'users', currentUser.uid, 'profile', 'main'].join('/'));
            try {
                const snap = await get(profileRef);
                if (snap.exists()) {
                    const data = snap.val() || {};
                    playerProfile = {
                        avatar: ALLOWED_AVATARS.includes(data.avatar) ? data.avatar : playerProfile.avatar,
                        name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 24) : playerProfile.name
                    };
                    normalizeSelectedAvatar();
                    saveLocalProfile();
                    syncProfileUI();
                } else {
                    await savePlayerProfile(true);
                }
            } catch (e) {
                console.error('Error loading profile:', e);
            }
        }

        window.selectAvatar = function(avatar) {
            if (!ALLOWED_AVATARS.includes(avatar)) return;
            if (!isAvatarUnlocked(avatar)) {
                const feedback = document.getElementById('feedback');
                if (feedback) {
                    feedback.innerText = `🔒 ${AVATAR_META[avatar].label}`;
                    feedback.style.color = '#ff9f43';
                }
                return;
            }
            playerProfile.avatar = avatar;
            saveLocalProfile();
            syncProfileUI();
        };

        window.savePlayerProfile = async function(silent = false) {
            const input = document.getElementById('profile-name-input');
            const nextName = input && input.value.trim() ? input.value.trim().slice(0, 24) : playerProfile.name || 'Hero';

            playerProfile.name = nextName;
            normalizeSelectedAvatar();
            saveLocalProfile();
            syncProfileUI();

            if (!currentUser || !db) {
                if (!silent) {
                    const feedback = document.getElementById('feedback');
                    if (feedback) {
                        feedback.innerText = '💾 บันทึกโปรไฟล์ในเครื่องแล้ว (ยังไม่ต่อเซิร์ฟเวอร์)';
                        feedback.style.color = '#7bedff';
                    }
                }
                return;
            }

            const profileRef = ref(db, ['artifacts', appId, 'users', currentUser.uid, 'profile', 'main'].join('/'));
            try {
                await set(profileRef, {
                    name: playerProfile.name,
                    avatar: playerProfile.avatar,
                    updatedAt: Date.now()
                });

                if (!silent) {
                    const feedback = document.getElementById('feedback');
                    if (feedback) {
                        feedback.innerText = `✅ โปรไฟล์ถูกบันทึกแล้ว: ${playerProfile.avatar} ${playerProfile.name}`;
                        feedback.style.color = '#2ed573';
                    }
                }
            } catch (e) {
                console.error('Error saving profile:', e);
                if (!silent) {
                    const feedback = document.getElementById('feedback');
                    if (feedback) {
                        feedback.innerText = '❌ บันทึกโปรไฟล์ไม่สำเร็จ';
                        feedback.style.color = '#ff4757';
                    }
                }
            }
        };


        let finalBossState = {
            active: false,
            unitId: null,
            hp: 0,
            maxHp: 0,
            introShown: false
        };


        function getFinalBossPattern(id) {
            if (id === 5) {
                return {
                    code: 'OVERCLOCK RUSH',
                    desc: 'สปีดสูง เวลาสั้นลง แต่คอมโบได้คะแนนแรง',
                    color: '#ff7675',
                    timeAdjust: -8
                };
            }
            if (id === 10) {
                return {
                    code: 'SIGNAL SCRAMBLE',
                    desc: 'ตัวเลือกถูกสลับตำแหน่งทุกครั้ง อย่าเดาทางเดิม',
                    color: '#74b9ff',
                    timeAdjust: -4
                };
            }
            if (id === 15) {
                return {
                    code: 'FINAL EXAM MIX',
                    desc: 'สุ่มโจทย์ผสมจาก Interview + Global Team',
                    color: '#a29bfe',
                    timeAdjust: 0
                };
            }
            return {
                code: 'STANDARD FINAL',
                desc: 'ตอบถูกต่อเนื่องเพื่อล้มบอส',
                color: '#f1c40f',
                timeAdjust: 0
            };
        }

        function shuffleArray(arr) {
            const out = arr.slice();
            for (let i = out.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = out[i];
                out[i] = out[j];
                out[j] = tmp;
            }
            return out;
        }

        function remixChoiceMission(mission) {
            if (!mission || !Array.isArray(mission.choices) || !mission.answer) return mission;

            const letters = ['A', 'B', 'C'];
            const parsed = mission.choices.map((choice, idx) => {
                const stripped = typeof choice === 'string'
                    ? choice.replace(/^[A-C]:\s*/, '')
                    : String(choice || '');
                return {
                    originalLetter: letters[idx],
                    text: stripped
                };
            });

            const correctEntry = parsed.find(item => item.originalLetter === mission.answer) || parsed[0];
            const shuffled = shuffleArray(parsed);
            mission.choices = shuffled.map((item, idx) => `${letters[idx]}: ${item.text}`);

            const newCorrectIndex = shuffled.findIndex(item => item.text === correctEntry.text);
            mission.answer = letters[Math.max(0, newCorrectIndex)];
            return mission;
        }

        function buildMixedFinalMission() {
            const sources = [13, 14, 15].map(id => missionDB.find(m => m.id === id)).filter(Boolean);
            const chosenGroup = sources[Math.floor(Math.random() * sources.length)];
            const chosenVariation = chosenGroup.variations[Math.floor(Math.random() * chosenGroup.variations.length)];

            return {
                ...chosenVariation,
                id: 15,
                type: chosenGroup.type,
                title: `Final Mix • ${chosenGroup.title}`,
                _mixedSourceId: chosenGroup.id
            };
        }

        function prepareMissionForBossPattern(missionGroup) {
            let prepared;

            if (missionGroup.id === 15) {
                prepared = buildMixedFinalMission();
            } else {
                const randomIndex = Math.floor(Math.random() * missionGroup.variations.length);
                prepared = { ...missionGroup.variations[randomIndex] };
            }

            if (missionGroup.id === 10) {
                prepared = remixChoiceMission(prepared);
            }

            prepared.id = missionGroup.id;
            prepared.type = prepared.type || missionGroup.type;
            prepared.title = prepared.title || missionGroup.title;

            const pattern = getFinalBossPattern(missionGroup.id);
            prepared._bossPattern = pattern.code;
            prepared._bossPatternDesc = pattern.desc;
            prepared._bossPatternColor = pattern.color;
            prepared._bossTimeAdjust = pattern.timeAdjust;

            return prepared;
        }

        function applyUnitTheme(id) {
            const chip = document.getElementById('unit-theme-chip');
            const panel = document.getElementById('ui-container');
            const bossTitle = document.getElementById('boss-phase-title');
            const bossSub = document.getElementById('boss-phase-sub');
            const pattern = getFinalBossPattern(id);

            if (!chip || !panel || !bossTitle || !bossSub) return;

            if (isUnitFinal(id)) {
                chip.style.display = 'block';
                chip.textContent = pattern.code;
                chip.style.borderColor = pattern.color;
                chip.style.color = pattern.color;
                panel.style.boxShadow = `0 0 26px ${pattern.color}55`;
                bossTitle.textContent = `👑 ${pattern.code}`;
                bossSub.textContent = pattern.desc;
            } else {
                chip.style.display = 'none';
                panel.style.boxShadow = '0 0 20px rgba(0, 229, 255, 0.4)';
                bossTitle.textContent = '👑 FINAL BOSS PHASE';
                bossSub.textContent = 'ตอบถูกหลายครั้งเพื่อล้มบอสประจำยูนิต';
            }
        }

        function getFinalBossMaxHp(id) {
            if (!isUnitFinal(id)) return 0;
            let hp = gameDifficulty === 'easy' ? 2 : (gameDifficulty === 'hard' ? 4 : 3);
            hp += getAdaptiveBossHpAdjustment();
            return clamp(hp, 1, 5);
        }

        function ensureFinalBossState(id) {
            if (!isUnitFinal(id)) {
                finalBossState = { active: false, unitId: null, hp: 0, maxHp: 0, introShown: false };
                return;
            }
            if (!finalBossState.active || finalBossState.unitId !== id || finalBossState.hp <= 0) {
                const maxHp = getFinalBossMaxHp(id);
                finalBossState = { active: true, unitId: id, hp: maxHp, maxHp: maxHp, introShown: false };
            }
        }

        function resetFinalBossState() {
            finalBossState = { active: false, unitId: null, hp: 0, maxHp: 0, introShown: false };
            renderFinalBossUI();
        }

        function showBossCinematic(title, sub, ms = 1400) {
            const wrap = document.getElementById('boss-cinematic');
            const titleEl = document.getElementById('boss-cinematic-title');
            const subEl = document.getElementById('boss-cinematic-sub');
            if (!wrap || !titleEl || !subEl) return;

            titleEl.textContent = title;
            subEl.textContent = sub;
            wrap.classList.add('show');
            clearTimeout(showBossCinematic._timer);
            showBossCinematic._timer = setTimeout(() => {
                wrap.classList.remove('show');
            }, ms);
        }

        function triggerImpactFlash(kind = 'hit') {
            const flash = document.getElementById('impact-flash');
            const bossUi = document.getElementById('boss-phase-ui');
            if (!flash) return;
            flash.classList.remove('impact-hit', 'impact-clear');
            if (bossUi) bossUi.classList.remove('boss-ui-pulse');

            void flash.offsetWidth;

            flash.classList.add(kind === 'clear' ? 'impact-clear' : 'impact-hit');
            if (bossUi) bossUi.classList.add('boss-ui-pulse');

            setTimeout(() => {
                flash.classList.remove('impact-hit', 'impact-clear');
                if (bossUi) bossUi.classList.remove('boss-ui-pulse');
            }, kind === 'clear' ? 760 : 460);
        }

        function animateBossActor(mode = 'intro') {
            const boss = document.getElementById('hackerBoss');
            if (!boss) return;

            boss.removeAttribute('animation__scale');
            boss.removeAttribute('animation__colorPulse');

            if (mode === 'intro') {
                boss.setAttribute('animation__scale', 'property: scale; from: 0.7 0.7 0.7; to: 1.12 1.12 1.12; dur: 650; dir: alternate; loop: 1; easing: easeOutElastic');
            } else if (mode === 'hit') {
                boss.setAttribute('animation__scale', 'property: scale; from: 1 1 1; to: 1.22 1.22 1.22; dur: 180; dir: alternate; loop: 1; easing: easeOutQuad');
            } else if (mode === 'clear') {
                boss.setAttribute('animation__scale', 'property: scale; from: 1 1 1; to: 1.55 1.55 1.55; dur: 320; easing: easeOutQuad');
                boss.setAttribute('animation__colorPulse', 'property: visible; to: false; delay: 260; dur: 20');
            }
        }

        function maybeShowFinalBossIntro(id) {
            if (!finalBossState.active || !isUnitFinal(id)) return;
            if (finalBossState.introShown) return;
            if (finalBossState.hp !== finalBossState.maxHp) return;

            finalBossState.introShown = true;
            playSFX('bossIntro');
            triggerImpactFlash('clear');
            animateBossActor('intro');
            const pattern = getFinalBossPattern(id);
            showBossCinematic(`UNIT ${id} FINAL BOSS`, `${pattern.code} — ${pattern.desc}`, 1700);
        }

        function renderFinalBossUI() {
            const wrap = document.getElementById('boss-phase-ui');
            const fill = document.getElementById('boss-bar-fill');
            const hpText = document.getElementById('boss-hp-text');
            const sub = document.getElementById('boss-phase-sub');
            if (!wrap || !fill || !hpText || !sub) return;

            if (finalBossState.active && finalBossState.hp > 0) {
                wrap.style.display = 'block';
                const ratio = Math.max(0, Math.min(1, finalBossState.hp / finalBossState.maxHp));
                fill.style.width = `${Math.round(ratio * 100)}%`;
                const pattern = getFinalBossPattern(finalBossState.unitId);
                hpText.innerText = `BOSS HP: ${finalBossState.hp} / ${finalBossState.maxHp}`;
                sub.innerText = `${pattern.code} — ${pattern.desc}`;
            } else {
                wrap.style.display = 'none';
            }
        }

        // ==========================================
        // ระบบจัดเก็บออนไลน์ (Online Leaderboard Initialization)
        // ==========================================
        let db, auth, currentUser, appId;
        (async function bootFirebase() {
            try {
                const runtime = await initFirebaseRuntime();
                db = runtime.db;
                auth = runtime.auth;
                appId = runtime.appId;

                if (runtime.missingConfig) {
                    console.warn('Missing Firebase RTDB config. Set window.TECHPATH_FIREBASE_CONFIG with databaseURL.');
                    setValueAttr('vr-leaderboard-list', 'Leaderboard Offline
(Check Firebase Config)');
                    const streakText = $('streak-text');
                    if (streakText) streakText.setAttribute('value', 'Offline
(Set Firebase Config)');
                    return;
                }

                onAuthStateChanged(auth, (user) => {
                    currentUser = user;
                    if (user) {
                        setupLeaderboardListener();
                        loadPlayerProfile();
                        checkDailyStreak();
                    } else {
                        syncProfileUI();
                    }
                });
            } catch (e) {
                console.error("Leaderboard Error:", e);
                setValueAttr('vr-leaderboard-list', 'Error connecting to database');
            }
        })();

        function setupLeaderboardListener() {
            if (!currentUser || !db) return;
            const lbRef = ref(db, ['artifacts', appId, 'public', 'data', 'vr_leaderboards'].join('/'));

            onValue(lbRef, (snapshot) => {
                const raw = snapshot.val() || {};
                let scores = Object.values(raw).filter(entry => entry && typeof entry.score === 'number');
                scores.sort((a, b) => {
                    const scoreDiff = (b.score || 0) - (a.score || 0);
                    if (scoreDiff !== 0) return scoreDiff;
                    return (a.timestamp || 0) - (b.timestamp || 0);
                });
                const top5 = scores.slice(0, 5);

                let lbText = "";
                top5.forEach((entry, i) => {
                    let medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
                    const safeName = String(entry.name || 'Unknown').substring(0, 10);
                    lbText += `${medal} ${safeName} : ${entry.score || 0}
`;
                });

                if (scores.length === 0) lbText = "Be the first to clear a mission!";

                const lbList = document.getElementById('vr-leaderboard-list');
                if (lbList) lbList.setAttribute('value', lbText);
            }, (error) => {
                console.error("RTDB listener error:", error);
                const lbList = document.getElementById('vr-leaderboard-list');
                if (lbList) lbList.setAttribute('value', `Leaderboard Offline\n(Check RTDB Rules)`);
            });
        }

        window.onload = function() {
            generateMissionWall();
            setDifficulty('normal'); // ตั้งค่าเริ่มต้นตอนเปิดเกม
            syncProfileUI();
            renderFinalBossUI();
            renderHubStatsBoard();
            setTimeout(() => {
                document.getElementById('loading').style.opacity = '0';
                setTimeout(() => document.getElementById('loading').style.display = 'none', 1000);
            }, 1000);

            $('write-input').addEventListener('keypress', function (e) {
                if (e.key === 'Enter') checkWritingAnswer();
            });

            $('profile-name-input').addEventListener('keypress', function (e) {
                if (e.key === 'Enter') savePlayerProfile();
            });
        };

        // ==========================================
        // ระบบ Daily Streak (บันทึกข้อมูลผูกกับ User ID ผ่าน Realtime Database)
        // ==========================================
        function getChestRarity(streak) {
            if (streak >= 14) return { name: 'MYTHIC', bonus: 2200, color: '#fd79a8' };
            if (streak >= 7) return { name: 'EPIC', bonus: 1400, color: '#a29bfe' };
            if (streak >= 3) return { name: 'RARE', bonus: 900, color: '#74b9ff' };
            return { name: 'COMMON', bonus: 500, color: '#ffeaa7' };
        }

        function showRewardBadge(rarityName, color) {
            const badge = document.getElementById('reward-roll-badge');
            if (!badge) return;
            badge.style.display = 'block';
            badge.textContent = `${rarityName} CHEST`;
            badge.style.borderColor = color;
            badge.style.color = color;
            clearTimeout(showRewardBadge._timer);
            showRewardBadge._timer = setTimeout(() => {
                badge.style.display = 'none';
            }, 2400);
        }

        window.checkDailyStreak = async function() {
            if (!currentUser || !db) return;

            const rewardRef = ref(db, ['artifacts', appId, 'users', currentUser.uid, 'player_stats', 'reward'].join('/'));
            try {
                const snap = await get(rewardRef);
                const rewardData = snap.exists() ? (snap.val() || {}) : {};
                let streak = rewardData.streak || 0;
                let lastLogin = rewardData.lastLogin || "";

                currentRewardStreak = streak;
                syncProfileUI();

                let today = new Date().toDateString();
                const chest = document.getElementById('reward-chest');
                const streakText = document.getElementById('streak-text');

                if (lastLogin === today) {
                    chest.removeAttribute('animation');
                    chest.querySelector('a-box').setAttribute('color', '#555');
                    streakText.setAttribute('value', `Streak: ${streak} Days\n(Come back tomorrow!)`);
                    chest.classList.remove('clickable');
                } else {
                    chest.setAttribute('animation', 'property: position; to: -3.5 0.7 -3; dir: alternate; dur: 1000; loop: true');
                    chest.querySelector('a-box').setAttribute('color', '#f1c40f');
                    streakText.setAttribute('value', `Streak: ${streak} Days\n(Click to Claim!)`);
                    chest.classList.add('clickable');
                }
            } catch (e) {
                console.error("Error checking streak (RTDB):", e);
            }
        }

        window.claimReward = async function() {
            if (!currentUser || !db) {
                document.getElementById('feedback').innerText = "⚠️ รอเชื่อมต่อเซิร์ฟเวอร์สักครู่...";
                return;
            }

            const rewardRef = ref(db, ['artifacts', appId, 'users', currentUser.uid, 'player_stats', 'reward'].join('/'));

            try {
                const chest = document.getElementById('reward-chest');
                chest.classList.remove('clickable');

                const snap = await get(rewardRef);
                const rewardData = snap.exists() ? (snap.val() || {}) : {};
                let streak = rewardData.streak || 0;
                let lastLogin = rewardData.lastLogin || "";

                let today = new Date().toDateString();
                if (lastLogin === today) {
                    document.getElementById('feedback').innerText = "🎁 วันนี้รับรางวัลไปแล้ว";
                    return;
                }

                let yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                if (lastLogin === yesterday.toDateString()) {
                    streak++;
                } else {
                    streak = 1;
                }

                await set(rewardRef, {
                    lastLogin: today,
                    streak: streak
                });

                currentRewardStreak = streak;
                const rarity = getChestRarity(streak);
                const streakBonus = streak * 200;
                const bonus = rarity.bonus + streakBonus;

                playSFX('win');
                updateHUD(bonus);
                showVRFeedback(true, `+${bonus} REWARD!`);
                showRewardBadge(rarity.name, rarity.color);

                chest.removeAttribute('animation');
                chest.querySelector('a-box').setAttribute('color', '#555');
                document.getElementById('streak-text').setAttribute('value', `Streak: ${streak} Days\n(Claimed)`);

                const newlyUnlocked = getUnlockedAvatars();
                syncProfileUI();

                let unlockMsg = '';
                if (streak === 3) unlockMsg = '\n🤖 Avatar Unlocked!';
                else if (streak === 7) unlockMsg = '\n👩‍🚀 Avatar Unlocked!';
                else if (streak === 14 && clearedMissions.length >= 12) unlockMsg = '\n🧠 Avatar Unlocked!';

                document.getElementById('feedback').innerText =
                    `🎁 ${rarity.name} CHEST! Streak ${streak} วัน (+${bonus} Pts)${unlockMsg}`;
                document.getElementById('feedback').style.color = rarity.color;

            } catch (e) {
                console.error("Error claiming reward (RTDB):", e);
                document.getElementById('reward-chest').classList.add('clickable');
                document.getElementById('feedback').innerText = "❌ เกิดข้อผิดพลาดในการรับรางวัล";
                document.getElementById('feedback').style.color = "#ff4757";
            }
        }

        window.claimReward = async function() {
            if (!currentUser || !db) {
                document.getElementById('feedback').innerText = "⚠️ รอเชื่อมต่อเซิร์ฟเวอร์สักครู่...";
                return;
            }

            const rewardRef = ref(db, ['artifacts', appId, 'users', currentUser.uid, 'player_stats', 'reward'].join('/'));

            try {
                const chest = document.getElementById('reward-chest');
                chest.classList.remove('clickable');

                const snap = await get(rewardRef);
                const rewardData = snap.exists() ? (snap.val() || {}) : {};
                let streak = rewardData.streak || 0;
                let lastLogin = rewardData.lastLogin || "";

                let today = new Date().toDateString();
                if (lastLogin === today) {
                    document.getElementById('feedback').innerText = "🎁 วันนี้รับรางวัลไปแล้ว";
                    return;
                }

                let yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                if (lastLogin === yesterday.toDateString()) {
                    streak++;
                } else {
                    streak = 1;
                }

                await set(rewardRef, {
                    lastLogin: today,
                    streak: streak
                });

                let bonus = 500 + (streak * 200);
                playSFX('win');
                updateHUD(bonus);
                showVRFeedback(true, `+${bonus} REWARD!`);

                chest.removeAttribute('animation');
                chest.querySelector('a-box').setAttribute('color', '#555');
                document.getElementById('streak-text').setAttribute('value', `Streak: ${streak} Days
(Claimed)`);

                document.getElementById('feedback').innerText = `🎁 รับรางวัลสำเร็จ! Streak ${streak} วัน (+${bonus} Pts)`;
                document.getElementById('feedback').style.color = "#f1c40f";

            } catch (e) {
                console.error("Error claiming reward (RTDB):", e);
                document.getElementById('reward-chest').classList.add('clickable');
                document.getElementById('feedback').innerText = "❌ เกิดข้อผิดพลาดในการรับรางวัล";
            }
        }

        function generateMissionWall() {
            const wall = document.getElementById('mission-wall');
            let index = 0;
            for(let row=0; row<3; row++) {
                let yPos = 1.2 - (row * 0.8);
                for(let col=0; col<5; col++) {
                    if(index >= missionDB.length) break;
                    let mGroup = missionDB[index]; // ดึงข้อมูล Group หลักมาสร้างป้าย
                    
                    let angle = (col - 2) * 15;
                    let rad = angle * Math.PI / 180;
                    let radius = 4;
                    let xPos = Math.sin(rad) * radius;
                    let zPos = -Math.cos(rad) * radius + 4;

                    // ระบบบอส (ทุกๆ 3 ด่าน) + FINAL UNIT ทุก 5 ด่าน
                    let isBoss = (mGroup.id % 3 === 0);
                    let isFinalUnit = isUnitFinal(mGroup.id);
                    let color = isFinalUnit ? '#f1c40f' : (isBoss ? '#e74c3c' : (mGroup.type === 'speaking' ? '#27ae60' : 
                                mGroup.type === 'reading' ? '#3498db' : 
                                mGroup.type === 'listening' ? '#e67e22' : '#9b59b6'));

                    let boxWidth = (isBoss || isFinalUnit) ? '1.5' : '1.2';
                    let boxHeight = (isBoss || isFinalUnit) ? '0.8' : '0.6';

                    let entity = document.createElement('a-entity');
                    entity.setAttribute('position', `${xPos} ${yPos} ${zPos}`);
                    entity.setAttribute('rotation', `0 ${-angle} 0`);

                    let box = document.createElement('a-box');
                    box.setAttribute('id', `mission-box-${mGroup.id}`);
                    box.setAttribute('class', 'clickable');
                    box.setAttribute('width', boxWidth); box.setAttribute('height', boxHeight); box.setAttribute('depth', '0.1');
                    box.setAttribute('color', color);
                    box.setAttribute('material', 'opacity: 0.8');
                    
                    box.addEventListener('mouseenter', () => { box.setAttribute('material', 'color', '#00e5ff'); box.setAttribute('scale', '1.1 1.1 1.1'); });
                    box.addEventListener('mouseleave', () => { box.setAttribute('material', 'color', color); box.setAttribute('scale', '1 1 1'); });
                    box.addEventListener('click', () => loadMission(mGroup.id)); 

                    let titlePrefix = isFinalUnit ? '👑 FINAL: ' : (isBoss ? '🔥 BOSS: ' : '');
                    let text = document.createElement('a-text');
                    text.setAttribute('id', `mission-text-${mGroup.id}`);
                    text.setAttribute('value', `${titlePrefix}${mGroup.title}\n(${mGroup.type})`);
                    text.setAttribute('align', 'center');
                    text.setAttribute('position', '0 0 0.06');
                    text.setAttribute('scale', isBoss ? '0.5 0.5 0.5' : '0.4 0.4 0.4');

                    entity.appendChild(box);
                    entity.appendChild(text);
                    wall.appendChild(entity);
                    index++;
                }
            }
            refreshMissionWallProgress();
        }

        // ==========================================
        // ระบบจัดการความยาก (Difficulty System)
        // ==========================================
        window.setDifficulty = function(level) {
            gameDifficulty = level;
            
            // รีเซ็ตความสว่างกล่อง
            document.getElementById('diff-easy-box').setAttribute('material', 'opacity', '0.4');
            document.getElementById('diff-normal-box').setAttribute('material', 'opacity', '0.4');
            document.getElementById('diff-hard-box').setAttribute('material', 'opacity', '0.4');
            
            // ทำให้กล่องที่เลือกสว่างขึ้น
            document.getElementById('diff-' + level + '-box').setAttribute('material', 'opacity', '1');
            
            let descText = level === 'easy' ? 'โหมดง่าย (เพิ่มเวลา 15วิ, อนุโลมคำพูดได้ 3 คำ, ดาเมจน้อย)' :
                           level === 'normal' ? 'โหมดปานกลาง (สมดุล, อนุโลมคำพูด 1 คำ)' :
                           'โหมดยาก (ลดเวลา 15วิ, ต้องพูดเป๊ะทุกคำ, คะแนนคูณ 2!)';
                           
            document.getElementById('ui-desc').innerText = `ความยาก: ${level.toUpperCase()} - ${descText}`;
            renderAIDirector();
        }

        // ==========================================
        // โหลดและสุ่มคำถาม (Randomizer Engine)
        // ==========================================
        function loadMission(id) {
            const missionGroup = missionDB.find(m => m.id === id);
            if (!missionGroup) return;

            currentMission = prepareMissionForBossPattern(missionGroup);
            lastMissionId = missionGroup.id;

            const isBoss = (currentMission.id % 3 === 0);
            const isFinal = isUnitFinal(currentMission.id);

            if (isFinal) ensureFinalBossState(currentMission.id);
            else resetFinalBossState();

            document.getElementById('hub-scene').setAttribute('visible', 'false');
            hideAllScenesAndControls();
            resetSummaryPanel();
            document.getElementById('btn-next').style.display = 'none';
            renderFinalBossUI();
            if (isFinal) maybeShowFinalBossIntro(currentMission.id);

            let titlePrefix = isFinal ? '👑 FINAL BOSS | ' : (isBoss ? '🔥 BOSS STAGE | ' : '');
            document.getElementById('ui-title').innerText = `🚨 ${titlePrefix}SESSION ${id}: ${currentMission.title.toUpperCase()} [${gameDifficulty.toUpperCase()}]`;
            document.getElementById('ui-title').style.color = isFinal ? "#f1c40f" : (isBoss ? "#e74c3c" : "#ff4757");
            document.getElementById('ui-desc').innerText = isFinal
                ? `${currentMission.desc} | FINAL BOSS HP ${finalBossState.hp}/${finalBossState.maxHp}`
                : currentMission.desc;
            document.getElementById('feedback').innerText = isFinal
                ? "👑 UNIT FINAL START! ตอบถูกเพื่อลด HP บอส"
                : "พร้อมแล้วเริ่มทำภารกิจเลย!";

            let timeMod = gameDifficulty === 'easy' ? 15 : (gameDifficulty === 'hard' ? -15 : 0);
            
            // ดึงบอสแฮ็กเกอร์ออกมาในทุกด่านที่เป็น Boss Stage
            const hackerBoss = document.getElementById('hackerBoss');
            if ((isBoss || isFinal) && hackerBoss) {
                hackerBoss.setAttribute('visible', 'true');
                hackerBoss.removeAttribute('animation');
                const bossTargetY = isFinal ? 1.4 : 2;
                const bossDur = isFinal ? 18000 : 40000;
                setTimeout(() => hackerBoss.setAttribute('animation', `property: position; to: 0 ${bossTargetY} -3; dur: ${bossDur}; easing: linear`), 50);
            } else if (hackerBoss) {
                hackerBoss.setAttribute('visible', 'false');
            }

            if(currentMission.type === 'speaking') {
                document.getElementById('mission-speaking-scene').setAttribute('visible', 'true');
                document.getElementById('speaking-prompt').setAttribute('value', `MISSION: ${currentMission.title}\nSay: "${currentMission.exactPhrase.toUpperCase()}"`);
                document.getElementById('btn-speak').style.display = 'inline-block';
                startTimer(clamp(getBaseTimeForMissionType('speaking') + timeMod, 18, 80));
            } 
            else if(currentMission.type === 'reading') {
                document.getElementById('mission-reading-scene').setAttribute('visible', 'true');
                document.getElementById('reading-question').setAttribute('value', `SYSTEM ALERT:\n\n${currentMission.question}`);
                document.getElementById('reading-choice-a').setAttribute('value', currentMission.choices[0]);
                document.getElementById('reading-choice-b').setAttribute('value', currentMission.choices[1]);
                document.getElementById('reading-choice-c').setAttribute('value', currentMission.choices[2]);
                
                document.getElementById('choice-buttons').style.display = 'flex';
                document.getElementById('ui-desc').innerText += " (ใช้นิ้วจิ้มที่กล่อง หรือกดปุ่ม A, B, C บนคีย์บอร์ดก็ได้)";
                startTimer(clamp(getBaseTimeForMissionType('reading') + timeMod, 18, 80));
            }
            else if(currentMission.type === 'listening') {
                document.getElementById('mission-listening-scene').setAttribute('visible', 'true');
                document.getElementById('listening-choice-a').setAttribute('value', currentMission.choices[0]);
                document.getElementById('listening-choice-b').setAttribute('value', currentMission.choices[1]);
                document.getElementById('listening-choice-c').setAttribute('value', currentMission.choices[2]);
                document.getElementById('btn-play-audio').style.display = 'inline-block';
                
                document.getElementById('choice-buttons').style.display = 'flex';
                document.getElementById('ui-desc').innerText += " (ใช้นิ้วจิ้มที่กล่อง หรือกดปุ่ม A, B, C บนคีย์บอร์ดก็ได้)";
                startTimer(clamp(getBaseTimeForMissionType('listening') + timeMod, 18, 80));
            }
            else if(currentMission.type === 'writing') {
                document.getElementById('mission-writing-scene').setAttribute('visible', 'true');
                document.getElementById('writing-prompt').setAttribute('value', currentMission.prompt);
                document.getElementById('write-input').style.display = 'inline-block';
                document.getElementById('write-input').value = '';
                document.getElementById('btn-submit-write').style.display = 'inline-block';
                
                const hackerBoss = document.getElementById('hackerBoss');
                hackerBoss.removeAttribute('animation');
                setTimeout(() => hackerBoss.setAttribute('animation', 'property: position; to: 0 1 -2; dur: 45000; easing: linear'), 50);
                startTimer(clamp(getBaseTimeForMissionType('writing') + timeMod, 18, 80));
            }
        }

        window.checkChoiceAnswer = function(selectedLetter) {
            if (isGameOver || !currentMission) return;

            const isChoiceMission =
                currentMission.type === 'reading' || currentMission.type === 'listening';

            if (!isChoiceMission || !Array.isArray(currentMission.choices) || !currentMission.answer) {
                console.warn('checkChoiceAnswer ignored because mission is not choice-based or choices are missing', currentMission);
                const feedback = document.getElementById('feedback');
                if (feedback && !isChoiceMission) {
                    feedback.innerText = 'ด่านนี้ไม่ได้ใช้ปุ่ม A/B/C';
                    feedback.style.color = '#ff9f43';
                }
                return;
            }

            const correctChoiceStr = currentMission.choices.find(function(c) {
                return typeof c === 'string' && c.startsWith(currentMission.answer);
            });

            if (!correctChoiceStr) {
                console.warn('No correct choice found for current mission', currentMission);
                return;
            }

            if (correctChoiceStr.startsWith(selectedLetter)) {
                winMission();
            } else {
                takeDamage();
            }
        };

        window.checkWritingAnswer = function() {
            if (isGameOver || !currentMission) return;
            const answer = document.getElementById('write-input').value.toLowerCase();
            
            // ใช้ RegExp เพื่อหาคำที่ผู้เล่นพิมพ์มาเทียบกับคลังคำศัพท์ (ให้ความยืดหยุ่นสูง)
            let matchedKeywords = currentMission.keywords.filter(kw => answer.includes(kw));
            
            if (matchedKeywords.length >= currentMission.minMatch) winMission();
            else {
                document.getElementById('feedback').innerText = currentMission.failMsg;
                takeDamage();
            }
        };

        window.playAudio = function() {
            if (isGameOver || !currentMission) return;
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(currentMission.audioText);
                utterance.lang = 'en-US'; utterance.rate = 0.9;
                speechSynthesis.speak(utterance);
                document.getElementById('feedback').innerText = "🔊 กำลังฟัง... (ตั้งใจฟังให้ดี!)";
            }
        };

        // ==========================================
        // ระบบรับเสียงแบบใหม่ (AI Speech Validation ยืดหยุ่นขึ้น)
        // ==========================================
        window.startRecognition = function() {
            if (isGameOver || !currentMission) return;
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                document.getElementById('feedback').innerText = "⚠️ เบราว์เซอร์ไม่รองรับเสียง (แนะนำให้ใช้ Google Chrome)";
                return;
            }
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = true; 
            
            document.getElementById('btn-speak').disabled = true;
            document.getElementById('feedback').innerText = "🎙️ พูดเลย! (กำลังฟัง...)";
            document.getElementById('feedback').style.color = "#00e5ff";

            recognition.onresult = (event) => {
                let currentTranscript = '';
                let isFinal = false;

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                    if (event.results[i].isFinal) isFinal = true;
                }

                let text = currentTranscript.toLowerCase()
                            .replace(/i'm/g, "i am")
                            .replace(/it's/g, "it is")
                            .replace(/we're/g, "we are")
                            .replace(/[.,!?]/g, "");

                // ระบบตรวจคำตอบแบบ "อนุโลม" (Forgiving Match)
                let targetWords = currentMission.exactPhrase.split(' ');
                let matchCount = 0;
                
                targetWords.forEach(word => {
                    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
                        matchCount++;
                    }
                });

                // ปรับความเข้มงวดของ AI ตามระดับความยาก
                let allowance = getAdaptiveSpeakAllowance();
                let passThreshold = Math.max(1, targetWords.length - allowance);
                let isMatch = matchCount >= passThreshold;

                let strictnessText = gameDifficulty === 'hard' && allowance === 0
                    ? '(ต้องเป๊ะทุกคำ)'
                    : `(AI อนุโลมขาดได้ ${allowance} คำ)`;
                document.getElementById('feedback').innerText = `กำลังฟัง: "${text}"\nความแม่นยำ: ${matchCount}/${targetWords.length} คำ ${strictnessText}`;
                document.getElementById('feedback').style.color = "#f1c40f";

                if (isMatch) {
                    recognition.stop(); 
                    winMission();
                } else if (isFinal) {
                    document.getElementById('feedback').innerText = `คุณพูดว่า: "${text}"\n❌ ${currentMission.failMsg}`;
                    document.getElementById('feedback').style.color = "#ff4757";
                    takeDamage();
                    document.getElementById('btn-speak').disabled = false;
                }
            };

            recognition.onend = () => {
                if (!isGameOver && document.getElementById('mission-speaking-scene').getAttribute('visible') === 'true') {
                    document.getElementById('btn-speak').disabled = false;
                    if (document.getElementById('feedback').innerText.includes("กำลังฟัง")) {
                        document.getElementById('feedback').innerText = "⚠️ ไมค์ตัดไป (กรุณากดพูดใหม่อีกครั้ง)";
                        document.getElementById('feedback').style.color = "#ff4757";
                    }
                }
            };

            recognition.onerror = (event) => { 
                console.log("Speech Error:", event.error);
                if (event.error === 'no-speech') {
                    document.getElementById('feedback').innerText = "⚠️ ไม่ได้ยินเสียงเลยครับ ลองกดพูดใหม่อีกครั้ง";
                } else if (event.error === 'not-allowed') {
                    document.getElementById('feedback').innerText = "⚠️ คุณยังไม่ได้อนุญาตการใช้ไมโครโฟนในเบราว์เซอร์";
                } else {
                    document.getElementById('feedback').innerText = `⚠️ เกิดข้อผิดพลาดของไมค์ (${event.error})`;
                }
                document.getElementById('feedback').style.color = "#ff4757";
                document.getElementById('btn-speak').disabled = false; 
            };
            
            recognition.start();
        }

        window.addEventListener('keydown', function(e) {
            if (isGameOver || !currentMission) return;
            if (document.activeElement === $('write-input') || 
                document.activeElement === $('player-name-input')) {
                return; 
            }
            if (currentMission.type === 'reading' || currentMission.type === 'listening') {
                const key = e.key.toUpperCase();
                if (key === 'A' || key === 'B' || key === 'C') {
                    checkChoiceAnswer(key);
                }
            }
        });

        window.submitScore = async function() {
            const nameInput = document.getElementById('player-name-input');
            const typedName = nameInput.value.trim();
            const name = typedName || playerProfile.name || "Unknown Dev";
            if (!typedName && nameInput) nameInput.value = name;

            if (!currentUser || !db) {
                document.getElementById('feedback').innerText = "❌ เกิดข้อผิดพลาด ไม่สามารถเชื่อมต่อฐานข้อมูลได้";
                return;
            }

            const btn = document.getElementById('btn-submit-score');
            btn.disabled = true;
            btn.innerText = "Saving...";

            try {
                const scoreRef = ref(
                    db,
                    ['artifacts', appId, 'public', 'data', 'vr_leaderboards', currentUser.uid].join('/')
                );

                const snap = await get(scoreRef);
                const oldData = snap.exists() ? (snap.val() || {}) : null;
                const oldBest = oldData && typeof oldData.score === 'number' ? oldData.score : 0;
                const bestScore = Math.max(oldBest, gameScore);

                await set(scoreRef, {
                    name: name,
                    avatar: playerProfile.avatar || '🧑‍💻',
                    score: bestScore,
                    timestamp: Date.now(),
                    userId: currentUser.uid
                });

                if (gameScore > oldBest) {
                    document.getElementById('feedback').innerText = `✅ New High Score! บันทึก ${bestScore} คะแนนเรียบร้อยแล้ว`;
                } else {
                    document.getElementById('feedback').innerText = `✅ บันทึกชื่อเรียบร้อยแล้ว (คะแนนสูงสุดเดิมยังเป็น ${oldBest})`;
                }

                document.getElementById('game-over-ui').style.display = 'none';
            } catch (e) {
                console.error("Error saving score (RTDB):", e);
                document.getElementById('feedback').innerText = "❌ เกิดข้อผิดพลาดในการบันทึก";
                btn.disabled = false;
                btn.innerText = "Save Score";
            }
        };

        // ==========================================
        // ระบบแจ้งเตือน 3D Animation (VR Feedback)
        // ==========================================

        function getMissionTypeFXLabel(type, success = true) {
            const map = {
                speaking: success ? 'VOICE LOCKED IN' : 'VOICE LOST',
                reading: success ? 'READING BOOST' : 'READING ERROR',
                listening: success ? 'LISTEN LOCK' : 'MISHEARD',
                writing: success ? 'CODE PATCHED' : 'SYNTAX FAIL'
            };
            return map[type] || (success ? 'SUCCESS' : 'FAIL');
        }

        function flashMissionTypeTag(type, success = true) {
            const tag = document.getElementById('mission-type-tag');
            if (!tag) return;
            tag.textContent = getMissionTypeFXLabel(type, success);
            tag.style.color = success ? '#2ed573' : '#ff6b81';
            tag.style.borderColor = success ? 'rgba(46,213,115,0.35)' : 'rgba(255,107,129,0.35)';
            tag.classList.remove('show');
            void tag.offsetWidth;
            tag.classList.add('show');
            clearTimeout(flashMissionTypeTag._timer);
            flashMissionTypeTag._timer = setTimeout(() => tag.classList.remove('show'), 940);
        }

        function spawnAnswerBurst(success = true, count = 8) {
            const layer = document.getElementById('answer-fx-layer');
            if (!layer) return;

            for (let i = 0; i < count; i++) {
                const dot = document.createElement('div');
                dot.className = 'answer-burst ' + (success ? 'success' : 'fail');

                const angle = (Math.PI * 2 * i) / count;
                const distance = success ? 70 + (i % 3) * 20 : 55 + (i % 2) * 18;
                const dx = Math.round(Math.cos(angle) * distance) + 'px';
                const dy = Math.round(Math.sin(angle) * distance) + 'px';

                dot.style.setProperty('--dx', dx);
                dot.style.setProperty('--dy', dy);

                layer.appendChild(dot);
                setTimeout(() => dot.remove(), success ? 760 : 660);
            }
        }

        function flashScreenResult(success = true) {
            const ui = document.getElementById('ui-container');
            if (!ui) return;
            ui.classList.remove('screen-glow-success', 'screen-glow-fail');
            void ui.offsetWidth;
            ui.classList.add(success ? 'screen-glow-success' : 'screen-glow-fail');
            setTimeout(() => {
                ui.classList.remove('screen-glow-success', 'screen-glow-fail');
            }, 460);
        }

        function showComboPopup() {
            if (comboCount < 2) return;
            const popup = document.getElementById('combo-popup');
            if (!popup) return;
            popup.textContent = comboCount >= 5 ? `🔥 PERFECT RUN x${comboCount}` : `⚡ COMBO x${comboCount}`;
            popup.classList.remove('show');
            void popup.offsetWidth;
            popup.classList.add('show');
            clearTimeout(showComboPopup._timer);
            showComboPopup._timer = setTimeout(() => popup.classList.remove('show'), 920);
        }

        function playAnswerFX(success = true) {
            const burstCount = success ? Math.min(12, 6 + comboCount) : 7;
            spawnAnswerBurst(success, burstCount);
            flashScreenResult(success);
            flashMissionTypeTag(currentMission && currentMission.type ? currentMission.type : 'generic', success);
            if (success) showComboPopup();
        }

        function showVRFeedback(isSuccess, customText = null) {
            const fx = document.getElementById('vr-feedback-fx');
            const textEl = document.getElementById('vr-feedback-text');
            fx.setAttribute('visible', 'true');
            fx.removeAttribute('animation');
            
            if(isSuccess) {
                textEl.setAttribute('value', customText || '✔ CORRECT!');
                textEl.setAttribute('color', '#2ed573');
                fx.setAttribute('animation', 'property: scale; from: 0.1 0.1 0.1; to: 1.5 1.5 1.5; dur: 500; easing: easeOutElastic');
            } else {
                textEl.setAttribute('value', customText || '❌ WRONG!');
                textEl.setAttribute('color', '#ff4757');
                fx.setAttribute('scale', '1.5 1.5 1.5');
                fx.setAttribute('animation', 'property: position; from: 0 2.5 -2.5; to: 0.2 2.5 -2.5; dur: 50; dir: alternate; loop: 6');
            }
            
            setTimeout(() => { fx.setAttribute('visible', 'false'); }, 1500);
        }

        // ==========================================
        // Game Mechanics & SFX (อัปเกรดเสียงชัดขึ้น)
        // ==========================================
        function playSFX(type) {
            if(audioCtx.state === 'suspended') audioCtx.resume();
            const masterGain = audioCtx.createGain();
            masterGain.connect(audioCtx.destination);
            masterGain.gain.value = 0.5;
            
            if (type === 'win') {
                // สร้างเสียงประสาน 3 ตัว (Chord) ให้ดูแพงและชัดขึ้น
                [523.25, 659.25, 783.99].forEach((freq) => {
                    const osc = audioCtx.createOscillator();
                    osc.type = 'triangle'; 
                    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + 0.5);
                    osc.connect(masterGain);
                    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
                });
                masterGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
                masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            } else if (type === 'damage') {
                // เสียงระเบิดหรือเสียงตีที่ดุดันขึ้น (Sawtooth)
                const osc = audioCtx.createOscillator();
                osc.type = 'sawtooth'; 
                osc.frequency.setValueAtTime(200, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.4);
                osc.connect(masterGain);
                masterGain.gain.setValueAtTime(0.6, audioCtx.currentTime);
                masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
                osc.start(); osc.stop(audioCtx.currentTime + 0.4);
            } else if (type === 'alarm') {
                const osc = audioCtx.createOscillator();
                osc.type = 'square'; 
                osc.frequency.setValueAtTime(800, audioCtx.currentTime);
                osc.connect(masterGain);
                masterGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                masterGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
                osc.start(); osc.stop(audioCtx.currentTime + 0.1);
            }
        }

        function takeDamage() {
            showVRFeedback(false); // เรียกใช้ Animation ผิด
            playAnswerFX(false);
            
            let damageAmount = gameDifficulty === 'easy' ? 15 : (gameDifficulty === 'normal' ? 25 : 40);
            if (currentMission && currentMission.id % 3 === 0) damageAmount += 10; // บอสโจมตีแรงขึ้น 10
            
            systemHP -= damageAmount; 
            
            comboCount = 0;
            document.getElementById('combo-display').style.display = 'none';
            playSFX('damage');
            const ui = document.getElementById('ui-container');
            ui.classList.add('danger-mode', 'shake');
            setTimeout(() => { ui.classList.remove('shake'); if(!isGameOver && timeLeft>10) ui.classList.remove('danger-mode'); }, 400);
            
            if (systemHP <= 0) {
                isGameOver = true; systemHP = 0;
                
                // AI Adaptive Logic: ถ้าตาย AI จะช่วยลดความยากให้ 1 ระดับ
                consecutiveLosses++;
                consecutiveWins = 0;
                let levelDownMsg = "";
                if (gameDifficulty === 'hard') { setDifficulty('normal'); levelDownMsg = "\n⬇️ AI: ปรับลดความยากลงเป็น NORMAL เพื่อช่วยคุณ!"; }
                else if (gameDifficulty === 'normal') { setDifficulty('easy'); levelDownMsg = "\n⬇️ AI: ปรับลดความยากลงเป็น EASY เพื่อช่วยคุณ!"; }

                document.getElementById('feedback').innerText = `💥 MISSION FAILED: SYSTEM OFFLINE! 💥${levelDownMsg}`;
                onMissionFailForAI('damage');
                resetFinalBossState();
                hideAllScenesAndControls();
                
                if(gameScore > 0) {
                    document.getElementById('game-over-ui').style.display = 'block';
                    document.getElementById('btn-submit-score').disabled = false;
                    document.getElementById('btn-submit-score').innerText = "Save Score";
                }
                document.getElementById('btn-return').style.display = 'inline-block';
            }
            updateHUD();
        }

        function winMission() {
            clearInterval(missionTimer); playSFX('win');
            showVRFeedback(true);

            document.getElementById('ui-container').classList.remove('danger-mode');
            const isFinal = currentMission && isUnitFinal(currentMission.id);

            if (isFinal && finalBossState.active && finalBossState.hp > 1) {
                finalBossState.hp -= 1;
                renderFinalBossUI();

                const chipRewardBase = 450 + (timeLeft * 6) + (currentMission.id === 5 ? 180 : 0);
                updateHUD(chipRewardBase);

                document.getElementById('feedback').innerText = `⚔️ BOSS HIT! HP ที่เหลือ ${finalBossState.hp}/${finalBossState.maxHp}\nตอบถูกอีกเพื่อปิดยูนิตนี้`;
                document.getElementById('feedback').style.color = "#f1c40f";
                hideAllScenesAndControls();

                setTimeout(() => {
                    if (!isGameOver) loadMission(currentMission.id);
                }, 900);
                return;
            }

            let timeBonus = timeLeft * 10;

            // ระบบฮีล (ฟื้นฟู HP) เมื่อตอบถูก
            let actualHeal = 0;
            if (systemHP < 100) {
                let healAmount = gameDifficulty === 'easy' ? 20 : (gameDifficulty === 'normal' ? 10 : 5);
                actualHeal = Math.min(100 - systemHP, healAmount);
                systemHP += actualHeal;
            }
            let healText = actualHeal > 0 ? `\n💚 SYSTEM RECOVERED: +${actualHeal}% HP` : '';

            // โบนัสคะแนนคูณ 2 ถ้าเป็นด่านบอส / โบนัสใหญ่ถ้าเป็น FINAL UNIT
            let bossMultiplier = (currentMission && currentMission.id % 3 === 0) ? 2 : 1;
            let finalUnitBonus = (currentMission && isUnitFinal(currentMission.id)) ? (currentMission.id === 5 ? 3000 : currentMission.id === 10 ? 2700 : 3200) : 0;
            updateHUD(((1000 + timeBonus) * bossMultiplier) + finalUnitBonus);

            if (currentMission) {
                markMissionCleared(currentMission.id);
                refreshMissionWallProgress();
            }
            recordMissionSuccess();

            consecutiveWins++;
            consecutiveLosses = 0;
            let levelUpMsg = "";
            if (consecutiveWins >= 2) {
                if (gameDifficulty === 'easy') { setDifficulty('normal'); levelUpMsg = "\n⬆️ AI: คุณเก่งมาก! เลื่อนระดับความยากเป็น NORMAL"; }
                else if (gameDifficulty === 'normal') { setDifficulty('hard'); levelUpMsg = "\n🔥 AI: ไร้เทียมทาน! เลื่อนระดับความยากเป็น HARD"; }
                consecutiveWins = 0; // รีเซ็ตการนับหลังจากเลื่อนขั้น
            }

            const finalUnitText = (currentMission && isUnitFinal(currentMission.id)) ? `\n👑 UNIT FINAL CLEAR! +2500 BONUS` : '';
            document.getElementById('feedback').innerText = `✅ MISSION ACCOMPLISHED! (+1000 Pts, +${timeBonus} Time Bonus)${healText}${finalUnitText}${levelUpMsg}`;
            document.getElementById('feedback').style.color = "#2ed573";

            if (currentMission && isUnitFinal(currentMission.id)) {
                playSFX('bossClear');
                triggerImpactFlash('clear');
                animateBossActor('clear');
                showBossCinematic(`UNIT ${currentMission.id} CLEARED!`, 'Final boss defeated — ระบบของคุณปลอดภัยแล้ว', 1500);
                showVRFeedback(true, '👑 UNIT CLEAR!');
                resetFinalBossState();
            }

            hideAllScenesAndControls();
            showEndSummary(true, [
                `Time Bonus: +${timeBonus}`,
                `Mission Gain: +${missionRun ? gameScore - missionRun.startedScore : 0}`,
                `Unit Clears: ${currentMission && isUnitFinal(currentMission.id) ? sessionStats.unitClears[currentMission.id] : '-'}`
            ]);
            document.getElementById('btn-next').style.display = 'inline-block';
            document.getElementById('btn-return').style.display = 'inline-block';
        }

        function updateHUD(points = 0) {
            if (points > 0) {
                comboCount++; 
                let multiplier = comboCount > 1 ? comboCount : 1;
                
                // ปรับคะแนนตามความยาก
                let diffMultiplier = gameDifficulty === 'easy' ? 0.8 : (gameDifficulty === 'hard' ? 2.0 : 1.0);
                
                gameScore += Math.floor((points * multiplier) * diffMultiplier);
                
                const sd = document.getElementById('score-display');
                sd.innerText = gameScore; sd.classList.add('score-anim');
                if (comboCount > 1) {
                    const cd = document.getElementById('combo-display');
                    cd.innerText = `(x${comboCount} COMBO!)`; cd.style.display = 'inline';
                }
                setTimeout(() => sd.classList.remove('score-anim'), 500);
            }
            const hd = document.getElementById('hp-display');
            hd.innerText = systemHP + '%';
            hd.style.color = systemHP <= 30 ? '#ff4757' : '#2ed573';
        }

        function startTimer(seconds) {
            timeLeft = seconds; isGameOver = false;
            const ui = document.getElementById('ui-container');
            ui.classList.remove('danger-mode');
            const timerEl = document.getElementById('timer');
            timerEl.style.display = 'block';
            
            missionTimer = setInterval(() => {
                if (timeLeft <= 0) {
                    clearInterval(missionTimer); timerEl.innerText = "00:00 - TIME UP!";
                    onMissionFailForAI('timeout');
                    systemHP = 0; takeDamage();
                } else {
                    timeLeft--; timerEl.innerText = `00:${timeLeft.toString().padStart(2, '0')}`;
                    if (timeLeft <= 10) {
                        playSFX('alarm'); timerEl.style.color = "#ff0000";
                        if(timeLeft % 2 === 0) ui.classList.add('danger-mode'); else ui.classList.remove('danger-mode');
                    } else { timerEl.style.color = "#ff4757"; }
                }
            }, 1000);
        }

        function hideAllScenesAndControls() {
            document.getElementById('mission-speaking-scene').setAttribute('visible', 'false');
            document.getElementById('mission-reading-scene').setAttribute('visible', 'false');
            document.getElementById('mission-listening-scene').setAttribute('visible', 'false');
            document.getElementById('mission-writing-scene').setAttribute('visible', 'false');
            
            document.getElementById('btn-speak').style.display = 'none';
            document.getElementById('btn-play-audio').style.display = 'none';
            document.getElementById('write-input').style.display = 'none';
            document.getElementById('btn-submit-write').style.display = 'none';
            document.getElementById('choice-buttons').style.display = 'none';
            document.getElementById('timer').style.display = 'none';
            document.getElementById('btn-next').style.display = 'none';
            document.getElementById('btn-speak').disabled = false;
            clearInterval(missionTimer);
        }

        window.playNextMission = function() {
            const nextId = getNextMissionId(lastMissionId || 1);
            loadMission(nextId);
        };

        window.returnToHub = function() {
            if (isGameOver) {
                gameScore = 0;
                systemHP = 100;
                comboCount = 0;
                isGameOver = false;
                document.getElementById('combo-display').style.display = 'none';
                updateHUD();
            }

            resetFinalBossState();
            const cinematic = document.getElementById('boss-cinematic');
            if (cinematic) cinematic.classList.remove('show');
            const flash = document.getElementById('impact-flash');
            if (flash) flash.classList.remove('impact-hit', 'impact-clear');
            hideAllScenesAndControls();
            document.getElementById('game-over-ui').style.display = 'none';
            document.getElementById('ui-container').classList.remove('danger-mode');
            document.getElementById('hub-scene').setAttribute('visible', 'true');
            
            document.getElementById('ui-title').innerText = "TECHPATH VR: MAIN HUB";
            document.getElementById('ui-title').style.color = "#00e5ff";
            applyUnitTheme(0);
            document.getElementById('ui-desc').innerText = "เลือกภารกิจต่อไป (ใช้นิ้วจิ้ม/คลิกที่ป้ายได้เลย)!";
            
            document.getElementById('btn-next').style.display = 'none';
            document.getElementById('btn-return').style.display = 'none';
            document.getElementById('feedback').innerText = "";
            resetSummaryPanel();
            renderHubStatsBoard();
            currentMission = null;
        }
