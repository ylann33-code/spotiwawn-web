import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQSrRKg-6SAgPwepZk72By3WObRK3RKmA",
  authDomain: "spotiwawn.firebaseapp.com",
  databaseURL: "https://spotiwawn-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "spotiwawn",
  storageBucket: "spotiwawn.firebasestorage.app",
  messagingSenderId: "448177923533",
  appId: "1:448177923533:web:spotiwawnweb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getDatabase(app);

export { signInWithPopup, signOut, onAuthStateChanged, ref, onValue, set };
