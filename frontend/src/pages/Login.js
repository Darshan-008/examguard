import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { MdBluetooth } from 'react-icons/md';
import { RiEyeLine, RiEyeOffLine, RiShieldKeyholeLine } from 'react-icons/ri';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-dark-950">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1s'}} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-600/8 rounded-full blur-3xl animate-pulse" style={{animationDelay:'2s'}} />
      </div>

      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl
            bg-gradient-to-br from-primary-500 to-indigo-600 shadow-2xl shadow-primary-500/30 mb-4">
            <MdBluetooth className="text-white text-4xl" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">BT Monitor</h1>
          <p className="text-slate-400">Examination Hall Security System</p>
        </div>

        {/* Card */}
        <div className="glass-strong p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <RiShieldKeyholeLine className="text-primary-400" size={20}/>
            <h2 className="text-lg font-semibold text-white">Secure Login</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="admin@btmonitor.com"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="input pr-12"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  {showPass ? <RiEyeOffLine size={18}/> : <RiEyeLine size={18}/>}
                </button>
              </div>
            </div>

            <button type="submit" id="login-btn"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Authenticating...</>
              ) : 'Sign In'}
            </button>
          </form>


        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Bluetooth Detection Monitoring System v1.0 • Secure Access Only
        </p>
      </div>
    </div>
  );
}
