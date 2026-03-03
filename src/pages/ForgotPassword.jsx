import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Mail,
    ArrowLeft,
    SendHorizonal,
    CheckCircle2,
    AlertCircle,
    BarChart3,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);   // true after email sent

    /* ── Validation ── */
    const validate = () => {
        if (!email.trim()) {
            setEmailError('Email address is required');
            return false;
        }
        if (!/\S+@\S+\.\S+/.test(email.trim())) {
            setEmailError('Please enter a valid email address');
            return false;
        }
        setEmailError('');
        return true;
    };

    /* ── Submit ── */
    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim().toLowerCase());
            setSent(true);
            toast.success('Reset email sent!');
        } catch (err) {
            const msg =
                err.code === 'auth/user-not-found'
                    ? 'No account found with this email address.'
                    : err.code === 'auth/too-many-requests'
                        ? 'Too many requests. Please wait a moment and try again.'
                        : 'Something went wrong. Please try again.';
            toast.error(msg);
            setEmailError(msg);
        } finally {
            setLoading(false);
        }
    };

    /* ── Success State ── */
    if (sent) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-md text-center"
                >
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-extrabold text-white mb-2">Check your inbox</h1>
                    <p className="text-slate-400 text-sm mb-2">
                        We sent a password reset link to
                    </p>
                    <p className="text-indigo-300 font-semibold mb-6 break-all">{email.trim()}</p>
                    <p className="text-slate-500 text-xs mb-8">
                        Didn't receive it? Check your spam folder, or{' '}
                        <button
                            onClick={() => { setSent(false); setEmail(''); }}
                            className="text-indigo-400 hover:text-indigo-300 underline focus:outline-none"
                        >
                            try a different email
                        </button>
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500
                       text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Sign In
                    </Link>
                </motion.div>
            </div>
        );
    }

    /* ── Form State ── */
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-4">
                        <BarChart3 className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Forgot Password?</h1>
                    <p className="text-slate-400 mt-1 text-sm">
                        No worries — we'll send a reset link to your email
                    </p>
                </div>

                {/* Card */}
                <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} noValidate className="space-y-5">

                        {/* Email field */}
                        <div>
                            <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Email address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="reset-email"
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setEmailError('');
                                    }}
                                    placeholder="you@example.com"
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-700/60 border text-slate-100
                              placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all
                              ${emailError ? 'border-red-500' : 'border-slate-600'}`}
                                    aria-invalid={!!emailError}
                                    aria-describedby={emailError ? 'reset-email-error' : undefined}
                                />
                            </div>
                            {emailError && (
                                <p id="reset-email-error" role="alert"
                                    className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                    {emailError}
                                </p>
                            )}
                        </div>

                        {/* Info note */}
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Enter the email address linked to your account and we'll send you
                            a secure link to reset your password.
                        </p>

                        {/* Submit */}
                        <button
                            type="submit"
                            id="send-reset-btn"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600
                         hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl shadow-lg
                         transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            {loading
                                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <SendHorizonal className="w-4 h-4" />
                            }
                            {loading ? 'Sending…' : 'Send Reset Link'}
                        </button>
                    </form>

                    {/* Back to login */}
                    <div className="mt-6 text-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors focus:outline-none focus:underline"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Sign In
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
