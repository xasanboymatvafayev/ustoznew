import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const Sidebar = ({ active, setActive, logout, user }) => {
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'homework', icon: '📋', label: 'Uy vazifalari' },
    { id: 'classwork', icon: '⏱️', label: 'Darsda vazifalar' },
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
        {active === 'chat' && group && <StudentChat group={group} />}
        {active === 'chat' && !group && <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>Guruhga qo'shilmagan</div>}
        {active === 'profile' && <StudentProfile user={user} />}
      </main>
    </div>
  );
}

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

function StudentHomework() {
  const [assignments, setAssignments] = useState([]);
  const [tab, setTab] = useState('all');
  const [showSubmit, setShowSubmit] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const r = await API.get('/student/assignments/homework');
    setAssignments(r.data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await API.post(`/student/assignments/${showSubmit}/submit`, { content });
      setShowSubmit(null); setContent(''); loadData();
    } catch (e) { alert(e.response?.data?.error || 'Xatolik'); }
    setSubmitting(false);
  };

  const now = new Date();
  const filtered = assignments.filter(a => {
    if (tab === 'all') return true;
    if (tab === 'pending') return !a.my_submission_id && a.is_open;
    if (tab === 'done') return !!a.my_submission_id;
    return true;
  });

  const isExpired = (a) => {
    if (!a.due_date) return false;
    return new Date(`${a.due_date}T${a.due_time || '23:59:59'}`) < now;
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>📋 Uy vazifalari</h2></div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `Barchasi (${assignments.length})` },
          { id: 'pending', label: `Kutilmoqda (${assignments.filter(a => !a.my_submission_id && a.is_open).length})` },
          { id: 'done', label: `Bajarilgan (${assignments.filter(a => !!a.my_submission_id).length})` },
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
                  <span className={`tag ${expired ? 'tag-red' : 'tag-blue'}`}>
                    📅 {a.due_date?.slice(0, 10)}
                  </span>
                  <span className="tag tag-purple">🕐 {a.due_time}</span>
                  {done && <span className="tag tag-green">✅ Topshirilgan</span>}
                  {!done && expired && <span className="tag tag-red">⌛ Muddati o'tgan</span>}
                  {!done && !expired && <span className="tag tag-yellow">⏳ Kutilmoqda</span>}
                  {a.my_score > 0 && <span className="tag tag-blue">⭐ {a.my_score} ball</span>}
                </div>
              </div>
              {!done && !expired && a.is_open && (
                <button className="btn btn-primary btn-sm" style={{ marginLeft: '12px' }}
                  onClick={() => setShowSubmit(a.id)}>
                  📤 Yuborish
                </button>
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
              <div className="form-group">
                <label>Javob / Kod</label>
                <textarea className="input" rows={10} value={content} onChange={e => setContent(e.target.value)}
                  required placeholder="Javobingizni yoki kodingizni shu yerga yozing..."
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px' }} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? '...' : '📤 Yuborish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentClasswork() {
  const [assignments, setAssignments] = useState([]);
  const [showSubmit, setShowSubmit] = useState(null);
  const [content, setContent] = useState('');
  const [timers, setTimers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => { if (next[id] > 0) next[id]--; });
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
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
      setShowSubmit(null); setContent(''); loadData();
    } catch (e) { alert(e.response?.data?.error || 'Xatolik'); }
    setSubmitting(false);
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fade-in">
      <div className="page-header"><h2>⏱️ Darsda vazifalar</h2></div>

      {assignments.filter(a => a.type === 'classwork').map(a => (
        <div key={a.id} className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4>{a.title}</h4>
              {a.description && <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{a.description}</p>}
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <span className="tag tag-blue">📅 {a.lesson_date?.slice(0, 10)}</span>
                {a.my_submission_id && <span className="tag tag-green">✅ Topshirilgan</span>}
                {a.my_score > 0 && <span className="tag tag-blue">⭐ {a.my_score} ball</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {a.is_open && timers[a.id] > 0 && (
                <div style={{
                  fontSize: '28px', fontFamily: 'var(--font2)', fontWeight: '700',
                  color: timers[a.id] < 60 ? 'var(--danger)' : 'var(--success)'
                }}>⏱️ {fmtTime(timers[a.id])}</div>
              )}
              {a.is_open && !a.my_submission_id && (
                <button className="btn btn-primary btn-sm" style={{ marginTop: '8px' }}
                  onClick={() => setShowSubmit(a.id)}>📤 Yuborish</button>
              )}
            </div>
          </div>
        </div>
      ))}

      {showSubmit && (
        <div className="modal-overlay" onClick={() => setShowSubmit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⏱️ Darsda javob yuborish</span>
              <button className="modal-close" onClick={() => setShowSubmit(null)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Javob / Kod</label>
                <textarea className="input" rows={8} value={content} onChange={e => setContent(e.target.value)}
                  required placeholder="Kodingiz yoki javobingiz..."
                  style={{ resize: 'vertical', fontFamily: 'monospace' }} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={submitting}>
                {submitting ? '...' : '📤 Yuborish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentChat({ group }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const { user } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const t = setInterval(loadMessages, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadMessages = async () => {
    try {
      const r = await API.get(`/chat/${group.id}`);
      setMessages(r.data);
    } catch (e) { }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    await API.post(`/chat/${group.id}`, { message: input });
    setInput(''); loadMessages();
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
            placeholder="Xabar yozing..." onKeyDown={e => e.key === 'Enter' && sendMessage()} />
          <button className="btn btn-primary" onClick={sendMessage}>➤</button>
        </div>
      </div>
    </div>
  );
}

function StudentProfile({ user }) {
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleChange = async (e) => {
    e.preventDefault(); setLoading(true); setMsg(''); setError('');
    if (form.new_password !== form.confirm) return setError('Parollar mos kelmadi'), setLoading(false);
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Ism Familya', value: user?.full_name, icon: '👤' },
              { label: 'Email', value: user?.email, icon: '📧' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '12px', background: 'var(--bg2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '4px' }}>{item.icon} {item.label}</div>
                <div style={{ fontWeight: '600' }}>{item.value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '16px' }}>🔒 Parol o'zgartirish</h3>
          {msg && <div className="alert alert-success">{msg}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={handleChange}>
            <div className="form-group">
              <label>Eski parol</label>
              <input className="input" type="password" value={form.old_password} onChange={e => setForm({ ...form, old_password: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Yangi parol</label>
              <input className="input" type="password" value={form.new_password} onChange={e => setForm({ ...form, new_password: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Tasdiqlang</label>
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
