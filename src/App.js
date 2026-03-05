import React, { useState, useEffect, useRef } from 'react';
import { Home, Plus, BarChart2, Droplet, Calculator } from 'lucide-react';

const notifSupported = typeof Notification !== 'undefined';

const ACCENT = '#5856D6';
const BG = '#F2F2F7';
const CARD = '#FFFFFF';
const TEXT = '#1C1C1E';
const TEXT2 = '#8E8E93';
const BORDER = '#E5E5EA';
const GREEN = '#34C759';
const RED = '#FF3B30';

export default function App() {
  const [unit, setUnit] = useState('ml');
  const [feeds, setFeeds] = useState([]);
  const [babyAge, setBabyAge] = useState(2);
  const [babyName, setBabyName] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [nextFeedTime, setNextFeedTime] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [notifPermission, setNotifPermission] = useState(notifSupported ? Notification.permission : 'unsupported');
  const [timeUntilFeed, setTimeUntilFeed] = useState('');
  const notificationFired = useRef(false);


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

  const tabs = [
    { id: 'home', label: 'Home', Icon: Home },
    { id: 'log', label: 'Log', Icon: Plus },
    { id: 'stats', label: 'Stats', Icon: BarChart2 },
  ];

  // ── Home Tab ─────────────────────────────────────────────
  const HomeTab = () => (
    <div style={{ padding: '32px 20px 24px' }}>
      {/* Title */}
      <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>
        {babyName ? `${babyName}'s Milk Tracker` : "Baby Milk Tracker"}
      </h1>
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

      {/* Notification status */}
      {notifPermission === 'granted' && (
        <div style={{ background: CARD, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: TEXT2 }}>Notifications on — you'll be alerted at feed time</span>
        </div>
      )}
      {notifPermission === 'denied' && (
        <div style={{ background: CARD, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: RED, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: TEXT2 }}>Notifications blocked — enable in browser settings</span>
        </div>
      )}

      {/* Today summary */}
      <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Today
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{todayFeeds.length}</div>
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Feeds</div>
          </div>
          <div style={{ width: 1, background: BORDER }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>{convert(todayTotal)}{unit}</div>
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Total</div>
          </div>
          <div style={{ width: 1, background: BORDER }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: progressFrac >= 1 ? GREEN : TEXT, letterSpacing: -0.5 }}>
              {Math.round(progressFrac * 100)}%
            </div>
            <div style={{ fontSize: 12, color: TEXT2, fontWeight: 500, marginTop: 2 }}>Goal</div>
          </div>
        </div>
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
  const StatsTab = () => (
    <div style={{ padding: '32px 20px 24px' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 26, fontWeight: 700, color: TEXT, letterSpacing: -0.5 }}>Today's Stats</h2>

      {/* Progress ring card */}
      <div style={{ background: CARD, borderRadius: 16, padding: '24px 20px', marginBottom: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 24 }}>
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

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
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

      {/* Feed history */}
      {todayFeeds.length > 0 ? (
        <div style={{ background: CARD, borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: TEXT2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Feed History
          </p>
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
        <div style={{ background: CARD, borderRadius: 16, padding: '48px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <Droplet size={40} color={BORDER} style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontSize: 15, color: TEXT2 }}>No feeds logged today yet.</p>
        </div>
      )}
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
        {activeTab === 'log' && LogTab()}
        {activeTab === 'stats' && StatsTab()}
      </div>

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
