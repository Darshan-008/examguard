import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  RiDashboardLine, RiBuilding2Line, RiStackLine, RiDoorOpenLine,
  RiCpuLine, RiAlarmWarningLine, RiUserLine, RiFileChartLine,
  RiSettings3Line, RiLogoutBoxLine, RiMenuFoldLine, RiMenuUnfoldLine,
  RiWifiLine, RiShieldCheckLine, RiEyeLine, RiMapPin2Line
} from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';

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

export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const links = isAdmin ? adminLinks : examLinks;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 transition-all duration-300
        bg-dark-900/80 backdrop-blur-xl border-r border-white/8 flex flex-col`}>

        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-white/8 gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600
            flex items-center justify-center shadow-lg flex-shrink-0">
            <MdBluetooth className="text-white text-xl" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">BT Monitor</p>
              <p className="text-slate-500 text-xs truncate">Exam Security</p>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-slate-500 hover:text-white transition-colors flex-shrink-0">
            {collapsed ? <RiMenuUnfoldLine size={18}/> : <RiMenuFoldLine size={18}/>}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`
              }>
              <Icon size={20} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="p-3 border-t border-white/8 space-y-1">
          {!collapsed && (
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
              ${collapsed ? 'justify-center px-2' : ''}`}>
            <RiLogoutBoxLine size={20} className="flex-shrink-0"/>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/8
          bg-dark-900/60 backdrop-blur-xl flex-shrink-0">
          <div>
            <h1 className="text-white font-semibold">Bluetooth Detection Monitoring System</h1>
            <p className="text-xs text-slate-500">Examination Hall Security</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success-500/10
              border border-success-500/20 text-success-400 text-xs font-medium">
              <RiWifiLine size={14}/>
              <span>Live</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500/10
              border border-primary-500/20 text-primary-400 text-xs font-medium capitalize">
              <RiShieldCheckLine size={14}/>
              <span>{user?.role}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
