import React, { useState, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  PlusCircle, TrendingUp, Wallet, Package, AlertCircle, CheckCircle2, 
  Settings, LayoutDashboard, ShoppingCart, Calculator,
  Activity, HeartPulse, FileSpreadsheet, Printer, BellRing, Box, Plus, PieChart,
  Loader2, Trash2, Edit2, Calendar, Menu, X, Sparkles, Bot
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy 
} from 'firebase/firestore';

// ============================================================================
// --- 1. INITIALIZE FIREBASE (KUNCI TERBARU PROYEK EGGPRO-APP-1) ---
// ============================================================================
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

// ============================================================================
// --- 2. GEMINI API HELPER (KUNCI GEMINI ANDA) ---
// ============================================================================
const fetchGeminiAI = async (prompt, systemInstruction) => {
  const apiKey = "AIzaSyAXOok0zLWHZmTyf_i70wJoKFsyl6r7YOE"; 
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI sedang offline.";
  } catch (error) {
    return "Gagal terhubung ke AI. Cek koneksi atau kuota API Key.";
  }
};

const App = () => {
  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [aiAdvice, setAiAdvice] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [healthAdvice, setHealthAdvice] = useState('');
  const [isHealthAiLoading, setIsHealthAiLoading] = useState(false);

  const [filterType, setFilterType] = useState('7days');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], population: 350,
    eggPieces: '', eggKg: '', feedUsed: '', eggPrice: '', feedPrice: '', unexpected: '', dead: '', culled: ''
  });

  const [invForm, setInvForm] = useState({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
  const [healthForm, setHealthForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });

  // ============================================================================
  // --- 3. AUTHENTICATION & SYNC ENGINE ---
  // ============================================================================
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Cloud Login Error:", err));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubRecords = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), (snap) => {
      setDailyRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubInv = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubHealth = onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'health'), (snap) => {
      setHealthLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubRecords(); unsubInv(); unsubHealth(); };
  }, [user]);

  // ============================================================================
  // --- 4. ENGINE PERHITUNGAN ---
  // ============================================================================
  const stats = useMemo(() => {
    const sorted = [...dailyRecords].sort((a,b) => new Date(a.date) - new Date(b.date));
    const processed = sorted.map(r => {
      const pop = parseFloat(r.population) || 350;
      const rev = (parseFloat(r.eggKg) || 0) * (parseFloat(r.eggPrice) || 0);
      const exp = ((parseFloat(r.feedUsed) || 0) * (parseFloat(r.feedPrice) || 0)) + (parseFloat(r.unexpected) || 0);
      const hdp = pop > 0 ? ((parseFloat(r.eggPieces) || 0) / pop) * 100 : 0;
      const fcr = (parseFloat(r.eggKg) || 0) > 0 ? (parseFloat(r.feedUsed) || 0) / (parseFloat(r.eggKg) || 0) : 0;
      return { ...r, revenue: rev, totalExpense: exp, profit: rev - exp, hdp, fcr, pop };
    });

    const now = new Date();
    const filtered = processed.filter(r => {
      if (filterType === '7days') return new Date(r.date) > new Date(now.setDate(now.getDate() - 7));
      return true;
    });

    return { 
      filtered, all: processed, 
      totalProfit: filtered.reduce((s, r) => s + r.profit, 0),
      today: processed[processed.length - 1] || { hdp: 0, fcr: 0, pop: 350 }
    };
  }, [dailyRecords, filterType]);

  // ============================================================================
  // --- 5. RENDER UI ---
  // ============================================================================
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col">
      <Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" />
      <p className="text-slate-500 font-black tracking-widest">SINKRONISASI CLOUD EGGPRO-APP-1...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64 relative">
      
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 p-6 shadow-2xl z-10">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-yellow-500 p-2 rounded-2xl"><Activity className="text-slate-900" /></div>
          <span className="text-2xl font-black text-yellow-500 tracking-tighter">EGGPRO</span>
        </div>
        <nav className="space-y-2">
          <NavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavBtn active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle />} label="Catat Panen" />
          <NavBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box />} label="Gudang Stok" />
          <NavBtn active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon={<HeartPulse />} label="Kesehatan" />
          <NavBtn active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<FileSpreadsheet />} label="Riwayat & Laporan" />
        </nav>
      </aside>

      <main className="p-4 md:p-10 max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-black text-slate-900">Dashboard Utama</h1>
          <p className="text-slate-400 font-bold text-sm uppercase">Cloud Project: {firebaseConfig.projectId}</p>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Scorecards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <StatCard label="HDP" value={`${stats.today.hdp.toFixed(1)}%`} subtext="Produktivitas" icon={<Activity className="text-blue-500" />} />
              <StatCard label="FCR" value={stats.today.fcr.toFixed(2)} subtext="Rasio Pakan" icon={<PieChart className="text-purple-500" />} />
              <StatCard label="Laba" value={`Rp ${stats.totalProfit.toLocaleString()}`} subtext="Periode Ini" icon={<Wallet className="text-green-500" />} />
              <StatCard label="Populasi" value={stats.today.pop} subtext="Ekor Aktif" icon={<Package className="text-yellow-500" />} />
            </div>

            {/* AI Advisor Banner */}
            <div className="bg-slate-900 rounded-[45px] p-8 md:p-12 text-white shadow-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-[100px]"></div>
              <div className="relative z-10 md:flex justify-between items-center gap-10">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-full text-xs font-black uppercase mb-4">
                    <Bot size={14}/> AI Farm Advisor ✨
                  </div>
                  <h3 className="text-3xl font-black mb-4">Butuh saran ahli?</h3>
                  <p className="text-slate-400 font-medium leading-relaxed">Analisis cerdas berdasarkan performa kandang Anda hari ini.</p>
                </div>
                <button onClick={async () => {
                   setIsAiLoading(true);
                   const res = await fetchGeminiAI(`Analisis HDP ${stats.today.hdp.toFixed(1)}% dan FCR ${stats.today.fcr.toFixed(2)}.`, "Konsultan Peternakan.");
                   setAiAdvice(res);
                   setIsAiLoading(false);
                }} className="bg-yellow-500 text-slate-900 px-10 py-5 rounded-[25px] font-black shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-3">
                  {isAiLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}
                  SARAN AI
                </button>
              </div>
              {aiAdvice && <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/10 text-blue-100 text-sm leading-relaxed">{aiAdvice}</div>}
            </div>

            {/* Grafik Performa */}
            <div className="bg-white p-8 rounded-[45px] shadow-sm border border-slate-100 h-[400px]">
               <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px] mb-8">Tren Produksi 7 Hari</h3>
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.filtered}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{borderRadius: '25px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="eggPieces" stroke="#eab308" strokeWidth={6} dot={{r: 6, fill: '#eab308', strokeWidth: 4, stroke: '#fff'}} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-xl mx-auto bg-white p-10 md:p-16 rounded-[60px] shadow-3xl border border-slate-50 animate-in zoom-in-95 duration-300">
            <h2 className="text-4xl font-black text-slate-900 mb-10 text-center tracking-tighter">Catat Panen</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), {...formData, timestamp: Date.now()});
              setActiveTab('dashboard');
            }} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Tanggal" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <InputGroup label="Populasi" type="number" value={formData.population} onChange={e => setFormData({...formData, population: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Hasil (Butir)" type="number" value={formData.eggPieces} onChange={e => setFormData({...formData, eggPieces: e.target.value})} />
                <InputGroup label="Berat (Kg)" type="number" step="0.1" value={formData.eggKg} onChange={e => setFormData({...formData, eggKg: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Pakan (Kg)" type="number" step="0.1" value={formData.feedUsed} onChange={e => setFormData({...formData, feedUsed: e.target.value})} />
                <InputGroup label="Harga Jual/Kg" type="number" value={formData.eggPrice} onChange={e => setFormData({...formData, eggPrice: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white p-6 rounded-[30px] font-black text-xl shadow-2xl hover:bg-black transition-all">SIMPAN KE DATABASE</button>
            </form>
          </div>
        )}
      </main>

      {/* Navigasi Mobile */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 flex justify-around rounded-[35px] shadow-2xl z-50">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><LayoutDashboard /></button>
        <button onClick={() => setActiveTab('input')} className={activeTab === 'input' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><PlusCircle /></button>
        <button onClick={() => setActiveTab('reports')} className={activeTab === 'reports' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><FileSpreadsheet /></button>
      </nav>
    </div>
  );
};

// --- HELPER COMPONENTS ---
const StatCard = ({ label, value, subtext, icon }) => (
  <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group">
    <div className="absolute -right-4 -bottom-4 opacity-5 transform group-hover:scale-125 transition-all">{React.cloneElement(icon, { size: 100 })}</div>
    <div className="flex justify-between items-start relative z-10">
      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
      <div className="p-2 bg-slate-50 rounded-xl">{React.cloneElement(icon, { size: 18 })}</div>
    </div>
    <div className="relative z-10 mt-auto">
      <div className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{value}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{subtext}</div>
    </div>
  </div>
);

const InputGroup = ({ label, ...props }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">{label}</label>
    <input className="bg-slate-100/50 border-none p-5 rounded-[25px] focus:ring-4 ring-yellow-500/20 outline-none font-bold text-slate-700" {...props} />
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-[22px] transition-all duration-300 ${active ? 'bg-yellow-500 text-slate-900 font-black shadow-xl shadow-yellow-500/30 translate-x-2' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
    <span className="mr-4">{React.cloneElement(icon, { size: 22, strokeWidth: active ? 3 : 2 })}</span>
    <span className="tracking-tight">{label}</span>
  </button>
);

export default App;
