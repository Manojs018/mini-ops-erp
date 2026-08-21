import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Lock, Mail, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, Zap, PackageCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/axios';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* LEFT COLUMN: Branding & Showcase */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-12 lg:flex border-r border-slate-800/80">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/4 -z-10 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 -z-10 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />

        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <Layers className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white">OpsFlow</h1>
            <p className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">
              Mini Operations ERP
            </p>
          </div>
        </div>

        {/* Hero Copy */}
        <div className="my-auto space-y-6 max-w-lg">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight text-white">
            Operations, Inventory & Order Control — Unified.
          </h2>
          <p className="text-sm leading-relaxed text-slate-400">
            High-performance enterprise logistics management. Experience real-time multi-location inventory tracking, work order shortage analytics, atomic stock transfers, and concurrency-safe reservations.
          </p>

          {/* Feature Bullets */}
          <div className="space-y-3 pt-4">
            <div className="flex items-center space-x-3 text-xs font-medium text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span>Atomic SQL Concurrency & Race-Condition Safe Engine</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-medium text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <PackageCheck className="h-4 w-4" />
              </div>
              <span>Multi-Location Batch Traceability & Partial Transfers</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-medium text-slate-300">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <Zap className="h-4 w-4" />
              </div>
              <span>All-Or-Nothing Multi-Line Reservation Guarantees</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-xs text-slate-500">
          © 2026 OpsFlow Systems Inc. Enterprise Grade Case Study.
        </div>
      </div>

      {/* RIGHT COLUMN: Login Card */}
      <div className="flex w-full flex-col justify-center px-8 py-12 lg:w-1/2 lg:px-20 bg-slate-950">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div>
            <div className="lg:hidden flex items-center space-x-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-white">OpsFlow ERP</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-white">Welcome back</h3>
            <p className="mt-1.5 text-xs text-slate-400">
              Sign in to your enterprise credentials to access your control portal.
            </p>
          </div>

          {/* Quick Demo Login Preset Buttons */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Quick Fill Demo Role Credentials
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@minerp.local')}
                className="flex items-center justify-center space-x-1.5 rounded-xl border border-violet-800/60 bg-violet-950/40 px-3 py-2 text-xs font-semibold text-violet-300 transition-colors hover:bg-violet-900/50"
              >
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('ops@minerp.local')}
                className="flex items-center justify-center space-x-1.5 rounded-xl border border-blue-800/60 bg-blue-950/40 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-900/50"
              >
                <span>Operations</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('sales@minerp.local')}
                className="flex items-center justify-center space-x-1.5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/50"
              >
                <span>Sales Rep</span>
              </button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="flex items-start space-x-3 rounded-xl border border-rose-800/60 bg-rose-950/50 p-4 text-rose-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
              <p className="text-xs leading-normal font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@minerp.local"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50"
            >
              <span>{isLoading ? 'Signing in...' : 'Sign in to Portal'}</span>
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
