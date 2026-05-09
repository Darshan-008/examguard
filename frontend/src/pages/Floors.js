import React, { useEffect, useState } from 'react';
import { floorAPI, blockAPI } from '../services/api';
import toast from 'react-hot-toast';
import { RiAddLine, RiEditLine, RiDeleteBin6Line, RiStackLine } from 'react-icons/ri';

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

export default function Floors() {
  const [floors, setFloors] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ floorName: '', blockId: '' });

  const fetchData = async () => {
    try {
      const [f, b] = await Promise.all([floorAPI.getAll(), blockAPI.getAll()]);
      setFloors(f.data.data || []);
      setBlocks(b.data.data || []);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openAdd = () => { setForm({ floorName: '', blockId: '' }); setModal('add'); };
  const openEdit = (f) => { setSelected(f); setForm({ floorName: f.floorName, blockId: f.blockId?._id || '' }); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'add') { await floorAPI.create(form); toast.success('Floor created!'); }
      else { await floorAPI.update(selected._id, form); toast.success('Floor updated!'); }
      fetchData(); closeModal();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving floor'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this floor?')) return;
    try { await floorAPI.delete(id); toast.success('Floor deleted'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Floors</h2>
          <p className="text-slate-400 text-sm mt-1">{floors.length} floor(s) registered</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><RiAddLine />Add Floor</button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-8 text-center text-slate-500">Loading...</div>
        : floors.length === 0 ? (
          <div className="p-16 text-center">
            <RiStackLine size={48} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No floors yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr><th className="th">#</th><th className="th">Floor Name</th><th className="th">Block</th><th className="th">Created</th><th className="th text-right">Actions</th></tr>
            </thead>
            <tbody>
              {floors.map((f, i) => (
                <tr key={f._id} className="table-row">
                  <td className="td text-slate-500">{i + 1}</td>
                  <td className="td font-semibold text-white flex items-center gap-2">
                    <RiStackLine className="text-indigo-400" />{f.floorName}
                  </td>
                  <td className="td"><span className="badge-gray">{f.blockId?.blockName}</span></td>
                  <td className="td">{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td className="td text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(f)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400 transition-colors"><RiEditLine /></button>
                      <button onClick={() => handleDelete(f._id)} className="p-2 rounded-lg hover:bg-danger-500/10 text-danger-400 transition-colors"><RiDeleteBin6Line /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Floor' : 'Edit Floor'} onClose={closeModal} onSubmit={handleSubmit}>
          <div>
            <label className="label">Floor Name</label>
            <input className="input" placeholder="e.g. Floor 1" value={form.floorName}
              onChange={e => setForm({ ...form, floorName: e.target.value })} required />
          </div>
          <div>
            <label className="label">Block</label>
            <select className="input" value={form.blockId} onChange={e => setForm({ ...form, blockId: e.target.value })} required>
              <option value="">Select Block</option>
              {blocks.map(b => <option key={b._id} value={b._id}>{b.blockName}</option>)}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}
