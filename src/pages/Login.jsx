import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle, BarChart3 } from 'lucide-react';
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const validate = () => {
        const e = {};
        if (!form.email.trim()) e.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
        if (!form.password) e.password = 'Password is required';
        setErrors(e);
        return !Object.keys(e).length;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            const cred = await signInWithEmailAndPassword(auth, form.email.trim().toLowerCase(), form.password);
            const userEmail = cred.user.email;
            if (userEmail !== 'culebasir@gmail.com' && userEmail !== 'gitanjalitoyskolkata@gmail.com') {
                await signOut(auth);
                toast.error('you are not allowed to login');
                return;
            }
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (err) {
            const msg =
                err.code === 'auth/user-not-found' ? 'No account found with this email.' :
                    err.code === 'auth/wrong-password' ? 'Incorrect password.' :
                        err.code === 'auth/invalid-credential' ? 'Incorrect email or password.' :
                            err.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.' :
                                'Login failed. Please try again.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        try {
            const cred = await signInWithPopup(auth, new GoogleAuthProvider());
            const userEmail = cred.user.email;
            if (userEmail !== 'culebasir@gmail.com' && userEmail !== 'gitanjalitoyskolkata@gmail.com') {
                await signOut(auth);
                toast.error('you are not allowed to login');
                return;
            }
            navigate('/dashboard');
        } catch {
            toast.error('Google sign-in failed.');
        } finally {
            setLoading(false);
        }
    };

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
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Business Tracker</h1>
                    <p className="text-slate-400 mt-1 text-sm">Sign in to manage your daily finances</p>
                </div>

                {/* Card */}
                <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700/60 rounded-2xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Email address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="login-email"
                                    type="email"
                                    autoComplete="email"
                                    value={form.email}
                                    onChange={(e) => { setForm(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: '' })); }}
                                    placeholder="you@example.com"
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-700/60 border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.email ? 'border-red-500' : 'border-slate-600'}`}
                                />
                            </div>
                            {errors.email && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="login-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    id="login-password"
                                    type={showPw ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    value={form.password}
                                    onChange={(e) => { setForm(p => ({ ...p, password: e.target.value })); setErrors(p => ({ ...p, password: '' })); }}
                                    placeholder="••••••••"
                                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-700/60 border text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${errors.password ? 'border-red-500' : 'border-slate-600'}`}
                                />
                                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="mt-1 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.password}</p>}
                            {/* Forgot password link */}
                            <div className="mt-2 text-right">
                                <Link
                                    to="/forgot-password"
                                    id="forgot-password-link"
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            id="login-submit-btn"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        >
                            {loading ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="text-slate-500 text-xs">or</span>
                        <div className="flex-1 h-px bg-slate-700" />
                    </div>

                    {/* Google */}
                    <button
                        onClick={handleGoogle}
                        disabled={loading}
                        id="google-signin-btn"
                        className="w-full flex items-center justify-center gap-3 bg-slate-700/60 border border-slate-600 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-xl transition-all disabled:opacity-60 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="mt-6 flex flex-col items-center gap-2 text-sm">
                        <p className="text-slate-500">
                            No account?{' '}
                            <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
                                Create one free
                            </Link>
                        </p>
                        <Link
                            to="/forgot-password"
                            className="text-slate-500 hover:text-slate-300 transition-colors text-xs"
                        >
                            Forgot your password?
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
