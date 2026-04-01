import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const Sidebar = ({ active, setActive, logout, user }) => {
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'homework', icon: '📋', label: 'Uy vazifalari' },
    { id: 'classwork', icon: '⏱️', label: 'Darsda vazifalar' },
    { id: 'schedule', icon: '📊', label: 'Jadval' },
    { id: 'chat', icon: '💬', label: 'Chat' },
    { id: 'profile', icon: '👤', label: 'Profil' },
  ];
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>🤖 Ustoz AI</h1>
        <p>O'quvchi paneli</p>
      </div>
      {user && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600' }}>{user.full_name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{user.email}</div>
        </div>
      )}
      <nav className="sidebar-nav">
        {items.map(item => (
          <button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`}
            onClick={() => setActive(item.id)}>
            <span className="icon">{item.icon}</span> {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <a
          href="https://t.me/UstozYordamchi_AI_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-item"
          style={{ color: '#229ED9', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
        >
          <span className="icon">✈️</span> Ota-ona paneli
        </a>
        <button className="nav-item" onClick={logout} style={{ color: 'var(--danger)' }}>
          <span className="icon">🚪</span> Chiqish
        </button>
      </div>
    </div>
  );
};

export default function StudentPanel() {
  const [active, setActive] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    API.get('/student/dashboard').then(r => setDashboard(r.data)).catch(console.error);
  }, []);

  const group = dashboard?.groups?.[0];

  return (
    <div className="panel-layout">
      <Sidebar active={active} setActive={setActive} logout={handleLogout} user={user} />
      <main className="main-content">
        {active === 'dashboard' && <StudentDashboard data={dashboard} />}
        {active === 'homework' && <StudentHomework />}
        {active === 'classwork' && <StudentClasswork />}
        {active === 'schedule' && <StudentSchedule group={group} userId={user?.id} />}
        {active === 'chat' && group
          ? <StudentChat group={group} />
          : active === 'chat' && <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Guruhga qo'shilmagan</div>}
        {active === 'profile' && <StudentProfile />}
      </main>
    </div>
  );
}

// ── DASHBOARD ──
function StudentDashboard({ data }) {
  const [attendance, setAttendance] = useState([]);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    API.get('/student/attendance').then(r => setAttendance(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="loading"><div className="spinner" /></div>;

  const group = data.groups?.[0];

  // Dars kunlarini hisoblash
  const getLessonDates = (g) => {
    if (!g?.start_date || !g?.end_date) return new Set();
    const dates = new Set();
    let d = new Date(g.start_date);
    const end = new Date(g.end_date);
    while (d <= end) {
      const day = d.getDay();
      let ok = false;
      if (g.lesson_days === 'juft') ok = [2, 4, 6].includes(day);
      else if (g.lesson_days === 'toq') ok = [1, 3, 5].includes(day);
      else ok = day !== 0;
      if (ok) dates.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const lessonDates = group ? getLessonDates(group) : new Set();

  // Attendance map: {date: 'present'|'absent'}
  const attMap = {};
  attendance.forEach(a => { attMap[a.lesson_date?.slice(0, 10)] = a.status; });

  // Bugun dars bormi?
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayHasLesson = lessonDates.has(todayStr);

  // Soat formatlash
  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;
  const lessonType = group?.lesson_days === 'juft' ? 'Juft kunlar' : group?.lesson_days === 'toq' ? 'Toq kunlar' : 'Har kuni';

  // Kalendar (joriy oy)
  const now = clock;
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  const dayNames = ['Du','Se','Ch','Pa','Ju','Sh','Ya'];
  // Adjust: start from Monday
  const startOffset = (firstDay + 6) % 7; // Mon=0

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Salom, {data.user?.full_name?.split(' ')[0]}! 👋</h2>
        <p>Bugungi faoliyatingiz</p>
      </div>

      {/* Clock + Dars info */}
      {group && (
        <div className="card" style={{ marginBottom: '16px', background: 'linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)', color: '#fff', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', opacity: 0.85, marginBottom: '4px' }}>{lessonType}</div>
              <div style={{ fontSize: '32px', fontFamily: 'var(--font2)', fontWeight: '700', letterSpacing: '1px' }}>
                🕐 {timeStr}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', opacity: 0.85 }}>{group.name}</div>
              {group.lesson_time && <div style={{ fontSize: '20px', fontWeight: '700', marginTop: '4px' }}>⏰ {group.lesson_time?.slice(0,5)}</div>}
              <div style={{
                marginTop: '8px', padding: '6px 14px', borderRadius: '20px', fontSize: '14px', fontWeight: '700',
                background: todayHasLesson ? 'rgba(34,197,94,0.9)' : 'rgba(0,0,0,0.25)',
                display: 'inline-block'
              }}>
                {todayHasLesson ? '✅ Bugun dars bor!' : '😴 Bugun dars yo\'q'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card">
          <div style={{ fontSize: '28px' }}>📋</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{data.pending_assignments || 0}</div>
          <div className="stat-label">Kutayotgan vazifalar</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: '28px' }}>✅</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{attendance.filter(a => a.status === 'present').length}</div>
          <div className="stat-label">Darsda bo'lganlar</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: '28px' }}>❌</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{attendance.filter(a => a.status === 'absent').length}</div>
          <div className="stat-label">Qoldirilgan darslar</div>
        </div>
      </div>

      {/* Calendar */}
      {group && (
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '16px' }}>
            📅 {monthNames[month]} {year}
          </h3>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[
              { color: 'rgba(34,197,94,0.25)', border: '1.5px solid rgba(34,197,94,0.6)', label: 'Keldim ✅' },
              { color: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.4)', label: 'Kelmadim ❌' },
              { color: 'rgba(91,141,238,0.15)', border: '1.5px solid var(--accent)', label: 'Dars kuni 📚' },
              { color: 'rgba(250,204,21,0.2)', border: '2px solid var(--warning)', label: 'Bugun 📍' },
            ].map((l, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text2)' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: l.color, border: l.border }} />
                {l.label}
              </div>
            ))}
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
            {dayNames.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--text3)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;
              const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
              const isToday = dateStr === todayStr;
              const isLesson = lessonDates.has(dateStr);
              const attStatus = attMap[dateStr]; // 'present', 'absent', or undefined
              const isFuture = dateStr > todayStr;

              let bg = 'transparent';
              let border = '1.5px solid transparent';
              let color = 'var(--text)';
              let emoji = '';

              if (isToday) {
                border = '2px solid var(--warning)';
                bg = 'rgba(250,204,21,0.15)';
                color = 'var(--warning)';
              }
              if (isLesson && !isFuture) {
                if (attStatus === 'present') {
                  bg = 'rgba(34,197,94,0.2)';
                  border = '1.5px solid rgba(34,197,94,0.55)';
                  color = 'var(--success)';
                  emoji = '✓';
                } else if (attStatus === 'absent') {
                  bg = 'rgba(239,68,68,0.13)';
                  border = '1.5px solid rgba(239,68,68,0.35)';
                  color = 'var(--danger)';
                  emoji = '✗';
                } else {
                  // lesson day but no attendance recorded yet
                  if (!isToday) {
                    bg = 'rgba(91,141,238,0.1)';
                    border = '1.5px solid rgba(91,141,238,0.3)';
                    color = 'var(--accent)';
                  }
                }
              }
              if (isLesson && isFuture) {
                bg = 'rgba(91,141,238,0.08)';
                border = '1.5px solid rgba(91,141,238,0.2)';
                color = 'var(--accent)';
              }

              return (
                <div key={dateStr} style={{
                  aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '8px', background: bg, border, cursor: 'default', transition: 'all 0.15s',
                }} title={isLesson ? (attStatus === 'present' ? 'Keldim ✅' : attStatus === 'absent' ? 'Kelmadim ❌' : 'Dars kuni') : ''}>
                  <span style={{ fontSize: '13px', fontWeight: isToday ? '800' : isLesson ? '700' : '400', color }}>{day}</span>
                  {emoji && <span style={{ fontSize: '9px', lineHeight: 1 }}>{emoji}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── HOMEWORK ──
function StudentHomework() {
  const [assignments, setAssignments] = useState([]);
  const [tab, setTab] = useState('all');
  const [showSubmit, setShowSubmit] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const r = await API.get('/student/assignments/homework');
    setAssignments(r.data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await API.post(`/student/assignments/${showSubmit}/submit`, { content });
      setShowSubmit(null); setContent(''); load();
    } catch (e) { alert(e.response?.data?.error || 'Xatolik'); }
    setSubmitting(false);
  };

  const isExpired = (a) => {
    if (!a.due_date) return false;
    const deadline = new Date(`${a.due_date}T${a.due_time || '23:59:59'}`);
    return new Date() > deadline;
  };

  const counts = {
    all: assignments.length,
    pending: assignments.filter(a => !a.my_submission_id && a.is_open && !isExpired(a)).length,
    done: assignments.filter(a => !!a.my_submission_id).length,
  };

  const filtered = assignments.filter(a => {
    if (tab === 'pending') return !a.my_submission_id && a.is_open && !isExpired(a);
    if (tab === 'done') return !!a.my_submission_id;
    return true;
  });

  return (
    <div className="fade-in">
      <div className="page-header"><h2>📋 Uy vazifalari</h2></div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `Barchasi (${counts.all})` },
          { id: 'pending', label: `Kutilmoqda (${counts.pending})` },
          { id: 'done', label: `Bajarilgan (${counts.done})` },
        ].map(t => (
          <button key={t.id} className={`btn ${tab === t.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {loading && <div className="loading"><div className="spinner" /></div>}

      {filtered.map(a => {
        const expired = isExpired(a);
        const done = !!a.my_submission_id;
        return (
          <div key={a.id} className="card" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ marginBottom: '6px' }}>{a.title}</h4>
                {a.description && <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>{a.description}</p>}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className={`tag ${expired && !done ? 'tag-red' : 'tag-blue'}`}>📅 {a.due_date?.slice(0, 10)}</span>
                  <span className="tag tag-purple">🕐 {a.due_time}</span>
                  {done && <span className="tag tag-green">✅ Topshirilgan</span>}
                  {!done && expired && <span className="tag tag-red">⌛ Muddati o'tgan</span>}
                  {!done && !expired && <span className="tag tag-yellow">⏳ Kutilmoqda</span>}
                  {a.my_score > 0 && <span className="tag tag-blue">⭐ {a.my_score} ball</span>}
                </div>
              </div>
              {!done && !expired && a.is_open && (
                <button className="btn btn-primary btn-sm" style={{ marginLeft: '12px' }}
                  onClick={() => setShowSubmit(a.id)}>📤 Yuborish</button>
              )}
            </div>
          </div>
        );
      })}

      {showSubmit && (
        <div className="modal-overlay" onClick={() => setShowSubmit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📤 Vazifa yuborish</span>
              <button className="modal-close" onClick={() => setShowSubmit(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Javob / Kod</label>
                <textarea className="input" rows={10} value={content} onChange={e => setContent(e.target.value)}
                  required placeholder="Javobingiz yoki kodingiz..."
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? '⏳...' : '📤 Yuborish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CLASSWORK ──
function StudentClasswork() {
  const [assignments, setAssignments] = useState([]);
  const [showSubmit, setShowSubmit] = useState(null);
  const [content, setContent] = useState('');
  const [timers, setTimers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => setTimers(p => {
      const n = { ...p };
      Object.keys(n).forEach(id => { if (n[id] > 0) n[id]--; });
      return n;
    }), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const r = await API.get('/student/assignments/classwork');
    setAssignments(r.data);
    const t = {};
    const now = Date.now();
    r.data.forEach(a => {
      if (a.is_open && a.duration_minutes && a.started_at) {
        const startedAt = new Date(a.started_at).getTime();
        const totalSec = a.duration_minutes * 60;
        const elapsed = Math.floor((now - startedAt) / 1000);
        const remaining = totalSec - elapsed;
        t[a.id] = remaining > 0 ? remaining : 0;
      }
    });
    setTimers(t);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await API.post(`/student/assignments/${showSubmit}/submit`, { content });
      setShowSubmit(null); setContent(''); load();
    } catch (e) { alert(e.response?.data?.error || 'Xatolik'); }
    setSubmitting(false);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fade-in">
      <div className="page-header"><h2>⏱️ Darsda vazifalar</h2></div>
      {assignments.map(a => (
        <div key={a.id} className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <h4>{a.title}</h4>
              {a.description && <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{a.description}</p>}
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <span className="tag tag-blue">📅 {a.lesson_date?.slice(0, 10)}</span>
                {a.my_submission_id && <span className="tag tag-green">✅ Topshirilgan</span>}
                {a.my_score > 0 && <span className="tag tag-blue">⭐ {a.my_score} ball</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', marginLeft: '16px' }}>
              {a.is_open && timers[a.id] > 0 && (
                <div style={{ fontSize: '28px', fontFamily: 'var(--font2)', fontWeight: '700', color: timers[a.id] < 60 ? 'var(--danger)' : 'var(--success)' }}>
                  ⏱️ {fmt(timers[a.id])}
                </div>
              )}
              {a.is_open && !a.my_submission_id && (
                <button className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}
                  onClick={() => setShowSubmit(a.id)}>📤 Yuborish</button>
              )}
              {!a.is_open && <span className="tag tag-red">Yopilgan</span>}
            </div>
          </div>
        </div>
      ))}

      {showSubmit && (
        <div className="modal-overlay" onClick={() => setShowSubmit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⏱️ Javob yuborish</span>
              <button className="modal-close" onClick={() => setShowSubmit(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Javob / Kod</label>
                <textarea className="input" rows={8} value={content} onChange={e => setContent(e.target.value)}
                  required placeholder="Kodingiz yoki javobingiz..."
                  style={{ resize: 'vertical', fontFamily: 'monospace' }} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? '⏳...' : '📤 Yuborish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── STUDENT SCHEDULE (read-only) ──
function StudentSchedule({ group, userId }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (group?.id) load(); }, [group]);

  const load = async () => {
    setLoading(true);
    try { const r = await API.get('/student/schedule'); setScheduleData(r.data); } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getLessonDates = () => {
    const { lesson_days, start_date, end_date } = scheduleData?.group || {};
    if (!start_date || !end_date) return [];
    const dates = [];
    let d = new Date(start_date);
    const end = new Date(end_date);
    while (d <= end) {
      const day = d.getDay();
      let ok = false;
      if (lesson_days === 'juft') ok = [2, 4, 6].includes(day);
      else if (lesson_days === 'toq') ok = [1, 3, 5].includes(day);
      else ok = day !== 0;
      if (ok) dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const getScore = (uid, date) =>
    scheduleData?.scores?.find(s => s.user_id === uid && s.lesson_date?.slice(0, 10) === date)?.score ?? '';

  const getTotal = (uid) =>
    scheduleData?.scores?.filter(s => s.user_id === uid).reduce((a, b) => a + (b.score || 0), 0) || 0;

  const getAssignment = (date) => scheduleData?.assignments?.find(a => a.lesson_date?.slice(0, 10) === date);

  const getSubmission = (date, uid) => {
    const a = getAssignment(date);
    if (!a) return null;
    return a.submissions?.find(s => s && s.user_id === uid);
  };

  if (!group) return (
    <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
      Guruhga qo'shilmagan
    </div>
  );

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const dates = getLessonDates();
  const members = scheduleData?.members || [];
  const sorted = [...members].sort((a, b) => getTotal(b.id) - getTotal(a.id));
  const myRank = sorted.findIndex(m => m.id === userId) + 1;
  const myTotal = getTotal(userId);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📊 Jadval</h2>
        <p>{group.name} guruhining to'liq jadvali va reytingi</p>
      </div>

      {/* My stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div style={{ fontSize: '24px' }}>🏆</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{myRank || '—'}</div>
          <div className="stat-label">Mening o'rnim</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: '24px' }}>⭐</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{myTotal}</div>
          <div className="stat-label">Jami ballim</div>
        </div>
      </div>

      {dates.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          Jadval hali kiritilmagan
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: `${180 + dates.length * 75}px` }}>
          <thead>
            <tr>
              <th style={{ minWidth: '160px', position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 2 }}>
                O'quvchi
              </th>
              {dates.map(date => {
                const a = getAssignment(date);
                return (
                  <th key={date} style={{ minWidth: '70px', textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ color: a ? 'var(--accent)' : 'var(--text2)' }}>{date.slice(5)}</div>
                    {a && <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '2px' }}>📋</div>}
                  </th>
                );
              })}
              <th style={{ minWidth: '65px', textAlign: 'center' }}>Jami</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, idx) => {
              const isMe = m.id === userId;
              return (
                <tr key={m.id} style={isMe ? { background: 'rgba(91,141,238,0.06)' } : {}}>
                  <td style={{
                    position: 'sticky', left: 0,
                    background: isMe ? 'rgba(91,141,238,0.1)' : (idx % 2 === 0 ? 'var(--card)' : 'var(--bg2)'),
                    fontWeight: isMe ? '700' : '600', fontSize: '13px', zIndex: 1,
                    color: isMe ? 'var(--accent)' : 'var(--text)'
                  }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`} {m.full_name}
                    {isMe && <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--accent)' }}>(Men)</span>}
                  </td>
                  {dates.map(date => {
                    const a = getAssignment(date);
                    const sub = getSubmission(date, m.id);
                    const score = getScore(m.id, date);
                    return (
                      <td key={date} style={{ textAlign: 'center', fontSize: '13px' }}>
                        {a ? (
                          sub ? (
                            <span className="tag tag-green" style={{ fontSize: '10px' }}>✓</span>
                          ) : (
                            <span className="tag tag-red" style={{ fontSize: '10px' }}>✗</span>
                          )
                        ) : (
                          <span style={{ color: score ? (isMe ? 'var(--accent)' : 'var(--text)') : 'var(--text3)', fontWeight: isMe && score ? '700' : 'normal' }}>
                            {score || '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font2)', fontWeight: '700', color: isMe ? 'var(--accent)' : 'var(--text2)' }}>
                    {getTotal(m.id)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── CHAT ──
function StudentChat({ group }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const { user } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const load = async () => {
    try { const r = await API.get(`/chat/${group.id}`); setMessages(r.data); } catch { }
  };

  const send = async () => {
    if (!input.trim()) return;
    await API.post(`/chat/${group.id}`, { message: input });
    setInput(''); load();
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>💬 {group.name} — Chat</h2></div>
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="chat-messages">
          {messages.map(m => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id}>
                {!mine && <div className="chat-name">{m.sender_name} {m.sender_type === 'mentor' ? '👨‍🏫' : '🎓'}</div>}
                <div className={`chat-bubble ${mine ? 'mine' : 'other'}`}>
                  {m.message}
                  <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>{m.created_at?.slice(11, 16)}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-row">
          <input className="input" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Xabar yozing..." onKeyDown={e => e.key === 'Enter' && send()} />
          <button className="btn btn-primary" onClick={send}>➤</button>
        </div>
      </div>
    </div>
  );
}

// ── PROFILE ──
function StudentProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar_url || '');
  const [showConfetti, setShowConfetti] = useState(false);

  const AVATARS = ['🎓','👨‍💻','👩‍💻','🦸','🧑‍🎨','🧙','🦊','🐼','🦁','🐯','🦋','🌟','🔥','💎','🚀','🎮','🎯','🏆'];

  const handleChange = async (e) => {
    e.preventDefault(); setLoading(true); setMsg(''); setError('');
    if (form.new_password !== form.confirm) { setError('Parollar mos kelmadi'); return setLoading(false); }
    try {
      await API.put('/student/change-password', { old_password: form.old_password, new_password: form.new_password });
      setMsg("Parol o'zgartirildi! ✅");
      setForm({ old_password: '', new_password: '', confirm: '' });
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } catch (e) { setError(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  const handleAvatar = async (av) => {
    setAvatar(av);
    try { await API.put('/student/profile/avatar', { avatar_url: av }); } catch {}
  };

  return (
    <div className="fade-in" style={{ position: 'relative' }}>
      {/* Confetti */}
      {showConfetti && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
          {[...Array(30)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              top: '-20px',
              fontSize: '20px',
              animation: `fall ${1 + Math.random() * 2}s linear ${Math.random()}s forwards`,
            }}>
              {['🎉','⭐','🌟','✨','🎊','💫'][Math.floor(Math.random() * 6)]}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes fall { to { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 10px var(--accent)} 50%{box-shadow:0 0 30px var(--accent), 0 0 60px var(--accent)} }
      `}</style>

      <div className="page-header"><h2>👤 Mening profilim</h2></div>

      {/* Avatar card */}
      <div className="card" style={{ textAlign: 'center', marginBottom: '20px', background: 'linear-gradient(135deg, var(--bg2) 0%, var(--card) 100%)' }}>
        <div style={{ fontSize: '90px', lineHeight: 1, marginBottom: '12px', animation: 'float 3s ease-in-out infinite', display: 'inline-block' }}>
          {avatar || '🎓'}
        </div>
        <h2 style={{ fontFamily: 'var(--font2)', marginBottom: '4px' }}>{user?.full_name}</h2>
        <p style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: '20px' }}>O'quvchi 🎓</p>

        <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>Avatar tanlang:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {AVATARS.map(av => (
            <button key={av} onClick={() => handleAvatar(av)}
              style={{
                fontSize: '28px', background: avatar === av ? 'rgba(91,141,238,0.2)' : 'var(--bg2)',
                border: avatar === av ? '2px solid var(--accent)' : '2px solid var(--border)',
                borderRadius: '12px', padding: '8px', cursor: 'pointer', transition: 'all 0.2s',
                transform: avatar === av ? 'scale(1.25)' : 'scale(1)',
                animation: avatar === av ? 'glow 2s infinite' : 'none',
              }}>{av}</button>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px' }}>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '16px' }}>📋 Ma'lumotlar</h3>
          {[
            { label: 'Ism Familya', value: user?.full_name, icon: '👤' },
            { label: 'Email', value: user?.email, icon: '📧' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '12px', background: 'var(--bg2)', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '10px', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px' }}>{item.icon} {item.label}</div>
              <div style={{ fontWeight: '600' }}>{item.value || '—'}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '16px' }}>🔒 Parol o'zgartirish</h3>
          {msg && <div className="alert alert-success" style={{ animation: 'fadeIn 0.3s' }}>{msg}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleChange}>
            <div className="form-group"><label>Eski parol</label>
              <input className="input" type="password" value={form.old_password} onChange={e => setForm({ ...form, old_password: e.target.value })} required />
            </div>
            <div className="form-group"><label>Yangi parol</label>
              <input className="input" type="password" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} required />
            </div>
            <div className="form-group"><label>Tasdiqlang</label>
              <input className="input" type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
              {loading ? '⏳ Saqlanmoqda...' : '💾 Saqlash'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
