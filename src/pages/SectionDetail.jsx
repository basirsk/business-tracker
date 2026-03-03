import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Plus, X, Trash2, Loader2,
    AlertCircle, CheckCircle2, CalendarDays,
    CreditCard, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
    collection, query, where,
    getDocs, addDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import toast from 'react-hot-toast';

/* ─── Config ─────────────────────────────────────────────────────────── */
const SECTION_META = {
    vendor: {
        label: 'Vendor',
        emoji: '🏭',
        gradient: 'from-blue-500 to-blue-700',
        badge: 'bg-blue-100 text-blue-700',
        ring: 'focus:ring-blue-400',
        btn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400',
        formHead: 'bg-gradient-to-r from-blue-600 to-blue-700',
        descPlaceholder: 'e.g. Supplier ABC invoice',
    },
    investor: {
        label: 'Investor',
        emoji: '💼',
        gradient: 'from-emerald-500 to-green-700',
        badge: 'bg-emerald-100 text-emerald-700',
        ring: 'focus:ring-emerald-400',
        btn: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-400',
        formHead: 'bg-gradient-to-r from-emerald-600 to-green-700',
        descPlaceholder: 'e.g. Q1 capital injection',
    },
    expense: {
        label: 'Expense',
        emoji: '📋',
        gradient: 'from-rose-500 to-red-700',
        badge: 'bg-rose-100 text-rose-700',
        ring: 'focus:ring-rose-400',
        btn: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-400',
        formHead: 'bg-gradient-to-r from-rose-600 to-red-700',
        descPlaceholder: 'e.g. Monthly office rent',
    },
    sales: {
        label: 'Total Sales',
        emoji: '🛒',
        gradient: 'from-amber-500 to-orange-600',
        badge: 'bg-amber-100 text-amber-700',
        ring: 'focus:ring-amber-400',
        btn: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400',
        formHead: 'bg-gradient-to-r from-amber-500 to-orange-600',
        descPlaceholder: 'e.g. Retail sales — 3 Mar 2026',
    },
};

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Credit Card', 'Other'];

const EMPTY_FORM = {
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    description: '',
    paymentMethod: 'Cash',
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(n || 0);

const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const d = val?.toDate ? val.toDate() : new Date(val);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return String(val);
    }
};

/* ─── Component ───────────────────────────────────────────────────────── */
export default function SectionDetail() {
    const { id: section } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthState();
    const meta = SECTION_META[section];

    const [transactions, setTransactions] = useState([]);
    const [loadingTx, setLoadingTx] = useState(true);
    const [errorTx, setErrorTx] = useState(null);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const [deletingId, setDeletingId] = useState(null);
    const [sortAsc, setSortAsc] = useState(false);

    // Invalid section → back to dashboard
    useEffect(() => { if (!meta) navigate('/dashboard'); }, [meta, navigate]);

    /* Fetch */
    const fetchTx = useCallback(async () => {
        if (!user || !section || !meta) return;
        setLoadingTx(true);
        setErrorTx(null);
        try {
            const q = query(
                collection(db, 'bt_transactions'),
                where('section', '==', section),
                where('uid', '==', user.uid)
            );
            const snap = await getDocs(q);
            setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error(err);
            setErrorTx('Could not load entries. Please try again.');
        } finally {
            setLoadingTx(false);
        }
    }, [user, section, meta]);

    useEffect(() => { fetchTx(); }, [fetchTx]);

    /* Validate form */
    const validate = () => {
        const e = {};
        if (!form.date) e.date = 'Date is required';
        if (!form.amount || isNaN(+form.amount) || +form.amount <= 0)
            e.amount = 'Enter a valid positive amount';
        if (!form.description.trim()) e.description = 'Description is required';
        setFormErrors(e);
        return !Object.keys(e).length;
    };

    /* Submit */
    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        setSubmitting(true);
        try {
            const payload = {
                section,
                uid: user.uid,
                date: form.date,
                amount: parseFloat(form.amount),
                description: form.description.trim(),
                paymentMethod: form.paymentMethod,
                createdAt: serverTimestamp(),
            };
            const ref = await addDoc(collection(db, 'bt_transactions'), payload);
            const newTx = { id: ref.id, ...payload, createdAt: new Date() };
            setTransactions((prev) => [newTx, ...prev]);
            setForm(EMPTY_FORM);
            setShowForm(false);
            toast.success('Entry saved!');
        } catch {
            toast.error('Failed to save. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    /* Delete */
    const handleDelete = async (txId) => {
        if (!window.confirm('Delete this entry? This cannot be undone.')) return;
        setDeletingId(txId);
        try {
            await deleteDoc(doc(db, 'bt_transactions', txId));
            setTransactions((prev) => prev.filter((t) => t.id !== txId));
            toast.success('Entry deleted.');
        } catch {
            toast.error('Failed to delete entry.');
        } finally {
            setDeletingId(null);
        }
    };

    const sorted = [...transactions].sort((a, b) => {
        const diff = new Date(a.date) - new Date(b.date);
        return sortAsc ? diff : -diff;
    });

    const total = transactions.reduce((s, t) => s + (Number(t.amount) || 0), 0);

    if (!meta) return null;

    /* Shared input class builder */
    const inputCls = (key) =>
        `w-full px-3 py-2.5 rounded-xl border text-sm bg-slate-50 text-gray-800 placeholder-gray-400
     focus:outline-none focus:ring-2 transition-all
     ${formErrors[key] ? 'border-red-400 focus:ring-red-300' : `border-gray-200 ${meta.ring}`}`;

    /* ── Render ── */
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0d1424] to-slate-900">

            {/* ── Coloured Header ── */}
            <header className={`bg-gradient-to-r ${meta.gradient} sticky top-0 z-30`}>
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
                    {/* Back */}
                    <button
                        onClick={() => navigate('/dashboard')}
                        id="back-btn"
                        aria-label="Back to dashboard"
                        className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-all
                       focus:outline-none focus:ring-2 focus:ring-white/60 flex-shrink-0"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    {/* Title */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-3xl leading-none drop-shadow" aria-hidden="true">{meta.emoji}</span>
                        <div>
                            <h1 className="text-xl font-extrabold text-white leading-tight">{meta.label}</h1>
                            <p className="text-white/70 text-xs">
                                {transactions.length} entr{transactions.length === 1 ? 'y' : 'ies'} · Total {fmt(total)}
                            </p>
                        </div>
                    </div>

                    {/* New Entry toggle */}
                    <button
                        onClick={() => { setShowForm((v) => !v); setFormErrors({}); }}
                        id="toggle-form-btn"
                        aria-expanded={showForm}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white
                       px-4 py-2 rounded-xl text-sm font-semibold transition-all flex-shrink-0
                       focus:outline-none focus:ring-2 focus:ring-white/60"
                    >
                        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        <span className="hidden sm:inline">{showForm ? 'Cancel' : 'New Entry'}</span>
                    </button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                {/* ── New Entry Form ── */}
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: -16, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            className="bg-white rounded-2xl shadow-2xl overflow-hidden"
                        >
                            {/* Form heading bar */}
                            <div className={`${meta.formHead} px-5 py-3 flex items-center gap-2`}>
                                <FileText className="w-4 h-4 text-white" />
                                <h2 className="text-white font-semibold text-sm">New {meta.label} Entry</h2>
                            </div>

                            <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                    {/* Date */}
                                    <div>
                                        <label htmlFor="field-date" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                            <CalendarDays className="w-3.5 h-3.5" /> Date
                                        </label>
                                        <input
                                            id="field-date" type="date"
                                            value={form.date}
                                            onChange={(e) => { setForm(p => ({ ...p, date: e.target.value })); setFormErrors(p => ({ ...p, date: '' })); }}
                                            className={inputCls('date')}
                                            aria-invalid={!!formErrors.date}
                                        />
                                        {formErrors.date && (
                                            <p role="alert" className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />{formErrors.date}
                                            </p>
                                        )}
                                    </div>

                                    {/* Amount */}
                                    <div>
                                        <label htmlFor="field-amount" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                            <CreditCard className="w-3.5 h-3.5" /> Amount (₹)
                                        </label>
                                        <input
                                            id="field-amount" type="number" min="0" step="0.01"
                                            value={form.amount}
                                            onChange={(e) => { setForm(p => ({ ...p, amount: e.target.value })); setFormErrors(p => ({ ...p, amount: '' })); }}
                                            placeholder="0"
                                            className={inputCls('amount')}
                                            aria-invalid={!!formErrors.amount}
                                        />
                                        {formErrors.amount && (
                                            <p role="alert" className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />{formErrors.amount}
                                            </p>
                                        )}
                                    </div>

                                    {/* Description */}
                                    <div className="sm:col-span-2">
                                        <label htmlFor="field-desc" className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                            <FileText className="w-3.5 h-3.5" /> Description / Name
                                        </label>
                                        <input
                                            id="field-desc" type="text"
                                            value={form.description}
                                            onChange={(e) => { setForm(p => ({ ...p, description: e.target.value })); setFormErrors(p => ({ ...p, description: '' })); }}
                                            placeholder={meta.descPlaceholder}
                                            className={inputCls('description')}
                                            aria-invalid={!!formErrors.description}
                                        />
                                        {formErrors.description && (
                                            <p role="alert" className="mt-1 text-xs text-red-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />{formErrors.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Payment Method */}
                                    <div className="sm:col-span-2">
                                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            <CreditCard className="w-3.5 h-3.5" /> Payment Method
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {PAYMENT_METHODS.map((pm) => (
                                                <button
                                                    key={pm} type="button"
                                                    onClick={() => setForm(p => ({ ...p, paymentMethod: pm }))}
                                                    aria-pressed={form.paymentMethod === pm}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all focus:outline-none focus:ring-2 ${meta.ring}
                            ${form.paymentMethod === pm
                                                            ? `${meta.btn} text-white border-transparent shadow`
                                                            : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'
                                                        }`}
                                                >
                                                    {pm}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormErrors({}); }}
                                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium
                               hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit" id="save-entry-btn" disabled={submitting}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold
                                shadow focus:outline-none focus:ring-2 transition-all disabled:opacity-60 ${meta.btn}`}
                                    >
                                        {submitting
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                            : <><CheckCircle2 className="w-4 h-4" /> Save Entry</>
                                        }
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── History Table ── */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

                    {/* Table toolbar */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <h2 className="text-base font-bold text-gray-800">Transaction History</h2>
                        <button
                            onClick={() => setSortAsc(v => !v)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors focus:outline-none"
                            aria-label={sortAsc ? 'Sort newest first' : 'Sort oldest first'}
                        >
                            {sortAsc ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {sortAsc ? 'Oldest first' : 'Newest first'}
                        </button>
                    </div>

                    {/* Error banner */}
                    {errorTx && (
                        <div className="flex items-center gap-3 m-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{errorTx}</span>
                            <button onClick={fetchTx} className="ml-auto underline text-red-600 hover:text-red-800">Retry</button>
                        </div>
                    )}

                    {/* Loading skeleton */}
                    {loadingTx && (
                        <div className="p-5 space-y-3">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex gap-4 animate-pulse">
                                    <div className="h-4 w-24 bg-gray-200 rounded" />
                                    <div className="h-4 flex-1 bg-gray-100 rounded" />
                                    <div className="h-4 w-20 bg-gray-200 rounded" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {!loadingTx && !errorTx && sorted.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                            <span className="text-7xl mb-4 opacity-20 select-none" aria-hidden="true">{meta.emoji}</span>
                            <h3 className="text-gray-500 font-semibold">No entries yet</h3>
                            <p className="text-gray-400 text-sm mt-1 max-w-xs">
                                Tap <strong>New Entry</strong> above to record your first {meta.label.toLowerCase()} transaction.
                            </p>
                        </div>
                    )}

                    {/* ── Desktop Table ── */}
                    {!loadingTx && sorted.length > 0 && (
                        <>
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                                            <th className="px-5 py-3 text-left font-semibold">Date</th>
                                            <th className="px-5 py-3 text-left font-semibold">Description</th>
                                            <th className="px-5 py-3 text-left font-semibold">Method</th>
                                            <th className="px-5 py-3 text-right font-semibold">Amount</th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        <AnimatePresence>
                                            {sorted.map((tx) => (
                                                <motion.tr
                                                    key={tx.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="hover:bg-gray-50 transition-colors group"
                                                >
                                                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">{fmtDate(tx.date)}</td>
                                                    <td className="px-5 py-3.5 text-gray-800 font-medium max-w-xs truncate">{tx.description}</td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                                                            {tx.paymentMethod || 'Cash'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-extrabold text-gray-900 whitespace-nowrap">
                                                        {fmt(tx.amount)}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <button
                                                            onClick={() => handleDelete(tx.id)}
                                                            disabled={deletingId === tx.id}
                                                            aria-label="Delete entry"
                                                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100
                                         transition-all focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-40"
                                                        >
                                                            {deletingId === tx.id
                                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                : <Trash2 className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                                            <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-gray-500">Grand Total</td>
                                            <td className="px-5 py-3 text-right text-lg font-black text-gray-900">{fmt(total)}</td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            {/* ── Mobile Cards ── */}
                            <div className="sm:hidden divide-y divide-gray-100">
                                <AnimatePresence>
                                    {sorted.map((tx) => (
                                        <motion.div
                                            key={tx.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="px-4 py-4 flex items-start gap-3"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge}`}>
                                                        {tx.paymentMethod || 'Cash'}
                                                    </span>
                                                    <span className="text-xs text-gray-400">{fmtDate(tx.date)}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-800 truncate">{tx.description}</p>
                                                <p className="text-base font-extrabold text-gray-900 mt-0.5">{fmt(tx.amount)}</p>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(tx.id)}
                                                disabled={deletingId === tx.id}
                                                aria-label="Delete entry"
                                                className="mt-1 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all
                                   focus:outline-none flex-shrink-0 disabled:opacity-40"
                                            >
                                                {deletingId === tx.id
                                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                                    : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                                <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-500">Grand Total</span>
                                    <span className="text-base font-black text-gray-900">{fmt(total)}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
