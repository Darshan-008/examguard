import React, { useEffect, useState, useCallback } from 'react';
import { dashboardAPI, detectionAPI, classroomAPI } from '../services/api';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { RiBuilding2Line, RiStackLine, RiDoorOpenLine, RiCpuLine, RiAlarmWarningLine, RiShieldLine } from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

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

const voiceAlert = (roomName) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`Attention. Bluetooth device detected in ${roomName}`);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
};

const StatCard = ({ icon: Icon, label, value, color, bg }) => (
  <div className="stat-card">
    <div className={`stat-icon ${bg}`}><Icon className={color} size={22} /></div>
    <div>
      <p className="text-slate-400 text-xs font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5">{value ?? '—'}</p>
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const { on, off, emit } = useSocket();
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem('voiceAlertsEnabled') !== 'false';
  });

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
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handler = (data) => {
      alertSound();
      if (voiceEnabled) {
        voiceAlert(data.log?.classroomId?.roomName || 'Classroom');
      }
      toast.error(
        `🔵 BLUETOOTH ALERT!\nRoom: ${data.log?.classroomId?.roomName || 'Unknown'}\nMAC: ${data.macAddress?.toUpperCase()}`,
        { duration: 8000, id: `alert-${data.classroomId}` }
      );
      
      setClassrooms(prev => prev.map(r => 
        r._id === data.classroomId ? { ...r, alertStatus: true, lastDetectionMac: data.macAddress } : r
      ));
      fetchData();
    };

    const clearHandler = ({ classroomId }) => {
      setClassrooms(prev => prev.map(r => r._id === classroomId ? { ...r, alertStatus: false } : r));
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

  const chartLabels = analytics?.data?.map(d => d._id) || [];
  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: 'Bluetooth Alerts',
      data: analytics?.data?.map(d => d.count) || [],
      fill: true,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,0.1)',
      tension: 0.4,
      pointBackgroundColor: '#3b82f6',
      pointRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f1f5f9', bodyColor: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', stepSize: 1 } },
    },
  };

  const heatmapData = {
    labels: analytics?.classroomHeatmap?.map(h => h.classroom?.roomName) || [],
    datasets: [{
      data: analytics?.classroomHeatmap?.map(h => h.count) || [],
      backgroundColor: ['#3b82f6','#6366f1','#8b5cf6','#a855f7','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6'],
      borderWidth: 0,
    }],
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Admin Dashboard</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Real-time Bluetooth detection overview</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Voice</span>
          <button 
            onClick={toggleVoice}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${voiceEnabled ? 'bg-primary-600' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${voiceEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          {activeAlerts.map(room => (
            <div key={room._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-danger-500/10 border border-danger-500/30 animate-pulse-slow">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-danger-500/20 flex items-center justify-center text-danger-500 flex-shrink-0">
                  <RiAlarmWarningLine size={22} className="animate-bounce" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-white font-bold text-sm sm:text-base truncate">Active: {room.roomName}</h4>
                  <p className="text-danger-400 text-xs font-mono uppercase tracking-wider truncate">
                    MAC: {room.lastDetectionMac || 'Unknown'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => handleClearAlert(room._id)}
                className="w-full sm:w-auto px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-danger-600/20"
              >
                Dismiss Alert
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard icon={RiBuilding2Line}   label="Blocks"            value={stats?.blocks}        color="text-blue-400"   bg="bg-blue-500/10" />
        <StatCard icon={RiStackLine}       label="Floors"            value={stats?.floors}        color="text-indigo-400" bg="bg-indigo-500/10" />
        <StatCard icon={RiDoorOpenLine}    label="Classrooms"        value={stats?.classrooms}    color="text-purple-400" bg="bg-purple-500/10" />
        <StatCard icon={RiCpuLine}         label="Active Devices"    value={stats?.activeDevices} color="text-green-400"  bg="bg-green-500/10" />
        <StatCard icon={RiAlarmWarningLine}label="Alerts Today"      value={stats?.todayAlerts}   color="text-red-400"    bg="bg-red-500/10" />
        <StatCard icon={RiShieldLine}      label="Jammer Active"     value={stats?.jammerActive}  color="text-yellow-400" bg="bg-yellow-500/10" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="text-white font-semibold mb-4 text-sm sm:text-base">Bluetooth Alerts — Last 7 Days</h3>
          <div className="h-48 sm:h-auto">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
        <div className="card">
          <h3 className="text-white font-semibold mb-4 text-sm sm:text-base">Alert Heatmap</h3>
          {(analytics?.classroomHeatmap?.length || 0) > 0
            ? <div className="max-w-xs mx-auto"><Doughnut data={heatmapData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, padding: 12 } } }, cutout: '65%' }} /></div>
            : <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No alert data yet</div>
          }
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
          <MdBluetooth className="text-primary-400" />Recent Detections
        </h3>
        {recentAlerts.length === 0
          ? <p className="text-slate-500 text-sm text-center py-8">No detections recorded</p>
          : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {recentAlerts.map(log => (
                  <div key={log._id} className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-white text-sm">{log.classroomId?.roomName}</span>
                      <span className="badge-red text-xs">Alert</span>
                    </div>
                    <p className="font-mono text-xs text-primary-400 mb-1">{log.macAddress}</p>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{log.classroomId?.blockId?.blockName}</span>
                      <span className="text-warning-400">{log.rssi} dBm</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead><tr>
                    <th className="th">Time</th><th className="th">Room</th>
                    <th className="th">Block</th><th className="th">MAC Address</th>
                    <th className="th">RSSI</th><th className="th">Status</th>
                  </tr></thead>
                  <tbody>
                    {recentAlerts.map(log => (
                      <tr key={log._id} className="table-row">
                        <td className="td">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="td font-medium text-white">{log.classroomId?.roomName}</td>
                        <td className="td">{log.classroomId?.blockId?.blockName}</td>
                        <td className="td font-mono text-xs">{log.macAddress}</td>
                        <td className="td"><span className="text-warning-400">{log.rssi} dBm</span></td>
                        <td className="td"><span className="badge-red">Alert</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        }
      </div>
    </div>
  );
}
