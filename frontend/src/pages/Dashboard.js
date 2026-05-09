import React, { useEffect, useState, useCallback } from 'react';
import { dashboardAPI, detectionAPI } from '../services/api';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { RiBuilding2Line, RiStackLine, RiDoorOpenLine, RiCpuLine, RiAlarmWarningLine, RiShieldLine } from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

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
  const { on, off } = useSocket();

  const fetchData = useCallback(async () => {
    try {
      const [s, a, logs] = await Promise.all([
        dashboardAPI.getStats(),
        detectionAPI.getAnalytics(7),
        detectionAPI.getLogs({ limit: 5 }),
      ]);
      setStats(s.data.data);
      setAnalytics(a.data);
      setRecentAlerts(logs.data.data || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const handler = (data) => {
      toast.error(`🔵 Bluetooth Alert! Room: ${data.log?.classroomId?.roomName || 'Unknown'} | MAC: ${data.macAddress}`, { duration: 6000 });
      fetchData();
    };
    on('bluetoothAlert', handler);
    return () => off('bluetoothAlert', handler);
  }, [fetchData, on, off]);

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
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
        <p className="text-slate-400 text-sm mt-1">Real-time Bluetooth detection overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={RiBuilding2Line}   label="Total Blocks"      value={stats?.blocks}        color="text-blue-400"   bg="bg-blue-500/10" />
        <StatCard icon={RiStackLine}       label="Total Floors"      value={stats?.floors}        color="text-indigo-400" bg="bg-indigo-500/10" />
        <StatCard icon={RiDoorOpenLine}    label="Classrooms"        value={stats?.classrooms}    color="text-purple-400" bg="bg-purple-500/10" />
        <StatCard icon={RiCpuLine}         label="Active Devices"    value={stats?.activeDevices} color="text-green-400"  bg="bg-green-500/10" />
        <StatCard icon={RiAlarmWarningLine}label="Alerts Today"      value={stats?.todayAlerts}   color="text-red-400"    bg="bg-red-500/10" />
        <StatCard icon={RiShieldLine}      label="Jammer Active"     value={stats?.jammerActive}  color="text-yellow-400" bg="bg-yellow-500/10" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <h3 className="text-white font-semibold mb-4">Bluetooth Alerts — Last 7 Days</h3>
          <Line data={chartData} options={chartOptions} />
        </div>
        <div className="card">
          <h3 className="text-white font-semibold mb-4">Alert Heatmap</h3>
          {(analytics?.classroomHeatmap?.length || 0) > 0
            ? <Doughnut data={heatmapData} options={{ plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, padding: 12 } } }, cutout: '65%' }} />
            : <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No alert data yet</div>
          }
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <MdBluetooth className="text-primary-400" />Recent Detections
        </h3>
        {recentAlerts.length === 0
          ? <p className="text-slate-500 text-sm text-center py-8">No detections recorded</p>
          : (
            <div className="overflow-x-auto">
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
          )
        }
      </div>
    </div>
  );
}
