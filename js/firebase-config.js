//
// 📌 請將下面的值換成你的 Firebase 專案設定
// 到 https://console.firebase.google.com → 專案設定 → 一般 → 你的應用程式 → 網頁應用程式
//
const firebaseConfig = {
  apiKey: "AIzaSyA0...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
