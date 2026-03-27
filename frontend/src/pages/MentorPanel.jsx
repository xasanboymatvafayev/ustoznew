import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const GEMINI_KEY = 'AIzaSyBtQGQ35oZNNY87l_HGsBYQ5QYBRgvgwM4';

const geminiCheck = async (assignmentTitle, content) => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Sen dasturlash o'qituvchisisisan. Quyidagi vazifani tekshir va 0-100 ball baho ber.

Vazifa: ${assignmentTitle}
O'quvchi javobi:
${content}

Quyidagi formatda javob ber (boshqa hech narsa yozma):
**Baho: [0-100]**
**Xatolar:** [xatolar yoki "Xato yo'q"]
**Yaxshi tomonlari:** [nima yaxshi]
**Maslahat:** [qo'shimcha maslahat]`
          }]
        }]
      })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'AI javob bera olmadi';
};

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
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupView, setGroupView] = useState('homework');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    API.get('/mentor/dashboard').then(r => setData(r.data)).catch(console.error);
  }, []);

  return (
    <div className="panel-layout">
      <Sidebar active={active} setActive={(a) => { setActive(a); setSelectedGroup(null); }} logout={handleLogout} mentor={user} />
      <main className="main-content">
        {active === 'dashboard' && <MentorDashboard data={data} />}
        {active === 'groups' && !selectedGroup && (
          <MentorGroups groups={data?.groups || []} onSelect={setSelectedGroup} />
        )}
        {active === 'groups' && selectedGroup && (
          <GroupDetail group={selectedGroup} view={groupView} setView={setGroupView} onBack={() => setSelectedGroup(null)} />
        )}
        {active === 'students' && <MentorStudents groups={data?.groups || []} />}
      </main>
    </div>
  );
}

function MentorDashboard({ data }) {
  if (!data) return <div className="loading"><div className="spinner" /></div>;
  return (
    <div className="fade-in">
      <div className="page-header"><h2>Dashboard</h2><p>Salom, Mentor!</p></div>
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
      {data.calendar?.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font2)' }}>📅 Kalendar</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.calendar.map(ev => (
              <div key={ev.id} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'var(--bg2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '20px' }}>📅</span>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px' }}>{ev.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{ev.event_date?.slice(0, 10)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>🎓 {g.member_count} o'quvchi</div>
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
      <div className="tabs">
        {views.map(v => (
          <button key={v.id} className={`tab ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'homework' && <HomeworkView group={group} />}
      {view === 'classwork' && <ClassworkView group={group} />}
      {view === 'chat' && <ChatView group={group} />}
      {view === 'schedule' && <ScheduleView group={group} />}
    </div>
  );
}

// ── HOMEWORK ──
function HomeworkView({ group }) {
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', due_date: '', due_time: '23:00' });
  const [saving, setSaving] = useState(false);
  const [showSubs, setShowSubs] = useState(null);
  const [subs, setSubs] = useState([]);
  const [aiLoading, setAiLoading] = useState({});
  const [manualGrade, setManualGrade] = useState({}); // {subId: {score, feedback}}
  const [showManual, setShowManual] = useState({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    const r = await API.get(`/assignments/group/${group.id}`);
    setAssignments(r.data.filter(a => a.type === 'homework'));
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    await API.post('/assignments', { ...form, group_id: group.id });
    setShowModal(false); setForm({ title: '', description: '', due_date: '', due_time: '23:00' });
    load(); setSaving(false);
  };

  const loadSubs = async (aId) => {
    setShowSubs(aId);
    const r = await API.get(`/mentor/assignments/${aId}/submissions`);
    setSubs(r.data);
  };

  const handleAiCheck = async (s, assignmentTitle) => {
    setAiLoading(p => ({ ...p, [s.id]: true }));
    try {
      const feedback = await geminiCheck(assignmentTitle, s.content);
      // Extract score from feedback
      const scoreMatch = feedback.match(/Baho:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      await API.put(`/mentor/submissions/${s.id}/grade`, { score, mentor_feedback: feedback });
      loadSubs(showSubs);
    } catch (e) { alert('Gemini AI xatolik: ' + e.message); }
    setAiLoading(p => ({ ...p, [s.id]: false }));
  };

  const handleManualGrade = async (subId) => {
    const g = manualGrade[subId] || {};
    await API.put(`/mentor/submissions/${subId}/grade`, {
      score: parseInt(g.score) || 0,
      mentor_feedback: g.feedback || ''
    });
    setShowManual(p => ({ ...p, [subId]: false }));
    loadSubs(showSubs);
  };

  const currentAssignment = assignments.find(a => a.id === showSubs);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>Uy vazifalari</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Vazifa qo'shish</button>
      </div>

      {assignments.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>📋 Hali vazifalar yo'q</div>
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
              <button className="btn btn-secondary btn-sm" onClick={() => showSubs === a.id ? setShowSubs(null) : loadSubs(a.id)}>
                📥 Javoblar
              </button>
              <button className="btn btn-danger btn-sm" onClick={async () => {
                if (!window.confirm('O\'chirish?')) return;
                await API.delete(`/mentor/assignments/${a.id}`); load();
              }}>🗑️</button>
            </div>
          </div>

          {showSubs === a.id && (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h5 style={{ marginBottom: '12px', color: 'var(--text2)' }}>📥 Javoblar ({subs.length})</h5>
              {subs.length === 0 && <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Hali javob yo'q</p>}
              {subs.map(s => (
                <div key={s.id} style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '14px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <b>{s.full_name}</b>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {s.score > 0 && <span className="tag tag-green">⭐ {s.score}</span>}
                      <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{s.submitted_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  </div>

                  {/* Answer */}
                  <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '10px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '10px', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                    {s.content}
                  </div>

                  {/* AI feedback */}
                  {s.mentor_feedback && (
                    <div style={{ background: 'rgba(91,141,238,0.08)', border: '1px solid rgba(91,141,238,0.2)', borderRadius: '8px', padding: '10px', fontSize: '12px', marginBottom: '10px', whiteSpace: 'pre-wrap', color: 'var(--text2)' }}>
                      🤖 {s.mentor_feedback}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {/* AI check */}
                    <button className="btn btn-sm"
                      style={{ background: 'rgba(91,141,238,0.15)', color: 'var(--accent)', border: '1px solid rgba(91,141,238,0.3)' }}
                      onClick={() => handleAiCheck(s, a.title)}
                      disabled={aiLoading[s.id]}>
                      {aiLoading[s.id] ? '⏳ AI tekshirmoqda...' : '🤖 AI tekshirish'}
                    </button>

                    {/* Manual grade */}
                    <button className="btn btn-sm"
                      style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                      onClick={() => setShowManual(p => ({ ...p, [s.id]: !p[s.id] }))}>
                      ✏️ O'zim tekshirish
                    </button>
                  </div>

                  {/* Manual grade form */}
                  {showManual[s.id] && (
                    <div style={{ marginTop: '10px', background: 'var(--bg3)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>Ball (0-100):</label>
                        <input type="number" min="0" max="100"
                          className="input" style={{ width: '90px' }}
                          value={manualGrade[s.id]?.score || ''}
                          onChange={e => setManualGrade(p => ({ ...p, [s.id]: { ...p[s.id], score: e.target.value } }))}
                          placeholder="0-100" />
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Izoh:</label>
                        <textarea className="input" rows={3} style={{ resize: 'vertical', fontSize: '13px' }}
                          value={manualGrade[s.id]?.feedback || ''}
                          onChange={e => setManualGrade(p => ({ ...p, [s.id]: { ...p[s.id], feedback: e.target.value } }))}
                          placeholder="Izoh yozing..." />
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleManualGrade(s.id)}>💾 Saqlash</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowManual(p => ({ ...p, [s.id]: false }))}>Bekor</button>
                      </div>
                    </div>
                  )}
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
              <span className="modal-title">📋 Uy vazifasi qo'shish</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group"><label>Vazifa nomi</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group"><label>Shart / Tavsif</label>
                <textarea className="input" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Muddat sanasi</label>
                  <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} required />
                </div>
                <div className="form-group"><label>Muddat vaqti</label>
                  <input className="input" type="time" value={form.due_time} onChange={e => setForm({ ...form, due_time: e.target.value })} required />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={saving}>
                {saving ? '...' : '✅ Qo\'shish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CLASSWORK ──
function ClassworkView({ group }) {
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', lesson_date: new Date().toISOString().slice(0, 10), duration_minutes: 5 });
  const [saving, setSaving] = useState(false);
  const [timers, setTimers] = useState({});
  const [showSubs, setShowSubs] = useState(null);
  const [subs, setSubs] = useState([]);
  const [aiLoading, setAiLoading] = useState({});
  const [manualGrade, setManualGrade] = useState({});
  const [showManual, setShowManual] = useState({});

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
    const r = await API.get(`/assignments/group/${group.id}`);
    const cw = r.data.filter(a => a.type === 'classwork');
    setAssignments(cw);
    const t = {};
    cw.forEach(a => { if (a.is_open && a.duration_minutes) t[a.id] = a.duration_minutes * 60; });
    setTimers(p => ({ ...p, ...t }));
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    await API.post('/mentor/assignments/classwork', { ...form, group_id: group.id });
    setShowModal(false); load(); setSaving(false);
  };

  const loadSubs = async (aId) => {
    setShowSubs(aId);
    const r = await API.get(`/mentor/assignments/${aId}/submissions`);
    setSubs(r.data);
  };

  const handleAiCheck = async (s, title) => {
    setAiLoading(p => ({ ...p, [s.id]: true }));
    try {
      const feedback = await geminiCheck(title, s.content);
      const scoreMatch = feedback.match(/Baho:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      await API.put(`/mentor/submissions/${s.id}/grade`, { score, mentor_feedback: feedback });
      loadSubs(showSubs);
    } catch (e) { alert('Gemini xatolik: ' + e.message); }
    setAiLoading(p => ({ ...p, [s.id]: false }));
  };

  const handleManualGrade = async (subId) => {
    const g = manualGrade[subId] || {};
    await API.put(`/mentor/submissions/${subId}/grade`, { score: parseInt(g.score) || 0, mentor_feedback: g.feedback || '' });
    setShowManual(p => ({ ...p, [subId]: false }));
    loadSubs(showSubs);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const curAssignment = assignments.find(a => a.id === showSubs);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>Darsda vazifalar</h3>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Darsda vazifa</button>
      </div>

      {assignments.map(a => (
        <div key={a.id} className="card" style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <h4>{a.title}</h4>
              {a.description && <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{a.description}</p>}
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <span className="tag tag-blue">📅 {a.lesson_date?.slice(0, 10)}</span>
                <span className="tag tag-purple">⏱️ {a.duration_minutes} daqiqa</span>
                {!a.is_open && <span className="tag tag-red">Yopilgan</span>}
              </div>
            </div>
            {a.is_open && timers[a.id] !== undefined && (
              <div style={{ fontSize: '28px', fontFamily: 'var(--font2)', fontWeight: '700', color: timers[a.id] < 60 ? 'var(--danger)' : 'var(--accent)', marginLeft: '16px' }}>
                ⏱️ {fmt(timers[a.id] || 0)}
              </div>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px' }}
            onClick={() => showSubs === a.id ? setShowSubs(null) : loadSubs(a.id)}>
            📥 Javoblar
          </button>

          {showSubs === a.id && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              {subs.length === 0 && <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Hali javob yo'q</p>}
              {subs.map(s => (
                <div key={s.id} style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '12px', marginBottom: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <b>{s.full_name}</b>
                    {s.score > 0 && <span className="tag tag-green">⭐ {s.score}</span>}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', background: 'var(--bg3)', borderRadius: '8px', padding: '8px', marginBottom: '10px', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                    {s.content}
                  </div>
                  {s.mentor_feedback && (
                    <div style={{ background: 'rgba(91,141,238,0.08)', borderRadius: '8px', padding: '8px', fontSize: '12px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                      🤖 {s.mentor_feedback}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" style={{ background: 'rgba(91,141,238,0.15)', color: 'var(--accent)', border: '1px solid rgba(91,141,238,0.3)' }}
                      onClick={() => handleAiCheck(s, a.title)} disabled={aiLoading[s.id]}>
                      {aiLoading[s.id] ? '⏳ AI...' : '🤖 AI tekshirish'}
                    </button>
                    <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                      onClick={() => setShowManual(p => ({ ...p, [s.id]: !p[s.id] }))}>
                      ✏️ O'zim tekshirish
                    </button>
                  </div>
                  {showManual[s.id] && (
                    <div style={{ marginTop: '10px', background: 'var(--bg3)', borderRadius: '10px', padding: '12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>Ball:</label>
                        <input type="number" min="0" max="100" className="input" style={{ width: '80px' }}
                          value={manualGrade[s.id]?.score || ''}
                          onChange={e => setManualGrade(p => ({ ...p, [s.id]: { ...p[s.id], score: e.target.value } }))} />
                      </div>
                      <textarea className="input" rows={2} style={{ resize: 'none', fontSize: '13px', marginBottom: '8px' }}
                        placeholder="Izoh..."
                        value={manualGrade[s.id]?.feedback || ''}
                        onChange={e => setManualGrade(p => ({ ...p, [s.id]: { ...p[s.id], feedback: e.target.value } }))} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleManualGrade(s.id)}>💾 Saqlash</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowManual(p => ({ ...p, [s.id]: false }))}>Bekor</button>
                      </div>
                    </div>
                  )}
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
              <div className="form-group"><label>Vazifa nomi</label>
                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group"><label>Shart</label>
                <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} />
              </div>
              <div className="grid-2">
                <div className="form-group"><label>Dars sanasi</label>
                  <input className="input" type="date" value={form.lesson_date} onChange={e => setForm({ ...form, lesson_date: e.target.value })} required />
                </div>
                <div className="form-group"><label>Vaqt (daqiqa)</label>
                  <input className="input" type="number" min="1" max="120" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: parseInt(e.target.value) })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={saving}>
                {saving ? '...' : '🚀 Boshlash'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHAT ──
function ChatView({ group }) {
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
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>💬 {group.name} — Chat</h3>
      </div>
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
  );
}

// ── SCHEDULE ──
function ScheduleView({ group }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editScores, setEditScores] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(null);
  const [assignForm, setAssignForm] = useState({ title: '', description: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const r = await API.get(`/mentor/groups/${group.id}/schedule`); setScheduleData(r.data); } catch { }
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

  const getScore = (uid, date) => {
    if (editMode && editScores[`${uid}_${date}`] !== undefined) return editScores[`${uid}_${date}`];
    return scheduleData?.scores?.find(s => s.user_id === uid && s.lesson_date?.slice(0, 10) === date)?.score ?? '';
  };

  const getTotal = (uid) => scheduleData?.scores?.filter(s => s.user_id === uid).reduce((a, b) => a + (b.score || 0), 0) || 0;

  const getAssignment = (date) => scheduleData?.assignments?.find(a => a.lesson_date?.slice(0, 10) === date);

  const getSubmission = (date, uid) => {
    const a = getAssignment(date);
    if (!a) return null;
    return a.submissions?.find(s => s && s.user_id === uid);
  };

  const handleSave = async () => {
    setSaving(true);
    const byDate = {};
    Object.entries(editScores).forEach(([key, score]) => {
      const [uid, date] = key.split('_');
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({ user_id: uid, score: parseInt(score) || 0 });
    });
    await API.put(`/mentor/groups/${group.id}/schedule/edit`, {
      updates: Object.entries(byDate).map(([date, scores]) => ({ date, scores }))
    });
    setEditMode(false); setEditScores({});
    load(); setSaving(false);
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    await API.post('/assignments', {
      group_id: group.id, ...assignForm,
      lesson_date: showAddAssignment, due_date: showAddAssignment, due_time: '23:59'
    });
    setShowAddAssignment(null); setAssignForm({ title: '', description: '' });
    load();
  };

  const dates = getLessonDates();
  const members = scheduleData?.members || [];

  // Sort members by total score desc
  const sorted = [...members].sort((a, b) => getTotal(b.id) - getTotal(a.id));

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>📊 Jadval</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {editMode ? (
            <>
              <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>{saving ? '...' : '💾 Saqlash'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditMode(false); setEditScores({}); }}>Bekor</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setEditMode(true)}>✏️ Tahrirlash</button>
          )}
        </div>
      </div>

      {dates.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
          Guruhda boshlash/tugash sanasi kiritilmagan
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
                  <th key={date} style={{ minWidth: '72px', textAlign: 'center', fontSize: '11px' }}>
                    <div style={{ color: a ? 'var(--accent)' : 'var(--text2)' }}>{date.slice(5)}</div>
                    {a ? (
                      <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '2px' }} title={a.title}>📋</div>
                    ) : (
                      <button onClick={() => setShowAddAssignment(date)}
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
                        title="Vazifa qo'shish">＋</button>
                    )}
                  </th>
                );
              })}
              <th style={{ minWidth: '65px', textAlign: 'center' }}>Jami</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m, idx) => (
              <tr key={m.id}>
                <td style={{ position: 'sticky', left: 0, background: idx % 2 === 0 ? 'var(--card)' : 'var(--bg2)', fontWeight: '600', fontSize: '13px', zIndex: 1 }}>
                  {idx + 1}. {m.full_name}
                </td>
                {dates.map(date => {
                  const sub = getSubmission(date, m.id);
                  const a = getAssignment(date);
                  return (
                    <td key={date} className="score-cell" style={{ textAlign: 'center', fontSize: '13px' }}>
                      {a ? (
                        sub ? (
                          <span className="tag tag-green" style={{ fontSize: '10px', cursor: 'pointer' }} title="Topshirgan — javobni ko'rish">✓</span>
                        ) : (
                          <span className="tag tag-red" style={{ fontSize: '10px' }}>✗</span>
                        )
                      ) : editMode ? (
                        <input type="number" min="0" max="100" className="score-input-cell"
                          value={getScore(m.id, date)}
                          onChange={e => setEditScores(p => ({ ...p, [`${m.id}_${date}`]: e.target.value }))} />
                      ) : (
                        <span style={{ color: getScore(m.id, date) ? 'var(--text)' : 'var(--text3)' }}>
                          {getScore(m.id, date) || '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontFamily: 'var(--font2)', fontWeight: '700', color: 'var(--accent)' }}>
                  {getTotal(m.id)}
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
              <div className="form-group"><label>Vazifa nomi</label>
                <input className="input" value={assignForm.title} onChange={e => setAssignForm({ ...assignForm, title: e.target.value })} required />
              </div>
              <div className="form-group"><label>Shart</label>
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

// ── MENTOR STUDENTS ──
function MentorStudents({ groups }) {
  const [selGroup, setSelGroup] = useState(null);
  const [members, setMembers] = useState([]);

  useEffect(() => { if (selGroup) load(); }, [selGroup]);

  const load = async () => {
    const r = await API.get(`/mentor/groups/${selGroup}/members`);
    setMembers(r.data);
  };

  const remove = async (uid) => {
    if (!window.confirm('O\'quvchini guruhdan chiqarish?')) return;
    await API.delete(`/mentor/groups/${selGroup}/members/${uid}`);
    load();
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>O'quvchilar</h2></div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {groups.map(g => (
          <button key={g.id} className={`btn ${selGroup === g.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelGroup(g.id)}>{g.name}</button>
        ))}
      </div>
      {selGroup && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Ism Familya</th><th>Email</th><th>Telefon</th><th>Amallar</th></tr></thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                  <td><b>{m.full_name}</b></td>
                  <td style={{ color: 'var(--text2)' }}>{m.email}</td>
                  <td style={{ color: 'var(--text2)' }}>{m.phone}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remove(m.id)}>🚫 Chiqarish</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
