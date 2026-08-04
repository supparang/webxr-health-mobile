import "./firebase-direct-game-launch.js";
import { HHFirebaseClient } from "./herohealth-firebase-client.js";

const params = new URLSearchParams(location.search);
const requestedMode = String(params.get("authority") || "sheet").toLowerCase();
const enabled = requestedMode === "firebase" || requestedMode === "dual";
const studentId = String(params.get("studentId") || params.get("pid") || params.get("sid") || "").trim();

const state = {
  mode: enabled ? requestedMode : "sheet",
  enabled,
  studentId,
  ready: false,
  error: null,
  roster: null,
  progress: null,
  uid: null,
  build: HHFirebaseClient.build
};

async function boot() {
  if (!enabled) {
    state.ready = true;
    window.dispatchEvent(new CustomEvent("hh:firebase-authority-ready", { detail: { ...state } }));
    return state;
  }
  try {
    const user = await HHFirebaseClient.ensureAnonymousUser();
    state.uid = user.uid;
    if (!studentId) throw new Error("missing-student-id");

    const rosterResult = await HHFirebaseClient.readRoster(studentId);
    if (!rosterResult.ok) throw new Error(rosterResult.reason || "roster-failed");
    state.roster = rosterResult.roster;

    const bindingResult = await HHFirebaseClient.bindStudent(studentId);
    if (!bindingResult.ok) throw new Error(bindingResult.reason || "binding-failed");

    const progressResult = await HHFirebaseClient.loadProgress(studentId);
    state.progress = progressResult.progress;
    state.ready = true;
    window.HH_FIREBASE_AUTHORITY = Object.freeze({ ...state });
    window.dispatchEvent(new CustomEvent("hh:firebase-authority-ready", { detail: { ...state } }));
    return state;
  } catch (error) {
    state.error = error?.message || String(error);
    state.ready = true;
    window.HH_FIREBASE_AUTHORITY = Object.freeze({ ...state });
    window.dispatchEvent(new CustomEvent("hh:firebase-authority-error", { detail: { ...state } }));
    return state;
  }
}

window.HHFirebaseBridge = Object.freeze({
  state,
  boot,
  client: HHFirebaseClient,
  loadProgress: () => HHFirebaseClient.loadProgress(studentId),
  saveProgress: (patch) => HHFirebaseClient.saveProgress(studentId, patch)
});

boot();
