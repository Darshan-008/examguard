import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { MdBluetooth } from 'react-icons/md';
import { RiEyeLine, RiEyeOffLine, RiShieldKeyholeLine, RiMailLine, RiLockPasswordLine } from 'react-icons/ri';

/* ─── Tiny floating particle dot ─────────────────────────────────── */
function Particle({ style }) {
  return (
    <div
      className="absolute w-1 h-1 rounded-full bg-slate-900/10 dark:bg-white/10 animate-float pointer-events-none"
      style={style}
    />
  );
}

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  /* ── Existing login logic — untouched ──────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.role === 'admin' ? '/dashboard' : '/monitoring');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  /* ── Particle positions ─────────────────────────────────────────── */
  const particles = [
    { top: '8%',  left: '12%',  animationDelay: '0s',    animationDuration: '3.2s' },
    { top: '18%', left: '78%',  animationDelay: '0.7s',  animationDuration: '4.1s' },
    { top: '35%', left: '5%',   animationDelay: '1.4s',  animationDuration: '3.6s' },
    { top: '55%', left: '90%',  animationDelay: '0.3s',  animationDuration: '4.8s' },
    { top: '70%', left: '22%',  animationDelay: '2.1s',  animationDuration: '3.0s' },
    { top: '82%', left: '65%',  animationDelay: '1.0s',  animationDuration: '5.2s' },
    { top: '92%', left: '40%',  animationDelay: '1.8s',  animationDuration: '3.9s' },
    { top: '45%', left: '95%',  animationDelay: '2.5s',  animationDuration: '4.4s' },
    { top: '62%', left: '50%',  animationDelay: '0.5s',  animationDuration: '3.3s' },
    { top: '25%', left: '55%',  animationDelay: '3.0s',  animationDuration: '4.7s' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-dark-950">

      {/* ── Animated background layer ────────────────────────────── */}
      <div className="absolute inset-0">

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59,130,246,0.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59,130,246,0.8) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Orb 1 — large blue, top-left */}
        <div
          className="absolute top-[10%] left-[8%] w-[520px] h-[520px] rounded-full bg-primary-600/10 blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        {/* Orb 2 — medium indigo, top-right */}
        <div
          className="absolute top-[-5%] right-[10%] w-[380px] h-[380px] rounded-full bg-indigo-500/12 blur-3xl animate-pulse"
          style={{ animationDelay: '1.2s', animationDuration: '5s' }}
        />
        {/* Orb 3 — small violet, center */}
        <div
          className="absolute top-[40%] left-[40%] w-[260px] h-[260px] rounded-full bg-violet-600/8 blur-3xl animate-pulse"
          style={{ animationDelay: '2.5s', animationDuration: '3.5s' }}
        />
        {/* Orb 4 — large cyan-blue, bottom-left */}
        <div
          className="absolute bottom-[5%] left-[5%] w-[450px] h-[450px] rounded-full bg-blue-500/8 blur-3xl animate-pulse"
          style={{ animationDelay: '0.8s', animationDuration: '6s' }}
        />
        {/* Orb 5 — medium purple, bottom-right */}
        <div
          className="absolute bottom-[10%] right-[8%] w-[340px] h-[340px] rounded-full bg-purple-600/10 blur-3xl animate-pulse"
          style={{ animationDelay: '1.8s', animationDuration: '4.5s' }}
        />
        {/* Orb 6 — tiny rose accent, mid-right */}
        <div
          className="absolute top-[55%] right-[18%] w-[180px] h-[180px] rounded-full bg-blue-400/6 blur-3xl animate-pulse"
          style={{ animationDelay: '3.2s', animationDuration: '5.5s' }}
        />
      </div>

      {/* ── Floating particle dots ───────────────────────────────── */}
      {particles.map((p, i) => (
        <Particle key={i} style={p} />
      ))}

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="relative w-full max-w-md mx-4 animate-fade-in">

        {/* ── Logo & title header ────────────────────────────────── */}
        <div className="text-center mb-8">
          {/* Logo with float animation + halo ring */}
          <div className="relative inline-flex items-center justify-center mb-5 animate-float">
            {/* Outer halo ring */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-500/30 to-indigo-600/30 blur-md scale-110" />
            {/* Subtle pulse ring */}
            <div className="absolute inset-0 rounded-3xl border-2 border-primary-400/20 animate-pulse" />
            {/* Icon container */}
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 to-indigo-600
                            shadow-2xl shadow-primary-500/40 flex items-center justify-center">
              <MdBluetooth className="text-white" style={{ fontSize: '3rem' }} />
            </div>
          </div>

          {/* Gradient title */}
          <h1 className="text-4xl font-bold text-gradient mb-1 tracking-tight">
            BT Monitor
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium tracking-wide">
            ExamGuard — Exam Hall Security
          </p>
        </div>

        {/* ── Glass card ─────────────────────────────────────────── */}
        <div className="relative glass-strong shadow-2xl shadow-slate-200/50 dark:shadow-black/40 animate-scale-in overflow-hidden">

          {/* Top gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-400/70 to-transparent" />
          {/* Subtle inner glow top */}
          <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-primary-500/5 to-transparent pointer-events-none" />

          <div className="p-8">
            {/* Card header */}
            <div className="flex items-center gap-2.5 mb-7">
              <div className="w-8 h-8 rounded-lg bg-primary-500/15 border border-primary-500/25 flex items-center justify-center">
                <RiShieldKeyholeLine className="text-primary-600 dark:text-primary-400" size={16} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white leading-none">Secure Login</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Enter your credentials to continue</p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email field */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <RiMailLine size={12} className="text-slate-500" />
                  Email Address
                </label>
                <div className="relative group">
                  {/* Glowing left border on focus */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-gradient-to-b from-primary-400 to-indigo-400
                                  opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
                  <input
                    id="email"
                    type="email"
                    className="input group-focus-within:border-primary-500/60 group-focus-within:bg-primary-500/5 group-focus-within:pl-5 transition-all duration-300"
                    placeholder="admin@btmonitor.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <RiLockPasswordLine size={12} className="text-slate-500" />
                  Password
                </label>
                <div className="relative group">
                  {/* Glowing left border on focus */}
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl bg-gradient-to-b from-primary-400 to-indigo-400
                                  opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 z-10" />
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    className="input pr-12 group-focus-within:border-primary-500/60 group-focus-within:bg-primary-500/5 group-focus-within:pl-5 transition-all duration-300"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200"
                  >
                    {showPass ? <RiEyeOffLine size={18} /> : <RiEyeLine size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                id="login-btn"
                disabled={loading}
                className="
                  relative w-full flex items-center justify-center gap-2.5
                  py-3.5 px-6 mt-2 rounded-xl font-semibold text-white text-sm
                  bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500
                  shadow-lg shadow-primary-600/30
                  hover:shadow-primary-500/50 hover:shadow-xl hover:from-primary-500 hover:via-primary-400 hover:to-indigo-400
                  hover:-translate-y-0.5
                  active:scale-[0.98]
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  transition-all duration-300
                  overflow-hidden group
                "
              >
                {/* Shimmer sweep on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent
                                -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />

                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <RiShieldKeyholeLine size={16} />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>

            {/* Security feature badges */}
            <div className="flex items-center justify-center gap-2.5 mt-7 pt-6 border-t border-slate-200 dark:border-white/[0.06]">
              {[
                { icon: '🔐', label: 'JWT Auth' },
                { icon: '🛡', label: 'bcrypt' },
                { icon: '⚡', label: 'Real-time' },
              ].map(({ icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium
                             bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400
                             hover:bg-slate-200 dark:hover:bg-white/[0.07] hover:border-slate-300 dark:hover:border-white/[0.14] hover:text-slate-900 dark:hover:text-slate-300
                             transition-all duration-200 cursor-default select-none"
                >
                  <span>{icon}</span>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer note ────────────────────────────────────────── */}
        <p className="text-center text-slate-500 dark:text-slate-600 text-xs mt-5 tracking-wide">
          Bluetooth Detection Monitoring System v1.0 • Secure Access Only
        </p>
      </div>
    </div>
  );
}
