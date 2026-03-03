import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3, LogOut, RefreshCw, ArrowRight,
    TrendingUp, TrendingDown, Users, ShoppingCart,
    Activity, Clock, CalendarDays, BarChart2,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import toast from 'react-hot-toast';

/* ─── Config ──────────────────────────────────────────────────────────── */
const SECTIONS = [
    { id: 'vendor', label: 'Vendor', subtitle: 'Supplier payments', emoji: '🏭', Icon: Users, gradient: 'from-blue-500 via-blue-600 to-blue-700', glow: 'shadow-blue-500/30', ring: 'focus-visible:ring-blue-400' },
    { id: 'investor', label: 'Investor', subtitle: 'Investment received', emoji: '💼', Icon: TrendingUp, gradient: 'from-emerald-500 via-emerald-600 to-green-700', glow: 'shadow-emerald-500/30', ring: 'focus-visible:ring-emerald-400' },
    { id: 'expense', label: 'Expense', subtitle: 'Operational costs', emoji: '📋', Icon: TrendingDown, gradient: 'from-rose-500 via-rose-600 to-red-700', glow: 'shadow-rose-500/30', ring: 'focus-visible:ring-rose-400' },
    { id: 'sales', label: 'Total Sales', subtitle: 'Revenue generated', emoji: '🛒', Icon: ShoppingCart, gradient: 'from-amber-500 via-amber-500 to-orange-600', glow: 'shadow-amber-500/30', ring: 'focus-visible:ring-amber-400' },
];

const PERIODS = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'all', label: 'All Time' },
];

/* ─── Helpers ──────────────────────────────────────────────────────────── */
const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const d = val?.toDate ? val.toDate() : new Date(val);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch { return String(val); }
};

const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};

const filterByPeriod = (txs, period) => {
    const now = new Date();
    return txs.filter(tx => {
        const d = new Date(tx.date);
        if (period === 'today') {
            return d.toDateString() === now.toDateString();
        }
        if (period === 'week') {
            const cut = new Date(now); cut.setDate(now.getDate() - 6); cut.setHours(0, 0, 0, 0);
            return d >= cut;
        }
        if (period === 'month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
    });
};

const SECTION_BADGE = {
    vendor: 'bg-blue-100 text-blue-700',
    investor: 'bg-emerald-100 text-emerald-700',
    expense: 'bg-rose-100 text-rose-700',
    sales: 'bg-amber-100 text-amber-700',
};

/* ─── Component ────────────────────────────────────────────────────────── */
export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthState();
    const [allTx, setAllTx] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month');

    /* Fetch ALL transactions once */
    const fetchAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'bt_transactions'), where('uid', '==', user.uid));
            const snap = await getDocs(q);
            setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch {
            toast.error('Failed to load data.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* Derived data */
    const filtered = filterByPeriod(allTx, period);

    const totals = Object.fromEntries(
        SECTIONS.map(s => [s.id, filtered.filter(t => t.section === s.id).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)])
    );

    const counts = Object.fromEntries(
        SECTIONS.map(s => [s.id, filtered.filter(t => t.section === s.id).length])
    );

    const netProfit = (totals.sales + totals.investor) - (totals.vendor + totals.expense);

    /* Recent activity — last 6 transactions across all sections */
    const recent = [...allTx]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 6);

    const handleLogout = async () => { await signOut(auth); navigate('/login'); };

    const firstName = user?.displayName?.split(' ')[0] || 'there';

    /* ── Render ── */
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0d1424] to-slate-900">

            {/* ── Top Bar ── */}
            <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-base leading-tight">Business Tracker</p>
                            <p className="text-slate-500 text-xs leading-tight">{greet()}, {firstName} 👋</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Analytics */}
                        <button
                            onClick={() => navigate('/analytics')}
                            id="analytics-btn"
                            className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-slate-600"
                        >
                            <BarChart2 className="w-4 h-4" /> Analytics
                        </button>
                        <button onClick={fetchAll} disabled={loading} aria-label="Refresh"
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-slate-600">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={handleLogout} id="logout-btn"
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-slate-600">
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                {/* ── Period Tabs ── */}
                <div className="flex items-center gap-2 bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-1.5">
                    {PERIODS.map(p => (
                        <button
                            key={p.id} id={`period-${p.id}`}
                            onClick={() => setPeriod(p.id)}
                            className={`flex-1 text-sm font-semibold py-2 px-3 rounded-xl transition-all focus:outline-none
                ${period === p.id
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>

                {/* ── Brand Hero ── */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="relative rounded-2xl overflow-hidden border border-amber-500/20 bg-gradient-to-br from-slate-800/80 via-amber-950/30 to-slate-800/80 backdrop-blur-sm"
                >
                    {/* Background glow orbs */}
                    <div className="absolute -top-10 -left-10 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 px-6 py-5 flex items-center justify-between gap-4">
                        <div>
                            {/* Arabic Bismillah motif */}
                            <p className="text-amber-400/60 text-xs font-medium tracking-widest mb-1 select-none">
                                بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم
                            </p>
                            {/* Main brand name */}
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
                                <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
                                    Bismillah
                                </span>
                                <span className="text-white ml-2">Toys</span>
                            </h1>
                            <p className="text-slate-400 text-xs mt-1.5 font-medium tracking-wide">
                                🧸 Business Tracker &nbsp;·&nbsp; Daily Sales, Expenses &amp; Vendors
                            </p>
                        </div>
                        {/* Decorative toy emoji cluster */}
                        <div className="flex-shrink-0 text-right select-none">
                            <div className="text-5xl leading-none opacity-80 drop-shadow-lg">🧸</div>
                            <div className="text-2xl mt-1 opacity-50">🪀 🎮</div>
                        </div>
                    </div>

                    {/* Shimmer bar at bottom */}
                    <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />
                </motion.div>

                {/* ── Section Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SECTIONS.map((sec, i) => (
                        <motion.button
                            key={sec.id} id={`card-${sec.id}`}
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                            whileHover={{ scale: 1.025, y: -4 }} whileTap={{ scale: 0.97 }}
                            onClick={() => navigate(`/section/${sec.id}`)}
                            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${sec.gradient} shadow-2xl ${sec.glow} text-left cursor-pointer focus:outline-none focus-visible:ring-4 ${sec.ring}`}
                            style={{ minHeight: 156 }} aria-label={`Open ${sec.label}`}
                        >
                            <span className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10 blur-sm pointer-events-none" />
                            <span className="absolute -bottom-10 -left-6 w-44 h-44 rounded-full bg-black/10 blur-lg pointer-events-none" />
                            <div className="relative z-10 p-5 h-full flex flex-col justify-between gap-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-white font-bold text-lg leading-tight">{sec.label}</p>
                                        <p className="text-white/60 text-xs mt-0.5">{sec.subtitle}</p>
                                    </div>
                                    <span className="text-3xl leading-none drop-shadow-sm">{sec.emoji}</span>
                                </div>
                                <div className="flex items-end justify-between">
                                    <div>
                                        {loading
                                            ? <div className="h-8 w-28 bg-white/20 rounded-lg animate-pulse" />
                                            : <>
                                                <p className="text-3xl font-extrabold text-white tracking-tight">{fmt(totals[sec.id])}</p>
                                                <p className="text-white/50 text-xs mt-0.5">
                                                    {counts[sec.id]} {counts[sec.id] === 1 ? 'entry' : 'entries'}
                                                </p>
                                            </>
                                        }
                                    </div>
                                    <span className="bg-white/20 backdrop-blur-sm p-2 rounded-xl text-white hover:bg-white/30 transition-colors">
                                        <ArrowRight className="w-5 h-5" />
                                    </span>
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>

                {/* ── Recent Activity ── */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-slate-500" />
                        <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Recent Activity</h2>
                        <button onClick={() => navigate('/analytics')}
                            className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                            View Analytics <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="flex gap-3 animate-pulse">
                                        <div className="h-8 w-8 rounded-full bg-slate-700 flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 w-3/4 bg-slate-700 rounded" />
                                            <div className="h-3 w-1/2 bg-slate-700/60 rounded" />
                                        </div>
                                        <div className="h-4 w-16 bg-slate-700 rounded" />
                                    </div>
                                ))}
                            </div>
                        ) : recent.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Clock className="w-8 h-8 text-slate-600 mb-3" />
                                <p className="text-slate-500 font-medium text-sm">No transactions yet</p>
                                <p className="text-slate-600 text-xs mt-1">Tap a section card above to add your first entry</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-700/50">
                                <AnimatePresence>
                                    {recent.map((tx, i) => {
                                        const sec = SECTIONS.find(s => s.id === tx.section);
                                        return (
                                            <motion.li key={tx.id}
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors cursor-pointer group"
                                                onClick={() => navigate(`/section/${tx.section}`)}
                                            >
                                                <span className="text-xl flex-shrink-0 w-9 h-9 bg-slate-700/60 rounded-full flex items-center justify-center">
                                                    {sec?.emoji || '📌'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-slate-200 text-sm font-medium truncate">{tx.description}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SECTION_BADGE[tx.section] || 'bg-slate-700 text-slate-300'}`}>
                                                            {sec?.label || tx.section}
                                                        </span>
                                                        <span className="text-slate-500 text-xs flex items-center gap-1">
                                                            <CalendarDays className="w-3 h-3" />{fmtDate(tx.date)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-slate-100 font-extrabold text-sm flex-shrink-0">{fmt(tx.amount)}</p>
                                                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
                                            </motion.li>
                                        );
                                    })}
                                </AnimatePresence>
                            </ul>
                        )}
                    </div>
                </div>

                <p className="text-center text-slate-700 text-xs pb-2">Tap a card to view history or add a new entry</p>
            </main>
        </div>
    );
}
