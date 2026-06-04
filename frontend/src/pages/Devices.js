import React, { useEffect, useState } from 'react';
import { deviceAPI, classroomAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import {
  RiAddLine, RiEditLine, RiDeleteBin6Line, RiCpuLine,
  RiWifiLine, RiWifiOffLine, RiRouterLine, RiSignalWifiErrorLine,
} from 'react-icons/ri';
import {
  MdOutlineRouter, MdOutlineShield, MdOutlineVisibility,
  MdOutlineNetworkCheck, MdOutlineAccessTime, MdOutlineMeetingRoom,
  MdOutlineWifi, MdOutlineDevicesOther,
} from 'react-icons/md';
import { HiOutlineCpuChip } from 'react-icons/hi2';

/* ─── Shimmer skeleton card ───────────────────────────────── */
const SkeletonCard = () => (
  <div className="glass rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.08]">
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="shimmer h-5 w-32 rounded-lg" />
        <div className="shimmer h-4 w-4 rounded-full" />
      </div>
      <div className="shimmer h-3 w-24 rounded" />
      <div className="shimmer h-3 w-40 rounded" />
      <div className="shimmer h-3 w-28 rounded" />
      <div className="shimmer h-2 w-full rounded-full mt-2" />
    </div>
    <div className="border-t border-slate-200 dark:border-white/[0.06] px-4 py-3 flex gap-3">
      <div className="shimmer h-8 flex-1 rounded-xl" />
      <div className="shimmer h-8 flex-1 rounded-xl" />
    </div>
    <div className="border-t border-slate-200 dark:border-white/[0.06] px-4 py-3 flex gap-2 justify-end">
      <div className="shimmer h-8 w-8 rounded-xl" />
      <div className="shimmer h-8 w-8 rounded-xl" />
    </div>
  </div>
);

/* ─── RSSI coloured bar ───────────────────────────────────── */
const RssiBar = ({ value }) => {
  // value is negative dBm, e.g. -85. Map -100…-40 → 0…100%
  const pct = Math.max(0, Math.min(100, ((value + 100) / 60) * 100));
  const color =
    pct > 66 ? 'bg-emerald-500' :
    pct > 33 ? 'bg-amber-400'  :
               'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 min-w-[54px] text-right">{value} dBm</span>
    </div>
  );
};

/* ─── Toggle switch ───────────────────────────────────────── */
const Toggle = ({ on, onClick, disabled, variant = 'blue' }) => {
  const trackOn  = variant === 'amber' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-blue-500 shadow-blue-500/30';
  const trackOff = 'bg-slate-300 dark:bg-slate-700';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none
        ${on ? `${trackOn} shadow-md` : trackOff}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 active:scale-95'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300
          ${on ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
};

/* ─── Device card ─────────────────────────────────────────── */
const DeviceCard = ({ d, togglingId, onEdit, onDelete, onMonitoring, onJammer }) => {
  const isOnline   = d.status === 'online';
  const isJammer   = d.jammerStatus === 'active';
  const isMonitor  = d.monitoringStatus === 'active';
  const isToggling = togglingId === d._id;

  const borderGlow =
    isJammer  ? 'border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.18)]' :
    isOnline  ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(34,197,94,0.10)]' :
                'border-slate-200 dark:border-white/[0.06]';

  const dimmed = !isOnline ? 'opacity-60' : '';

  return (
    <div
      className={`relative flex flex-col glass rounded-2xl overflow-hidden border transition-all duration-500
        hover:-translate-y-1 hover:shadow-2xl group ${borderGlow} ${dimmed}`}
    >
      {/* Jammer active ribbon */}
      {isJammer && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 animate-pulse" />
      )}

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
            ${isOnline ? 'bg-emerald-500/15' : 'bg-slate-200 dark:bg-slate-700/60'}`}>
            <MdOutlineRouter size={16} className={isOnline ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} />
          </div>
          <span className="font-mono text-[13px] font-bold text-slate-900 dark:text-white truncate">{d.deviceId}</span>
        </div>
        {/* Online / Offline indicator */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {isOnline ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Online</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400 dark:bg-slate-600" />
              </span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pb-3 space-y-2 flex-1">
        {/* IP */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <MdOutlineWifi size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          <span className="font-mono text-slate-700 dark:text-slate-300">{d.ipAddress || <span className="text-slate-400 dark:text-slate-600">—</span>}</span>
        </div>
        {/* Classroom */}
        <div className="flex items-center gap-2 text-xs">
          <MdOutlineMeetingRoom size={13} className="text-slate-400 dark:text-slate-500 flex-shrink-0" />
          {d.classroomId?.roomName
            ? <span className="badge-gray text-[11px]">{d.classroomId.roomName}</span>
            : <span className="text-slate-400 dark:text-slate-600 text-[11px]">Unassigned</span>}
        </div>
        {/* Last seen */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MdOutlineAccessTime size={13} className="flex-shrink-0" />
          <span>{d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'Never seen'}</span>
        </div>
        {/* RSSI bar */}
        <div className="pt-1">
          <div className="flex items-center gap-1.5 mb-1">
            <MdOutlineNetworkCheck size={12} className="text-slate-400 dark:text-slate-500" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">RSSI Threshold</span>
          </div>
          <RssiBar value={d.rssiThreshold || -85} />
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="border-t border-slate-200 dark:border-white/[0.06] px-4 py-3 space-y-2.5">
        {/* Monitoring row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MdOutlineVisibility size={14} className={isMonitor ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Monitoring</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isMonitor ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'}`}>
              {isMonitor ? 'ON' : 'OFF'}
            </span>
            <Toggle
              on={isMonitor}
              onClick={() => onMonitoring(d)}
              disabled={isToggling || !isOnline}
              variant="blue"
            />
          </div>
        </div>
        {/* Jammer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MdOutlineShield size={14} className={isJammer ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'} />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Jammer 🛡</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isJammer ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'}`}>
              {isJammer ? 'ON' : 'OFF'}
            </span>
            <Toggle
              on={isJammer}
              onClick={() => onJammer(d)}
              disabled={isToggling || !isOnline || !isMonitor}
              variant="amber"
            />
          </div>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="border-t border-slate-200 dark:border-white/[0.06] px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => onEdit(d)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl
            text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20
            text-xs font-semibold transition-all duration-200 active:scale-95"
        >
          <RiEditLine size={14} /> Edit
        </button>
        <div className="w-px h-6 bg-slate-200 dark:bg-white/[0.06]" />
        <button
          onClick={() => onDelete(d._id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl
            text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20
            text-xs font-semibold transition-all duration-200 active:scale-95"
        >
          <RiDeleteBin6Line size={14} /> Delete
        </button>
      </div>
    </div>
  );
};

/* ─── Empty state ─────────────────────────────────────────── */
const EmptyState = ({ onAdd }) => (
  <div className="flex flex-col items-center justify-center py-24 select-none">
    <div className="relative mb-6">
      <div className="absolute inset-0 rounded-3xl bg-blue-500/10 blur-2xl scale-150 animate-pulse" />
      <div className="relative w-24 h-24 rounded-3xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.10] flex items-center justify-center shadow-2xl">
        <RiCpuLine size={44} className="text-blue-500 dark:text-blue-400/70" />
      </div>
    </div>
    <h3 className="text-slate-900 dark:text-white font-semibold text-lg mb-1">No Devices Registered</h3>
    <p className="text-slate-500 text-sm mb-6 text-center max-w-xs">
      Register your first ESP32 device to start monitoring classrooms in real-time.
    </p>
    <button onClick={onAdd} className="btn-primary">
      <RiAddLine size={16} /> Register First Device
    </button>
  </div>
);

/* ─── Stat pill ───────────────────────────────────────────── */
const StatPill = ({ label, value, color }) => (
  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>
    <span className="tabular-nums">{value}</span>
    <span className="font-normal opacity-80">{label}</span>
  </div>
);

/* ─── Premium modal ───────────────────────────────────────── */
const Modal = ({ title, onClose, onSubmit, children }) => (
  <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
    <div
      className="glass-strong w-full max-w-md shadow-2xl rounded-2xl overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* Modal header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/15 flex items-center justify-center">
            <MdOutlineDevicesOther size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-slate-900 dark:text-white font-semibold text-sm">{title}</h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-lg leading-none"
        >
          ×
        </button>
      </div>
      <form onSubmit={onSubmit} className="p-6 space-y-4">
        {children}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white
              bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500
              shadow-lg shadow-blue-600/25 transition-all duration-200 active:scale-95"
          >
            💾 Save Device
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 btn-ghost justify-center py-2.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
);

/* ─── Field label with icon ───────────────────────────────── */
const FieldLabel = ({ icon: Icon, children }) => (
  <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
    {Icon && <Icon size={12} className="text-blue-600 dark:text-blue-400" />}
    {children}
  </label>
);

/* ═══════════════════════════════════════════════════════════ */
/*  Main page component                                        */
/* ═══════════════════════════════════════════════════════════ */
export default function Devices() {
  const [devices,    setDevices]    = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [form,       setForm]       = useState({ deviceId: '', ipAddress: '', classroomId: '', rssiThreshold: -85 });
  const [togglingId, setTogglingId] = useState(null);
  const { on, off } = useSocket();

  /* ── data fetch ── */
  const fetchAll = async () => {
    try {
      const [d, c] = await Promise.all([deviceAPI.getAll(), classroomAPI.getAll()]);
      setDevices(d.data.data || []);
      setClassrooms(c.data.data || []);
    } catch { toast.error('Failed to load devices'); }
    finally { setLoading(false); }
  };

  /* ── socket listeners ── */
  useEffect(() => {
    fetchAll();
    const handler = ({ deviceId, status }) => {
      setDevices(prev => prev.map(d => d._id === deviceId ? { ...d, status } : d));
    };
    const jammerHandler = ({ deviceId, jammerStatus }) => {
      setDevices(prev => prev.map(d => d._id === deviceId ? { ...d, jammerStatus } : d));
    };
    const deviceUpdateHandler = ({ deviceId, monitoringStatus, jammerStatus }) => {
      setDevices(prev => prev.map(d =>
        d._id === deviceId
          ? { ...d, monitoringStatus, jammerStatus: jammerStatus || d.jammerStatus }
          : d
      ));
    };
    on('deviceStatus',  handler);
    on('jammerUpdate',  jammerHandler);
    on('deviceUpdate',  deviceUpdateHandler);
    return () => {
      off('deviceStatus',  handler);
      off('jammerUpdate',  jammerHandler);
      off('deviceUpdate',  deviceUpdateHandler);
    };
  }, [on, off]);

  /* ── modal helpers ── */
  const openAdd  = () => {
    setForm({ deviceId: '', ipAddress: '', classroomId: '', rssiThreshold: -85 });
    setModal('add');
  };
  const openEdit = (d) => {
    setSelected(d);
    setForm({ deviceId: d.deviceId, ipAddress: d.ipAddress, classroomId: d.classroomId?._id || '', rssiThreshold: d.rssiThreshold || -85 });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); };

  /* ── CRUD handlers ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, classroomId: form.classroomId || null };
    try {
      if (modal === 'add') { await deviceAPI.create(payload); toast.success('Device registered!'); }
      else                  { await deviceAPI.update(selected._id, payload); toast.success('Device updated!'); }
      fetchAll(); closeModal();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving device'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this device?')) return;
    try { await deviceAPI.delete(id); toast.success('Device deleted'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  /* ── toggle handlers ── */
  const handleJammer = async (device) => {
    setTogglingId(device._id);
    try {
      const res = await deviceAPI.toggleJammer(device._id);
      const newStatus = res.data.jammerStatus;
      toast.success(`Jammer ${newStatus === 'active' ? 'ACTIVATED 🛡' : 'DEACTIVATED'}`);
      setDevices(prev => prev.map(d => d._id === device._id ? { ...d, jammerStatus: newStatus } : d));
    } catch { toast.error('Jammer control failed'); }
    finally { setTogglingId(null); }
  };

  const handleMonitoring = async (device) => {
    setTogglingId(device._id);
    try {
      const res = await deviceAPI.toggleMonitoring(device._id);
      const newStatus = res.data.monitoringStatus;
      toast.success(`Monitoring ${newStatus === 'active' ? 'ENABLED 🛰' : 'DISABLED'}`);
      setDevices(prev => prev.map(d =>
        d._id === device._id
          ? { ...d, monitoringStatus: newStatus, jammerStatus: res.data.data.jammerStatus }
          : d
      ));
    } catch { toast.error('Monitoring control failed'); }
    finally { setTogglingId(null); }
  };

  /* ── derived stats ── */
  const onlineCount  = devices.filter(d => d.status === 'online').length;
  const jammerCount  = devices.filter(d => d.jammerStatus === 'active').length;

  /* ─────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">ESP32 Devices</h2>
            {/* Stats pills */}
            {!loading && (
              <div className="flex items-center gap-2 flex-wrap">
                <StatPill
                  label="Total"
                  value={devices.length}
                  color="border-slate-200 dark:border-slate-600/50 bg-slate-100 dark:bg-slate-700/30 text-slate-700 dark:text-slate-300"
                />
                <StatPill
                  label="Online"
                  value={onlineCount}
                  color="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                />
                <StatPill
                  label="Jammer Active"
                  value={jammerCount}
                  color="border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                />
              </div>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-1.5">
            Manage and monitor your ESP32 network devices in real-time
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary flex-shrink-0">
          <RiAddLine size={16} />
          <span className="hidden sm:inline">Register Device</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* ── Card grid / states ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="glass rounded-2xl">
          <EmptyState onAdd={openAdd} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map(d => (
            <DeviceCard
              key={d._id}
              d={d}
              togglingId={togglingId}
              onEdit={openEdit}
              onDelete={handleDelete}
              onMonitoring={handleMonitoring}
              onJammer={handleJammer}
            />
          ))}
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      {modal && (
        <Modal
          title={modal === 'add' ? 'Register ESP32 Device' : 'Edit Device'}
          onClose={closeModal}
          onSubmit={handleSubmit}
        >
          {/* Device ID */}
          <div>
            <FieldLabel icon={RiCpuLine}>Device ID</FieldLabel>
            <input
              className="input"
              placeholder="e.g. ESP32-A101"
              value={form.deviceId}
              onChange={e => setForm({ ...form, deviceId: e.target.value })}
              required
              disabled={modal === 'edit'}
            />
          </div>

          {/* IP Address */}
          <div>
            <FieldLabel icon={MdOutlineWifi}>IP Address</FieldLabel>
            <input
              className="input"
              placeholder="e.g. 192.168.1.101"
              value={form.ipAddress}
              onChange={e => setForm({ ...form, ipAddress: e.target.value })}
            />
          </div>

          {/* Classroom */}
          <div>
            <FieldLabel icon={MdOutlineMeetingRoom}>Assign to Classroom (Optional)</FieldLabel>
            <select
              className="input"
              value={form.classroomId}
              onChange={e => setForm({ ...form, classroomId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {classrooms.map(c => (
                <option key={c._id} value={c._id}>
                  {c.roomName} — {c.blockId?.blockName}
                </option>
              ))}
            </select>
          </div>

          {/* RSSI Threshold */}
          <div>
            <FieldLabel icon={MdOutlineNetworkCheck}>RSSI Sensitivity (Lower = Less Sensitive)</FieldLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="-100"
                max="-40"
                step="1"
                className="flex-1 accent-blue-500"
                value={form.rssiThreshold}
                onChange={e => setForm({ ...form, rssiThreshold: parseInt(e.target.value) })}
              />
              <span className="font-mono text-slate-900 dark:text-white text-sm min-w-[64px] text-right">
                {form.rssiThreshold} dBm
              </span>
            </div>
            {/* Mini preview bar in modal */}
            <div className="mt-2">
              <RssiBar value={form.rssiThreshold} />
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Recommended: -80 to -85. Use -70 for very close range only.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
