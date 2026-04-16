// /english/js/lesson-auth.js
'use strict';

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'english-d4bfa.firebaseapp.com',
  databaseURL: 'https://english-d4bfa-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'english-d4bfa',
  appId: 'YOUR_APP_ID'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export async function getAnonymousIdToken() {
  const cred = await signInAnonymously(auth);
  return cred.user.getIdToken();
}
