// public/firebase-config.js
// Central Firebase configuration module — all other JS files import from here.
// Uses Firebase v10 CDN (modular ES6) as required by the project spec.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBOyN9Sohv_2SEiHVb9OEpS9alVaTHwB4c",
    authDomain: "calorie-tracker-9a1d2.firebaseapp.com",
    projectId: "calorie-tracker-9a1d2",
    storageBucket: "calorie-tracker-9a1d2.firebasestorage.app",
    messagingSenderId: "466150517882",
    appId: "1:466150517882:web:7f9068cb59b7e9f99e5fc3",
    measurementId: "G-N7SHG7GZ7Y"
};

// Initialize the Firebase instances
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Export the instances so our other JS modules can use them
export { app, auth, db, googleProvider };