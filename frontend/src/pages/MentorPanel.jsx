import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const Sidebar = ({ active, setActive, logout, mentor }) => {
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'groups', icon: '🏫', label: 'Guruhlar' },
    { id: 'students', icon: '🎓', label: 'O\'quvchilar' },
  ];
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>🤖 Ustoz AI</h1>
        <p>Mentor Panel</p>
      </div>
      {mentor && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600' }}>{mentor.full_name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{mentor.phone}</div>
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

export default function MentorPanel() {
  const [active, setActive] = useState('dashboard');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupView, setGroupView] = useState('homework'); // homework|classwork|chat|schedule
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => { loadData(); }, [active]);

  const loadData = async () => {
    setLoading(true);
    try {
      const r = await API.get('/mentor/dashboard');
      setData(r.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="panel-layout">
      <Sidebar active={active} setActive={(a) => { setActive(a); setSelectedGroup(null); }} logout={handleLogout} mentor={user} />
      <main className="main-content">
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <>
            {active === 'dashboard' && <MentorDashboard data={data} />}
            {active === 'groups' && !selectedGroup && (
              <MentorGroups groups={data?.groups || []} onSelect={(g) => { setSelectedGroup(g); }} />
            )}
            {active === 'groups' && selectedGroup && (
              <GroupDetail group={selectedGroup} view={groupView} setView={setGroupView} onBack={() => setSelectedGroup(null)} />
            )}
            {active === 'students' && <MentorStudents groups={data?.groups || []} />}
          </>
        )}
      </main>
    </div>
  );
}

function MentorDashboard({ data }) {
  if (!data) return null;
  return (
    <div className="fade-in">
      <div className="page-header"><h2>Dashboard</h2><p>Salom, Mentor! Bugungi holat</p></div>
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ fontSize: '28px' }}>🎓</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{data.total_students}</div>
          <div className="stat-label">Jami o'quvchilar</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize: '28px' }}>🏫</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{data.groups?.length || 0}</div>
          <div className="stat-label">Guruhlar</div>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font2)' }}>📅 Kalendar</h3>
        {data.calendar?.length === 0 && <p style={{ color: 'var(--text3)' }}>Tadbirlar yo'q</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.calendar?.map(ev => (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', background: 'var(--bg2)', borderRadius: '10px',
              border: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: '20px' }}>📅</span>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>{ev.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{ev.event_date?.slice(0, 10)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MentorGroups({ groups, onSelect }) {
  return (
    <div className="fade-in">
      <div className="page-header"><h2>Guruhlarim</h2><p>{groups.length} ta guruh</p></div>
      <div className="grid-3">
        {groups.map(g => (
          <div key={g.id} className="card card-glow" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '8px' }}>{g.name}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px' }}>{g.subject || '—'}</p>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>
              🎓 {g.member_count} o'quvchi
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => onSelect(g)}>
              Guruhga kirish →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupDetail({ group, view, setView, onBack }) {
  const views = [
    { id: 'homework', label: '📋 Uy vazifalari' },
    { id: 'classwork', label: '⏱️ Darsda vazifa' },
    { id: 'chat', label: '💬 Chat' },
    { id: 'schedule', label: '📊 Jadval' },
  ];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Orqaga</button>
        <h2 style={{ fontFamily: 'var(--font2)' }}>{group.name}</h2>
      </div>
      <div className="tabs" style={{ marginBottom: '20px' }}>
        {views.map(v => (
          <button key={v.id} className={`tab ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'homework' && <HomeworkView group={group} />}
      {view === 'classwork' && <ClassworkView group={group} />}
      {view === 'chat' && <ChatView group={group} role="mentor" />}
      {view === 'schedule' && <ScheduleView group={group} />}
    </div>
  );
}

// ===== HOMEWORK =====
function HomeworkView({ group }) {
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', due_time: '23:00' });
  const [loading, setLoading] = useState(false);
  const [showSubs, setShowSubs] = useState(null);
  const [subs, setSubs] = useState([]);
  const [aiLoading, setAiLoading] = useState({});

  useEffect(() => { loadAssignments(); }, []);

  const loadAssignments = async () => {
    const r = await API.get(`/assignments/group/${group.id}`);
    setAssignments(r.data.filter(a => a.type === 'homework'));
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await API.post('/assignments', { ...form, group_id: group.id });
      setShowModal(false); setForm({ title: '', description: '', due_date: '', due_time: '23:00' });
      loadAssignments();
    } catch (e) { alert(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Vazifani o\'chirish?')) return;
    await API.delete(`/mentor/assignments/${id}`);
    loadAssignments();
  };

  const loadSubmissions = async (assignmentId) => {
    setShowSubs(assignmentId);
    const r = await API.get(`/mentor/assignments/${assignmentId}/submissions`);
    setSubs(r.data);
  };

  const handleAiCheck = async (sub) => {
    setAiLoading(prev => ({ ...prev, [sub.id]: true }));
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Sen dasturlash o'qituvchisining yordamchisisisan. Quyidagi vazifani tekshir va baholash ber (0-100). Kod bo'lsa, kodni chuqur tekshir.
            
Vazifa: ${sub.assignment_title || 'Vazifa'}
O'quvchi javobi: ${sub.content}

Quyidagi formatda javaob ber:
**Baho: [0-100]**
**Xatolar:** [xatolar ro'yxati]
**Yaxshi tomonlari:** [yaxshi narsalar]
**Maslahat:** [qo'shimcha maslahat]`
          }]
        })
      });
      const data = await res.json();
      const feedback = data.content?.[0]?.text || 'Xatolik';
      await API.put(`/mentor/submissions/${sub.id}/grade`, { score: 0, mentor_feedback: feedback });
      loadSubmissions(showSubs);
    } catch (e) { alert('AI xatolik: ' + e.message); }
    setAiLoading(prev => ({ ...prev, [sub.id]: false }));
  };

  const handleGrade = async (subId, score) => {
    await API.put(`/mentor/submissions/${subId}/grade`, { score: parseInt(score) });
    loadSubmissions(showSubs);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>Uy vazifalari</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Vazifa qo'shish</button>
      </div>

      {assignments.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          📋 Hali vazifalar yo'q
        </div>
      )}

      {assignments.map(a => (
        <div key={a.id} className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ marginBottom: '6px' }}>{a.title}</h4>
              {a.description && <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>{a.description}</p>}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="tag tag-blue">📅 {a.due_date?.slice(0, 10)}</span>
                <span className="tag tag-purple">🕐 {a.due_time}</span>
                {!a.is_open && <span className="tag tag-red">Yopilgan</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => loadSubmissions(a.id)}>
                📥 Javoblar
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}>🗑️</button>
            </div>
          </div>

          {showSubs === a.id && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h5 style={{ marginBottom: '12px', color: 'var(--text2)' }}>
                📥 Javoblar ({subs.length} ta)
              </h5>
              {subs.length === 0 && <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Hali javob yo'q</p>}
              {subs.map(s => (
                <div key={s.id} style={{
                  background: 'var(--bg2)', borderRadius: '10px', padding: '14px',
                  marginBottom: '8px', border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <b style={{ fontSize: '14px' }}>{s.full_name}</b>
                    <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{s.submitted_at?.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <div style={{
                    background: 'var(--bg3)', borderRadius: '8px', padding: '10px',
                    fontSize: '13px', fontFamily: 'monospace', marginBottom: '10px',
                    whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto'
                  }}>{s.content}</div>
                  {s.ai_feedback && (
                    <div style={{ background: 'rgba(91,141,238,0.1)', borderRadius: '8px', padding: '10px', fontSize: '12px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                      🤖 {s.ai_feedback}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="number" min="0" max="100" defaultValue={s.score}
                      className="input" style={{ width: '80px' }}
                      onBlur={e => handleGrade(s.id, e.target.value)} placeholder="Ball" />
                    <button className="btn btn-sm" style={{ background: 'rgba(91,141,238,0.2)', color: 'var(--accent)' }}
                      onClick={() => handleAiCheck(s)} disabled={aiLoading[s.id]}>
                      {aiLoading[s.id] ? '🤖 Tekshirilmoqda...' : '🤖 AI tekshirish'}
                    </button>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSubs(null)}>Yopish</button>
            </div>
          )}
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📋 Yangi uy vazifasi</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Vazifa nomi</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Tavsif / Shart</label>
                <textarea className="input" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Sana (muddat)</label>
                  <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Vaqt</label>
                  <input className="input" type="time" value={form.due_time} onChange={e => setForm({ ...form, due_time: e.target.value })} required />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? '...' : '✅ Qo\'shish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== CLASSWORK =====
function ClassworkView({ group }) {
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', lesson_date: new Date().toISOString().slice(0, 10), duration_minutes: 5 });
  const [loading, setLoading] = useState(false);
  const [timers, setTimers] = useState({});
  const [showSubs, setShowSubs] = useState(null);
  const [subs, setSubs] = useState([]);

  useEffect(() => { loadAssignments(); }, []);

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

  const loadAssignments = async () => {
    const r = await API.get(`/assignments/group/${group.id}`);
    const cw = r.data.filter(a => a.type === 'classwork');
    setAssignments(cw);
    const t = {};
    cw.forEach(a => { if (a.is_open && a.duration_minutes) t[a.id] = a.duration_minutes * 60; });
    setTimers(prev => ({ ...prev, ...t }));
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await API.post('/mentor/assignments/classwork', { ...form, group_id: group.id });
      setShowModal(false); loadAssignments();
    } catch (e) { alert(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const loadSubs = async (id) => {
    setShowSubs(id);
    const r = await API.get(`/mentor/assignments/${id}/submissions`);
    setSubs(r.data);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>Darsda vazifalar</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Darsda vazifa</button>
      </div>

      {assignments.map(a => (
        <div key={a.id} className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4>{a.title}</h4>
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{a.description}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {a.is_open && timers[a.id] !== undefined && (
                <div style={{
                  fontSize: '24px', fontFamily: 'var(--font2)', fontWeight: '700',
                  color: timers[a.id] < 60 ? 'var(--danger)' : 'var(--accent)'
                }}>
                  ⏱️ {fmtTime(timers[a.id] || 0)}
                </div>
              )}
              {!a.is_open && <span className="tag tag-red">Yopilgan</span>}
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
            <span className="tag tag-blue">📅 {a.lesson_date?.slice(0, 10)}</span>
            <span className="tag tag-purple">⏱️ {a.duration_minutes} daqiqa</span>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }} onClick={() => loadSubs(a.id)}>
            📥 Javoblar ko'rish
          </button>
          {showSubs === a.id && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              {subs.map(s => (
                <div key={s.id} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  <b>{s.full_name}</b>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{s.content}</div>
                  <input type="number" min="0" max="100" defaultValue={s.score} className="input"
                    style={{ width: '80px', marginTop: '8px' }}
                    onBlur={async e => {
                      await API.put(`/mentor/submissions/${s.id}/grade`, { score: parseInt(e.target.value) });
                    }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⏱️ Darsda vazifa</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Vazifa nomi</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Shart</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Dars sanasi</label>
                  <input className="input" type="date" value={form.lesson_date} onChange={e => setForm({ ...form, lesson_date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Vaqt (daqiqa)</label>
                  <input className="input" type="number" min="1" max="120" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? '...' : '🚀 Vazifani boshlash'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== CHAT =====
function ChatView({ group, role }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const { user } = useAuth();
  const bottomRef = useRef(null);

  useEffect(() => { loadMessages(); const t = setInterval(loadMessages, 3000); return () => clearInterval(t); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadMessages = async () => {
    try {
      const r = await API.get(`/chat/${group.id}`);
      setMessages(r.data);
    } catch (e) { }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    try {
      await API.post(`/chat/${group.id}`, { message: input });
      setInput(''); loadMessages();
    } catch (e) { }
  };

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>💬 Guruh chati — {group.name}</h3>
      </div>
      <div className="chat-messages">
        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id}>
              {!mine && <div className="chat-name">{m.sender_name} {m.sender_type === 'mentor' ? '👨‍🏫' : '🎓'}</div>}
              <div className={`chat-bubble ${mine ? 'mine' : 'other'}`}>
                {m.message}
                <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
                  {m.created_at?.slice(11, 16)}
                </div>
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
  );
}

// ===== SCHEDULE (JADVAL) =====
function ScheduleView({ group }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editScores, setEditScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(null); // date
  const [assignForm, setAssignForm] = useState({ title: '', description: '' });

  useEffect(() => { loadSchedule(); }, []);

  const loadSchedule = async () => {
    try {
      const r = await API.get(`/mentor/groups/${group.id}/schedule`);
      setScheduleData(r.data);
    } catch (e) { console.error(e); }
  };

  const getLessonDates = () => {
    if (!scheduleData?.group) return [];
    const { lesson_days, start_date, end_date } = scheduleData.group;
    if (!start_date || !end_date) return [];
    const dates = [];
    let d = new Date(start_date);
    const end = new Date(end_date);
    while (d <= end) {
      const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
      let include = false;
      if (lesson_days === 'juft') include = [1, 3, 5].includes(day); // Mon,Wed,Fri
      else if (lesson_days === 'toq') include = [2, 4, 6].includes(day); // Tue,Thu,Sat
      else include = day !== 0; // every day except Sunday
      if (include) dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const getScore = (userId, date) => {
    if (editMode && editScores[`${userId}_${date}`] !== undefined) return editScores[`${userId}_${date}`];
    const s = scheduleData?.scores?.find(s => s.user_id === userId && s.lesson_date?.slice(0, 10) === date);
    return s?.score ?? '';
  };

  const getAssignmentForDate = (date) => {
    return scheduleData?.assignments?.find(a => a.lesson_date?.slice(0, 10) === date);
  };

  const getTotalScore = (userId) => {
    return scheduleData?.scores?.filter(s => s.user_id === userId).reduce((sum, s) => sum + (s.score || 0), 0);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = {};
    Object.entries(editScores).forEach(([key, score]) => {
      const [userId, date] = key.split('_');
      if (!updates[date]) updates[date] = [];
      updates[date].push({ user_id: userId, score: parseInt(score) || 0 });
    });
    await API.put(`/mentor/groups/${group.id}/schedule/edit`, {
      updates: Object.entries(updates).map(([date, scores]) => ({ date, scores }))
    });
    setEditMode(false); setEditScores({});
    loadSchedule(); setSaving(false);
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    await API.post('/assignments', {
      group_id: group.id, ...assignForm,
      lesson_date: showAddAssignment, due_date: showAddAssignment, due_time: '23:59', type: 'homework'
    });
    setShowAddAssignment(null); setAssignForm({ title: '', description: '' });
    loadSchedule();
  };

  const dates = getLessonDates();
  const members = scheduleData?.members || [];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>📊 Jadval</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {editMode ? (
            <>
              <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? '...' : '💾 Saqlash'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditMode(false); setEditScores({}); }}>
                Bekor
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setEditMode(true)}>
              ✏️ Tahrirlash
            </button>
          )}
        </div>
      </div>

      {dates.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          Guruhda start/end sana kiritilmagan
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: `${200 + dates.length * 80}px` }}>
          <thead>
            <tr>
              <th style={{ minWidth: '160px', position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 2 }}>
                O'quvchilar
              </th>
              {dates.map(date => (
                <th key={date} style={{ minWidth: '75px', textAlign: 'center', fontSize: '11px' }}>
                  <div>{date.slice(5)}</div>
                  {getAssignmentForDate(date) ? (
                    <div style={{ color: 'var(--accent)', fontSize: '10px', marginTop: '2px' }}>📋</div>
                  ) : (
                    <button
                      onClick={() => setShowAddAssignment(date)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text3)',
                        cursor: 'pointer', fontSize: '12px', marginTop: '2px'
                      }}
                      title="Vazifa qo'shish">+</button>
                  )}
                </th>
              ))}
              <th style={{ minWidth: '70px', textAlign: 'center' }}>Jami</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, idx) => (
              <tr key={m.id}>
                <td style={{
                  position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--card)' : 'var(--bg2)',
                  fontWeight: '600', fontSize: '13px', zIndex: 1
                }}>
                  {idx + 1}. {m.full_name}
                </td>
                {dates.map(date => {
                  const assignment = getAssignmentForDate(date);
                  const sub = assignment
                    ? scheduleData?.assignments?.find(a => a.lesson_date?.slice(0, 10) === date)
                        ?.submissions?.find(s => s && s.user_id === m.id)
                    : null;

                  return (
                    <td key={date} className="score-cell" style={{ textAlign: 'center', fontSize: '13px' }}>
                      {assignment && sub ? (
                        <div>
                          <span className="tag tag-green" style={{ fontSize: '10px' }}>✓</span>
                        </div>
                      ) : assignment && !sub ? (
                        <span className="tag tag-red" style={{ fontSize: '10px' }}>✗</span>
                      ) : editMode ? (
                        <input
                          type="number" min="0" max="100"
                          className="score-input-cell"
                          value={getScore(m.id, date)}
                          onChange={e => setEditScores(prev => ({
                            ...prev, [`${m.id}_${date}`]: e.target.value
                          }))}
                        />
                      ) : (
                        <span style={{ color: getScore(m.id, date) ? 'var(--text)' : 'var(--text3)' }}>
                          {getScore(m.id, date) || '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontFamily: 'var(--font2)', fontWeight: '700', color: 'var(--accent)' }}>
                  {getTotalScore(m.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddAssignment && (
        <div className="modal-overlay" onClick={() => setShowAddAssignment(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📋 {showAddAssignment} — Vazifa</span>
              <button className="modal-close" onClick={() => setShowAddAssignment(null)}>✕</button>
            </div>
            <form onSubmit={handleAddAssignment}>
              <div className="form-group">
                <label>Vazifa nomi</label>
                <input className="input" value={assignForm.title} onChange={e => setAssignForm({ ...assignForm, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Shart</label>
                <textarea className="input" rows={3} value={assignForm.description} onChange={e => setAssignForm({ ...assignForm, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>✅ Qo'shish</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== MENTOR STUDENTS =====
function MentorStudents({ groups }) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (selectedGroup) loadMembers();
  }, [selectedGroup]);

  const loadMembers = async () => {
    const r = await API.get(`/mentor/groups/${selectedGroup}/members`);
    setMembers(r.data);
  };

  const handleRemove = async (userId) => {
    if (!window.confirm('O\'quvchini guruhdan chiqarish?')) return;
    await API.delete(`/mentor/groups/${selectedGroup}/members/${userId}`);
    loadMembers();
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>O'quvchilar</h2></div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {groups.map(g => (
          <button key={g.id} className={`btn ${selectedGroup === g.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedGroup(g.id)}>
            {g.name}
          </button>
        ))}
      </div>

      {selectedGroup && (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>#</th><th>Ism Familya</th><th>Email</th><th>Telefon</th><th>Amallar</th>
            </tr></thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                  <td><b>{m.full_name}</b></td>
                  <td style={{ color: 'var(--text2)' }}>{m.email}</td>
                  <td style={{ color: 'var(--text2)' }}>{m.phone}</td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemove(m.id)}>
                      🚫 Chiqarish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
