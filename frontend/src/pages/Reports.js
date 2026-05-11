import React, { useEffect, useState } from 'react';
import { detectionAPI } from '../services/api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import toast from 'react-hot-toast';
import { RiFileChartLine } from 'react-icons/ri';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Reports() {
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async (d) => {
    setLoading(true);
    try {
      const res = await detectionAPI.getAnalytics(d);
      setAnalytics(res.data);
    } catch { toast.error('Failed to load analytics'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAnalytics(days); }, [days]);

  const barData = {
    labels: analytics?.data?.map(d => d._id) || [],
    datasets: [{
      label: 'Bluetooth Alerts',
      data: analytics?.data?.map(d => d.count) || [],
      backgroundColor: 'rgba(59,130,246,0.7)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 6,
    }],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
    },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', stepSize: 1 } },
    },
  };

  const totalAlerts = analytics?.data?.reduce((sum, d) => sum + d.count, 0) || 0;
  const peakDay = analytics?.data?.reduce((max, d) => d.count > (max?.count || 0) ? d : max, null);
  const hotRoom = analytics?.classroomHeatmap?.[0];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Reports &amp; Analytics</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Detection patterns and statistics</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                days === d ? 'bg-primary-600/20 border-primary-500/40 text-primary-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-4xl font-bold text-danger-400">{totalAlerts}</p>
          <p className="text-slate-400 text-sm mt-1">Total Alerts ({days} days)</p>
        </div>
        <div className="card text-center">
          <p className="text-4xl font-bold text-warning-400">{peakDay?._id || '—'}</p>
          <p className="text-slate-400 text-sm mt-1">Peak Day ({peakDay?.count || 0} alerts)</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-400">{hotRoom?.classroom?.roomName || '—'}</p>
          <p className="text-slate-400 text-sm mt-1">Most Active Room ({hotRoom?.count || 0} alerts)</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <RiFileChartLine className="text-primary-400" />
          Daily Alert Trend — Last {days} Days
        </h3>
        {loading
          ? <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
          : <Bar data={barData} options={barOptions} height={80} />
        }
      </div>

      {/* Hotspot table */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4">Alert Hotspots by Classroom</h3>
        {(analytics?.classroomHeatmap?.length || 0) === 0
          ? <p className="text-slate-500 text-sm text-center py-8">No data available</p>
          : (
            <div className="space-y-3">
              {analytics.classroomHeatmap.map((h, i) => {
                const pct = Math.round((h.count / (hotRoom?.count || 1)) * 100);
                return (
                  <div key={i} className="flex items-center gap-4">
                    <span className="text-slate-500 text-xs w-5 text-right">{i + 1}</span>
                    <span className="text-white font-medium w-32 text-sm truncate">{h.classroom?.roomName}</span>
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary-600 to-danger-500"
                        style={{ width: `${pct}%`, transition: 'width 1s ease-out' }} />
                    </div>
                    <span className="text-danger-400 text-sm font-semibold w-12 text-right">{h.count}</span>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}
