import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  PlusCircle, TrendingUp, Wallet, Package, AlertCircle, CheckCircle2, 
  Activity, HeartPulse, FileSpreadsheet, Printer, BellRing, Box, Plus, PieChart,
  Loader2, Trash2, Edit2, Calendar, Menu, X
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';

// ==========================================================
// 1. TEMPELKAN KUNCI FIREBASE BARU ANDA DI SINI NANTI
// ==========================================================
const firebaseConfig = {
  apiKey: "KUNCI_BARU_ANDA",
  authDomain: "PROJECT_BARU.firebaseapp.com",
  projectId: "PROJECT_BARU",
  storageBucket: "PROJECT_BARU.firebasestorage.app",
  messagingSenderId: "NOMOR_SENDER",
  appId: "ID_APP_ANDA"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'egg-pro-app';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Sensor error baru
  const [dailyRecords, setDailyRecords] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    population: 350,
    eggPieces: '', eggKg: '', feedUsed: '',
    eggPrice: '', feedPrice: '', unexpected: '',
    dead: '', culled: ''
  });

  // ==========================================================
  // 2. SISTEM KONEKSI (DENGAN PENGECEKAN ERROR)
  // ==========================================================
  useEffect(() => {
    console.log("Mencoba menyambung ke Firebase...");
    
    signInAnonymously(auth)
      .then(() => console.log("Koneksi Berhasil!"))
      .catch(err => {
        console.error("Gagal konek:", err.code);
        setError("Gagal menyambung ke Cloud. Pastikan API Key benar dan Anonymous Auth sudah aktif.");
        setLoading(false);
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        console.log("User terdeteksi:", user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Ambil Data dari Firestore
    const unsubRecords = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), (snap) => {
      setDailyRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setError("Izin Database ditolak. Cek Rules Firestore Anda.");
      setLoading(false);
    });

    return () => unsubRecords();
  }, [user]);

  const handleDailySubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), { ...formData, timestamp: Date.now() });
      setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0], unexpected: '', dead: '', culled: '' }));
      setActiveTab('dashboard');
      alert("Data berhasil disimpan ke Cloud!");
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    }
  };

  // ==========================================================
  // 3. TAMPILAN (UI)
  // ==========================================================
  
  // Tampilan jika sedang Loading
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col">
      <Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" />
      <p className="text-slate-500 font-bold">Menghubungkan ke Cloud...</p>
    </div>
  );

  // Tampilan jika ada Error (Kunci Salah / Domain Belum Terdaftar)
  if (error) return (
    <div className="h-screen flex items-center justify-center bg-red-50 p-6 flex-col text-center">
      <AlertCircle className="text-red-600 w-16 h-16 mb-4" />
      <h2 className="text-xl font-bold text-red-800 mb-2">Waduh, Ada Kendala!</h2>
      <p className="text-red-600 mb-6">{error}</p>
      <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-2 rounded-lg">Coba Segarkan Halaman</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64 relative">
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4 text-yellow-600 flex items-center gap-2">
              <Package /> EggPro Dashboard
            </h1>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
              <p className="text-slate-600 italic">"Gunakan aplikasi ini untuk mencatat hasil panen telur harian Anda."</p>
            </div>
            
            <button onClick={() => setActiveTab('input')} className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg transition-all">
              Mulai Input Data Harian
            </button>

            {activeTab === 'input' && (
                <form onSubmit={handleDailySubmit} className="mt-8 space-y-4 bg-white p-6 rounded-2xl shadow-xl border-t-4 border-yellow-500 max-w-md">
                    <h3 className="font-bold text-lg mb-4">Form Panen Telur</h3>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Tanggal</label>
                      <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="border p-3 w-full rounded-lg bg-slate-50" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 uppercase">Jumlah Telur (Butir)</label>
                      <input type="number" placeholder="Contoh: 150" value={formData.eggPieces} onChange={e => setFormData({...formData, eggPieces: e.target.value})} className="border p-3 w-full rounded-lg bg-slate-50" />
                    </div>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl w-full font-bold shadow-md">
                      Simpan ke Cloud
                    </button>
                </form>
            )}
        </div>
    </div>
  );
};

export default App;
