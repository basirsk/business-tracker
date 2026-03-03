import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from './hooks/useAuthState';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SectionDetail = lazy(() => import('./pages/SectionDetail'));
const Analytics = lazy(() => import('./pages/Analytics'));

const Spinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
);

// Route guard — redirect to /login if not authenticated
const PrivateRoute = ({ children }) => {
    const { user, loading } = useAuthState();
    if (loading) return <Spinner />;
    return user ? children : <Navigate to="/login" replace />;
};

// If already logged in, skip auth pages
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuthState();
    if (loading) return <Spinner />;
    return user ? <Navigate to="/dashboard" replace /> : children;
};

function App() {
    return (
        <>
            <Suspense fallback={<Spinner />}>
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                    <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
                    <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                    <Route path="/section/:id" element={<PrivateRoute><SectionDetail /></PrivateRoute>} />
                    <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </Suspense>

            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3500,
                    style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
                    success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
                }}
            />
        </>
    );
}

export default App;
