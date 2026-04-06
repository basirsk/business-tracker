import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Plus, Trash2, PackageSearch, PackageCheck, Package, Upload
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import toast from 'react-hot-toast';

const SOURCES = ['Bolpur', 'Katwa'];

const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const d = val?.toDate ? val.toDate() : new Date(val);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return String(val); }
};

export default function Inventory() {
    const navigate = useNavigate();
    const { user } = useAuthState();
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    // View state
    const [view, setView] = useState('active'); // 'active' | 'disbursed'

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        modelName: '',
        dateOfEntry: new Date().toISOString().slice(0, 10),
        dateOfDisbursed: '',
        sourceName: 'Bolpur',
        status: 'Active'
    });

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'bt_inventory'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => {
            console.error("Inventory error", err);
            toast.error("Failed to load inventory");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleAdd = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await addDoc(collection(db, 'bt_inventory'), {
                ...formData,
                createdAt: new Date().toISOString(),
                addedBy: user.uid
            });
            toast.success("Stock added!");
            setShowForm(false);
            setFormData({
                modelName: '',
                dateOfEntry: new Date().toISOString().slice(0, 10),
                dateOfDisbursed: '',
                sourceName: 'Bolpur',
                status: 'Active'
            });
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this stock?")) return;
        try {
            await deleteDoc(doc(db, 'bt_inventory', id));
            toast.success("Stock deleted");
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleMarkDisbursed = async (id) => {
        const today = new Date().toISOString().slice(0, 10);
        try {
            await updateDoc(doc(db, 'bt_inventory', id), {
                status: 'Disbursed',
                dateOfDisbursed: today
            });
            toast.success("Marked as disbursed!");
        } catch (err) {
            toast.error(err.message);
        }
    };

    const filteredInventory = inventory.filter(item =>
        view === 'active' ? item.status === 'Active' : item.status === 'Disbursed'
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0d1424] to-slate-900 pb-20 sm:pb-8">
            <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/dashboard')} aria-label="Back"
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-slate-600">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2">
                            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-xl">
                                <Package className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-base leading-tight">Inventory</p>
                                <p className="text-slate-500 text-xs">Manage your stock</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={() => setShowForm(!showForm)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Stock</span>
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                <AnimatePresence>
                    {showForm && (
                        <motion.form
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 overflow-hidden"
                            onSubmit={handleAdd}
                        >
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-cyan-400" /> New Stock Entry
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Model Name</label>
                                    <input required type="text" value={formData.modelName} onChange={e => setFormData({ ...formData, modelName: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        placeholder="e.g. BMW Sport 12V" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Source / Shop</label>
                                    <select required value={formData.sourceName} onChange={e => setFormData({ ...formData, sourceName: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Date of Entry</label>
                                    <input required type="date" value={formData.dateOfEntry} onChange={e => setFormData({ ...formData, dateOfEntry: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                </div>
                                {formData.status === 'Disbursed' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1">Date of Disbursed</label>
                                        <input type="date" value={formData.dateOfDisbursed} onChange={e => setFormData({ ...formData, dateOfDisbursed: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                                    </div>
                                )}
                            </div>
                            <div className="mt-5 flex gap-3 justify-end">
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700 transition">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitting}
                                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white rounded-xl text-sm font-bold transition">
                                    {submitting ? 'Saving...' : 'Save Stock'}
                                </button>
                            </div>
                        </motion.form>
                    )}
                </AnimatePresence>

                <div className="flex bg-slate-800/50 p-1 rounded-xl">
                    <button onClick={() => setView('active')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${view === 'active' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                        Active Stock
                    </button>
                    <button onClick={() => setView('disbursed')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${view === 'disbursed' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                        Disbursed
                    </button>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 animate-pulse">Loading stock...</div>
                    ) : filteredInventory.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                            {view === 'active' ? <PackageSearch className="w-12 h-12 text-slate-600 mb-3" /> : <PackageCheck className="w-12 h-12 text-slate-600 mb-3" />}
                            <p className="text-slate-300 font-semibold mb-1">No {view} stock found</p>
                            <p className="text-slate-500 text-sm">Add stock items to see them listed here.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-700/50">
                            {filteredInventory.map(item => (
                                <li key={item.id} className="p-4 sm:p-5 hover:bg-slate-700/20 transition-colors flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-slate-100 font-bold text-lg">{item.modelName}</h4>
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.sourceName === 'Bolpur' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' : 'bg-pink-900/50 text-pink-300 border border-pink-700'}`}>
                                                {item.sourceName}
                                            </span>
                                        </div>
                                        <div className="text-slate-400 text-sm flex gap-4">
                                            <span><span className="text-slate-500 mr-1">Entry:</span>{fmtDate(item.dateOfEntry)}</span>
                                            {item.dateOfDisbursed && <span><span className="text-slate-500 mr-1">Disbursed:</span>{fmtDate(item.dateOfDisbursed)}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto mt-2 sm:mt-0">
                                        {item.status === 'Active' && (
                                            <button onClick={() => handleMarkDisbursed(item.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition">
                                                <Upload className="w-4 h-4" /> Disburse
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(item.id)} className="bg-rose-900/40 border border-rose-800 text-rose-300 hover:bg-rose-800 hover:text-white p-1.5 rounded-lg transition" aria-label="Delete">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </main>
        </div>
    );
}
