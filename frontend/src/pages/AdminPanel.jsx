import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/api';

const Sidebar = ({ active, setActive, logout }) => {
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'mentors', icon: '👨‍🏫', label: 'Mentorlar' },
    { id: 'groups', icon: '🏫', label: 'Guruhlar' },
    { id: 'students', icon: '🎓', label: 'O\'quvchilar' },
    { id: 'calendar', icon: '📅', label: 'Kalendar' },
  ];
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1>🤖 Ustoz AI</h1>
        <p>Admin Panel</p>
      </div>
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

export default function AdminPanel() {
  const [active, setActive] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [mentors, setMentors] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => { loadData(); }, [active]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (active === 'dashboard' || active === 'mentors' || active === 'groups') {
        const r = await API.get('/admin/dashboard');
        setStats(r.data);
        setGroups(r.data.groups || []);
      }
      if (active === 'mentors') {
        const r = await API.get('/admin/mentors');
        setMentors(r.data);
      }
      if (active === 'students') {
        const r = await API.get('/admin/students');
        setStudents(r.data);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div className="panel-layout">
      <Sidebar active={active} setActive={setActive} logout={handleLogout} />
      <main className="main-content">
        {loading ? <div className="loading"><div className="spinner" /></div> : (
          <>
            {active === 'dashboard' && <AdminDashboard stats={stats} setActive={setActive} />}
            {active === 'mentors' && <AdminMentors mentors={mentors} groups={groups} reload={loadData} />}
            {active === 'groups' && <AdminGroups groups={groups} mentors={mentors} reload={loadData} />}
            {active === 'students' && <AdminStudents students={students} reload={loadData} />}
            {active === 'calendar' && <AdminCalendar groups={groups} />}
          </>
        )}
      </main>
    </div>
  );
}

// ===== DASHBOARD =====
function AdminDashboard({ stats, setActive }) {
  if (!stats) return null;
  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Tizim umumiy holati</p>
      </div>
      <div className="stats-grid">
        {[
          { label: 'Jami o\'quvchilar', value: stats.total_students, icon: '🎓', color: 'var(--accent)' },
          { label: 'Faol mentorlar', value: stats.total_mentors, icon: '👨‍🏫', color: 'var(--success)' },
          { label: 'Faol guruhlar', value: stats.active_groups, icon: '🏫', color: 'var(--accent2)' },
          { label: 'Jami guruhlar', value: stats.total_groups, icon: '📚', color: 'var(--warning)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ marginBottom: '16px', fontFamily: 'var(--font2)' }}>Guruhlar ro'yxati</h3>
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Guruh nomi</th><th>Mentor</th><th>O'quvchilar</th><th>Holat</th>
            </tr></thead>
            <tbody>
              {stats.groups?.map(g => (
                <tr key={g.id}>
                  <td><b>{g.name}</b></td>
                  <td>{g.mentor_name || <span className="tag tag-yellow">Tayinlanmagan</span>}</td>
                  <td><span className="badge">{g.member_count}</span></td>
                  <td>{g.is_active
                    ? <span className="tag tag-green">Faol</span>
                    : <span className="tag tag-red">Nofaol</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== MENTORS =====
function AdminMentors({ mentors, groups, reload }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', password: '', group_names: [''] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const addGroupField = () => setForm({ ...form, group_names: [...form.group_names, ''] });
  const removeGroupField = (i) => setForm({ ...form, group_names: form.group_names.filter((_, idx) => idx !== i) });
  const updateGroupName = (i, val) => {
    const arr = [...form.group_names]; arr[i] = val;
    setForm({ ...form, group_names: arr });
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await API.post('/admin/mentors', { ...form, group_names: form.group_names.filter(Boolean) });
      setShowModal(false);
      setForm({ full_name: '', phone: '', password: '', group_names: [''] });
      reload();
    } catch (e) { setError(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Mentorni nofaol qilishni tasdiqlaysizmi?')) return;
    setDeletingId(id);
    try { await API.delete(`/admin/mentors/${id}`); reload(); } catch (e) { }
    setDeletingId(null);
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h2>Mentorlar</h2><p>{mentors.length} ta mentor</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Mentor qo'shish</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>Ism Familya</th><th>Telefon</th><th>Guruhlar</th><th>Holat</th><th>Amallar</th>
          </tr></thead>
          <tbody>
            {mentors.map(m => (
              <tr key={m.id}>
                <td><b>{m.full_name}</b></td>
                <td>{m.phone}</td>
                <td><span className="badge">{m.group_count}</span></td>
                <td>{m.is_active
                  ? <span className="tag tag-green">Faol</span>
                  : <span className="tag tag-red">Nofaol</span>}
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}>
                    {deletingId === m.id ? '...' : '🗑️ O\'chirish'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">👨‍🏫 Yangi Mentor</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Ism Familya</label>
                <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required placeholder="Karimov Karim" />
              </div>
              <div className="form-group">
                <label>Telefon raqam</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required placeholder="+998901234567" />
              </div>
              <div className="form-group">
                <label>Parol</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Guruh nomlari</label>
                {form.group_names.map((gn, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input className="input" value={gn} onChange={e => updateGroupName(i, e.target.value)} placeholder={`Guruh ${i + 1}`} />
                    {i > 0 && <button type="button" className="btn btn-danger btn-icon" onClick={() => removeGroupField(i)}>✕</button>}
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={addGroupField}>+ Guruh qo'shish</button>
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

// ===== GROUPS =====
function AdminGroups({ groups, mentors, reload }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', mentor_id: '', lesson_days: 'juft', lesson_time: '09:00',
    start_date: '', end_date: '', subject: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editGroup, setEditGroup] = useState(null); // sanani uzaytirish uchun
  const [editDates, setEditDates] = useState({ start_date: '', end_date: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState('');

  const openEditDates = (g) => {
    setEditGroup(g);
    setEditDates({ start_date: g.start_date?.slice(0, 10) || '', end_date: g.end_date?.slice(0, 10) || '' });
    setEditMsg('');
  };

  const handleEditDatesSave = async () => {
    setEditSaving(true);
    try {
      await API.put(`/admin/groups/${editGroup.id}`, editDates);
      setEditMsg('✅ Sana yangilandi!');
      setTimeout(() => { setEditGroup(null); reload(); }, 1200);
    } catch (e) {
      setEditMsg('❌ ' + (e.response?.data?.error || e.message));
    }
    setEditSaving(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await API.post('/admin/groups', form);
      setShowModal(false);
      setForm({ name: '', mentor_id: '', lesson_days: 'juft', lesson_time: '09:00', start_date: '', end_date: '', subject: '' });
      reload();
    } catch (e) { setError(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h2>Guruhlar</h2><p>{groups.length} ta guruh</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Guruh qo'shish</button>
      </div>

      <div className="grid-3" style={{ gap: '16px' }}>
        {groups.map(g => (
          <div key={g.id} className="card card-glow">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontFamily: 'var(--font2)' }}>{g.name}</h3>
              {g.is_active ? <span className="tag tag-green">Faol</span> : <span className="tag tag-red">Nofaol</span>}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span>👨‍🏫 {g.mentor_name || 'Mentor yo\'q'}</span>
              <span>📚 {g.subject || '—'}</span>
              <span>🎓 {g.member_count} o'quvchi</span>
              <span>📅 {g.lesson_days === 'juft' ? 'Juft kunlar' : g.lesson_days === 'toq' ? 'Toq kunlar' : 'Har kuni'} — {g.lesson_time || '—'}</span>
              {g.start_date && <span>🗓️ {g.start_date?.slice(0, 10)} → {g.end_date?.slice(0, 10)}</span>}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: '12px', width: '100%' }} onClick={() => openEditDates(g)}>
              📅 Sanani uzaytirish
            </button>
          </div>
        ))}
      </div>

      {editGroup && (
        <div className="modal-overlay" onClick={() => setEditGroup(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📅 Sanani uzaytirish — {editGroup.name}</span>
              <button className="modal-close" onClick={() => setEditGroup(null)}>✕</button>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Boshlanish sanasi</label>
                <input className="input" type="date" value={editDates.start_date} onChange={e => setEditDates({ ...editDates, start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tugash sanasi</label>
                <input className="input" type="date" value={editDates.end_date} onChange={e => setEditDates({ ...editDates, end_date: e.target.value })} />
              </div>
            </div>
            {editMsg && <div style={{ marginBottom: '12px', fontSize: '13px', color: editMsg.startsWith('✅') ? 'var(--success)' : 'var(--danger)' }}>{editMsg}</div>}
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleEditDatesSave} disabled={editSaving || !editDates.start_date || !editDates.end_date}>
              {editSaving ? '...' : '✅ Saqlash'}
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🏫 Yangi Guruh</span>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Guruh nomi</label>
                <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="G-01" />
              </div>
              <div className="form-group">
                <label>Fan/Yo'nalish</label>
                <input className="input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Python, Django..." />
              </div>
              <div className="form-group">
                <label>Mentor</label>
                <select className="input" value={form.mentor_id} onChange={e => setForm({ ...form, mentor_id: e.target.value })}>
                  <option value="">Mentor tanlang</option>
                  {mentors.filter(m => m.is_active).map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Dars kunlari</label>
                <select className="input" value={form.lesson_days} onChange={e => setForm({ ...form, lesson_days: e.target.value })}>
                  <option value="juft">Juft kunlar (Se, Pay, Sha)</option>
                  <option value="toq">Toq kunlar (Du, Chor, Ju)</option>
                  <option value="harkuni">Har kuni</option>
                </select>
              </div>
              <div className="form-group">
                <label>Dars vaqti</label>
                <input className="input" type="time" value={form.lesson_time} onChange={e => setForm({ ...form, lesson_time: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Boshlanish</label>
                  <input className="input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Tugash</label>
                  <input className="input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={loading}>
                {loading ? '...' : '✅ Guruh qo\'shish'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== STUDENTS =====
function AdminStudents({ students, reload }) {
  const [search, setSearch] = useState('');
  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', login: '', group_name: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.login || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.group_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (s) => {
    setEditStudent(s);
    setEditForm({ full_name: s.full_name, login: s.login || '', group_name: s.group_name || '' });
    setEditError('');
    setEditSuccess('');
  };

  const handleEditSave = async () => {
    setEditLoading(true); setEditError(''); setEditSuccess('');
    try {
      await API.put(`/admin/students/${editStudent.id}`, editForm);
      setEditSuccess("✅ O'quvchi yangilandi!");
      setTimeout(() => { setEditStudent(null); reload(); }, 1000);
    } catch (e) {
      setEditError(e.response?.data?.error || 'Xatolik yuz berdi');
    }
    setEditLoading(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h2>O'quvchilar</h2><p>{students.length} ta ro'yxatdan o'tgan</p></div>
        <input className="input" style={{ width: '260px' }} placeholder="🔍 Ism, email, username, guruh..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>
            <th>#</th><th>Ism Familya</th><th>Username</th><th>Email</th><th>Telefon</th><th>Guruh</th><th>Sana</th><th>Amal</th>
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--text3)' }}>{i + 1}</td>
                <td><b>{s.full_name}</b></td>
                <td style={{ color: 'var(--text2)', fontFamily: 'monospace', fontSize: '12px' }}>{s.login || '—'}</td>
                <td style={{ color: 'var(--text2)' }}>{s.email}</td>
                <td style={{ color: 'var(--text2)' }}>{s.phone}</td>
                <td>{s.group_name ? <span className="tag tag-blue">{s.group_name}</span> : '—'}</td>
                <td style={{ color: 'var(--text3)', fontSize: '12px' }}>{s.created_at?.slice(0, 10)}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>
                    ✏️ Tahrirlash
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
            🔍 Hech narsa topilmadi
          </div>
        )}
      </div>

      {editStudent && (
        <div className="modal-overlay" onClick={() => setEditStudent(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">✏️ O'quvchini tahrirlash</span>
              <button className="modal-close" onClick={() => setEditStudent(null)}>✕</button>
            </div>

            <div style={{ marginBottom: '16px', padding: '10px 12px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '13px', color: 'var(--text2)' }}>
              📧 {editStudent.email} &nbsp;|&nbsp; 📞 {editStudent.phone}
            </div>

            {editError && <div className="alert alert-error">{editError}</div>}
            {editSuccess && <div className="alert alert-success">{editSuccess}</div>}

            <div className="form-group">
              <label>Ism Familya</label>
              <input
                className="input"
                value={editForm.full_name}
                onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Karimov Karim"
              />
            </div>

            <div className="form-group">
              <label>Username (login)</label>
              <input
                className="input"
                value={editForm.login}
                onChange={e => setEditForm({ ...editForm, login: e.target.value })}
                placeholder="karimov_karim"
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <div className="form-group">
              <label>Guruh nomi</label>
              <input
                className="input"
                value={editForm.group_name}
                onChange={e => setEditForm({ ...editForm, group_name: e.target.value })}
                placeholder="G-01"
              />
              <small style={{ color: 'var(--text3)', fontSize: '11px' }}>Mavjud guruh nomi kiriting</small>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={handleEditSave}
              disabled={editLoading || !editForm.full_name}
            >
              {editLoading ? '...' : '✅ Saqlash'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== CALENDAR =====
function AdminCalendar({ groups }) {
  const [form, setForm] = useState({ group_id: '', title: '', event_date: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setSuccess('');
    try {
      await API.post('/admin/calendar', form);
      setSuccess('Tadbirda qo\'shildi!');
      setForm({ ...form, title: '', event_date: '' });
    } catch (e) { setError(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  return (
    <div className="fade-in">
      <div className="page-header"><h2>📅 Kalendar</h2><p>Guruhlar uchun tadbirlar qo'shish</p></div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <div className="card" style={{ maxWidth: '480px' }}>
        <h3 style={{ marginBottom: '20px', fontFamily: 'var(--font2)' }}>Yangi tadbir qo'shish</h3>
        <form onSubmit={handleAdd}>
          <div className="form-group">
            <label>Guruh</label>
            <select className="input" value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })} required>
              <option value="">Guruh tanlang</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Tadbir nomi</label>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Dars, Imtihon, ..." />
          </div>
          <div className="form-group">
            <label>Sana</label>
            <input className="input" type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? '...' : '📅 Qo\'shish'}
          </button>
        </form>
      </div>
    </div>
  );
}
