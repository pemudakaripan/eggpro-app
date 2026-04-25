import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, limit } from 'firebase/firestore';

// --- KONFIGURASI ASLI ANDA ---
const firebaseConfig = {
  apiKey: "AIzaSyALPl6gzZDh_p1kxURiLAum2Aygg2_mL9o",
  authDomain: "eggpro-ternak.firebaseapp.com",
  projectId: "eggpro-ternak",
  storageBucket: "eggpro-ternak.firebasestorage.app",
  messagingSenderId: "844870453044",
  appId: "1:844870453044:web:ceda181085587bb6830761"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const App = () => {
  const [status, setStatus] = useState("Memulai koneksi...");
  const [user, setUser] = useState(null);
  const [testData, setTestData] = useState([]);

  useEffect(() => {
    // 1. Tes Login
    signInAnonymously(auth)
      .then(() => setStatus("✅ Berhasil Masuk Cloud (Auth OK)"))
      .catch(err => setStatus("❌ Gagal Login: " + err.message));

    onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // 2. Tes Baca Data (Ambil 5 data terakhir)
        const q = query(collection(db, "tes_koneksi"), limit(5));
        onSnapshot(q, (snap) => {
          const docs = snap.docs.map(d => d.data().pesan);
          setTestData(docs);
          setStatus("✅ Cloud Terhubung & Data Terbaca!");
        }, (err) => {
          setStatus("❌ Gagal Baca Database: " + err.message);
        });
      }
    });
  }, []);

  const kirimDataTes = async () => {
    if (!user) return alert("Belum login!");
    setStatus("Sedang mengirim...");
    try {
      await addDoc(collection(db, "tes_koneksi"), {
        pesan: "Percobaan pada " + new Date().toLocaleTimeString(),
        timestamp: Date.now()
      });
      setStatus("✅ Data Berhasil Terkirim!");
    } catch (err) {
      setStatus("❌ Gagal Kirim: " + err.message);
    }
  };

  return (
    <div style={{ padding: '50px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1 style={{ color: '#eab308' }}>EggPro Diagnostic Tool</h1>
      <div style={{ padding: '20px', background: '#f1f5f9', borderRadius: '20px', marginBottom: '20px' }}>
        <p style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Status: {status}</p>
        <p>User ID: {user ? user.uid : "Mencari..."}</p>
      </div>

      <button 
        onClick={kirimDataTes}
        style={{ padding: '15px 30px', fontSize: '1rem', background: '#000', color: '#fff', borderRadius: '15px', cursor: 'pointer' }}
      >
        KLIK UNTUK TES KIRIM DATA
      </button>

      <div style={{ marginTop: '30px', textAlign: 'left', maxWidth: '400px', margin: '30px auto' }}>
        <h3>Data di Cloud:</h3>
        <ul>
          {testData.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
      
      <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
        Jika status menunjukkan "Gagal Baca Database (Missing Permissions)", <br/> 
        berarti Anda harus mengubah **Rules** di Firebase Console menjadi **true**.
      </p>
    </div>
  );
};

export default App;
