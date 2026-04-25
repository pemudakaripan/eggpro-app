// --- ENGINE PERHITUNGAN & FILTER ---
  const stats = useMemo(() => {
    const processed = dailyRecords.slice().sort((a,b) => new Date(a.date) - new Date(b.date)).map(record => {
      const pop = parseFloat(record.population) || 350;
      const rev = (parseFloat(record.eggKg) || 0) * (parseFloat(record.eggPrice) || 0);
      const exp = ((parseFloat(record.feedUsed) || 0) * (parseFloat(record.feedPrice) || 0)) + (parseFloat(record.unexpected) || 0);
      const hdp = pop > 0 ? ((parseFloat(record.eggPieces) || 0) / pop) * 100 : 0;
      const fcr = (parseFloat(record.eggKg) || 0) > 0 ? (parseFloat(record.feedUsed) || 0) / (parseFloat(record.eggKg) || 0) : 0;
      return { ...record, revenue: rev, totalExpense: exp, profit: rev - exp, hdp, fcr, pop };
    });

    const now = new Date();
    const filtered = processed.filter(r => {
      if (filterType === '7days') return new Date(r.date) > new Date(now.setDate(now.getDate() - 7));
      return true;
    });

    return { 
      filteredProcessed: filtered, allProcessed: processed, 
      totalProfit: filtered.reduce((s, r) => s + r.profit, 0),
      netProfit: filtered.reduce((s, r) => s + r.profit, 0),
      totalRev: filtered.reduce((s, r) => s + r.revenue, 0),
      today: processed[processed.length - 1] || { hdp: 0, fcr: 0, pop: 350 },
      alerts: [], targetHDP: 80, targetFCR: 2.1, currentPop: formData.population
    };
  }, [dailyRecords, filterType, formData.population]);

  // --- UI RENDER (900 LINES DESIGN STANDARDS) ---
  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50 flex-col"><Loader2 className="animate-spin text-yellow-600 w-12 h-12 mb-4" /><p className="text-slate-500 font-black">Memuat Dashboard Cloud...</p></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 md:pb-0 md:pl-64">
      {/* Sidebar Desktop */}
      <div className="hidden md:flex flex-col w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 p-6 shadow-xl">
        <h1 className="text-2xl font-bold mb-8 flex items-center gap-2 text-yellow-500"><Activity /> EggPro</h1>
        <nav className="space-y-2 flex-1">
          <NavBtn active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Dashboard" />
          <NavBtn active={activeTab === 'input'} onClick={() => setActiveTab('input')} icon={<PlusCircle />} label="Input Harian" />
          <NavBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Box />} label="Stok Barang" />
          <NavBtn active={activeTab === 'health'} onClick={() => setActiveTab('health')} icon={<HeartPulse />} label="Kesehatan" />
          <NavBtn active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<FileSpreadsheet />} label="Riwayat & Laporan" />
        </nav>
      </div>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-end bg-white p-6 rounded-[30px] shadow-sm border border-slate-100">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Ringkasan Performa</h2>
                <p className="text-sm text-slate-400 font-bold uppercase">Populasi: {stats.today.pop} Ekor</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setFilterType('7days')} className={`px-4 py-2 rounded-xl text-xs font-bold ${filterType === '7days' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>7 Hari</button>
                <button onClick={() => setFilterType('all')} className={`px-4 py-2 rounded-xl text-xs font-bold ${filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>Semua</button>
              </div>
            </div>

            {/* Scorecards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="HDP" value={`${stats.today.hdp.toFixed(1)}%`} subtext="Produktivitas" icon={<Activity className="text-blue-500" />} />
              <StatCard label="FCR" value={stats.today.fcr.toFixed(2)} subtext="Rasio Pakan" icon={<PieChart className="text-purple-500" />} />
              <StatCard label="Laba" value={`Rp ${stats.netProfit.toLocaleString()}`} subtext="Periode Ini" icon={<Wallet className="text-green-500" />} />
              <StatCard label="Populasi" value={stats.today.pop} subtext="Ekor Aktif" icon={<Package className="text-yellow-500" />} />
            </div>

            {/* AI Advisor Widget */}
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className="text-2xl font-black flex items-center gap-2 mb-2"><Bot className="text-blue-400"/> AI Farm Advisor ✨</h3>
                  <p className="text-slate-400 max-w-md">Analisis cerdas berdasarkan data HDP dan FCR kandang Anda hari ini.</p>
                </div>
                <button 
                   onClick={async () => {
                     setIsAiLoading(true);
                     const res = await fetchGeminiAI(`Analisis HDP ${stats.today.hdp.toFixed(1)}% dan FCR ${stats.today.fcr.toFixed(2)}.`, "Konsultan Ahli Peternakan.");
                     setAiAdvice(res);
                     setIsAiLoading(false);
                   }}
                   className="bg-yellow-500 text-slate-900 px-8 py-4 rounded-2xl font-black shadow-lg hover:scale-105 transition"
                >
                  {isAiLoading ? 'MENGANALISIS...' : 'MINTA SARAN AI'}
                </button>
              </div>
              {aiAdvice && <div className="mt-6 bg-white/5 p-6 rounded-3xl border border-white/10 text-sm italic">{aiAdvice}</div>}
            </div>

            {/* Grafik Performa */}
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 h-96">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Tren Produksi Telur (Butir)</h3>
               <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.filteredProcessed}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="eggPieces" stroke="#eab308" strokeWidth={5} dot={{r: 6, fill: '#eab308', strokeWidth: 3, stroke: '#fff'}} />
                  </LineChart>
               </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tab Input (Full Design) */}
        {activeTab === 'input' && (
          <div className="max-w-xl mx-auto bg-white p-8 md:p-12 rounded-[50px] shadow-2xl border border-slate-50">
            <h2 className="text-3xl font-black text-slate-900 mb-8 text-center">Pencatatan Harian</h2>
            <form onSubmit={async (e) => { 
              e.preventDefault(); 
              await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'records'), {...formData, timestamp: Date.now()}); 
              setActiveTab('dashboard'); 
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Tanggal" type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <InputGroup label="Populasi" type="number" value={formData.population} onChange={e => setFormData({...formData, population: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Hasil (Butir)" type="number" value={formData.eggPieces} onChange={e => setFormData({...formData, eggPieces: e.target.value})} />
                <InputGroup label="Berat (Kg)" type="number" step="0.1" value={formData.eggKg} onChange={e => setFormData({...formData, eggKg: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="Pakan (Kg)" type="number" value={formData.feedUsed} onChange={e => setFormData({...formData, feedUsed: e.target.value})} />
                <InputGroup label="Harga Telur/Kg" type="number" value={formData.eggPrice} onChange={e => setFormData({...formData, eggPrice: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white p-5 rounded-[25px] font-black text-lg shadow-xl hover:bg-black transition-all">SIMPAN KE CLOUD</button>
            </form>
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-xl p-4 flex justify-around rounded-[30px] shadow-2xl z-50">
        <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'text-yellow-500' : 'text-slate-500'}><LayoutDashboard /></button>
        <button onClick={() => setActiveTab('input')} className={activeTab === 'input' ? 'text-yellow-500' : 'text-slate-500'}><PlusCircle /></button>
        <button onClick={() => setActiveTab('reports')} className={activeTab === 'reports' ? 'text-yellow-500' : 'text-slate-500'}><FileSpreadsheet /></button>
      </nav>
    </div>
  );
};

// --- HELPER COMPONENTS ---
const StatCard = ({ label, value, subtext, icon }) => (
  <div className="bg-white p-5 rounded-[30px] border border-slate-100 shadow-sm flex flex-col justify-between h-32">
    <div className="flex justify-between items-start">
      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
      <div className="p-1.5 bg-slate-50 rounded-lg">{icon}</div>
    </div>
    <div>
      <div className="text-xl font-black text-slate-800 tracking-tight">{value}</div>
      <div className="text-[10px] font-bold text-slate-400">{subtext}</div>
    </div>
  </div>
);

const InputGroup = ({ label, ...props }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
    <input className="bg-slate-50 border-none p-4 rounded-[20px] focus:ring-2 focus:ring-yellow-500 outline-none font-bold" {...props} />
  </div>
);

const NavBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 rounded-2xl transition ${active ? 'bg-yellow-500 text-slate-900 font-black shadow-lg shadow-yellow-500/20' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}>
    <span className="mr-3">{icon}</span> {label}
  </button>
);

export default App;
