import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import emailjs from '@emailjs/browser';

// EmailJS config - replace with yours
const EMAILJS_SERVICE = process.env.REACT_APP_EMAILJS_SERVICE || 'service_xxx';
const EMAILJS_TEMPLATE = process.env.REACT_APP_EMAILJS_TEMPLATE || 'template_xxx';
const EMAILJS_KEY = process.env.REACT_APP_EMAILJS_KEY || 'xxx';

const sendEmailCode = async (email, code) => {
  try {
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      to_email: email,
      code: code,
      message: `Sizning tasdiqlash kodingiz: ${code}`
    }, EMAILJS_KEY);
  } catch (e) {
    console.log('EmailJS error (backend will handle):', e);
  }
};

export default function LoginPage() {
  const [tab, setTab] = useState('mentor'); // mentor | student | register | forgot
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
  const [regStep, setRegStep] = useState(1); // 1=form, 2=code, 3=password
  const [regData, setRegData] = useState({ login: '', full_name: '', phone: '', email: '', group_name: '' });
  const [regCode, setRegCode] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [emailExistsWarning, setEmailExistsWarning] = useState(false);

  // Forgot
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');

  const err = (msg) => { setError(msg); setLoading(false); };
  const succ = (msg) => { setSuccess(msg); setLoading(false); };

  // ADMIN LOGIN
  const handleAdminLogin = async () => {
    setLoading(true); setError('');
    try {
      const res = await API.post('/auth/login/admin', { password: adminPass });
      login(res.data.token, { role: 'admin' });
      navigate('/admin');
    } catch (e) {
      err(e.response?.data?.error || 'Parol noto\'g\'ri');
    }
  };

  // MENTOR LOGIN
  const handleMentorLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await API.post('/auth/login/mentor', { phone: mentorPhone, password: mentorPass });
      login(res.data.token, { ...res.data.mentor, role: 'mentor' });
      navigate('/mentor');
    } catch (e) {
      err(e.response?.data?.error || 'Xatolik yuz berdi');
    }
  };

  // STUDENT LOGIN
  const handleStudentLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await API.post('/auth/login/student', { email: stuEmail, password: stuPass });
      login(res.data.token, { ...res.data.user, role: 'student' });
      navigate('/student');
    } catch (e) {
      err(e.response?.data?.error || 'Email yoki parol noto\'g\'ri');
    }
  };

  // REGISTER step 1 - send code
  const handleRegSendCode = async (e) => {
    e.preventDefault(); setLoading(true); setError(''); setEmailExistsWarning(false);
    try {
      await API.post('/auth/register/send-code', regData);
      setRegStep(2);
      succ('Tasdiqlash kodi emailingizga yuborildi!');
    } catch (e) {
      if (e.response?.data?.exists) {
        setEmailExistsWarning(true);
        setLoading(false);
      } else {
        err(e.response?.data?.error || 'Xatolik');
      }
    }
  };

  // Re-register existing email
  const handleReRegister = async () => {
    setLoading(true); setError(''); setEmailExistsWarning(false);
    try {
      await API.post('/auth/register/re-verify', { email: regData.email });
      setRegStep(2);
      succ('Yangi tasdiqlash kodi yuborildi!');
    } catch (e) { err(e.response?.data?.error || 'Xatolik'); }
  };

  // REGISTER step 2 - verify code
  const handleRegVerify = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    if (regPass !== regConfirm) return err('Parollar mos kelmadi');
    try {
      const res = await API.post('/auth/register/verify', {
        email: regData.email, code: regCode, password: regPass
      });
      login(res.data.token, { ...res.data.user, role: 'student' });
      navigate('/student');
    } catch (e) { err(e.response?.data?.error || 'Kod noto\'g\'ri'); }
  };

  // FORGOT step 1
  const handleForgotSend = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await API.post('/auth/forgot-password', { email: forgotEmail });
      setForgotStep(2);
      succ('Tasdiqlash kodi yuborildi!');
    } catch (e) { err(e.response?.data?.error || 'Email topilmadi'); }
  };

  // FORGOT step 2
  const handleForgotVerify = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await API.post('/auth/forgot-password/verify', { email: forgotEmail, code: forgotCode });
      succ('Yangi login va parol emailingizga yuborildi! ✓');
      setTimeout(() => { setTab('student'); setForgotStep(1); }, 2000);
    } catch (e) { err(e.response?.data?.error || 'Kod noto\'g\'ri'); }
  };

  const tabs = [
    { id: 'mentor', label: '👨‍🏫 Mentor' },
    { id: 'student', label: '🎓 O\'quvchi' },
    { id: 'register', label: '📝 Ro\'yxat' },
    { id: 'forgot', label: '🔑 Parol' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background effects */}
      <div style={{
        position: 'absolute', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(91,141,238,0.08) 0%, transparent 70%)',
        top: '-100px', left: '-100px', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)',
        bottom: '-50px', right: '-50px', pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            borderRadius: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', boxShadow: '0 8px 32px rgba(91,141,238,0.3)'
          }}>🤖</div>
          <h1 style={{
            fontFamily: 'var(--font2)', fontSize: '28px', fontWeight: '800',
            background: 'linear-gradient(135deg, var(--text), var(--accent))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>Ustoz Yordamchi AI</h1>
          <p style={{ color: 'var(--text3)', fontSize: '14px', marginTop: '6px' }}>ITpark — O'quvchilar platformasi</p>
        </div>

        {/* Card */}
        <div className="card" style={{ borderRadius: '20px', padding: '28px', position: 'relative' }}>
          
          {/* Admin key icon */}
          <button
            onClick={() => setShowAdminKey(!showAdminKey)}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: 'var(--text3)', padding: '4px',
              transition: 'color 0.2s'
            }}
            title="Admin kirish"
          >🔐</button>

          {/* Admin login modal */}
          {showAdminKey && (
            <div style={{
              position: 'absolute', top: '50px', right: '16px',
              background: 'var(--card2)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px', width: '220px',
              zIndex: 10, boxShadow: 'var(--shadow)'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '10px', fontWeight: '600' }}>
                🛡️ Admin kirish
              </p>
              <input
                className="input" type="password" placeholder="Admin paroli"
                value={adminPass} onChange={e => setAdminPass(e.target.value)}
                style={{ marginBottom: '10px' }}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              />
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdminLogin} disabled={loading}>
                {loading ? '...' : 'Kirish'}
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '24px' }}>
            {tabs.map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => { setTab(t.id); setError(''); setSuccess(''); }}
                style={{ flex: 1, fontSize: '12px', padding: '8px 4px' }}>
                {t.label}
              </button>
            ))}
          </div>

          {error && <div className="alert alert-error">⚠️ {error}</div>}
          {success && <div className="alert alert-success">✅ {success}</div>}

          {/* ===== MENTOR LOGIN ===== */}
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
              <button className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '15px', marginTop: '8px' }}
                type="submit" disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> Kirish...</> : '👨‍🏫 Mentor sifatida kirish'}
              </button>
            </form>
          )}

          {/* ===== STUDENT LOGIN ===== */}
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
              <button className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '15px', marginTop: '8px' }}
                type="submit" disabled={loading}>
                {loading ? '...' : '🎓 Kirish'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: 'var(--text3)' }}>
                Parolni unutdingizmi?{' '}
                <button type="button" onClick={() => setTab('forgot')}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '13px' }}>
                  Tiklash
                </button>
              </p>
            </form>
          )}

          {/* ===== REGISTER ===== */}
          {tab === 'register' && (
            <div className="fade-in">
              {/* Email already exists warning */}
              {emailExistsWarning && (
                <div style={{
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: '10px', padding: '14px', marginBottom: '16px'
                }}>
                  <p style={{ fontSize: '14px', color: '#fbbf24', marginBottom: '10px' }}>
                    ⚠️ Bu email bilan avval ro'yxatdan o'tilgan. Nima qilmoqchisiz?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-sm" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', flex: 1 }}
                      onClick={() => { setEmailExistsWarning(false); setTab('student'); setStuEmail(regData.email); }}>
                      Kirish
                    </button>
                    <button className="btn btn-sm" style={{ background: 'rgba(91,141,238,0.2)', color: 'var(--accent)', flex: 1 }}
                      onClick={handleReRegister} disabled={loading}>
                      Yangi akkount
                    </button>
                  </div>
                </div>
              )}

              {regStep === 1 && (
                <form onSubmit={handleRegSendCode}>
                  <div className="form-group">
                    <label>👤 Login</label>
                    <input className="input" placeholder="loginname" value={regData.login}
                      onChange={e => setRegData({ ...regData, login: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>📛 Ism Familya</label>
                    <input className="input" placeholder="Abdullayev Abdulloh" value={regData.full_name}
                      onChange={e => setRegData({ ...regData, full_name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>📱 Telefon raqam</label>
                    <input className="input" type="tel" placeholder="+998901234567" value={regData.phone}
                      onChange={e => setRegData({ ...regData, phone: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>📧 Email</label>
                    <input className="input" type="email" placeholder="email@example.com" value={regData.email}
                      onChange={e => setRegData({ ...regData, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>🏫 Guruh nomi</label>
                    <input className="input" placeholder="G-01, Python-2024 ..." value={regData.group_name}
                      onChange={e => setRegData({ ...regData, group_name: e.target.value })} required />
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '...' : '📨 Tasdiqlash kodini yuborish'}
                  </button>
                </form>
              )}

              {regStep === 2 && (
                <form onSubmit={handleRegVerify}>
                  <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '16px' }}>
                    📧 <b>{regData.email}</b> ga tasdiqlash kodi yuborildi
                  </p>
                  <div className="form-group">
                    <label>🔢 Tasdiqlash kodi (6 xonali)</label>
                    <input className="input" placeholder="123456" value={regCode}
                      onChange={e => setRegCode(e.target.value)} maxLength={6} required
                      style={{ fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }} />
                  </div>
                  <div className="form-group">
                    <label>🔒 Yangi parol</label>
                    <input className="input" type="password" placeholder="Kamida 6 ta belgi" value={regPass}
                      onChange={e => setRegPass(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>🔒 Parolni tasdiqlang</label>
                    <input className="input" type="password" placeholder="Parolni qaytaring" value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '...' : '✅ Ro\'yxatdan o\'tish'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}
                    onClick={() => setRegStep(1)}>← Orqaga</button>
                </form>
              )}
            </div>
          )}

          {/* ===== FORGOT PASSWORD ===== */}
          {tab === 'forgot' && (
            <div className="fade-in">
              {forgotStep === 1 && (
                <form onSubmit={handleForgotSend}>
                  <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '16px' }}>
                    Emailingizni kiriting, tasdiqlash kodi yuboramiz
                  </p>
                  <div className="form-group">
                    <label>📧 Email</label>
                    <input className="input" type="email" placeholder="email@example.com"
                      value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '...' : '📨 Kod yuborish'}
                  </button>
                </form>
              )}
              {forgotStep === 2 && (
                <form onSubmit={handleForgotVerify}>
                  <p style={{ color: 'var(--text2)', fontSize: '14px', marginBottom: '16px' }}>
                    📧 <b>{forgotEmail}</b> ga kod yuborildi
                  </p>
                  <div className="form-group">
                    <label>🔢 Tasdiqlash kodi</label>
                    <input className="input" placeholder="123456" value={forgotCode}
                      onChange={e => setForgotCode(e.target.value)} maxLength={6}
                      style={{ fontSize: '24px', letterSpacing: '8px', textAlign: 'center' }} />
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ width: '100%', padding: '13px' }} disabled={loading}>
                    {loading ? '...' : '🔓 Tasdiqlash'}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '8px' }}
                    onClick={() => setForgotStep(1)}>← Orqaga</button>
                </form>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '12px', marginTop: '20px' }}>
          © 2024 Ustoz Yordamchi AI · ITpark
        </p>
      </div>
    </div>
  );
}
