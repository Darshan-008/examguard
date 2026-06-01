import React, { useEffect, useState, useCallback } from 'react';
import { blockAPI, floorAPI, classroomAPI, detectionAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { 
  RiBuilding2Line, RiStackLine, RiDoorOpenLine, 
  RiAddLine, RiEditLine, RiDeleteBin6Line,
  RiArrowRightSLine, RiArrowDownSLine 
} from 'react-icons/ri';
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

export default function Infrastructure() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // { 'block_id': true, 'floor_id': true }
  
  const [roomLogs, setRoomLogs] = useState({}); // { 'room_id': [logs] }
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Modal state
  const [modal, setModal] = useState(null); // 'block' | 'floor' | 'classroom'
  const [mode, setMode] = useState('add'); // 'add' | 'edit'
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

  // ── Real-time infrastructure updates (voice commands / other admin actions) ──
  useEffect(() => {
    const handleInfraUpdate = ({ type, action, data: item }) => {
      const typeLabel = type === 'block' ? 'Block' : type === 'floor' ? 'Floor' : 'Classroom';
      const itemName = item?.blockName || item?.floorName || item?.roomName || '';
      if (action === 'create') {
        toast.success(`🎙️ ${typeLabel} "${itemName}" added via voice!`, { duration: 3000 });
      } else if (action === 'update') {
        toast(`${typeLabel} "${itemName}" updated`, { icon: '✏️' });
      } else if (action === 'delete') {
        toast(`${typeLabel} deleted`, { icon: '🗑️' });
      }
      // Re-fetch to get fresh nested structure
      fetchInfrastructure();
    };

    on('infrastructureUpdate', handleInfraUpdate);
    return () => off('infrastructureUpdate', handleInfraUpdate);
  }, [on, off, fetchInfrastructure]);

  const toggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- ACTIONS ---

  const handleAddBlock = () => {
    setForm({ blockName: '' });
    setMode('add');
    setModal('block');
  };

  const handleEditBlock = (block) => {
    setSelected(block);
    setForm({ blockName: block.blockName });
    setMode('edit');
    setModal('block');
  };

  const handleAddFloor = (blockId) => {
    setForm({ floorName: '', blockId });
    setMode('add');
    setModal('floor');
  };

  const handleEditFloor = (floor) => {
    setSelected(floor);
    setForm({ floorName: floor.floorName, blockId: floor.blockId?._id });
    setMode('edit');
    setModal('floor');
  };

  const handleAddClassroom = (floorId, blockId) => {
    setForm({ roomName: '', floorId, blockId });
    setMode('add');
    setModal('classroom');
  };

  const handleEditClassroom = (room) => {
    setSelected(room);
    setForm({ 
      roomName: room.roomName, 
      floorId: room.floorId?._id, 
      blockId: room.blockId?._id,
      esp32DeviceId: room.esp32DeviceId?._id || ''
    });
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

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Campus Infrastructure</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Manage Blocks, Floors, and Classrooms</p>
        </div>
        <button onClick={handleAddBlock} className="btn-primary flex-shrink-0">
          <RiAddLine /><span className="hidden sm:inline">Add Block</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="space-y-4">
          {data.length === 0 ? (
            <div className="card text-center py-20 text-slate-500">No infrastructure data found. Start by adding a block.</div>
          ) : data.map(block => (
            <div key={block._id} className="glass overflow-hidden transition-all duration-300">
              {/* Block Header */}
              <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => toggle(block._id)}>
                  {expanded[block._id] ? <RiArrowDownSLine className="text-slate-500" /> : <RiArrowRightSLine className="text-slate-500" />}
                  <RiBuilding2Line className="text-primary-400" size={20} />
                  <span className="font-bold text-white text-lg group-hover:text-primary-300 transition-colors">{block.blockName}</span>
                  <span className="text-xs text-slate-500 ml-2 bg-white/5 px-2 py-0.5 rounded-full">{block.floors.length} Floors</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleAddFloor(block._id)} className="p-2 rounded-lg hover:bg-success-500/10 text-success-400 text-sm flex items-center gap-1">
                    <RiAddLine /> <span className="hidden sm:inline">Add Floor</span>
                  </button>
                  <button onClick={() => handleEditBlock(block)} className="p-2 rounded-lg hover:bg-primary-500/10 text-primary-400"><RiEditLine /></button>
                  <button onClick={() => handleDelete('block', block._id)} className="p-2 rounded-lg hover:bg-danger-500/10 text-danger-400"><RiDeleteBin6Line /></button>
                </div>
              </div>

              {/* Floors Container */}
              {expanded[block._id] && (
                <div className="p-4 space-y-3 bg-black/20">
                  {block.floors.length === 0 ? (
                    <p className="text-xs text-slate-600 italic ml-10">No floors added to this block.</p>
                  ) : block.floors.map(floor => (
                    <div key={floor._id} className="ml-6 border-l-2 border-white/5 pl-4">
                      {/* Floor Header */}
                      <div className="flex items-center justify-between py-2 group">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(floor._id)}>
                          {expanded[floor._id] ? <RiArrowDownSLine className="text-slate-500" size={14} /> : <RiArrowRightSLine className="text-slate-500" size={14} />}
                          <RiStackLine className="text-indigo-400" size={18} />
                          <span className="font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors">{floor.floorName}</span>
                          <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.2 rounded-full">{floor.classrooms.length} Rooms</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleAddClassroom(floor._id, block._id)} className="p-1.5 text-success-400 hover:bg-success-500/10 rounded-md text-xs flex items-center gap-1">
                            <RiAddLine /> Room
                          </button>
                          <button onClick={() => handleEditFloor(floor)} className="p-1.5 text-primary-400 hover:bg-primary-500/10 rounded-md"><RiEditLine size={14}/></button>
                          <button onClick={() => handleDelete('floor', floor._id)} className="p-1.5 text-danger-400 hover:bg-danger-500/10 rounded-md"><RiDeleteBin6Line size={14}/></button>
                        </div>
                      </div>

                      {/* Classrooms Container */}
                      {expanded[floor._id] && (
                        <div className="ml-8 mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {floor.classrooms.length === 0 ? (
                            <p className="text-xs text-slate-600 italic">No classrooms added.</p>
                          ) : floor.classrooms.map(room => (
                              <div key={room._id} className="flex flex-col bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all overflow-hidden">
                                <div className="flex items-center justify-between p-3">
                                  <div className="flex items-center gap-2 cursor-pointer group/room" onClick={() => {
                                    toggle(room._id);
                                    if (!expanded[room._id]) {
                                      // Fetch logs when expanding
                                      setLogsLoading(true);
                                      detectionAPI.getLogs({ classroomId: room._id, limit: 10 })
                                        .then(res => setRoomLogs(prev => ({ ...prev, [room._id]: res.data.data })))
                                        .finally(() => setLogsLoading(false));
                                    }
                                  }}>
                                    {expanded[room._id] ? <RiArrowDownSLine className="text-slate-500" size={12} /> : <RiArrowRightSLine className="text-slate-500" size={12} />}
                                    <RiDoorOpenLine className="text-purple-400" />
                                    <div>
                                      <p className="text-sm font-medium text-white group-hover/room:text-purple-300 transition-colors">{room.roomName}</p>
                                      <p className="text-[10px] text-slate-500 uppercase">{room.esp32DeviceId?.deviceId || 'No Device'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditClassroom(room)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-md"><RiEditLine size={14}/></button>
                                    <button onClick={() => handleDelete('classroom', room._id)} className="p-1.5 text-slate-400 hover:text-danger-400 hover:bg-danger-500/10 rounded-md"><RiDeleteBin6Line size={14}/></button>
                                  </div>
                                </div>

                                {/* Room Logs (Inline) */}
                                {expanded[room._id] && (
                                  <div className="px-3 pb-3 border-t border-white/5 bg-black/20 animate-fade-in">
                                    <div className="mt-2 space-y-1.5">
                                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <MdBluetooth /> Recent Detections
                                      </p>
                                      {logsLoading && !roomLogs[room._id] ? (
                                        <div className="py-2 text-[10px] text-slate-600 animate-pulse">Loading logs...</div>
                                      ) : !roomLogs[room._id] || roomLogs[room._id].length === 0 ? (
                                        <p className="text-[10px] text-slate-600 italic">No recent detections.</p>
                                      ) : (
                                        <div className="space-y-1">
                                          {roomLogs[room._id].map((log, i) => (
                                            <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-white/5 last:border-0">
                                              <span className="font-mono text-slate-300">{log.macAddress}</span>
                                              <div className="flex items-center gap-2">
                                                <span className="text-warning-500/80">{log.rssi} dBm</span>
                                                <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
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
            </div>
          ))}
        </div>
      )}

      {/* MODALS */}
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
            <p className="text-[10px] text-slate-500 mt-2">Go to ESP32 Devices to link hardware to this room.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
