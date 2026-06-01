import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { RiMicLine, RiCloseLine } from 'react-icons/ri';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition || null;

const NAVIGATION_COMMANDS = [
  { pattern: /\b(dashboard|home)\b/, route: '/dashboard', label: 'Dashboard' },
  { pattern: /\b(infrastructure|map|location|floor)\b/, route: '/infrastructure', label: 'Infrastructure' },
  { pattern: /\b(devices|esp32|device)\b/, route: '/devices', label: 'Devices' },
  { pattern: /\b(logs|alerts|detection)\b/, route: '/logs', label: 'Detection Logs' },
  { pattern: /\b(monitoring|monitor|live monitoring)\b/, route: '/monitoring', label: 'Monitoring' },
  { pattern: /\b(users|user management)\b/, route: '/users', label: 'Users' },
  { pattern: /\b(reports|analytics|statistics)\b/, route: '/reports', label: 'Reports' },
];

const isLogoutCommand = (text) => /\b(log ?out|sign ?out|sign ?off)\b/.test(text);
const stripWakeWord = (text) => text.replace(/^\s*(hey\s+examguard|examguard)\b\s*/i, '').trim();

export default function VoiceControl() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Voice assistant ready');
  const [recognizedText, setRecognizedText] = useState('');
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const recognitionStartedRef = useRef(false);
  const processingRef = useRef(false);
  const awaitingCommandRef = useRef(false);

  const restartRecognition = useCallback(() => {
    if (!listeningRef.current || !recognitionRef.current || recognitionStartedRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.warn('[Voice] restart failed', err);
    }
  }, []);

  const getNavigationRoute = (text) => {
    const lower = text.toLowerCase();
    const match = NAVIGATION_COMMANDS.find((item) => item.pattern.test(lower));
    return match ? match.route : null;
  };

  const getNavigationLabel = (route) => {
    const page = NAVIGATION_COMMANDS.find((item) => item.route === route);
    return page ? page.label : 'page';
  };

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    // Speak and when finished, ensure recognition restarts if assistant is active
    utterance.onend = () => {
      if (listeningRef.current && recognitionRef.current && !recognitionStartedRef.current && !processingRef.current) {
        setTimeout(() => {
          restartRecognition();
        }, 250);
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [restartRecognition]);

  const processCommand = useCallback(async (commandText) => {
    const lower = commandText.toLowerCase();
    setStatusMessage('Processing command...');

    if (isLogoutCommand(lower)) {
      logout();
      navigate('/login');
      setStatusMessage('Logged out successfully');
      speak('You have been logged out');
      return;
    }

    const route = getNavigationRoute(lower);
    if (route) {
      const label = getNavigationLabel(route);
      navigate(route);
      setStatusMessage(`Opening ${label}`);
      speak(`Opening ${label}`);
      return;
    }

    try {
      const response = await api.post('/voice/process', { text: commandText });
      const data = response.data;
      if (data.needsConfirmation) {
        const approved = window.confirm(data.message);
        if (approved) {
          const confirmResponse = await api.post('/voice/process', { text: commandText, confirm: true });
          const confirmData = confirmResponse.data;
          setStatusMessage(confirmData.message || 'Command confirmed');
          speak(confirmData.message);
          if (confirmData.route) navigate(confirmData.route);
        } else {
          setStatusMessage('Command canceled');
          speak('Okay, canceled.');
        }
      } else if (data.success) {
        setStatusMessage(data.message || 'Command executed');
        speak(data.message || 'Command executed');
        if (data.route) navigate(data.route);
      } else {
        setStatusMessage(data.message || 'Command not recognized');
        speak(data.message || 'I could not understand that command.');
      }
    } catch (error) {
      console.error('[VoiceControl] Voice command failed', error);
      setStatusMessage('Voice command failed');
      speak('There was a problem processing your command.');
    }
  }, [logout, navigate, speak]);

  const handleFinal = useCallback(async (rawText) => {
    if (!rawText || processingRef.current) return;

    const cleanedText = rawText.trim();
    const withoutWake = stripWakeWord(cleanedText);
    const isWakeOnly = /^\s*(hey\s+examguard|examguard)\s*$/i.test(cleanedText);
    const commandText = withoutWake || cleanedText;

    if (isWakeOnly) {
      awaitingCommandRef.current = true;
      setStatusMessage('Awaiting your command');
      speak('Yes, I am listening.');
      return;
    }

    if (!commandText) return;
    processingRef.current = true;
    awaitingCommandRef.current = false;

    await processCommand(commandText);
    processingRef.current = false;
    setStatusMessage('Listening...');
    // Ensure recognition resumes after command processing
    if (listeningRef.current) {
      restartRecognition();
    }
  }, [processCommand, restartRecognition, speak]);

  useEffect(() => {
    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }

      const display = `${finalText || ''}${interim || ''}`.trim();
      setRecognizedText(display);

      if (finalText) {
        handleFinal(finalText.trim());
      }
    };

    recognition.onstart = () => {
      recognitionStartedRef.current = true;
      setStatusMessage('Listening...');
    };

    recognition.onend = () => {
      recognitionStartedRef.current = false;
      if (listeningRef.current) {
        setTimeout(() => {
          restartRecognition();
        }, 500);
      }
    };

    recognition.onerror = (event) => {
      const errorName = event?.error || 'unknown_error';
      setStatusMessage(`Speech error: ${errorName}`);
      recognitionStartedRef.current = false;

      if (!listeningRef.current) return;
      if (['not-allowed', 'service-not-allowed', 'security', 'network'].includes(errorName)) {
        listeningRef.current = false;
        setListening(false);
      } else if (['aborted', 'no-speech', 'audio-capture'].includes(errorName)) {
        if (listeningRef.current && !processingRef.current) {
          setTimeout(() => {
            restartRecognition();
          }, 500);
        }
      }
    };

    recognition.onnomatch = () => {
      setStatusMessage('Speech not recognized. Please try again.');
    };

    recognitionRef.current = recognition;
    return () => {
      listeningRef.current = false;
      recognitionStartedRef.current = false;
      try { recognition.stop(); } catch (_) {}
      recognitionRef.current = null;
    };
  }, [handleFinal, restartRecognition]);

  const startListening = () => {
    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported');
      return;
    }
    listeningRef.current = true;
    processingRef.current = false;
    setListening(true);
    setStatusMessage('Waiting for speech...');
    if (recognitionRef.current && !recognitionStartedRef.current) {
      try { recognitionRef.current.start(); } catch (error) { console.warn('[Voice] Start failed', error); }
    }
  };

  const stopListening = () => {
    listeningRef.current = false;
    processingRef.current = false;
    setListening(false);
    setStatusMessage('Voice assistant stopped');
    if (recognitionRef.current && recognitionStartedRef.current) {
      try { recognitionRef.current.stop(); } catch (error) { console.warn('[Voice] Stop failed', error); }
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex flex-col text-right text-white text-xs tracking-[0.14em]">
        <span className="font-semibold">Voice Control</span>
        <span className="text-slate-400">{statusMessage}</span>
      </div>
      <div className="hidden sm:block text-xs text-slate-300 text-right max-w-[220px] truncate">
        {recognizedText ? `Recognized: ${recognizedText}` : 'Speak after starting voice control'}
      </div>
      <button
        onClick={listening ? stopListening : startListening}
        className={`h-11 w-11 rounded-full transition-colors duration-200 flex items-center justify-center ${listening ? 'bg-red-500 hover:bg-red-600' : 'bg-cyan-500 hover:bg-cyan-600'}`}
        aria-label={listening ? 'Stop voice assistant' : 'Start voice assistant'}
      >
        {listening ? <RiCloseLine size={22} className="text-white" /> : <RiMicLine size={22} className="text-white" />}
      </button>
    </div>
  );
}
