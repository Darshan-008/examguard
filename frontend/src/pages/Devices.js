import React, { useEffect, useState } from 'react';
import { deviceAPI, classroomAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { RiAddLine, RiEditLine, RiDeleteBin6Line, RiCpuLine, RiWifiLine, RiWifiOffLine } from 'react-icons/ri';
import { MdOutlineRouter } from 'react-icons/md';

const Modal = ({ title, onClose, onSubmit, children }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="glass-strong w-full max-w-md shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h3 className="text-white font-semibold">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
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

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ deviceId: '', ipAddress: '', classroomId: '', rssiThreshold: -85 });
  const [togglingId, setTogglingId] = useState(null);
  const { on, off } = useSocket();

  const fetchAll = async () => {
    try {
      const [d, c] = await Promise.all([deviceAPI.getAll(), classroomAPI.getAll()]);
      setDevices(d.data.data || []);
      setClassrooms(c.data.data || []);
    } catch { toast.error('Failed to load devices'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchAll();
    const handler = ({ deviceId, status }) => {
      setDevices(prev => prev.map(d => d._id === deviceId ? { ...d, status } : d));
    };
    const jammerHandler = ({ deviceId, jammerStatus }) => {
      setDevices(prev => prev.map(d => d._id === deviceId ? { ...d, jammerStatus } : d));
    };
    const deviceUpdateHandler = ({ deviceId, monitoringStatus, jammerStatus }) => {
      setDevices(prev => prev.map(d => d._id === deviceId ? { ...d, monitoringStatus, jammerStatus: jammerStatus || d.jammerStatus } : d));
    };
    on('deviceStatus', handler);
    on('jammerUpdate', jammerHandler);
    on('deviceUpdate', deviceUpdateHandler);
    return () => { 
      off('deviceStatus', handler); 
      off('jammerUpdate', jammerHandler); 
      off('deviceUpdate', deviceUpdateHandler); 
    };
  }, [on, off]);

  const openAdd = () => { setForm({ deviceId: '', ipAddress: '', classroomId: '', rssiThreshold: -85 }); setModal('add'); };
  const openEdit = (d) => {
    setSelected(d);
    setForm({ deviceId: d.deviceId, ipAddress: d.ipAddress, classroomId: d.classroomId?._id || '', rssiThreshold: d.rssiThreshold || -85 });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, classroomId: form.classroomId || null };
    try {
      if (modal === 'add') { await deviceAPI.create(payload); toast.success('Device registered!'); }
      else { await deviceAPI.update(selected._id, payload); toast.success('Device updated!'); }
      fetchAll(); closeModal();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving device'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this device?')) return;
    try { await deviceAPI.delete(id); toast.success('Device deleted'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const handleJammer = async (device) => {
    setTogglingId(device._id);
    try {
      const res = await deviceAPI.toggleJammer(device._id);
      const newStatus = res.data.jammerStatus;
      toast.success(`Jammer ${newStatus === 'active' ? 'ACTIVATED 🛡' : 'DEACTIVATED'}`);
      setDevices(prev => prev.map(d => d._id === device._id ? { ...d, jammerStatus: newStatus } : d));
    } catch (err) { toast.error('Jammer control failed'); }
    finally { setTogglingId(null); }
  };

  const handleMonitoring = async (device) => {
    setTogglingId(device._id);
    try {
      const res = await deviceAPI.toggleMonitoring(device._id);
      const newStatus = res.data.monitoringStatus;
      toast.success(`Monitoring ${newStatus === 'active' ? 'ENABLED 🛰' : 'DISABLED'}`);
      setDevices(prev => prev.map(d => d._id === device._id ? { ...d, monitoringStatus: newStatus, jammerStatus: res.data.data.jammerStatus } : d));
    } catch (err) { toast.error('Monitoring control failed'); }
    finally { setTogglingId(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">ESP32 Devices</h2>
          <p className="text-slate-400 text-sm mt-1">{devices.length} device(s) — {devices.filter(d => d.status === 'online').length} online</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><RiAddLine />Register Device</button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-8 text-center text-slate-500">Loading...</div>
        : devices.length === 0 ? (
          <div className="p-16 text-center">
            <RiCpuLine size={48} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No ESP32 devices registered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="th">Device ID</th><th className="th">IP Address</th>
                  <th className="th">Classroom</th><th className="th">Status</th>
                  <th className="th">Monitoring</th><th className="th">Jammer</th>
                  <th className="th">Sensitivity</th>
                  <th className="th">Last Seen</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d._id} className="table-row">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <MdOutlineRouter className="text-primary-400 flex-shrink-0" />
                        <span className="font-mono text-white text-sm">{d.deviceId}</span>
                      </div>
                    </td>
                    <td className="td font-mono text-xs text-slate-400">{d.ipAddress || '—'}</td>
                    <td className="td">{d.classroomId?.roomName
                      ? <span className="badge-gray">{d.classroomId.roomName}</span>
                      : <span className="text-slate-600">Unassigned</span>}
                    </td>
                    <td className="td">
                      {d.status === 'online'
                        ? <span className="badge-green"><RiWifiLine size={10}/>Online</span>
                        : <span className="badge-gray"><RiWifiOffLine size={10}/>Offline</span>}
                    </td>
                    <td className="td">
                      <button
                        onClick={() => handleMonitoring(d)}
                        disabled={togglingId === d._id || d.status === 'offline'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300
                          ${d.monitoringStatus === 'active' ? 'bg-primary-500' : 'bg-slate-700'}
                          ${d.status === 'offline' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300
                          ${d.monitoringStatus === 'active' ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className={`ml-2 text-xs ${d.monitoringStatus === 'active' ? 'text-primary-400' : 'text-slate-500'}`}>
                        {d.monitoringStatus === 'active' ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="td">
                      <button
                        onClick={() => handleJammer(d)}
                        disabled={togglingId === d._id || d.status === 'offline' || d.monitoringStatus === 'inactive'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300
                          ${d.jammerStatus === 'active' ? 'bg-warning-500' : 'bg-slate-700'}
                          ${d.status === 'offline' || d.monitoringStatus === 'inactive' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-300
                          ${d.jammerStatus === 'active' ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className={`ml-2 text-xs ${d.jammerStatus === 'active' ? 'text-warning-400' : 'text-slate-500'}`}>
                        {d.jammerStatus === 'active' ? 'ON' : 'OFF'}
                      </span>
                    </td>
                    <td className="td">
                      <span className="font-mono text-xs text-info-400">{d.rssiThreshold || -85} dBm</span>
                    </td>
                    <td className="td text-xs text-slate-400">
                      {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '—'}
                    </td>
                    <td className="td text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(d)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400 transition-colors"><RiEditLine /></button>
                        <button onClick={() => handleDelete(d._id)} className="p-2 rounded-lg hover:bg-danger-500/10 text-danger-400 transition-colors"><RiDeleteBin6Line /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Register ESP32 Device' : 'Edit Device'} onClose={closeModal} onSubmit={handleSubmit}>
          <div><label className="label">Device ID</label>
            <input className="input" placeholder="e.g. ESP32-A101" value={form.deviceId}
              onChange={e => setForm({ ...form, deviceId: e.target.value })} required disabled={modal === 'edit'} /></div>
          <div><label className="label">IP Address</label>
            <input className="input" placeholder="e.g. 192.168.1.101" value={form.ipAddress}
              onChange={e => setForm({ ...form, ipAddress: e.target.value })} /></div>
          <div><label className="label">Assign to Classroom (Optional)</label>
            <select className="input" value={form.classroomId} onChange={e => setForm({ ...form, classroomId: e.target.value })}>
              <option value="">Unassigned</option>
              {classrooms.map(c => <option key={c._id} value={c._id}>{c.roomName} — {c.blockId?.blockName}</option>)}
            </select></div>
          <div><label className="label">RSSI Sensitivity (Lower = Less Sensitive)</label>
            <div className="flex items-center gap-3">
              <input type="range" min="-100" max="-40" step="1" className="flex-1 accent-primary-500" value={form.rssiThreshold}
                onChange={e => setForm({ ...form, rssiThreshold: parseInt(e.target.value) })} />
              <span className="font-mono text-white min-w-[60px] text-right">{form.rssiThreshold} dBm</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Recommended: -80 to -85. Use -70 for very close range only.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
