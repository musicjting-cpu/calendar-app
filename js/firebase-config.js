const firebaseConfig = {
  apiKey: "AIzaSyC5CjcxYFu2dpPMA_heHvjXLW3wDyShNa0",
  authDomain: "new-student-calendar.firebaseapp.com",
  projectId: "new-student-calendar",
  storageBucket: "new-student-calendar.firebasestorage.app",
  messagingSenderId: "689906547166",
  appId: "1:689906547166:web:4e0d9c666bceeecd8e054f",
  measurementId: "G-RFGZPQB2V3"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
