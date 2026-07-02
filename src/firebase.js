import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBOyN9Sohv_2SEiHVb9OEpS9alVaTHwB4c",
    authDomain: "calorie-tracker-9a1d2.firebaseapp.com",
    projectId: "calorie-tracker-9a1d2",
    storageBucket: "calorie-tracker-9a1d2.firebasestorage.app",
    messagingSenderId: "466150517882",
    appId: "1:466150517882:web:7f9068cb59b7e9f99e5fc3",
    measurementId: "G-N7SHG7GZ7Y"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
