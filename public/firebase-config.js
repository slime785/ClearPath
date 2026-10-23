import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3HVuENYpZ1gCpBr8aB8oz9Jp8ZAdeZQQ",
  authDomain: "clearpath-cbf40.firebaseapp.com",
  projectId: "clearpath-cbf40",
  storageBucket: "clearpath-cbf40.firebasestorage.app",
  messagingSenderId: "291378915033",
  appId: "1:291378915033:web:3074989823f600b1b4c0c8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);