import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, Timer, Target, Zap, TrendingUp,
  Award, AlertTriangle, CheckCircle, BarChart2, BookOpen,
  Briefcase, Wind, Monitor,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────
const MODES = {
  study: { label: 'Study',     Icon: BookOpen,  focus: 25, short: 5,  long: 15, accent: '#6366f1', bg: 'from-indigo-950 via-blue-950 to-slate-950' },
  work:  { label: 'Work',      Icon: Briefcase, focus: 25, short: 5,  long: 20, accent: '#4F46E5', bg: 'from-slate-900 via-slate-800 to-slate-900'  },
  walk:  { label: 'Walk',      Icon: Wind,      focus: 20, short: 10, long: 20, accent: '#4F46E5', bg: 'from-indigo-950 via-blue-950 to-slate-900'  },
  deep:  { label: 'Deep Work', Icon: Monitor,   focus: 45, short: 10, long: 30, accent: '#f59e0b', bg: 'from-zinc-950 via-neutral-900 to-zinc-950'   },
};
const PHASES = { idle: 'idle', focus: 'focus', short: 'short', long: 'long' };

const LS_SCORE    = 'pomo_score';
const LS_SESSIONS = 'pomo_sessions';
const LS_STREAK   = 'pomo_streak';

function todayStr() { return new Date().toISOString().split('T')[0]; }

function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function taskPomodoros(task) {
  const t = task.toLowerCase();
  if (/code|build|develop|implement|program/.test(t)) return 5;
  if (/write|essay|report|draft/.test(t))              return 4;
  if (/study|learn|research|read/.test(t))             return 3;
  if (/review|edit|check|fix/.test(t))                 return 2;
  if (/quick|simple|short|small/.test(t))              return 1;
  return 2;
}

function focusLevel(score) {
  if (score >= 400) return { label: 'Elite Focus',   color: 'text-amber-400'  };
  if (score >= 150) return { label: 'Deep Worker',   color: 'text-violet-400' };
  if (score >= 50)  return { label: 'Focused',       color: 'text-indigo-400' };
  return               { label: 'Beginner',           color: 'text-slate-400'  };
}

// ── Ring progress ──────────────────────────────────────────────
function TimerRing({ progress, accent, size = 200, stroke = 10 }) {
  const r   = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);
  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={accent} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s linear' }} />
    </svg>
  );
}

// ── Mini bar chart ─────────────────────────────────────────────
function WeekChart({ sessions }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    const count = sessions.filter(s => s.date === key && s.phase === 'focus').length;
    return { label: d.toLocaleDateString('en', { weekday: 'short' }), count };
  });
  const max = Math.max(...days.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-16">
      {days.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-sm bg-white/10 flex items-end" style={{ height: '48px' }}>
            <div
              className="w-full rounded-t-sm transition-all duration-500"
              style={{
                height: `${(d.count / max) * 48}px`,
                background: 'rgba(79,70,229,0.7)',
                minHeight: d.count ? '4px' : '0',
              }}
            />
          </div>
          <span className="text-[0.6rem] text-white/30">{d.label.slice(0, 2)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function PomodoroTool() {
  const [mode, setMode]           = useState('work');
  const [phase, setPhase]         = useState(PHASES.idle);
  const [timeLeft, setTimeLeft]   = useState(MODES.work.focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycle]    = useState(0);
  const [task, setTask]           = useState('');
  const [estPomos, setEstPomos]   = useState(2);
  const [distractions, setDist]   = useState(0);
  const [showDistWarn, setDistWarn] = useState(false);
  const [score, setScore]         = useState(() => loadLS(LS_SCORE, 0));
  const [sessions, setSessions]   = useState(() => loadLS(LS_SESSIONS, []));
  const [streak, setStreak]       = useState(() => loadLS(LS_STREAK, { date: '', count: 0 }));
  const [adaptiveTip, setAdaptiveTip] = useState('');
  const intervalRef  = useRef(null);
  const totalRef     = useRef(MODES.work.focus * 60);
  const phaseRef     = useRef(PHASES.idle);
  const soundCtxRef  = useRef(null);

  const cfg = MODES[mode];

  // ── Sync phase ref ─────────────────────────────────────────
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Play bell via Web Audio API ─────────────────────────────
  function playBell() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } catch {}
  }

  // ── Distraction detection ───────────────────────────────────
  useEffect(() => {
    function onBlur() {
      if (phaseRef.current === PHASES.focus && isRunning) {
        setDist(d => d + 1);
        setDistWarn(true);
        setTimeout(() => setDistWarn(false), 4000);
      }
    }
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [isRunning]);

  // ── Timer tick ─────────────────────────────────────────────
  const advancePhase = useCallback((currentPhase, currentCycle) => {
    let nextPhase, nextDuration, nextCycle = currentPhase === PHASES.focus ? currentCycle + 1 : currentCycle;

    if (currentPhase === PHASES.focus) {
      const newCycle = currentCycle + 1;
      nextCycle = newCycle;
      if (newCycle % 4 === 0) {
        nextPhase = PHASES.long;
        nextDuration = cfg.long * 60;
      } else {
        nextPhase = PHASES.short;
        nextDuration = cfg.short * 60;
      }
      // Record completed focus session
      const newSession = { date: todayStr(), phase: 'focus', mode, distractions };
      const updated = [...loadLS(LS_SESSIONS, []), newSession];
      saveLS(LS_SESSIONS, updated);
      setSessions(updated);

      // Score: +10, -2 per distraction (min 2)
      const earned = Math.max(2, 10 - distractions * 2);
      const newScore = score + earned;
      setScore(newScore);
      saveLS(LS_SCORE, newScore);

      // Streak update
      const today = todayStr();
      const s = loadLS(LS_STREAK, { date: '', count: 0 });
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const newStreak = s.date === today ? s : s.date === yesterdayStr
        ? { date: today, count: s.count + 1 }
        : { date: today, count: 1 };
      setStreak(newStreak);
      saveLS(LS_STREAK, newStreak);

      // Adaptive tip
      const recentSessions = updated.slice(-8).filter(s => s.phase === 'focus');
      const pausedOften = recentSessions.filter(s => s.distractions > 2).length > 3;
      const neverPaused = recentSessions.filter(s => s.distractions === 0).length >= 5;
      if (pausedOften) setAdaptiveTip('You seem to pause often — try a shorter 15-min session next time.');
      else if (neverPaused) setAdaptiveTip('Excellent focus streak! Consider a 35-min deep session.');
      else setAdaptiveTip('');
      setDist(0);
    } else {
      nextPhase = PHASES.focus;
      nextDuration = cfg.focus * 60;
    }

    playBell();
    setPhase(nextPhase);
    setTimeLeft(nextDuration);
    totalRef.current = nextDuration;
    setCycle(nextCycle);
    setIsRunning(true); // auto-start next phase
  }, [cfg, score, mode, distractions]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current);
            setIsRunning(false);
            advancePhase(phaseRef.current, cycleCount);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, advancePhase, cycleCount]);

  // ── Reset when mode changes ─────────────────────────────────
  function handleModeChange(newMode) {
    clearInterval(intervalRef.current);
    setMode(newMode);
    setIsRunning(false);
    setPhase(PHASES.idle);
    const dur = MODES[newMode].focus * 60;
    setTimeLeft(dur);
    totalRef.current = dur;
    setCycle(0);
    setDist(0);
  }

  function handleStart() {
    if (phase === PHASES.idle) {
      setPhase(PHASES.focus);
      const dur = cfg.focus * 60;
      setTimeLeft(dur);
      totalRef.current = dur;
    }
    setIsRunning(true);
  }

  function handlePause() { setIsRunning(false); }

  function handleReset() {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setPhase(PHASES.idle);
    const dur = cfg.focus * 60;
    setTimeLeft(dur);
    totalRef.current = dur;
    setCycle(0);
    setDist(0);
  }

  function handleTaskChange(val) {
    setTask(val);
    if (val.trim()) setEstPomos(taskPomodoros(val));
  }

  // ── Display values ──────────────────────────────────────────
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const progress = totalRef.current > 0 ? 1 - timeLeft / totalRef.current : 1;
  const { label: lvLabel, color: lvColor } = focusLevel(score);

  const phaseLabel = {
    [PHASES.idle]:  'Ready',
    [PHASES.focus]: 'Focus Time',
    [PHASES.short]: 'Short Break',
    [PHASES.long]:  'Long Break',
  }[phase];

  const todaySessions = sessions.filter(s => s.date === todayStr() && s.phase === 'focus').length;
  const todayMinutes  = todaySessions * cfg.focus;

  return (
    <div className={`rounded-2xl overflow-hidden bg-gradient-to-br ${cfg.bg} text-white shadow-xl`}>
      {/* Distraction warning */}
      {showDistWarn && (
        <div className="flex items-center gap-2 bg-amber-500/20 border-b border-amber-400/20 px-6 py-2.5 text-amber-300 text-sm animate-fadeUp">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>You are in a focus session. Stay on task.</span>
          <span className="ml-auto text-xs opacity-70">{distractions} distraction{distractions !== 1 ? 's' : ''} today</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">

        {/* ── Main timer area ──────────────────────────────── */}
        <div className="p-8 flex flex-col items-center gap-8">

          {/* Mode selector */}
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/8 flex-wrap justify-center">
            {Object.entries(MODES).map(([key, m]) => {
              const Icon = m.Icon;
              return (
                <button
                  key={key}
                  onClick={() => handleModeChange(key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    mode === key
                      ? 'bg-white/15 text-white'
                      : 'text-white/45 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Phase label */}
          <div className="text-center -mb-2">
            <span className={`text-xs font-semibold uppercase tracking-widest ${
              phase === PHASES.focus ? 'text-white/80' : phase === PHASES.idle ? 'text-white/40' : 'text-indigo-300'
            }`}>
              {phaseLabel}
            </span>
          </div>

          {/* Ring timer */}
          <div className="relative" style={{ width: 200, height: 200 }}>
            <TimerRing progress={progress} accent={cfg.accent} size={200} stroke={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-bold text-5xl tracking-tight tabular-nums">
                {mins}:{secs}
              </span>
              {cycleCount > 0 && (
                <span className="text-xs text-white/40 mt-1">
                  {cycleCount} session{cycleCount !== 1 ? 's' : ''} done
                </span>
              )}
            </div>
          </div>

          {/* Pomodoro dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full border transition-all ${
                  i < (cycleCount % 4)
                    ? 'border-transparent'
                    : 'border-white/20 bg-transparent'
                }`}
                style={i < (cycleCount % 4) ? { background: cfg.accent } : {}}
              />
            ))}
            <span className="text-xs text-white/30 ml-1">
              {4 - (cycleCount % 4)} until long break
            </span>
          </div>

          {/* Task input */}
          <div className="w-full max-w-sm space-y-2">
            <input
              type="text"
              value={task}
              onChange={e => handleTaskChange(e.target.value)}
              placeholder="What are you working on?"
              className="w-full px-4 py-2.5 rounded-xl bg-white/8 border border-white/12 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/12 transition-all"
            />
            {task.trim() && (
              <p className="text-xs text-white/40 text-center">
                Estimated: ~{estPomos} Pomodoro{estPomos !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-all"
              aria-label="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={isRunning ? handlePause : handleStart}
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all duration-150 hover:scale-105 active:scale-95"
              style={{ background: cfg.accent, boxShadow: `0 8px 32px ${cfg.accent}55` }}
              aria-label={isRunning ? 'Pause' : 'Start'}
            >
              {isRunning
                ? <Pause className="w-6 h-6 fill-current" />
                : <Play className="w-6 h-6 fill-current ml-0.5" />
              }
            </button>

            <div className="w-11 h-11 rounded-full border border-white/15 flex items-center justify-center text-white/40">
              <span className="text-xs font-bold tabular-nums">{cycleCount % 4}/4</span>
            </div>
          </div>

          {adaptiveTip && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white/60 max-w-sm text-center">
              <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              {adaptiveTip}
            </div>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────── */}
        <div className="border-t lg:border-t-0 lg:border-l border-white/8 p-6 space-y-6">

          {/* Focus level & score */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/8 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Focus Level</span>
              </div>
              <span className={`text-xs font-bold ${lvColor}`}>{lvLabel}</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-display font-bold">{score}</div>
                <div className="text-xs text-white/35">total points</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{streak.count}</div>
                <div className="text-xs text-white/35">day streak</div>
              </div>
            </div>
          </div>

          {/* Today stats */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/8">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-white/40" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Today</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Sessions', value: todaySessions },
                { label: 'Minutes',  value: todayMinutes },
                { label: 'Distractions', value: distractions },
                { label: 'Points',   value: score },
              ].map(({ label, value }) => (
                <div key={label} className="text-center bg-white/5 rounded-lg p-2.5 border border-white/8">
                  <div className="text-lg font-display font-bold">{value}</div>
                  <div className="text-[0.65rem] text-white/35">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Week chart */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/8">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-white/40" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Weekly Focus</span>
            </div>
            <WeekChart sessions={sessions} />
          </div>

          {/* Phase guide */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/8 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-white/40" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Session Guide</span>
            </div>
            {[
              { label: 'Focus',      value: `${cfg.focus} min`,  active: phase === PHASES.focus },
              { label: 'Short Break',value: `${cfg.short} min`,  active: phase === PHASES.short },
              { label: 'Long Break', value: `${cfg.long} min`,   active: phase === PHASES.long  },
            ].map(({ label, value, active }) => (
              <div key={label} className={`flex justify-between text-xs px-2.5 py-1.5 rounded-lg transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/35'}`}>
                <span>{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
