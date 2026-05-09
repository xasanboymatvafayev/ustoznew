import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import emailjs from '@emailjs/browser';
import API from '../utils/api';

// ✅ EmailJS sozlamalari — .env dan o'qiladi
const EJS_SERVICE  = process.env.REACT_APP_EMAILJS_SERVICE;
const EJS_TEMPLATE = process.env.REACT_APP_EMAILJS_TEMPLATE;
const EJS_KEY      = process.env.REACT_APP_EMAILJS_KEY;

// ✅ EmailJS orqali tasdiqlash kodi yuborish
// Template da bu o'zgaruvchilar bo'lishi kerak:
//   {{to_email}}  — kimga
//   {{to_name}}   — ism
//   {{code}}      — tasdiqlash kodi
const sendVerificationEmail = async (toEmail, toName, code) => {
  await emailjs.send(
    EJS_SERVICE,
    EJS_TEMPLATE,
    {
      to_email: toEmail,
      to_name:  toName || 'Foydalanuvchi',
      code:     code,
    },
    EJS_KEY
  );
};

// ✅ Yangi parol emailga yuborish
// Template da: {{to_email}}, {{to_name}}, {{login}}, {{new_password}}
const sendNewPasswordEmail = async (toEmail, toName, login, newPassword) => {
  await emailjs.send(
    EJS_SERVICE,
    EJS_TEMPLATE,
    {
      to_email:     toEmail,
      to_name:      toName || 'Foydalanuvchi',
      code:         `Login: ${login} | Parol: ${newPassword}`,
    },
    EJS_KEY
  );
};

export default function LoginPage() {
  const [tab, setTab] = useState('mentor');
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // Mentor login
  const [mentorPhone, setMentorPhone] = useState('');
  const [mentorPass, setMentorPass] = useState('');

  // Student login
  const [stuEmail, setStuEmail] = useState('');
  const [stuPass, setStuPass] = useState('');

  // Register
  const [regStep, setRegStep] = useState(1);
  const [regData, setRegData] = useState({
    login: '', full_name: '', phone: '', email: '', group_name: '', password: '', confirm: ''
  });
  const [regCode, setRegCode] = useState('');
  const [emailExists, setEmailExists] = useState(false);

  // Forgot
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');

  const clearMessages = () => { setError(''); setSuccess(''); };
  const err  = (msg) => { setError(msg);   setLoading(false); };
  const succ = (msg) => { setSuccess(msg); setLoading(false); };

  // ── ADMIN ──
  const handleAdminLogin = async () => {
    setLoading(true); clearMessages();
    try {
      // center_id ni URL dan yoki localStorage dan olamiz
      const pathCenterId = window.location.pathname.split('/center/')[1]?.split('/')[0];
      const center_id = pathCenterId || localStorage.getItem('center_id');
      const res = await API.post('/auth/login/admin', { password: adminPass, center_id });
      login(res.data.token, { role: 'admin', center_id: res.data.center_id });
      const redirectPath = center_id ? `/center/${center_id}/admin` : '/admin';
      navigate(redirectPath);
    } catch (e) { err(e.response?.data?.error || 'Parol noto\'g\'ri'); }
  };

  // ── MENTOR ──
  const handleMentorLogin = async (e) => {
    e.preventDefault(); setLoading(true); clearMessages();
    try {
      const res = await API.post('/auth/login/mentor', { phone: mentorPhone, password: mentorPass });
      login(res.data.token, { ...res.data.mentor, role: 'mentor' });
      navigate('/mentor');
    } catch (e) { err(e.response?.data?.error || 'Telefon yoki parol noto\'g\'ri'); }
  };

  // ── STUDENT LOGIN ──
  const handleStudentLogin = async (e) => {
    e.preventDefault(); setLoading(true); clearMessages();
    try {
      const res = await API.post('/auth/login/student', { email: stuEmail, password: stuPass });
      login(res.data.token, { ...res.data.user, role: 'student' });
      navigate('/student');
    } catch (e) { err(e.response?.data?.error || 'Email yoki parol noto\'g\'ri'); }
  };

  // ── REGISTER step 1 — backend dan kod olib, EmailJS orqali yuborish ──
  const handleRegSendCode = async (e) => {
    e.preventDefault(); clearMessages(); setEmailExists(false);
    if (regData.password !== regData.confirm) return err('Parollar mos kelmadi');
    if (regData.password.length < 6) return err('Parol kamida 6 ta belgi bo\'lishi kerak');
    setLoading(true);
    try {
      // 1. Backend dan kod olish
      const res = await API.post('/auth/register/send-code', {
        login:      regData.login,
        full_name:  regData.full_name,
        phone:      regData.phone,
        email:      regData.email,
        group_name: regData.group_name,
        password:   regData.password,
      });

      // 2. EmailJS orqali frontenddan yuborish
      await sendVerificationEmail(regData.email, regData.full_name, res.data.code);

      setRegStep(2);
      succ('✅ Tasdiqlash kodi ' + regData.email + ' ga yuborildi!');
    } catch (e) {
      if (e.response?.data?.exists) {
        setEmailExists(true);
        setLoading(false);
      } else {
        err(e.response?.data?.error || 'Xatolik yuz berdi');
      }
    }
  };

  // ── REGISTER step 2 — kodni tekshirish ──
  const handleRegVerify = async (e) => {
    e.preventDefault(); setLoading(true); clearMessages();
    try {
      const res = await API.post('/auth/register/verify', {
        email: regData.email,
        code:  regCode,
      });
      login(res.data.token, { ...res.data.user, role: 'student' });
      navigate('/student');
    } catch (e) { err(e.response?.data?.error || 'Kod noto\'g\'ri yoki muddati o\'tgan'); }
  };

  // ── Re-verify — eski akkauntni o'chirib yangi ochish ──
  const handleDeleteAndReregister = async () => {
    setLoading(true); clearMessages(); setEmailExists(false);
    try {
      const res = await API.post('/auth/register/re-verify', { email: regData.email });
      await sendVerificationEmail(regData.email, regData.full_name, res.data.code);
      setRegStep(2);
      succ('✅ Tasdiqlash kodi yuborildi.');
    } catch (e) { err(e.response?.data?.error || 'Xatolik'); }
    setLoading(false);
  };

  const handleGoForgot = () => {
    setForgotEmail(regData.email);
    setEmailExists(false);
    setTab('forgot');
    clearMessages();
  };

  // ── FORGOT step 1 — kod yuborish ──
  const handleForgotSend = async (e) => {
    e.preventDefault(); setLoading(true); clearMessages();
    try {
      const res = await API.post('/auth/forgot-password', { email: forgotEmail });
      await sendVerificationEmail(forgotEmail, '', res.data.code);
      setForgotStep(2);
      succ('✅ Tasdiqlash kodi yuborildi!');
    } catch (e) { err(e.response?.data?.error || 'Bu email topilmadi'); }
  };

  // ── FORGOT step 2 — kodni tekshirib yangi parol olish ──
  const handleForgotVerify = async (e) => {
    e.preventDefault(); setLoading(true); clearMessages();
    try {
      const res = await API.post('/auth/forgot-password/verify', { email: forgotEmail, code: forgotCode });
      // Yangi parolni EmailJS orqali yuborish
      await sendNewPasswordEmail(forgotEmail, '', res.data.login, res.data.newPassword);
      succ('✅ Yangi login va parol emailingizga yuborildi!');
      setTimeout(() => { setTab('student'); setForgotStep(1); clearMessages(); }, 2500);
    } catch (e) { err(e.response?.data?.error || 'Kod noto\'g\'ri'); }
  };

  const tabs = [
    { id: 'mentor',   label: '👨‍🏫 Mentor' },
    { id: 'student',  label: '🎓 Kirish' },
    { id: 'register', label: '📝 Ro\'yxat' },
    { id: 'forgot',   label: '🔑 Parol' },
  ];

  const BOT_LINK = 'https://t.me/UstozYordamchi_AI_bot';

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(91,141,238,0.08) 0%, transparent 70%)', top: '-100px', left: '-100px', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)', bottom: '-50px', right: '-50px', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', boxShadow: '0 8px 32px rgba(91,141,238,0.3)'
          }}>🤖</div>
          <h1 style={{
            fontFamily: 'var(--font2)', fontSize: '28px', fontWeight: '800',
            background: 'linear-gradient(135deg, var(--text), var(--accent))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>Ustoz Yordamchi AI</h1>
          <p style={{ color: 'var(--text3)', fontSize: '14px', marginTop: '6px' }}>ITpark — O'quvchilar platformasi</p>
        </div>

        <div className="card" style={{ borderRadius: '20px', padding: '28px', position: 'relative' }}>

          {/* Admin key icon */}
          <button onClick={() => setShowAdminKey(!showAdminKey)} style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '18px', color: 'var(--text3)', padding: '4px'
          }} title="Admin kirish">🔐</button>

          {showAdminKey && (
            <div style={{
              position: 'absolute', top: '50px', right: '16px',
              background: 'var(--card2)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px', width: '220px',
              zIndex: 10, boxShadow: 'var(--shadow)'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '10px', fontWeight: '600' }}>🛡️ Admin kirish</p>
              <input className="input" type="password" placeholder="Admin paroli"
                value={adminPass} onChange={e => setAdminPass(e.target.value)}
                style={{ marginBottom: '10px' }}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} />
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdminLogin} disabled={loading}>
                {loading ? '...' : 'Kirish'}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '24px' }}>
            {tabs.map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => {
                  setTab(t.id); clearMessages();
                  setEmailExists(false); setRegStep(1);
                }}
                style={{ flex: 1, fontSize: '12px', padding: '8px 4px' }}>
                {t.label}
              </button>
            ))}
          </div>

          {error   && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* ── MENTOR ── */}
          {tab === 'mentor' && (
            <form onSubmit={handleMentorLogin} className="fade-in">
              <div className="form-group">
                <label>📱 Telefon raqam</label>
                <input className="input" type="tel" placeholder="+998901234567"
                  value={mentorPhone} onChange={e => setMentorPhone(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>🔒 Parol</label>
                <input className="input" type="password" placeholder="Parolni kiriting"
                  value={mentorPass} onChange={e => setMentorPass(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit"
                style={{ width: '100%', padding: '13px', fontSize: '15px', marginTop: '8px' }} disabled={loading}>
                {loading ? '⏳ Kirilmoqda...' : '👨‍🏫 Mentor sifatida kirish'}
              </button>
            </form>
          )}

          {/* ── STUDENT LOGIN ── */}
          {tab === 'student' && (
            <form onSubmit={handleStudentLogin} className="fade-in">
              <div className="form-group">
                <label>📧 Email</label>
                <input className="input" type="email" placeholder="email@example.com"
                  value={stuEmail} onChange={e => setStuEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>🔒 Parol</label>
                <input className="input" type="password" placeholder="Parolni kiriting"
                  value={stuPass} onChange={e => setStuPass(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit"
                style={{ width: '100%', padding: '13px', fontSize: '15px', marginTop: '8px' }} disabled={loading}>
                {loading ? '⏳ Kirilmoqda...' : '🎓 Kirish'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px', color: 'var(--text3)' }}>
                Parolni unutdingizmi?{' '}
                <button type="button" onClick={() => { setTab('forgot'); clearMessages(); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  Tiklash →
                </button>
              </p>
            </form>
          )}

          {/* ── REGISTER ── */}
          {tab === 'register' && (
            <div className="fade-in">

              {emailExists && (
                <div style={{
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)',
                  borderRadius: '14px', padding: '18px', marginBottom: '4px'
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '8px' }}>⚠️</div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#fbbf24', marginBottom: '6px' }}>
                    Bu email bilan avval ro'yxatdan o'tilgan!
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>Nima qilmoqchisiz?</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn" onClick={handleGoForgot}
                      style={{ background: 'rgba(91,141,238,0.15)', color: 'var(--accent)', border: '1px solid rgba(91,141,238,0.3)', justifyContent: 'center', padding: '11px' }}>
                      🔑 Parolni tiklash
                    </button>
                    <button className="btn" onClick={handleDeleteAndReregister} disabled={loading}
                      style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.3)', justifyContent: 'center', padding: '11px' }}>
                      {loading ? '⏳...' : '🗑️ Eski akkauntni o\'chirib yangi ochish'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setEmailExists(false); clearMessages(); }}
                      style={{ justifyContent: 'center' }}>
                      ← Bekor qilish
                    </button>
                  </div>
                </div>
              )}

              {/* Step 1 */}
              {!emailExists && regStep === 1 && (
                <form onSubmit={handleRegSendCode}>
                  <div className="form-group">
                    <label>👤 Login</label>
                    <input className="input" placeholder="loginname"
                      value={regData.login} onChange={e => setRegData({ ...regData, login: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>📛 Ism Familya</label>
                    <input className="input" placeholder="Abdullayev Abdulloh"
                      value={regData.full_name} onChange={e => setRegData({ ...regData, full_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>📱 Telefon raqam</label>
                    <input className="input" type="tel" placeholder="+998901234567"
                      value={regData.phone} onChange={e => setRegData({ ...regData, phone: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>📧 Email</label>
                    <input className="input" type="email" placeholder="email@example.com"
                      value={regData.email} onChange={e => setRegData({ ...regData, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>🏫 Guruh nomi</label>
                    <input className="input" placeholder="G-01, Python-2024 ..."
                      value={regData.group_name} onChange={e => setRegData({ ...regData, group_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>🔒 Parol</label>
                    <input className="input" type="password" placeholder="Kamida 6 ta belgi"
                      value={regData.password} onChange={e => setRegData({ ...regData, password: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>🔒 Parolni tasdiqlang</label>
                    <input className="input" type="password" placeholder="Parolni qaytaring"
                      value={regData.confirm} onChange={e => setRegData({ ...regData, confirm: e.target.value })} required />
                  </div>
                  <button className="btn btn-primary" type="submit"
                    style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '⏳ Yuborilmoqda...' : '📨 Tasdiqlash kodini yuborish'}
                  </button>
                </form>
              )}

              {/* Step 2 */}
              {!emailExists && regStep === 2 && (
                <form onSubmit={handleRegVerify}>
                  <div style={{
                    background: 'rgba(91,141,238,0.08)', border: '1px solid rgba(91,141,238,0.25)',
                    borderRadius: '12px', padding: '14px', marginBottom: '20px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>📧</div>
                    <p style={{ fontSize: '13px', color: 'var(--text2)' }}>
                      Tasdiqlash kodi <b style={{ color: 'var(--accent)' }}>{regData.email}</b> ga yuborildi
                    </p>
                  </div>
                  <div className="form-group">
                    <label style={{ textAlign: 'center', display: 'block' }}>🔢 Tasdiqlash kodi kiriting</label>
                    <input className="input" placeholder="· · · · · ·"
                      value={regCode} onChange={e => setRegCode(e.target.value.replace(/\D/g, ''))}
                      maxLength={6} required autoFocus
                      style={{ fontSize: '32px', letterSpacing: '14px', textAlign: 'center', fontWeight: '700', padding: '16px' }} />
                  </div>
                  <button className="btn btn-primary" type="submit"
                    style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '⏳ Tekshirilmoqda...' : '✅ Tasdiqlash va kirish'}
                  </button>
                  <button type="button" className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '8px' }}
                    onClick={() => { setRegStep(1); clearMessages(); }}>
                    ← Orqaga
                  </button>
                  <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--text3)' }}>
                    Kod kelmadimi?{' '}
                    <button type="button" onClick={handleRegSendCode}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                      Qayta yuborish
                    </button>
                  </p>
                </form>
              )}
            </div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {tab === 'forgot' && (
            <div className="fade-in">
              {forgotStep === 1 && (
                <form onSubmit={handleForgotSend}>
                  <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '16px' }}>
                    Emailingizni kiriting, yangi parol yuboramiz
                  </p>
                  <div className="form-group">
                    <label>📧 Email</label>
                    <input className="input" type="email" placeholder="email@example.com"
                      value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit"
                    style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '⏳ Yuborilmoqda...' : '📨 Kod yuborish'}
                  </button>
                </form>
              )}
              {forgotStep === 2 && (
                <form onSubmit={handleForgotVerify}>
                  <div style={{
                    background: 'rgba(91,141,238,0.08)', border: '1px solid rgba(91,141,238,0.25)',
                    borderRadius: '12px', padding: '14px', marginBottom: '20px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>📧</div>
                    <p style={{ fontSize: '13px', color: 'var(--text2)' }}>
                      Kod <b style={{ color: 'var(--accent)' }}>{forgotEmail}</b> ga yuborildi
                    </p>
                  </div>
                  <div className="form-group">
                    <label style={{ textAlign: 'center', display: 'block' }}>🔢 Tasdiqlash kodi</label>
                    <input className="input" placeholder="· · · · · ·"
                      value={forgotCode} onChange={e => setForgotCode(e.target.value.replace(/\D/g, ''))}
                      maxLength={6} autoFocus
                      style={{ fontSize: '32px', letterSpacing: '14px', textAlign: 'center', fontWeight: '700', padding: '16px' }} />
                  </div>
                  <button className="btn btn-primary" type="submit"
                    style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '⏳ Tekshirilmoqda...' : '🔓 Tasdiqlash'}
                  </button>
                  <button type="button" className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '8px' }}
                    onClick={() => { setForgotStep(1); clearMessages(); }}>
                    ← Orqaga
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Ota-ona panel tugmasi */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <a
            href={BOT_LINK}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'linear-gradient(135deg, #229ED9, #1a7fb5)',
              color: '#fff', padding: '10px 20px', borderRadius: '12px',
              textDecoration: 'none', fontSize: '14px', fontWeight: '600',
              boxShadow: '0 4px 12px rgba(34,158,217,0.35)',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <span style={{ fontSize: '18px' }}>✈️</span>
            Ota-ona paneli (Telegram)
          </a>
          <p style={{ color: 'var(--text3)', fontSize: '11px', marginTop: '6px' }}>
            Farzandingiz baholari va davomati
          </p>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '12px', marginTop: '16px' }}>
          © 2024 Ustoz Yordamchi AI · ITpark
        </p>
      </div>
    </div>
  );
}
