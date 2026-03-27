// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
  authDomain: "herohealth-d7f8c.firebaseapp.com",
  databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "herohealth-d7f8c",
  storageBucket: "herohealth-d7f8c.firebasestorage.app",
  messagingSenderId: "680817376848",
  appId: "1:680817376848:web:eed21b522b0703f6bd9b55",
  measurementId: "G-T5J8DC0BKD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Expose config for HeroHealth runtime
window.HHA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyB5WmSR9uMYX2bwDh2iFYZwGglXGIq5Ijo",
  authDomain: "herohealth-d7f8c.firebaseapp.com",
  databaseURL: "https://herohealth-d7f8c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "herohealth-d7f8c",
  storageBucket: "herohealth-d7f8c.firebasestorage.app",
  messagingSenderId: "680817376848",
  appId: "1:680817376848:web:eed21b522b0703f6bd9b55",
  measurementId: "G-T5J8DC0BKD"
};

window.HHA_FIREBASE_APP = app;
window.HHA_FIREBASE_ANALYTICS = analytics;