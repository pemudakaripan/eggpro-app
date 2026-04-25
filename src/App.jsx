import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  PlusCircle, TrendingUp, Wallet, Package, AlertCircle, CheckCircle2, 
  Activity, HeartPulse, FileSpreadsheet, Printer, BellRing, Box, Plus, PieChart,
  Loader2, Trash2, Edit2, Calendar, Menu, X, Sparkles, Bot
} from 'lucide-react';

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy 
} from 'firebase/firestore';

// --- MASUKKAN KUNCI FIREBASE ANDA DI SINI ---
const firebaseConfig = {
  apiKey: "AIzaSyAE56Dv0Grlj99Kk3kgYMwAC4mM9O-RgbU",
  authDomain: "eggpro-app-1.firebaseapp.com",
  projectId: "eggpro-app-1",
  storageBucket: "eggpro-app-1.firebasestorage.app",
  messagingSenderId: "607351985753",
  appId: "1:607351985753:web:2493bca66bc590dfef0348"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'egg-pro-app';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    population: 350,
    eggPieces: '', eggKg: '', feedUsed: '',
    eggPrice: '', feedPrice: '', unexpected: '',
    dead: '', culled: ''
  });

  // Sinkronisasi Auth
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth error:", err));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Sinkronisasi Data Real-time
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setDailyRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Logika Perhitungan Statistik
  const stats = useMemo(() => {
    const sorted = [...dailyRecords].sort((a, b) => new Date(a.date) - new Date(b.date));
    const processed = sorted.map(r => {
      const rev = (parseFloat(r.eggKg) || 0) * (parseFloat(r.eggPrice) || 0);
      const exp = ((parseFloat(r.feedUsed) || 0) * (parseFloat(r.feedPrice) || 0)) + (parseFloat(r.unexpected) || 0);
      return { ...r, revenue: rev, expense: exp, profit: rev - exp };
    });

    const totalRev = processed.reduce((sum, r) => sum + r.revenue, 0);
    const totalExp = processed.reduce((sum, r) => sum + r.expense, 0);
    
    return { 
      data: processed,
      totalProfit: totalRev - totalExp,
      today: processed[processed.length - 1] || {}
    };
  }, [dailyRecords]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), { ...formData, timestamp: Date.now() });
      setActiveTab('dashboard');
      alert("Data Panen Berhasil Dicatat!");
    } catch (e) { alert("Gagal Simpan"); }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col">
      <Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" />
      <p className="text-slate-500 font-bold italic text-lg animate-pulse">Menghubungkan ke Cloud...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 md:pb-0 md:pl-64">
      {/* Sidebar Desktop */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white p-6 hidden md:block">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-yellow-500 p-2 rounded-lg"><Package className="text-slate-900" /></div>
          <span className="text-xl font-bold tracking-tight text-yellow-500 uppercase">EggPro</span>
        </div>
        <nav className="space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-yellow-500 text-slate-900 font-bold' : 'hover:bg-slate-800'}`}>
            <Activity size={20} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('input')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'input' ? 'bg-yellow-500 text-slate-900 font-bold' : 'hover:bg-slate-800'}`}>
            <PlusCircle size={20} /> Input Panen
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-black text-slate-900">Peternakan Digital</h1>
          <p className="text-slate-500 font-medium">Monitoring Harian Produksi Telur</p>
        </header>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6">
            {/* Kartu Ringkasan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-400 font-bold text-xs uppercase mb-1">Total Keuntungan</p>
                <h3 className="text-2xl font-black text-green-600">Rp {stats.totalProfit.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-slate-400 font-bold text-xs uppercase mb-1">HDP Hari Ini</p>
                <h3 className="text-2xl font-black text-blue-600">
                  {stats.today.population > 0 ? ((stats.today.eggPieces / stats.today.population) * 100).toFixed(1) : 0}%
                </h3>
              </div>
              <div className="bg-yellow-500 p-6 rounded-3xl shadow-lg border border-yellow-400">
                <p className="text-slate-900 font-bold text-xs uppercase mb-1">Populasi Aktif</p>
                <h3 className="text-2xl font-black text-slate-900">{formData.population} Ekor</h3>
              </div>
            </div>

            {/* Grafik */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-80">
              <h4 className="font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} /> Tren Produksi</h4>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Line type="monotone" dataKey="eggPieces" stroke="#eab308" strokeWidth={4} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            
            <button onClick={() => setActiveTab('input')} className="w-full bg-slate-900 text-white p-5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-black transition-all">
              <Plus /> Tambah Data Panen Baru
            </button>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 max-w-lg mx-auto">
            <h2 className="text-xl font-bold mb-6">Formulir Panen</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Butir Telur</label>
                  <input type="number" required value={formData.eggPieces} onChange={e => setFormData({...formData, eggPieces: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 ring-yellow-500" placeholder="150" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Berat (Kg)</label>
                  <input type="number" step="0.01" required value={formData.eggKg} onChange={e => setFormData({...formData, eggKg: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 ring-yellow-500" placeholder="9.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Harga/Kg</label>
                  <input type="number" value={formData.eggPrice} onChange={e => setFormData({...formData, eggPrice: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 ring-yellow-500" placeholder="24000" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase">Pakan (Kg)</label>
                  <input type="number" value={formData.feedUsed} onChange={e => setFormData({...formData, feedUsed: e.target.value})} className="w-full bg-slate-50 border-none p-4 rounded-2xl focus:ring-2 ring-yellow-500" placeholder="40" />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setActiveTab('dashboard')} className="flex-1 bg-slate-100 p-4 rounded-2xl font-bold">Batal</button>
                <button type="submit" className="flex-[2] bg-yellow-500 p-4 rounded-2xl font-bold shadow-lg shadow-yellow-200">Simpan Ke Cloud</button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-around md:hidden z-50">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-yellow-600' : 'text-slate-400'}><Activity /></button>
        <button onClick={() => setActiveTab('input')} className={activeTab === 'input' ? 'text-yellow-600' : 'text-slate-400'}><PlusCircle /></button>
      </nav>
    </div>
  );
};

export default App;
