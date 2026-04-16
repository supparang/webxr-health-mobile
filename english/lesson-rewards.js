import { PROFILE_LOCAL_KEY, state, clearedMissions } from "./lesson-state.js";

export const AVATAR_META = {
  "🧑‍💻": { label: "ฟรี", unlock: function() { return true; } },
  "🤖": { label: "ปลดล็อกเมื่อ Streak 3", unlock: function() { return state.currentRewardStreak >= 3; } },
  "👩‍🚀": { label: "ปลดล็อกเมื่อ Streak 7", unlock: function() { return state.currentRewardStreak >= 7; } },
  "🦾": { label: "ปลดล็อกเมื่อ Clear 5", unlock: function() { return clearedMissions.length >= 5; } },
  "🧠": { label: "ปลดล็อกเมื่อ Streak 14 + Clear 12", unlock: function() { return state.currentRewardStreak >= 14 && clearedMissions.length >= 12; } }
};
const ALLOWED_AVATARS = Object.keys(AVATAR_META);
export let playerProfile = loadLocalProfile();

function loadLocalProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_LOCAL_KEY);
    const data = raw ? JSON.parse(raw) : null;
    const candidate = data && ALLOWED_AVATARS.includes(data.avatar) ? data.avatar : "🧑‍💻";
    return { avatar: candidate, name: data && typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 24) : "Hero" };
  } catch (e) {
    return { avatar: "🧑‍💻", name: "Hero" };
  }
}

function saveLocalProfile() {
  try { localStorage.setItem(PROFILE_LOCAL_KEY, JSON.stringify(playerProfile)); } catch (e) {}
}

function isAvatarUnlocked(avatar) {
  const meta = AVATAR_META[avatar];
  return !!(meta && meta.unlock());
}

function getUnlockedAvatars() {
  return ALLOWED_AVATARS.filter(isAvatarUnlocked);
}

function normalizeSelectedAvatar() {
  if (!isAvatarUnlocked(playerProfile.avatar)) playerProfile.avatar = getUnlockedAvatars()[0] || "🧑‍💻";
}

export function syncProfileUI() {
  normalizeSelectedAvatar();
  const avatarHud = document.getElementById("player-avatar-hud");
  const vrAvatar = document.getElementById("vr-profile-avatar");
  const vrName = document.getElementById("vr-profile-name");
  const profileNameInput = document.getElementById("profile-name-input");
  const scoreNameInput = document.getElementById("player-name-input");
  const unlockHint = document.getElementById("unlock-hint");

  if (avatarHud) avatarHud.textContent = playerProfile.avatar;
  if (vrAvatar) vrAvatar.setAttribute("value", playerProfile.avatar);
  if (vrName) vrName.setAttribute("value", `Name: ${playerProfile.name}`);
  if (profileNameInput && document.activeElement !== profileNameInput) profileNameInput.value = playerProfile.name;
  if (scoreNameInput && !scoreNameInput.value.trim()) scoreNameInput.value = playerProfile.name;

  let nextGoal = [];
  if (state.currentRewardStreak < 3) nextGoal.push(`Streak ${3 - state.currentRewardStreak} วันเพื่อปลด 🤖`);
  else if (state.currentRewardStreak < 7) nextGoal.push(`Streak อีก ${7 - state.currentRewardStreak} วันเพื่อปลด 👩‍🚀`);
  if (clearedMissions.length < 5) nextGoal.push(`Clear อีก ${5 - clearedMissions.length} ด่านเพื่อปลด 🦾`);
  if (!(state.currentRewardStreak >= 14 && clearedMissions.length >= 12)) {
    if (state.currentRewardStreak < 14) nextGoal.push(`Streak อีก ${14 - state.currentRewardStreak} วัน`);
    if (clearedMissions.length < 12) nextGoal.push(`Clear อีก ${12 - clearedMissions.length} ด่าน`);
  }
  if (unlockHint) unlockHint.textContent = nextGoal.length ? `เป้าหมายถัดไป: ${nextGoal.slice(0, 2).join(" • ")}` : "ปลดล็อก avatar ครบแล้ว!";

  ALLOWED_AVATARS.forEach((avatar, i) => {
    const chip = document.getElementById(`avatar-chip-${i + 1}`);
    if (!chip) return;
    const unlocked = isAvatarUnlocked(avatar);
    chip.classList.toggle("active", avatar === playerProfile.avatar);
    chip.classList.toggle("locked", !unlocked);
    chip.title = unlocked ? `เลือก ${avatar}` : (AVATAR_META[avatar] ? AVATAR_META[avatar].label : "Locked");
  });
}

export function selectAvatar(avatar) {
  if (!ALLOWED_AVATARS.includes(avatar) || !isAvatarUnlocked(avatar)) return false;
  playerProfile.avatar = avatar;
  saveLocalProfile();
  syncProfileUI();
  return true;
}

export async function loadPlayerProfile(db, currentUser, appId) {
  syncProfileUI();
  if (!currentUser || !db) return;
  const { ref, get } = await import("./lesson-firebase.js");
  const profileRef = ref(db, ["artifacts", appId, "users", currentUser.uid, "profile", "main"].join("/"));
  try {
    const snap = await get(profileRef);
    if (snap.exists()) {
      const data = snap.val() || {};
      playerProfile = {
        avatar: ALLOWED_AVATARS.includes(data.avatar) ? data.avatar : playerProfile.avatar,
        name: typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 24) : playerProfile.name
      };
      normalizeSelectedAvatar();
      saveLocalProfile();
      syncProfileUI();
    }
  } catch (e) {
    console.error("Error loading profile:", e);
  }
}

export async function savePlayerProfile(silent = false, db = state.db, currentUser = state.currentUser, appId = state.appId) {
  const input = document.getElementById("profile-name-input");
  const nextName = input && input.value.trim() ? input.value.trim().slice(0, 24) : playerProfile.name || "Hero";
  playerProfile.name = nextName;
  normalizeSelectedAvatar();
  saveLocalProfile();
  syncProfileUI();

  if (!currentUser || !db) return;

  const { ref, set } = await import("./lesson-firebase.js");
  const profileRef = ref(db, ["artifacts", appId, "users", currentUser.uid, "profile", "main"].join("/"));
  try {
    await set(profileRef, { name: playerProfile.name, avatar: playerProfile.avatar, updatedAt: Date.now() });
    if (!silent) {
      const feedback = document.getElementById("feedback");
      if (feedback) {
        feedback.innerText = `✅ โปรไฟล์ถูกบันทึกแล้ว: ${playerProfile.avatar} ${playerProfile.name}`;
        feedback.style.color = "#2ed573";
      }
    }
  } catch (e) {
    console.error("Error saving profile:", e);
  }
}

export function getChestRarity(streak) {
  if (streak >= 14) return { name: "MYTHIC", bonus: 2200, color: "#fd79a8" };
  if (streak >= 7) return { name: "EPIC", bonus: 1400, color: "#a29bfe" };
  if (streak >= 3) return { name: "RARE", bonus: 900, color: "#74b9ff" };
  return { name: "COMMON", bonus: 500, color: "#ffeaa7" };
}

export function showRewardBadge(rarityName, color) {
  const badge = document.getElementById("reward-roll-badge");
  if (!badge) return;
  badge.style.display = "block";
  badge.textContent = `${rarityName} CHEST`;
  badge.style.borderColor = color;
  badge.style.color = color;
  clearTimeout(showRewardBadge._timer);
  showRewardBadge._timer = setTimeout(() => badge.style.display = "none", 2400);
}
