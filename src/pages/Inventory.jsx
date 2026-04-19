import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Plus, Trash2, PackageSearch, PackageCheck, Package, Upload, X
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthState } from '../hooks/useAuthState';
import toast from 'react-hot-toast';

const SOURCES = ['Bolpur', 'Katwa'];

const MODEL_OPTIONS = [
    "JEEP - BH80A (GREY)", "JEEP - BH80B (BLACK)", "JEEP - BH80C (RED)", "JEEP - BH80D (BLACK)",
    "JEEP - BH80E (GREY)", "JEEP - EOD (RED)", "JEEP - 528 (RED)", "JEEP - 908 (RED)",
    "JEEP - 888BMW (RED)", "JEEP - G63 (RED)", "JEEP - 5588 (RED)", "JEEP - 6699 (GREY)",
    "JEEP - 518 (RED)", "JEEP - 9111GT1 (RED)", "JEEP - HOOPER (WHITE)", "JEEP - HAIZER (WHITE & GREEN)",
    "JEEP - 6100 (BLACK)", "JEEP - POGO (BLACK)", "JEEP - J66 (RED)", "JEEP - MERCEDES POGO (BLUE)",
    "JEEP - 2188UT (RED)", "JEEP - 1200 (YELLOW)", "JEEP - 1200P (BLUE)", "JEEP - HORNEST (ORANGE)",
    "JEEP - 009F (BLACK)", "JEEP - 2288 (BLACK & GREEN)", "JEEP - 2488 (YELLOW)", "JEEP - 502 (GREY)",
    "JEEP - HUMMER (RED & BLACK)", "JEEP - 1166UT (BLACK & GREEN)", "JEEP - BEAST (RED)",
    "JEEP - JOHN DEERE (RED)", "JEEP - RUBICON (RED)", "JEEP - 1699 (WHITE)",
    "BIKE - ELECTRA (YELLOW)", "BIKE - 6622 (RED)", "BIKE - BOXER (RED)", "BIKE - HARLEY UT (ORANGE)",
    "BIKE - IGL191 (RED)", "BIKE - HAWK (GREEN)", "BIKE - HARLEY (RED)", "BIKE - R-FIELD (RED)",
    "BIKE - 818 (RED)", "BIKE - CBR (RED)", "BIKE - DL99 (WHITE)", "BIKE - KITTY (PINK)",
    "BIKE - GOLDWING (ORANGE)", "BIKE - GOLDWING (BLACK & RED)", "BIKE - DL99 (RED)",
    "BIKE - POLICE (BLUE)", "BIKE - 3188FW (RED)", "BIKE - 6688 (BLACK & RED)", "BIKE - VESPA (RED)",
    "BIKE - 316 (PINK)", "BIKE - K1300 (BLUE)", "BIKE - R3UT (RED)", "BIKE - TERRAIN (WHITE)",
    "BIKE - R3UTP (RED)", "BIKE - HUSKY (RED)", "BIKE - HERO (RED)", "BIKE - R15 (BLUE)",
    "BIKE - R7 (RED)", "BIKE - 018RR (BLUE)", "BIKE - 018RRP (BLACK)", "BIKE - R15P (RED)",
    "BIKE - 999RR (YELLOW)", "BIKE - 259 (BLUE)"
];

const fmtDate = (val) => {
    if (!val) return '—';
    try {
        const d = val?.toDate ? val.toDate() : new Date(val);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return String(val); }
};

export default function Inventory() {
    const navigate = useNavigate();
    const { user } = useAuthState();
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);

    const [view, setView] = useState('active');

    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        modelName: '',
        quantity: 1,
        dateOfEntry: new Date().toISOString().slice(0, 10),
        sourceName: 'Bolpur',
        status: 'Active'
    });

    const [disburseModal, setDisburseModal] = useState({ open: false, item: null, qty: 1, purpose: '' });

    const [modelSearch, setModelSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [isCustomModel, setIsCustomModel] = useState(false);

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

        const finalModelName = isCustomModel ? formData.modelName.trim() : modelSearch.trim();
        if (!finalModelName) {
            toast.error('Please specify a Model Name');
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'bt_inventory'), {
                ...formData,
                modelName: finalModelName,
                createdAt: new Date().toISOString(),
                addedBy: user.uid
            });
            toast.success("Stock added!");
            setShowForm(false);
            setFormData({
                modelName: '',
                quantity: 1,
                dateOfEntry: new Date().toISOString().slice(0, 10),
                sourceName: 'Bolpur',
                status: 'Active'
            });
            setModelSearch('');
            setIsCustomModel(false);
            setShowDropdown(false);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this log?")) return;
        try {
            await deleteDoc(doc(db, 'bt_inventory', id));
            toast.success("Deleted successfully");
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleMarkDisbursed = (item) => {
        if (item.quantity <= 0) return toast.error("Cannot disburse — this item is out of stock.");
        setDisburseModal({ open: true, item, qty: 1, purpose: '' });
    };

    const confirmDisbursement = async () => {
        const { item, qty, purpose } = disburseModal;
        if (!item || qty <= 0 || qty > item.quantity) return;

        const now = new Date().toISOString();
        try {
            const newQty = item.quantity - qty;

            // Deduct stock from active item
            await updateDoc(doc(db, 'bt_inventory', item.id), {
                quantity: newQty
            });

            // Create disbursement log strictly
            await addDoc(collection(db, 'bt_inventory'), {
                modelName: item.modelName,
                sourceName: item.sourceName,
                dateOfEntry: item.dateOfEntry,
                addedBy: item.addedBy || user.uid,
                status: 'Disbursed',
                quantity: qty,
                dateOfDisbursed: now,
                purpose: purpose || 'N/A',
                remainingStock: newQty,
                createdAt: now,
            });
            toast.success(`${qty} units disbursed!`);
            setDisburseModal({ open: false, item: null, qty: 1, purpose: '' });
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleUpdateQuantity = async (id, currentQty, e) => {
        const newVal = parseInt(e.target.value);
        if (isNaN(newVal) || newVal < 0) {
            e.target.value = currentQty;
            return;
        }
        if (newVal !== currentQty) {
            try {
                await updateDoc(doc(db, 'bt_inventory', id), { quantity: newVal });
                toast.success(`Quantity updated to ${newVal}`);
            } catch (err) {
                toast.error(err.message);
            }
        }
    };

    const filteredInventory = inventory.filter(item =>
        view === 'active' ? item.status === 'Active' : item.status === 'Disbursed'
    );

    const countBolpur = filteredInventory
        .filter(i => i.sourceName === 'Bolpur' && i.status === 'Active')
        .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

    const countKatwa = filteredInventory
        .filter(i => i.sourceName === 'Katwa' && i.status === 'Active')
        .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

    const isDisburseOver = disburseModal.item && disburseModal.qty > disburseModal.item.quantity;
    const isDisburseZero = disburseModal.qty <= 0;

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

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">

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
                                <div className="relative">
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Model Name</label>
                                    {!isCustomModel ? (
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={modelSearch}
                                                onChange={(e) => {
                                                    setModelSearch(e.target.value);
                                                    setShowDropdown(true);
                                                }}
                                                onFocus={() => setShowDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                                placeholder="Search model..."
                                                required={!isCustomModel}
                                            />
                                            {showDropdown && (
                                                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                                    {MODEL_OPTIONS.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase())).map(m => (
                                                        <div
                                                            key={m}
                                                            onMouseDown={() => {
                                                                setModelSearch(m);
                                                                setShowDropdown(false);
                                                            }}
                                                            className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50"
                                                        >
                                                            {m}
                                                        </div>
                                                    ))}
                                                    <div
                                                        onMouseDown={() => {
                                                            setIsCustomModel(true);
                                                            setModelSearch('');
                                                            setFormData(prev => ({ ...prev, modelName: '' }));
                                                            setShowDropdown(false);
                                                        }}
                                                        className="px-4 py-2 text-sm text-cyan-400 hover:bg-slate-700 cursor-pointer font-bold bg-slate-900/50"
                                                    >
                                                        + Others (Manual Entry)
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={formData.modelName}
                                                onChange={e => setFormData({ ...formData, modelName: e.target.value })}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                                placeholder="Enter custom model"
                                                autoFocus
                                                required={isCustomModel}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsCustomModel(false);
                                                    setFormData(prev => ({ ...prev, modelName: '' }));
                                                    setModelSearch('');
                                                }}
                                                className="text-xs text-slate-400 hover:text-white px-2 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1">Quantity</label>
                                    <input required type="number" min="0" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
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

                <AnimatePresence>
                    {disburseModal.open && disburseModal.item && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
                            >
                                <button onClick={() => setDisburseModal({ open: false, item: null, qty: 1, purpose: '' })}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition">
                                    <X className="w-5 h-5" />
                                </button>

                                <h3 className="text-white font-bold text-lg mb-1">Disburse Stock</h3>
                                <p className="text-slate-400 text-sm mb-5">Model: <strong className="text-slate-200">{disburseModal.item.modelName}</strong></p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1">How many units are being disbursed?</label>
                                        <input
                                            type="number" min="1" max={disburseModal.item.quantity}
                                            value={disburseModal.qty}
                                            onChange={e => setDisburseModal(p => ({ ...p, qty: parseInt(e.target.value) || 0 }))}
                                            className={`w-full bg-slate-900 border ${isDisburseOver || isDisburseZero ? 'border-red-500/50 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'} rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2`}
                                        />
                                        {isDisburseOver && (
                                            <p className="text-red-400 text-xs mt-1.5 font-medium">Only {disburseModal.item.quantity} units available. Please enter a valid quantity.</p>
                                        )}
                                        {isDisburseZero && !isDisburseOver && (
                                            <p className="text-slate-500 text-xs mt-1.5">Enter a quantity greater than 0.</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1">Recipient / Purpose (Optional)</label>
                                        <input
                                            type="text"
                                            value={disburseModal.purpose}
                                            onChange={e => setDisburseModal(p => ({ ...p, purpose: e.target.value }))}
                                            placeholder="e.g. Sent to Front Display"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                </div>
                                <div className="mt-6 flex justify-end gap-3">
                                    <button onClick={() => setDisburseModal({ open: false, item: null, qty: 1, purpose: '' })}
                                        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-700 transition">
                                        Cancel
                                    </button>
                                    <button onClick={confirmDisbursement}
                                        disabled={isDisburseOver || isDisburseZero}
                                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-bold transition">
                                        Confirm
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <div className="flex bg-slate-800/50 p-1 rounded-xl">
                    <button onClick={() => setView('active')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${view === 'active' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                        Active Stock
                    </button>
                    <button onClick={() => setView('disbursed')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${view === 'disbursed' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                        Disbursed Logs
                    </button>
                </div>

                {view === 'active' && (
                    <div className="flex items-center gap-6 px-4 py-1">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            <span className="text-slate-400">Bolpur Active: <strong className="text-slate-200">{countBolpur}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                            <span className="text-slate-400">Katwa Active: <strong className="text-slate-200">{countKatwa}</strong></span>
                        </div>
                    </div>
                )}

                <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500 animate-pulse">Loading items...</div>
                    ) : filteredInventory.length === 0 ? (
                        <div className="py-16 flex flex-col items-center justify-center text-center px-4">
                            {view === 'active' ? <PackageSearch className="w-12 h-12 text-slate-600 mb-3" /> : <PackageCheck className="w-12 h-12 text-slate-600 mb-3" />}
                            <p className="text-slate-300 font-semibold mb-1">No {view} records found</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-700/50">
                            {filteredInventory.map(item => (
                                <li key={item.id} className="p-4 sm:p-5 hover:bg-slate-700/20 transition-colors flex flex-col sm:flex-row gap-4 justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-slate-100 font-bold text-lg">{item.modelName}</h4>

                                            {view === 'active' && (
                                                <div className="flex items-center gap-2 ml-2">
                                                    <span className="text-slate-400 text-xs">Qty:</span>
                                                    <input
                                                        type="number" min="0"
                                                        defaultValue={item.quantity}
                                                        onBlur={(e) => handleUpdateQuantity(item.id, item.quantity, e)}
                                                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                                                        className="w-14 bg-slate-900 border border-slate-600 focus:border-cyan-500 rounded px-1.5 py-0.5 text-center text-white text-sm focus:outline-none"
                                                    />
                                                    {item.quantity <= 0 ?
                                                        <span className="bg-red-900/50 text-red-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">🔴 Out of Stock</span> :
                                                        item.quantity < 3 ?
                                                            <span className="bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">🟡 Low Stock</span> :
                                                            <span className="bg-green-900/50 text-green-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">🟢 In Stock</span>}
                                                </div>
                                            )}

                                            {view === 'disbursed' && (
                                                <span className="text-cyan-400 text-sm ml-2 font-bold bg-cyan-900/40 px-2 py-0.5 rounded-md">Sent: {item.quantity}</span>
                                            )}

                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${item.sourceName === 'Bolpur' ? 'bg-purple-900/50 text-purple-300 border border-purple-700' : 'bg-pink-900/50 text-pink-300 border border-pink-700'} ml-auto sm:ml-2`}>
                                                {item.sourceName}
                                            </span>
                                        </div>
                                        <div className="text-slate-400 text-sm flex flex-wrap gap-x-4 gap-y-1">
                                            {view === 'active' && <span><span className="text-slate-500 mr-1">Entry:</span>{fmtDate(item.dateOfEntry)}</span>}

                                            {view === 'disbursed' && (
                                                <>
                                                    <span><span className="text-slate-500 mr-1">Time:</span>{fmtDate(item.dateOfDisbursed)}</span>
                                                    {item.purpose && <span><span className="text-slate-500 mr-1">Purpose/To:</span>{item.purpose}</span>}
                                                    {item.remainingStock !== undefined && <span><span className="text-slate-500 mr-1">Remaining after:</span>{item.remainingStock}</span>}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-auto mt-2 sm:mt-0 flex-shrink-0">
                                        {view === 'active' && (
                                            <button onClick={() => handleMarkDisbursed(item)}
                                                disabled={item.quantity <= 0}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition ${item.quantity <= 0 ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
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
