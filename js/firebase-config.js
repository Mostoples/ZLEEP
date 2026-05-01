const firebaseConfig = {
  apiKey: "AIzaSyB0tLjxDxO1qPInwtcMgGo6E5PIMniKhZU",
  authDomain: "zleep-id.firebaseapp.com",
  databaseURL: "https://zleep-id-default-rtdb.firebaseio.com",
  projectId: "zleep-id",
  storageBucket: "zleep-id.firebasestorage.app",
  messagingSenderId: "429726338101",
  appId: "1:429726338101:web:f12f1d03aec0d64229b57c"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
