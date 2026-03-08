import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, BarChart3, TrendingUp, TrendingDown, Activity,
    CalendarDays, Download, ChevronDown,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import toast from 'react-hot-toast';

/* ─── Config ────────────────────────────────────────────────────────── */
const SECTIONS = [
    { id: 'vendor', label: 'Vendor', color: '#3b82f6', badge: 'bg-blue-100 text-blue-800' },
    { id: 'investor', label: 'Investor', color: '#10b981', badge: 'bg-emerald-100 text-emerald-800' },
    { id: 'expense', label: 'Expense', color: '#f43f5e', badge: 'bg-rose-100 text-rose-800' },
    { id: 'sales', label: 'Sales', color: '#f59e0b', badge: 'bg-amber-100 text-amber-800' },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */
const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const d = val?.toDate ? val.toDate() : new Date(val);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    catch { return String(val); }
};

/* Last N months (including current) */
const getLastMonths = (n = 6) => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
            value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        });
    }
    return months;
};

const MONTHS = getLastMonths(6);

/* Bar chart helpers */
const maxVal = (data) => Math.max(...data.map(d => d.value), 1);

/* ─── Analytics Component ─────────────────────────────────────────────── */
export default function Analytics() {
    const navigate = useNavigate();
    const { user } = useAuthState();
    const [allTx, setAllTx] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('monthly'); // 'monthly' | 'section'

    const fetchAll = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, 'bt_transactions')));
            setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { toast.error('Failed to load data.'); }
        finally { setLoading(false); }
    }, [user]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /* ── Monthly-breakdown data (last 6 months) ── */
    const monthlyData = MONTHS.map(m => {
        const [yr, mo] = m.value.split('-').map(Number);
        const txs = allTx.filter(t => {
            const d = new Date(t.date);
            return d.getFullYear() === yr && d.getMonth() + 1 === mo;
        });
        const s = id => txs.filter(t => t.section === id).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const sales = s('sales'); const investor = s('investor');
        const vendor = s('vendor'); const expense = s('expense');
        return {
            month: m.label, shortMonth: m.label.split(' ')[0], sales, investor, vendor, expense,
            income: sales + investor, outflow: vendor + expense, net: (sales + investor) - (vendor + expense)
        };
    }).reverse();

    /* ── Section totals (all time) ── */
    const sectionTotals = SECTIONS.map(s => ({
        ...s, total: allTx.filter(t => t.section === s.id).reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
        count: allTx.filter(t => t.section === s.id).length,
    }));
    const grandTotal = sectionTotals.reduce((s, t) => s + t.total, 0);

    /* ── Summary stats ── */
    const totalSales = allTx.filter(t => t.section === 'sales').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalInvestor = allTx.filter(t => t.section === 'investor').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalVendor = allTx.filter(t => t.section === 'vendor').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const totalExpense = allTx.filter(t => t.section === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const netAll = (totalSales + totalInvestor) - (totalVendor + totalExpense);

    /* ── CSV Export ── */
    const exportCSV = () => {
        if (!allTx.length) { toast.error('No data to export'); return; }
        const rows = [['Date', 'Section', 'Description', 'Payment Method', 'Amount (INR)']];
        allTx.sort((a, b) => new Date(b.date) - new Date(a.date))
            .forEach(t => rows.push([t.date, t.section, `"${t.description}"`, t.paymentMethod || 'Cash', t.amount]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `business-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success('CSV exported!');
    };

    /* ── Bar chart ── */
    const maxIncome = Math.max(...monthlyData.map(d => d.income), 1);
    const maxOutflow = Math.max(...monthlyData.map(d => d.outflow), 1);
    const maxBar = Math.max(maxIncome, maxOutflow);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0d1424] to-slate-900">

            {/* ── Header ── */}
            <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} id="back-btn" aria-label="Back"
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-slate-600">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3 flex-1">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-white font-bold text-base leading-tight">Analytics</p>
                            <p className="text-slate-500 text-xs">All-time business overview</p>
                        </div>
                    </div>
                    <button onClick={exportCSV} id="export-csv-btn"
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                {/* ── Summary KPI ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Sales', val: totalSales, color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-700/20' },
                        { label: 'Total Invested', val: totalInvestor, color: 'text-emerald-400', bg: 'bg-emerald-950/40 border-emerald-700/20' },
                        { label: 'Total Vendor', val: totalVendor, color: 'text-blue-400', bg: 'bg-blue-950/40 border-blue-700/20' },
                        { label: 'Total Expense', val: totalExpense, color: 'text-rose-400', bg: 'bg-rose-950/40 border-rose-700/20' },
                    ].map(k => (
                        <div key={k.label} className={`rounded-2xl border p-4 ${k.bg}`}>
                            <p className="text-slate-500 text-xs font-medium mb-1">{k.label}</p>
                            {loading
                                ? <div className="h-6 w-20 bg-slate-700 rounded animate-pulse" />
                                : <p className={`text-lg font-extrabold ${k.color}`}>{fmt(k.val)}</p>
                            }
                        </div>
                    ))}
                </div>

                {/* Net all time */}
                <div className={`rounded-2xl border p-5 ${netAll >= 0 ? 'bg-emerald-950/50 border-emerald-700/30' : 'bg-rose-950/50 border-rose-700/30'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-1">All-Time Net Profit / Loss</p>
                            {loading
                                ? <div className="h-9 w-40 bg-slate-700 rounded-lg animate-pulse" />
                                : <p className={`text-4xl font-black tracking-tight ${netAll >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {netAll < 0 ? '−' : ''}{fmt(Math.abs(netAll))}
                                </p>
                            }
                        </div>
                        {netAll >= 0
                            ? <TrendingUp className="w-12 h-12 text-emerald-700 opacity-40" />
                            : <TrendingDown className="w-12 h-12 text-rose-700 opacity-40" />
                        }
                    </div>
                </div>

                {/* ── View toggle ── */}
                <div className="flex gap-2">
                    {[['monthly', 'Monthly Trend'], ['section', 'By Section']].map(([id, label]) => (
                        <button key={id} onClick={() => setView(id)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all focus:outline-none
                ${view === id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* ── Monthly Bar Chart ── */}
                <AnimatePresence mode="wait">
                    {view === 'monthly' && (
                        <motion.div key="monthly" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                            <h2 className="text-white font-bold mb-1">Monthly Income vs Spending</h2>
                            <p className="text-slate-500 text-xs mb-5">Last 6 months · 🟢 Income (Sales+Investment) vs 🔴 Outflow (Vendor+Expense)</p>

                            {loading ? (
                                <div className="h-48 bg-slate-700/40 rounded-xl animate-pulse" />
                            ) : (
                                <div className="space-y-3">
                                    {monthlyData.map((m, i) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-semibold text-slate-400 w-16 flex-shrink-0">{m.shortMonth}</span>
                                                <span className={`text-xs font-bold ml-auto ${m.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                                                </span>
                                            </div>
                                            {/* Income bar */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-emerald-500 w-3 flex-shrink-0">↑</span>
                                                <div className="flex-1 h-5 bg-slate-700/50 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(m.income / maxBar) * 100}%` }}
                                                        transition={{ duration: 0.7, delay: i * 0.08 }}
                                                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400 w-20 text-right flex-shrink-0">{fmt(m.income)}</span>
                                            </div>
                                            {/* Outflow bar */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-rose-500 w-3 flex-shrink-0">↓</span>
                                                <div className="flex-1 h-5 bg-slate-700/50 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(m.outflow / maxBar) * 100}%` }}
                                                        transition={{ duration: 0.7, delay: i * 0.08 + 0.1 }}
                                                        className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full"
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-400 w-20 text-right flex-shrink-0">{fmt(m.outflow)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── By Section ── */}
                    {view === 'section' && (
                        <motion.div key="section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
                            <h2 className="text-white font-bold mb-1">All-Time by Section</h2>
                            <p className="text-slate-500 text-xs mb-5">Total amount recorded in each category</p>

                            {loading ? (
                                <div className="h-48 bg-slate-700/40 rounded-xl animate-pulse" />
                            ) : (
                                <div className="space-y-4">
                                    {sectionTotals.map((s, i) => {
                                        const pct = grandTotal ? (s.total / grandTotal) * 100 : 0;
                                        return (
                                            <div key={s.id} className="space-y-1.5 cursor-pointer group" onClick={() => navigate(`/section/${s.id}`)}>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">{s.label}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-slate-500">{s.count} entries</span>
                                                        <span className="text-sm font-extrabold text-slate-100">{fmt(s.total)}</span>
                                                        <span className="text-xs text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-6 bg-slate-700/50 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 0.8, delay: i * 0.1 }}
                                                        className="h-full rounded-full"
                                                        style={{ background: s.color }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Recent All Transactions ── */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-slate-500" />
                        <h2 className="text-slate-400 text-sm font-semibold uppercase tracking-wider">All Transactions</h2>
                        <span className="ml-auto text-xs text-slate-600">{allTx.length} total</span>
                    </div>
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="h-4 w-20 bg-slate-700 rounded" />
                                    <div className="h-4 flex-1 bg-slate-700/60 rounded" />
                                    <div className="h-4 w-16 bg-slate-700 rounded" />
                                </div>))}</div>
                        ) : allTx.length === 0 ? (
                            <div className="py-12 text-center text-slate-500 text-sm">No transactions yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-700/40 text-slate-400 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Section</th>
                                            <th className="px-4 py-2.5 text-left font-semibold">Description</th>
                                            <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/30">
                                        {[...allTx].sort((a, b) => new Date(b.date) - new Date(a.date)).map(tx => {
                                            const s = SECTIONS.find(s => s.id === tx.section);
                                            return (
                                                <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                                                    onClick={() => navigate(`/section/${tx.section}`)}>
                                                    <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{fmtDate(tx.date)}</td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s?.badge || ''}`}>{s?.label}</span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-slate-200 max-w-xs truncate">{tx.description}</td>
                                                    <td className="px-4 py-2.5 text-right font-extrabold text-slate-100 whitespace-nowrap">{fmt(tx.amount)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
