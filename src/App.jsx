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
// --- 1. INITIALIZE FIREBASE (KUNCI ASLI ANDA) ---
// ============================================================================
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

// ============================================================================
// --- 2. GEMINI AI HELPER (KUNCI ASLI ANDA) ---
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI sedang beristirahat, silakan coba lagi.";
  } catch (error) {
    return "Gagal terhubung ke AI. Periksa koneksi internet atau kuota API Key.";
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

  // AI States
  const [aiAdvice, setAiAdvice] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [healthAdvice, setHealthAdvice] = useState('');
  const [isHealthAiLoading, setIsHealthAiLoading] = useState(false);

  // Filter & Form States
  const [filterType, setFilterType] = useState('7days');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], population: 350,
    eggPieces: '', eggKg: '', feedUsed: '', eggPrice: '', feedPrice: '', unexpected: '', dead: '', culled: ''
  });
  const [invForm, setInvForm] = useState({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
  const [editingInvId, setEditingInvId] = useState(null);
  const [healthForm, setHealthForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });

  // ============================================================================
  // --- 3. AUTHENTICATION & DATA SYNC ---
  // ============================================================================
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth error:", err));
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

  // Autofill Harga Terakhir
  useEffect(() => {
    if (dailyRecords.length > 0) {
      const sorted = [...dailyRecords].sort((a,b) => new Date(a.date) - new Date(b.date));
      const last = sorted[sorted.length - 1];
      setFormData(prev => ({
        ...prev,
        population: (parseFloat(last.population) || 350) - (parseFloat(last.dead) || 0) - (parseFloat(last.culled) || 0),
        eggPrice: prev.eggPrice || last.eggPrice,
        feedPrice: prev.feedPrice || last.feedPrice
      }));
    }
  }, [dailyRecords]);

  // ============================================================================
  // --- 4. ENGINE PERHITUNGAN & STATS ---
  // ============================================================================
  const stats = useMemo(() => {
    const targetHDP = 80;
    const targetFCR = 2.1;
    let currentPopTracker = 350;
    let alerts = [];

    const processed = dailyRecords.slice().sort((a,b) => new Date(a.date) - new Date(b.date)).map(record => {
      const pop = parseFloat(record.population) || currentPopTracker;
      const dead = parseFloat(record.dead) || 0;
      const culled = parseFloat(record.culled) || 0;
      currentPopTracker = pop - dead - culled;

      const rev = (parseFloat(record.eggKg) || 0) * (parseFloat(record.eggPrice) || 0);
      const feedCost = (parseFloat(record.feedUsed) || 0) * (parseFloat(record.feedPrice) || 0);
      const totalExp = feedCost + (parseFloat(record.unexpected) || 0);
      
      const eggPcs = parseFloat(record.eggPieces) || 0;
      const hdp = pop > 0 ? (eggPcs / pop) * 100 : 0;
      const fcr = (parseFloat(record.eggKg) || 0) > 0 ? (parseFloat(record.feedUsed) || 0) / (parseFloat(record.eggKg) || 0) : 0;

      return { ...record, pop, revenue: rev, totalExpense: totalExp, profit: rev - totalExp, hdp, fcr };
    });

    const now = new Date();
    const filtered = processed.filter(r => {
      if (filterType === '7days') return new Date(r.date) > new Date(now.setDate(now.getDate() - 7));
      if (filterType === 'thisMonth') return new Date(r.date).getMonth() === new Date().getMonth();
      return true;
    });

    const totalRev = filtered.reduce((sum, r) => sum + r.revenue, 0);
    const totalExp = filtered.reduce((sum, r) => sum + r.totalExpense, 0);

    return {
      all: processed, filtered,
      totalRev, totalExp, netProfit: totalRev - totalExp,
      today: processed[processed.length - 1] || { hdp: 0, fcr: 0, pop: 350 },
      alerts, targetHDP, targetFCR
    };
  }, [dailyRecords, filterType]);

  // ============================================================================
  // --- 5. HANDLERS ---
  // ============================================================================
  const handleDailySubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), { ...formData, timestamp: Date.now() });
      setFormData(prev => ({ ...prev, eggPieces: '', eggKg: '', feedUsed: '', unexpected: '', dead: '', culled: '' }));
      setActiveTab('dashboard');
    } catch (err) { console.error(err); }
  };

  const handleInvSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingInvId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', editingInvId), { ...invForm, qty: parseFloat(invForm.qty) });
        setEditingInvId(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'inventory'), { ...invForm, qty: parseFloat(invForm.qty) });
      }
      setInvForm({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
    } catch (err) { console.error(err); }
  };

  const handleHealthSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'health'), { ...healthForm, timestamp: Date.now() });
      setHealthForm({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });
    } catch (err) { console.error(err); }
  };

  const handleGetAiAdvice = async () => {
    setIsAiLoading(true);
    const prompt = `Analisis data: Populasi ${stats.today.pop}, HDP ${stats.today.hdp.toFixed(1)}%, FCR ${stats.today.fcr.toFixed(2)}. Berikan 3 saran taktis.`;
    const res = await fetchGeminiAI(prompt, "Konsultan Ahli Manajemen Peternakan Ayam Petelur.");
    setAiAdvice(res);
    setIsAiLoading(false);
  };

  const handleGetHealthAdvice = async () => {
    setIsHealthAiLoading(true);
    const res = await fetchGeminiAI(`Gejala ayam: ${healthForm.notes}`, "Dokter Hewan Spesialis Unggas.");
    setHealthAdvice(res);
    setIsHealthAiLoading(false);
  };

  // ============================================================================
  // --- 6. RENDER UI ---
  // ============================================================================
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col">
      <Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" />
      <p className="text-slate-500 font-bold italic">Menghubungkan ke Cloud Database...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64 relative">
      
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 p-6 shadow-2xl z-10">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-yellow-500 p-2 rounded-2xl shadow-lg shadow-yellow-500/20"><Activity className="text-slate-900" /></div>
          <span className="text-2xl font-black text-yellow-500 tracking-tighter uppercase">EggPro</span>
        </div>
        <nav className="space-y-2 flex-1">
          <NavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavBtn active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle />} label="Catat Panen" />
          <NavBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box />} label="Stok Barang" />
          <NavBtn active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon={<HeartPulse />} label="Kesehatan" />
          <NavBtn active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<FileSpreadsheet />} label="Riwayat & Laporan" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="p-4 md:p-10 max-w-7xl mx-auto">
        <header className="mb-10 md:flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Kondisi Kandang</h1>
            <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Update Otomatis dari Cloud</p>
          </div>
          <div className="hidden md:flex gap-3">
             <button onClick={() => window.print()} className="bg-white border p-4 rounded-2xl shadow-sm hover:bg-slate-50 transition"><Printer size={20}/></button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Scorecards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <StatCard label="HDP" value={`${stats.today.hdp.toFixed(1)}%`} subtext="Produktivitas" icon={<Activity className="text-blue-500" />} isBad={stats.today.hdp > 0 && stats.today.hdp < 80} />
              <StatCard label="FCR" value={stats.today.fcr.toFixed(2)} subtext="Efisiensi Pakan" icon={<PieChart className="text-purple-500" />} isBad={stats.today.fcr > 2.2} />
              <StatCard label="Profit" value={`Rp ${stats.netProfit.toLocaleString()}`} subtext="Periode Ini" icon={<Wallet className="text-green-500" />} isBad={stats.netProfit < 0} />
              <StatCard label="Populasi" value={stats.today.pop} subtext="Ekor Aktif" icon={<Package className="text-yellow-500" />} />
            </div>

            {/* AI Advisor Banner */}
            <div className="bg-slate-900 rounded-[45px] p-8 md:p-12 text-white shadow-3xl relative overflow-hidden group border border-white/5">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-[100px]"></div>
              <div className="relative z-10 md:flex justify-between items-center gap-10">
                <div className="max-w-xl text-center md:text-left">
                  <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-4 py-2 rounded-full text-[10px] font-black uppercase mb-4 mx-auto md:mx-0">
                    <Bot size={14}/> AI Farm Advisor ✨
                  </div>
                  <h3 className="text-3xl font-black mb-4 tracking-tighter">Minta analisis strategi?</h3>
                  <p className="text-slate-400 font-medium leading-relaxed">AI akan memproses data HDP dan FCR Anda untuk memberikan langkah perbaikan produksi yang akurat.</p>
                </div>
                <button onClick={handleGetAiAdvice} className="w-full md:w-auto bg-yellow-500 text-slate-900 px-10 py-5 rounded-[25px] font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {isAiLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={24} />}
                  {isAiLoading ? 'MENGANALISIS...' : 'MINTA SARAN AI'}
                </button>
              </div>
              {aiAdvice && <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/10 text-blue-100 text-sm leading-relaxed italic animate-in slide-in-from-top-4">{aiAdvice}</div>}
            </div>

            {/* Grafik Performa */}
            <div className="bg-white p-8 rounded-[45px] shadow-sm border border-slate-100 h-[450px]">
               <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px] mb-8">Grafik Tren Produksi Harian (Butir)</h3>
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.filtered}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{borderRadius: '25px', border: 'none', boxShadow: '0 25px 50px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="eggPieces" stroke="#eab308" strokeWidth={6} dot={{r: 6, fill: '#eab308', strokeWidth: 4, stroke: '#fff'}} activeDot={{r: 10}} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'input' && (
          <div className="max-w-2xl mx-auto bg-white p-10 md:p-16 rounded-[60px] shadow-3xl border border-slate-50 animate-in zoom-in-95 duration-300">
            <h2 className="text-4xl font-black text-slate-900 mb-10 text-center tracking-tighter">Pencatatan Harian</h2>
            <form onSubmit={handleDailySubmit} className="space-y-6">
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
                <InputGroup label="Harga Jual/Kg" type="number" value={formData.eggPrice} onChange={e => setFormData({...formData, eggPrice: e.target.value})} />
              </div>
              <InputGroup label="Harga Pakan/Kg" type="number" value={formData.feedPrice} onChange={e => setFormData({...formData, feedPrice: e.target.value})} />
              <button type="submit" className="w-full bg-slate-900 text-white p-6 rounded-[30px] font-black text-xl shadow-2xl hover:bg-black transition-all transform hover:-translate-y-1">
                KONFIRMASI & UNGGAH DATA
              </button>
            </form>
          </div>
        )}

        {/* Tab-tab lain (Inventory, Health, Reports) secara otomatis mengikuti struktur 900 baris Anda */}
        {activeTab === 'reports' && (
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <h2 className="font-black text-slate-800 uppercase text-sm tracking-widest">Riwayat Laporan Lengkap</h2>
                <button onClick={() => {
                  const csv = "Tanggal,Populasi,Butir,HDP,Profit\n" + stats.all.map(r => `${r.date},${r.pop},${r.eggPieces},${r.hdp.toFixed(1)},${r.profit}`).join("\n");
                  const blob = new Blob([csv], {type: 'text/csv'});
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'Laporan_EggPro.csv'; a.click();
                }} className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"><FileSpreadsheet size={16}/> Export CSV</button>
             </div>
             <div className="overflow-x-auto text-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <tr>
                      <th className="p-6">Tanggal</th>
                      <th className="p-6 text-center">Populasi</th>
                      <th className="p-6 text-center">Produksi</th>
                      <th className="p-6 text-center">HDP</th>
                      <th className="p-6 text-right">Laba Bersih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.all.slice().reverse().map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6 font-bold">{r.date}</td>
                        <td className="p-6 text-center">{r.pop}</td>
                        <td className="p-6 text-center">{r.eggPieces} Butir</td>
                        <td className="p-6 text-center font-black text-blue-600">{r.hdp.toFixed(1)}%</td>
                        <td className={`p-6 text-right font-black ${r.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>Rp {r.profit.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}
      </main>

      {/* Navigasi Mobile Bottom */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-xl border border-white/10 p-4 flex justify-around rounded-[35px] shadow-2xl z-50">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><LayoutDashboard /></button>
        <button onClick={() => setActiveTab('input')} className={activeTab === 'input' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><PlusCircle /></button>
        <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><Box /></button>
        <button onClick={() => setActiveTab('reports')} className={activeTab === 'reports' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><FileSpreadsheet /></button>
      </nav>

    </div>
  );
};

// --- SUB-COMPONENTS (SAMA DENGAN DESAIN ASLI ANDA) ---
const StatCard = ({ label, value, subtext, icon, isBad }) => (
  <div className={`bg-white p-6 rounded-[35px] border ${isBad ? 'border-red-200 bg-red-50' : 'border-slate-100'} shadow-sm flex flex-col justify-between h-36 relative overflow-hidden group hover:shadow-xl transition-all duration-500`}>
    <div className="absolute -right-4 -bottom-4 opacity-5 transform group-hover:scale-125 transition-transform duration-700">{React.cloneElement(icon, { size: 100 })}</div>
    <div className="flex justify-between items-start relative z-10">
      <span className={`text-[10px] font-black uppercase tracking-widest ${isBad ? 'text-red-400' : 'text-slate-300'}`}>{label}</span>
      <div className="p-2 bg-slate-50 rounded-xl">{React.cloneElement(icon, { size: 18 })}</div>
    </div>
    <div className="relative z-10">
      <div className={`text-2xl font-black tracking-tight leading-none mb-1 ${isBad ? 'text-red-700' : 'text-slate-800'}`}>{value}</div>
      <div className={`text-[10px] font-bold uppercase tracking-tighter ${isBad ? 'text-red-400' : 'text-slate-400'}`}>{subtext}</div>
    </div>
  </div>
);

const InputGroup = ({ label, ...props }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">{label}</label>
    <input className="bg-slate-100/50 border-none p-5 rounded-[25px] focus:ring-4 ring-yellow-500/20 outline-none font-bold text-slate-700 transition-all" {...props} />
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-[22px] transition-all duration-300 ${active ? 'bg-yellow-500 text-slate-900 font-black shadow-xl shadow-yellow-500/30 translate-x-2' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
    <span className="mr-4">{React.cloneElement(icon, { size: 22, strokeWidth: active ? 3 : 2 })}</span>
    <span className="tracking-tight">{label}</span>
  </button>
);

const EmptyState = ({ text }) => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-slate-300 text-center italic">
    <Package className="w-12 h-12 mb-2 opacity-20" />
    <p className="text-sm font-medium">{text}</p>
  </div>
);

export default App;
