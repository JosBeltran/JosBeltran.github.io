import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGmQVwen8R1wNrXsocPUzDwSaaA3do3zg",
  authDomain: "josue-art-gallery.firebaseapp.com",
  projectId: "josue-art-gallery",
  storageBucket: "josue-art-gallery.firebasestorage.app",
  messagingSenderId: "121280968552",
  appId: "1:121280968552:web:5d8a5296012be969b388dd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 🟢 Forzamos Long Polling y evitamos dependencias de IndexedDB/WebSockets
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, storage, googleProvider };