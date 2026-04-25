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
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc 
} from 'firebase/firestore';

// ============================================================================
// --- INITIALIZE FIREBASE ---
// ============================================================================

// [VERSI CANVAS - WAJIB AKTIF DI SINI AGAR PREVIEW BERJALAN]
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'egg-pro-app';

/*
// [VERSI FIX LOKAL - BUKA KOMENTAR DI BAWAH JIKA DIJALANKAN DI VS CODE / HOSTING SENDIRI]
const firebaseConfigLocal = {
  apiKey: "AIzaSyALPl6gzZDh_p1kxURiLAum2Aygg2_mL9o",
  authDomain: "eggpro-ternak.firebaseapp.com",
  projectId: "eggpro-ternak",
  storageBucket: "eggpro-ternak.firebasestorage.app",
  messagingSenderId: "844870453044",
  appId: "1:844870453044:web:ceda181085587bb6830761"
};

const app = initializeApp(firebaseConfigLocal);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'egg-pro-app';
*/


// ============================================================================
// --- GEMINI API HELPER ---
// ============================================================================

// [VERSI CANVAS - WAJIB AKTIF DI SINI AGAR PREVIEW BERJALAN]
const fetchGeminiAI = async (prompt, systemInstruction) => {
  const apiKey = ""; // Kunci API disediakan secara otomatis oleh sistem saat runtime
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  // Implementasi Exponential Backoff untuk keandalan API di Canvas
  let retries = 5;
  let delay = 1000;
  
  while (retries > 0) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, AI tidak memberikan respons yang dapat dibaca.";
    } catch (error) {
      retries--;
      if (retries === 0) return "Maaf, sistem AI sedang sibuk atau ada gangguan koneksi. Silakan coba beberapa saat lagi.";
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
};

/*
// [VERSI FIX LOKAL - BUKA KOMENTAR DI BAWAH JIKA DIJALANKAN DI VS CODE / HOSTING SENDIRI]
const fetchGeminiAILocal = async (prompt, systemInstruction) => {
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
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI sedang berpikir...";
  } catch (error) {
    return "Gagal terhubung ke AI. Cek kuota API Key.";
  }
};
*/

const App = () => {
  // --- CLOUD STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [dailyRecords, setDailyRecords] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Gemini AI States
  const [aiAdvice, setAiAdvice] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [healthAdvice, setHealthAdvice] = useState('');
  const [isHealthAiLoading, setIsHealthAiLoading] = useState(false);

  // Filter Tanggal Dashboard
  const [filterType, setFilterType] = useState('7days'); // '7days', 'thisMonth', 'lastMonth', 'thisYear', 'all', 'custom'
  const [customDate, setCustomDate] = useState({ start: '', end: '' });

  // Form States
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    population: 350,
    eggPieces: '', eggKg: '', feedUsed: '',
    eggPrice: '', feedPrice: '', unexpected: '',
    dead: '', culled: ''
  });

  const [invForm, setInvForm] = useState({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
  const [editingInvId, setEditingInvId] = useState(null);
  const [healthForm, setHealthForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });

  // ============================================================================
  // --- 1. AUTHENTICATION ---
  // ============================================================================
  useEffect(() => {
    const initAuth = async () => {
      // [VERSI CANVAS - WAJIB AKTIF DI SINI AGAR PREVIEW BERJALAN]
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }

      /*
      // [VERSI FIX LOKAL - BUKA KOMENTAR DI BAWAH JIKA DIJALANKAN DI VS CODE / HOSTING SENDIRI]
      try {
        // Langsung login tanpa token internal Gemini
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
      */
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- 2. DATA SYNC (FIRESTORE) ---
  useEffect(() => {
    if (!user) return;

    // Sync Records
    const recordsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'records');
    const unsubRecords = onSnapshot(recordsCol, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDailyRecords(records);
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });

    // Sync Inventory
    const invCol = collection(db, 'artifacts', appId, 'users', user.uid, 'inventory');
    const unsubInv = onSnapshot(invCol, (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Sync Health Logs
    const healthCol = collection(db, 'artifacts', appId, 'users', user.uid, 'health');
    const unsubHealth = onSnapshot(healthCol, (snap) => {
      setHealthLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRecords(); unsubInv(); unsubHealth(); };
  }, [user]);

  // Pre-fill form prices
  useEffect(() => {
    if (dailyRecords.length > 0) {
      const sorted = [...dailyRecords].sort((a,b) => new Date(a.date) - new Date(b.date));
      const lastRec = sorted[sorted.length - 1];
      const nextPop = (parseFloat(lastRec.population) || 350) - (parseFloat(lastRec.dead) || 0) - (parseFloat(lastRec.culled) || 0);

      setFormData(prev => ({
        ...prev,
        population: nextPop,
        eggPieces: prev.eggPieces === '' ? lastRec.eggPieces : prev.eggPieces,
        eggKg: prev.eggKg === '' ? lastRec.eggKg : prev.eggKg,
        feedUsed: prev.feedUsed === '' ? lastRec.feedUsed : prev.feedUsed,
        eggPrice: prev.eggPrice === '' ? lastRec.eggPrice : prev.eggPrice,
        feedPrice: prev.feedPrice === '' ? lastRec.feedPrice : prev.feedPrice
      }));
    }
  }, [dailyRecords]);

  // --- HELPER: FORMAT TANGGAL DD/MM/YYYY ---
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // --- ENGINE PERHITUNGAN & FILTER ---
  const stats = useMemo(() => {
    const targetHDP = 80;
    const targetFCR = 2.1;
    let currentPopTracker = 350;
    let alerts = [];

    // Proses Data Mentah & Hitung Populasi Berjalan
    const processed = dailyRecords.slice().sort((a,b) => new Date(a.date) - new Date(b.date)).map(record => {
      const dead = parseFloat(record.dead) || 0;
      const culled = parseFloat(record.culled) || 0;

      const revenue = (parseFloat(record.eggKg) || 0) * (parseFloat(record.eggPrice) || 0);
      const feedCost = (parseFloat(record.feedUsed) || 0) * (parseFloat(record.feedPrice) || 0);
      const unexpCost = parseFloat(record.unexpected) || 0;
      const totalExpense = feedCost + unexpCost;

      const pop = record.population ? parseFloat(record.population) : currentPopTracker;
      currentPopTracker = pop - dead - culled;

      const eggPcs = parseFloat(record.eggPieces) || 0;
      const eggKg = parseFloat(record.eggKg) || 0;
      const feedUsed = parseFloat(record.feedUsed) || 0;

      const hdp = pop > 0 ? (eggPcs / pop) * 100 : 0;
      const fcr = eggKg > 0 ? feedUsed / eggKg : 0;

      return {
        ...record,
        pop, dead, culled, revenue, feedCost, unexpected: unexpCost, totalExpense, profit: revenue - totalExpense, hdp, fcr
      };
    });

    // Cek Alert Hari Terakhir (Menggunakan data terlengkap)
    const lastRec = processed.length > 0 ? processed[processed.length - 1] : null;
    if (lastRec) {
      if (lastRec.hdp < targetHDP && lastRec.hdp > 0) {
        alerts.push(`Produksi HDP turun (${lastRec.hdp.toFixed(1)}%) di bawah standar ${targetHDP}%.`);
      }
      const mortalityRate = (lastRec.dead / lastRec.pop) * 100;
      if (mortalityRate > 0.3) {
        alerts.push(`Peringatan: Tingkat kematian melonjak (${mortalityRate.toFixed(2)}%)! Periksa kandang segera.`);
      }
    }

    // Filter Berdasarkan Tanggal yang Dipilih
    const now = new Date();
    let startDate = new Date(0);
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (filterType === '7days') {
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0,0,0,0);
    } else if (filterType === 'thisMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filterType === 'lastMonth') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (filterType === 'thisYear') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (filterType === 'custom' && customDate.start) {
      startDate = new Date(customDate.start);
      endDate = customDate.end ? new Date(customDate.end) : new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    const filteredProcessed = processed.filter(r => {
      const d = new Date(r.date);
      return d >= startDate && d <= endDate;
    });

    // Hitung Total dari Data yang Difilter
    const totalRev = filteredProcessed.reduce((sum, r) => sum + r.revenue, 0);
    const totalExp = filteredProcessed.reduce((sum, r) => sum + r.totalExpense, 0);

    return {
      allProcessed: processed, 
      filteredProcessed,       
      currentPop: formData.population,
      totalRev,
      totalExp,
      netProfit: totalRev - totalExp,
      today: lastRec || { hdp: 0, fcr: 0, eggKg: 0, eggPieces: 0 },
      alerts,
      targetHDP,
      targetFCR
    };
  }, [dailyRecords, filterType, customDate, formData.population]);

  // --- GEMINI AI HANDLERS ---
  const handleGetAiAdvice = async () => {
    setIsAiLoading(true);
    const prompt = `Analisis data operasional peternakan ayam petelur hari ini:
    - Populasi: ${stats.currentPop} ekor
    - HDP (Produksi Telur): ${stats.today.hdp.toFixed(1)}% (Target: ${stats.targetHDP}%)
    - FCR (Rasio Pakan): ${stats.today.fcr.toFixed(2)} (Target: ${stats.targetFCR} atau lebih rendah)
    - Peringatan Aktif: ${stats.alerts.length > 0 ? stats.alerts.join(' ') : 'Tidak ada peringatan'}
    
    Berikan maksimal 3 poin tindakan singkat, taktis, dan mudah dipraktikkan oleh peternak (maksimal 1-2 kalimat per poin) untuk meningkatkan HDP atau mengoptimalkan FCR berdasarkan kondisi di atas. Gunakan bahasa Indonesia yang santai tapi profesional.`;
    
    const instruction = "Anda adalah konsultan ahli manajemen peternakan unggas (ayam petelur) profesional.";
    
    // Ganti fetchGeminiAI dengan fetchGeminiAILocal jika menggunakan versi fix Anda
    const response = await fetchGeminiAI(prompt, instruction);
    setAiAdvice(response);
    setIsAiLoading(false);
  };

  const handleGetHealthAdvice = async () => {
    if (!healthForm.notes) return;
    setIsHealthAiLoading(true);
    
    const prompt = `Ayam petelur di peternakan saya menunjukkan gejala atau kondisi berikut: "${healthForm.notes}". Kategori masalah yang saya pilih: "${healthForm.type}".
    
    Berikan:
    1. Dugaan penyebab (penyakit/kekurangan nutrisi/faktor stres lingkungan).
    2. Langkah pertolongan pertama yang bisa segera saya lakukan.
    3. Langkah pencegahan jangka panjang.
    Beri format paragraf pendek. Di bagian akhir, tambahkan kalimat peringatan kecil bahwa ini adalah saran AI dan sebaiknya hubungi dokter hewan untuk pengobatan serius.`;
    
    const instruction = "Anda adalah asisten virtual ahli kesehatan unggas dan dokter hewan. Berikan jawaban yang mendidik, langsung pada poinnya, dan solutif.";
    
    // Ganti fetchGeminiAI dengan fetchGeminiAILocal jika menggunakan versi fix Anda
    const response = await fetchGeminiAI(prompt, instruction);
    setHealthAdvice(response);
    setIsHealthAiLoading(false);
  };

  // --- HANDLERS ---
  const handleDailySubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), {
        ...formData, timestamp: Date.now()
      });

      const feedItems = inventory.filter(i => i.category === 'Pakan' || i.name.toLowerCase().includes('pakan'));
      if (feedItems.length > 0 && formData.feedUsed) {
        const feedItem = feedItems[0];
        const newQty = parseFloat(feedItem.qty) - parseFloat(formData.feedUsed);
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', feedItem.id), {
          qty: newQty > 0 ? newQty : 0
        });
      }

      setFormData(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0],
        unexpected: '', dead: '', culled: ''
      }));
      setAiAdvice(''); // Reset saran AI ketika data baru masuk
      setActiveTab('dashboard');
    } catch (err) { console.error(err); }
  };

  const handleInvSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      if (editingInvId) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', editingInvId), {
          ...invForm, qty: parseFloat(invForm.qty)
        });
        setEditingInvId(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'inventory'), {
          ...invForm, qty: parseFloat(invForm.qty)
        });
      }
      setInvForm({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
    } catch (err) { console.error(err); }
  };

  const editInventory = (item) => {
    setInvForm({ name: item.name, category: item.category, qty: item.qty, unit: item.unit });
    setEditingInvId(item.id);
  };

  const deleteInventory = async (id) => {
    if (!user || !window.confirm("Hapus stok ini?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'inventory', id));
    } catch (err) { console.error(err); }
  };

  const handleHealthSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'health'), { ...healthForm, timestamp: Date.now() });
      setHealthForm({ date: new Date().toISOString().split('T')[0], type: 'Sakit/Penyakit', notes: '' });
      setHealthAdvice(''); // Reset saran kesehatan
    } catch (err) { console.error(err); }
  };

  const exportToCSV = () => {
    const headers = "Tanggal,Populasi,Telur(Butir),Telur(Kg),HDP(%),FCR,Harga_Telur,Harga_Pakan,Pendapatan,Biaya_Pakan,Biaya_Lain,Laba,Mati,Afkir\n";
    const rows = stats.allProcessed.map(r => 
      `${formatDate(r.date)},${r.pop},${r.eggPieces},${r.eggKg},${r.hdp.toFixed(2)},${r.fcr.toFixed(2)},${r.eggPrice},${r.feedPrice},${r.revenue},${r.feedCost},${r.unexpected},${r.profit},${r.dead},${r.culled}`
    ).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + headers + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_EggPro_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const changeTab = (tabName) => {
    setActiveTab(tabName);
    setIsMobileMenuOpen(false);
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50 flex-col">
      <Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" />
      <p className="text-slate-500 font-bold">Menghubungkan ke Cloud...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64 relative">
      
      {/* Mobile Top Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 sticky top-0 z-40 flex justify-between items-center shadow-md print:hidden">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-500 p-1.5 rounded-lg">
            <Activity className="w-5 h-5 text-slate-900" />
          </div>
          <span className="font-bold text-lg">EggPro</span>
        </div>
        <div className="flex items-center gap-3">
          {stats.alerts.length > 0 && <BellRing className="w-5 h-5 text-red-400 animate-pulse" />}
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors">
            <Menu className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Overlay Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/80 z-50 transition-opacity" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="fixed top-0 right-0 w-64 bg-slate-900 h-full p-6 shadow-2xl flex flex-col transform transition-transform" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
              <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                <Activity className="text-yellow-500" /> Menu
              </h1>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
            <nav className="space-y-2 flex-1">
              <NavBtn active={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
              <NavBtn active={activeTab === 'input'} onClick={() => changeTab('input')} icon={<PlusCircle />} label="Input Harian" />
              <NavBtn active={activeTab === 'inventory'} onClick={() => changeTab('inventory')} icon={<Box />} label="Stok Barang" />
              <NavBtn active={activeTab === 'health'} onClick={() => changeTab('health')} icon={<HeartPulse />} label="Log Kesehatan" />
              <NavBtn active={activeTab === 'reports'} onClick={() => changeTab('reports')} icon={<FileSpreadsheet />} label="Riwayat & Laporan" />
            </nav>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 p-6 print:hidden shadow-xl z-10">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Activity className="text-yellow-500" /> EggPro
        </h1>
        <p className="text-[10px] text-slate-500 mb-8 pb-4 border-b border-slate-800 break-all">ID: {user?.uid.substring(0,10)}...</p>
        <nav className="space-y-2 flex-1">
          <NavBtn active={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavBtn active={activeTab === 'input'} onClick={() => changeTab('input')} icon={<PlusCircle />} label="Input Harian" />
          <NavBtn active={activeTab === 'inventory'} onClick={() => changeTab('inventory')} icon={<Box />} label="Stok Barang" />
          <NavBtn active={activeTab === 'health'} onClick={() => changeTab('health')} icon={<HeartPulse />} label="Log Kesehatan" />
          <NavBtn active={activeTab === 'reports'} onClick={() => changeTab('reports')} icon={<FileSpreadsheet />} label="Riwayat & Laporan" />
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        
        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Alert System Banner */}
            {stats.alerts.length > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm print:hidden">
                <div className="flex items-center text-red-800 font-bold mb-1">
                  <AlertCircle className="w-5 h-5 mr-2" /> Peringatan Sistem!
                </div>
                <ul className="list-disc pl-7 text-sm text-red-700">
                  {stats.alerts.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            )}

            {/* Header & Date Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <div>
                <h2 className="text-2xl font-bold">Ringkasan Performa</h2>
                <p className="text-sm text-slate-500">Populasi Aktif: <span className="font-bold text-slate-700">{stats.currentPop} ekor</span></p>
              </div>
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                  <Calendar className="w-5 h-5 text-slate-400" />
                  <select 
                    className="bg-transparent outline-none font-bold text-sm text-slate-700 w-full"
                    value={filterType} onChange={e => setFilterType(e.target.value)}
                  >
                    <option value="7days">7 Hari Terakhir</option>
                    <option value="thisMonth">Bulan Ini</option>
                    <option value="lastMonth">Bulan Lalu</option>
                    <option value="thisYear">Tahun Ini</option>
                    <option value="all">Semua Waktu</option>
                    <option value="custom">Pilih Tanggal...</option>
                  </select>
                </div>
                {filterType === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input type="date" className="p-2 text-sm border border-slate-200 rounded-xl" value={customDate.start} onChange={e => setCustomDate({...customDate, start: e.target.value})} />
                    <span className="text-slate-400">-</span>
                    <input type="date" className="p-2 text-sm border border-slate-200 rounded-xl" value={customDate.end} onChange={e => setCustomDate({...customDate, end: e.target.value})} />
                  </div>
                )}
              </div>
            </div>

            {/* Scorecards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard 
                label="HDP (Produktivitas)" 
                value={`${stats.today.hdp ? stats.today.hdp.toFixed(1) : 0}%`} 
                subtext={`Target: 80%`}
                icon={<Activity className="text-blue-500" />} 
                isBad={stats.today.hdp > 0 && stats.today.hdp < 80}
              />
              <StatCard 
                label="FCR (Efisiensi Pakan)" 
                value={stats.today.fcr ? stats.today.fcr.toFixed(2) : '0.00'} 
                subtext={`Target: 2.1`}
                icon={<PieChart className="text-purple-500" />} 
                isBad={stats.today.fcr > 2.1}
              />
              <StatCard 
                label={`Pendapatan (${filterType==='7days'?'7H':filterType==='thisMonth'?'Bulan Ini':filterType==='lastMonth'?'Bulan Lalu':filterType==='thisYear'?'Tahun Ini':'Total'})`}
                value={`Rp ${stats.totalRev.toLocaleString('id-ID')}`} 
                subtext="Total Pendapatan"
                icon={<TrendingUp className="text-green-500" />} 
              />
              <StatCard 
                label={`Laba Bersih (${filterType==='7days'?'7H':filterType==='thisMonth'?'Bulan Ini':filterType==='lastMonth'?'Bulan Lalu':filterType==='thisYear'?'Tahun Ini':'Total'})`}
                value={`Rp ${stats.netProfit.toLocaleString('id-ID')}`} 
                subtext="Total Laba"
                icon={<Wallet className="text-yellow-500" />} 
                isBad={stats.netProfit < 0}
              />
            </div>

            {/* Gemini AI Insights Widget */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl shadow-sm border border-blue-100 print:hidden mt-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-3">
                <h3 className="font-bold text-blue-800 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" /> AI Farm Advisor ✨
                </h3>
                <button
                  onClick={handleGetAiAdvice}
                  disabled={isAiLoading || dailyRecords.length === 0}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition shadow-sm shadow-blue-200"
                >
                  {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isAiLoading ? 'AI Menganalisis...' : 'Minta Saran Performa'}
                </button>
              </div>
              
              {aiAdvice ? (
                <div className="bg-white p-4 rounded-xl border border-blue-100 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {aiAdvice}
                </div>
              ) : (
                <p className="text-sm text-blue-600/70 italic">
                  Klik tombol di atas untuk memerintahkan AI membaca performa kandang Anda hari ini dan memberikan rekomendasi strategis.
                </p>
              )}
            </div>

            {/* Ringkasan Stok Mini */}
            {inventory.length > 0 && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 print:hidden">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-sm text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Box className="w-4 h-4" /> Ringkasan Stok Gudang
                  </h3>
                  <button onClick={() => changeTab('inventory')} className="text-xs font-bold text-blue-500 hover:text-blue-600 transition">Lihat Semua</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {inventory.slice(0, 4).map(item => (
                    <div key={item.id} className={`p-3 rounded-xl border flex justify-between items-center ${item.qty < 50 && item.category === 'Pakan' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="overflow-hidden pr-2">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">{item.category}</div>
                        <div className="text-xs md:text-sm font-bold text-slate-700 truncate">{item.name}</div>
                      </div>
                      <div className="text-right min-w-[40px]">
                        <div className={`text-lg md:text-xl font-black ${item.qty < 50 && item.category === 'Pakan' ? 'text-red-600' : 'text-slate-800'}`}>{item.qty}</div>
                        <div className="text-[9px] text-slate-500">{item.unit}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grafik Performa */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-2 text-sm text-slate-500 uppercase tracking-wider">HDP vs FCR</h3>
                <div className="h-48">
                  {stats.filteredProcessed.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.filteredProcessed} margin={{ top: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={v => formatDate(v).substring(0, 5)} />
                        <YAxis yAxisId="left" tick={{fontSize: 10}} domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" tick={{fontSize: 10}} />
                        <Tooltip />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="hdp" name="HDP (%)" stroke="#3b82f6" strokeWidth={3} />
                        <Line yAxisId="right" type="monotone" dataKey="fcr" name="FCR" stroke="#a855f7" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Belum ada data untuk rentang tanggal ini" />}
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold mb-2 text-sm text-slate-500 uppercase tracking-wider">Pendapatan vs Pengeluaran</h3>
                <div className="h-48">
                  {stats.filteredProcessed.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.filteredProcessed} margin={{ top: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={v => formatDate(v).substring(0, 5)} />
                        <YAxis tick={{fontSize: 10}} tickFormatter={v => `${v/1000}k`} />
                        <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} />
                        <Legend />
                        <Bar 
                          dataKey="revenue" 
                          name="Pendapatan" 
                          fill="#10b981" 
                          radius={[4,4,0,0]} 
                          label={{ position: 'top', fontSize: 10, fill: '#10b981', formatter: (val) => val > 0 ? val.toLocaleString('id-ID') : '' }}
                        />
                        <Bar 
                          dataKey="totalExpense" 
                          name="Pengeluaran" 
                          fill="#ef4444" 
                          radius={[4,4,0,0]} 
                          label={{ position: 'top', fontSize: 10, fill: '#ef4444', formatter: (val) => val > 0 ? val.toLocaleString('id-ID') : '' }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Belum ada data untuk rentang tanggal ini" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: INPUT DATA HARIAN */}
        {activeTab === 'input' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold px-1">Input Data Harian</h2>
            <form onSubmit={handleDailySubmit} className="space-y-5">
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InputGroup label="Tanggal Pencatatan" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                  <InputGroup label="Populasi Ayam Saat Ini (Ekor)" type="number" value={formData.population} onChange={e => setFormData({...formData, population: e.target.value})} required />
                </div>
                
                <h3 className="font-bold text-slate-700 border-b pb-2 pt-2 text-sm uppercase">Data Produksi & Pakan</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <InputGroup label="Telur (Butir)" type="number" value={formData.eggPieces} onChange={e => setFormData({...formData, eggPieces: e.target.value})} placeholder="0" required />
                  <InputGroup label="Telur (Kg)" type="number" step="0.1" value={formData.eggKg} onChange={e => setFormData({...formData, eggKg: e.target.value})} placeholder="0.0" required />
                  <InputGroup label="Pakan Habis (Kg)" type="number" step="0.1" value={formData.feedUsed} onChange={e => setFormData({...formData, feedUsed: e.target.value})} placeholder="0.0" required />
                </div>

                <h3 className="font-bold text-slate-700 border-b pb-2 pt-2 text-sm uppercase">Fluktuasi Harga Pasar Hari Ini</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InputGroup label="Harga Telur / Kg (Rp)" type="number" value={formData.eggPrice} onChange={e => setFormData({...formData, eggPrice: e.target.value})} placeholder="Misal: 25000" required />
                  <InputGroup label="Harga Pakan / Kg (Rp)" type="number" value={formData.feedPrice} onChange={e => setFormData({...formData, feedPrice: e.target.value})} placeholder="Misal: 8500" required />
                </div>

                <h3 className="font-bold text-slate-700 border-b pb-2 pt-2 text-sm uppercase">Lain-lain (Opsional)</h3>
                <div className="grid grid-cols-3 gap-3">
                  <InputGroup label="Mati (Ekor)" type="number" value={formData.dead} onChange={e => setFormData({...formData, dead: e.target.value})} placeholder="0" />
                  <InputGroup label="Afkir (Ekor)" type="number" value={formData.culled} onChange={e => setFormData({...formData, culled: e.target.value})} placeholder="0" />
                </div>
                <InputGroup label="Biaya Tak Terduga (Rp)" type="number" value={formData.unexpected} onChange={e => setFormData({...formData, unexpected: e.target.value})} placeholder="Listrik, Obat, Gaji, dll" />
              </div>

              <button type="submit" className="w-full bg-yellow-500 text-slate-900 font-black p-4 rounded-xl shadow-lg shadow-yellow-100 hover:bg-yellow-600 transition flex justify-center items-center gap-2">
                <PlusCircle /> Simpan & Unggah ke Cloud
              </button>
            </form>
          </div>
        )}

        {/* TAB: INVENTORY */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Stok Gudang (Inventory)</h2>
            <form onSubmit={handleInvSubmit} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap gap-2 items-end">
               <div className="w-full md:w-32">
                <label className="text-xs font-bold text-slate-500 ml-1">Kategori</label>
                <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none" value={invForm.category} onChange={e => setInvForm({...invForm, category: e.target.value})}>
                  <option>Pakan</option>
                  <option>Obat/Vaksin</option>
                  <option>Lainnya</option>
                </select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <InputGroup label="Nama Barang" value={invForm.name} onChange={e => setInvForm({...invForm, name: e.target.value})} placeholder="Misal: Konsentrat Layer" required />
              </div>
              <div className="w-20">
                <InputGroup label="Jumlah" type="number" step="0.1" value={invForm.qty} onChange={e => setInvForm({...invForm, qty: e.target.value})} required />
              </div>
              <div className="w-24">
                <InputGroup label="Satuan" value={invForm.unit} onChange={e => setInvForm({...invForm, unit: e.target.value})} required />
              </div>
              <button type="submit" className={`w-full md:w-auto text-white p-3.5 rounded-xl flex items-center justify-center gap-2 ${editingInvId ? 'bg-blue-600' : 'bg-slate-900'}`}>
                {editingInvId ? <CheckCircle2 className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
              </button>
              {editingInvId && (
                <button type="button" onClick={() => { setEditingInvId(null); setInvForm({ name: '', category: 'Pakan', qty: '', unit: 'Kg' }); }} className="w-full md:w-auto bg-slate-200 text-slate-700 p-3.5 rounded-xl font-bold">Batal</button>
              )}
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {inventory.length === 0 ? <EmptyState text="Belum ada barang di gudang." /> : 
                inventory.map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center group">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{item.category}</span>
                      <h4 className="font-bold text-slate-800 text-lg leading-tight">{item.name}</h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-black text-slate-800">{item.qty} <span className="text-sm font-normal text-slate-500">{item.unit}</span></div>
                      </div>
                      <div className="flex flex-col gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => editInventory(item)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => deleteInventory(item.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
            <p className="text-xs text-slate-500 text-center italic">*Stok dengan kategori "Pakan" akan otomatis berkurang saat data harian disimpan.</p>
          </div>
        )}

        {/* TAB: HEALTH LOG */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Log Kesehatan & Vaksinasi</h2>
            <form onSubmit={handleHealthSubmit} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row gap-3 items-end mb-4">
                <div className="w-full md:w-40">
                  <InputGroup label="Tanggal" type="date" value={healthForm.date} onChange={e => setHealthForm({...healthForm, date: e.target.value})} required />
                </div>
                <div className="w-full md:w-32">
                  <label className="text-xs font-bold text-slate-500 ml-1">Jenis</label>
                  <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none" value={healthForm.type} onChange={e => setHealthForm({...healthForm, type: e.target.value})}>
                    <option>Sakit/Penyakit</option>
                    <option>Vaksin</option>
                    <option>Vitamin</option>
                    <option>Sanitasi</option>
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <InputGroup label="Gejala / Keterangan (Tulis secara rinci)" value={healthForm.notes} onChange={e => setHealthForm({...healthForm, notes: e.target.value})} placeholder="Misal: Ayam lemas, nafsu makan turun, feses encer" required />
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-3">
                <button type="submit" className="flex-1 bg-slate-900 text-white p-3.5 rounded-xl font-bold transition hover:bg-slate-800">
                  Simpan ke Log Harian
                </button>
                <button 
                  type="button" 
                  onClick={handleGetHealthAdvice}
                  disabled={isHealthAiLoading || !healthForm.notes}
                  className="w-full md:w-auto bg-indigo-100 text-indigo-700 hover:bg-indigo-200 p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isHealthAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  AI Analisis Gejala ✨
                </button>
              </div>
            </form>

            {/* AI Health Advice Banner */}
            {healthAdvice && (
              <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200 shadow-sm relative">
                <button onClick={() => setHealthAdvice('')} className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-700"><X className="w-5 h-5"/></button>
                <div className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600"/> Diagnosis & Saran Penanganan AI
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {healthAdvice}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {healthLogs.length === 0 ? <EmptyState text="Belum ada catatan kesehatan tersimpan di Cloud." /> :
                healthLogs.sort((a,b) => new Date(b.date) - new Date(a.date)).map(log => (
                  <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                    <div className="font-bold text-slate-600 min-w-[100px]">{formatDate(log.date)}</div>
                    <div className={`px-2 py-1 rounded text-xs font-bold w-fit ${log.type==='Sakit/Penyakit'?'bg-red-100 text-red-700':log.type==='Vaksin'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700'}`}>
                      {log.type}
                    </div>
                    <div className="text-slate-800 flex-1">{log.notes}</div>
                    <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'health', log.id))} className="text-red-400 hover:text-red-600 self-end md:self-auto"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* TAB: REPORTS & HISTORY */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
              <h2 className="text-2xl font-bold">Riwayat & Laporan Lengkap</h2>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={exportToCSV} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold transition shadow-sm">
                  <FileSpreadsheet className="w-5 h-5" /> Export Excel/CSV
                </button>
                <button onClick={handlePrint} className="flex-1 md:flex-none flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl font-bold transition shadow-sm">
                  <Printer className="w-5 h-5" /> Cetak PDF
                </button>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 print:hidden">*Tips: Untuk menyimpan ke PDF, klik tombol "Cetak PDF" lalu ubah pilihan printer di layar menjadi "Save as PDF" (Simpan sebagai PDF).</p>

            {/* Comprehensive Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden print:shadow-none print:border-none">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 text-center">LAPORAN OPERASIONAL & KEUANGAN PETERNAKAN</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">Tanggal</th>
                      <th className="p-4 text-center">Populasi</th>
                      <th className="p-4 text-center">HDP (%)</th>
                      <th className="p-4 text-center">FCR</th>
                      <th className="p-4 text-right">Pendapatan</th>
                      <th className="p-4 text-right">Biaya Pakan</th>
                      <th className="p-4 text-right">Biaya Lain</th>
                      <th className="p-4 text-right font-black">Laba Bersih</th>
                      <th className="p-4 text-center print:hidden">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.allProcessed.length === 0 ? (
                      <tr><td colSpan="9"><EmptyState text="Tidak ada data transaksi di Cloud." /></td></tr>
                    ) : stats.allProcessed.slice().reverse().map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-700">{formatDate(r.date)}</td>
                        <td className="p-4 text-center">{r.pop}</td>
                        <td className="p-4 text-center font-bold text-blue-600">{r.hdp.toFixed(1)}%</td>
                        <td className="p-4 text-center text-purple-600">{r.fcr.toFixed(2)}</td>
                        <td className="p-4 text-right text-green-600">Rp {r.revenue.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right text-red-500">Rp {r.feedCost.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right text-red-500">Rp {r.unexpected.toLocaleString('id-ID')}</td>
                        <td className={`p-4 text-right font-bold ${r.profit > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          Rp {r.profit.toLocaleString('id-ID')}
                        </td>
                        <td className="p-4 text-center print:hidden">
                           <button onClick={async () => {
                             if(window.confirm('Hapus riwayat tanggal ' + formatDate(r.date) + '?')) {
                               await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'records', r.id));
                             }
                           }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4 inline" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                    <tr>
                      <td className="p-4 text-center" colSpan="4">TOTAL KESELURUHAN</td>
                      <td className="p-4 text-right text-green-700">Rp {stats.allProcessed.reduce((s,r)=>s+r.revenue,0).toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right text-red-700">Rp {stats.allProcessed.reduce((s,r)=>s+r.feedCost,0).toLocaleString('id-ID')}</td>
                      <td className="p-4 text-right text-red-700">Rp {stats.allProcessed.reduce((s,r)=>s+r.unexpected,0).toLocaleString('id-ID')}</td>
                      <td className={`p-4 text-right text-lg ${stats.allProcessed.reduce((s,r)=>s+r.profit,0) > 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Rp {stats.allProcessed.reduce((s,r)=>s+r.profit,0).toLocaleString('id-ID')}
                      </td>
                      <td className="print:hidden"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 print:block hidden">Dicetak oleh Sistem Cloud EggPro pada {new Date().toLocaleDateString('id-ID')}</p>
          </div>
        )}

      </main>

      {/* Mobile Bottom Navigation (Sembunyi saat print) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-between px-1 py-2 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-safe print:hidden">
        <MobileNavBtn active={activeTab === 'dashboard'} onClick={() => changeTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
        <MobileNavBtn active={activeTab === 'input'} onClick={() => changeTab('input')} icon={<PlusCircle />} label="Input" />
        <MobileNavBtn active={activeTab === 'inventory'} onClick={() => changeTab('inventory')} icon={<Box />} label="Stok" />
        <MobileNavBtn active={activeTab === 'health'} onClick={() => changeTab('health')} icon={<HeartPulse />} label="Kesehatan" />
        <MobileNavBtn active={activeTab === 'reports'} onClick={() => changeTab('reports')} icon={<FileSpreadsheet />} label="Riwayat" />
      </div>

    </div>
  );
};

// --- SUB-COMPONENTS ---
const StatCard = ({ label, value, subtext, icon, isBad }) => (
  <div className={`bg-white p-3 md:p-4 rounded-xl border ${isBad ? 'border-red-300 bg-red-50' : 'border-slate-200'} shadow-sm flex flex-col justify-between h-28 relative overflow-hidden`}>
    <div className="flex items-center justify-between z-10">
      <span className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${isBad ? 'text-red-500' : 'text-slate-400'}`}>{label}</span>
      <div className="hidden md:block p-1.5 bg-slate-50 rounded-lg">{icon}</div>
    </div>
    <div className="z-10 mt-auto">
      <div className={`text-xl md:text-2xl font-black truncate tracking-tight ${isBad ? 'text-red-700' : 'text-slate-800'}`}>{value}</div>
      <div className="text-[10px] md:text-xs font-bold mt-0.5 text-slate-500">{subtext}</div>
    </div>
  </div>
);

const InputGroup = ({ label, ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    <label className="text-xs font-bold text-slate-500 ml-1">{label}</label>
    <input 
      className="bg-slate-50 border border-slate-200 p-3 md:p-3.5 rounded-xl focus:ring-2 focus:ring-yellow-500 outline-none transition w-full text-sm md:text-base" 
      {...props} 
    />
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center p-3 rounded-xl transition ${active ? 'bg-yellow-500 text-slate-900 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
    <span className="mr-3">{React.cloneElement(icon, { size: 20 })}</span>
    {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 p-1 flex-1 transition ${active ? 'text-yellow-600' : 'text-slate-400'}`}>
    {React.cloneElement(icon, { size: 20, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[9px] font-bold truncate">{label}</span>
  </button>
);

const EmptyState = ({ text }) => (
  <div className="flex flex-col items-center justify-center h-full p-8 text-slate-400 text-center">
    <Package className="w-10 h-10 mb-2 opacity-50" />
    <p className="text-sm font-medium">{text}</p>
  </div>
);

export default App;
