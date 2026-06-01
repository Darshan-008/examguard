import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { RiMicLine, RiCloseLine, RiVolumeUpLine } from 'react-icons/ri';

// ─── Speech Recognition ──────────────────────────────────────────────────────
const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition ||
  window.mozSpeechRecognition ||
  window.msSpeechRecognition ||
  null;

// ─── Navigation Fast-Path ─────────────────────────────────────────────────────
const NAV_COMMANDS = [
  { pattern: /\b(dashboard|home)\b/i,                           route: '/dashboard',      label: 'Dashboard' },
  { pattern: /\b(infrastructure|campus|map|block|floor)\b/i,   route: '/infrastructure', label: 'Infrastructure' },
  { pattern: /\b(devices?|esp32)\b/i,                           route: '/devices',        label: 'ESP32 Devices' },
  { pattern: /\b(logs?|alerts?|detections?)\b/i,                route: '/logs',           label: 'Detection Logs' },
  { pattern: /\b(monitor(?:ing|e)?|live\s*monitor)\b/i,        route: '/monitoring',     label: 'Monitoring' },
  { pattern: /\b(users?|user\s*management)\b/i,                 route: '/users',          label: 'Users' },
  { pattern: /\b(reports?|analytics|statistics)\b/i,            route: '/reports',        label: 'Reports' },
];

const ACTION_KEYWORDS = /\b(on|off|enable|disable|start|stop|add|create|new|register|turn|toggle|jammer|delete|remove)\b/i;
const isLogoutCommand = (t) => /\b(log\s*out|sign\s*out|sign\s*off)\b/i.test(t);
const isWakeOnly     = (t) => /^\s*(hey\s+examguard|examguard)\s*$/i.test(t);
const stripWakeWord  = (t) => t.replace(/^\s*(hey\s+examguard|examguard)\b\s*/i, '').trim();

function getLocalNavRoute(text) {
  if (ACTION_KEYWORDS.test(text)) return null; // let backend handle actions
  return NAV_COMMANDS.find((c) => c.pattern.test(text)) || null;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function VoiceControl() {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  const [listening,      setListening]      = useState(false);
  const [statusMessage,  setStatusMessage]  = useState('Voice assistant ready');
  const [recognizedText, setRecognizedText] = useState('');
  const [lastCommand,    setLastCommand]    = useState('');
  const [pulse,          setPulse]          = useState(false);

  // ── Stable refs (never stale in callbacks) ───────────────────────────────
  const recognitionRef        = useRef(null);
  const listeningRef          = useRef(false);
  const recognitionStartedRef = useRef(false);
  const processingRef         = useRef(false);
  const speakingRef           = useRef(false);       // true while TTS is playing
  const awaitingConfirmRef    = useRef(false);       // stores pending command string or false
  const pendingRestartRef     = useRef(false);       // restart queued while speaking/processing

  // Stable function refs – updated every render so callbacks never go stale
  const navigateRef = useRef(navigate);
  const logoutRef   = useRef(logout);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);
  useEffect(() => { logoutRef.current   = logout;   }, [logout]);

  // ─── Core: start recognition ────────────────────────────────────────────
  const startRecognition = useCallback(() => {
    if (
      !listeningRef.current ||
      !recognitionRef.current ||
      recognitionStartedRef.current ||
      speakingRef.current ||          // don't mic-up while TTS is playing
      processingRef.current
    ) return;

    try {
      recognitionRef.current.start();
    } catch (_) {
      // Already started – safe to ignore
    }
  }, []);

  // ─── Core: speak text, then restart mic ─────────────────────────────────
  //    ALWAYS stops recognition first so TTS audio doesn't feed back into mic.
  const speak = useCallback((text, afterSpeak) => {
    if (!text) {
      afterSpeak?.();
      return;
    }

    // Stop recognition so TTS doesn't feed back into the mic
    if (recognitionRef.current && recognitionStartedRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }

    window.speechSynthesis?.cancel();
    speakingRef.current = true;

    const utterance      = new SpeechSynthesisUtterance(text);
    utterance.lang       = 'en-US';
    utterance.rate       = 1.05;
    utterance.pitch      = 1.0;
    utterance.volume     = 1.0;

    utterance.onend = () => {
      speakingRef.current = false;
      afterSpeak?.();
      // Restart mic after TTS finishes (only if still in listening mode)
      if (listeningRef.current && !processingRef.current) {
        setTimeout(() => startRecognition(), 350);
      }
    };

    utterance.onerror = () => {
      speakingRef.current = false;
      afterSpeak?.();
      if (listeningRef.current && !processingRef.current) {
        setTimeout(() => startRecognition(), 350);
      }
    };

    window.speechSynthesis?.speak(utterance);
  }, [startRecognition]);

  // ─── Process a single command ────────────────────────────────────────────
  const processCommand = useCallback(async (commandText) => {
    const lower = commandText.toLowerCase();
    setStatusMessage('Processing...');
    setPulse(true);
    setTimeout(() => setPulse(false), 700);

    // LOGOUT
    if (isLogoutCommand(lower)) {
      speak('Logging you out. Goodbye!', () => {
        logoutRef.current?.();
        navigateRef.current?.('/login');
      });
      return;
    }

    // FAST-PATH NAVIGATION (no backend call)
    const navMatch = getLocalNavRoute(lower);
    if (navMatch) {
      navigateRef.current?.(navMatch.route);
      setStatusMessage(`Opened ${navMatch.label}`);
      speak(`Opening ${navMatch.label}`);
      return;
    }

    // BACKEND
    try {
      const response = await api.post('/voice/process', { text: commandText });
      const data = response.data;

      if (data.needsConfirmation) {
        awaitingConfirmRef.current = commandText;
        setStatusMessage('Awaiting confirmation...');
        speak(`${data.message} Say yes to confirm or no to cancel.`);
        return;
      }

      setLastCommand(commandText);
      setStatusMessage(data.message || (data.success ? 'Done' : 'Command not understood'));

      if (data.success) {
        speak(data.message || 'Done', () => {
          if (data.route) navigateRef.current?.(data.route);
        });
      } else {
        speak(data.message || "I couldn't do that. Please try again.");
      }
    } catch (err) {
      console.error('[VoiceControl]', err);
      setStatusMessage('Command failed');
      speak('There was a problem. Please try again.');
    }
  }, [speak]);

  // ─── Handle yes/no confirmation ─────────────────────────────────────────
  const handleConfirmation = useCallback(async (text, pendingCommand) => {
    const lower = text.toLowerCase();
    if (/\b(yes|confirm|ok|okay|sure|proceed|do it)\b/.test(lower)) {
      try {
        const res  = await api.post('/voice/process', { text: pendingCommand, confirm: true });
        const data = res.data;
        setStatusMessage(data.message || 'Confirmed');
        speak(data.message || 'Done', () => {
          if (data.route) navigateRef.current?.(data.route);
        });
      } catch {
        speak('Confirmation failed. Please try again.');
      }
    } else {
      setStatusMessage('Cancelled');
      speak('Okay, cancelled.');
    }
    awaitingConfirmRef.current = false;
  }, [speak]);

  // ─── Handle a finalized transcript ──────────────────────────────────────
  const handleFinal = useCallback(async (rawText) => {
    if (!rawText) return;
    if (processingRef.current || speakingRef.current) return; // busy – ignore

    const cleanedText = rawText.trim();
    const commandText = stripWakeWord(cleanedText) || cleanedText;

    // Wake word only
    if (isWakeOnly(cleanedText)) {
      awaitingConfirmRef.current = false;
      setStatusMessage("Listening for your command...");
      speak("Yes, I'm listening. What would you like to do?");
      return;
    }

    if (!commandText) return;

    // Confirmation response
    if (awaitingConfirmRef.current) {
      const pending = awaitingConfirmRef.current;
      awaitingConfirmRef.current = false;
      processingRef.current = true;
      await handleConfirmation(commandText, pending);
      processingRef.current = false;
      setStatusMessage(listeningRef.current ? 'Listening...' : 'Voice assistant stopped');
      return;
    }

    // Normal command
    processingRef.current = true;
    await processCommand(commandText);
    processingRef.current = false;
    setStatusMessage(listeningRef.current ? 'Listening...' : 'Voice assistant stopped');

    // If nothing was spoken (e.g. silent navigation), restart mic manually
    if (listeningRef.current && !speakingRef.current) {
      setTimeout(() => startRecognition(), 300);
    }
  }, [processCommand, handleConfirmation, speak, startRecognition]);

  // Stable ref for handleFinal (used in recognition.onresult)
  const handleFinalRef = useRef(handleFinal);
  useEffect(() => { handleFinalRef.current = handleFinal; }, [handleFinal]);

  // ─── Set up Speech Recognition once ─────────────────────────────────────
  useEffect(() => {
    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous      = false; // ← IMPORTANT: false gives cleaner single-utterance cycles
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;
    recognition.lang            = 'en-US';

    recognition.onresult = (event) => {
      let interimText = '';
      let finalText   = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText   += result[0].transcript;
        else                interimText += result[0].transcript;
      }

      const display = `${finalText}${interimText}`.trim();
      if (display) setRecognizedText(display);

      if (finalText) {
        handleFinalRef.current(finalText.trim());
      }
    };

    recognition.onstart = () => {
      recognitionStartedRef.current = true;
      setStatusMessage('Listening...');
    };

    recognition.onend = () => {
      recognitionStartedRef.current = false;
      // Auto-restart unless we're speaking, processing, or not in listening mode
      if (listeningRef.current && !processingRef.current && !speakingRef.current) {
        setTimeout(() => startRecognition(), 250);
      }
    };

    recognition.onerror = (event) => {
      const err = event?.error || 'unknown';
      recognitionStartedRef.current = false;

      if (!listeningRef.current) return;

      if (['not-allowed', 'service-not-allowed', 'security'].includes(err)) {
        listeningRef.current = false;
        setListening(false);
        setStatusMessage('Microphone access denied. Please allow microphone.');
        return;
      }

      // For no-speech / aborted / network – just restart
      if (!speakingRef.current && !processingRef.current) {
        setTimeout(() => startRecognition(), err === 'network' ? 1000 : 400);
      }
    };

    recognition.onnomatch = () => {
      setStatusMessage("Didn't catch that – please try again.");
    };

    recognitionRef.current = recognition;

    return () => {
      listeningRef.current          = false;
      recognitionStartedRef.current = false;
      try { recognition.stop(); } catch (_) {}
      recognitionRef.current = null;
    };
  }, [startRecognition]); // stable dep – only runs once on mount

  // ─── Start / Stop controls ───────────────────────────────────────────────
  const startListening = () => {
    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported');
      return;
    }
    listeningRef.current   = true;
    processingRef.current  = false;
    speakingRef.current    = false;
    awaitingConfirmRef.current = false;
    setListening(true);
    setRecognizedText('');
    setLastCommand('');
    setStatusMessage('Starting...');

    // Speak greeting first, mic starts in speak's onend callback
    speak('Voice assistant activated. How can I help you?');
  };

  const stopListening = () => {
    listeningRef.current       = false;
    processingRef.current      = false;
    speakingRef.current        = false;
    awaitingConfirmRef.current = false;
    setListening(false);
    setStatusMessage('Voice assistant off');
    setRecognizedText('');

    if (recognitionRef.current && recognitionStartedRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
    }
    window.speechSynthesis?.cancel();
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3">

      {/* Status panel */}
      <div className="hidden md:flex flex-col text-right min-w-0 gap-0.5">
        <span className="text-white text-xs font-semibold tracking-wide">Voice Control</span>
        <span className={`text-[11px] truncate max-w-[200px] transition-colors duration-300 ${
          listening ? 'text-cyan-400' : 'text-slate-400'
        }`}>
          {statusMessage}
        </span>
        {recognizedText && listening && (
          <span className="text-[10px] text-slate-500 italic truncate max-w-[200px]">
            &ldquo;{recognizedText}&rdquo;
          </span>
        )}
      </div>

      {/* Last command badge */}
      {lastCommand && listening && (
        <div className="hidden lg:flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-2 py-1 max-w-[160px]">
          <RiVolumeUpLine size={10} className="text-cyan-400 flex-shrink-0" />
          <span className="text-[10px] text-slate-400 truncate">{lastCommand}</span>
        </div>
      )}

      {/* Mic button */}
      <button
        id="voice-control-btn"
        onClick={listening ? stopListening : startListening}
        className={`relative h-10 w-10 rounded-full flex items-center justify-center
          transition-all duration-300 focus:outline-none focus:ring-2
          focus:ring-offset-2 focus:ring-offset-slate-900 flex-shrink-0 ${
          listening
            ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500 shadow-lg shadow-red-500/30'
            : 'bg-cyan-500 hover:bg-cyan-600 focus:ring-cyan-500 shadow-lg shadow-cyan-500/20'
        }`}
        aria-label={listening ? 'Stop voice assistant' : 'Start voice assistant'}
        title={listening
          ? 'Click to stop'
          : 'Start voice control — say "open dashboard", "ESP32-A101 on", "add block Block A"'}
      >
        {/* Listening pulse */}
        {listening && !processingRef.current && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-25 pointer-events-none" />
        )}
        {/* Processing pulse */}
        {pulse && (
          <span className="absolute inset-0 rounded-full animate-ping bg-cyan-400 opacity-40 pointer-events-none" />
        )}

        {listening
          ? <RiCloseLine size={20} className="text-white relative z-10" />
          : <RiMicLine   size={20} className="text-white relative z-10" />
        }
      </button>
    </div>
  );
}
