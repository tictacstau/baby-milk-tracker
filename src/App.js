import React, { useState, useEffect, useRef } from 'react';
import { Home, Milk, BarChart2, Droplet, ChevronDown, ChevronUp, Moon, Sun, Wind, Activity, Bell, BellOff, Settings, Scale, Pill } from 'lucide-react';
import { db } from './firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

const notifSupported = typeof Notification !== 'undefined';
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua);
const isAndroid = /Android/.test(ua);
const notifSettingsPath = isIOS
  ? 'Settings app → Safari → Notifications'
  : isAndroid
  ? 'Chrome menu → Settings → Site settings → Notifications'
  : 'Browser settings → Site settings → Notifications';


export default function App() {
  const [unit, setUnit] = useState('ml');
  const [feeds, setFeeds] = useState([]);
  const [babyAge, setBabyAge] = useState(2);
  const [babyName, setBabyName] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [nextFeedTime, setNextFeedTime] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [expandedDays, setExpandedDays] = useState({});
  const [showPreviousDays, setShowPreviousDays] = useState(false);
  const [isBabyAwake, setIsBabyAwake] = useState(false);
  const [wakeStartTime, setWakeStartTime] = useState(null);
  const [wakeWindows, setWakeWindows] = useState([]);
  const [wakeElapsed, setWakeElapsed] = useState('');
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('roomCode') || '');
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState(notifSupported ? Notification.permission : 'unsupported');
  const [notifMuted, setNotifMuted] = useState(() => localStorage.getItem('notifMuted') === 'true');
  const [showBellTooltip, setShowBellTooltip] = useState(false);

  const [showFeeds, setShowFeeds] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showDiapers, setShowDiapers] = useState(false);
  const [showPumping, setShowPumping] = useState(false);
  const [timeUntilFeed, setTimeUntilFeed] = useState('');
  const notificationFired = useRef(false);
  const settingsLoaded = useRef(false);
  const deferredInstallPrompt = useRef(null);
  const [installable, setInstallable] = useState(false);
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const [diapers, setDiapers] = useState([]);
  const [pumps, setPumps] = useState([]);
  const [quickLogModal, setQuickLogModal] = useState(null); // null | 'feed' | 'diaper' | 'pump' | 'weight' | 'medicine'
  const [pumpAmount, setPumpAmount] = useState('');
  const [weights, setWeights] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [weightInput, setWeightInput] = useState('');
  const [medicineName, setMedicineName] = useState('');
  const [medicineDose, setMedicineDose] = useState('');
  const [logTime, setLogTime] = useState('');
  const [showWeights, setShowWeights] = useState(false);
  const [showMedicines, setShowMedicines] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);
  const ACCENT = '#5856D6';
  const BG = isDark ? '#000000' : '#F2F2F7';
  const CARD = isDark ? '#1C1C1E' : '#FFFFFF';
  const TEXT = isDark ? '#FFFFFF' : '#1C1C1E';
  const TEXT2 = '#8E8E93';
  const BORDER = isDark ? '#3A3A3C' : '#E5E5EA';
  const GREEN = '#34C759';
  const RED = '#FF3B30';
  const AMBER = '#FF9500';
  const ACCENT_BG = isDark ? 'rgba(88,86,214,0.25)' : '#EDEDFA';
  const FEED_BG = isDark ? 'rgba(88,86,214,0.2)' : '#F0F0FF';
  const DIAPER_BG = isDark ? 'rgba(255,149,0,0.15)' : '#FFF3E0';
  const PUMP_BG = isDark ? 'rgba(52,199,89,0.15)' : '#E8FAF0';
  const WAKE_BG = isDark ? 'rgba(255,149,0,0.12)' : '#FFF8EC';
  const OVER_BG = isDark ? 'rgba(255,59,48,0.15)' : '#FFF0EE';
  const WEIGHT_COLOR = '#30B0C7';
  const MED_COLOR = '#FF2D55';
  const WEIGHT_BG = isDark ? 'rgba(48,176,199,0.15)' : '#E0F7FA';
  const MED_BG = isDark ? 'rgba(255,45,85,0.15)' : '#FFF0F3';

  // Firestore sync helper
  const syncRoom = (code, data) => {
    setDoc(doc(db, 'rooms', code), data, { merge: true }).catch(console.error);
  };

  // Room management
  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const createRoom = async () => {
    setRoomLoading(true);
    setRoomError('');
    try {
      const code = generateCode();
      const initial = {
        feeds, diapers, pumps, weights, medicines, wakeWindows,
        wakeState: { awake: isBabyAwake, startTime: wakeStartTime ? wakeStartTime.toISOString() : null },
        settings: { unit, babyAge, babyName },
      };
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out — check Firebase config')), 10000));
      await Promise.race([setDoc(doc(db, 'rooms', code), initial), timeout]);
      localStorage.setItem('roomCode', code);
      setRoomCode(code);
    } catch (e) {
      setRoomError(`Error: ${e.message}`);
    }
    setRoomLoading(false);
  };

  const joinRoom = async () => {
    const code = roomInput.trim().toUpperCase();
    if (!code) return;
    setRoomLoading(true);
    setRoomError('');
    try {
      const { getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'rooms', code));
      if (!snap.exists()) {
        setRoomError('Room not found. Check the code and try again.');
      } else {
        localStorage.setItem('roomCode', code);
        setRoomCode(code);
      }
    } catch {
      setRoomError('Failed to join room. Check your connection.');
    }
    setRoomLoading(false);
  };

  // Real-time sync from Firestore
  useEffect(() => {
    if (!roomCode) return;
    const unsub = onSnapshot(doc(db, 'rooms', roomCode), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.feeds) {
        setFeeds(d.feeds);
        const last = d.feeds[d.feeds.length - 1];
        if (last) {
          const nextTime = new Date(last.timestamp);
          nextTime.setHours(nextTime.getHours() + 3);
          setNextFeedTime(nextTime);
        }
      }
      if (d.settings) {
        setUnit(d.settings.unit || 'ml');
        setBabyAge(d.settings.babyAge != null ? d.settings.babyAge : 2);
        setBabyName(d.settings.babyName || '');
        settingsLoaded.current = true;
      }
      if (d.diapers) setDiapers(d.diapers);
      if (d.pumps) setPumps(d.pumps);
      if (d.weights) setWeights(d.weights);
      if (d.medicines) setMedicines(d.medicines);
      if (d.wakeWindows) setWakeWindows(d.wakeWindows);
      if (d.wakeState) {
        setIsBabyAwake(d.wakeState.awake);
        setWakeStartTime(d.wakeState.startTime ? new Date(d.wakeState.startTime) : null);
      }
    });
    return () => unsub();
  }, [roomCode]);

  // Save settings
  useEffect(() => {
    if (!roomCode || !settingsLoaded.current || babyAge === 0 || babyAge === '') return;
    syncRoom(roomCode, { settings: { unit, babyAge, babyName } });
  }, [unit, babyAge, babyName, roomCode]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (nextFeedTime) {
        const diff = nextFeedTime - new Date();
        if (diff <= 0) {
          setTimeUntilFeed('Feed time!');
          if (!notificationFired.current && notifSupported && Notification.permission === 'granted' && !notifMuted) {
            notificationFired.current = true;
            new Notification('Time to feed! 🍼', {
              body: `It's been 3 hours — ${babyName || 'baby'} might be hungry!`,
              icon: '/favicon.ico',
            });
          }
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeUntilFeed(`${hours}h ${minutes}m`);
        }
      } else {
        setTimeUntilFeed('Log first feed');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [nextFeedTime, babyName, notifMuted]);

  // System dark mode listener
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const handler = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Android PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); deferredInstallPrompt.current = e; setInstallable(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Reset log time to "now" whenever a modal opens
  useEffect(() => {
    if (quickLogModal) {
      const now = new Date();
      setLogTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    }
  }, [quickLogModal]);

  const getLogTimestamp = () => {
    if (!logTime) return new Date().toISOString();
    const [h, m] = logTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // Wake window live timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (isBabyAwake && wakeStartTime) {
        const diff = Date.now() - new Date(wakeStartTime).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setWakeElapsed(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
      } else {
        setWakeElapsed('');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isBabyAwake, wakeStartTime]);

  const getRecommendedWakeWindow = () => {
    if (babyAge <= 4) return { min: 45, max: 60 };
    if (babyAge <= 8) return { min: 60, max: 90 };
    if (babyAge <= 16) return { min: 75, max: 120 };
    if (babyAge <= 24) return { min: 90, max: 180 };
    return { min: 120, max: 180 };
  };

  const getWakeStatus = () => {
    if (!isBabyAwake || !wakeStartTime) return null;
    const elapsedMin = (Date.now() - new Date(wakeStartTime).getTime()) / 60000;
    const { min, max } = getRecommendedWakeWindow();
    if (elapsedMin < min * 0.75) return { color: GREEN, label: 'Within window' };
    if (elapsedMin < max) return { color: AMBER, label: 'Nap soon' };
    return { color: RED, label: 'Nap overdue' };
  };

  const toggleWakeState = () => {
    if (!isBabyAwake) {
      const now = new Date();
      setIsBabyAwake(true);
      setWakeStartTime(now);
      syncRoom(roomCode, { wakeState: { awake: true, startTime: now.toISOString() } });
    } else {
      const ended = new Date();
      const entry = { start: wakeStartTime.toISOString(), end: ended.toISOString() };
      const updated = [...wakeWindows, entry];
      setWakeWindows(updated);
      setIsBabyAwake(false);
      setWakeStartTime(null);
      syncRoom(roomCode, { wakeWindows: updated, wakeState: { awake: false, startTime: null } });
    }
  };

  const getTodayWakeWindows = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return wakeWindows.filter((w) => new Date(w.start) >= today);
  };

  const formatDuration = (ms) => {
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getRecommendedAmount = () => {
    if (babyAge <= 1) return 60;
    if (babyAge <= 2) return 90;
    if (babyAge <= 4) return 120;
    if (babyAge <= 8) return 150;
    return 180;
  };

  const mlToOz = (ml) => (ml * 0.033814).toFixed(1);
  const ozToMl = (oz) => Math.round(oz * 29.5735);
  const convert = (amount) => (unit === 'ml' ? amount : mlToOz(amount));

  const requestNotifications = async () => {
    if (!notifSupported) return;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
    }
  };

  const logFeed = async (amount) => {
    await requestNotifications();
    notificationFired.current = false;
    const newFeed = {
      timestamp: getLogTimestamp(),
      amount: unit === 'oz' ? ozToMl(amount) : amount,
      unit,
    };
    const updatedFeeds = [...feeds, newFeed];
    setFeeds(updatedFeeds);
    syncRoom(roomCode, { feeds: updatedFeeds });
    const nextTime = new Date();
    nextTime.setHours(nextTime.getHours() + 3);
    setNextFeedTime(nextTime);
    setCustomAmount('');
    setActiveTab('home');
  };

  const getTodayFeeds = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return feeds.filter((f) => new Date(f.timestamp) >= today);
  };

  const getTodayDiapers = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return diapers.filter((d) => new Date(d.timestamp) >= today);
  };

  const getTodayPumps = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return pumps.filter((p) => new Date(p.timestamp) >= today);
  };

  const logDiaper = (type) => {
    const entry = { timestamp: getLogTimestamp(), type };
    const updated = [...diapers, entry];
    setDiapers(updated);
    syncRoom(roomCode, { diapers: updated });
    setQuickLogModal(null);
  };

  const logPump = (amount) => {
    const entry = { timestamp: getLogTimestamp(), amount: unit === 'oz' ? ozToMl(amount) : amount };
    const updated = [...pumps, entry];
    setPumps(updated);
    syncRoom(roomCode, { pumps: updated });
    setPumpAmount('');
    setQuickLogModal(null);
  };

  const getTodayWeights = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return weights.filter(w => new Date(w.timestamp) >= today);
  };

  const getTodayMedicines = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return medicines.filter(m => new Date(m.timestamp) >= today);
  };

  const logWeight = (grams) => {
    const entry = { timestamp: getLogTimestamp(), grams };
    const updated = [...weights, entry];
    setWeights(updated);
    syncRoom(roomCode, { weights: updated });
    setWeightInput('');
    setQuickLogModal(null);
  };

  const logMedicine = (name, dose) => {
    const entry = { timestamp: getLogTimestamp(), name, dose };
    const updated = [...medicines, entry];
    setMedicines(updated);
    syncRoom(roomCode, { medicines: updated });
    setMedicineName(''); setMedicineDose('');
    setQuickLogModal(null);
  };

  const todayFeeds = getTodayFeeds();
  const todayTotal = todayFeeds.reduce((sum, f) => sum + f.amount, 0);
  const recommended = getRecommendedAmount();
  const recommendedDaily = recommended * 8;
  const progressFrac = Math.min(todayTotal / recommendedDaily, 1);

  const calculateFormula = (targetMl) => {
    const scoops = Math.round(targetMl / 30);
    return { scoops, water: scoops * 30 };
  };

  const quickLogAmounts = [
    Math.round(recommended * 0.75),
    recommended,
    Math.round(recommended * 1.25),
  ];

  // Circular timer ring (Home tab)
  const getElapsedFraction = () => {
    if (!nextFeedTime) return 0;
    const lastFeedTime = new Date(nextFeedTime.getTime() - 3 * 60 * 60 * 1000);
    const elapsed = Date.now() - lastFeedTime.getTime();
    return Math.min(Math.max(elapsed / (3 * 60 * 60 * 1000), 0), 1);
  };

  const TR = 100;
  const TSTROKE = 14;
  const TCIRC = 2 * Math.PI * TR;
  const elapsedFrac = getElapsedFraction();
  const timerOffset = TCIRC * (1 - elapsedFrac);
  const timerSize = (TR + TSTROKE) * 2;
  const timerColor = elapsedFrac >= 1 ? RED : ACCENT;

  // Daily progress ring (Stats tab)
  const PR = 68;
  const PCIRC = 2 * Math.PI * PR;
  const progressOffset = PCIRC * (1 - progressFrac);
  const pSize = (PR + 10) * 2;

  const getFeedsByDay = () => {
    const groups = {};
    feeds.forEach((feed) => {
      const date = new Date(feed.timestamp);
      const key = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(feed);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  };

  const toggleDay = (key) => setExpandedDays((prev) => ({ ...prev, [key]: !prev[key] }));


  const tabs = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'stats', label: 'Summary', Icon: BarChart2 },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  // ── Home Tab ─────────────────────────────────────────────
  const HomeTab = () => (
    <div style={{ padding: '32px 20px 24px' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>
            {babyName ? `${babyName}'s Tracker` : "TeamBaby"}
          </h1>
          <button onClick={() => { navigator.clipboard?.writeText(roomCode); }} style={{ background: ACCENT_BG, border: 'none', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
            <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, letterSpacing: 1.5 }}>Room: {roomCode}</span>
            <span style={{ fontSize: 10, color: ACCENT }}>⎘</span>
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              if (notifPermission === 'default') {
                requestNotifications();
              } else if (notifPermission === 'granted') {
                const next = !notifMuted;
                setNotifMuted(next);
                localStorage.setItem('notifMuted', next);
                setShowBellTooltip(false);
              } else {
                setShowBellTooltip(v => !v);
              }
            }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            {notifPermission === 'granted' && !notifMuted && <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: GREEN, border: '1.5px solid white' }} />}
            {notifPermission === 'granted' && !notifMuted
              ? <Bell size={18} color={TEXT2} />
              : <BellOff size={18} color={notifPermission === 'denied' || notifMuted ? RED : TEXT2} />}
          </button>
          {showBellTooltip && (
            <div style={{
              position: 'absolute', top: 38, right: 0, zIndex: 100,
              background: '#1a1a2e', color: 'white',
              fontSize: 12, fontWeight: 500, lineHeight: 1.5,
              padding: '10px 14px', borderRadius: 10,
              width: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {notifPermission === 'denied' ? (
                <>
                  <div style={{ marginBottom: 6 }}>Notifications are blocked.</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)' }}>To enable: {notifSettingsPath}.</div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 6 }}>Notifications aren't supported on this browser.</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)' }}>Try opening the app in Safari on iOS or Chrome on Android.</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timer ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ position: 'relative', width: timerSize, height: timerSize }}>
          <svg width={timerSize} height={timerSize} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={timerSize / 2} cy={timerSize / 2} r={TR} fill="none" stroke={BORDER} strokeWidth={TSTROKE} />
            <circle
              cx={timerSize / 2} cy={timerSize / 2} r={TR}
              fill="none" stroke={timerColor} strokeWidth={TSTROKE}
              strokeLinecap="round"
              strokeDasharray={TCIRC}
              strokeDashoffset={timerOffset}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: elapsedFrac >= 1 ? 28 : timeUntilFeed === 'Log first feed' ? 22 : 38, fontWeight: 700, color: timerColor, letterSpacing: -1, lineHeight: 1, textAlign: 'center', padding: '0 16px' }}>
              {timeUntilFeed}
            </span>
            {timeUntilFeed !== 'Log first feed' && <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500, marginTop: 6 }}>until next feed</span>}
          </div>
        </div>

        {nextFeedTime && (
          <p style={{ margin: '14px 0 0', fontSize: 15, color: TEXT2, fontWeight: 500 }}>
            Around {nextFeedTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Quick Log Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { id: 'feed', label: 'Feed', Icon: Milk, color: ACCENT, bg: FEED_BG },
          { id: 'diaper', label: 'Diaper', Icon: Wind, color: AMBER, bg: DIAPER_BG },
          { id: 'sleep', label: 'Sleep', Icon: Moon, color: ACCENT, bg: FEED_BG },
          { id: 'pump', label: 'Pump', Icon: Activity, color: GREEN, bg: PUMP_BG },
          { id: 'weight', label: 'Weight', Icon: Scale, color: WEIGHT_COLOR, bg: WEIGHT_BG },
          { id: 'medicine', label: 'Medicine', Icon: Pill, color: MED_COLOR, bg: MED_BG },
        ].map(({ id, label, Icon, color, bg }) => (
          <button key={id} onClick={() => id === 'sleep' ? toggleWakeState() : setQuickLogModal(id)} style={{
            background: CARD, border: 'none', borderRadius: 16, padding: '16px 8px',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={color} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{id === 'sleep' ? (isBabyAwake ? 'Log Sleep' : 'Log Wake') : `Log ${label}`}</span>
          </button>
        ))}
      </div>

      {/* Wake window status */}
      {(() => {
        const status = getWakeStatus();
        const { min, max } = getRecommendedWakeWindow();
        return (
          <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: isBabyAwake ? WAKE_BG : FEED_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isBabyAwake ? <Sun size={18} color={AMBER} /> : <Moon size={18} color={ACCENT} />}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
                  {isBabyAwake ? `Awake · ${wakeElapsed || '0m'}` : 'Sleeping'}
                </div>
                <div style={{ fontSize: 12, color: TEXT2, marginTop: 2 }}>
                  {isBabyAwake ? `Window: ${min}–${max} min` : 'Wake window not started'}
                </div>
              </div>
            </div>
            {status && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                background: status.color === GREEN ? PUMP_BG : status.color === AMBER ? DIAPER_BG : OVER_BG,
                color: status.color,
              }}>
                {status.label}
              </span>
            )}
          </div>
        );
      })()}


    </div>
  );


  // ── Settings Tab ─────────────────────────────────────────
  const SettingsTab = () => (
    <div style={{ padding: '32px 20px 24px' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>Settings</h2>

      {/* Appearance */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Appearance</p>
      <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 13, color: TEXT2, marginBottom: 10 }}>Theme</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ].map(({ value, label }) => (
            <button key={value} onClick={() => { setTheme(value); localStorage.setItem('theme', value); }} style={{
              flex: 1, padding: '10px 4px', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
              background: theme === value ? ACCENT : BG,
              color: theme === value ? 'white' : TEXT2,
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Baby info */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Baby</p>
      <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Name</label>
          <input type="text" placeholder="e.g. Liam" value={babyName} onChange={(e) => setBabyName(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: TEXT, background: CARD }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Age (weeks)</label>
          <input type="number" value={babyAge || ''} onChange={(e) => setBabyAge(parseInt(e.target.value) || 0)}
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: TEXT, background: CARD }} />
        </div>
      </div>

      {/* Units */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Units</p>
      <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: 10 }}>
        {['ml', 'oz'].map((u) => (
          <button key={u} onClick={() => setUnit(u)} style={{
            flex: 1, padding: '12px', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', background: unit === u ? ACCENT : BG, color: unit === u ? 'white' : TEXT2,
          }}>{u}</button>
        ))}
      </div>

      {/* Room code */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Room</p>
      <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: TEXT2, marginBottom: 4 }}>Share this code with your partner</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT, letterSpacing: 3 }}>{roomCode}</div>
        </div>
        <button onClick={() => navigator.clipboard?.writeText(roomCode)} style={{ background: ACCENT_BG, border: 'none', padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: ACCENT }}>
          Copy
        </button>
      </div>

      {/* Install app */}
      {!isStandalone && <>
        <p style={{ margin: '20px 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Install App</p>
        <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 13, color: TEXT2, marginBottom: 14 }}>
            Add TeamBaby to your home screen for the best experience — it opens like a regular app with no browser bar.
          </div>
          {installable ? (
            <button
              onClick={async () => {
                deferredInstallPrompt.current.prompt();
                const { outcome } = await deferredInstallPrompt.current.userChoice;
                if (outcome === 'accepted') { deferredInstallPrompt.current = null; setInstallable(false); }
              }}
              style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white' }}
            >
              Add to Home Screen
            </button>
          ) : (
            <button
              onClick={() => setShowInstallInstructions(v => !v)}
              style={{ width: '100%', padding: '14px', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', background: ACCENT, color: 'white' }}
            >
              How to Install
            </button>
          )}
          {showInstallInstructions && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {isIOS ? (
                [
                  { step: '1', text: 'Tap the Share button (□↑) at the bottom of Safari' },
                  { step: '2', text: 'Scroll down and tap "Add to Home Screen"' },
                  { step: '3', text: 'Tap "Add" in the top right corner' },
                ].map(({ step, text }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{step}</span>
                    </div>
                    <span style={{ fontSize: 14, color: TEXT, paddingTop: 4 }}>{text}</span>
                  </div>
                ))
              ) : (
                [
                  { step: '1', text: 'Tap the three-dot menu (⋮) in Chrome' },
                  { step: '2', text: 'Tap "Add to Home screen"' },
                  { step: '3', text: 'Tap "Add" to confirm' },
                ].map(({ step, text }) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{step}</span>
                    </div>
                    <span style={{ fontSize: 14, color: TEXT, paddingTop: 4 }}>{text}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </>}
    </div>
  );

  // ── Stats Tab ────────────────────────────────────────────
  const StatsTab = () => {
    const todayWW = getTodayWakeWindows();
    const totalAwakeMs = todayWW.reduce((sum, w) => sum + (new Date(w.end) - new Date(w.start)), 0);
    const avgAwakeMs = todayWW.length > 0 ? totalAwakeMs / todayWW.length : 0;
    const { max } = getRecommendedWakeWindow();
    const wwOnTrack = todayWW.filter(w => (new Date(w.end) - new Date(w.start)) / 60000 <= max).length;
    const todayD = getTodayDiapers();
    const wetCount = todayD.filter(d => d.type === 'wet' || d.type === 'both').length;
    const dirtyCount = todayD.filter(d => d.type === 'dirty' || d.type === 'both').length;
    const todayP = getTodayPumps();
    const pumpTotal = todayP.reduce((sum, p) => sum + p.amount, 0);
    const avgPump = todayP.length > 0 ? Math.round(pumpTotal / todayP.length) : 0;


    const SectionHeader = ({ label, show, onToggle, Icon, iconColor, iconBg }) => (
      <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', marginBottom: show ? 12 : 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <button onClick={onToggle} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} color={iconColor} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>{label}</span>
          </div>
          {show ? <ChevronUp size={22} color={TEXT2} /> : <ChevronDown size={22} color={TEXT2} />}
        </button>
      </div>
    );

    return (
    <div style={{ padding: '32px 20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{babyName ? `${babyName}'s Summary` : 'Summary'}</h2>
        <button
          onClick={() => {
            const allOpen = showFeeds && showSleep && showDiapers && showPumping && showWeights && showMedicines;
            setShowFeeds(!allOpen); setShowSleep(!allOpen); setShowDiapers(!allOpen); setShowPumping(!allOpen); setShowWeights(!allOpen); setShowMedicines(!allOpen);
          }}
          style={{ background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, color: TEXT2, cursor: 'pointer' }}
        >
          {showFeeds && showSleep && showDiapers && showPumping && showWeights && showMedicines ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* ── Feeds section ── */}
      <SectionHeader label="Feeds" show={showFeeds} onToggle={() => setShowFeeds(v => !v)} Icon={Milk} iconColor={ACCENT} iconBg={FEED_BG} />

      {showFeeds && <>
      {/* Progress ring card */}
      <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ position: 'relative', width: pSize, height: pSize, flexShrink: 0 }}>
          <svg width={pSize} height={pSize} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={pSize / 2} cy={pSize / 2} r={PR} fill="none" stroke={BORDER} strokeWidth={10} />
            <circle
              cx={pSize / 2} cy={pSize / 2} r={PR}
              fill="none" stroke={progressFrac >= 1 ? GREEN : ACCENT} strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={PCIRC}
              strokeDashoffset={progressOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: progressFrac >= 1 ? GREEN : TEXT }}>
              {Math.round(progressFrac * 100)}%
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 3 }}>
            {convert(todayTotal)}{unit}
          </div>
          <div style={{ fontSize: 13, color: TEXT2, marginBottom: 8 }}>
            of {convert(recommendedDaily)}{unit} daily goal
          </div>
          <div style={{ fontSize: 13, color: TEXT2 }}>
            {todayFeeds.length} feed{todayFeeds.length !== 1 ? 's' : ''} today
          </div>
        </div>
      </div>

      {/* Feed stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: CARD, borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 3 }}>
            {todayFeeds.length > 0 ? `${convert(Math.round(todayTotal / todayFeeds.length))}${unit}` : '—'}
          </div>
          <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>Avg per feed</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: progressFrac >= 1 ? GREEN : TEXT, letterSpacing: -0.5, marginBottom: 3 }}>
            {progressFrac >= 1 ? '✓ Done' : `${convert(Math.max(recommendedDaily - todayTotal, 0))}${unit}`}
          </div>
          <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500 }}>Remaining</div>
        </div>
      </div>

      {/* Today's feed list */}
      {todayFeeds.length > 0 ? (
        <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {[...todayFeeds].reverse().map((feed, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0',
              borderBottom: idx < todayFeeds.length - 1 ? `1px solid ${BORDER}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Droplet size={16} color={ACCENT} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>
                  {new Date(feed.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: ACCENT }}>
                {convert(feed.amount)}{unit}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', textAlign: 'center', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>No feeds logged today yet.</p>
        </div>
      )}

      </>}

      {/* ── Sleep section ── */}
      <SectionHeader label="Sleep" show={showSleep} onToggle={() => setShowSleep(v => !v)} Icon={Moon} iconColor={ACCENT} iconBg={FEED_BG} />

      {showSleep && <>
      {/* Sleep stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: CARD, borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 3 }}>{todayWW.length}</div>
          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>Wake windows</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 3 }}>{todayWW.length > 0 ? formatDuration(totalAwakeMs) : '—'}</div>
          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>Total awake</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: todayWW.length > 0 && wwOnTrack === todayWW.length ? GREEN : TEXT, letterSpacing: -0.5, marginBottom: 3 }}>
            {todayWW.length > 0 ? formatDuration(avgAwakeMs) : '—'}
          </div>
          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>Avg window</div>
        </div>
      </div>

      {/* Today's wake windows list */}
      {todayWW.length > 0 ? (
        <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {[...todayWW].reverse().map((w, idx, arr) => {
            const duration = new Date(w.end) - new Date(w.start);
            const onTrack = duration / 60000 <= max;
            return (
              <div key={idx} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '11px 0',
                borderBottom: idx < arr.length - 1 ? `1px solid ${BORDER}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sun size={16} color={ACCENT} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                      {new Date(w.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(w.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>{formatDuration(duration)}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                  background: onTrack ? PUMP_BG : OVER_BG,
                  color: onTrack ? GREEN : RED,
                }}>
                  {onTrack ? 'On track' : 'Over window'}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', textAlign: 'center', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>No wake windows logged today yet.</p>
        </div>
      )}

      </>}

      {/* ── Diapers section ── */}
      <SectionHeader label="Diapers" show={showDiapers} onToggle={() => setShowDiapers(v => !v)} Icon={Wind} iconColor={AMBER} iconBg={DIAPER_BG} />

      {showDiapers && <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { value: todayD.length || '—', label: 'Total' },
          { value: todayD.length > 0 ? wetCount : '—', label: 'Wet' },
          { value: todayD.length > 0 ? dirtyCount : '—', label: 'Dirty' },
        ].map(({ value, label }) => (
          <div key={label} style={{ background: CARD, borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {todayD.length > 0 ? (
        <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {[...todayD].reverse().map((d, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: idx < todayD.length - 1 ? `1px solid ${BORDER}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: DIAPER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wind size={16} color={AMBER} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>
                  {new Date(d.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT2, textTransform: 'capitalize' }}>{d.type}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', textAlign: 'center', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>No diapers logged today yet.</p>
        </div>
      )}

      </>}

      {/* ── Pumping section ── */}
      <SectionHeader label="Pumping" show={showPumping} onToggle={() => setShowPumping(v => !v)} Icon={Activity} iconColor={GREEN} iconBg={PUMP_BG} />

      {showPumping && <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { value: todayP.length || '—', label: 'Sessions' },
          { value: todayP.length > 0 ? `${convert(pumpTotal)}${unit}` : '—', label: 'Total' },
          { value: todayP.length > 0 ? `${convert(avgPump)}${unit}` : '—', label: 'Avg' },
        ].map(({ value, label }) => (
          <div key={label} style={{ background: CARD, borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {todayP.length > 0 ? (
        <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {[...todayP].reverse().map((p, idx) => (
            <div key={idx} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: idx < todayP.length - 1 ? `1px solid ${BORDER}` : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: PUMP_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Activity size={16} color={GREEN} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>
                  {new Date(p.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>{convert(p.amount)}{unit}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', textAlign: 'center', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>No pumping sessions logged today yet.</p>
        </div>
      )}
      </>}

      {/* Past days */}
      {(() => {
        const todayKey = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

        // Group wake windows by day
        const wwByDay = {};
        wakeWindows.forEach((w) => {
          const key = new Date(w.start).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          if (!wwByDay[key]) wwByDay[key] = [];
          wwByDay[key].push(w);
        });

        // Group diapers by day
        const dByDay = {};
        diapers.forEach((d) => {
          const key = new Date(d.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          if (!dByDay[key]) dByDay[key] = [];
          dByDay[key].push(d);
        });

        // Group pumps by day
        const pByDay = {};
        pumps.forEach((p) => {
          const key = new Date(p.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
          if (!pByDay[key]) pByDay[key] = [];
          pByDay[key].push(p);
        });

        // Merge all past dates
        const feedDays = getFeedsByDay().map(([k]) => k);
        const allPastKeys = [...new Set([...feedDays, ...Object.keys(wwByDay), ...Object.keys(dByDay), ...Object.keys(pByDay)])]
          .filter(k => k !== todayKey)
          .sort((a, b) => new Date(b) - new Date(a));

        if (allPastKeys.length === 0) return null;

        return (
          <>
      {/* ── Weight section ── */}
      <SectionHeader label="Weight" show={showWeights} onToggle={() => setShowWeights(v => !v)} Icon={Scale} iconColor={WEIGHT_COLOR} iconBg={WEIGHT_BG} />

      {showWeights && (() => {
        const todayW = getTodayWeights();
        const latestWeight = weights.length > 0 ? weights[weights.length - 1] : null;
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {[
                { value: todayW.length > 0 ? `${todayW[todayW.length - 1].grams}g` : '—', label: "Today's weight" },
                { value: latestWeight ? `${latestWeight.grams}g` : '—', label: 'Last recorded' },
              ].map(({ value, label }) => (
                <div key={label} style={{ background: CARD, borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: WEIGHT_COLOR, letterSpacing: -0.5, marginBottom: 3 }}>{value}</div>
                  <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>
            {todayW.length > 0 ? (
              <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {[...todayW].reverse().map((w, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx < todayW.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: WEIGHT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Scale size={16} color={WEIGHT_COLOR} />
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{new Date(w.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: WEIGHT_COLOR }}>{w.grams}g</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', textAlign: 'center', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>No weight logged today yet.</p>
              </div>
            )}
          </>
        );
      })()}

      {/* ── Medicine section ── */}
      <SectionHeader label="Medicine" show={showMedicines} onToggle={() => setShowMedicines(v => !v)} Icon={Pill} iconColor={MED_COLOR} iconBg={MED_BG} />

      {showMedicines && (() => {
        const todayM = getTodayMedicines();
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {[
                { value: todayM.length || '—', label: 'Doses today' },
                { value: medicines.length || '—', label: 'Total logged' },
              ].map(({ value, label }) => (
                <div key={label} style={{ background: CARD, borderRadius: 14, padding: '12px 10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: MED_COLOR, letterSpacing: -0.5, marginBottom: 3 }}>{value}</div>
                  <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>
            {todayM.length > 0 ? (
              <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                {[...todayM].reverse().map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx < todayM.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: MED_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Pill size={16} color={MED_COLOR} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{m.name}</div>
                        {m.dose && <div style={{ fontSize: 12, color: TEXT2, marginTop: 1 }}>{m.dose}</div>}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>{new Date(m.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', textAlign: 'center', marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <p style={{ margin: 0, fontSize: 14, color: TEXT2 }}>No medicine logged today yet.</p>
              </div>
            )}
          </>
        );
      })()}

            <SectionHeader label="Previous Days" show={showPreviousDays} onToggle={() => setShowPreviousDays(p => !p)} Icon={BarChart2} iconColor={ACCENT} iconBg={ACCENT_BG} />
            {showPreviousDays && allPastKeys.map((dateKey) => {
              const dayFeeds = feeds.filter(f => new Date(f.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) === dateKey);
              const dayWW = wwByDay[dateKey] || [];
              const dayD = dByDay[dateKey] || [];
              const dayP = pByDay[dateKey] || [];
              const label = new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
              const total = dayFeeds.reduce((sum, f) => sum + f.amount, 0);
              const goalMet = dayFeeds.length > 0 && total >= recommendedDaily;
              const goalPct = Math.round((total / recommendedDaily) * 100);
              const expanded = expandedDays[dateKey];

              return (
                <div key={dateKey} style={{ background: CARD, borderRadius: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <button onClick={() => toggleDay(dateKey)} style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{label}</div>
                      <div style={{ fontSize: 13, color: TEXT2, marginTop: 2 }}>
                        {dayFeeds.length} feed{dayFeeds.length !== 1 ? 's' : ''}
                        {dayWW.length > 0 ? ` · ${dayWW.length} wake window${dayWW.length !== 1 ? 's' : ''}` : ''}
                        {dayD.length > 0 ? ` · ${dayD.length} diaper${dayD.length !== 1 ? 's' : ''}` : ''}
                        {dayP.length > 0 ? ` · ${dayP.length} pump${dayP.length !== 1 ? 's' : ''}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {dayFeeds.length > 0 && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4,
                          borderRadius: 20,
                          background: goalMet ? PUMP_BG : OVER_BG,
                          color: goalMet ? GREEN : RED,
                        }}>
                          {goalMet ? 'Goal met' : `${goalPct}% of goal`}
                        </span>
                      )}
                      {expanded ? <ChevronUp size={18} color={TEXT2} /> : <ChevronDown size={18} color={TEXT2} />}
                    </div>
                  </button>

                  {expanded && (
                    <div style={{ borderTop: `1px solid ${BORDER}`, padding: '12px 20px' }}>

                      {/* Feeds sub-section */}
                      {dayFeeds.length > 0 && (
                        <>
                          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Feeds</p>
                          {[...dayFeeds].reverse().map((feed, idx) => (
                            <div key={idx} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '9px 0',
                              borderBottom: idx < dayFeeds.length - 1 ? `1px solid ${BORDER}` : 'none',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Droplet size={13} color={ACCENT} />
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
                                  {new Date(feed.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </div>
                              <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT }}>{convert(feed.amount)}{unit}</span>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Wake windows sub-section */}
                      {dayWW.length > 0 && (
                        <>
                          <p style={{ margin: `${dayFeeds.length > 0 ? '14px' : '0'} 0 8px`, fontSize: 11, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Wake Windows</p>
                          {[...dayWW].reverse().map((w, idx) => {
                            const duration = new Date(w.end) - new Date(w.start);
                            const onTrack = duration / 60000 <= max;
                            return (
                              <div key={idx} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '9px 0',
                                borderBottom: idx < dayWW.length - 1 ? `1px solid ${BORDER}` : 'none',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Sun size={13} color={ACCENT} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
                                      {new Date(w.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – {new Date(w.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </div>
                                    <div style={{ fontSize: 11, color: TEXT2 }}>{formatDuration(duration)}</div>
                                  </div>
                                </div>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                                  background: onTrack ? PUMP_BG : OVER_BG,
                                  color: onTrack ? GREEN : RED,
                                }}>
                                  {onTrack ? 'On track' : 'Over window'}
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* Diapers sub-section */}
                      {dayD.length > 0 && (
                        <>
                          <p style={{ margin: `${dayFeeds.length > 0 || dayWW.length > 0 ? '14px' : '0'} 0 8px`, fontSize: 11, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Diapers</p>
                          {[...dayD].reverse().map((d, idx) => (
                            <div key={idx} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '9px 0',
                              borderBottom: idx < dayD.length - 1 ? `1px solid ${BORDER}` : 'none',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: DIAPER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Wind size={13} color={AMBER} />
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
                                  {new Date(d.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT2, textTransform: 'capitalize' }}>{d.type}</span>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Pumps sub-section */}
                      {dayP.length > 0 && (
                        <>
                          <p style={{ margin: `${dayFeeds.length > 0 || dayWW.length > 0 || dayD.length > 0 ? '14px' : '0'} 0 8px`, fontSize: 11, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pumping</p>
                          {[...dayP].reverse().map((p, idx) => (
                            <div key={idx} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '9px 0',
                              borderBottom: idx < dayP.length - 1 ? `1px solid ${BORDER}` : 'none',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: PUMP_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Activity size={13} color={GREEN} />
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
                                  {new Date(p.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                              </div>
                              <span style={{ fontSize: 15, fontWeight: 700, color: GREEN }}>{convert(p.amount)}{unit}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        );
      })()}
    </div>
    );
  };

  if (!roomCode) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', background: BG }}>
      <img src="/favicon.svg" alt="TeamBaby" style={{ width: 56, height: 56, marginBottom: 12 }} />
      <h1 style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 8 }}>TeamBaby</h1>
      <p style={{ fontSize: 15, color: TEXT2, marginBottom: 40 }}>Sync with your partner in real time</p>

      <div style={{ width: '100%', background: CARD, borderRadius: 20, padding: '24px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: 16 }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Create a room</p>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: TEXT2, lineHeight: 1.5 }}>Start a new shared room and invite your partner with a code.</p>
        <button onClick={createRoom} disabled={roomLoading} style={{ width: '100%', padding: '14px', background: roomLoading ? BORDER : ACCENT, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: roomLoading ? 'default' : 'pointer' }}>
          {roomLoading ? 'Creating…' : 'Create Room'}
        </button>
        {roomError && <p style={{ margin: '10px 0 0', fontSize: 13, color: RED }}>{roomError}</p>}
      </div>

      <div style={{ width: '100%', background: CARD, borderRadius: 20, padding: '24px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
        <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Join a room</p>
        <input
          type="text"
          placeholder="Enter room code"
          value={roomInput}
          onChange={e => { setRoomInput(e.target.value.toUpperCase()); setRoomError(''); }}
          style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: TEXT, letterSpacing: 2, marginBottom: 12, background: CARD }}
        />
        {roomError && <p style={{ margin: '0 0 10px', fontSize: 13, color: RED }}>{roomError}</p>}
        <button onClick={joinRoom} disabled={roomLoading} style={{ width: '100%', padding: '14px', background: roomLoading ? BORDER : TEXT, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: roomLoading ? 'default' : 'pointer' }}>
          {roomLoading ? 'Joining…' : 'Join Room'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      maxWidth: 430,
      margin: '0 auto',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: BG,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      color: TEXT,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 74 }}>
        {activeTab === 'home' && HomeTab()}
        {activeTab === 'stats' && StatsTab()}
        {activeTab === 'settings' && SettingsTab()}
      </div>

      {/* Quick Log Bottom Sheet */}
      {quickLogModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setQuickLogModal(null)}
        >
          <div
            style={{ background: CARD, borderRadius: '20px 20px 0 0', padding: '16px 20px 40px', maxWidth: 430, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: BORDER, borderRadius: 2, margin: '0 auto 20px' }} />

            {/* Shared time picker */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: BG, borderRadius: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>Time</span>
              <input type="time" value={logTime} onChange={e => setLogTime(e.target.value)}
                style={{ border: 'none', background: 'none', fontSize: 15, fontWeight: 600, color: TEXT, outline: 'none', cursor: 'pointer' }} />
            </div>

            {quickLogModal === 'feed' && (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: TEXT }}>Log a Feed</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                  {quickLogAmounts.map((amount, i) => (
                    <button key={amount} onClick={() => { logFeed(amount); setQuickLogModal(null); }} style={{
                      padding: '18px 8px', cursor: 'pointer',
                      border: i === 1 ? 'none' : `1.5px solid ${BORDER}`,
                      borderRadius: 14, fontSize: 17, fontWeight: 700,
                      background: i === 1 ? ACCENT : CARD,
                      color: i === 1 ? 'white' : TEXT,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      {convert(amount)}{unit}
                      <span style={{ fontSize: 11, fontWeight: 500, color: i === 1 ? 'rgba(255,255,255,0.75)' : TEXT2 }}>
                        {i === 0 ? 'Less' : i === 1 ? 'Suggested' : 'More'}
                      </span>
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <input
                    type="number"
                    placeholder={`Custom (${unit})`}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT, background: CARD }}
                  />
                  <button
                    onClick={() => { if (customAmount) { logFeed(parseFloat(customAmount)); setQuickLogModal(null); } }}
                    disabled={!customAmount}
                    style={{
                      padding: '12px 22px', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                      cursor: customAmount ? 'pointer' : 'not-allowed',
                      background: customAmount ? ACCENT : BORDER, color: 'white', opacity: customAmount ? 1 : 0.55,
                    }}
                  >Log</button>
                </div>
                {/* Formula calculator */}
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 16 }}>
                  <button onClick={() => setShowCalculator(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showCalculator ? 12 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Formula Calculator</span>
                    {showCalculator ? <ChevronUp size={15} color={TEXT2} /> : <ChevronDown size={15} color={TEXT2} />}
                  </button>
                  {showCalculator && <>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: TEXT2 }}>For {convert(recommended)}{unit} per feed:</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { value: calculateFormula(unit === 'ml' ? recommended : ozToMl(recommended)).scoops, label: 'Scoops' },
                        { value: convert(calculateFormula(unit === 'ml' ? recommended : ozToMl(recommended)).water), label: `${unit} Water` },
                      ].map(({ value, label }) => (
                        <div key={label} style={{ background: BG, borderRadius: 12, padding: '14px', textAlign: 'center' }}>
                          <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT, marginBottom: 2 }}>{value}</div>
                          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <p style={{ margin: '10px 0 0', fontSize: 11, color: TEXT2, fontStyle: 'italic' }}>1 scoop per 30ml (1oz) water</p>
                  </>}
                </div>
              </>
            )}

            {quickLogModal === 'diaper' && (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: TEXT }}>Log a Diaper</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { type: 'wet', label: 'Wet', emoji: '💧' },
                    { type: 'dirty', label: 'Dirty', emoji: '💩' },
                    { type: 'both', label: 'Both', emoji: '💧💩' },
                  ].map(({ type, label, emoji }) => (
                    <button key={type} onClick={() => logDiaper(type)} style={{
                      padding: '20px 8px', border: `1.5px solid ${BORDER}`, borderRadius: 14,
                      cursor: 'pointer', background: CARD, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: TEXT,
                    }}>
                      <span style={{ fontSize: 28 }}>{emoji}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {quickLogModal === 'pump' && (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: TEXT }}>Log a Pump</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    placeholder={`Amount (${unit})`}
                    value={pumpAmount}
                    onChange={(e) => setPumpAmount(e.target.value)}
                    style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT, background: CARD }}
                  />
                  <button
                    onClick={() => { if (pumpAmount) logPump(parseFloat(pumpAmount)); }}
                    disabled={!pumpAmount}
                    style={{
                      padding: '12px 22px', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                      cursor: pumpAmount ? 'pointer' : 'not-allowed',
                      background: pumpAmount ? ACCENT : BORDER, color: 'white', opacity: pumpAmount ? 1 : 0.55,
                    }}
                  >Log</button>
                </div>
              </>
            )}

            {quickLogModal === 'weight' && (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: TEXT }}>Log Weight</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Weight (g)"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT, background: CARD }}
                  />
                  <button
                    onClick={() => { if (weightInput) logWeight(parseFloat(weightInput)); }}
                    disabled={!weightInput}
                    style={{
                      padding: '12px 22px', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                      cursor: weightInput ? 'pointer' : 'not-allowed',
                      background: weightInput ? WEIGHT_COLOR : BORDER, color: 'white', opacity: weightInput ? 1 : 0.55,
                    }}
                  >Log</button>
                </div>
              </>
            )}

            {quickLogModal === 'medicine' && (
              <>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700, color: TEXT }}>Log Medicine</h3>
                <input
                  type="text"
                  placeholder="Medicine name (e.g. Vitamin D)"
                  value={medicineName}
                  onChange={(e) => setMedicineName(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT, background: CARD, marginBottom: 10, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Dose (optional, e.g. 1 drop)"
                    value={medicineDose}
                    onChange={(e) => setMedicineDose(e.target.value)}
                    style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT, background: CARD }}
                  />
                  <button
                    onClick={() => { if (medicineName) logMedicine(medicineName.trim(), medicineDose.trim()); }}
                    disabled={!medicineName}
                    style={{
                      padding: '12px 22px', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                      cursor: medicineName ? 'pointer' : 'not-allowed',
                      background: medicineName ? MED_COLOR : BORDER, color: 'white', opacity: medicineName ? 1 : 0.55,
                    }}
                  >Log</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        background: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: `1px solid ${BORDER}`,
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        zIndex: 100,
      }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            flex: 1, padding: '10px 0 8px', border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: activeTab === id ? ACCENT : TEXT2,
          }}>
            <Icon size={23} strokeWidth={activeTab === id ? 2.5 : 1.75} />
            <span style={{ fontSize: 11, fontWeight: activeTab === id ? 700 : 500 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
