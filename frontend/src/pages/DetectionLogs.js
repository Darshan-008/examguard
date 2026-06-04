import React, { useEffect, useState, useCallback, useRef } from 'react';
import { detectionAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import {
  RiSearchLine, RiDownloadLine, RiAlarmWarningLine, RiFilterLine,
  RiCloseLine, RiArrowLeftSLine, RiArrowRightSLine,
  RiDeleteBinLine, RiCalendarLine, RiRefreshLine,
} from 'react-icons/ri';
import {
  MdBluetooth, MdSmartphone, MdWatch, MdComputer, MdHeadset, MdHelpOutline,
} from 'react-icons/md';
import { TbSortAscending } from 'react-icons/tb';

/* ─── Helpers ──────────────────────────────────────────────────────────── */

const calculateDistance = (rssi) => {
  if (!rssi || rssi >= 0) return '—';
  
  // Log-Distance Path Loss Model
  // txPower: The measured RSSI at exactly 1 meter away. 
  // Calibrate this value if devices consistently show too far or too close.
  const txPower = -65; 
  
  // n: Environmental factor (Path loss exponent).
  // 2.0 = Free space, 2.5-3.0 = Typical indoor (classrooms), 4.0 = Heavy obstacles
  const n = 2.5;
  
  const distance = Math.pow(10, (txPower - rssi) / (10 * n));
  
  // Prevent absurdly high distance calculations from weak bouncing signals
  if (distance > 40) return '> 40m';
  
  return distance.toFixed(1) + 'm';
};

const getRssiColor = (rssi) => {
  if (!rssi) return 'text-slate-400 dark:text-slate-500';
  if (rssi > -60) return 'text-danger-500 dark:text-danger-400';
  if (rssi > -80) return 'text-warning-500 dark:text-warning-400';
  return 'text-slate-600 dark:text-slate-400';
};

const getCategoryIcon = (category) => {
  if (!category) return <MdHelpOutline className="text-slate-400 dark:text-slate-500" size={15} />;
  if (category.includes('Phone'))    return <MdSmartphone className="text-primary-500 dark:text-primary-400" size={15} />;
  if (category.includes('Watch'))    return <MdWatch className="text-warning-500 dark:text-warning-400" size={15} />;
  if (category.includes('Computer')) return <MdComputer className="text-sky-500 dark:text-sky-400" size={15} />;
  if (category.includes('Audio'))    return <MdHeadset className="text-success-500 dark:text-success-400" size={15} />;
  return <MdHelpOutline className="text-slate-400 dark:text-slate-500" size={15} />;
};

const getCategoryEmoji = (category) => {
  if (!category) return '❓';
  if (category.includes('Phone'))    return '📱';
  if (category.includes('Watch'))    return '⌚';
  if (category.includes('Computer')) return '💻';
  if (category.includes('Audio'))    return '🎧';
  return '❓';
};

/* ─── Signal Bars ──────────────────────────────────────────────────────── */
function SignalBars({ rssi }) {
  const strength = !rssi ? 0 : rssi > -60 ? 4 : rssi > -70 ? 3 : rssi > -80 ? 2 : 1;
  const colors = ['bg-danger-400', 'bg-warning-400', 'bg-warning-400', 'bg-success-400'];
  const barColor = !rssi ? 'bg-slate-200 dark:bg-slate-700' : strength >= 4 ? 'bg-danger-500 dark:bg-danger-400' : strength >= 3 ? 'bg-warning-500 dark:bg-warning-400' : strength >= 2 ? 'bg-warning-500 dark:bg-warning-400' : 'bg-success-500 dark:bg-success-400';
  return (
    <span className="inline-flex items-end gap-[2px] h-[14px] ml-1">
      {[1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className={`inline-block w-[3px] rounded-sm transition-all ${level <= strength ? barColor : 'bg-slate-200 dark:bg-slate-700'}`}
          style={{ height: `${level * 3 + 2}px` }}
        />
      ))}
    </span>
  );
}

/* ─── Animated Radar Empty State ───────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 select-none">
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        {/* Outer glow rings */}
        <span className="absolute inset-0 rounded-full border border-primary-500/20 animate-ping" style={{ animationDuration: '1.8s' }} />
        <span className="absolute rounded-full border border-primary-500/15"
          style={{ inset: -12, animationName: 'ping', animationDuration: '2.4s', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)', animationIterationCount: 'infinite' }} />
        <span className="absolute rounded-full border border-indigo-500/10"
          style={{ inset: -24, animationName: 'ping', animationDuration: '3s', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)', animationIterationCount: 'infinite', opacity: 0.6 }} />
        {/* Center circle */}
        <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-gradient-to-br dark:from-dark-850 dark:to-dark-900 border border-primary-500/25 flex items-center justify-center shadow-glow-blue">
          <RiAlarmWarningLine size={36} className="text-primary-500 dark:text-primary-400 animate-pulse-slow" />
        </div>
        {/* Sweep line */}
        <div
          className="absolute top-1/2 left-1/2 w-[50%] h-px origin-left"
          style={{
            background: 'linear-gradient(90deg, rgba(59,130,246,0.7) 0%, transparent 100%)',
            animation: 'spin 3s linear infinite',
            transformOrigin: '0% 50%',
          }}
        />
      </div>
      <div className="text-center">
        <p className="text-slate-900 dark:text-white font-semibold text-base">No Detection Logs Found</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Scanning… Logs will appear here once devices are detected.</p>
      </div>
    </div>
  );
}

/* ─── NEW Badge ────────────────────────────────────────────────────────── */
function NewBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider
      bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-300 border border-primary-500/30 dark:border-primary-500/40 animate-pulse-fast ml-1.5">
      NEW
    </span>
  );
}

/* ─── Skeleton row ─────────────────────────────────────────────────────── */
function SkeletonRows() {
  return Array.from({ length: 8 }).map((_, i) => (
    <tr key={i} className="border-b border-slate-200 dark:border-white/[0.04]">
      {Array.from({ length: 11 }).map((__, j) => (
        <td key={j} className="px-4 py-3.5">
          <div className="h-3 rounded-full shimmer" style={{ width: `${40 + ((i + j) * 17) % 50}%` }} />
        </td>
      ))}
    </tr>
  ));
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function DetectionLogs() {
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [viewMode, setViewMode]     = useState('all'); // 'all' or 'nearest'
  const [newLogIds, setNewLogIds]   = useState(new Set());
  const { on, off }                 = useSocket();
  const newLogTimers                = useRef({});

  /* ── Fetch ────────────────────────────────────────────────────────── */
  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search)   params.macAddress = search;
      if (dateFrom) params.startDate  = dateFrom;
      if (dateTo)   params.endDate    = dateTo;
      if (viewMode === 'nearest') params.minRssi = -65; // High signal strength = near
      
      const res = await detectionAPI.getLogs(params);
      setLogs(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  }, [search, dateFrom, dateTo, viewMode]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  /* ── Socket ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (data) => {
      const log = data.log;
      const id  = log._id || String(Date.now());
      setLogs(prev => [log, ...prev.slice(0, 19)]);
      setNewLogIds(prev => new Set(prev).add(id));
      if (newLogTimers.current[id]) clearTimeout(newLogTimers.current[id]);
      newLogTimers.current[id] = setTimeout(() => {
        setNewLogIds(prev => { const s = new Set(prev); s.delete(id); return s; });
        delete newLogTimers.current[id];
      }, 4000);
    };

    const handleLogsCleared = () => {
      setLogs([]);
      setPagination(prev => ({ ...prev, total: 0, pages: 1 }));
      toast.success('Logs cleared via Voice Command');
    };

    on('bluetoothAlert', handler);
    on('logsCleared', handleLogsCleared);
    
    return () => { 
      off('bluetoothAlert', handler); 
      off('logsCleared', handleLogsCleared);
      Object.values(newLogTimers.current).forEach(clearTimeout); 
    };
  }, [on, off]);

  /* ── Export ───────────────────────────────────────────────────────── */
  const exportCSV = useCallback(() => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }
    const headers = ['Timestamp','Block','Floor','Classroom','ESP32 ID','MAC Address','Device Name','RSSI','Status'];
    const rows = logs.map(l => [
      new Date(l.timestamp).toLocaleString(),
      l.classroomId?.blockId?.blockName || '',
      l.classroomId?.floorId?.floorName || '',
      l.classroomId?.roomName || '',
      l.esp32DeviceId?.deviceId || '',
      l.macAddress,
      l.deviceName || '',
      l.rssi,
      l.alertStatus,
    ]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `detection_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  }, [logs]);

  useEffect(() => {
    const handleTriggerExport = () => {
      exportCSV();
    };
    on('triggerExport', handleTriggerExport);
    return () => off('triggerExport', handleTriggerExport);
  }, [on, off, exportCSV]);

  /* ── Clear logs ───────────────────────────────────────────────────── */
  const handleClearLogs = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') { toast.error('Only administrators can clear logs'); return; }
    if (!window.confirm('WARNING: This will permanently delete ALL detection records. Continue?')) return;
    try {
      await detectionAPI.clearLogs();
      toast.success('All logs cleared successfully');
      setLogs([]);
      setPagination(prev => ({ ...prev, total: 0, pages: 1 }));
    } catch { toast.error('Failed to clear logs'); }
  };

  /* ── Filter helpers ───────────────────────────────────────────────── */
  const activeFilterCount = [search, dateFrom, dateTo].filter(Boolean).length;
  const resetFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); };

  /* ── Numbered pagination ──────────────────────────────────────────── */
  const buildPageNumbers = () => {
    const { page, pages } = pagination;
    if (!pages || pages <= 1) return [];
    const window = 2;
    const nums = new Set();
    nums.add(1);
    nums.add(pages);
    for (let i = Math.max(2, page - window); i <= Math.min(pages - 1, page + window); i++) nums.add(i);
    const sorted = [...nums].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
      result.push(sorted[i]);
    }
    return result;
  };

  const isAdmin = JSON.parse(localStorage.getItem('user') || '{}').role === 'admin';

  /* ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Detection Logs</h2>
              {/* Total count badge */}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold
                bg-primary-500/15 text-primary-600 dark:text-primary-300 border border-primary-500/25">
                {(pagination.total || 0).toLocaleString()}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Bluetooth device detection history</p>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-500/10 border border-success-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500" />
            </span>
            <span className="text-[10px] font-bold text-success-600 dark:text-success-400 uppercase tracking-widest">Live</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-full bg-slate-100 dark:bg-dark-900 border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'all' ? 'bg-primary-500 text-white shadow-glow-blue' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Logs
            </button>
            <button
              onClick={() => setViewMode('nearest')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                viewMode === 'nearest' ? 'bg-danger-500 text-white shadow-glow-red' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Nearest Devices
            </button>
          </div>
          {isAdmin && (
            <button
              onClick={handleClearLogs}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
                bg-danger-500/10 hover:bg-danger-500/20 text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300
                border border-danger-500/20 hover:border-danger-500/35
                transition-all duration-200 active:scale-95"
            >
              <RiDeleteBinLine size={13} />
              <span className="hidden sm:inline">Clear Logs</span>
            </button>
          )}
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
              bg-primary-500/10 hover:bg-primary-500/20 text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200
              border border-primary-500/20 hover:border-primary-500/35
              transition-all duration-200 active:scale-95"
          >
            <RiDownloadLine size={13} />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={() => fetchLogs(pagination.page || 1)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold
              bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.09] text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white
              border border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.15]
              transition-all duration-200 active:scale-95"
          >
            <RiRefreshLine size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div className="glass-strong p-4 rounded-2xl shadow-xl relative overflow-hidden">
        {/* subtle top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />

        <div className="flex items-center gap-2 mb-3">
          <RiFilterLine className="text-primary-500 dark:text-primary-400" size={14} />
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Filters</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
              bg-primary-500 text-white ml-0.5">
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-end">
          {/* MAC search */}
          <div className="flex-1 min-w-0 w-full sm:min-w-52">
            <label className="label">MAC Address</label>
            <div className="relative">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={14} />
              <input
                className="input pl-8 pr-8 text-sm"
                placeholder="XX:XX:XX:XX:XX:XX"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-colors"
                >
                  <RiCloseLine size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Date From */}
          <div className="w-full sm:w-auto">
            <label className="label">
              <RiCalendarLine className="inline mr-1 -mt-0.5" size={10} />
              From Date
            </label>
            <input
              type="date"
              className="input w-full text-sm"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div className="w-full sm:w-auto">
            <label className="label">
              <RiCalendarLine className="inline mr-1 -mt-0.5" size={10} />
              To Date
            </label>
            <input
              type="date"
              className="input w-full text-sm"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 w-full sm:w-auto pt-0 sm:pt-0">
            <button
              onClick={() => fetchLogs(1)}
              className="btn-primary flex-1 sm:flex-none h-11 rounded-xl text-sm"
            >
              <RiFilterLine size={14} />Apply
            </button>
            <button
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="btn-ghost flex-1 sm:flex-none h-11 rounded-xl text-sm disabled:opacity-40"
            >
              <RiCloseLine size={14} />Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Card ──────────────────────────────────────────────── */}
      <div className="glass overflow-hidden p-0 shadow-xl rounded-2xl relative">
        {/* top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent z-10" />

        {loading ? (
          /* ── Skeleton ───────────────────────────────────────────── */
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-900/50">
                    {['Timestamp','Block','Floor','Classroom','ESP32','MAC Address','Device','Type','RSSI','Distance','Status'].map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody><SkeletonRows /></tbody>
              </table>
            </div>
            <div className="md:hidden p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass p-4 rounded-xl space-y-2">
                  <div className="h-3 w-1/2 rounded shimmer" />
                  <div className="h-2.5 w-3/4 rounded shimmer" />
                  <div className="h-2.5 w-2/3 rounded shimmer" />
                </div>
              ))}
            </div>
          </>
        ) : logs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Mobile cards ──────────────────────────────────────── */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-white/[0.05]">
              {logs.map((log, i) => {
                const logId = log._id || i;
                const isNew = newLogIds.has(logId);
                const isAlert = log.alertStatus === 'alert';
                return (
                  <div
                    key={logId}
                    className={`relative p-4 space-y-2.5 transition-all ${isNew ? 'animate-slide-up' : ''}`}
                    style={{ borderLeft: `3px solid ${isAlert ? 'rgba(248,113,113,0.6)' : 'rgba(74,222,128,0.5)'}` }}
                  >
                    {/* Status + Room + NEW */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">{log.classroomId?.roomName || '—'}</p>
                          {isNew && <NewBadge />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {log.classroomId?.blockId?.blockName} • {log.classroomId?.floorId?.floorName}
                        </p>
                      </div>
                      {isAlert
                        ? <span className="badge-red flex-shrink-0">🚨 Alert</span>
                        : <span className="badge-green flex-shrink-0">✅ Cleared</span>}
                    </div>

                    {/* MAC */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/20 font-mono text-[11px] text-primary-600 dark:text-primary-300">
                        <MdBluetooth size={11} />
                        {log.macAddress?.toUpperCase()}
                      </span>
                      {log.isRandomized && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning-500/10 text-warning-600 dark:text-warning-400 border border-warning-500/20 font-bold uppercase">Private</span>
                      )}
                    </div>

                    {/* Details row */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        {getCategoryIcon(log.category)}
                        {log.deviceName || 'Unknown'}
                      </span>
                      <span className={`flex items-center font-mono ${getRssiColor(log.rssi)}`}>
                        {log.rssi} dBm
                        <SignalBars rssi={log.rssi} />
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300 text-[11px] font-semibold">
                        ≈ {calculateDistance(log.rssi)}
                      </span>
                      <span className="ml-auto text-[10px] text-slate-500 dark:text-slate-600">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop table ─────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-200 dark:border-white/[0.07] bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md">
                    {[
                      'Timestamp', 'Block', 'Floor', 'Classroom', 'ESP32',
                      'MAC Address', 'Device', 'Type', 'RSSI', 'Distance', 'Status',
                    ].map(h => (
                      <th key={h} className="th group cursor-default select-none whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          {h}
                          <TbSortAscending size={10} className="text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors" />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const logId  = log._id || i;
                    const isNew  = newLogIds.has(logId);
                    const isAlert = log.alertStatus === 'alert';
                    return (
                      <tr
                        key={logId}
                        className={`border-b border-slate-200 dark:border-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors duration-150 group
                          ${isNew ? 'animate-slide-up' : ''}
                          ${i % 2 === 1 ? 'bg-slate-50/50 dark:bg-white/[0.015]' : ''}`}
                        style={{ borderLeft: `3px solid ${isAlert ? 'rgba(248,113,113,0.5)' : 'rgba(74,222,128,0.4)'}` }}
                      >
                        {/* Timestamp */}
                        <td className="td text-[11px] text-slate-500 whitespace-nowrap font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>

                        {/* Block */}
                        <td className="td text-xs text-slate-700 dark:text-slate-300">{log.classroomId?.blockId?.blockName || '—'}</td>

                        {/* Floor */}
                        <td className="td text-xs text-slate-700 dark:text-slate-300">{log.classroomId?.floorId?.floorName || '—'}</td>

                        {/* Classroom */}
                        <td className="td font-semibold text-slate-900 dark:text-white text-sm">{log.classroomId?.roomName || '—'}</td>

                        {/* ESP32 */}
                        <td className="td font-mono text-[11px] text-slate-500">{log.esp32DeviceId?.deviceId || '—'}</td>

                        {/* MAC Address */}
                        <td className="td">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary-500/10 border border-primary-500/20 font-mono text-[11px] text-primary-600 dark:text-primary-300 w-fit">
                              <MdBluetooth size={11} className="flex-shrink-0" />
                              {log.macAddress?.toUpperCase()}
                            </span>
                            {log.isRandomized && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning-500/10 text-warning-600 dark:text-warning-400 border border-warning-500/20 w-fit font-bold uppercase tracking-tight">
                                Private MAC
                              </span>
                            )}
                            {isNew && <NewBadge />}
                          </div>
                        </td>

                        {/* Device name */}
                        <td className="td text-xs text-slate-600 dark:text-slate-400">{log.deviceName || 'Unknown'}</td>

                        {/* Category / Type */}
                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{getCategoryEmoji(log.category)}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">{log.category || 'Unknown'}</span>
                          </div>
                        </td>

                        {/* RSSI + signal bars */}
                        <td className="td">
                          <span className={`flex items-center font-mono text-xs ${getRssiColor(log.rssi)}`}>
                            {log.rssi} dBm
                            <SignalBars rssi={log.rssi} />
                          </span>
                        </td>

                        {/* Distance */}
                        <td className="td">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300 text-[11px] font-semibold">
                            ≈ {calculateDistance(log.rssi)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="td">
                          {isAlert
                            ? <span className="badge-red">🚨 Alert</span>
                            : <span className="badge-green">✅ Cleared</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Pagination ────────────────────────────────────────────── */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Page <span className="text-slate-700 dark:text-slate-300 font-semibold">{pagination.page}</span> of{' '}
              <span className="text-slate-700 dark:text-slate-300 font-semibold">{pagination.pages}</span>
              {' '}·{' '}
              <span className="text-slate-700 dark:text-slate-300 font-semibold">{(pagination.total || 0).toLocaleString()}</span> records
            </p>

            <div className="flex items-center gap-1 mx-auto sm:mx-0">
              {/* Prev */}
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-sm
                  bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.09] border border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.15]
                  text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all duration-150 active:scale-95"
              >
                <RiArrowLeftSLine size={16} />
              </button>

              {/* Numbered pages */}
              {buildPageNumbers().map((p, idx) =>
                p === '…' ? (
                  <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-600 text-xs select-none">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => fetchLogs(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95
                      ${p === pagination.page
                        ? 'bg-primary-500/20 border border-primary-500/40 text-primary-600 dark:text-primary-300 shadow-glow-blue'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.09] border border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.15] text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                  >
                    {p}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-sm
                  bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.09] border border-slate-200 hover:border-slate-300 dark:border-white/[0.08] dark:hover:border-white/[0.15]
                  text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed
                  transition-all duration-150 active:scale-95"
              >
                <RiArrowRightSLine size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
