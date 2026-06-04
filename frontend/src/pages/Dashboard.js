import React, { useEffect, useState, useCallback, useRef } from 'react';
import { dashboardAPI, detectionAPI, classroomAPI } from '../services/api';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, Filler,
} from 'chart.js';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import {
  RiBuilding2Line, RiStackLine, RiDoorOpenLine, RiCpuLine,
  RiAlarmWarningLine, RiShieldLine, RiRefreshLine,
} from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, Filler,
);

/* ─── Audio alert ────────────────────────────────────────────────────── */
const alertSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.5);
  } catch (e) {}
};

/* ─── Voice alert ────────────────────────────────────────────────────── */
const voiceAlert = (roomName) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(
    `Attention. Bluetooth device detected in ${roomName}`,
  );
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
};

/* ─── Relative time helper ───────────────────────────────────────────── */
const relativeTime = (ts) => {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 5)  return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/* ─── Category emoji helper ──────────────────────────────────────────── */
const categoryEmoji = (log) => {
  if (log?.rssi && log.rssi > -50) return '🔴';
  if (log?.rssi && log.rssi > -70) return '🟡';
  return '🔵';
};

/* ─── Sparkline mini-bars ────────────────────────────────────────────── */
const Sparkline = ({ value, max, color }) => {
  const bars = 5;
  const filled = Math.max(1, Math.round((value / Math.max(max, 1)) * bars));
  return (
    <div className="flex items-end gap-0.5 h-4 mt-1">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-sm transition-all duration-500 ${i < filled ? '' : 'bg-slate-200 dark:bg-white/10'}`}
          style={{
            height: `${((i + 1) / bars) * 100}%`,
            ...(i < filled ? { backgroundColor: color } : {})
          }}
        />
      ))}
    </div>
  );
};

/* ─── StatCard ───────────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color, bg, gradientFrom, gradientTo, max = 20 }) => {
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const pct = value ? Math.min(100, (value / Math.max(max, 1)) * 100) : 0;
    const t = setTimeout(() => setBarWidth(pct), 120);
    return () => clearTimeout(t);
  }, [value, max]);

  return (
    <div
      className="relative overflow-hidden glass p-5 flex flex-col gap-3
                 transition-all duration-300 cursor-default group
                 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-300 dark:hover:border-white/20"
    >
      {/* Background gradient blob */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.08] blur-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle, ${gradientFrom}, ${gradientTo})` }}
      />

      <div className="flex items-start justify-between">
        {/* Icon square */}
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${bg}
                      ring-1 ring-slate-200 dark:ring-white/10 group-hover:scale-110 transition-transform duration-300`}
        >
          <Icon className={color} size={20} />
        </div>

        {/* Sparkline (only when value > 0) */}
        {(value ?? 0) > 0 && (
          <Sparkline value={value} max={max} color={gradientFrom} />
        )}
      </div>

      <div>
        <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
          {value ?? '—'}
        </p>
        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-widest mt-1">
          {label}
        </p>
      </div>

      {/* Animated bottom border bar */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-slate-200 dark:bg-white/5 w-full">
        <div
          className="h-full rounded-full transition-all ease-out duration-[1.4s]"
          style={{
            width: `${barWidth}%`,
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
          }}
        />
      </div>
    </div>
  );
};

/* ─── Live clock ─────────────────────────────────────────────────────── */
const LiveClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm text-primary-500 dark:text-primary-400 tabular-nums">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
};

/* ─── Doughnut centre-text plugin ────────────────────────────────────── */
const doughnutCentrePlugin = {
  id: 'centreText',
  afterDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const { ctx, data } = chart;
    const total = (data.datasets[0]?.data || []).reduce((a, b) => a + b, 0);
    if (!total) return;
    const cx = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
    const cy = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
    ctx.save();
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 8);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('alerts', cx, cy + 12);
    ctx.restore();
  },
};

/* ════════════════════════════════════════════════════════════════════════
   Dashboard
════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [stats,        setStats]        = useState(null);
  const [analytics,    setAnalytics]    = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [classrooms,   setClassrooms]   = useState([]);
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [newRowIds,    setNewRowIds]    = useState(new Set());
  const [refreshing,   setRefreshing]   = useState(false);
  const { on, off, emit } = useSocket();

  const [voiceEnabled, setVoiceEnabled] = useState(() =>
    localStorage.getItem('voiceAlertsEnabled') !== 'false',
  );

  const toggleVoice = () => {
    setVoiceEnabled(prev => {
      localStorage.setItem('voiceAlertsEnabled', !prev);
      return !prev;
    });
  };

  const fetchData = useCallback(async () => {
    try {
      const [s, a, logs, rooms] = await Promise.all([
        dashboardAPI.getStats(),
        detectionAPI.getAnalytics(7),
        detectionAPI.getLogs({ limit: 5 }),
        classroomAPI.getAll(),
      ]);
      setStats(s.data.data);
      setAnalytics(a.data);
      setRecentAlerts(logs.data.data || []);
      setClassrooms(rooms.data.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setTimeout(() => setRefreshing(false), 600);
  };

  useEffect(() => {
    fetchData();

    const handler = (data) => {
      alertSound();
      if (voiceEnabled) {
        voiceAlert(data.log?.classroomId?.roomName || 'Classroom');
      }
      toast.error(
        `🔵 BLUETOOTH ALERT!\nRoom: ${data.log?.classroomId?.roomName || 'Unknown'}\nMAC: ${data.macAddress?.toUpperCase()}`,
        { duration: 8000, id: `alert-${data.classroomId}` },
      );

      setClassrooms(prev => prev.map(r =>
        r._id === data.classroomId
          ? { ...r, alertStatus: true, lastDetectionMac: data.macAddress }
          : r,
      ));

      // Mark newly socket-injected row for 'NEW' badge
      if (data.log?._id) {
        setNewRowIds(prev => new Set([...prev, data.log._id]));
        setTimeout(() => {
          setNewRowIds(prev => { const s = new Set(prev); s.delete(data.log._id); return s; });
        }, 5000);
      }

      fetchData();
    };

    const clearHandler = ({ classroomId }) => {
      setClassrooms(prev => prev.map(r =>
        r._id === classroomId ? { ...r, alertStatus: false } : r,
      ));
      fetchData();
    };

    on('bluetoothAlert', handler);
    on('alertCleared', clearHandler);
    return () => {
      off('bluetoothAlert', handler);
      off('alertCleared', clearHandler);
    };
  }, [fetchData, on, off, voiceEnabled]);

  const handleClearAlert = (classroomId) => {
    emit('clearAlert', { classroomId });
  };

  const activeAlerts = classrooms.filter(r => r.alertStatus);

  /* ── Chart data ── */
  const chartLabels = analytics?.data?.map(d => d._id) || [];
  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: 'Bluetooth Alerts',
      data: analytics?.data?.map(d => d.count) || [],
      fill: true,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.15)',
      tension: 0.4,
      pointBackgroundColor: '#3b82f6',
      pointBorderColor: '#1e40af',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f1f5f9',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { color: '#64748b', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { color: '#64748b', stepSize: 1, font: { size: 11 } },
      },
    },
  };

  const heatmapData = {
    labels: analytics?.classroomHeatmap?.map(h => h.classroom?.roomName) || [],
    datasets: [{
      data: analytics?.classroomHeatmap?.map(h => h.count) || [],
      backgroundColor: [
        '#3b82f6','#6366f1','#8b5cf6','#a855f7',
        '#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6',
      ],
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const doughnutOptions = {
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#64748b', boxWidth: 10, padding: 14, font: { size: 11 } },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f1f5f9',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
      },
    },
    cutout: '68%',
  };

  /* ── Stat card configs ── */
  const STAT_CARDS = [
    { icon: RiBuilding2Line,    label: 'Blocks',         value: stats?.blocks,        color: 'text-blue-400',   bg: 'bg-blue-500/10',   gradientFrom: '#3b82f6', gradientTo: '#1d4ed8',   max: 10 },
    { icon: RiStackLine,        label: 'Floors',         value: stats?.floors,        color: 'text-indigo-400', bg: 'bg-indigo-500/10', gradientFrom: '#6366f1', gradientTo: '#3730a3',   max: 20 },
    { icon: RiDoorOpenLine,     label: 'Classrooms',     value: stats?.classrooms,    color: 'text-purple-400', bg: 'bg-purple-500/10', gradientFrom: '#a855f7', gradientTo: '#6b21a8',   max: 60 },
    { icon: RiCpuLine,          label: 'Active Devices', value: stats?.activeDevices, color: 'text-emerald-400',bg: 'bg-emerald-500/10',gradientFrom: '#22c55e', gradientTo: '#15803d',   max: 30 },
    { icon: RiAlarmWarningLine, label: 'Alerts Today',   value: stats?.todayAlerts,   color: 'text-red-400',    bg: 'bg-red-500/10',    gradientFrom: '#ef4444', gradientTo: '#b91c1c',   max: 50 },
    { icon: RiShieldLine,       label: 'Jammer Active',  value: stats?.jammerActive,  color: 'text-yellow-400', bg: 'bg-yellow-500/10', gradientFrom: '#f59e0b', gradientTo: '#92400e',   max: 5  },
  ];

  return (
    <div className="space-y-5 sm:space-y-7 animate-fade-in">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Admin Dashboard
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
              Real-time Bluetooth detection overview
            </p>
            <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">·</span>
            <LiveClock />
            {lastUpdated && (
              <>
                <span className="text-slate-400 dark:text-slate-600 hidden sm:inline">·</span>
                <span className="text-slate-500 text-xs hidden sm:inline">
                  Updated {relativeTime(lastUpdated)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Voice toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest">
              Voice
            </span>
            <button
              onClick={toggleVoice}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                voiceEnabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  voiceEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Alerts Banner ─────────────────────────────────────── */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          {activeAlerts.map((room, idx) => (
            <div
              key={room._id}
              className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3
                         p-4 pl-5 rounded-2xl overflow-hidden
                         bg-gradient-to-r from-danger-500/10 via-danger-500/5 to-transparent
                         border border-danger-500/30 alert-card animate-slide-up"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Left red gradient accent border */}
              <div
                className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
                style={{ background: 'linear-gradient(180deg, #ef4444, #b91c1c)' }}
              />

              <div className="flex items-center gap-3">
                {/* Pulsing warning icon */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-danger-500/20 flex items-center justify-center text-danger-400 animate-pulse-slow">
                    <RiAlarmWarningLine size={22} />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-danger-500 animate-pulse-fast ring-2 ring-white dark:ring-dark-900" />
                </div>

                <div className="min-w-0">
                  <h4 className="text-slate-900 dark:text-white font-bold text-sm sm:text-base truncate">
                    🚨 Active Alert — {room.roomName}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {room.blockId?.blockName && (
                      <span className="badge-red text-[10px]">
                        {room.blockId.blockName}
                      </span>
                    )}
                    {room.floorId?.floorName && (
                      <span className="badge-red text-[10px]">
                        {room.floorId.floorName}
                      </span>
                    )}
                    <p className="text-danger-500 dark:text-danger-400 text-xs font-mono uppercase tracking-wider truncate">
                      MAC: {room.lastDetectionMac || 'Unknown'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dismiss button with danger gradient */}
              <button
                onClick={() => handleClearAlert(room._id)}
                className="btn-danger w-full sm:w-auto text-xs px-4 py-2 flex-shrink-0
                           !shadow-danger-600/30 active:scale-95"
              >
                <RiAlarmWarningLine size={14} />
                Dismiss Alert
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Stats Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {STAT_CARDS.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* ── Charts Section ──────────────────────────────────────────── */}
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-gradient-to-b from-primary-400 to-indigo-500" />
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm sm:text-base">Analytics</h3>
          <span className="badge-blue text-[10px] ml-1">Last 7 Days</span>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-ghost text-xs !px-3 !py-1.5 !rounded-lg"
        >
          <RiRefreshLine
            size={14}
            className={refreshing ? 'animate-spin' : 'transition-transform hover:rotate-180 duration-500'}
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Line Chart */}
        <div className="lg:col-span-2 card !overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <MdBluetooth className="text-primary-500 dark:text-primary-400" size={18} />
              <h3 className="text-slate-900 dark:text-white font-semibold text-sm sm:text-base">
                Bluetooth Alerts
              </h3>
            </div>
            <span className="badge-blue text-[10px]">7-day trend</span>
          </div>
          <div className="h-52 sm:h-auto">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Doughnut Chart */}
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <h3 className="text-slate-900 dark:text-white font-semibold text-sm sm:text-base">
              Alert Heatmap
            </h3>
          </div>
          {(analytics?.classroomHeatmap?.length || 0) > 0 ? (
            <div className="max-w-xs mx-auto">
              <Doughnut
                data={heatmapData}
                options={doughnutOptions}
                plugins={[doughnutCentrePlugin]}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <div className="text-3xl opacity-30">📊</div>
              <p className="text-slate-500 text-sm">No alert data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Detections ────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-slate-900 dark:text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
            <MdBluetooth className="text-primary-500 dark:text-primary-400" size={18} />
            Recent Detections
          </h3>
          {recentAlerts.length > 0 && (
            <span className="badge-blue text-[10px]">{recentAlerts.length} entries</span>
          )}
        </div>

        {recentAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="text-4xl opacity-20">📡</div>
            <p className="text-slate-500 text-sm">No detections recorded</p>
          </div>
        ) : (
          <>
            {/* ── Mobile Cards ── */}
            <div className="sm:hidden space-y-2">
              {recentAlerts.map(log => {
                const isNew = newRowIds.has(log._id);
                return (
                  <div
                    key={log._id}
                    className={`relative bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-white/5
                                ${isNew ? 'animate-slide-up border-primary-500/40' : ''}`}
                    style={{ borderLeftWidth: '3px', borderLeftColor: '#ef4444' }}
                  >
                    {isNew && (
                      <span className="absolute top-2 right-2 badge-red text-[9px] animate-flash">
                        NEW
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span>{categoryEmoji(log)}</span>
                        <span className="font-medium text-slate-900 dark:text-white text-sm">
                          {log.classroomId?.roomName}
                        </span>
                      </div>
                      <span className="badge-red text-xs">Alert</span>
                    </div>
                    <p className="font-mono text-xs text-primary-500 dark:text-primary-400 mb-1">{log.macAddress}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{log.classroomId?.blockId?.blockName}</span>
                      <span className="text-warning-500 dark:text-warning-400">{log.rssi} dBm</span>
                      <span className="text-slate-500 dark:text-slate-400">{relativeTime(log.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop Table ── */}
            <div className="hidden sm:block overflow-x-auto -mx-1">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th w-6"></th>
                    <th className="th">Time</th>
                    <th className="th">Room</th>
                    <th className="th">Block</th>
                    <th className="th">MAC Address</th>
                    <th className="th">RSSI</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map(log => {
                    const isNew = newRowIds.has(log._id);
                    return (
                      <tr
                        key={log._id}
                        className={`table-row relative ${isNew ? 'animate-slide-up' : ''}`}
                        style={{ borderLeft: '3px solid #ef4444' }}
                      >
                        {/* Category emoji */}
                        <td className="td !pl-3 !pr-1 text-base">
                          {categoryEmoji(log)}
                        </td>

                        {/* Relative time */}
                        <td className="td">
                          <div className="flex flex-col">
                            <span className="text-slate-700 dark:text-slate-300 text-xs">
                              {relativeTime(log.timestamp)}
                            </span>
                            <span className="text-slate-500 dark:text-slate-600 text-[10px] font-mono">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>

                        <td className="td font-medium text-slate-900 dark:text-white">
                          {log.classroomId?.roomName}
                        </td>
                        <td className="td text-slate-600 dark:text-slate-400">
                          {log.classroomId?.blockId?.blockName}
                        </td>
                        <td className="td font-mono text-xs text-primary-500 dark:text-primary-400">
                          {log.macAddress}
                        </td>
                        <td className="td">
                          <span className="text-warning-500 dark:text-warning-400 font-semibold">
                            {log.rssi} dBm
                          </span>
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            <span className="badge-red">Alert</span>
                            {isNew && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px]
                                           font-bold bg-primary-500/20 text-primary-600 dark:text-primary-300
                                           border border-primary-500/40 animate-flash"
                              >
                                NEW
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
