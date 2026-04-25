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

// --- KONFIGURASI FIREBASE ---
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
const appId = 'egg-pro-app';

// --- GEMINI AI HELPER ---
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
    if (!response.ok) throw new Error("API Key Limit atau Bermasalah");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI sedang sibuk.";
  } catch (error) {
    return "Gagal terhubung ke AI. Periksa koneksi atau API Key.";
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

  // AI & Filter States
  const [aiAdvice, setAiAdvice] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [healthAdvice, setHealthAdvice] = useState('');
  const [isHealthAiLoading, setIsHealthAiLoading] = useState(false);
  const [filterType, setFilterType] = useState('7days');

  // Form States
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], population: 350,
    eggPieces: '', eggKg: '', feedUsed: '', eggPrice: '', feedPrice: '', unexpected: '', dead: '', culled: ''
  });
  const [invForm, setInvForm] = useState({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
  const [editingInvId, setEditingInvId] = useState(null);
  const [healthForm, setHealthForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });

  // --- 1. AUTH & DATA SYNC ---
  useEffect(() => {
  const initAuth = async () => {
    try {
      // Langsung gunakan Anonymous Login (Menghapus __initial_auth_token)
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Auth error:", error);
    }
  };
  initAuth();
  const unsubscribe = onAuthStateChanged(auth, setUser);
  return () => unsubscribe();
}, []);

  // --- 2. LOGIKA PERHITUNGAN ---
  const stats = useMemo(() => {
    const sorted = [...dailyRecords].sort((a,b) => new Date(a.date) - new Date(b.date));
    const processed = sorted.map(r => {
      const pop = parseFloat(r.population) || 0;
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

  // --- 3. HANDLERS ---
  const handleDailySubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), { ...formData, timestamp: Date.now() });
    setFormData(prev => ({ ...prev, eggPieces: '', eggKg: '', feedUsed: '', unexpected: '', dead: '', culled: '' }));
    setActiveTab('dashboard');
  };

  const handleAiAdvice = async () => {
    setIsAiLoading(true);
    const prompt = `Analisis performa: HDP ${stats.today.hdp.toFixed(1)}%, FCR ${stats.today.fcr.toFixed(2)}. Berikan saran taktis.`;
    const res = await fetchGeminiAI(prompt, "Konsultan Ahli Peternakan.");
    setAiAdvice(res);
    setIsAiLoading(false);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col">
      <Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" />
      <p className="text-slate-500 font-bold italic">Menghubungkan ke EggPro Cloud...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64 relative">
      
      {/* Sidebar Desktop */}
      <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 p-6 shadow-xl z-10">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-yellow-500 p-2 rounded-xl"><Package className="text-slate-900" /></div>
          <span className="text-2xl font-black tracking-tighter text-yellow-500 uppercase">EggPro</span>
        </div>
        <nav className="space-y-2 flex-1">
          <NavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavBtn active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle />} label="Input Harian" />
          <NavBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box />} label="Stok Barang" />
          <NavBtn active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon={<HeartPulse />} label="Kesehatan" />
          <NavBtn active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<FileSpreadsheet />} label="Riwayat & Laporan" />
        </nav>
      </div>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        <header className="mb-8 md:flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Dashboard Utama</h1>
            <p className="text-slate-500 font-medium italic">Manajemen Peternakan Digital Anda</p>
          </div>
          <div className="hidden md:flex gap-2">
             <button onClick={() => window.print()} className="bg-white border p-3 rounded-2xl shadow-sm"><Printer size={20}/></button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="HDP" value={`${stats.today.hdp.toFixed(1)}%`} subtext="Produktivitas" icon={<Activity className="text-blue-500" />} />
              <StatCard label="FCR" value={stats.today.fcr.toFixed(2)} subtext="Efisiensi Pakan" icon={<PieChart className="text-purple-500" />} />
              <StatCard label="Profit" value={`Rp ${stats.totalProfit.toLocaleString()}`} subtext="Periode Ini" icon={<Wallet className="text-green-500" />} />
              <StatCard label="Populasi" value={stats.today.pop} subtext="Ekor Aktif" icon={<Package className="text-yellow-500" />} />
            </div>

            {/* AI Advisor Banner */}
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="bg-blue-500 p-1.5 rounded-lg"><Bot size={18} /></div>
                    <h3 className="font-bold text-xl">AI Farm Advisor</h3>
                  </div>
                  <p className="text-slate-400 max-w-md">Klik untuk mendapatkan analisis cerdas berdasarkan data HDP dan FCR kandang Anda hari ini.</p>
                </div>
                <button onClick={handleAiAdvice} className="w-full md:w-auto bg-yellow-500 text-slate-900 px-8 py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2">
                  {isAiLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                  {isAiLoading ? 'Menganalisis...' : 'Minta Saran Strategis'}
                </button>
              </div>
              {aiAdvice && (
                <div className="mt-6 bg-white/10 p-6 rounded-3xl border border-white/10 backdrop-blur-sm text-blue-100 text-sm leading-relaxed animate-in fade-in slide-in-from-top-4">
                  {aiAdvice}
                </div>
              )}
            </div>

            {/* Grafik Performa */}
            <div className="bg-white p-6 md:p-8 rounded-[40px] shadow-sm border border-slate-100 h-96">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Tren Produksi Telur (Butir)</h3>
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.filtered}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="eggPieces" name="Produksi" stroke="#eab308" strokeWidth={5} dot={{r: 6, fill: '#eab308', strokeWidth: 3, stroke: '#fff'}} activeDot={{r: 8}} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-xl mx-auto bg-white p-8 md:p-12 rounded-[50px] shadow-2xl border border-slate-50">
            <div className="text-center mb-8">
              <div className="bg-yellow-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <PlusCircle className="text-yellow-600 w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black text-slate-900">Input Harian</h2>
              <p className="text-slate-400 font-medium">Catat hasil panen hari ini ke Cloud</p>
            </div>
            <form onSubmit={handleDailySubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Tanggal" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <InputGroup label="Populasi (Ekor)" type="number" value={formData.population} onChange={e => setFormData({...formData, population: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Hasil (Butir)" type="number" value={formData.eggPieces} onChange={e => setFormData({...formData, eggPieces: e.target.value})} />
                <InputGroup label="Berat (Kg)" type="number" step="0.1" value={formData.eggKg} onChange={e => setFormData({...formData, eggKg: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Pakan (Kg)" type="number" step="0.1" value={formData.feedUsed} onChange={e => setFormData({...formData, feedUsed: e.target.value})} />
                <InputGroup label="Harga Telur/Kg" type="number" value={formData.eggPrice} onChange={e => setFormData({...formData, eggPrice: e.target.value})} />
              </div>
              <InputGroup label="Harga Pakan/Kg" type="number" value={formData.feedPrice} onChange={e => setFormData({...formData, feedPrice: e.target.value})} />
              <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-3xl font-black text-lg shadow-xl hover:bg-black transition-all transform hover:-translate-y-1">
                SIMPAN DATA SEKARANG
              </button>
            </form>
          </div>
        )}

        {/* Tab-tab lainnya tetap menggunakan struktur desain yang sama */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <h2 className="font-black text-slate-800">RIWAYAT PANEN LENGKAP</h2>
                <button onClick={() => {
                  const csv = "Tanggal,Butir,Kg,HDP,Profit\n" + stats.all.map(r => `${r.date},${r.eggPieces},${r.eggKg},${r.hdp.toFixed(1)},${r.profit}`).join("\n");
                  const blob = new Blob([csv], {type: 'text/csv'});
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'Laporan_EggPro.csv'; a.click();
                }} className="text-xs font-bold text-green-600 flex items-center gap-1 hover:underline"><FileSpreadsheet size={14}/> Export CSV</button>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr>
                      <th className="p-6">Tanggal</th><th className="p-6 text-center">Butir</th><th className="p-6 text-center">HDP</th><th className="p-6 text-right">Laba</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.all.slice().reverse().map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6 font-bold text-slate-700">{r.date}</td>
                        <td className="p-6 text-center font-medium">{r.eggPieces}</td>
                        <td className="p-6 text-center font-black text-blue-600">{r.hdp.toFixed(1)}%</td>
                        <td className="p-6 text-right font-black text-green-600">Rp {r.profit.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>
        )}
      </main>

      {/* Navigasi Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-3 flex justify-around shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50">
        <MobileNavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
        <MobileNavBtn active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle />} label="Input" />
        <MobileNavBtn active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<FileSpreadsheet />} label="Laporan" />
      </nav>
    </div>
  );
};

// --- KOMPONEN PENDUKUNG ---
const StatCard = ({ label, value, subtext, icon }) => (
  <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group">
    <div className="absolute -right-2 -bottom-2 opacity-5 transform group-hover:scale-110 transition-transform">
       {React.cloneElement(icon, { size: 80 })}
    </div>
    <div className="flex justify-between items-start relative z-10">
      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
      <div className="p-1.5 bg-slate-50 rounded-lg">{React.cloneElement(icon, { size: 16 })}</div>
    </div>
    <div className="relative z-10">
      <div className="text-2xl font-black text-slate-800 tracking-tight">{value}</div>
      <div className="text-[10px] font-bold text-slate-400">{subtext}</div>
    </div>
  </div>
);

const InputGroup = ({ label, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
    <input className="bg-slate-50 border-none p-4 rounded-[20px] focus:ring-2 focus:ring-yellow-500 outline-none font-bold text-slate-700" {...props} />
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition-all duration-200 ${active ? 'bg-yellow-500 text-slate-900 font-black shadow-lg shadow-yellow-500/20 translate-x-2' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
    <span className="mr-3">{React.cloneElement(icon, { size: 20 })}</span>
    {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 p-1 flex-1 transition ${active ? 'text-yellow-600' : 'text-slate-400'}`}>
    {React.cloneElement(icon, { size: 20, strokeWidth: active ? 3 : 2 })}
    <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </button>
);

export default App;
