// src/components/AuthScreen.jsx
import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import toast from 'react-hot-toast'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// יצירת/עדכון פרופיל ב-Firestore אחרי כניסה עם Google
async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || 'משתמש',
      email: user.email.toLowerCase(),
      isPremium: false,
      createdAt: serverTimestamp(),
      partnerEmail: null,
      listId: null,
    })
  }
}

export default function AuthScreen() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await ensureUserProfile(result.user)
      toast.success(`ברוך הבא, ${result.user.displayName?.split(' ')[0]}! 🎉`)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('שגיאה בכניסה עם Google, נסה שוב.')
      }
    }
    setGoogleLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      if (mode === 'register') {
        if (!name.trim()) { toast.error('אנא הכנס שם'); setLoading(false); return }
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(user, { displayName: name })
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: name.trim(),
          email: email.toLowerCase(),
          isPremium: false,
          createdAt: serverTimestamp(),
          partnerEmail: null,
          listId: null,
        })
        toast.success(`ברוך הבא, ${name}! 🎉`)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
        toast.success('ברוך הבא בחזרה!')
      }
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'המייל כבר רשום. נסה להתחבר.',
        'auth/user-not-found': 'המשתמש לא נמצא.',
        'auth/wrong-password': 'סיסמה שגויה.',
        'auth/weak-password': 'הסיסמה חלשה מדי (לפחות 6 תווים).',
        'auth/invalid-email': 'כתובת מייל לא תקינה.',
        'auth/invalid-credential': 'אימייל או סיסמה שגויים.',
      }
      toast.error(msgs[err.code] || 'שגיאה, אנא נסה שוב.')
    }
    setLoading(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.bgCircle1} />
      <div style={styles.bgCircle2} />

      <div className="card fade-up" style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🛒</span>
          <h1 style={styles.logoText}>MamiTavi</h1>
          <p style={styles.tagline}>מאמי תביא — הרשימה שלנו</p>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          style={styles.googleBtn}
        >
          {googleLoading ? '...' : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              המשך עם Google
            </>
          )}
        </button>

        {/* Divider */}
        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>או</span>
          <span style={styles.dividerLine} />
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
            onClick={() => setMode('login')}
          >כניסה</button>
          <button
            style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
            onClick={() => setMode('register')}
          >הרשמה</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'register' && (
            <div className="fade-up" style={styles.field}>
              <label style={styles.label}>שמך</label>
              <input
                className="input"
                type="text"
                placeholder="למשל: דנה"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>אימייל</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              dir="ltr"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>סיסמה</label>
            <input
              className="input"
              type="password"
              placeholder={mode === 'register' ? 'לפחות 6 תווים' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            className="btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: 8, padding: '14px', fontSize: '16px' }}
          >
            {loading ? '...' : mode === 'login' ? 'כניסה' : 'יצירת חשבון'}
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === 'login' ? 'אין לך חשבון עדיין? ' : 'יש לך חשבון? '}
          <button className="btn-ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ padding: '2px 6px', fontWeight: 600, color: 'var(--rose-dark)' }}>
            {mode === 'login' ? 'הירשם בחינם' : 'כניסה'}
          </button>
        </p>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'fixed', top: '-80px', right: '-80px',
    width: '360px', height: '360px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, #E8A598 0%, transparent 70%)',
    opacity: 0.35, pointerEvents: 'none',
  },
  bgCircle2: {
    position: 'fixed', bottom: '-60px', left: '-60px',
    width: '280px', height: '280px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, #C9A96E 0%, transparent 70%)',
    opacity: 0.25, pointerEvents: 'none',
  },
  card: { width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 },
  logo: { textAlign: 'center', marginBottom: '28px' },
  logoIcon: { fontSize: '48px', display: 'block', marginBottom: '8px' },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: '38px', fontWeight: 600,
    color: 'var(--espresso)', letterSpacing: '-0.5px',
    marginBottom: '4px',
  },
  tagline: { color: 'var(--rose-dark)', fontSize: '14px', fontWeight: 400 },
  googleBtn: {
    width: '100%', padding: '13px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    border: '1.5px solid #E0D0C8',
    borderRadius: '10px',
    background: 'white',
    fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 500,
    color: 'var(--espresso)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginBottom: '20px',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: '12px',
    marginBottom: '20px',
  },
  dividerLine: {
    flex: 1, height: '1px', background: 'var(--cream-dark)',
  },
  dividerText: {
    fontSize: '13px', color: '#B8A898', fontWeight: 500,
  },
  tabs: {
    display: 'flex', gap: '4px',
    background: 'var(--cream)',
    borderRadius: '12px', padding: '4px',
    marginBottom: '24px',
  },
  tab: {
    flex: 1, padding: '10px',
    border: 'none', borderRadius: '9px',
    fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500,
    cursor: 'pointer', background: 'transparent',
    color: 'var(--espresso-mid)', transition: 'all 0.2s',
  },
  tabActive: { background: 'white', color: 'var(--espresso)', boxShadow: '0 2px 8px rgba(44,24,16,0.10)' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 500, color: 'var(--espresso-mid)' },
  switchText: { textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--espresso-mid)' },
}
