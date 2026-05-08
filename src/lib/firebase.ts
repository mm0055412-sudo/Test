import { initializeApp, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCmtOmJmX6MekinySivrm5emlDEpdYcUv0",
  authDomain: "mybazar-272d8.firebaseapp.com",
  databaseURL: "https://mybazar-272d8-default-rtdb.firebaseio.com",
  projectId: "mybazar-272d8",
  storageBucket: "mybazar-272d8.firebasestorage.app",
  messagingSenderId: "1045121511904",
  appId: "1:1045121511904:web:ba41a39ae6de8bc2c73b85",
  measurementId: "G-52RVX5MXZE"
};

let firebaseApp: FirebaseApp;

// Client-side check
if (typeof window !== "undefined") {
  try {
    firebaseApp = getApp();
  } catch {
    firebaseApp = initializeApp(firebaseConfig);
    isSupported().then(supported => {
      if (supported) {
        getAnalytics(firebaseApp);
      }
    });
  }
}

export const getFirebaseApp = (): FirebaseApp => {
    if (!firebaseApp) {
         if (typeof window === "undefined") {
            throw new Error("Firebase can only be initialized on the client side.");
         }
         firebaseApp = initializeApp(firebaseConfig);
          isSupported().then(supported => {
            if (supported) {
              getAnalytics(firebaseApp);
            }
          });
    }
    return firebaseApp;
}

export const getFirebaseAuth = () => getAuth(getFirebaseApp());
