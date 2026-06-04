import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  RiDashboardLine,
  RiCpuLine, RiAlarmWarningLine, RiUserLine, RiFileChartLine,
  RiLogoutBoxLine, RiMenuFoldLine, RiMenuUnfoldLine,
  RiWifiLine, RiShieldCheckLine, RiEyeLine, RiMapPin2Line,
  RiCloseLine, RiMenuLine, RiSunLine, RiMoonLine
} from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';
import VoiceControl from '../components/VoiceControl';
import useSocket from '../hooks/useSocket';

/* ─────────────────────────── nav config ─────────────────────────── */
const adminLinks = [
  { to: '/dashboard',      icon: RiDashboardLine,    label: 'Dashboard' },
  { to: '/infrastructure', icon: RiMapPin2Line,      label: 'Infrastructure' },
  { to: '/devices',        icon: RiCpuLine,          label: 'ESP32 Devices' },
  { to: '/logs',           icon: RiAlarmWarningLine, label: 'Detection Logs' },
  { to: '/monitoring',     icon: RiEyeLine,          label: 'Monitoring',    hasAlert: true },
  { to: '/users',          icon: RiUserLine,         label: 'Users' },
  { to: '/reports',        icon: RiFileChartLine,    label: 'Reports' },
];
const examLinks = [
  { to: '/monitoring', icon: RiEyeLine,          label: 'Monitoring',    hasAlert: true },
  { to: '/logs',       icon: RiAlarmWarningLine, label: 'Detection Logs' },
  { to: '/reports',    icon: RiFileChartLine,    label: 'Reports' },
];

const pageTitles = {
  '/dashboard':      'Dashboard',
  '/infrastructure': 'Infrastructure',
  '/devices':        'ESP32 Devices',
  '/logs':           'Detection Logs',
  '/monitoring':     'Live Monitoring',
  '/users':          'Users',
  '/reports':        'Reports',
};

/* ─────────────────────── inline style blocks ─────────────────────── */
const globalStyles = `
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: 1; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes badge-pop {
    0%   { transform: scale(0.7); }
    60%  { transform: scale(1.15); }
    100% { transform: scale(1); }
  }
  @keyframes slide-in-left {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }

  .logo-shimmer {
    background: linear-gradient(
      90deg,
      #6366f1 0%,
      #a5b4fc 30%,
      #818cf8 50%,
      #6366f1 70%,
      #4f46e5 100%
    );
    background-size: 200% auto;
    animation: shimmer 3s linear infinite;
  }

  /* mobile drawer slide-in */
  .drawer-open {
    animation: slide-in-left 0.28s cubic-bezier(.22,1,.36,1) forwards;
  }
`;

/* ═══════════════════════════ component ═══════════════════════════ */
export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate   = useNavigate();
  const location   = useLocation();
  const { on, off } = useSocket();

  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [alertCount,  setAlertCount]  = useState(0);
  const [clock,       setClock]       = useState('');

  const links = isAdmin ? adminLinks : examLinks;

  /* ── live clock ── */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setClock(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── alert count from socket ── */
  useEffect(() => {
    const handleAlert   = () => setAlertCount(c => c + 1);
    const handleCleared = () => setAlertCount(c => Math.max(0, c - 1));
    on('bluetoothAlert', handleAlert);
    on('alertCleared',   handleCleared);
    return () => {
      off('bluetoothAlert', handleAlert);
      off('alertCleared',   handleCleared);
    };
  }, [on, off]);

  /* ── close mobile drawer on route change ── */
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  /* ── close mobile drawer on wide screen ── */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };
  const currentPageTitle = pageTitles[location.pathname] || 'BT Monitor';

  /* ─────────────────────── Alert Badge ─────────────────────── */
  const AlertBadge = () => (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ml-auto shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-[badge-pop_0.3s_ease]"
    >
      {alertCount > 99 ? '99+' : alertCount}
    </span>
  );

  /* ─────────────────────── Sidebar content ─────────────────────── */
  const SidebarContent = ({ isDrawer = false }) => {
    const isCollapsed = !isDrawer && collapsed;
    return (
      <>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-white/8 gap-3 flex-shrink-0">
          <div
            className="logo-shimmer w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ boxShadow: '0 0 18px rgba(99,102,241,0.45)' }}
          >
            <MdBluetooth className="text-white text-xl" />
          </div>

          {(!isCollapsed) && (
            <div className="min-w-0 flex-1">
              <p className="text-slate-900 dark:text-white font-bold text-sm truncate">BT Monitor</p>
              <p className="text-slate-600 dark:text-slate-500 text-xs truncate">
                Exam Security&nbsp;
                <span className="inline-block bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[9px] font-bold px-1.5 py-px rounded border border-indigo-200 dark:border-indigo-500/30 tracking-wider">
                  v2.0
                </span>
              </p>
            </div>
          )}

          {isDrawer ? (
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0 p-1"
            >
              <RiCloseLine size={20} />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="ml-auto text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex-shrink-0"
            >
              {collapsed ? <RiMenuUnfoldLine size={18} /> : <RiMenuFoldLine size={18} />}
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, icon: Icon, label, hasAlert }) => (
            <div key={to} className="group relative">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative border-l-2 no-underline ` +
                  (isActive
                    ? `text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-600 shadow-[inset_0_0_12px_rgba(99,102,241,0.08)]`
                    : `text-slate-600 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5`) +
                  (isCollapsed ? ' justify-center px-2' : '')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                      <Icon size={20} />
                    </span>

                    {!isCollapsed && (
                      <span className="truncate flex-1">{label}</span>
                    )}

                    {/* Alert badge on Monitoring */}
                    {hasAlert && alertCount > 0 && !isCollapsed && (
                      <AlertBadge />
                    )}

                    {/* Collapsed mini-dot badge */}
                    {hasAlert && alertCount > 0 && isCollapsed && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                    )}
                  </>
                )}
              </NavLink>

              {/* Tooltip shown only in collapsed desktop mode */}
              {isCollapsed && (
                <span className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-200 text-xs font-semibold py-1 px-2.5 rounded-md whitespace-nowrap border border-slate-200 dark:border-white/10 shadow-lg transition-all z-[100]">
                  {label}
                </span>
              )}
            </div>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-white/8 space-y-1 flex-shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              {/* Avatar with online dot */}
              <div className="relative shrink-0">
                <div
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-[0_0_14px_rgba(99,102,241,0.5)] border-2 border-white dark:border-indigo-500/40"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #4f46e5 100%)',
                  }}
                >
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                {/* Green online dot */}
                <span className="absolute bottom-[1px] right-[1px] w-[9px] h-[9px] rounded-full bg-green-500 border-2 border-white dark:border-slate-900 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                {/* Pulse ring */}
                <span className="absolute bottom-[1px] right-[1px] w-[9px] h-[9px] rounded-full bg-green-500/50 animate-[pulse-ring_1.8s_ease-out_infinite]" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-500 capitalize truncate">{user?.role}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`group flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-red-600 dark:text-danger-400 hover:text-red-700 dark:hover:text-danger-300 hover:bg-red-50 dark:hover:bg-danger-500/10
              ${isCollapsed ? 'justify-center px-2' : 'px-3'}`}
          >
            <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">
              <RiLogoutBoxLine size={20} className="flex-shrink-0" />
            </span>
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </>
    );
  };

  /* ─────────────────────────── render ─────────────────────────── */
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0f172a]">
      {/* inject keyframe / utility styles */}
      <style>{globalStyles}</style>

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 transition-all duration-300
          bg-white/90 dark:bg-dark-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-white/8 flex-col hidden lg:flex`}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      <div
        className={`fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300
          ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Mobile Drawer ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col
          bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-white/8 lg:hidden
          ${mobileOpen ? 'drawer-open' : ''}
          transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent isDrawer />
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-transparent">

        {/* Topbar */}
        <header
          className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 dark:border-white/8
            bg-white/90 dark:bg-dark-900/60 backdrop-blur-xl flex-shrink-0 gap-3"
        >
          {/* Mobile hamburger + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1 -ml-1"
              aria-label="Open menu"
            >
              <RiMenuLine size={22} />
            </button>
            <div>
              <h1 className="text-slate-900 dark:text-white font-semibold text-sm md:text-base leading-tight">
                <span className="hidden md:inline">Bluetooth Detection Monitoring System</span>
                <span className="md:hidden">{currentPageTitle}</span>
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-500 hidden sm:block">Examination Hall Security</p>
            </div>
          </div>

          {/* Right side: status badges + clock + VoiceControl */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-50 dark:bg-success-500/10
                border border-green-200 dark:border-success-500/20 text-green-700 dark:text-success-400 text-xs font-medium"
            >
              <RiWifiLine size={12} />
              <span className="hidden xs:inline">Live</span>
            </div>

            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-primary-500/10
                border border-indigo-200 dark:border-primary-500/20 text-indigo-700 dark:text-primary-400 text-xs font-medium capitalize"
            >
              <RiShieldCheckLine size={12} />
              <span className="hidden sm:inline">{user?.role}</span>
            </div>

            {/* Live Clock */}
            {clock && (
              <div
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/22 text-indigo-700 dark:text-indigo-300 text-xs font-bold tabular-nums tracking-wide shrink-0"
              >
                <span className="text-[10px] opacity-70">🕐</span>
                <span>{clock}</span>
              </div>
            )}

            <button onClick={toggleTheme} className="btn-icon">
              {isDark ? <RiSunLine size={18} className="text-yellow-400" /> : <RiMoonLine size={18} className="text-slate-600" />}
            </button>

            <VoiceControl />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-slate-50 dark:bg-transparent">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
