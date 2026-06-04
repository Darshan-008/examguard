import React, { useEffect, useState, useCallback } from 'react';
import { blockAPI, floorAPI, classroomAPI, detectionAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { 
  RiBuilding2Line, RiStackLine, RiDoorOpenLine, 
  RiAddLine, RiEditLine, RiDeleteBin6Line,
  RiArrowRightSLine, RiArrowDownSLine,
  RiMapLine, RiNodeTree, RiWifiOffLine,
  RiShieldCheckLine, RiAlarmWarningLine, RiCloseLine, RiRefreshLine
} from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';

const Modal = ({ title, onClose, onSubmit, children }) => (
  <div className="fixed inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="glass-strong w-full max-w-md shadow-xl dark:shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
        <h3 className="text-slate-900 dark:text-white font-semibold">{title}</h3>
        <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xl">×</button>
      </div>
      <form onSubmit={onSubmit} className="p-6 space-y-4">
        {children}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1 justify-center">Save</button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
        </div>
      </form>
    </div>
  </div>
);

// ── Classroom Tile for Map View ──────────────────────────────────────────────
const ClassroomTile = ({ room, liveStatus, onTileClick }) => {
  const live = liveStatus[room._id] || {};
  const alertStatus    = live.alertStatus    ?? room.alertStatus;
  const totalDetections = live.totalDetections ?? room.totalDetections ?? 0;
  const deviceStatus   = live.deviceStatus   ?? room.esp32DeviceId?.status;
  const jammerStatus   = live.jammerStatus   ?? room.esp32DeviceId?.jammerStatus;
  const lastTime       = live.lastDetectionTime ?? room.lastDetectionTime;
  const monitoringStatus = live.monitoringStatus ?? room.esp32DeviceId?.monitoringStatus;

  const hasDevice  = !!room.esp32DeviceId;
  const isInactive = monitoringStatus === 'inactive';
  const isOffline  = !hasDevice || deviceStatus === 'offline';
  const isAlert    = alertStatus && !isOffline && !isInactive;
  const isJammer   = jammerStatus === 'active' && !isOffline;

  let bgStyle, borderStyle, dotColor, statusLabel;

  if (isAlert) {
    bgStyle = 'bg-red-500/10 hover:bg-red-500/20';
    borderStyle = 'border-red-500/50 shadow-red-500/20 shadow-lg';
    dotColor = 'bg-red-500';
    statusLabel = '🔴 Alert';
  } else if (isInactive) {
    bgStyle = 'bg-slate-100/40 dark:bg-slate-800/40 hover:bg-slate-200/40 dark:hover:bg-slate-700/40';
    borderStyle = 'border-slate-300/40 dark:border-slate-700/40';
    dotColor = 'bg-slate-400 dark:bg-slate-600';
    statusLabel = '⚫ Inactive';
  } else if (isOffline) {
    bgStyle = 'bg-slate-100/30 dark:bg-slate-800/30 hover:bg-slate-200/30 dark:hover:bg-slate-700/30';
    borderStyle = 'border-slate-300/30 dark:border-slate-600/30';
    dotColor = 'bg-slate-500 dark:bg-slate-500';
    statusLabel = '⚫ Offline';
  } else if (isJammer) {
    bgStyle = 'bg-yellow-500/8 hover:bg-yellow-500/15';
    borderStyle = 'border-yellow-500/40 shadow-yellow-500/10 shadow-md';
    dotColor = 'bg-yellow-400';
    statusLabel = '🟡 Jammer';
  } else {
    bgStyle = 'bg-emerald-500/5 hover:bg-emerald-500/12';
    borderStyle = 'border-emerald-500/30';
    dotColor = 'bg-emerald-400';
    statusLabel = '🟢 Safe';
  }

  return (
    <button
      onClick={() => onTileClick(room)}
      className={`relative flex flex-col gap-2 p-3 rounded-xl border transition-all duration-300 text-left w-full ${bgStyle} ${borderStyle}`}
    >
      {/* Alert pulse ring */}
      {isAlert && (
        <span className="absolute inset-0 rounded-xl animate-ping opacity-20 bg-red-500 pointer-events-none" />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-slate-900 dark:text-white font-semibold text-xs leading-tight truncate flex-1">{room.roomName}</p>
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${dotColor} ${isAlert ? 'animate-pulse' : ''}`} />
      </div>

      {/* Device ID */}
      <p className="text-slate-500 dark:text-slate-500 text-[10px] font-mono truncate leading-none">
        {room.esp32DeviceId?.deviceId || 'No Device'}
      </p>

      {/* Status + count badges */}
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
          isAlert   ? 'bg-red-500/20 border-red-500/30 text-red-600 dark:text-red-300' :
          isOffline ? 'bg-slate-200/50 dark:bg-slate-700/50 border-slate-300/40 dark:border-slate-600/40 text-slate-500 dark:text-slate-500' :
          isJammer  ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-600 dark:text-yellow-300' :
                      'bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
        }`}>
          {statusLabel}
        </span>
        {totalDetections > 0 && (
          <span className="text-[9px] font-bold bg-red-500/15 border border-red-500/25 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
            {totalDetections}×
          </span>
        )}
      </div>

      {/* Last detection time if alert */}
      {isAlert && lastTime && (
        <p className="text-[9px] text-red-500 dark:text-red-400/80 leading-none">
          ⏱ {new Date(lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </button>
  );
};

// ── Map View ─────────────────────────────────────────────────────────────────
const MapView = ({ data, liveStatus, onTileClick }) => {
  const [activeBlock, setActiveBlock] = useState(null);

  useEffect(() => {
    if (data.length > 0 && !activeBlock) setActiveBlock(data[0]._id);
  }, [data, activeBlock]);

  const block = data.find(b => b._id === activeBlock) || data[0];

  const totalAlert  = Object.values(liveStatus).filter(s => s.alertStatus).length +
    (data.flatMap(b => b.floors.flatMap(f => f.classrooms)).filter(r => !liveStatus[r._id] && r.alertStatus).length);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 glass rounded-xl border border-slate-200 dark:border-white/8">
        <span className="text-slate-500 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest mr-1">Legend</span>
        {[
          { dot: 'bg-red-500 animate-pulse', label: 'Active Alert' },
          { dot: 'bg-emerald-400', label: 'Safe & Online' },
          { dot: 'bg-yellow-400', label: 'Jammer Active' },
          { dot: 'bg-slate-500', label: 'Offline / No Device' },
        ].map(({ dot, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
            <span className="text-slate-600 dark:text-slate-400 text-[11px]">{label}</span>
          </div>
        ))}
        {totalAlert > 0 && (
          <div className="ml-auto flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1 rounded-lg">
            <RiAlarmWarningLine className="text-red-500 dark:text-red-400" size={12} />
            <span className="text-red-600 dark:text-red-300 text-xs font-bold">{totalAlert} Active Alert{totalAlert !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Block tabs */}
      <div className="flex gap-2 flex-wrap">
        {data.map(b => {
          const hasAlert = b.floors.some(f => f.classrooms.some(r => 
            (liveStatus[r._id]?.alertStatus ?? r.alertStatus)));
          return (
            <button
              key={b._id}
              onClick={() => setActiveBlock(b._id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                activeBlock === b._id
                  ? 'bg-primary-50 dark:bg-primary-600/25 border-primary-500/50 text-primary-600 dark:text-primary-300'
                  : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/8'
              }`}
            >
              <RiBuilding2Line size={14} />
              {b.blockName}
              {hasAlert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              <span className="text-[10px] opacity-60">{b.floors.length}F</span>
            </button>
          );
        })}
      </div>

      {/* Floor sections */}
      {block ? (
        <div className="space-y-4">
          {block.floors.length === 0 ? (
            <div className="glass p-10 text-center text-slate-500 dark:text-slate-500 text-sm">No floors in this block.</div>
          ) : block.floors.map(floor => {
            const floorAlert = floor.classrooms.filter(r =>
              liveStatus[r._id]?.alertStatus ?? r.alertStatus).length;
            return (
              <div key={floor._id} className="glass rounded-xl overflow-hidden border border-slate-200 dark:border-white/8">
                {/* Floor header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <RiStackLine className="text-indigo-500 dark:text-indigo-400" size={16} />
                    <span className="text-slate-900 dark:text-white font-semibold text-sm">{floor.floorName}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-white/5 px-2 py-0.5 rounded-full">
                      {floor.classrooms.length} rooms
                    </span>
                  </div>
                  {floorAlert > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-300 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-lg font-bold">
                      <RiAlarmWarningLine size={11} />
                      {floorAlert} alert{floorAlert !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {/* Classroom tiles grid */}
                <div className="p-4">
                  {floor.classrooms.length === 0 ? (
                    <p className="text-slate-600 dark:text-slate-400 text-xs italic">No classrooms.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {floor.classrooms.map(room => (
                        <ClassroomTile
                          key={room._id}
                          room={room}
                          liveStatus={liveStatus}
                          onTileClick={onTileClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass p-10 text-center text-slate-500 dark:text-slate-500 text-sm">Select a block to view its map.</div>
      )}
    </div>
  );
};

// ── Room Detail Modal (for Map View tile clicks) ─────────────────────────────
const RoomDetailModal = ({ room, liveStatus, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const live = liveStatus[room._id] || {};
  const isAlert = live.alertStatus ?? room.alertStatus;

  useEffect(() => {
    detectionAPI.getLogs({ classroomId: room._id, limit: 20 })
      .then(res => setLogs(res.data.data || []))
      .catch(() => toast.error('Failed to load logs'))
      .finally(() => setLoading(false));
  }, [room._id]);

  return (
    <div className="fixed inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="glass-strong w-full max-w-lg h-[85vh] sm:h-auto sm:max-h-[80vh] flex flex-col shadow-xl dark:shadow-2xl animate-fade-in border-slate-300 dark:border-white/20 rounded-t-3xl sm:rounded-2xl overflow-hidden">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 ${isAlert ? 'bg-red-500/10' : 'bg-slate-100 dark:bg-white/5'}`}>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-slate-900 dark:text-white font-bold text-lg">{room.roomName}</h3>
              {isAlert && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">ALERT</span>}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {room.blockId?.blockName} › {room.floorId?.floorName} · ESP32: {room.esp32DeviceId?.deviceId || 'N/A'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <RiCloseLine className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" size={22} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-white/5 border-b border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/3">
          {[
            { label: 'Status', value: isAlert ? '🔴 Alert' : '🟢 Safe', color: isAlert ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Total Detections', value: live.totalDetections ?? room.totalDetections ?? 0, color: 'text-slate-900 dark:text-white' },
            { label: 'Jammer', value: (live.jammerStatus ?? room.esp32DeviceId?.jammerStatus) === 'active' ? '🟡 ON' : '⚫ OFF', color: 'text-slate-700 dark:text-slate-300' },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className={`font-bold text-sm ${color}`}>{value}</p>
              <p className="text-slate-500 dark:text-slate-500 text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 mb-3">
            <MdBluetooth size={12} /> Recent Detections
          </p>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-slate-500 text-sm">No detections recorded for this room.</div>
          ) : logs.map((log, i) => (
            <div key={log._id || i} className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 transition-all">
              <div>
                <p className="font-mono text-xs text-slate-900 dark:text-white font-semibold">{log.macAddress?.toUpperCase()}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">{log.deviceName} · {log.category}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-yellow-500 dark:text-yellow-400 font-semibold">{log.rssi} dBm</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-600">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 flex justify-end">
          <button onClick={onClose} className="btn-ghost px-6">Close</button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function Infrastructure() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [viewMode, setViewMode] = useState('tree'); // 'tree' | 'map'

  const [roomLogs, setRoomLogs] = useState({});
  const [logsLoading, setLogsLoading] = useState(false);

  // Live status overlay for map view (classroomId → { alertStatus, totalDetections, ... })
  const [liveStatus, setLiveStatus] = useState({});

  // Map tile detail modal
  const [selectedTile, setSelectedTile] = useState(null);

  // Modal state
  const [modal, setModal] = useState(null);
  const [mode, setMode] = useState('add');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});

  const { on, off } = useSocket();

  const fetchInfrastructure = useCallback(async () => {
    setLoading(true);
    try {
      const [b, f, c] = await Promise.all([
        blockAPI.getAll(),
        floorAPI.getAll(),
        classroomAPI.getAll()
      ]);

      const blocks = b.data.data.map(block => ({
        ...block,
        floors: f.data.data.filter(floor => floor.blockId?._id === block._id).map(floor => ({
          ...floor,
          classrooms: c.data.data.filter(room => room.floorId?._id === floor._id)
        }))
      }));

      setData(blocks);
    } catch (err) {
      toast.error('Failed to load infrastructure');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfrastructure();
  }, [fetchInfrastructure]);

  // ── Real-time socket handlers ──────────────────────────────────────────────
  useEffect(() => {
    const handleInfraUpdate = ({ type, action, data: item }) => {
      const typeLabel = type === 'block' ? 'Block' : type === 'floor' ? 'Floor' : 'Classroom';
      const itemName = item?.blockName || item?.floorName || item?.roomName || '';
      if (action === 'create') toast.success(`🎙️ ${typeLabel} "${itemName}" added via voice!`, { duration: 3000 });
      else if (action === 'update') toast(`${typeLabel} "${itemName}" updated`, { icon: '✏️' });
      else if (action === 'delete') toast(`${typeLabel} deleted`, { icon: '🗑️' });
      fetchInfrastructure();
    };

    const handleAlert = (data) => {
      setLiveStatus(prev => ({
        ...prev,
        [data.classroomId]: {
          ...prev[data.classroomId],
          alertStatus: true,
          lastDetectionTime: data.timestamp,
          totalDetections: ((prev[data.classroomId]?.totalDetections) || 0) + 1,
        }
      }));
    };

    const handleClear = ({ classroomId }) => {
      setLiveStatus(prev => ({
        ...prev,
        [classroomId]: { ...prev[classroomId], alertStatus: false, totalDetections: 0 },
      }));
    };

    const handleDevice = ({ deviceId, status }) => {
      setData(prev => prev.map(block => ({
        ...block,
        floors: block.floors.map(floor => ({
          ...floor,
          classrooms: floor.classrooms.map(room =>
            room.esp32DeviceId?._id === deviceId
              ? { ...room, esp32DeviceId: { ...room.esp32DeviceId, status } }
              : room
          )
        }))
      })));
    };

    const handleDeviceUpdate = ({ deviceId, monitoringStatus, jammerStatus }) => {
      setLiveStatus(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(roomId => {
          if (updated[roomId]?.deviceId === deviceId) {
            updated[roomId] = { ...updated[roomId], monitoringStatus, jammerStatus };
          }
        });
        return updated;
      });
    };

    on('infrastructureUpdate', handleInfraUpdate);
    on('bluetoothAlert', handleAlert);
    on('alertCleared', handleClear);
    on('deviceStatus', handleDevice);
    on('deviceUpdate', handleDeviceUpdate);
    return () => {
      off('infrastructureUpdate', handleInfraUpdate);
      off('bluetoothAlert', handleAlert);
      off('alertCleared', handleClear);
      off('deviceStatus', handleDevice);
      off('deviceUpdate', handleDeviceUpdate);
    };
  }, [on, off, fetchInfrastructure]);

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleAddBlock     = () => { setForm({ blockName: '' }); setMode('add'); setModal('block'); };
  const handleEditBlock    = (block) => { setSelected(block); setForm({ blockName: block.blockName }); setMode('edit'); setModal('block'); };
  const handleAddFloor     = (blockId) => { setForm({ floorName: '', blockId }); setMode('add'); setModal('floor'); };
  const handleEditFloor    = (floor) => { setSelected(floor); setForm({ floorName: floor.floorName, blockId: floor.blockId?._id }); setMode('edit'); setModal('floor'); };
  const handleAddClassroom = (floorId, blockId) => { setForm({ roomName: '', floorId, blockId }); setMode('add'); setModal('classroom'); };
  const handleEditClassroom = (room) => {
    setSelected(room);
    setForm({ roomName: room.roomName, floorId: room.floorId?._id, blockId: room.blockId?._id, esp32DeviceId: room.esp32DeviceId?._id || '' });
    setMode('edit');
    setModal('classroom');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'block') {
        if (mode === 'add') await blockAPI.create(form);
        else await blockAPI.update(selected._id, form);
      } else if (modal === 'floor') {
        if (mode === 'add') await floorAPI.create(form);
        else await floorAPI.update(selected._id, form);
      } else if (modal === 'classroom') {
        if (mode === 'add') await classroomAPI.create(form);
        else await classroomAPI.update(selected._id, form);
      }
      toast.success(`${modal.charAt(0).toUpperCase() + modal.slice(1)} ${mode === 'add' ? 'created' : 'updated'}`);
      setModal(null);
      fetchInfrastructure();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    try {
      if (type === 'block') await blockAPI.delete(id);
      if (type === 'floor') await floorAPI.delete(id);
      if (type === 'classroom') await classroomAPI.delete(id);
      toast.success(`${type} deleted`);
      fetchInfrastructure();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // ── Counts for header ──────────────────────────────────────────────────────
  const allRooms = data.flatMap(b => b.floors.flatMap(f => f.classrooms));
  const alertCount = allRooms.filter(r => liveStatus[r._id]?.alertStatus ?? r.alertStatus).length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* ── Page header ── */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Campus Infrastructure</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">Manage Blocks, Floors, and Classrooms</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'tree'
                  ? 'bg-primary-50 dark:bg-primary-600/30 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-500/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <RiNodeTree size={14} />
              <span className="hidden sm:inline">Tree</span>
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'map'
                  ? 'bg-primary-50 dark:bg-primary-600/30 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-500/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <RiMapLine size={14} />
              <span className="hidden sm:inline">Heatmap</span>
              {alertCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {alertCount}
                </span>
              )}
            </button>
          </div>

          <button onClick={fetchInfrastructure} disabled={loading}
            className="btn-ghost text-sm disabled:opacity-50 px-3">
            <RiRefreshLine className={loading ? 'animate-spin' : ''} />
          </button>

          <button onClick={handleAddBlock} className="btn-primary flex-shrink-0">
            <RiAddLine /><span className="hidden sm:inline">Add Block</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : data.length === 0 ? (
        <div className="card text-center py-20 text-slate-500 dark:text-slate-500">No infrastructure data found. Start by adding a block.</div>
      ) : viewMode === 'map' ? (
        // ── MAP / HEATMAP VIEW ────────────────────────────────────────────────
        <MapView
          data={data}
          liveStatus={liveStatus}
          onTileClick={setSelectedTile}
        />
      ) : (
        // ── TREE VIEW (original) ──────────────────────────────────────────────
        <div className="space-y-4">
          {data.map(block => (
            <div key={block._id} className="glass overflow-hidden transition-all duration-300">
              {/* Block Header */}
              <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => toggle(block._id)}>
                  {expanded[block._id] ? <RiArrowDownSLine className="text-slate-500 dark:text-slate-500" /> : <RiArrowRightSLine className="text-slate-500 dark:text-slate-500" />}
                  <RiBuilding2Line className="text-primary-500 dark:text-primary-400" size={20} />
                  <span className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors">{block.blockName}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-500 ml-2 bg-slate-200 dark:bg-white/5 px-2 py-0.5 rounded-full">{block.floors.length} Floors</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleAddFloor(block._id)} className="p-2 rounded-lg hover:bg-success-50 dark:hover:bg-success-500/10 text-success-600 dark:text-success-400 text-sm flex items-center gap-1">
                    <RiAddLine /> <span className="hidden sm:inline">Add Floor</span>
                  </button>
                  <button onClick={() => handleEditBlock(block)} className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/10 text-primary-600 dark:text-primary-400"><RiEditLine /></button>
                  <button onClick={() => handleDelete('block', block._id)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 text-danger-600 dark:text-danger-400"><RiDeleteBin6Line /></button>
                </div>
              </div>

              {/* Floors Container */}
              {expanded[block._id] && (
                <div className="p-4 space-y-3 bg-slate-50 dark:bg-black/20">
                  {block.floors.length === 0 ? (
                    <p className="text-xs text-slate-600 dark:text-slate-600 italic ml-10">No floors added to this block.</p>
                  ) : block.floors.map(floor => (
                    <div key={floor._id} className="ml-6 border-l-2 border-slate-200 dark:border-white/5 pl-4">
                      {/* Floor Header */}
                      <div className="flex items-center justify-between py-2 group">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(floor._id)}>
                          {expanded[floor._id] ? <RiArrowDownSLine className="text-slate-500 dark:text-slate-500" size={14} /> : <RiArrowRightSLine className="text-slate-500 dark:text-slate-500" size={14} />}
                          <RiStackLine className="text-indigo-500 dark:text-indigo-400" size={18} />
                          <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">{floor.floorName}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-500 bg-slate-200 dark:bg-white/5 px-1.5 py-0.2 rounded-full">{floor.classrooms.length} Rooms</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleAddClassroom(floor._id, block._id)} className="p-1.5 text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-500/10 rounded-md text-xs flex items-center gap-1">
                            <RiAddLine /> Room
                          </button>
                          <button onClick={() => handleEditFloor(floor)} className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-md"><RiEditLine size={14}/></button>
                          <button onClick={() => handleDelete('floor', floor._id)} className="p-1.5 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-md"><RiDeleteBin6Line size={14}/></button>
                        </div>
                      </div>

                      {/* Classrooms Container */}
                      {expanded[floor._id] && (
                        <div className="ml-8 mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {floor.classrooms.length === 0 ? (
                            <p className="text-xs text-slate-600 dark:text-slate-600 italic">No classrooms added.</p>
                          ) : floor.classrooms.map(room => {
                            const live = liveStatus[room._id] || {};
                            const isAlert = live.alertStatus ?? room.alertStatus;
                            return (
                              <div key={room._id} className={`flex flex-col rounded-xl border transition-all overflow-hidden ${
                                isAlert ? 'bg-red-50 dark:bg-red-500/8 border-red-200 dark:border-red-500/40' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10'
                              }`}>
                                <div className="flex items-center justify-between p-3">
                                  <div className="flex items-center gap-2 cursor-pointer group/room" onClick={() => {
                                    toggle(room._id);
                                    if (!expanded[room._id]) {
                                      setLogsLoading(true);
                                      detectionAPI.getLogs({ classroomId: room._id, limit: 10 })
                                        .then(res => setRoomLogs(prev => ({ ...prev, [room._id]: res.data.data })))
                                        .finally(() => setLogsLoading(false));
                                    }
                                  }}>
                                    {expanded[room._id] ? <RiArrowDownSLine className="text-slate-500 dark:text-slate-500" size={12} /> : <RiArrowRightSLine className="text-slate-500 dark:text-slate-500" size={12} />}
                                    <RiDoorOpenLine className={isAlert ? 'text-red-500 dark:text-red-400' : 'text-purple-500 dark:text-purple-400'} />
                                    <div>
                                      <p className={`text-sm font-medium transition-colors ${isAlert ? 'text-red-600 dark:text-red-300' : 'text-slate-900 dark:text-white group-hover/room:text-purple-600 dark:group-hover/room:text-purple-300'}`}>
                                        {room.roomName}
                                        {isAlert && <span className="ml-2 text-[9px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 px-1 py-0.5 rounded font-bold">ALERT</span>}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-500 uppercase">{room.esp32DeviceId?.deviceId || 'No Device'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditClassroom(room)} className="p-1.5 text-slate-400 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-md"><RiEditLine size={14}/></button>
                                    <button onClick={() => handleDelete('classroom', room._id)} className="p-1.5 text-slate-400 dark:text-slate-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10 rounded-md"><RiDeleteBin6Line size={14}/></button>
                                  </div>
                                </div>

                                {/* Room Logs (Inline) */}
                                {expanded[room._id] && (
                                  <div className="px-3 pb-3 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/20 animate-fade-in">
                                    <div className="mt-2 space-y-1.5">
                                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <MdBluetooth /> Recent Detections
                                      </p>
                                      {logsLoading && !roomLogs[room._id] ? (
                                        <div className="py-2 text-[10px] text-slate-600 dark:text-slate-600 animate-pulse">Loading logs...</div>
                                      ) : !roomLogs[room._id] || roomLogs[room._id].length === 0 ? (
                                        <p className="text-[10px] text-slate-600 dark:text-slate-600 italic">No recent detections.</p>
                                      ) : (
                                        <div className="space-y-1">
                                          {roomLogs[room._id].map((log, i) => (
                                            <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-slate-200 dark:border-white/5 last:border-0">
                                              <span className="font-mono text-slate-700 dark:text-slate-300">{log.macAddress}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-warning-600 dark:text-warning-500/80">{log.rssi} dBm</span>
                                                <span className="text-slate-600 dark:text-slate-600">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Tile Detail Modal ── */}
      {selectedTile && (
        <RoomDetailModal
          room={selectedTile}
          liveStatus={liveStatus}
          onClose={() => setSelectedTile(null)}
        />
      )}

      {/* ── CRUD MODALS ── */}
      {modal === 'block' && (
        <Modal title={mode === 'add' ? 'Add New Block' : 'Edit Block'} onClose={() => setModal(null)} onSubmit={handleSubmit}>
          <div>
            <label className="label">Block Name</label>
            <input className="input" placeholder="e.g. Block A" value={form.blockName} onChange={e => setForm({...form, blockName: e.target.value})} required autoFocus />
          </div>
        </Modal>
      )}

      {modal === 'floor' && (
        <Modal title={mode === 'add' ? 'Add New Floor' : 'Edit Floor'} onClose={() => setModal(null)} onSubmit={handleSubmit}>
          <div>
            <label className="label">Floor Name</label>
            <input className="input" placeholder="e.g. 1st Floor" value={form.floorName} onChange={e => setForm({...form, floorName: e.target.value})} required autoFocus />
          </div>
        </Modal>
      )}

      {modal === 'classroom' && (
        <Modal title={mode === 'add' ? 'Add New Classroom' : 'Edit Classroom'} onClose={() => setModal(null)} onSubmit={handleSubmit}>
          <div>
            <label className="label">Room Name</label>
            <input className="input" placeholder="e.g. Room 101" value={form.roomName} onChange={e => setForm({...form, roomName: e.target.value})} required autoFocus />
          </div>
          {mode === 'edit' && (
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">Go to ESP32 Devices to link hardware to this room.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
