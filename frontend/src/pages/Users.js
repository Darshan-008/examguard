import React, { useEffect, useState } from 'react';
import { userAPI, authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { RiAddLine, RiEditLine, RiDeleteBin6Line, RiUserLine, RiShieldCheckLine } from 'react-icons/ri';

const Modal = ({ title, onClose, onSubmit, children }) => (
  <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="glass-strong w-full max-w-md shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
        <h3 className="text-slate-900 dark:text-white font-semibold">{title}</h3>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-xl">×</button>
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

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'examuser' });

  const fetchUsers = async () => {
    try { const r = await userAPI.getAll(); setUsers(r.data.data || []); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => { setForm({ name: '', email: '', password: '', role: 'examuser' }); setModal('add'); };
  const openEdit = (u) => { setSelected(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'add') { await authAPI.register(form); toast.success('User created!'); }
      else { await userAPI.update(selected._id, { name: form.name, role: form.role }); toast.success('User updated!'); }
      fetchUsers(); closeModal();
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving user'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try { await userAPI.delete(id); toast.success('User deleted'); fetchUsers(); }
    catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Users</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">{users.length} user(s) registered</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex-shrink-0"><RiAddLine /><span className="hidden sm:inline">Add User</span><span className="sm:hidden">Add</span></button>
      </div>
      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading...</div>
          : users.length === 0 ? (
            <div className="p-16 text-center">
              <RiUserLine size={48} className="mx-auto text-slate-400 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400">No users yet.</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-slate-200 dark:divide-white/5">
                {users.map(u => (
                  <div key={u._id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{u.name?.[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{u.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                      <div className="mt-1">{u.role === 'admin' ? <span className="badge-yellow"><RiShieldCheckLine size={10}/>Admin</span> : <span className="badge-gray"><RiUserLine size={10}/>Supervisor</span>}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/10 text-primary-600 dark:text-primary-400"><RiEditLine size={16}/></button>
                      <button onClick={() => handleDelete(u._id)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 text-danger-600 dark:text-danger-400"><RiDeleteBin6Line size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <table className="w-full hidden sm:table">
                <thead className="border-b border-slate-200 dark:border-white/10">
                  <tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Joined</th><th className="th text-right">Actions</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} className="table-row">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">{u.name?.[0]?.toUpperCase()}</div>
                          <span className="font-medium text-slate-900 dark:text-white">{u.name}</span>
                        </div>
                      </td>
                      <td className="td text-slate-500 dark:text-slate-400">{u.email}</td>
                      <td className="td">{u.role === 'admin' ? <span className="badge-yellow"><RiShieldCheckLine size={10}/>Admin</span> : <span className="badge-gray"><RiUserLine size={10}/>Supervisor</span>}</td>
                      <td className="td text-xs text-slate-500 dark:text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="td text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-500/10 text-primary-600 dark:text-primary-400 transition-colors"><RiEditLine /></button>
                          <button onClick={() => handleDelete(u._id)} className="p-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 text-danger-600 dark:text-danger-400 transition-colors"><RiDeleteBin6Line /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
      </div>
      {modal && (
        <Modal title={modal === 'add' ? 'Add User' : 'Edit User'} onClose={closeModal} onSubmit={handleSubmit}>
          <div><label className="label">Full Name</label><input className="input" placeholder="John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
          {modal === 'add' && <>
            <div><label className="label">Email</label><input type="email" className="input" placeholder="user@college.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label className="label">Password</label><input type="password" className="input" placeholder="Min 6 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></div>
          </>}
          <div><label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="examuser">Exam Supervisor</option>
              <option value="admin">Admin</option>
            </select></div>
        </Modal>
      )}
    </div>
  );
}
