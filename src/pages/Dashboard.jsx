import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    BarChart3, LogOut, RefreshCw, ArrowRight,
    TrendingUp, TrendingDown, Users, ShoppingCart,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import toast from 'react-hot-toast';

/* ─── Section config ────────────────────────────────────────────────── */
const SECTIONS = [
    {
        id: 'vendor',
        label: 'Vendor',
        subtitle: 'Supplier payments made',
        emoji: '🏭',
        Icon: Users,
        gradient: 'from-blue-500 via-blue-600 to-blue-700',
        glow: 'shadow-blue-500/30',
        ring: 'focus-visible:ring-blue-400',
    },
    {
        id: 'investor',
        label: 'Investor',
        subtitle: 'Total investment received',
        emoji: '💼',
        Icon: TrendingUp,
        gradient: 'from-emerald-500 via-emerald-600 to-green-700',
        glow: 'shadow-emerald-500/30',
        ring: 'focus-visible:ring-emerald-400',
    },
    {
        id: 'expense',
        label: 'Expense',
        subtitle: 'Operational costs',
        emoji: '📋',
        Icon: TrendingDown,
        gradient: 'from-rose-500 via-rose-600 to-red-700',
        glow: 'shadow-rose-500/30',
        ring: 'focus-visible:ring-rose-400',
    },
    {
        id: 'sales',
        label: 'Total Sales',
        subtitle: 'Revenue generated',
        emoji: '🛒',
        Icon: ShoppingCart,
        gradient: 'from-amber-500 via-amber-500 to-orange-600',
        glow: 'shadow-amber-500/30',
        ring: 'focus-visible:ring-amber-400',
    },
];

const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(n || 0);

/* ─── Component ─────────────────────────────────────────────────────── */
export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuthState();
    const [totals, setTotals] = useState({ vendor: 0, investor: 0, expense: 0, sales: 0 });
    const [loading, setLoading] = useState(true);

    const fetchTotals = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const results = await Promise.all(
                SECTIONS.map(async ({ id }) => {
                    const q = query(
                        collection(db, 'bt_transactions'),
                        where('section', '==', id),
                        where('uid', '==', user.uid)
                    );
                    const snap = await getDocs(q);
                    const sum = snap.docs.reduce((s, d) => s + (Number(d.data().amount) || 0), 0);
                    return [id, sum];
                })
            );
            setTotals(Object.fromEntries(results));
        } catch {
            toast.error('Failed to load totals.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchTotals(); }, [fetchTotals]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const netProfit = (totals.sales + totals.investor) - (totals.vendor + totals.expense);

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
                            {user && (
                                <p className="text-slate-500 text-xs leading-tight">
                                    {user.displayName || user.email}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchTotals}
                            disabled={loading}
                            aria-label="Refresh"
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-slate-600"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={handleLogout}
                            id="logout-btn"
                            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-slate-600"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* ── Net position ── */}
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`mb-8 rounded-2xl p-5 border ${netProfit >= 0
                            ? 'bg-emerald-950/50 border-emerald-700/30'
                            : 'bg-rose-950/50 border-rose-700/30'
                        }`}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-1">Net Position</p>
                            {loading
                                ? <div className="h-8 w-40 bg-slate-700 rounded-lg animate-pulse" />
                                : <p className={`text-4xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {netProfit < 0 ? '−' : ''}{fmt(Math.abs(netProfit))}
                                </p>
                            }
                            <p className="text-slate-500 text-xs mt-1">
                                Sales & Investment minus Vendor & Expenses
                            </p>
                        </div>
                        <span className={`text-7xl font-black opacity-10 select-none ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {netProfit >= 0 ? '↑' : '↓'}
                        </span>
                    </div>
                </motion.div>

                {/* ── Section Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {SECTIONS.map((sec, i) => (
                        <motion.button
                            key={sec.id}
                            id={`card-${sec.id}`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            whileHover={{ scale: 1.025, y: -4 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate(`/section/${sec.id}`)}
                            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${sec.gradient} shadow-2xl ${sec.glow} text-left cursor-pointer focus:outline-none focus-visible:ring-4 ${sec.ring}`}
                            style={{ minHeight: 168 }}
                            aria-label={`Open ${sec.label}`}
                        >
                            {/* Decorative circles */}
                            <span className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10 blur-sm pointer-events-none" />
                            <span className="absolute -bottom-10 -left-6 w-44 h-44 rounded-full bg-black/10 blur-lg pointer-events-none" />

                            <div className="relative z-10 p-6 h-full flex flex-col justify-between gap-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-white font-bold text-lg leading-tight">{sec.label}</p>
                                        <p className="text-white/60 text-xs mt-0.5">{sec.subtitle}</p>
                                    </div>
                                    <span className="text-3xl leading-none drop-shadow-sm" aria-hidden="true">{sec.emoji}</span>
                                </div>

                                <div className="flex items-end justify-between">
                                    <div>
                                        <p className="text-white/50 text-xs mb-0.5">Total</p>
                                        {loading
                                            ? <div className="h-8 w-28 bg-white/20 rounded-lg animate-pulse" />
                                            : <p className="text-3xl font-extrabold text-white tracking-tight">{fmt(totals[sec.id])}</p>
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

                <p className="text-center text-slate-700 text-xs mt-8">Tap a card to view history or add a new entry</p>
            </main>
        </div>
    );
}
