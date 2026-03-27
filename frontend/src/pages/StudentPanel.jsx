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
  if (!data) return <div className="loading"><div className="spinner" /></div>;
  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Salom, {data.user?.full_name?.split(' ')[0]}! 👋</h2>
        <p>Bugungi faoliyatingiz</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ fontSize: '28px' }}>🏫</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{data.groups?.length || 0}</div>
          <div className="stat-label">Guruhlarim</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: '28px' }}>📋</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{data.pending_assignments || 0}</div>
          <div className="stat-label">Kutayotgan vazifalar</div>
        </div>
      </div>
      {data.groups?.map(g => (
        <div key={g.id} className="card" style={{ marginBottom: '12px' }}>
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '6px' }}>{g.name}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>{g.subject || '—'}</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <span className="tag tag-blue">
              {g.lesson_days === 'juft' ? 'Juft kunlar' : g.lesson_days === 'toq' ? 'Toq kunlar' : 'Har kuni'}
            </span>
            {g.lesson_time && <span className="tag tag-purple">🕐 {g.lesson_time}</span>}
          </div>
        </div>
      ))}
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

  const now = new Date();
  const isExpired = (a) => a.due_date && new Date(`${a.due_date}T${a.due_time || '23:59:59'}`) < now;

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
    r.data.forEach(a => { if (a.is_open && a.duration_minutes) t[a.id] = a.duration_minutes * 60; });
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
    try { const r = await API.get(`/mentor/groups/${group.id}/schedule`); setScheduleData(r.data); } catch { }
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
      if (lesson_days === 'juft') ok = [1, 3, 5].includes(day);
      else if (lesson_days === 'toq') ok = [2, 4, 6].includes(day);
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

  const handleChange = async (e) => {
    e.preventDefault(); setLoading(true); setMsg(''); setError('');
    if (form.new_password !== form.confirm) { setError('Parollar mos kelmadi'); return setLoading(false); }
    try {
      await API.put('/student/change-password', { old_password: form.old_password, new_password: form.new_password });
      setMsg('Parol o\'zgartirildi! ✅');
      setForm({ old_password: '', new_password: '', confirm: '' });
    } catch (e) { setError(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>👤 Profil</h2></div>
      <div className="grid-2" style={{ gap: '20px' }}>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '16px' }}>Ma'lumotlar</h3>
          {[
            { label: 'Ism Familya', value: user?.full_name, icon: '👤' },
            { label: 'Email', value: user?.email, icon: '📧' },
          ].map((item, i) => (
            <div key={i} style={{ padding: '12px', background: 'var(--bg2)', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px' }}>{item.icon} {item.label}</div>
              <div style={{ fontWeight: '600' }}>{item.value || '—'}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '16px' }}>🔒 Parol o'zgartirish</h3>
          {msg && <div className="alert alert-success">{msg}</div>}
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
              {loading ? '...' : '💾 Saqlash'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
