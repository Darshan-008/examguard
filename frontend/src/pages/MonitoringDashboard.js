import React, { useEffect, useState, useRef, useCallback } from 'react';
import { classroomAPI, detectionAPI } from '../services/api';
import useSocket from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  RiCpuLine, RiWifiOffLine, RiAlarmWarningLine,
  RiShieldCheckLine, RiRefreshLine, RiHistoryLine, RiCloseLine,
  RiDeleteBin6Line, RiSignalWifiLine, RiTimeLine,
  RiRadarLine, RiShieldFlashLine, RiPulseLine,
} from 'react-icons/ri';
import { MdBluetooth, MdBluetoothSearching } from 'react-icons/md';

// ── Audio & Voice ────────────────────────────────────────────────────────────
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

const voiceAlert = (roomName) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(`Attention. Bluetooth device detected in ${roomName}`);
  u.rate = 0.9; u.pitch = 1;
  window.speechSynthesis.speak(u);
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const calcDistance = (rssi) => {
  if (!rssi) return null;
  const d = Math.pow(10, (-59 - rssi) / (10 * 2.5));
  return d.toFixed(1);
};

const rssiLevel = (rssi) => {
  if (!rssi) return { pct: 0, color: 'bg-slate-400 dark:bg-slate-600', label: 'N/A' };
  if (rssi >= -55) return { pct: 100, color: 'bg-emerald-500', label: 'Excellent' };
  if (rssi >= -65) return { pct: 75,  color: 'bg-green-400',   label: 'Good' };
  if (rssi >= -75) return { pct: 50,  color: 'bg-yellow-400',  label: 'Fair' };
  if (rssi >= -85) return { pct: 25,  color: 'bg-orange-400',  label: 'Weak' };
  return { pct: 10, color: 'bg-red-500', label: 'Poor' };
};

const categoryIcon = (category = '') => {
  const c = category.toLowerCase();
  if (c.includes('phone'))  return '📱';
  if (c.includes('watch'))  return '⌚';
  if (c.includes('audio'))  return '🎧';
  if (c.includes('computer') || c.includes('laptop')) return '💻';
  if (c.includes('wearable')) return '⌚';
  return '📡';
};

// ── Live Clock ───────────────────────────────────────────────────────────────
const LiveClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <span className="font-mono text-xs text-slate-600 dark:text-slate-500 tabular-nums">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
};

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ count, label, icon: Icon, colorClass, glowClass, pulse }) => (
  <div className={`relative glass p-5 overflow-hidden group hover:scale-[1.02] transition-all duration-300 cursor-default ${glowClass}`}>
    {/* Background glow blob */}
    <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 blur-xl ${colorClass.replace('text-','bg-')}`} />
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-4xl font-black tabular-nums ${colorClass} transition-all duration-500`}>
          {count}
        </p>
        <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 font-medium">{label}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colorClass.replace('text-','bg-').replace('-400','-500/15').replace('-300','-500/15')} border ${colorClass.replace('text-','border-').replace('-400','-500/20').replace('-300','-500/20')}`}>
        <Icon size={22} className={`${colorClass} ${pulse ? 'animate-pulse' : ''}`} />
      </div>
    </div>
    {pulse && count > 0 && (
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />
    )}
  </div>
);

// ── Classroom Card ───────────────────────────────────────────────────────────
const ClassroomCard = ({ room, onClearAlert, onViewLogs, onDeleteRoom, isAdmin }) => {
  const [hovered, setHovered] = useState(false);
  const device      = room.esp32DeviceId;
  const isInactive  = device?.monitoringStatus === 'inactive';
  const isOffline   = !device || device.status === 'offline';
  const isAlert     = room.alertStatus && !isOffline && !isInactive;
  const isSafe      = !isAlert && !isOffline && !isInactive;
  const isJammer    = device?.jammerStatus === 'active';
  const rssi        = room.lastDetectionRssi || null;
  const sig         = rssiLevel(isAlert ? rssi : null);
  const dist        = calcDistance(rssi);

  // Dynamic styles
  let cardBg, cardBorder, headerBg, dotColor;
  if (isAlert) {
    cardBg = 'bg-gradient-to-br from-red-50 dark:from-red-950/60 to-red-50 dark:to-red-900/20';
    cardBorder = 'border-red-500/50 shadow-lg shadow-red-500/10';
    headerBg = 'bg-red-500/10';
    dotColor = 'bg-red-500';
  } else if (isInactive) {
    cardBg = 'bg-slate-100 dark:bg-slate-900/50'; cardBorder = 'border-slate-300 dark:border-slate-700/30'; headerBg = 'bg-slate-50 dark:bg-white/3'; dotColor = 'bg-slate-400 dark:bg-slate-600';
  } else if (isOffline) {
    cardBg = 'bg-slate-50 dark:bg-slate-900/30'; cardBorder = 'border-slate-200 dark:border-slate-700/20'; headerBg = 'bg-slate-50 dark:bg-white/2'; dotColor = 'bg-slate-600 dark:bg-slate-500';
  } else {
    cardBg = 'bg-gradient-to-br from-emerald-50 dark:from-emerald-950/30 to-slate-100 dark:to-slate-900/50';
    cardBorder = 'border-emerald-500/25 shadow-sm shadow-emerald-500/5';
    headerBg = 'bg-emerald-500/5';
    dotColor = 'bg-emerald-400';
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border transition-all duration-400 overflow-hidden ${cardBg} ${cardBorder} ${isAlert ? 'alert-card' : ''} ${hovered ? 'scale-[1.015] shadow-xl' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Alert ripple top bar */}
      {isAlert && (
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse" />
      )}

      {/* Card header */}
      <div className={`flex items-start justify-between px-4 pt-4 pb-3 ${headerBg}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor} ${isAlert ? 'animate-pulse shadow-lg shadow-red-500/60' : ''}`} />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">{room.roomName}</h3>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-500 mt-0.5 ml-4 truncate">
            {room.blockId?.blockName} › {room.floorId?.floorName}
          </p>
        </div>
        {/* Status icon top-right */}
        <div className={`flex-shrink-0 ml-2 w-8 h-8 rounded-xl flex items-center justify-center ${
          isAlert   ? 'bg-red-500/20 text-red-400' :
          isOffline ? 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-500' :
          isSafe    ? 'bg-emerald-500/15 text-emerald-400' :
                      'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-500'
        }`}>
          {isAlert   ? <MdBluetoothSearching size={16} className="animate-pulse" /> :
           isOffline ? <RiWifiOffLine size={14} /> :
                       <RiShieldCheckLine size={14} />}
        </div>
      </div>

      {/* Status badges row */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {/* Connection */}
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
          isOffline
            ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-500'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <RiCpuLine size={9} />
          {isOffline ? 'Offline' : 'Online'}
        </span>

        {/* Alert / Safe / Inactive */}
        {isInactive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/40 text-slate-600 dark:text-slate-500">
            Inactive
          </span>
        ) : isAlert ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/15 border-red-500/30 text-red-400 dark:text-red-300 animate-pulse">
            <MdBluetooth size={9} /> BT Detected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
            <RiShieldCheckLine size={9} /> Safe
          </span>
        )}

        {/* Jammer */}
        {isJammer ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-yellow-500/10 border-yellow-500/25 text-yellow-500 dark:text-yellow-400">
            <RiShieldFlashLine size={9} /> Jammer ON
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/8 text-slate-500 dark:text-slate-600">
            Jammer OFF
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-slate-200 dark:border-white/5" />

      {/* Info grid */}
      <div className="px-4 py-3 space-y-2 flex-1">
        {/* ESP32 ID */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-600 dark:text-slate-500 flex items-center gap-1"><RiCpuLine size={10} />ESP32</span>
          <span className="text-[11px] font-mono text-slate-700 dark:text-slate-300">{device?.deviceId || '—'}</span>
        </div>

        {/* Last Detection */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-600 dark:text-slate-500 flex items-center gap-1"><RiTimeLine size={10} />Last Hit</span>
          <span className="text-[11px] text-slate-700 dark:text-slate-300">
            {room.lastDetectionTime ? new Date(room.lastDetectionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </span>
        </div>

        {/* Total detections */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-600 dark:text-slate-500 flex items-center gap-1"><RiPulseLine size={10} />Detections</span>
          <span className={`text-[11px] font-bold tabular-nums ${room.totalDetections > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-500'}`}>
            {room.totalDetections || 0}
          </span>
        </div>

        {/* Alert details — only when alert active */}
        {isAlert && room.lastDetectionMac && (
          <div className="mt-2 rounded-xl bg-red-500/8 border border-red-500/20 p-2.5 space-y-2">
            {/* MAC */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-red-500 dark:text-red-400 font-bold uppercase tracking-wider">MAC</span>
              <span className="font-mono text-[11px] text-slate-900 dark:text-white font-bold tracking-wider">{room.lastDetectionMac}</span>
            </div>
            {room.isRandomized && (
              <div className="flex items-center gap-1 text-[9px] text-yellow-500 dark:text-yellow-400 font-bold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                Randomized Private MAC
              </div>
            )}
            {/* RSSI signal bar */}
            {rssi && (
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-slate-600 dark:text-slate-500 flex items-center gap-1"><RiSignalWifiLine size={9} />Signal</span>
                  <span className={`text-[10px] font-bold ${sig.color.replace('bg-','text-')}`}>{rssi} dBm · {sig.label}</span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-white/8 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${sig.color}`}
                    style={{ width: `${sig.pct}%` }}
                  />
                </div>
                {dist && (
                  <p className="text-[9px] text-slate-600 dark:text-slate-500 text-right">≈ {dist}m away</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-2 space-y-2">
        {/* View Logs */}
        <button
          onClick={() => onViewLogs(room)}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs border border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/15 transition-all duration-200 group"
        >
          <RiHistoryLine size={13} className="group-hover:rotate-12 transition-transform" />
          Detection History
        </button>

        {/* Clear Alert */}
        {isAlert && (
          <button
            onClick={() => onClearAlert(room._id)}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold transition-all duration-200 shadow-lg shadow-red-600/30 hover:shadow-red-500/40 hover:scale-[1.02]"
          >
            <RiAlarmWarningLine size={13} />
            Clear Alert
          </button>
        )}

        {/* Admin Delete */}
        {isAdmin && (
          <button
            onClick={() => onDeleteRoom(room)}
            className="flex items-center justify-center gap-2 w-full py-1.5 rounded-xl text-slate-600 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 text-[10px] hover:bg-red-500/8 border border-transparent hover:border-red-500/20 transition-all duration-200 group"
          >
            <RiDeleteBin6Line size={11} className="group-hover:scale-110 transition-transform" />
            Remove Room
          </button>
        )}
      </div>
    </div>
  );
};

// ── Delete Confirm Modal ─────────────────────────────────────────────────────
const DeleteConfirmModal = ({ room, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
    <div className="glass-strong w-full max-w-sm shadow-2xl animate-fade-in border border-red-500/20 rounded-2xl overflow-hidden bg-white dark:bg-transparent">
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent" />
      <div className="p-6 text-center space-y-4">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <RiDeleteBin6Line size={28} className="text-red-500 dark:text-red-400" />
          </div>
        </div>
        <div>
          <h3 className="text-slate-900 dark:text-white font-bold text-lg">Remove Room?</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Permanently delete</p>
          <p className="text-slate-900 dark:text-white font-semibold text-base mt-0.5 px-4 py-1 rounded-lg bg-slate-100 dark:bg-white/5 inline-block">"{room.roomName}"</p>
          <p className="text-slate-500 dark:text-slate-600 text-xs mt-2">This removes it from monitoring everywhere.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-sm border border-slate-200 dark:border-white/10 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Removing...</>
              : <><RiDeleteBin6Line size={14} />Yes, Remove</>}
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ── Detection Log Modal ───────────────────────────────────────────────────────
const LogModal = ({ room, logs, loading, onClose }) => {
  const isAlert = room.alertStatus;
  return (
    <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="glass-strong bg-white dark:bg-transparent w-full max-w-2xl h-[90vh] sm:h-[82vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden border-slate-200 dark:border-white/15 rounded-t-3xl sm:rounded-2xl">

        {/* Colored top bar */}
        <div className={`h-1 w-full ${isAlert ? 'bg-gradient-to-r from-red-500 via-orange-400 to-red-500 animate-pulse' : 'bg-gradient-to-r from-primary-600 to-indigo-500'}`} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAlert ? 'bg-red-500/15 text-red-500 dark:text-red-400' : 'bg-primary-500/15 text-primary-500 dark:text-primary-400'}`}>
              <MdBluetooth size={20} />
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white font-bold text-base leading-tight">{room.roomName}</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-500">{room.blockId?.blockName} › {room.floorId?.floorName} · ESP32: {room.esp32DeviceId?.deviceId || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAlert && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">LIVE ALERT</span>}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
              <RiCloseLine className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" size={20} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-white/5 border-b border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-black/20 flex-shrink-0">
          {[
            { label: 'Total Detections', value: room.totalDetections || logs.length, color: room.totalDetections > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-400' },
            { label: 'Last Detection', value: room.lastDetectionTime ? new Date(room.lastDetectionTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', color: 'text-slate-700 dark:text-slate-300' },
            { label: 'Status', value: isAlert ? '🔴 Alert' : '🟢 Safe', color: isAlert ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className={`text-sm font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-600 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Log list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-500">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading detection history…</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-600">
              <RiRadarLine size={48} className="opacity-20" />
              <p className="text-sm">No detections recorded for this room</p>
            </div>
          ) : logs.map((log, i) => {
            const sig2 = rssiLevel(log.rssi);
            const d2   = calcDistance(log.rssi);
            return (
              <div key={log._id || i}
                className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/4 border border-slate-200 dark:border-white/6 hover:border-slate-300 dark:hover:border-white/12 hover:bg-slate-100 dark:hover:bg-white/6 transition-all duration-200 group">
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 dark:text-red-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                  <span className="text-lg">{categoryIcon(log.category)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {/* MAC + time */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <p className="font-mono text-sm text-slate-900 dark:text-white font-bold tracking-wide">{log.macAddress?.toUpperCase()}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {log.isRandomized && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 dark:text-yellow-400 border border-yellow-500/20 font-bold">PRIVATE MAC</span>
                        )}
                        <span className="text-[10px] text-slate-600 dark:text-slate-500">{log.category || 'Unknown Device'}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-600">·</span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-500">{log.deviceName || 'Unknown'}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-600 flex-shrink-0">{new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </div>

                  {/* Signal bar */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] text-slate-500 dark:text-slate-600">Signal: {log.rssi} dBm</span>
                        <span className={`text-[9px] font-bold ${sig2.color.replace('bg-','text-')}`}>{sig2.label}</span>
                      </div>
                      <div className="h-1 bg-slate-100 dark:bg-white/6 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sig2.color} transition-all`} style={{ width: `${sig2.pct}%` }} />
                      </div>
                    </div>
                    {d2 && (
                      <span className="text-[10px] text-primary-500 dark:text-primary-400 font-semibold flex-shrink-0">≈ {d2}m</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/2 flex justify-between items-center flex-shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-600">{logs.length} record{logs.length !== 1 ? 's' : ''} shown</p>
          <button onClick={onClose} className="btn-ghost px-5 py-2 text-sm text-slate-700 dark:text-slate-300">Close</button>
        </div>
      </div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function MonitoringDashboard() {
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [ticker, setTicker]         = useState([]); // recent events

  const { isAdmin }               = useAuth();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomLogs, setRoomLogs]         = useState([]);
  const [logsLoading, setLogsLoading]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { on, off, emit, connected } = useSocket();
  const audioEnabled = useRef(true);
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem('voiceAlertsEnabled') !== 'false');

  const toggleVoice = () => setVoiceEnabled(prev => {
    localStorage.setItem('voiceAlertsEnabled', !prev); return !prev;
  });

  const fetchClassrooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await classroomAPI.getAll();
      setClassrooms(res.data.data || []);
    } catch { toast.error('Failed to load classrooms'); }
    finally { setLoading(false); }
  }, []);

  const handleViewLogs = async (room) => {
    setSelectedRoom(room); setLogsLoading(true); setRoomLogs([]);
    try {
      const res = await detectionAPI.getLogs({ classroomId: room._id, limit: 50 });
      setRoomLogs(res.data.data || []);
    } catch { toast.error('Failed to fetch room history'); }
    finally { setLogsLoading(false); }
  };

  const addTicker = (event) => {
    setTicker(prev => [event, ...prev].slice(0, 6));
  };

  useEffect(() => {
    fetchClassrooms();

    const alertHandler = (data) => {
      if (audioEnabled.current) alertSound();
      if (voiceEnabled) voiceAlert(data.log?.classroomId?.roomName || 'Classroom');

      toast.error(
        `🔵 ALERT — ${data.log?.classroomId?.roomName || 'Unknown'}\nMAC: ${data.macAddress?.toUpperCase()}`,
        { duration: 8000, id: `alert-${data.classroomId}` }
      );

      addTicker({ type: 'alert', room: data.log?.classroomId?.roomName, mac: data.macAddress, time: new Date() });

      setClassrooms(prev => prev.map(r => r._id === data.classroomId
        ? { ...r, alertStatus: true, lastDetectionTime: data.timestamp, lastDetectionMac: data.macAddress?.toUpperCase(), isRandomized: data.log?.isRandomized, lastDetectionRssi: data.rssi, totalDetections: (r.totalDetections || 0) + 1 }
        : r));

      setSelectedRoom(prev => {
        if (prev?._id === data.classroomId) setRoomLogs(logs => [data.log, ...logs]);
        return prev;
      });
    };

    const clearHandler = ({ classroomId }) => {
      setClassrooms(prev => prev.map(r => r._id === classroomId ? { ...r, alertStatus: false, totalDetections: 0 } : r));
      addTicker({ type: 'clear', classroomId, time: new Date() });
    };

    const deviceHandler = ({ deviceId, status }) => {
      setClassrooms(prev => prev.map(r =>
        r.esp32DeviceId?._id === deviceId ? { ...r, esp32DeviceId: { ...r.esp32DeviceId, status } } : r));
    };

    const deviceUpdateHandler = ({ deviceId, monitoringStatus, jammerStatus }) => {
      setClassrooms(prev => prev.map(r =>
        r.esp32DeviceId?._id === deviceId
          ? { ...r, esp32DeviceId: { ...r.esp32DeviceId, monitoringStatus, jammerStatus: jammerStatus || r.esp32DeviceId.jammerStatus } }
          : r));
    };

    const infraHandler = ({ type, action, data: item, id }) => {
      if (type !== 'classroom') return;
      if (action === 'delete') {
        setClassrooms(prev => prev.filter(r => r._id !== id));
        setSelectedRoom(prev => prev?._id === id ? null : prev);
      } else if (action === 'create' && item) {
        setClassrooms(prev => [...prev, item]);
      } else if (action === 'update' && item) {
        setClassrooms(prev => prev.map(r => r._id === item._id ? { ...r, ...item } : r));
      }
    };

    on('bluetoothAlert', alertHandler);
    on('alertCleared', clearHandler);
    on('deviceStatus', deviceHandler);
    on('deviceUpdate', deviceUpdateHandler);
    on('infrastructureUpdate', infraHandler);
    return () => {
      off('bluetoothAlert', alertHandler);
      off('alertCleared', clearHandler);
      off('deviceStatus', deviceHandler);
      off('deviceUpdate', deviceUpdateHandler);
      off('infrastructureUpdate', infraHandler);
    };
  }, [fetchClassrooms, on, off, voiceEnabled]);

  const handleClearAlert = (classroomId) => emit('clearAlert', { classroomId });

  const handleDeleteRoom = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await classroomAPI.delete(deleteTarget._id);
      toast.success(`"${deleteTarget.roomName}" removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete room');
    } finally { setDeleteLoading(false); }
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
    <div className="space-y-5 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Live Monitoring</h2>
            {alertCount > 0 && (
              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse shadow-lg shadow-red-500/40">
                {alertCount} ALERT{alertCount > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-600 dark:text-slate-500 text-xs">Real-time Bluetooth surveillance</p>
            <LiveClock />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Connection pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${
            connected
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-500 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/25 text-red-500 dark:text-red-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-red-500 dark:bg-red-400'}`} />
            {connected ? 'Live' : 'Offline'}
          </div>

          {/* Voice toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider">Voice</span>
            <button onClick={toggleVoice}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 focus:outline-none ${voiceEnabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-300 ${voiceEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Refresh */}
          <button onClick={fetchClassrooms} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs transition-all disabled:opacity-50 hover:bg-slate-200 dark:hover:bg-white/10">
            <RiRefreshLine size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{loading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard count={alertCount}   label="Active Alerts"   icon={RiAlarmWarningLine} colorClass="text-red-500 dark:text-red-400"     glowClass="border-red-500/15"     pulse={alertCount > 0} />
        <StatCard count={safeCount}    label="Safe Rooms"      icon={RiShieldCheckLine}  colorClass="text-emerald-500 dark:text-emerald-400" glowClass="border-emerald-500/15" pulse={false} />
        <StatCard count={offlineCount} label="Offline Devices" icon={RiWifiOffLine}      colorClass="text-slate-600 dark:text-slate-400"   glowClass="border-slate-300 dark:border-slate-600/15"   pulse={false} />
      </div>

      {/* ── Live Event Ticker ── */}
      {ticker.length > 0 && (
        <div className="glass rounded-2xl border border-slate-200 dark:border-white/8 px-4 py-3 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest">Live Feed</span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar flex-1">
              {ticker.map((e, i) => (
                <div key={i} className={`flex-shrink-0 flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${
                  e.type === 'alert'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400 dark:text-red-300'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400'
                }`}>
                  <span>{e.type === 'alert' ? '🔵' : '✅'}</span>
                  <span className="font-semibold">{e.type === 'alert' ? e.room : 'Alert Cleared'}</span>
                  {e.type === 'alert' && <span className="font-mono opacity-70">{e.mac?.slice(-5)}</span>}
                  <span className="opacity-50">{e.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 flex-wrap items-center">
        {[
          { val: 'all',     label: 'All Rooms',    count: classrooms.length },
          { val: 'alert',   label: '🔴 Alerts',    count: alertCount },
          { val: 'safe',    label: '🟢 Safe',       count: safeCount },
          { val: 'offline', label: '⚫ Offline',    count: offlineCount },
        ].map(({ val, label, count }) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
              filter === val
                ? 'bg-primary-600/20 border-primary-500/40 text-primary-600 dark:text-primary-300 shadow-sm shadow-primary-500/10'
                : 'bg-slate-50 dark:bg-white/4 border-slate-200 dark:border-white/8 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/8'
            }`}>
            {label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              filter === val ? 'bg-primary-500/30 text-primary-600 dark:text-primary-200' : 'bg-slate-200 dark:bg-white/8 text-slate-500 dark:text-slate-600'
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── Classroom Grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3 p-5 h-56 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-white/8 rounded-xl mb-2 w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-xl mb-5 w-1/2" />
              <div className="flex gap-1.5 mb-4">
                <div className="h-5 w-12 bg-slate-100 dark:bg-white/5 rounded-full" />
                <div className="h-5 w-14 bg-slate-100 dark:bg-white/5 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-xl" />
                <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-xl w-4/5" />
                <div className="h-3 bg-slate-100 dark:bg-white/5 rounded-xl w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <RiRadarLine size={52} className="mx-auto mb-4 text-slate-400 dark:text-slate-700" />
          <p className="text-slate-600 dark:text-slate-500 font-medium">No rooms match this filter</p>
          <button onClick={() => setFilter('all')} className="mt-3 text-primary-500 dark:text-primary-400 text-sm hover:underline">Show all rooms</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(room => (
            <ClassroomCard
              key={room._id}
              room={room}
              onClearAlert={handleClearAlert}
              onViewLogs={handleViewLogs}
              onDeleteRoom={setDeleteTarget}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* ── Log History Modal ── */}
      {selectedRoom && (
        <LogModal
          room={selectedRoom}
          logs={roomLogs}
          loading={logsLoading}
          onClose={() => setSelectedRoom(null)}
        />
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <DeleteConfirmModal
          room={deleteTarget}
          loading={deleteLoading}
          onConfirm={handleDeleteRoom}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
