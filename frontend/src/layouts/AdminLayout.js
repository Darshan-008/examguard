import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  RiDashboardLine,
  RiCpuLine, RiAlarmWarningLine, RiUserLine, RiFileChartLine,
  RiLogoutBoxLine, RiMenuFoldLine, RiMenuUnfoldLine,
  RiWifiLine, RiShieldCheckLine, RiEyeLine, RiMapPin2Line,
  RiCloseLine, RiMenuLine
} from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';
import VoiceControl from '../components/VoiceControl';

const adminLinks = [
  { to: '/dashboard',      icon: RiDashboardLine,   label: 'Dashboard' },
  { to: '/infrastructure', icon: RiMapPin2Line,     label: 'Infrastructure' },
  { to: '/devices',        icon: RiCpuLine,         label: 'ESP32 Devices' },
  { to: '/logs',           icon: RiAlarmWarningLine, label: 'Detection Logs' },
  { to: '/monitoring',     icon: RiEyeLine,         label: 'Monitoring' },
  { to: '/users',          icon: RiUserLine,        label: 'Users' },
  { to: '/reports',        icon: RiFileChartLine,   label: 'Reports' },
];
const examLinks = [
  { to: '/monitoring', icon: RiEyeLine,        label: 'Monitoring' },
  { to: '/logs',       icon: RiAlarmWarningLine,label: 'Detection Logs' },
  { to: '/reports',    icon: RiFileChartLine,  label: 'Reports' },
];

// Page titles map
const pageTitles = {
  '/dashboard':      'Dashboard',
  '/infrastructure': 'Infrastructure',
  '/devices':        'ESP32 Devices',
  '/logs':           'Detection Logs',
  '/monitoring':     'Live Monitoring',
  '/users':          'Users',
  '/reports':        'Reports',
};

export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = isAdmin ? adminLinks : examLinks;

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close mobile sidebar on wide screen
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const currentPageTitle = pageTitles[location.pathname] || 'BT Monitor';

  const SidebarContent = ({ isDrawer = false }) => (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/8 gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600
          flex items-center justify-center shadow-lg flex-shrink-0">
          <MdBluetooth className="text-white text-xl" />
        </div>
        {(!collapsed || isDrawer) && (
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-sm truncate">BT Monitor</p>
            <p className="text-slate-500 text-xs truncate">Exam Security</p>
          </div>
        )}
        {isDrawer ? (
          <button onClick={() => setMobileOpen(false)}
            className="ml-auto text-slate-500 hover:text-white transition-colors flex-shrink-0 p-1">
            <RiCloseLine size={20} />
          </button>
        ) : (
          <button onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-slate-500 hover:text-white transition-colors flex-shrink-0">
            {collapsed ? <RiMenuUnfoldLine size={18}/> : <RiMenuFoldLine size={18}/>}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${(!isDrawer && collapsed) ? 'justify-center px-2' : ''}`
            }>
            <Icon size={20} className="flex-shrink-0" />
            {(!collapsed || isDrawer) && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User & Logout */}
      <div className="p-3 border-t border-white/8 space-y-1 flex-shrink-0">
        {(!collapsed || isDrawer) && (
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-500
              flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize truncate">{user?.role}</p>
            </div>
          </div>
        )}
        <button onClick={handleLogout}
          className={`sidebar-link w-full text-danger-400 hover:text-danger-300 hover:bg-danger-500/10
            ${(!isDrawer && collapsed) ? 'justify-center px-2' : ''}`}>
          <RiLogoutBoxLine size={20} className="flex-shrink-0"/>
          {(!collapsed || isDrawer) && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop Sidebar ── */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 transition-all duration-300
        bg-dark-900/80 backdrop-blur-xl border-r border-white/8 flex flex-col
        hidden lg:flex`}>
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <aside className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col
        bg-dark-900 border-r border-white/8 transition-transform duration-300
        lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent isDrawer />
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-white/8
          bg-dark-900/60 backdrop-blur-xl flex-shrink-0 gap-3">

          {/* Mobile hamburger + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white transition-colors p-1 -ml-1"
              aria-label="Open menu"
            >
              <RiMenuLine size={22} />
            </button>
            <div>
              <h1 className="text-white font-semibold text-sm md:text-base leading-tight">
                <span className="hidden md:inline">Bluetooth Detection Monitoring System</span>
                <span className="md:hidden">{currentPageTitle}</span>
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">Examination Hall Security</p>
            </div>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success-500/10
              border border-success-500/20 text-success-400 text-xs font-medium">
              <RiWifiLine size={12}/>
              <span className="hidden xs:inline">Live</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary-500/10
              border border-primary-500/20 text-primary-400 text-xs font-medium capitalize">
              <RiShieldCheckLine size={12}/>
              <span className="hidden sm:inline">{user?.role}</span>
            </div>
            <VoiceControl />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
