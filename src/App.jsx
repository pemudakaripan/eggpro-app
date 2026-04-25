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
// --- 1. INITIALIZE FIREBASE (EGGPRO-APP-1) ---
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
// --- 2. GEMINI API HELPER ---
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

  // AI States
  const [aiAdvice, setAiAdvice] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [healthAdvice, setHealthAdvice] = useState('');
  const [isHealthAiLoading, setIsHealthAiLoading] = useState(false);

  // Filter & Form States
  const [filterType, setFilterType] = useState('7days');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], population: 350,
    eggPieces: '', eggKg: '', feedUsed: '', eggPrice: '', feedPrice: '', unexpected: '', dead: '', culled: ''
  });
  const [invForm, setInvForm] = useState({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
  const [editingInvId, setEditingInvId] = useState(null);
  const [healthForm, setHealthForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });

  // ============================================================================
  // --- 3. CLOUD SYNC ENGINE ---
  // ============================================================================
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
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
  // --- 4. LOGIKA PERHITUNGAN ---
  // ============================================================================
  const stats = useMemo(() => {
    const sorted = [...dailyRecords].sort((a,b) => new Date(a.date) - new Date(b.date));
    const processed = sorted.map(r => {
      const pop = parseFloat(r.population) || 350;
      const rev = (parseFloat(r.eggKg) || 0) * (parseFloat(r.eggPrice) || 0);
      const feedCost = (parseFloat(r.feedUsed) || 0) * (parseFloat(r.feedPrice) || 0);
      const totalExp = feedCost + (parseFloat(r.unexpected) || 0);
      const hdp = pop > 0 ? ((parseFloat(r.eggPieces) || 0) / pop) * 100 : 0;
      const fcr = (parseFloat(r.eggKg) || 0) > 0 ? (parseFloat(r.feedUsed) || 0) / (parseFloat(r.eggKg) || 0) : 0;
      return { ...r, revenue: rev, totalExpense: totalExp, profit: rev - totalExp, hdp, fcr, pop };
    });

    const filtered = processed.filter(r => {
      if (filterType === '7days') {
        const now = new Date();
        return new Date(r.date) > new Date(now.setDate(now.getDate() - 7));
      }
      return true;
    });

    return { 
      filtered, all: processed, 
      totalProfit: filtered.reduce((s, r) => s + r.profit, 0),
      today: processed[processed.length - 1] || { hdp: 0, fcr: 0, pop: 350 }
    };
  }, [dailyRecords, filterType]);

  // ============================================================================
  // --- 5. HANDLERS (SUBMIT & DELETE) ---
  // ============================================================================
  const handleDailySubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), {...formData, timestamp: Date.now()});
    setActiveTab('dashboard');
  };

  const handleInvSubmit = async (e) => {
    e.preventDefault();
    if (editingInvId) {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', editingInvId), {...invForm, qty: parseFloat(invForm.qty)});
      setEditingInvId(null);
    } else {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'inventory'), {...invForm, qty: parseFloat(invForm.qty)});
    }
    setInvForm({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
  };

  const handleHealthSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'health'), {...healthForm, timestamp: Date.now()});
    setHealthForm({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });
  };

  // ============================================================================
  // --- 6. UI RENDER (ALL TABS) ---
  // ============================================================================
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 flex-col"><Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" /><p className="text-slate-500 font-black uppercase text-xs tracking-widest">Sinkronisasi Cloud...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64">
      
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 p-6 shadow-2xl z-50">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-yellow-500 p-2 rounded-2xl"><Activity className="text-slate-900" /></div>
          <span className="text-2xl font-black text-yellow-500 uppercase tracking-tighter">EggPro</span>
        </div>
        <nav className="space-y-2 flex-1">
          <NavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavBtn active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle />} label="Catat Panen" />
          <NavBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box />} label="Gudang Stok" />
          <NavBtn active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon={<HeartPulse />} label="Kesehatan" />
          <NavBtn active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<FileSpreadsheet />} label="Riwayat & Laporan" />
        </nav>
      </aside>

      <main className="p-4 md:p-10 max-w-7xl mx-auto">
        
        {/* --- TAB: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <header><h1 className="text-4xl font-black text-slate-900">Kondisi Kandang</h1></header>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="HDP" value={`${stats.today.hdp.toFixed(1)}%`} icon={<Activity className="text-blue-500" />} />
              <StatCard label="FCR" value={stats.today.fcr.toFixed(2)} icon={<PieChart className="text-purple-500" />} />
              <StatCard label="Laba" value={`Rp ${stats.totalProfit.toLocaleString()}`} icon={<Wallet className="text-green-500" />} />
              <StatCard label="Populasi" value={stats.today.pop} icon={<Package className="text-yellow-500" />} />
            </div>
            
            {/* AI Advisor Banner */}
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className="text-2xl font-black flex items-center gap-2"><Bot /> AI Advisor</h3>
                  <p className="text-slate-400">Analisis cerdas berdasarkan performa hari ini.</p>
                </div>
                <button onClick={async () => {
                   setIsAiLoading(true);
                   const res = await fetchGeminiAI(`HDP ${stats.today.hdp.toFixed(1)}% dan FCR ${stats.today.fcr.toFixed(2)}`, "Konsultan Ahli.");
                   setAiAdvice(res);
                   setIsAiLoading(false);
                }} className="bg-yellow-500 text-slate-900 px-8 py-4 rounded-2xl font-black">
                  {isAiLoading ? 'MENGANALISIS...' : 'MINTA SARAN AI'}
                </button>
              </div>
              {aiAdvice && <div className="mt-6 p-6 bg-white/5 rounded-3xl border border-white/10 text-sm leading-relaxed">{aiAdvice}</div>}
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 h-96">
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.filtered}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="eggPieces" stroke="#eab308" strokeWidth={6} dot={false} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* --- TAB: GUDANG STOK (INVENTORY) --- */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black">Gudang Stok</h2>
            <form onSubmit={handleInvSubmit} className="bg-white p-6 rounded-[30px] border flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]"><InputGroup label="Nama Barang" value={invForm.name} onChange={e => setInvForm({...invForm, name: e.target.value})} required /></div>
              <div className="w-32"><InputGroup label="Jumlah" type="number" value={invForm.qty} onChange={e => setInvForm({...invForm, qty: e.target.value})} required /></div>
              <div className="w-24"><InputGroup label="Unit" value={invForm.unit} onChange={e => setInvForm({...invForm, unit: e.target.value})} /></div>
              <button type="submit" className="bg-slate-900 text-white p-4 rounded-2xl font-bold">{editingInvId ? 'Update' : 'Tambah'}</button>
            </form>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {inventory.map(item => (
                <div key={item.id} className="bg-white p-6 rounded-3xl border flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-lg">{item.name}</h4>
                    <p className="text-2xl font-black text-slate-800">{item.qty} <span className="text-xs font-normal text-slate-400">{item.unit}</span></p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setInvForm(item); setEditingInvId(item.id); }} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Edit2 size={16}/></button>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', item.id))} className="p-2 bg-red-50 text-red-600 rounded-xl"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB: KESEHATAN (HEALTH) --- */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-black">Log Kesehatan</h2>
            <form onSubmit={handleHealthSubmit} className="bg-white p-6 rounded-[30px] border space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Tanggal" type="date" value={healthForm.date} onChange={e => setHealthForm({...healthForm, date: e.target.value})} />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Jenis</label>
                  <select className="bg-slate-50 p-4 rounded-2xl outline-none" value={healthForm.type} onChange={e => setHealthForm({...healthForm, type: e.target.value})}>
                    <option>Sakit/Penyakit</option><option>Vaksin</option><option>Vitamin</option>
                  </select>
                </div>
              </div>
              <InputGroup label="Catatan Gejala/Tindakan" value={healthForm.notes} onChange={e => setHealthForm({...healthForm, notes: e.target.value})} required />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-black uppercase">Simpan ke Log</button>
                <button type="button" onClick={async () => {
                   setIsHealthAiLoading(true);
                   const res = await fetchGeminiAI(healthForm.notes, "Diagnosis Kesehatan Ayam.");
                   setHealthAdvice(res);
                   setIsHealthAiLoading(false);
                }} className="bg-indigo-100 text-indigo-700 px-6 rounded-2xl font-black flex items-center gap-2">
                  {isHealthAiLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18}/>} ANALISIS AI
                </button>
              </div>
            </form>
            {healthAdvice && <div className="bg-indigo-900 text-indigo-100 p-6 rounded-3xl text-sm leading-relaxed shadow-xl">{healthAdvice}</div>}
            <div className="space-y-3">
              {healthLogs.sort((a,b) => b.timestamp - a.timestamp).map(log => (
                <div key={log.id} className="bg-white p-5 rounded-3xl border flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400">{log.date} | {log.type}</span>
                    <p className="font-bold">{log.notes}</p>
                  </div>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'health', log.id))} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB: RIWAYAT & LAPORAN --- */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black">Laporan Lengkap</h2>
              <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2"><Printer size={18}/> Cetak Laporan</button>
            </div>
            <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                      <tr>
                        <th className="p-6">Tanggal</th><th className="p-6 text-center">Butir</th><th className="p-6 text-center">HDP</th><th className="p-6 text-center">FCR</th><th className="p-6 text-right">Laba Bersih</th><th className="p-6 text-center">Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {stats.all.slice().reverse().map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-6 font-bold">{r.date}</td>
                          <td className="p-6 text-center font-medium">{r.eggPieces}</td>
                          <td className="p-6 text-center font-black text-blue-600">{r.hdp.toFixed(1)}%</td>
                          <td className="p-6 text-center font-black text-purple-600">{r.fcr.toFixed(2)}</td>
                          <td className={`p-6 text-right font-black ${r.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>Rp {r.profit.toLocaleString()}</td>
                          <td className="p-6 text-center"><button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'records', r.id))} className="text-red-300 hover:text-red-600"><Trash2 size={14}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {/* TAB INPUT (SAMA SEPERTI SEBELUMNYA) */}
        {activeTab === 'input' && (
          <div className="max-w-xl mx-auto bg-white p-10 md:p-16 rounded-[60px] shadow-3xl border border-slate-50 animate-in zoom-in-95 duration-300">
            <h2 className="text-4xl font-black text-slate-900 mb-10 text-center tracking-tighter">Pencatatan Baru</h2>
            <form onSubmit={handleDailySubmit} className="space-y-6">
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
              <button type="submit" className="w-full bg-slate-900 text-white p-6 rounded-[30px] font-black text-xl shadow-2xl hover:bg-black transition-all transform hover:-translate-y-1">SIMPAN KE DATABASE</button>
            </form>
          </div>
        )}
      </main>

      {/* Navigasi Mobile */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 flex justify-around rounded-[35px] shadow-2xl z-50">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><LayoutDashboard /></button>
        <button onClick={() => setActiveTab('input')} className={activeTab === 'input' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><PlusCircle /></button>
        <button onClick={() => setActiveTab('inventory')} className={activeTab === 'inventory' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><Box /></button>
        <button onClick={() => setActiveTab('health')} className={activeTab === 'health' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><HeartPulse /></button>
        <button onClick={() => setActiveTab('reports')} className={activeTab === 'reports' ? 'text-yellow-500 scale-125 transition-all' : 'text-slate-500'}><FileSpreadsheet /></button>
      </nav>
    </div>
  );
};

// --- SUB-COMPONENTS ---
const StatCard = ({ label, value, icon }) => (
  <div className="bg-white p-6 rounded-[35px] border border-slate-100 shadow-sm flex flex-col justify-between h-36">
    <div className="flex justify-between items-start relative z-10">
      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
      <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
    </div>
    <div className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">{value}</div>
  </div>
);

const InputGroup = ({ label, ...props }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">{label}</label>
    <input className="bg-slate-100/50 border-none p-4 rounded-[25px] focus:ring-4 ring-yellow-500/20 outline-none font-bold text-slate-700" {...props} />
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-[22px] transition-all duration-300 ${active ? 'bg-yellow-500 text-slate-900 font-black shadow-xl shadow-yellow-500/30 translate-x-2' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
    <span className="mr-4">{React.cloneElement(icon, { size: 22 })}</span>
    <span className="tracking-tight">{label}</span>
  </button>
);

export default App;
