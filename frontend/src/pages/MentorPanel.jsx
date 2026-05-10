import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const GROQ_KEY = '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';

const geminiCheck = async (assignmentTitle, studentAnswer) => {
  if (!GROQ_KEY) throw new Error('Groq API key sozlanmagan.');
  const prompt = `You are a teacher. Grade the student answer for the given task.

Task given to student: "${assignmentTitle}"
Student's answer: "${studentAnswer}"

IMPORTANT: The student answer above is their FULL response. Judge it fairly.
Example: if task is "5+5=?" and student answered "10", that is CORRECT, give 10/10.

Scoring (out of 10):
- Fully correct: 9-10
- Mostly correct: 6-8  
- Partially correct: 3-5
- Wrong or missing: 0-2

Reply ONLY in this format (use Uzbek language):
**Baho: [0-10]**
**Xatolar:** [errors or "Xato yo'q"]
**Yaxshi tomonlari:** [what was good]
**Maslahat:** [advice]`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 1024 })
  });
  const data = await res.json();
  if (data.error) throw new Error(`Groq xatolik: ${data.error.message || data.error.type}`);
  return data.choices?.[0]?.message?.content || 'AI javob bera olmadi';
};

const Sidebar = ({ active, setActive, logout, mentor }) => {
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'requests', icon: '🔔', label: "So'rovlar" },
    { id: 'groups', icon: '🏫', label: 'Guruhlar' },
    { id: 'students', icon: '🎓', label: "O'quvchilar" },
    { id: 'profile', icon: '👤', label: 'Profil' },
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
        <a href="https://t.me/UstozYordamchi_AI_bot" target="_blank" rel="noopener noreferrer"
          className="nav-item" style={{ color: '#229ED9', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <span className="icon">✈️</span> Ota-ona paneli
        </a>
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
        {active === 'requests' && <JoinRequests />}
        {active === 'groups' && !selectedGroup && (
          <MentorGroups groups={data?.groups || []} onSelect={setSelectedGroup} />
        )}
        {active === 'groups' && selectedGroup && (
          <GroupDetail group={selectedGroup} view={groupView} setView={setGroupView} onBack={() => setSelectedGroup(null)} />
        )}
        {active === 'students' && <MentorStudents groups={data?.groups || []} />}
        {active === 'profile' && <MentorProfile />}
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
    { id: 'attendance', label: '✅ Davomat' },
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
      {view === 'attendance' && <AttendanceView group={group} />}
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
  const [manualGrade, setManualGrade] = useState({});
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
      const scoreMatch = feedback.match(/Baho:\s*(\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
      await API.put(`/mentor/submissions/${s.id}/grade`, { score, mentor_feedback: feedback });
      loadSubs(showSubs);
    } catch (e) {
      alert('🤖 AI xatolik: ' + e.message);
    }
    setAiLoading(p => ({ ...p, [s.id]: false }));
  };

  const handleManualGrade = async (subId) => {
    const g = manualGrade[subId] || {};
    await API.put(`/mentor/submissions/${subId}/grade`, { score: parseInt(g.score) || 0, mentor_feedback: g.feedback || '' });
    setShowManual(p => ({ ...p, [subId]: false }));
    loadSubs(showSubs);
  };

  // Uy vazifasini o'chirish
  const handleDeleteHomework = async (aId) => {
    if (!window.confirm("Uy vazifasini o'chirish?")) return;
    await API.delete(`/mentor/assignments/${aId}`);
    load();
  };

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
              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteHomework(a.id)}>🗑️</button>
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
                  <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '10px', fontSize: '13px', fontFamily: 'monospace', marginBottom: '10px', whiteSpace: 'pre-wrap', maxHeight: '160px', overflowY: 'auto' }}>
                    {s.content}
                  </div>
                  {s.mentor_feedback && (
                    <div style={{ background: 'rgba(91,141,238,0.08)', border: '1px solid rgba(91,141,238,0.2)', borderRadius: '8px', padding: '10px', fontSize: '12px', marginBottom: '10px', whiteSpace: 'pre-wrap', color: 'var(--text2)' }}>
                      🤖 {s.mentor_feedback}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="btn btn-sm" style={{ background: 'rgba(91,141,238,0.15)', color: 'var(--accent)', border: '1px solid rgba(91,141,238,0.3)' }}
                      onClick={() => handleAiCheck(s, a.title + (a.description ? ': ' + a.description : ''))} disabled={aiLoading[s.id]}>
                      {aiLoading[s.id] ? '⏳ AI tekshirmoqda...' : '🤖 AI tekshirish'}
                    </button>
                    <button className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                      onClick={() => setShowManual(p => ({ ...p, [s.id]: !p[s.id] }))}>
                      ✏️ O'zim tekshirish
                    </button>
                  </div>
                  {showManual[s.id] && (
                    <div style={{ marginTop: '10px', background: 'var(--bg3)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>Ball (0-100):</label>
                        <input type="number" min="0" max="100" className="input" style={{ width: '90px' }}
                          value={manualGrade[s.id]?.score || ''}
                          onChange={e => setManualGrade(p => ({ ...p, [s.id]: { ...p[s.id], score: e.target.value } }))} />
                      </div>
                      <textarea className="input" rows={3} style={{ resize: 'vertical', fontSize: '13px', marginBottom: '8px' }}
                        value={manualGrade[s.id]?.feedback || ''}
                        onChange={e => setManualGrade(p => ({ ...p, [s.id]: { ...p[s.id], feedback: e.target.value } }))}
                        placeholder="Izoh yozing..." />
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
                {saving ? '...' : "✅ Qo'shish"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CLASSWORK (Kodli vazifa + IQ savol) ──
function ClassworkView({ group }) {
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [cwType, setCwType] = useState('code'); // 'code' | 'iq'
  const [form, setForm] = useState({
    title: '', description: '', lesson_date: new Date().toISOString().slice(0, 10),
    duration_minutes: 5, correct_answer: '', max_score: 10
  });
  const [saving, setSaving] = useState(false);
  const [timers, setTimers] = useState({});
  const [showSubs, setShowSubs] = useState(null);
  const [subs, setSubs] = useState([]);
  const [aiLoading, setAiLoading] = useState({});
  const [checkAllLoading, setCheckAllLoading] = useState({});
  const [manualGrade, setManualGrade] = useState({});
  const [showManual, setShowManual] = useState({});
  const [showAnswerModal, setShowAnswerModal] = useState(null); // sub object

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
    const now = Date.now();
    cw.forEach(a => {
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

  const handleStart = async (aId) => {
    const r = await API.post(`/mentor/assignments/${aId}/start`);
    const a = r.data;
    const totalSec = a.duration_minutes * 60;
    setTimers(p => ({ ...p, [aId]: totalSec }));
    load();
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true);
    await API.post('/mentor/assignments/classwork', {
      ...form,
      group_id: group.id,
      classwork_type: cwType,
      correct_answer: cwType === 'iq' ? form.correct_answer : null,
      max_score: cwType === 'iq' ? parseInt(form.max_score) : 10,
    });
    setShowModal(false);
    setForm({ title: '', description: '', lesson_date: new Date().toISOString().slice(0, 10), duration_minutes: 5, correct_answer: '', max_score: 10 });
    load(); setSaving(false);
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
    } catch (e) {
      alert('🤖 AI xatolik: ' + e.message);
    }
    setAiLoading(p => ({ ...p, [s.id]: false }));
  };

  // Barcha javoblarni AI bilan tekshirish
  const handleCheckAll = async (assignment) => {
    const aId = assignment.id;
    const unchecked = subs.filter(s => !s.score || s.score === 0);
    if (unchecked.length === 0) { alert("Barcha javoblar allaqachon tekshirilgan!"); return; }
    if (!window.confirm(`${unchecked.length} ta javobni AI bilan tekshirish?`)) return;
    setCheckAllLoading(p => ({ ...p, [aId]: true }));
    for (const s of unchecked) {
      try {
        const feedback = await geminiCheck(assignment.title + (assignment.description ? ': ' + assignment.description : ''), s.content);
        const scoreMatch = feedback.match(/Baho:\s*(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        await API.put(`/mentor/submissions/${s.id}/grade`, { score, mentor_feedback: feedback });
      } catch (e) { console.error('Check error:', e); }
    }
    setCheckAllLoading(p => ({ ...p, [aId]: false }));
    loadSubs(aId);
  };

  const handleManualGrade = async (subId) => {
    const g = manualGrade[subId] || {};
    await API.put(`/mentor/submissions/${subId}/grade`, { score: parseInt(g.score) || 0, mentor_feedback: g.feedback || '' });
    setShowManual(p => ({ ...p, [subId]: false }));
    loadSubs(showSubs);
  };

  // Submission o'chirish (jadvaldan ball ham ketadi)
  const handleDeleteSub = async (subId) => {
    if (!window.confirm("Bu o'quvchining javobi va bali o'chiriladi. Davom etish?")) return;
    await API.delete(`/mentor/submissions/${subId}`);
    loadSubs(showSubs);
  };

  // Darsda vazifani o'chirish
  const handleDeleteAssignment = async (aId) => {
    if (!window.confirm("Darsda vazifani o'chirish?")) return;
    await API.delete(`/mentor/assignments/${aId}`);
    setShowSubs(null);
    load();
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h4>{a.title}</h4>
                <span className={`tag ${a.classwork_type === 'iq' ? 'tag-purple' : 'tag-blue'}`} style={{ fontSize: '10px' }}>
                  {a.classwork_type === 'iq' ? '🧠 IQ savol' : '💻 Kodli'}
                </span>
              </div>
              {a.description && <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>{a.description}</p>}
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="tag tag-blue">📅 {a.lesson_date?.slice(0, 10)}</span>
                <span className="tag tag-purple">⏱️ {a.duration_minutes} daqiqa</span>
                {a.classwork_type === 'iq' && <span className="tag tag-green">🎯 {a.max_score} ball</span>}
                {!a.is_open && <span className="tag tag-red">Yopilgan</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', marginLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              {a.is_open && !a.started_at && (
                <button className="btn btn-success btn-sm" onClick={() => handleStart(a.id)}>▶️ Boshlash</button>
              )}
              {a.is_open && a.started_at && timers[a.id] !== undefined && timers[a.id] > 0 && (
                <div style={{ fontSize: '28px', fontFamily: 'var(--font2)', fontWeight: '700', color: timers[a.id] < 60 ? 'var(--danger)' : 'var(--accent)' }}>
                  ⏱️ {fmt(timers[a.id])}
                </div>
              )}
              {a.is_open && a.started_at && timers[a.id] === 0 && (
                <span className="tag tag-red">Vaqt tugadi</span>
              )}
              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAssignment(a.id)}>🗑️</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm"
              onClick={() => showSubs === a.id ? setShowSubs(null) : loadSubs(a.id)}>
              📥 Javoblar
            </button>
            {showSubs === a.id && a.classwork_type === 'code' && (
              <button className="btn btn-sm" style={{ background: 'rgba(91,141,238,0.15)', color: 'var(--accent)', border: '1px solid rgba(91,141,238,0.3)' }}
                onClick={() => handleCheckAll(a)} disabled={checkAllLoading[a.id]}>
                {checkAllLoading[a.id] ? '⏳ Tekshirilmoqda...' : '🤖 Hammasini tekshirish'}
              </button>
            )}
          </div>

          {showSubs === a.id && (
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              {/* IQ savol: to'g'ri javobni ko'rsatish */}
              {a.classwork_type === 'iq' && (
                <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', marginBottom: '12px', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '600' }}>
                    ✅ To'g'ri javob: <b>{a.correct_answer}</b> | 🎯 Ball: {a.max_score}
                  </span>
                </div>
              )}

              {subs.length === 0 && <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Hali javob yo'q</p>}
              {subs.map(s => (
                <div key={s.id} style={{ background: 'var(--bg2)', borderRadius: '10px', padding: '12px', marginBottom: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                    <b>{s.full_name}</b>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {s.score > 0 && <span className="tag tag-green">⭐ {s.score}</span>}
                      <button className="btn btn-danger btn-sm" style={{ fontSize: '11px', padding: '2px 8px' }}
                        onClick={() => handleDeleteSub(s.id)} title="Javobni o'chirish (jadvaldan ham)">
                        🗑️ O'chirish
                      </button>
                    </div>
                  </div>

                  {/* Javobni ko'rish */}
                  <div
                    style={{ fontFamily: a.classwork_type === 'iq' ? 'inherit' : 'monospace', fontSize: '13px', background: 'var(--bg3)', borderRadius: '8px', padding: '8px', marginBottom: '10px', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto', cursor: 'pointer', border: '1px solid var(--border)' }}
                    onClick={() => setShowAnswerModal(s)}
                    title="Kattalashtirish uchun bosing"
                  >
                    {s.content}
                    <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>👆 Kattalashtirish</div>
                  </div>

                  {s.mentor_feedback && (
                    <div style={{ background: 'rgba(91,141,238,0.08)', borderRadius: '8px', padding: '8px', fontSize: '12px', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                      🤖 {s.mentor_feedback}
                    </div>
                  )}

                  {/* Kodli vazifada tugmalar, IQ savolda faqat manual */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {a.classwork_type === 'code' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(91,141,238,0.15)', color: 'var(--accent)', border: '1px solid rgba(91,141,238,0.3)' }}
                        onClick={() => handleAiCheck(s, a.title + (a.description ? ': ' + a.description : ''))} disabled={aiLoading[s.id]}>
                        {aiLoading[s.id] ? '⏳ AI...' : '🤖 AI tekshirish'}
                      </button>
                    )}
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

      {/* Javob kattalashtirish modal */}
      {showAnswerModal && (
        <div className="modal-overlay" onClick={() => setShowAnswerModal(null)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📄 {showAnswerModal.full_name} javob</span>
              <button className="modal-close" onClick={() => setShowAnswerModal(null)}>✕</button>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '14px', background: 'var(--bg3)', borderRadius: '10px', padding: '16px', whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', lineHeight: '1.6' }}>
              {showAnswerModal.content}
            </div>
          </div>
        </div>
      )}

      {/* Vazifa qo'shish modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">⏱️ Darsda vazifa</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Tur tanlash */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                className={`btn btn-sm ${cwType === 'code' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCwType('code')} type="button">
                💻 Kodli vazifa
              </button>
              <button
                className={`btn btn-sm ${cwType === 'iq' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCwType('iq')} type="button">
                🧠 IQ savol
              </button>
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

              {cwType === 'iq' && (
                <>
                  <div className="form-group">
                    <label>✅ To'g'ri javob</label>
                    <input className="input" value={form.correct_answer}
                      onChange={e => setForm({ ...form, correct_answer: e.target.value })}
                      placeholder="Masalan: 2 yoki Python yoki A" required />
                    <small style={{ color: 'var(--text3)', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                      Vaqt tugagach bu javobni yuborganlar avtomatik ball oladi
                    </small>
                  </div>
                  <div className="form-group">
                    <label>🎯 Ball miqdori</label>
                    <input className="input" type="number" min="1" max="100" value={form.max_score}
                      onChange={e => setForm({ ...form, max_score: parseInt(e.target.value) })} />
                  </div>
                </>
              )}

              {cwType === 'code' && (
                <div style={{ padding: '10px 14px', background: 'rgba(91,141,238,0.08)', borderRadius: '10px', marginBottom: '12px', fontSize: '12px', color: 'var(--text2)' }}>
                  💡 Kodli vazifada AI avtomatik tekshiradi (0-10 ball). Siz ham qo'lda tekshirishingiz mumkin.
                </div>
              )}

              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={saving}>
                {saving ? '...' : '🚀 Yaratish'}
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
  const [clearing, setClearing] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);  // jadval qo'shish
  const [showAnswerModal, setShowAnswerModal] = useState(null); // javobni ko'rish

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const r = await API.get(`/mentor/groups/${group.id}/schedule`); setScheduleData(r.data); } catch { }
  };

  // Bugungi sana dars kuniga to'g'ri kelishini tekshirish
  const isTodayLessonDay = () => {
    const { lesson_days } = scheduleData?.group || {};
    const today = new Date();
    const day = today.getDay();
    if (lesson_days === 'juft') return [2, 4, 6].includes(day);
    if (lesson_days === 'toq') return [1, 3, 5].includes(day);
    return day !== 0;
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
    // Faqat bugungi dars kunida tahrirlash
    if (!isTodayLessonDay()) {
      alert("⚠️ Bugun dars kuni emas! Faqat dars kunida jadval tahrir qilinadi.");
      return;
    }
    setSaving(true);
    const byDate = {};
    Object.entries(editScores).forEach(([key, score]) => {
      const [uid, ...dateParts] = key.split('_');
      const date = dateParts.join('_');
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({ user_id: uid, score: parseInt(score) || 0 });
    });
    await API.put(`/mentor/groups/${group.id}/schedule/edit`, {
      updates: Object.entries(byDate).map(([date, scores]) => ({ date, scores }))
    });
    setEditMode(false); setEditScores({});
    load(); setSaving(false);
  };

  // Jadval tozalash
  const handleClear = async () => {
    if (!window.confirm("Barcha baholar 0 ga tushadi. Davom etish?")) return;
    setClearing(true);
    await API.post(`/mentor/groups/${group.id}/schedule/clear`);
    setClearing(false);
    load();
  };

  // Submission o'chirish (✅ ustiga bosib)
  const handleDeleteSub = async (sub, date) => {
    if (!window.confirm(`${sub.user_id} — bu o'quvchining javobi va bali o'chiriladi. Davom etish?`)) return;
    await API.delete(`/mentor/submissions/${sub.id}`);
    load();
  };

  const dates = getLessonDates();
  const members = scheduleData?.members || [];
  const sorted = [...members].sort((a, b) => getTotal(b.id) - getTotal(a.id));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>📊 Jadval</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {editMode ? (
            <>
              <button className="btn btn-success btn-sm" onClick={handleSave} disabled={saving}>{saving ? '...' : '💾 Saqlash'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setEditMode(false); setEditScores({}); }}>Bekor</button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setEditMode(true)}>✏️ Tahrirlash</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddTable(!showAddTable)}>📅 Jadval qo'shish</button>
          <button className="btn btn-danger btn-sm" onClick={handleClear} disabled={clearing}>
            {clearing ? '...' : '🗑️ Tozalash'}
          </button>
        </div>
      </div>

      {!isTodayLessonDay() && editMode && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)' }}>
          ⚠️ Bugun dars kuni emas. Baholar saqlanmaydi!
        </div>
      )}

      {/* Jadval qo'shish (sana orqali) */}
      {showAddTable && (
        <AddTableDate group={group} onClose={() => { setShowAddTable(false); load(); }} />
      )}

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
                const isToday = date === todayStr;
                return (
                  <th key={date} style={{ minWidth: '72px', textAlign: 'center', fontSize: '11px', background: isToday ? 'rgba(91,141,238,0.08)' : 'transparent' }}>
                    <div style={{ color: a ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--text2)', fontWeight: isToday ? '700' : '400' }}>{date.slice(5)}</div>
                    {a ? (
                      <div style={{ fontSize: '10px', color: a.classwork_type === 'iq' ? 'var(--warning)' : 'var(--accent)', marginTop: '2px' }}>
                        {a.classwork_type === 'iq' ? '🧠' : '💻'}
                      </div>
                    ) : null}
                    {isToday && <div style={{ fontSize: '9px', color: 'var(--accent)' }}>bugun</div>}
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
                  const scoreVal = getScore(m.id, date);
                  return (
                    <td key={date} className="score-cell" style={{ textAlign: 'center', fontSize: '13px' }}>
                      {a ? (
                        sub ? (
                          // ✅ ustiga bosib javobni ko'rish va o'chirish
                          <span
                            className="tag tag-green"
                            style={{ fontSize: '10px', cursor: 'pointer', position: 'relative' }}
                            title="Javobni ko'rish / o'chirish"
                            onClick={() => setShowAnswerModal({ sub, assignment: a, member: m })}
                          >✅ {sub.score > 0 ? sub.score : ''}</span>
                        ) : (
                          <span className="tag tag-red" style={{ fontSize: '10px' }}>✗</span>
                        )
                      ) : editMode ? (
                        <input type="number" min="0" max="100" className="score-input-cell"
                          value={scoreVal}
                          onChange={e => setEditScores(p => ({ ...p, [`${m.id}_${date}`]: e.target.value }))} />
                      ) : (
                        <span style={{ color: scoreVal ? 'var(--text)' : 'var(--text3)' }}>
                          {scoreVal || '—'}
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

      {/* Javobni ko'rish modal */}
      {showAnswerModal && (
        <div className="modal-overlay" onClick={() => setShowAnswerModal(null)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📄 {showAnswerModal.member.full_name} — Javob</span>
              <button className="modal-close" onClick={() => setShowAnswerModal(null)}>✕</button>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px' }}>
                📅 {showAnswerModal.assignment.lesson_date?.slice(0, 10)} | {showAnswerModal.assignment.classwork_type === 'iq' ? '🧠 IQ savol' : '💻 Kodli'}
              </div>
              <div style={{ fontFamily: showAnswerModal.assignment.classwork_type === 'iq' ? 'inherit' : 'monospace', fontSize: '14px', background: 'var(--bg3)', borderRadius: '10px', padding: '14px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                {showAnswerModal.sub.content}
              </div>
              {showAnswerModal.sub.mentor_feedback && (
                <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(91,141,238,0.08)', borderRadius: '10px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                  🤖 {showAnswerModal.sub.mentor_feedback}
                </div>
              )}
              {showAnswerModal.sub.score > 0 && (
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                  <span className="tag tag-green" style={{ fontSize: '14px', padding: '6px 16px' }}>⭐ {showAnswerModal.sub.score} ball</span>
                </div>
              )}
            </div>
            <button className="btn btn-danger" style={{ width: '100%' }}
              onClick={() => { handleDeleteSub(showAnswerModal.sub, showAnswerModal.assignment.lesson_date); setShowAnswerModal(null); }}>
              🗑️ Javobni o'chirish (jadvaldan ham)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Jadval qo'shish (sana kiritish orqali — toq/juft aniqlanadi)
function AddTableDate({ group, onClose }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Kiritilgan sanalar asosida necha dars bo'lishini hisoblash
  const calcDays = () => {
    if (!startDate || !endDate) return null;
    const { lesson_days } = group;
    const dates = [];
    let d = new Date(startDate);
    const end = new Date(endDate);
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

  const preview = calcDays();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Guruh start_date va end_date ni yangilash orqali jadval qo'shiladi
      await API.put(`/mentor/groups/${group.id}/dates`, { start_date: startDate, end_date: endDate });
      setMsg(`✅ Jadval qo'shildi! ${preview?.length || 0} ta dars kuni.`);
      setTimeout(onClose, 1500);
    } catch (e) {
      setMsg('❌ Xatolik: ' + (e.response?.data?.error || e.message));
    }
    setSaving(false);
  };

  const lessonTypeLabel = group.lesson_days === 'juft' ? 'Juft kunlar (Se, Pay, Sha)' :
    group.lesson_days === 'toq' ? 'Toq kunlar (Du, Cho, Ju)' : 'Har kuni';

  return (
    <div className="card" style={{ marginBottom: '16px', border: '1px solid var(--accent)', background: 'rgba(91,141,238,0.05)' }}>
      <h4 style={{ marginBottom: '12px', color: 'var(--accent)' }}>📅 Jadval sanasini qo'shish</h4>
      <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '12px' }}>
        Guruh turi: <b style={{ color: 'var(--text)' }}>{lessonTypeLabel}</b>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label>Boshlash sanasi</label>
          <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Tugash sanasi</label>
          <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      {preview && (
        <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: '10px', marginBottom: '12px', fontSize: '13px' }}>
          📊 Jami <b>{preview.length}</b> ta dars kuni ({group.lesson_days === 'juft' ? 'juft' : group.lesson_days === 'toq' ? 'toq' : 'har kuni'})
          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {preview.slice(0, 10).map(d => <span key={d} className="tag tag-blue" style={{ fontSize: '10px' }}>{d.slice(5)}</span>)}
            {preview.length > 10 && <span style={{ fontSize: '11px', color: 'var(--text3)' }}>+{preview.length - 10} ta</span>}
          </div>
        </div>
      )}
      {msg && <div style={{ marginBottom: '12px', fontSize: '13px', color: msg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{msg}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !startDate || !endDate}>
          {saving ? '...' : "✅ Saqlash"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>Bekor</button>
      </div>
    </div>
  );
}

// ── ATTENDANCE ──
function AttendanceView({ group }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const getLessonDates = () => {
    const { lesson_days, start_date, end_date } = group;
    const start = start_date ? new Date(start_date) : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const endD = end_date ? (new Date(end_date) < today ? new Date(end_date) : today) : today;
    const dates = [];
    let d = new Date(start);
    while (d <= endD) {
      const day = d.getDay();
      let ok = false;
      if (lesson_days === 'juft') ok = [2, 4, 6].includes(day);
      else if (lesson_days === 'toq') ok = [1, 3, 5].includes(day);
      else ok = day !== 0;
      if (ok) dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates.reverse();
  };

  const allDates = getLessonDates();
  const [selectedDate, setSelectedDate] = useState(allDates[0] || todayStr);
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('mark');

  useEffect(() => { loadHistory(); }, []);
  useEffect(() => { if (selectedDate) loadForDate(selectedDate); }, [selectedDate]);

  const loadHistory = async () => {
    try { const r = await API.get(`/mentor/groups/${group.id}/attendance/history`); setHistory(r.data); } catch { }
  };

  const loadForDate = async (date) => {
    try {
      const r = await API.get(`/mentor/groups/${group.id}/attendance?date=${date}`);
      setMembers(r.data.members);
      const att = {};
      r.data.members.forEach(m => att[m.id] = 'present');
      r.data.attendance.forEach(a => { att[a.user_id] = a.status; });
      setAttendance(att);
    } catch { }
  };

  const toggle = (uid) => { setAttendance(p => ({ ...p, [uid]: p[uid] === 'present' ? 'absent' : 'present' })); setSaved(false); };
  const markAll = (status) => { const att = {}; members.forEach(m => att[m.id] = status); setAttendance(att); setSaved(false); };

  const save = async () => {
    setSaving(true);
    const records = members.map(m => ({ user_id: m.id, status: attendance[m.id] || 'present' }));
    await API.post(`/mentor/groups/${group.id}/attendance`, { date: selectedDate, records });
    setSaving(false); setSaved(true); loadHistory();
  };

  const getStats = (uid) => {
    const mine = history.filter(h => h.user_id === uid);
    return { present: mine.filter(h => h.status === 'present').length, absent: mine.filter(h => h.status === 'absent').length, total: mine.length };
  };

  const presentCount = members.filter(m => attendance[m.id] === 'present').length;
  const absentCount = members.filter(m => attendance[m.id] === 'absent').length;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font2)' }}>✅ Davomat</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`btn btn-sm ${tab === 'mark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('mark')}>📝 Belgilash</button>
          <button className={`btn btn-sm ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('history')}>📊 Tarix</button>
        </div>
      </div>

      {tab === 'mark' && (
        <>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text3)', display: 'block', marginBottom: '8px' }}>📅 Dars kunini tanlang:</label>
            {allDates.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Dars kunlari topilmadi.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {allDates.slice(0, 20).map(date => {
                  const hasData = history.some(h => h.lesson_date?.slice(0, 10) === date);
                  return (
                    <button key={date} onClick={() => setSelectedDate(date)}
                      style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: selectedDate === date ? '700' : '400', background: selectedDate === date ? 'var(--accent)' : hasData ? 'rgba(34,197,94,0.12)' : 'var(--bg2)', color: selectedDate === date ? '#fff' : hasData ? 'var(--success)' : 'var(--text)' }}>
                      {date.slice(5)} {hasData ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedDate && members.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.12)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--success)' }}>{presentCount}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text3)', marginLeft: '6px' }}>keldi</span>
                </div>
                <div style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--danger)' }}>{absentCount}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text3)', marginLeft: '6px' }}>kelmadi</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => markAll('present')}>✅ Barchasi keldi</button>
                <button className="btn btn-danger btn-sm" onClick={() => markAll('absent')}>❌ Barchasi kelmadi</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {members.map((m, idx) => {
                  const st = getStats(m.id);
                  const isPresent = attendance[m.id] !== 'absent';
                  return (
                    <div key={m.id} onClick={() => toggle(m.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', border: `1.5px solid ${isPresent ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`, background: isPresent ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.06)', transition: 'all 0.18s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPresent ? 'var(--success)' : 'var(--danger)', color: '#fff', fontWeight: '700', fontSize: '14px' }}>
                          {isPresent ? '✓' : '✗'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>{idx + 1}. {m.full_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>📊 {st.present} keldi · {st.absent} kelmadi</div>
                        </div>
                      </div>
                      <div style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', background: isPresent ? 'var(--success)' : 'var(--danger)', color: '#fff' }}>
                        {isPresent ? 'Keldi ✅' : 'Kelmadi ❌'}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={save} disabled={saving}>
                {saving ? '⏳ Saqlanmoqda...' : saved ? '✅ Saqlandi!' : '💾 Davomatni saqlash'}
              </button>
            </>
          )}
        </>
      )}

      {tab === 'history' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>O'quvchi</th><th style={{ textAlign: 'center' }}>✅ Keldi</th><th style={{ textAlign: 'center' }}>❌ Kelmadi</th><th style={{ textAlign: 'center' }}>% Davomat</th></tr>
            </thead>
            <tbody>
              {members.map((m, idx) => {
                const st = getStats(m.id);
                const pct = st.total > 0 ? Math.round(st.present / st.total * 100) : 0;
                return (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text3)' }}>{idx + 1}</td>
                    <td><b>{m.full_name}</b></td>
                    <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: '700' }}>{st.present}</td>
                    <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: '700' }}>{st.absent}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <div style={{ width: '60px', height: '6px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: '3px' }} />
                        </div>
                        <span style={{ color: pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)', fontWeight: '700', fontSize: '13px' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── MENTOR PROFILE ──
function MentorProfile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar_url || '');

  const AVATARS = ['👨‍💻', '👩‍💻', '🧑‍🏫', '👨‍🏫', '👩‍🏫', '🦸', '🧙', '🎓', '🤖', '🦊', '🐼', '🦁', '🐯', '🦋', '🌟', '🔥', '💎', '🚀'];

  const handlePassword = async (e) => {
    e.preventDefault(); setLoading(true); setMsg(''); setError('');
    if (form.new_password !== form.confirm) { setError('Parollar mos kelmadi'); return setLoading(false); }
    try {
      await API.put('/mentor/profile/password', { old_password: form.old_password, new_password: form.new_password });
      setMsg("Parol o'zgartirildi! ✅");
      setForm({ old_password: '', new_password: '', confirm: '' });
    } catch (e) { setError(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  const handleAvatar = async (av) => {
    setAvatar(av);
    try { await API.put('/mentor/profile/avatar', { avatar_url: av }); } catch { }
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>👤 Mening profilim</h2></div>
      <div className="grid-2" style={{ gap: '20px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '80px', marginBottom: '12px', lineHeight: 1 }}>{avatar || '👨‍🏫'}</div>
          <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '4px' }}>{user?.full_name}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '16px' }}>Mentor</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {AVATARS.map(av => (
              <button key={av} onClick={() => handleAvatar(av)}
                style={{ fontSize: '24px', background: avatar === av ? 'var(--accent)' : 'var(--bg2)', border: avatar === av ? '2px solid var(--accent)' : '2px solid var(--border)', borderRadius: '10px', padding: '6px', cursor: 'pointer', transition: 'all 0.2s', transform: avatar === av ? 'scale(1.2)' : 'scale(1)' }}>{av}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <h3 style={{ fontFamily: 'var(--font2)', marginBottom: '16px' }}>Ma'lumotlar</h3>
            {[{ label: 'Ism Familya', value: user?.full_name, icon: '👤' }, { label: 'Telefon', value: user?.phone, icon: '📱' }].map((item, i) => (
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
            <form onSubmit={handlePassword}>
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
    if (!window.confirm("O'quvchini guruhdan chiqarish?")) return;
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

// ── Guruhga qo'shilish so'rovlari ─────────────────────────────────
function JoinRequests() {
  const [requests, setRequests] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [msg, setMsg] = React.useState('');

  const load = () => {
    setLoading(true);
    API.get('/mentor/join-requests')
      .then(r => { setRequests(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const handle = async (id, action) => {
    try {
      await API.put(`/mentor/join-requests/${id}/${action}`);
      setMsg(action === 'approve' ? '✅ Tasdiqlandi!' : '❌ Rad etildi');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch(e) {
      setMsg('Xatolik: ' + (e.response?.data?.error || e.message));
    }
  };

  if (loading) return <div style={{padding:32,textAlign:'center'}}>Yuklanmoqda...</div>;

  return (
    <div style={{padding:24}}>
      <h2 style={{marginBottom:16}}>🔔 Guruhga qo'shilish so'rovlari</h2>
      {msg && <div style={{padding:'10px 16px',borderRadius:8,background:'var(--surface2)',marginBottom:16}}>{msg}</div>}
      {!requests.length ? (
        <div style={{textAlign:'center',color:'var(--text3)',padding:48}}>Hozircha so'rov yo'q</div>
      ) : requests.map(r => (
        <div key={r.id} style={{
          background:'var(--card)',border:'1px solid var(--border)',
          borderRadius:12,padding:16,marginBottom:12,
          display:'flex',justifyContent:'space-between',alignItems:'center',gap:12
        }}>
          <div>
            <div style={{fontWeight:600}}>{r.full_name}</div>
            <div style={{fontSize:13,color:'var(--text2)'}}>{r.email} · {r.phone}</div>
            <div style={{fontSize:12,color:'var(--text3)',marginTop:4}}>Guruh: <b>{r.group_name}</b></div>
          </div>
          <div style={{display:'flex',gap:8,flexShrink:0}}>
            <button onClick={() => handle(r.id,'approve')}
              style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#22c55e',color:'#fff',cursor:'pointer',fontWeight:600}}>
              ✅ Qabul
            </button>
            <button onClick={() => handle(r.id,'reject')}
              style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#ef4444',color:'#fff',cursor:'pointer',fontWeight:600}}>
              ❌ Rad
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
