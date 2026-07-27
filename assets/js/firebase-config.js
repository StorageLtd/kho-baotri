// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAvpguQWSOCpNiCFej27hwK5ulZSPSBRk4",
  authDomain: "ltdst-80b3e.firebaseapp.com",
  databaseURL: "https://ltdst-80b3e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ltdst-80b3e",
  storageBucket: "ltdst-80b3e.firebasestorage.app",
  messagingSenderId: "605858752960",
  appId: "1:605858752960:web:e28b803b2b7f77b9824025",
  measurementId: "G-BT2RV4VVR8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);