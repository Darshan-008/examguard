import React, { useEffect, useState } from 'react';
import { blockAPI } from '../services/api';
import toast from 'react-hot-toast';
import { RiAddLine, RiEditLine, RiDeleteBin6Line, RiBuilding2Line } from 'react-icons/ri';

const Modal = ({ title, onClose, onSubmit, children }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="glass-strong w-full max-w-md shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h3 className="text-white font-semibold">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-xl">×</button>
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

export default function Blocks() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ blockName: '' });

  const fetchBlocks = async () => {
    try { const r = await blockAPI.getAll(); setBlocks(r.data.data || []); }
    catch { toast.error('Failed to load blocks'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBlocks(); }, []);

  const openAdd  = () => { setForm({ blockName: '' }); setModal('add'); };
  const openEdit = (b) => { setSelected(b); setForm({ blockName: b.blockName }); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'add') { await blockAPI.create(form); toast.success('Block created!'); }
      else { await blockAPI.update(selected._id, form); toast.success('Block updated!'); }
      fetchBlocks(); closeModal();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving block'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this block?')) return;
    try { await blockAPI.delete(id); toast.success('Block deleted'); fetchBlocks(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Blocks</h2>
          <p className="text-slate-400 text-sm mt-1">{blocks.length} block(s) registered</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><RiAddLine />Add Block</button>
      </div>

      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : blocks.length === 0 ? (
          <div className="p-16 text-center">
            <RiBuilding2Line size={48} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No blocks yet. Add your first block.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr><th className="th">#</th><th className="th">Block Name</th><th className="th">Created</th><th className="th text-right">Actions</th></tr>
            </thead>
            <tbody>
              {blocks.map((b, i) => (
                <tr key={b._id} className="table-row">
                  <td className="td text-slate-500">{i + 1}</td>
                  <td className="td font-semibold text-white flex items-center gap-2">
                    <RiBuilding2Line className="text-primary-400" />{b.blockName}
                  </td>
                  <td className="td">{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td className="td text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(b)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400 transition-colors"><RiEditLine /></button>
                      <button onClick={() => handleDelete(b._id)} className="p-2 rounded-lg hover:bg-danger-500/10 text-danger-400 transition-colors"><RiDeleteBin6Line /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Block' : 'Edit Block'} onClose={closeModal} onSubmit={handleSubmit}>
          <div>
            <label className="label">Block Name</label>
            <input className="input" placeholder="e.g. Block A" value={form.blockName}
              onChange={e => setForm({ blockName: e.target.value })} required />
          </div>
        </Modal>
      )}
    </div>
  );
}
