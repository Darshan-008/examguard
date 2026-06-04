import React, { useEffect, useState } from 'react';
import { detectionAPI } from '../services/api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { RiFileChartLine, RiShieldFlashLine } from 'react-icons/ri';
import {
  RiAlertLine,
  RiCalendarEventLine,
  RiBuilding2Line,
  RiBarChartBoxLine,
} from 'react-icons/ri';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/* ─── Shimmer skeleton ───────────────────────────────────────────────── */
function Shimmer({ className = '', style = {} }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-200 dark:bg-white/5 ${className}`}
      style={{ animation: 'shimmer 1.6s infinite', ...style }}
    >
      <div
        className="dark:hidden"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 50%, transparent 100%)',
          animation: 'shimmerSlide 1.6s infinite',
        }}
      />
      <div
        className="hidden dark:block"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
          animation: 'shimmerSlide 1.6s infinite',
        }}
      />
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, iconBg, blobColor, gradientFrom, gradientTo, value, label, sub }) {
  return (
    <div
      className="card relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
    >
      {/* Animated background blob */}
      <div
        style={{
          position: 'absolute', width: 120, height: 120,
          borderRadius: '50%',
          background: blobColor,
          filter: 'blur(48px)',
          top: -30, right: -30,
          opacity: 0.35,
          animation: 'blobPulse 4s ease-in-out infinite',
        }}
      />

      {/* Icon square */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-xl w-12 h-12"
        style={{ background: iconBg }}
      >
        <Icon size={22} color="#fff" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p
          className="text-3xl font-extrabold leading-none tracking-tight truncate"
          style={{
            background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          {value}
        </p>
        <p className="text-slate-700 dark:text-slate-300 text-sm font-medium mt-1 truncate">{label}</p>
        {sub && <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Rank badge ─────────────────────────────────────────────────────── */
function RankBadge({ rank }) {
  const styles = {
    1: { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', shadow: '0 0 12px rgba(245,158,11,0.5)' },
    2: { bg: 'linear-gradient(135deg,#94a3b8,#64748b)', color: '#fff', shadow: '0 0 10px rgba(148,163,184,0.3)' },
    3: { bg: 'linear-gradient(135deg,#cd7c4c,#92400e)', color: '#fff', shadow: '0 0 10px rgba(205,124,76,0.3)' },
  };
  const s = styles[rank];
  return (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${!s ? 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400' : ''}`}
      style={s ? { background: s.bg, color: s.color, boxShadow: s.shadow } : {}}
    >
      {rank === 1 ? '🏆' : rank}
    </div>
  );
}

/* ─── Animated progress bar ──────────────────────────────────────────── */
function AnimatedBar({ pct, delay = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 120);
    return () => clearTimeout(t);
  }, [pct, delay]);

  const color =
    pct === 100
      ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
      : pct >= 60
      ? 'linear-gradient(90deg,#6366f1,#3b82f6)'
      : 'linear-gradient(90deg,#3b82f6,#06b6d4)';

  return (
    <div className="flex-1 h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: color,
          borderRadius: 9999,
          transition: 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      />
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20"
      >
        <RiBarChartBoxLine size={40} className="text-indigo-500 dark:text-indigo-400 opacity-70" />
      </div>
      <div className="text-center">
        <p className="text-slate-700 dark:text-slate-300 font-semibold text-base">No data yet</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-xs">
          Bluetooth alert data will appear here once detections are recorded in the selected period.
        </p>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────── */
export default function Reports() {
  const [analytics, setAnalytics] = useState(null);
  const [jammerStats, setJammerStats] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async (d) => {
    setLoading(true);
    try {
      const [resAnalytic, resJammer] = await Promise.all([
        detectionAPI.getAnalytics(d),
        detectionAPI.getJammerStats()
      ]);
      setAnalytics(resAnalytic.data);
      setJammerStats(resJammer.data);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAnalytics(days); }, [days]);

  const barData = {
    labels: analytics?.data?.map(d => d._id) || [],
    datasets: [{
      label: 'Bluetooth Alerts',
      data: analytics?.data?.map(d => d.count) || [],
      backgroundColor: analytics?.data?.map((_, i, arr) => {
        const t = i / Math.max(arr.length - 1, 1);
        const r = Math.round(59 + (99 - 59) * t);
        const g = Math.round(130 + (102 - 130) * t);
        const b = Math.round(246 + (241 - 246) * t);
        return `rgba(${r},${g},${b},0.75)`;
      }) || [],
      borderColor: analytics?.data?.map((_, i, arr) => {
        const t = i / Math.max(arr.length - 1, 1);
        const r = Math.round(59 + (99 - 59) * t);
        const g = Math.round(130 + (102 - 130) * t);
        const b = Math.round(246 + (241 - 246) * t);
        return `rgb(${r},${g},${b})`;
      }) || [],
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#0f172a', titleColor: '#f1f5f9', bodyColor: '#cbd5e1', borderColor: '#334155', borderWidth: 1 },
    },
    scales: {
      x: { grid: { color: 'rgba(148, 163, 184, 0.15)' }, ticks: { color: '#94a3b8' } },
      y: { grid: { color: 'rgba(148, 163, 184, 0.15)' }, ticks: { color: '#94a3b8', stepSize: 1 } },
    },
  };

  const totalAlerts = analytics?.data?.reduce((sum, d) => sum + d.count, 0) || 0;
  const peakDay = analytics?.data?.reduce((max, d) => d.count > (max?.count || 0) ? d : max, null);
  const hotRoom = analytics?.classroomHeatmap?.[0];
  const avgPerDay = days > 0 ? (totalAlerts / days).toFixed(1) : '—';

  return (
    <>
      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes blobPulse {
          0%, 100% { transform: scale(1) translateY(0px); opacity: 0.35; }
          50% { transform: scale(1.15) translateY(-6px); opacity: 0.5; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reports-fade-up { animation: fadeUp 0.45s ease both; }
      `}</style>

      <div className="space-y-6 animate-fade-in">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-start sm:items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Reports &amp; Analytics
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">
              Bluetooth detection patterns and insights
            </p>
          </div>

          {/* Segmented control pills */}
          <div
            className="relative flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 dark:bg-white/5 dark:border-white/10"
          >
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  position: 'relative',
                  padding: '6px 18px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: days === d
                    ? 'linear-gradient(135deg,rgba(99,102,241,0.55),rgba(59,130,246,0.45))'
                    : 'transparent',
                  color: days === d ? '#4338ca' : '#64748b',
                  boxShadow: days === d ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
                }}
                className={`!text-slate-600 dark:!text-slate-400 hover:text-slate-900 dark:hover:text-white ${days === d ? '!text-indigo-700 dark:!text-indigo-200' : ''}`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* ── Stat cards ────────────────────────────────────────────── */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          style={{ animation: 'fadeUp 0.4s ease both' }}
        >
          <StatCard
            icon={RiAlertLine}
            iconBg="linear-gradient(135deg,#ef4444,#b91c1c)"
            blobColor="#ef4444"
            gradientFrom="#f87171"
            gradientTo="#dc2626"
            value={loading ? '…' : totalAlerts}
            label="Total Alerts"
            sub={`Last ${days} days`}
          />
          <StatCard
            icon={RiCalendarEventLine}
            iconBg="linear-gradient(135deg,#f59e0b,#b45309)"
            blobColor="#f59e0b"
            gradientFrom="#fbbf24"
            gradientTo="#d97706"
            value={loading ? '…' : (peakDay?._id || '—')}
            label="Peak Day"
            sub={peakDay ? `${peakDay.count} alerts` : 'No data'}
          />
          <StatCard
            icon={RiBuilding2Line}
            iconBg="linear-gradient(135deg,#6366f1,#4338ca)"
            blobColor="#6366f1"
            gradientFrom="#818cf8"
            gradientTo="#4f46e5"
            value={loading ? '…' : (hotRoom?.classroom?.roomName || '—')}
            label="Most Active Room"
            sub={hotRoom ? `${hotRoom.count} alerts` : 'No data'}
          />
          <StatCard
            icon={RiBarChartBoxLine}
            iconBg="linear-gradient(135deg,#06b6d4,#0e7490)"
            blobColor="#06b6d4"
            gradientFrom="#22d3ee"
            gradientTo="#0891b2"
            value={loading ? '…' : avgPerDay}
            label="Avg per Day"
            sub={`Over ${days}-day window`}
          />
        </div>

        {/* ── Bar chart ─────────────────────────────────────────────── */}
        <div
          className="card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
          style={{
            borderTop: '2px solid transparent',
            backgroundImage: 'var(--chart-bg, linear-gradient(rgba(15,23,42,0.6),rgba(15,23,42,0.6)))',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            animation: 'fadeUp 0.5s 0.1s ease both',
          }}
        >
          {/* Inject dynamic gradient based on dark mode class on html */}
          <style>{`
            :root { --chart-bg: linear-gradient(rgba(255,255,255,1),rgba(255,255,255,1)), linear-gradient(90deg,#6366f1,#3b82f6); }
            html.dark { --chart-bg: linear-gradient(rgba(15,23,42,0.6),rgba(15,23,42,0.6)), linear-gradient(90deg,#6366f1,#3b82f6); }
          `}</style>
          
          <div className="p-5">
            {/* Chart header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/20"
                >
                  <RiFileChartLine size={18} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-semibold text-sm">Daily Alert Trend</p>
                  <p className="text-slate-500 text-xs">Last {days} days</p>
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)' }}
                />
                <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">Bluetooth Alerts per Day</span>
              </div>
            </div>

            {/* Chart body */}
            {loading ? (
              <div className="space-y-3 py-2">
                {[80, 60, 90, 55, 70, 65, 85].map((h, i) => (
                  <Shimmer key={i} className="rounded-md" style={{ height: `${h * 0.6}px` }} />
                ))}
                <div className="h-64 flex flex-col gap-3 justify-end pt-4">
                  {[...Array(5)].map((_, i) => (
                    <Shimmer key={i} className="w-full" style={{ height: 8 }} />
                  ))}
                </div>
              </div>
            ) : analytics?.data?.length === 0 ? (
              <EmptyState />
            ) : (
              <Bar data={barData} options={barOptions} height={80} />
            )}
          </div>
        </div>

        {/* ── Jammer Effectiveness Card ───────────────────────────────── */}
        <div
          className="card rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col md:flex-row items-center gap-6 p-6"
          style={{
            animation: 'fadeUp 0.5s 0.15s ease both',
          }}
        >
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}
              >
                <RiShieldFlashLine size={18} style={{ color: '#fff' }} />
              </div>
              <div>
                <p className="text-slate-900 dark:text-white font-semibold text-base tracking-tight">Jammer Effectiveness</p>
                <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                  {jammerStats?.isActive ? 'Live metrics (Jammer Active)' : 'Historical average'}
                </p>
              </div>
            </div>
            <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed max-w-md">
              Measures the percentage drop in Bluetooth signals after the protocol jammer (BLE Advertisement Flood) is activated.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Signals Before</p>
                <p className="text-slate-900 dark:text-white text-xl font-bold mt-1">{jammerStats?.beforeCount ?? '—'}</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/10">
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">Signals After</p>
                <p className="text-emerald-600 dark:text-emerald-400 text-xl font-bold mt-1">{jammerStats?.afterCount ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="w-40 h-40 relative flex-shrink-0 flex items-center justify-center">
            {loading ? (
               <Shimmer className="w-full h-full rounded-full" />
            ) : (
               <>
                 <Doughnut
                   data={{
                     labels: ['Blocked', 'Remaining'],
                     datasets: [{
                       data: [jammerStats?.effectiveness || 0, 100 - (jammerStats?.effectiveness || 0)],
                       backgroundColor: ['#ef4444', 'rgba(148, 163, 184, 0.2)'],
                       borderWidth: 0,
                       cutout: '80%',
                     }]
                   }}
                   options={{
                     plugins: { tooltip: { enabled: false }, legend: { display: false } },
                     animation: { animateRotate: true, duration: 1500 },
                     responsive: true, maintainAspectRatio: true,
                   }}
                 />
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-2xl font-black text-slate-900 dark:text-white">{jammerStats?.effectiveness || 0}%</span>
                   <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">BLOCKED</span>
                 </div>
               </>
            )}
          </div>
        </div>

        {/* ── Hotspot leaderboard ───────────────────────────────────── */}
        <div
          className="card rounded-2xl border border-slate-200 dark:border-white/10 p-5"
          style={{
            animation: 'fadeUp 0.5s 0.2s ease both',
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-500/15"
            >
              <RiBuilding2Line size={18} className="text-red-500 dark:text-red-400" />
            </div>
            <div>
              <p className="text-slate-900 dark:text-white font-semibold text-sm">Alert Hotspots</p>
              <p className="text-slate-500 text-xs">Ranked by classroom activity</p>
            </div>
          </div>

          {(analytics?.classroomHeatmap?.length || 0) === 0 ? (
            loading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Shimmer className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Shimmer className="h-3 w-32 rounded" />
                      <Shimmer className="h-2 w-full rounded-full" />
                    </div>
                    <Shimmer className="w-12 h-6 rounded-full flex-shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState />
            )
          ) : (
            <div className="space-y-4">
              {analytics.classroomHeatmap.map((h, i) => {
                const rank = i + 1;
                const pct = Math.round((h.count / (hotRoom?.count || 1)) * 100);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 group"
                    style={{ animation: `fadeUp 0.35s ${i * 0.06}s ease both` }}
                  >
                    {/* Rank badge */}
                    <RankBadge rank={rank} />

                    {/* Room info */}
                    <div className="w-28 sm:w-36 flex-shrink-0">
                      <p className="text-slate-900 dark:text-white text-sm font-semibold truncate leading-tight">
                        {h.classroom?.roomName || 'Unknown'}
                      </p>
                      {h.classroom?.block && (
                        <p className="text-slate-500 text-xs truncate mt-0.5">
                          Block {h.classroom.block}
                        </p>
                      )}
                    </div>

                    {/* Animated progress bar */}
                    <AnimatedBar pct={pct} delay={i * 60} />

                    {/* Count pill */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                      style={{
                        minWidth: 36,
                      }}
                    >
                      {h.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}

