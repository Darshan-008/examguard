import React, { useEffect, useState, useRef, useCallback } from 'react';
import { classroomAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { 
  RiCpuLine, RiWifiOffLine, RiAlarmWarningLine, 
  RiShieldCheckLine, RiRefreshLine, RiHistoryLine, RiCloseLine 
} from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';
import { detectionAPI } from '../services/api';

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

const ClassroomCard = ({ room, onClearAlert, onViewLogs }) => {
  const device = room.esp32DeviceId;
  const isInactive = device?.monitoringStatus === 'inactive';
  const isOffline  = !device || device.status === 'offline';
  const isAlert    = room.alertStatus && !isOffline && !isInactive;
  const isSafe     = !isAlert && !isOffline && !isInactive;

  const borderColor = isAlert ? 'border-danger-500/60' : isInactive ? 'border-slate-700/30' : isOffline ? 'border-slate-600/40' : 'border-success-500/30';
  const bgColor     = isAlert ? 'bg-danger-500/8' : isInactive ? 'bg-slate-900/50' : isOffline ? 'bg-slate-800/30' : 'bg-success-500/5';

  return (
    <div className={`glass ${bgColor} ${borderColor} p-5 transition-all duration-500 flex flex-col h-full ${isAlert ? 'alert-card' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-white text-base">{room.roomName}</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {room.blockId?.blockName} • {room.floorId?.floorName}
          </p>
        </div>
        {isAlert && (
          <div className="w-3 h-3 rounded-full bg-danger-500 animate-pulse-fast shadow-lg shadow-danger-500/50" />
        )}
        {isSafe && (
          <div className="w-3 h-3 rounded-full bg-success-500 shadow-lg shadow-success-500/30" />
        )}
        {isOffline && (
          <div className="w-3 h-3 rounded-full bg-slate-500" />
        )}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {isOffline ? (
          <span className="badge-gray"><RiWifiOffLine size={10}/>Offline</span>
        ) : (
          <span className="badge-green"><RiCpuLine size={10}/>Online</span>
        )}
        {isInactive ? (
          <span className="badge-gray">Inactive</span>
        ) : isAlert ? (
          <span className="badge-red"><MdBluetooth size={10}/>BT Detected</span>
        ) : (
          <span className="badge-green"><RiShieldCheckLine size={10}/>Safe</span>
        )}
        {device?.jammerStatus === 'active' ? (
          <span className="badge-yellow">🛡 Jammer ON</span>
        ) : (
          <span className="badge-gray">Jammer OFF</span>
        )}
      </div>

      {/* Info */}
      <div className="space-y-1.5 text-xs text-slate-400 flex-1">
        <div className="flex justify-between">
          <span>ESP32 ID</span>
          <span className="text-slate-300 font-mono">{device?.deviceId || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span>Last Detection</span>
          <span className="text-slate-300">
            {room.lastDetectionTime ? new Date(room.lastDetectionTime).toLocaleTimeString() : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Total Detections</span>
          <span className={`font-semibold ${room.totalDetections > 0 ? 'text-danger-400' : 'text-slate-300'}`}>
            {room.totalDetections}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t border-white/5 space-y-2">
        <button onClick={() => onViewLogs(room)}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs border border-white/10 transition-all">
          <RiHistoryLine size={14} /> View Detection Logs
        </button>

        {isAlert && (
          <div className="space-y-2 animate-flash">
            <div className="flex items-center gap-2 text-danger-400 text-[10px] font-bold uppercase tracking-wider">
              <RiAlarmWarningLine /><span>Device Detected!</span>
            </div>
            <button onClick={() => onClearAlert(room._id)}
              className="w-full py-2 rounded-lg bg-danger-600 hover:bg-danger-500 text-white text-xs font-bold transition-all shadow-lg shadow-danger-600/20">
              Clear Alert
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const calculateDistance = (rssi) => {
  if (!rssi) return '—';
  const txPower = -59; // RSSI at 1 meter
  const n = 2.5; // Path loss exponent (indoor)
  const distance = Math.pow(10, (txPower - rssi) / (10 * n));
  return distance.toFixed(1) + 'm';
};

export default function MonitoringDashboard() {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  
  // Room History Modal State
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomLogs, setRoomLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const { on, off, emit } = useSocket();
  const audioEnabled = useRef(true);

  const fetchClassrooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await classroomAPI.getAll();
      setClassrooms(res.data.data || []);
    } catch { toast.error('Failed to load classrooms'); }
    finally { setLoading(false); }
  }, []);

  const handleViewLogs = async (room) => {
    setSelectedRoom(room);
    setLogsLoading(true);
    setRoomLogs([]);
    try {
      const res = await detectionAPI.getLogs({ classroomId: room._id, limit: 50 });
      setRoomLogs(res.data.data || []);
    } catch (err) {
      toast.error('Failed to fetch room history');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();

    const alertHandler = (data) => {
      if (audioEnabled.current) alertSound();
      toast.error(
        `🔵 BLUETOOTH ALERT!\nRoom: ${data.log?.classroomId?.roomName || 'Unknown'}\nMAC: ${data.macAddress?.toUpperCase()}`,
        { duration: 8000, id: `alert-${data.classroomId}` }
      );
      setClassrooms(prev => prev.map(r =>
        r._id === data.classroomId
          ? { ...r, alertStatus: true, lastDetectionTime: data.timestamp, totalDetections: (r.totalDetections || 0) + 1 }
          : r
      ));
      
      // If we are looking at logs for this room, add it to the list
      setSelectedRoom(prev => {
        if (prev?._id === data.classroomId) {
          setRoomLogs(logs => [data.log, ...logs]);
        }
        return prev;
      });
    };

    const clearHandler = ({ classroomId }) => {
      setClassrooms(prev => prev.map(r => r._id === classroomId ? { ...r, alertStatus: false } : r));
    };

    const deviceHandler = ({ deviceId, status }) => {
      setClassrooms(prev => prev.map(r =>
        r.esp32DeviceId?._id === deviceId
          ? { ...r, esp32DeviceId: { ...r.esp32DeviceId, status } }
          : r
      ));
    };

    const deviceUpdateHandler = ({ deviceId, monitoringStatus, jammerStatus }) => {
      setClassrooms(prev => prev.map(r =>
        r.esp32DeviceId?._id === deviceId
          ? { ...r, esp32DeviceId: { ...r.esp32DeviceId, monitoringStatus, jammerStatus: jammerStatus || r.esp32DeviceId.jammerStatus } }
          : r
      ));
    };

    on('bluetoothAlert', alertHandler);
    on('alertCleared', clearHandler);
    on('deviceStatus', deviceHandler);
    on('deviceUpdate', deviceUpdateHandler);
    return () => {
      off('bluetoothAlert', alertHandler);
      off('alertCleared', clearHandler);
      off('deviceStatus', deviceHandler);
      off('deviceUpdate', deviceUpdateHandler);
    };
  }, [fetchClassrooms, on, off]);

  const handleClearAlert = (classroomId) => {
    emit('clearAlert', { classroomId });
  };

  const filtered = classrooms.filter(r => {
    if (filter === 'alert')   return r.alertStatus;
    if (filter === 'offline') return !r.esp32DeviceId || r.esp32DeviceId.status === 'offline';
    if (filter === 'safe')    return !r.alertStatus && r.esp32DeviceId?.status === 'online';
    return true;
  });

  const alertCount   = classrooms.filter(r => r.alertStatus).length;
  const offlineCount = classrooms.filter(r => !r.esp32DeviceId || r.esp32DeviceId.status === 'offline').length;
  const safeCount    = classrooms.filter(r => !r.alertStatus && r.esp32DeviceId?.status === 'online').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Live Monitoring Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Real-time classroom Bluetooth surveillance</p>
        </div>
        <button onClick={fetchClassrooms} disabled={loading}
          className="btn-ghost text-sm disabled:opacity-50">
          <RiRefreshLine className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-4 text-center border-danger-500/20">
          <p className="text-3xl font-bold text-danger-400">{alertCount}</p>
          <p className="text-xs text-slate-400 mt-1">Active Alerts</p>
        </div>
        <div className="glass p-4 text-center border-success-500/20">
          <p className="text-3xl font-bold text-success-400">{safeCount}</p>
          <p className="text-xs text-slate-400 mt-1">Safe Rooms</p>
        </div>
        <div className="glass p-4 text-center border-slate-600/20">
          <p className="text-3xl font-bold text-slate-400">{offlineCount}</p>
          <p className="text-xs text-slate-400 mt-1">Offline Devices</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[['all','All Rooms'],['alert','🔴 Alerts'],['safe','🟢 Safe'],['offline','⚫ Offline']].map(([val,label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              filter === val
                ? 'bg-primary-600/20 border-primary-500/40 text-primary-400'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
            }`}>{label}</button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass p-5 h-48 animate-pulse">
              <div className="h-4 bg-white/10 rounded mb-3 w-3/4" />
              <div className="h-3 bg-white/5 rounded mb-6 w-1/2" />
              <div className="space-y-2">
                <div className="h-3 bg-white/5 rounded" />
                <div className="h-3 bg-white/5 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <RiAlarmWarningLine size={48} className="mx-auto mb-3 opacity-30" />
          <p>No classrooms match this filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(room => (
            <ClassroomCard 
              key={room._id} 
              room={room} 
              onClearAlert={handleClearAlert} 
              onViewLogs={handleViewLogs}
            />
          ))}
        </div>
      )}

      {/* ROOM HISTORY MODAL */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-strong w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden border-white/20">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
              <div>
                <h3 className="text-white font-bold text-lg">{selectedRoom.roomName} History</h3>
                <p className="text-xs text-slate-400">Assigned ESP32: {selectedRoom.esp32DeviceId?.deviceId || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedRoom(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <RiCloseLine className="text-slate-400 hover:text-white" size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {logsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : roomLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <RiHistoryLine size={48} className="opacity-20" />
                  <p>No detection history for this classroom</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roomLogs.map((log, i) => (
                    <div key={log._id || i} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                      <div className="w-10 h-10 rounded-full bg-danger-500/10 flex items-center justify-center text-danger-400 flex-shrink-0">
                        <MdBluetooth size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-mono text-sm text-white font-semibold">{log.macAddress?.toUpperCase()}</p>
                          <p className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-slate-400">Device: <span className="text-slate-300">{log.deviceName || 'Unknown'}</span></p>
                          <p className="text-xs text-slate-400">Signal: <span className="text-warning-400">{log.rssi} dBm</span></p>
                          <p className="text-xs text-slate-400">Distance: <span className="text-primary-400">≈ {calculateDistance(log.rssi)}</span></p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end">
              <button onClick={() => setSelectedRoom(null)} className="btn-ghost px-6">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

