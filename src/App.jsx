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

// --- INITIALIZE FIREBASE DENGAN KUNCI ANDA ---
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

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [healthLogs, setHealthLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [filterType, setFilterType] = useState('7days');
  const [customDate, setCustomDate] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    population: 350,
    eggPieces: '', eggKg: '', feedUsed: '',
    eggPrice: '', feedPrice: '', unexpected: '',
    dead: '', culled: ''
  });

  const [invForm, setInvForm] = useState({ name: '', category: 'Pakan', qty: '', unit: 'Kg' });
  const [editingInvId, setEditingInvId] = useState(null);
  const [healthForm, setHealthForm] = useState({ date: new Date().toISOString().split('T')[0], type: 'Vaksin', notes: '' });

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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const stats = useMemo(() => {
    const processed = dailyRecords.slice().sort((a,b) => new Date(a.date) - new Date(b.date)).map(record => {
      const pop = parseFloat(record.population) || 0;
      const revenue = (parseFloat(record.eggKg) || 0) * (parseFloat(record.eggPrice) || 0);
      const totalExpense = ((parseFloat(record.feedUsed) || 0) * (parseFloat(record.feedPrice) || 0)) + (parseFloat(record.unexpected) || 0);
      return { ...record, revenue, totalExpense, profit: revenue - totalExpense, hdp: pop > 0 ? ((parseFloat(record.eggPieces) || 0) / pop) * 100 : 0, fcr: (parseFloat(record.eggKg) || 0) > 0 ? (parseFloat(record.feedUsed) || 0) / (parseFloat(record.eggKg) || 0) : 0 };
    });
    const lastRec = processed.length > 0 ? processed[processed.length - 1] : { hdp: 0, fcr: 0 };
    const totalRev = processed.reduce((sum, r) => sum + r.revenue, 0);
    const totalExp = processed.reduce((sum, r) => sum + r.totalExpense, 0);
    return { allProcessed: processed, filteredProcessed: processed, currentPop: formData.population, totalRev, totalExp, netProfit: totalRev - totalExp, today: lastRec, alerts: [] };
  }, [dailyRecords, formData.population]);

  const handleDailySubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), { ...formData, timestamp: Date.now() });
    setFormData(prev => ({ ...prev, date: new Date().toISOString().split('T')[0], unexpected: '', dead: '', culled: '' }));
    setActiveTab('dashboard');
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 flex-col"><Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" /><p className="text-slate-500 font-bold">Menghubungkan ke Cloud...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64 relative">
        {/* Konten Dashboard (disingkat untuk keringkasan, gunakan sisa UI dari kode sebelumnya) */}
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">EggPro Dashboard</h1>
            <p>Selamat datang! Aplikasi siap digunakan.</p>
            <button onClick={() => setActiveTab('input')} className="bg-yellow-500 p-4 rounded-xl font-bold mt-4">Mulai Input Data</button>
            {activeTab === 'input' && (
                <form onSubmit={handleDailySubmit} className="mt-8 space-y-4 bg-white p-6 rounded-xl shadow">
                    <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="border p-2 w-full" />
                    <input type="number" placeholder="Butir Telur" value={formData.eggPieces} onChange={e => setFormData({...formData, eggPieces: e.target.value})} className="border p-2 w-full" />
                    <button type="submit" className="bg-blue-600 text-white p-2 rounded w-full">Simpan ke Cloud</button>
                </form>
            )}
        </div>
    </div>
  );
};

export default App;