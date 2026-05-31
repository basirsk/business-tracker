import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3, LogOut, RefreshCw, ArrowRight,
    TrendingUp, TrendingDown, Users, ShoppingCart,
    Activity, Clock, CalendarDays, BarChart2, Package
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
    { id: 'cash_in_hand', label: 'Total balance in Hand', subtitle: 'Current balances', emoji: '💵', Icon: Activity, gradient: 'from-purple-500 via-purple-600 to-purple-700', glow: 'shadow-purple-500/30', ring: 'focus-visible:ring-purple-400' },
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
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('month');

    /* Fetch ALL transactions once */
    const fetchAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'bt_transactions'));
            const snap = await getDocs(q);
            setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));

            const invSnap = await getDocs(query(collection(db, 'bt_inventory')));
            setInventory(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error("Dashboard fetch error:", err);
            toast.error('Failed to load data: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* Derived data */
    const filtered = filterByPeriod(allTx, period);

    // Calculate segregated Cash and Bank balances for Total balance in Hand
    const cashInHandTxs = filtered.filter(t => t.section === 'cash_in_hand');
    const cashSubtotal = cashInHandTxs
        .filter(t => !t.balanceType || t.balanceType === 'Cash')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const bankSubtotal = cashInHandTxs
        .filter(t => t.balanceType === 'Bank')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Calculate segregated sales balances for GT, BT, and ET shops
    const salesTxs = filtered.filter(t => t.section === 'sales');
    const gtSalesSubtotal = salesTxs
        .filter(t => !t.shopName || t.shopName === 'GT')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const btSalesSubtotal = salesTxs
        .filter(t => t.shopName === 'BT')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const etSalesSubtotal = salesTxs
        .filter(t => t.shopName === 'ET')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Calculate segregated expense balances for GT, BT, and ET shops
    const expenseTxs = filtered.filter(t => t.section === 'expense');
    const gtExpenseSubtotal = expenseTxs
        .filter(t => !t.shopName || t.shopName === 'GT')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const btExpenseSubtotal = expenseTxs
        .filter(t => t.shopName === 'BT')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const etExpenseSubtotal = expenseTxs
        .filter(t => t.shopName === 'ET')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const totals = Object.fromEntries(
        SECTIONS.map(s => {
            if (s.id === 'cash_in_hand') return [s.id, cashSubtotal + bankSubtotal];
            return [s.id, filtered.filter(t => t.section === s.id).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)];
        })
    );

    const counts = Object.fromEntries(
        SECTIONS.map(s => [s.id, filtered.filter(t => t.section === s.id).length])
    );

    const netProfit = (totals.sales + totals.investor) - (totals.vendor + totals.expense);

    const invActive = inventory.filter(i => i.status === 'Active').reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const invDisbursed = inventory.filter(i => i.status === 'Disbursed').reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const gtActiveInv = inventory.filter(i => i.status === 'Active' && (!i.shopName || i.shopName === 'GT')).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const btActiveInv = inventory.filter(i => i.status === 'Active' && i.shopName === 'BT').reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const etActiveInv = inventory.filter(i => i.status === 'Active' && i.shopName === 'ET').reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

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
            <header className="sticky-header bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2 rounded-xl flex-shrink-0" aria-hidden="true">
                            <span className="text-base leading-none">🧸</span>
                        </div>
                        <div>
                            <p className="text-white font-bold text-sm leading-tight">Gitanjali Toys</p>
                            <p className="text-slate-500 text-xs leading-tight hidden sm:block">{greet()}, {firstName} 👋</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => navigate('/inventory')} aria-label="Inventory"
                            className="bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-3 h-9 rounded-xl text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500 mr-1 hidden sm:flex items-center gap-1.5">
                            <Package className="w-4 h-4" />
                            <span>Inventory</span>
                        </button>
                        <button onClick={fetchAll} disabled={loading} aria-label="Refresh data"
                            className="btn-icon text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-slate-500">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={handleLogout} id="logout-btn" aria-label="Logout"
                            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-3 h-9 rounded-xl text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-slate-500">
                            <LogOut className="w-4 h-4" />
                            <span className="hidden xs:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* ─── Main content — padded for bottom nav on mobile ───── */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24 sm:pb-8">

                {/* ── Period Tabs — 44px tap targets ── */}
                <div role="tablist" aria-label="Time period filter"
                    className="flex items-center gap-1 bg-slate-800/70 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-1">
                    {PERIODS.map(p => (
                        <button
                            role="tab"
                            key={p.id} id={`period-${p.id}`}
                            onClick={() => setPeriod(p.id)}
                            aria-selected={period === p.id}
                            className={`flex-1 text-xs sm:text-sm font-semibold py-2.5 px-2 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[44px]
                ${period === p.id
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-slate-200 active:bg-slate-700'}`}
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
                            {/* Arabic Gitanjali motif */}
                            <p className="text-amber-400/60 text-xs font-medium tracking-widest mb-1 select-none">
                                بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم
                            </p>
                            {/* Main brand name */}
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
                                <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent drop-shadow-sm">
                                    Gitanjali
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

                {/* ── Section Cards — 2-col on mobile too (smaller screens) ── */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {SECTIONS.map((sec, i) => (
                        <motion.button
                            key={sec.id} id={`card-${sec.id}`}
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => navigate(`/section/${sec.id}`)}
                            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${sec.gradient} text-left cursor-pointer focus-visible:ring-4 active:brightness-90 ${sec.ring} transition-all`}
                            style={{ minHeight: 140 }} aria-label={`Open ${sec.label}`}
                        >
                            <span className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
                            <div className="relative z-10 p-4 h-full flex flex-col justify-between gap-2">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0">
                                        <p className="text-white font-bold text-sm sm:text-base leading-tight">{sec.label}</p>
                                        <p className="text-white/60 text-xs mt-0.5 hidden sm:block">{sec.subtitle}</p>
                                    </div>
                                    <span className="text-2xl sm:text-3xl leading-none drop-shadow-sm flex-shrink-0">{sec.emoji}</span>
                                </div>
                                <div>
                                    {loading
                                        ? <div className="h-7 w-20 bg-white/20 rounded-lg animate-pulse" />
                                        : sec.id === 'expense' ? (
                                            <>
                                                <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-none">{fmt(totals[sec.id])}</p>
                                                <div className="flex gap-x-2 gap-y-0.5 flex-wrap mt-1.5 text-[10px] text-white/80 font-bold">
                                                    <span className="flex items-center gap-0.5">🧸 GT: {fmt(gtExpenseSubtotal)}</span>
                                                    <span className="flex items-center gap-0.5">🎮 BT: {fmt(btExpenseSubtotal)}</span>
                                                    <span className="flex items-center gap-0.5">🕹️ ET: {fmt(etExpenseSubtotal)}</span>
                                                </div>
                                                <p className="text-white/40 text-[9px] mt-1 font-medium leading-none">
                                                    {counts[sec.id]} manual {counts[sec.id] === 1 ? 'entry' : 'entries'}
                                                </p>
                                            </>
                                        ) : sec.id === 'sales' ? (
                                            <>
                                                <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-none">{fmt(totals[sec.id])}</p>
                                                <div className="flex gap-x-2 gap-y-0.5 flex-wrap mt-1.5 text-[10px] text-white/80 font-bold">
                                                    <span className="flex items-center gap-0.5">🧸 GT: {fmt(gtSalesSubtotal)}</span>
                                                    <span className="flex items-center gap-0.5">🎮 BT: {fmt(btSalesSubtotal)}</span>
                                                    <span className="flex items-center gap-0.5">🕹️ ET: {fmt(etSalesSubtotal)}</span>
                                                </div>
                                                <p className="text-white/40 text-[9px] mt-1 font-medium leading-none">
                                                    {counts[sec.id]} manual {counts[sec.id] === 1 ? 'entry' : 'entries'}
                                                </p>
                                            </>
                                        ) : sec.id === 'cash_in_hand' ? (
                                            <>
                                                <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-none">{fmt(totals[sec.id])}</p>
                                                <div className="flex gap-x-2.5 gap-y-0.5 flex-wrap mt-1.5 text-[10px] text-white/80 font-bold">
                                                    <span className="flex items-center gap-0.5">💵 Cash: {fmt(cashSubtotal)}</span>
                                                    <span className="flex items-center gap-0.5">🏦 Bank: {fmt(bankSubtotal)}</span>
                                                </div>
                                                <p className="text-white/40 text-[9px] mt-1 font-medium leading-none">
                                                    {counts[sec.id]} manual {counts[sec.id] === 1 ? 'entry' : 'entries'}
                                                </p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-none">{fmt(totals[sec.id])}</p>
                                                <p className="text-white/50 text-xs mt-0.5">
                                                    {`${counts[sec.id]} ${counts[sec.id] === 1 ? 'entry' : 'entries'}`}
                                                </p>
                                            </>
                                        )
                                    }
                                </div>
                            </div>
                        </motion.button>
                    ))}
                    <motion.button
                        id={`card-inventory`}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: SECTIONS.length * 0.07 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => navigate(`/inventory`)}
                        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-cyan-700 to-blue-800 text-left cursor-pointer focus-visible:ring-4 focus-visible:ring-cyan-500 active:brightness-90 transition-all`}
                        style={{ minHeight: 140 }} aria-label={`Open Inventory`}
                    >
                        <span className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
                        <div className="relative z-10 p-4 h-full flex flex-col justify-between gap-2">
                            <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                    <p className="text-white font-bold text-sm sm:text-base leading-tight">Inventory</p>
                                    <p className="text-white/60 text-xs mt-0.5 hidden sm:block">Stock Management</p>
                                </div>
                                <span className="text-2xl sm:text-3xl leading-none drop-shadow-sm flex-shrink-0">📦</span>
                            </div>
                            <div>
                                {loading
                                    ? <div className="h-7 w-20 bg-white/20 rounded-lg animate-pulse" />
                                    : <>
                                        <p className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-none">{invActive}</p>
                                        <div className="flex gap-x-2 gap-y-0.5 flex-wrap mt-1.5 text-[10px] text-white/80 font-bold">
                                            <span className="flex items-center gap-0.5">🧸 GT: {gtActiveInv}</span>
                                            <span className="flex items-center gap-0.5">🎮 BT: {btActiveInv}</span>
                                            <span className="flex items-center gap-0.5">🕹️ ET: {etActiveInv}</span>
                                        </div>
                                        <p className="text-white/40 text-[9px] mt-1 font-medium leading-none">
                                            Active · {invDisbursed} Disbursed
                                        </p>
                                    </>
                                }
                            </div>
                        </div>
                    </motion.button>
                </div>

                {/* ── Recent Activity ── */}
                <section aria-label="Recent activity">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-slate-500" aria-hidden="true" />
                        <h2 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Recent Activity</h2>
                        <button onClick={() => navigate('/analytics')}
                            className="ml-auto text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 min-h-[44px] px-2">
                            Analytics <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="flex gap-3 animate-pulse">
                                        <div className="h-10 w-10 rounded-full bg-slate-700 flex-shrink-0" />
                                        <div className="flex-1 space-y-2 py-1">
                                            <div className="h-3 w-3/4 bg-slate-700 rounded" />
                                            <div className="h-3 w-1/2 bg-slate-700/60 rounded" />
                                        </div>
                                        <div className="h-4 w-16 bg-slate-700 rounded self-center" />
                                    </div>
                                ))}
                            </div>
                        ) : recent.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                                <Clock className="w-8 h-8 text-slate-600 mb-3" />
                                <p className="text-slate-500 font-medium text-sm">No transactions yet</p>
                                <p className="text-slate-600 text-xs mt-1">Tap a section card to add your first entry</p>
                            </div>
                        ) : (
                            <ul role="list" className="divide-y divide-slate-700/50">
                                <AnimatePresence>
                                    {recent.map((tx, i) => {
                                        const sec = SECTIONS.find(s => s.id === tx.section);
                                        return (
                                            <motion.li key={tx.id}
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                                                className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-700/30 active:bg-slate-700/50 transition-colors cursor-pointer group min-h-[56px]"
                                                onClick={() => navigate(`/section/${tx.section}`)}
                                            >
                                                <span className="text-lg flex-shrink-0 w-10 h-10 bg-slate-700/60 rounded-full flex items-center justify-center" aria-hidden="true">
                                                    {sec?.emoji || '📌'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-slate-200 text-sm font-medium truncate">{tx.description}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SECTION_BADGE[tx.section] || 'bg-slate-700 text-slate-300'}`}>
                                                            {sec?.label || tx.section}
                                                        </span>
                                                        <span className="text-slate-500 text-xs flex items-center gap-1">
                                                            <CalendarDays className="w-3 h-3" aria-hidden="true" />
                                                            <time>{fmtDate(tx.date)}</time>
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-slate-100 font-extrabold text-sm flex-shrink-0">{fmt(tx.amount)}</p>
                                            </motion.li>
                                        );
                                    })}
                                </AnimatePresence>
                            </ul>
                        )}
                    </div>
                </section>

                {/* Bottom spacer for safe-area */}
                <div className="h-2" aria-hidden="true" />
            </main>

            {/* ── Sticky Bottom Nav (mobile thumb-zone) ── */}
            <nav aria-label="Main navigation"
                className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 flex items-stretch"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)' }}
            >
                <button onClick={() => navigate('/dashboard')} aria-label="Dashboard" aria-current="page"
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-indigo-400 active:bg-slate-800 transition-colors">
                    <BarChart3 className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Dashboard</span>
                </button>
                <button onClick={() => navigate('/inventory')} aria-label="Inventory"
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-slate-500 hover:text-slate-300 active:bg-slate-800 transition-colors">
                    <Package className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Inventory</span>
                </button>
                <button onClick={() => navigate('/analytics')} aria-label="Analytics"
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-slate-500 hover:text-slate-300 active:bg-slate-800 transition-colors">
                    <BarChart2 className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Analytics</span>
                </button>
                <button onClick={handleLogout} aria-label="Logout"
                    className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-slate-500 hover:text-rose-400 active:bg-slate-800 transition-colors">
                    <LogOut className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Logout</span>
                </button>
            </nav>
        </div>
    );
}
