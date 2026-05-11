import React, { useEffect, useState, useCallback } from 'react';
import { detectionAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { RiSearchLine, RiDownloadLine, RiAlarmWarningLine, RiFilterLine } from 'react-icons/ri';
import { MdBluetooth, MdSmartphone, MdWatch, MdComputer, MdHeadset, MdHelpOutline } from 'react-icons/md';

export default function DetectionLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { on, off } = useSocket();

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.macAddress = search;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const res = await detectionAPI.getLogs(params);
      setLogs(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  }, [search, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  useEffect(() => {
    const handler = (data) => {
      setLogs(prev => [data.log, ...prev.slice(0, 19)]);
    };
    on('bluetoothAlert', handler);
    return () => off('bluetoothAlert', handler);
  }, [on, off]);

  const exportCSV = () => {
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
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `detection_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('CSV exported!');
  };

  const calculateDistance = (rssi) => {
    if (!rssi) return '—';
    const txPower = -59; // RSSI at 1 meter
    const n = 2.5; // Path loss exponent (indoor)
    const distance = Math.pow(10, (txPower - rssi) / (10 * n));
    return distance.toFixed(1) + 'm';
  };

  const handleClearLogs = async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role !== 'admin') {
      toast.error('Only administrators can clear logs');
      return;
    }

    if (!window.confirm('WARNING: This will permanently delete ALL detection records. Continue?')) return;
    
    try {
      await detectionAPI.clearLogs();
      toast.success('All logs cleared successfully');
      setLogs([]);
      setPagination(prev => ({ ...prev, total: 0, pages: 1 }));
    } catch {
      toast.error('Failed to clear logs');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Detection Logs</h2>
          <p className="text-slate-400 text-sm mt-1">{pagination.total || 0} total records</p>
        </div>
        <div className="flex gap-2">
          {JSON.parse(localStorage.getItem('user') || '{}').role === 'admin' && (
            <button onClick={handleClearLogs} className="btn-ghost text-sm text-danger-400 hover:bg-danger-500/10">
              Clear All Logs
            </button>
          )}
          <button onClick={exportCSV} className="btn-ghost text-sm"><RiDownloadLine />Export CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass p-4 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-48">
          <label className="label">Search MAC Address</label>
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="XX:XX:XX:XX:XX:XX"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button onClick={() => fetchLogs(1)} className="btn-primary h-11">
          <RiFilterLine />Filter
        </button>
        <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }} className="btn-ghost h-11">
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center">
            <RiAlarmWarningLine size={48} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No detection logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="th">Timestamp</th><th className="th">Block</th><th className="th">Floor</th>
                  <th className="th">Classroom</th><th className="th">ESP32</th>
                  <th className="th">MAC Address</th><th className="th">Device</th><th className="th">Type</th>
                  <th className="th">RSSI</th><th className="th">Distance</th><th className="th">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log._id || i} className="table-row">
                    <td className="td text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="td">{log.classroomId?.blockId?.blockName || '—'}</td>
                    <td className="td">{log.classroomId?.floorId?.floorName || '—'}</td>
                    <td className="td font-medium text-white">{log.classroomId?.roomName || '—'}</td>
                    <td className="td font-mono text-xs text-slate-400">{log.esp32DeviceId?.deviceId || '—'}</td>
                    <td className="td">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <MdBluetooth className="text-primary-400 flex-shrink-0" size={12}/>
                          <span className="font-mono text-xs">{log.macAddress?.toUpperCase()}</span>
                        </div>
                        {log.isRandomized && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning-500/10 text-warning-400 border border-warning-500/20 w-fit font-bold uppercase tracking-tighter">
                            Private MAC
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="td text-xs text-slate-400">{log.deviceName || 'Unknown'}</td>
                    <td className="td">
                       <div className="flex items-center gap-2">
                         {log.category?.includes('Phone') ? <MdSmartphone className="text-primary-400" />
                          : log.category?.includes('Watch') ? <MdWatch className="text-warning-400" />
                          : log.category?.includes('Computer') ? <MdComputer className="text-info-400" />
                          : log.category?.includes('Audio') ? <MdHeadset className="text-success-400" />
                          : <MdHelpOutline className="text-slate-500" />}
                         <span className="text-xs text-slate-300">{log.category || 'Unknown'}</span>
                       </div>
                    </td>
                    <td className="td">
                      <span className={`font-mono text-xs ${log.rssi > -60 ? 'text-danger-400' : log.rssi > -80 ? 'text-warning-400' : 'text-slate-400'}`}>
                        {log.rssi} dBm
                      </span>
                    </td>
                    <td className="td text-xs font-semibold text-primary-300">
                      {calculateDistance(log.rssi)}
                    </td>
                    <td className="td">
                      {log.alertStatus === 'alert'
                        ? <span className="badge-red">Alert</span>
                        : <span className="badge-green">Cleared</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/8">
            <p className="text-xs text-slate-500">
              Page {pagination.page} of {pagination.pages} • {pagination.total} records
            </p>
            <div className="flex gap-2">
              <button onClick={() => fetchLogs(pagination.page - 1)} disabled={pagination.page <= 1}
                className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <button onClick={() => fetchLogs(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                className="btn-ghost text-sm py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
