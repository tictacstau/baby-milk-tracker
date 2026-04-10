import React, { useState, useEffect, useRef } from 'react';
import { Home, Milk, BarChart2, Droplet, Calculator, ChevronDown, ChevronUp, Moon, Sun, Wind, Activity, Bell, BellOff } from 'lucide-react';

const notifSupported = typeof Notification !== 'undefined';
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua);
const isAndroid = /Android/.test(ua);
const notifSettingsPath = isIOS
  ? 'Settings app → Safari → Notifications'
  : isAndroid
  ? 'Chrome menu → Settings → Site settings → Notifications'
  : 'Browser settings → Site settings → Notifications';

const ACCENT = '#5856D6';
const BG = '#F2F2F7';
const CARD = '#FFFFFF';
const TEXT = '#1C1C1E';
const TEXT2 = '#8E8E93';
const BORDER = '#E5E5EA';
const GREEN = '#34C759';
const RED = '#FF3B30';
const AMBER = '#FF9500';

export default function App() {
  const [unit, setUnit] = useState('ml');
  const [feeds, setFeeds] = useState([]);
  const [babyAge, setBabyAge] = useState(2);
  const [babyName, setBabyName] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [nextFeedTime, setNextFeedTime] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [expandedDays, setExpandedDays] = useState({});
  const [showPreviousDays, setShowPreviousDays] = useState(false);
  const [isBabyAwake, setIsBabyAwake] = useState(false);
  const [wakeStartTime, setWakeStartTime] = useState(null);
  const [wakeWindows, setWakeWindows] = useState([]);
  const [wakeElapsed, setWakeElapsed] = useState('');
  const [notifPermission, setNotifPermission] = useState(notifSupported ? Notification.permission : 'unsupported');
  const [showBellTooltip, setShowBellTooltip] = useState(false);
  const [timeUntilFeed, setTimeUntilFeed] = useState('');
  const notificationFired = useRef(false);
  const [diapers, setDiapers] = useState([]);
  const [pumps, setPumps] = useState([]);
  const [quickLogModal, setQuickLogModal] = useState(null); // null | 'feed' | 'diaper' | 'pump'
  const [pumpAmount, setPumpAmount] = useState('');


  // Load from localStorage
  useEffect(() => {
    try {
      const feedsData = localStorage.getItem('feeds');
      const settingsData = localStorage.getItem('settings');
      if (feedsData) {
        const parsed = JSON.parse(feedsData);
        setFeeds(parsed);
        if (parsed.length > 0) {
          const lastFeed = parsed[parsed.length - 1];
          const nextTime = new Date(lastFeed.timestamp);
          nextTime.setHours(nextTime.getHours() + 3);
          setNextFeedTime(nextTime);
        }
      }
      if (settingsData) {
        const parsed = JSON.parse(settingsData);
        setUnit(parsed.unit || 'ml');
        setBabyAge(parsed.babyAge || 2);
        setBabyName(parsed.babyName || '');
      }
      const diapersData = localStorage.getItem('diapers');
      const pumpsData = localStorage.getItem('pumps');
      if (diapersData) setDiapers(JSON.parse(diapersData));
      if (pumpsData) setPumps(JSON.parse(pumpsData));
      const wakeData = localStorage.getItem('wakeWindows');
      const wakeState = localStorage.getItem('wakeState');
      if (wakeData) setWakeWindows(JSON.parse(wakeData));
      if (wakeState) {
        const { awake, startTime } = JSON.parse(wakeState);
        setIsBabyAwake(awake);
        setWakeStartTime(startTime ? new Date(startTime) : null);
      }
    } catch (e) {
      console.log('Starting fresh');
    }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify({ unit, babyAge, babyName }));
  }, [unit, babyAge, babyName]);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (nextFeedTime) {
        const diff = nextFeedTime - new Date();
        if (diff <= 0) {
          setTimeUntilFeed('Feed time!');
          if (!notificationFired.current && notifSupported && Notification.permission === 'granted') {
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
  }, [nextFeedTime, babyName]);

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
      localStorage.setItem('wakeState', JSON.stringify({ awake: true, startTime: now.toISOString() }));
    } else {
      const ended = new Date();
      const entry = { start: wakeStartTime.toISOString(), end: ended.toISOString() };
      const updated = [...wakeWindows, entry];
      setWakeWindows(updated);
      setIsBabyAwake(false);
      setWakeStartTime(null);
      localStorage.setItem('wakeWindows', JSON.stringify(updated));
      localStorage.setItem('wakeState', JSON.stringify({ awake: false, startTime: null }));
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
      timestamp: new Date().toISOString(),
      amount: unit === 'oz' ? ozToMl(amount) : amount,
      unit,
    };
    const updatedFeeds = [...feeds, newFeed];
    setFeeds(updatedFeeds);
    localStorage.setItem('feeds', JSON.stringify(updatedFeeds));
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
    const entry = { timestamp: new Date().toISOString(), type };
    const updated = [...diapers, entry];
    setDiapers(updated);
    localStorage.setItem('diapers', JSON.stringify(updated));
    setQuickLogModal(null);
  };

  const logPump = (amount) => {
    const entry = { timestamp: new Date().toISOString(), amount: unit === 'oz' ? ozToMl(amount) : amount };
    const updated = [...pumps, entry];
    setPumps(updated);
    localStorage.setItem('pumps', JSON.stringify(updated));
    setPumpAmount('');
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

  // ── Sleep Tab ─────────────────────────────────────────────
  const SleepTab = () => {
    const status = getWakeStatus();
    const { min, max } = getRecommendedWakeWindow();
    const todayWakeWindows = getTodayWakeWindows();

    return (
      <div style={{ padding: '32px 20px 24px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>Wake Windows</h2>
        <p style={{ margin: '0 0 24px', fontSize: 15, color: TEXT2 }}>
          Recommended: {min}–{max} min for a {babyAge}-week-old
        </p>

        {/* Toggle button */}
        <button onClick={toggleWakeState} style={{
          width: '100%', border: 'none', borderRadius: 18, padding: '22px 20px',
          cursor: 'pointer', marginBottom: 16,
          background: isBabyAwake ? '#FFF8EC' : ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'background 0.2s',
        }}>
          {isBabyAwake
            ? <Moon size={22} color={AMBER} />
            : <Sun size={22} color="white" />}
          <span style={{ fontSize: 17, fontWeight: 700, color: isBabyAwake ? AMBER : 'white' }}>
            {isBabyAwake ? 'Baby fell asleep' : 'Baby woke up'}
          </span>
        </button>

        {/* Live timer */}
        {isBabyAwake && wakeStartTime && (
          <div style={{ background: CARD, borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1, color: status?.color || TEXT, lineHeight: 1 }}>
              {wakeElapsed || '0m'}
            </div>
            <div style={{ fontSize: 13, color: TEXT2, marginTop: 6 }}>awake since {new Date(wakeStartTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
            {status && (
              <div style={{
                display: 'inline-block', marginTop: 12,
                padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: status.color === GREEN ? '#E8FAF0' : status.color === AMBER ? '#FFF3E0' : '#FFF0EE',
                color: status.color,
              }}>
                {status.label}
              </div>
            )}
          </div>
        )}

        {/* Today's wake windows */}
        {todayWakeWindows.length > 0 && (
          <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Today's Wake Windows
            </p>
            {[...todayWakeWindows].reverse().map((w, idx) => {
              const duration = new Date(w.end) - new Date(w.start);
              const { max } = getRecommendedWakeWindow();
              const withinGoal = duration / 60000 <= max;
              return (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 0',
                  borderBottom: idx < todayWakeWindows.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sun size={15} color={ACCENT} />
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
                    background: withinGoal ? '#E8FAF0' : '#FFF0EE',
                    color: withinGoal ? GREEN : RED,
                  }}>
                    {withinGoal ? 'On track' : 'Over window'}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!isBabyAwake && todayWakeWindows.length === 0 && (
          <div style={{ background: CARD, borderRadius: 16, padding: '48px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Moon size={40} color={BORDER} style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 15, color: TEXT2 }}>Tap the button when baby wakes up.</p>
          </div>
        )}
      </div>
    );
  };

  const tabs = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'log', label: 'Feed', Icon: Milk },
    { id: 'sleep', label: 'Sleep', Icon: Moon },
    { id: 'stats', label: 'Stats', Icon: BarChart2 },
  ];

  // ── Home Tab ─────────────────────────────────────────────
  const HomeTab = () => (
    <div style={{ padding: '32px 20px 24px' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>
          {babyName ? `${babyName}'s Tracker` : "babies.fit"}
        </h1>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowBellTooltip(v => !v)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            {notifPermission === 'granted' && <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: GREEN, border: '1.5px solid white' }} />}
            {notifPermission === 'granted' ? <Bell size={18} color={TEXT2} /> : <BellOff size={18} color={notifPermission === 'denied' ? RED : TEXT2} />}
          </button>
          {showBellTooltip && (
            <div style={{
              position: 'absolute', top: 38, right: 0, zIndex: 100,
              background: '#1a1a2e', color: 'white',
              fontSize: 12, fontWeight: 500, lineHeight: 1.5,
              padding: '10px 14px', borderRadius: 10,
              width: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {notifPermission === 'granted' ? (
                <>
                  <div style={{ marginBottom: 6 }}>You'll be alerted at feed time.</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)' }}>To turn off: {notifSettingsPath}.</div>
                </>
              ) : notifPermission === 'denied' ? (
                <>
                  <div style={{ marginBottom: 6 }}>Notifications are blocked.</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)' }}>To enable: {notifSettingsPath}.</div>
                </>
              ) : (
                <div>Notifications not enabled.</div>
              )}
            </div>
          )}
        </div>
      </div>
      <p style={{ margin: '0 0 36px', fontSize: 15, color: TEXT2 }}>You got this, Mama & Papa Bear 💪</p>

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
            <span style={{ fontSize: elapsedFrac >= 1 ? 28 : 38, fontWeight: 700, color: timerColor, letterSpacing: -1, lineHeight: 1 }}>
              {timeUntilFeed}
            </span>
            <span style={{ fontSize: 13, color: TEXT2, fontWeight: 500, marginTop: 6 }}>until next feed</span>
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
          { id: 'feed', label: 'Feed', Icon: Milk, color: ACCENT, bg: '#F0F0FF' },
          { id: 'diaper', label: 'Diaper', Icon: Wind, color: AMBER, bg: '#FFF3E0' },
          { id: 'pump', label: 'Pump', Icon: Activity, color: GREEN, bg: '#E8FAF0' },
        ].map(({ id, label, Icon, color, bg }) => (
          <button key={id} onClick={() => setQuickLogModal(id)} style={{
            background: CARD, border: 'none', borderRadius: 16, padding: '16px 8px',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={color} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Log {label}</span>
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
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: isBabyAwake ? '#FFF8EC' : '#F0F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                background: status.color === GREEN ? '#E8FAF0' : status.color === AMBER ? '#FFF3E0' : '#FFF0EE',
                color: status.color,
              }}>
                {status.label}
              </span>
            )}
          </div>
        );
      })()}


      {/* Today summary */}
      <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Today
        </p>

        {/* Feed row */}
        <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: TEXT2, letterSpacing: 0.4 }}>Feeds</p>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 18 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{todayFeeds.length}</div>
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Count</div>
          </div>
          <div style={{ width: 1, background: BORDER }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{convert(todayTotal)}{unit}</div>
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Total</div>
          </div>
          <div style={{ width: 1, background: BORDER }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: progressFrac >= 1 ? GREEN : TEXT, letterSpacing: -0.5 }}>
              {Math.round(progressFrac * 100)}%
            </div>
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Goal</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: BORDER, marginBottom: 14 }} />

        {/* Sleep row */}
        {(() => {
          const todayWW = getTodayWakeWindows();
          const totalAwakeMs = todayWW.reduce((sum, w) => sum + (new Date(w.end) - new Date(w.start)), 0);
          const { max } = getRecommendedWakeWindow();
          const wwOnTrack = todayWW.filter(w => (new Date(w.end) - new Date(w.start)) / 60000 <= max).length;
          return (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: TEXT2, letterSpacing: 0.4 }}>Sleep</p>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{todayWW.length}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Windows</div>
                </div>
                <div style={{ width: 1, background: BORDER }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{todayWW.length > 0 ? formatDuration(totalAwakeMs) : '—'}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Awake</div>
                </div>
                <div style={{ width: 1, background: BORDER }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: todayWW.length > 0 && wwOnTrack === todayWW.length ? GREEN : TEXT, letterSpacing: -0.5 }}>
                    {todayWW.length > 0 ? `${wwOnTrack}/${todayWW.length}` : '—'}
                  </div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>On track</div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Divider */}
        <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />

        {/* Diaper row */}
        {(() => {
          const td = getTodayDiapers();
          const wetCount = td.filter(d => d.type === 'wet' || d.type === 'both').length;
          const dirtyCount = td.filter(d => d.type === 'dirty' || d.type === 'both').length;
          return (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: TEXT2, letterSpacing: 0.4 }}>Diapers</p>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{td.length}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Total</div>
                </div>
                <div style={{ width: 1, background: BORDER }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{td.length > 0 ? wetCount : '—'}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Wet</div>
                </div>
                <div style={{ width: 1, background: BORDER }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{td.length > 0 ? dirtyCount : '—'}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Dirty</div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Divider */}
        <div style={{ height: 1, background: BORDER, margin: '14px 0' }} />

        {/* Pump row */}
        {(() => {
          const tp = getTodayPumps();
          const pumpTotal = tp.reduce((sum, p) => sum + p.amount, 0);
          return (
            <>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: TEXT2, letterSpacing: 0.4 }}>Pumping</p>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{tp.length}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Sessions</div>
                </div>
                <div style={{ width: 1, background: BORDER }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{tp.length > 0 ? `${convert(pumpTotal)}${unit}` : '—'}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Total</div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );

  // ── Log Tab ──────────────────────────────────────────────
  const LogTab = () => (
    <div style={{ padding: '32px 20px 24px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>Log a Feed</h2>

      {/* Settings */}
      <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', gap: 20, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Baby's Name
          </label>
          <input
            type="text"
            placeholder="e.g. Liam"
            value={babyName}
            onChange={(e) => setBabyName(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: TEXT }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Baby's Age (weeks)
          </label>
          <input
            type="number"
            value={babyAge || ''}
            onChange={(e) => setBabyAge(parseInt(e.target.value) || 0)}
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, fontWeight: 600, outline: 'none', boxSizing: 'border-box', color: TEXT }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Units
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ml', 'oz'].map((u) => (
              <button key={u} onClick={() => setUnit(u)} style={{
                padding: '10px 18px', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
                background: unit === u ? ACCENT : BG,
                color: unit === u ? 'white' : TEXT2,
              }}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick amounts */}
      <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Quick Log
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: TEXT2 }}>
          Recommended: {convert(recommended)}{unit} per feeding
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {quickLogAmounts.map((amount, i) => (
            <button key={amount} onClick={() => logFeed(amount)} style={{
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

        {/* Custom amount */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            placeholder={`Custom (${unit})`}
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT }}
          />
          <button
            onClick={() => customAmount && logFeed(parseFloat(customAmount))}
            disabled={!customAmount}
            style={{
              padding: '12px 22px', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: customAmount ? 'pointer' : 'not-allowed',
              background: customAmount ? ACCENT : BORDER,
              color: 'white', opacity: customAmount ? 1 : 0.55,
              transition: 'opacity 0.15s',
            }}
          >
            Log
          </button>
        </div>
      </div>

      {/* Formula calculator */}
      <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <button onClick={() => setShowCalculator(!showCalculator)} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Calculator size={20} color={ACCENT} />
            <span style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>Formula Calculator</span>
          </div>
          <span style={{ fontSize: 22, color: TEXT2, lineHeight: 1, fontWeight: 300 }}>
            {showCalculator ? '−' : '+'}
          </span>
        </button>

        {showCalculator && (
          <div style={{ marginTop: 16, padding: 16, background: BG, borderRadius: 12 }}>
            <p style={{ margin: '0 0 14px', fontSize: 14, color: TEXT2 }}>
              For {convert(recommended)}{unit} of milk:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { value: calculateFormula(unit === 'ml' ? recommended : ozToMl(recommended)).scoops, label: 'Scoops' },
                { value: convert(calculateFormula(unit === 'ml' ? recommended : ozToMl(recommended)).water), label: `${unit} Water` },
              ].map(({ value, label }) => (
                <div key={label} style={{ background: CARD, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 12, color: TEXT2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                </div>
              ))}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: TEXT2, fontStyle: 'italic' }}>
              Standard ratio: 1 scoop per 30ml (1oz) water
            </p>
          </div>
        )}
      </div>
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

    return (
    <div style={{ padding: '32px 20px 24px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>Today's Stats</h2>

      {/* ── Feeds section ── */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Feeds</p>

      {/* Progress ring card */}
      <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 24 }}>
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
            <span style={{ fontSize: 20, fontWeight: 700, color: progressFrac >= 1 ? GREEN : TEXT }}>
              {Math.round(progressFrac * 100)}%
            </span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>
            {convert(todayTotal)}{unit}
          </div>
          <div style={{ fontSize: 14, color: TEXT2, marginBottom: 10 }}>
            of {convert(recommendedDaily)}{unit} daily goal
          </div>
          <div style={{ fontSize: 14, color: TEXT2 }}>
            {todayFeeds.length} feed{todayFeeds.length !== 1 ? 's' : ''} today
          </div>
        </div>
      </div>

      {/* Feed stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: CARD, borderRadius: 14, padding: '18px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>
            {todayFeeds.length > 0 ? `${convert(Math.round(todayTotal / todayFeeds.length))}${unit}` : '—'}
          </div>
          <div style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>Avg per feed</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: '18px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: progressFrac >= 1 ? GREEN : TEXT, letterSpacing: -0.5, marginBottom: 4 }}>
            {progressFrac >= 1 ? '✓ Done' : `${convert(Math.max(recommendedDaily - todayTotal, 0))}${unit}`}
          </div>
          <div style={{ fontSize: 13, color: TEXT2, fontWeight: 500 }}>Remaining</div>
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

      {/* ── Sleep section ── */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Sleep</p>

      {/* Sleep stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ background: CARD, borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>{todayWW.length}</div>
          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>Wake windows</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>{todayWW.length > 0 ? formatDuration(totalAwakeMs) : '—'}</div>
          <div style={{ fontSize: 11, color: TEXT2, fontWeight: 500 }}>Total awake</div>
        </div>
        <div style={{ background: CARD, borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: todayWW.length > 0 && wwOnTrack === todayWW.length ? GREEN : TEXT, letterSpacing: -0.5, marginBottom: 4 }}>
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
                  background: onTrack ? '#E8FAF0' : '#FFF0EE',
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

      {/* ── Diapers section ── */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Diapers</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { value: todayD.length || '—', label: 'Total' },
          { value: todayD.length > 0 ? wetCount : '—', label: 'Wet' },
          { value: todayD.length > 0 ? dirtyCount : '—', label: 'Dirty' },
        ].map(({ value, label }) => (
          <div key={label} style={{ background: CARD, borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>{value}</div>
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
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

      {/* ── Pumping section ── */}
      <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>Pumping</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {[
          { value: todayP.length || '—', label: 'Sessions' },
          { value: todayP.length > 0 ? `${convert(pumpTotal)}${unit}` : '—', label: 'Total' },
          { value: todayP.length > 0 ? `${convert(avgPump)}${unit}` : '—', label: 'Avg' },
        ].map(({ value, label }) => (
          <div key={label} style={{ background: CARD, borderRadius: 14, padding: '14px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: TEXT, letterSpacing: -0.5, marginBottom: 4 }}>{value}</div>
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
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E8FAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
            <div style={{ background: CARD, borderRadius: 16, padding: '16px 20px', marginBottom: showPreviousDays ? 12 : 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <button onClick={() => setShowPreviousDays(p => !p)} style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BarChart2 size={20} color={ACCENT} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>Previous Days</span>
                </div>
                <span style={{ fontSize: 22, color: TEXT2, lineHeight: 1, fontWeight: 300 }}>
                  {showPreviousDays ? '−' : '+'}
                </span>
              </button>
            </div>
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
                          background: goalMet ? '#E8FAF0' : '#FFF0EE',
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
                                  background: onTrack ? '#E8FAF0' : '#FFF0EE',
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
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#E8FAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
        {activeTab === 'log' && LogTab()}
        {activeTab === 'stats' && StatsTab()}
        {activeTab === 'sleep' && <SleepTab />}
      </div>

      {/* Quick Log Bottom Sheet */}
      {quickLogModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setQuickLogModal(null)}
        >
          <div
            style={{ background: CARD, borderRadius: '20px 20px 0 0', padding: '16px 20px 40px', maxWidth: 430, width: '100%', margin: '0 auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: BORDER, borderRadius: 2, margin: '0 auto 20px' }} />

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
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    placeholder={`Custom (${unit})`}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT }}
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
                    style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 16, outline: 'none', color: TEXT }}
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
        background: 'rgba(255,255,255,0.92)',
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
