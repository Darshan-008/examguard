import React, { useEffect, useState } from 'react';
import { classroomAPI, blockAPI, floorAPI, deviceAPI } from '../services/api';
import toast from 'react-hot-toast';
import { RiAddLine, RiEditLine, RiDeleteBin6Line, RiDoorOpenLine } from 'react-icons/ri';
import { MdBluetooth } from 'react-icons/md';

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

export default function Classrooms() {
  const [classrooms, setClassrooms] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [floors, setFloors] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ roomName: '', blockId: '', floorId: '', esp32DeviceId: '' });

  const fetchAll = async () => {
    try {
      const [c, b, f, d] = await Promise.all([classroomAPI.getAll(), blockAPI.getAll(), floorAPI.getAll(), deviceAPI.getAll()]);
      setClassrooms(c.data.data || []);
      setBlocks(b.data.data || []);
      setFloors(f.data.data || []);
      setDevices(d.data.data || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredFloors = floors.filter(f => !form.blockId || f.blockId?._id === form.blockId);

  const openAdd = () => { setForm({ roomName: '', blockId: '', floorId: '', esp32DeviceId: '' }); setModal('add'); };
  const openEdit = (c) => {
    setSelected(c);
    setForm({ roomName: c.roomName, blockId: c.blockId?._id || '', floorId: c.floorId?._id || '', esp32DeviceId: c.esp32DeviceId?._id || '' });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, esp32DeviceId: form.esp32DeviceId || null };
    try {
      if (modal === 'add') { await classroomAPI.create(payload); toast.success('Classroom created!'); }
      else { await classroomAPI.update(selected._id, payload); toast.success('Classroom updated!'); }
      fetchAll(); closeModal();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving classroom'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this classroom?')) return;
    try { await classroomAPI.delete(id); toast.success('Classroom deleted'); fetchAll(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Classrooms</h2>
          <p className="text-slate-400 text-sm mt-1">{classrooms.length} classroom(s) registered</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><RiAddLine />Add Classroom</button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-8 text-center text-slate-500">Loading...</div>
        : classrooms.length === 0 ? (
          <div className="p-16 text-center">
            <RiDoorOpenLine size={48} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No classrooms yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="th">Room</th><th className="th">Block</th><th className="th">Floor</th>
                  <th className="th">ESP32</th><th className="th">Detections</th><th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classrooms.map(c => (
                  <tr key={c._id} className="table-row">
                    <td className="td font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <RiDoorOpenLine className="text-purple-400 flex-shrink-0"/>
                        {c.roomName}
                      </div>
                    </td>
                    <td className="td"><span className="badge-gray">{c.blockId?.blockName}</span></td>
                    <td className="td">{c.floorId?.floorName}</td>
                    <td className="td font-mono text-xs">{c.esp32DeviceId?.deviceId || '—'}</td>
                    <td className="td">
                      {c.totalDetections > 0
                        ? <span className="badge-red"><MdBluetooth size={10}/>{c.totalDetections}</span>
                        : <span className="text-slate-500">0</span>}
                    </td>
                    <td className="td">
                      {c.alertStatus ? <span className="badge-red">Alert</span> : <span className="badge-green">Safe</span>}
                    </td>
                    <td className="td text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400 transition-colors"><RiEditLine /></button>
                        <button onClick={() => handleDelete(c._id)} className="p-2 rounded-lg hover:bg-danger-500/10 text-danger-400 transition-colors"><RiDeleteBin6Line /></button>
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
        <Modal title={modal === 'add' ? 'Add Classroom' : 'Edit Classroom'} onClose={closeModal} onSubmit={handleSubmit}>
          <div><label className="label">Room Name</label>
            <input className="input" placeholder="e.g. Room 101" value={form.roomName}
              onChange={e => setForm({ ...form, roomName: e.target.value })} required /></div>
          <div><label className="label">Block</label>
            <select className="input" value={form.blockId} onChange={e => setForm({ ...form, blockId: e.target.value, floorId: '' })} required>
              <option value="">Select Block</option>
              {blocks.map(b => <option key={b._id} value={b._id}>{b.blockName}</option>)}
            </select></div>
          <div><label className="label">Floor</label>
            <select className="input" value={form.floorId} onChange={e => setForm({ ...form, floorId: e.target.value })} required>
              <option value="">Select Floor</option>
              {filteredFloors.map(f => <option key={f._id} value={f._id}>{f.floorName}</option>)}
            </select></div>
          <div><label className="label">ESP32 Device (Optional)</label>
            <select className="input" value={form.esp32DeviceId} onChange={e => setForm({ ...form, esp32DeviceId: e.target.value })}>
              <option value="">None</option>
              {devices.map(d => <option key={d._id} value={d._id}>{d.deviceId} — {d.ipAddress}</option>)}
            </select></div>
        </Modal>
      )}
    </div>
  );
}
