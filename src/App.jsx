// src/App.jsx
import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider } from 'firebase/auth'
import { doc, onSnapshot, setDoc, getDoc, getDocs, addDoc, updateDoc, writeBatch, collection, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { auth, db } from './firebase'
import ShoppingList from './components/ShoppingList'
import MasterProducts from './components/MasterProducts'
import Settings from './components/Settings'
import toast from 'react-hot-toast'

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

// ─── צור פרופיל אם לא קיים ───────────────────────────────────────────────────
async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || 'משתמש',
      email: user.email.toLowerCase(),
      isPremium: false,
      listId: null,
      partnerUid: null,
      partnerEmail: null,
      pendingInviteFrom: null,
      pendingInviteTo: null,
      createdAt: serverTimestamp(),
    })
  }
}

// ─── צור רשימה עצמאית ────────────────────────────────────────────────────────
async function createSoloList(uid) {
  const listRef = doc(collection(db, 'lists'))
  await setDoc(listRef, {
    members: [uid],
    createdAt: serverTimestamp(),
    createdBy: uid,
  })
  await updateDoc(doc(db, 'users', uid), { listId: listRef.id })
}

// ─── AuthScreen ───────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      const { user } = await signInWithPopup(auth, googleProvider)
      await ensureProfile(user)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') toast.error('שגיאה בכניסה עם Google')
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
          uid: user.uid, name: name.trim(), email: email.toLowerCase(),
          isPremium: false, listId: null, partnerUid: null, partnerEmail: null,
          pendingInviteFrom: null, pendingInviteTo: null, createdAt: serverTimestamp(),
        })
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (err) {
      const msgs = {
        'auth/email-already-in-use': 'המייל כבר רשום.',
        'auth/user-not-found': 'משתמש לא נמצא.',
        'auth/wrong-password': 'סיסמה שגויה.',
        'auth/weak-password': 'סיסמה חלשה מדי.',
        'auth/invalid-email': 'מייל לא תקין.',
        'auth/invalid-credential': 'אימייל או סיסמה שגויים.',
      }
      toast.error(msgs[err.code] || 'שגיאה, נסה שוב.')
    }
    setLoading(false)
  }

  return (
    <div style={a.container}>
      <div style={a.bgCircle1} /><div style={a.bgCircle2} />
      <div className="card fade-up" style={a.card}>
        <div style={a.logo}>
          <h1 style={a.logoText}>MamiTavi</h1>
          <p style={a.logoSub}>מאמי תביא — הרשימה שלנו</p>
        </div>

        <button onClick={handleGoogle} disabled={googleLoading} style={a.googleBtn}>
          {googleLoading ? '...' : (<>
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            המשך עם Google
          </>)}
        </button>

        <div style={a.divider}>
          <span style={a.line} /><span style={a.divText}>או</span><span style={a.line} />
        </div>

        <div style={a.tabs}>
          <button style={{ ...a.tab, ...(mode === 'login' ? a.tabActive : {}) }} onClick={() => setMode('login')}>כניסה</button>
          <button style={{ ...a.tab, ...(mode === 'register' ? a.tabActive : {}) }} onClick={() => setMode('register')}>הרשמה</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'register' && (
            <div style={a.field}>
              <label style={a.label}>שם</label>
              <input className="input" type="text" placeholder="למשל: דנה" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={a.field}>
            <label style={a.label}>אימייל</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div style={a.field}>
            <label style={a.label}>סיסמה</label>
            <input className="input" type="password" placeholder={mode === 'register' ? 'לפחות 6 תווים' : '••••••••'} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '14px', fontSize: '16px' }}>
            {loading ? '...' : mode === 'login' ? 'כניסה' : 'יצירת חשבון'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '18px', fontSize: '14px', color: 'var(--navy-mid)' }}>
          {mode === 'login' ? 'אין לך חשבון? ' : 'יש לך חשבון? '}
          <button className="btn-ghost" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ fontWeight: 700, color: 'var(--blue-dark)' }}>
            {mode === 'login' ? 'הירשם בחינם' : 'כניסה'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── PendingInvite ────────────────────────────────────────────────────────────
function PendingInvite({ user, profile, invite }) {
  const [loading, setLoading] = useState(null) // 'merge' | 'replace' | 'decline'

  async function handleAccept(merge) {
    setLoading(merge ? 'merge' : 'replace')
    try {
      const [inviterSnap, accepterSnap] = await Promise.all([
        getDoc(doc(db, 'users', invite.uid)),
        getDoc(doc(db, 'users', user.uid)),
      ])
      const inviterListId = inviterSnap.data()?.listId
      const accepterListId = accepterSnap.data()?.listId

      if (!inviterListId) {
        toast.error('שגיאה: לא נמצאה רשימה של המזמין')
        setLoading(null)
        return
      }

      // שלב 1: הוסף כ-member — עכשיו יש הרשאת כתיבה
      await updateDoc(doc(db, 'lists', inviterListId), {
        members: arrayUnion(user.uid),
      })

      // שלב 2: אם בחר מיזוג — העתק נתונים
      if (merge && accepterListId && accepterListId !== inviterListId) {
        const [itemsSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, 'lists', accepterListId, 'items')),
          getDocs(collection(db, 'lists', accepterListId, 'products')),
        ])
        await Promise.all([
          ...itemsSnap.docs.map(d => addDoc(collection(db, 'lists', inviterListId, 'items'), d.data())),
          ...productsSnap.docs.map(d => addDoc(collection(db, 'lists', inviterListId, 'products'), d.data())),
        ])
      }

      // שלב 3: עדכן פרופילים
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.uid), {
        partnerUid: invite.uid, partnerEmail: invite.email,
        pendingInviteFrom: null, listId: inviterListId,
      })
      batch.update(doc(db, 'users', invite.uid), {
        partnerUid: user.uid, partnerEmail: profile?.email || user.email,
        pendingInviteTo: null,
      })
      await batch.commit()
      toast.success(`מחובר עם ${invite.name}!`)
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
      setLoading(null)
    }
  }

  async function handleDecline() {
    setLoading('decline')
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.uid), { pendingInviteFrom: null })
      batch.update(doc(db, 'users', invite.uid), { pendingInviteTo: null })
      await batch.commit()
      toast.success('הבקשה נדחתה')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <div style={pi.page}>
      <div className="card fade-up" style={pi.card}>
        <h2 style={pi.title}>בקשת שיתוף</h2>
        <p style={pi.subtitle}>
          <strong>{invite.name}</strong> מזמין/ת אותך לנהל רשימת קניות משותפת
        </p>

        <div style={pi.options}>
          <button
            style={{ ...pi.option, ...(loading === 'merge' ? pi.optionActive : {}) }}
            onClick={() => handleAccept(true)}
            disabled={busy}
          >
            <span style={pi.optionIcon}>⊕</span>
            <div style={{ textAlign: 'right' }}>
              <p style={pi.optionTitle}>מזג רשימות</p>
              <p style={pi.optionDesc}>הפריטים והמוצרים שלך יצטרפו לרשימה של {invite.name}</p>
            </div>
          </button>

          <button
            style={{ ...pi.option, ...(loading === 'replace' ? pi.optionActive : {}) }}
            onClick={() => handleAccept(false)}
            disabled={busy}
          >
            <span style={pi.optionIcon}>→</span>
            <div style={{ textAlign: 'right' }}>
              <p style={pi.optionTitle}>השתמש ברשימה של {invite.name}</p>
              <p style={pi.optionDesc}>תתחיל עם הרשימה של השותף/ת, הנתונים שלך לא יועברו</p>
            </div>
          </button>
        </div>

        <button onClick={handleDecline} disabled={busy} style={pi.declineBtn}>
          {loading === 'decline' ? 'דוחה...' : 'דחה את הבקשה'}
        </button>
      </div>
    </div>
  )
}

const pi = {
  page: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' },
  card: { width: '100%', maxWidth: '420px' },
  title: { fontSize: '22px', fontWeight: 700, color: 'var(--navy)', marginBottom: '8px' },
  subtitle: { fontSize: '15px', color: 'var(--navy-mid)', lineHeight: 1.6, marginBottom: '24px' },
  options: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' },
  option: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '12px', border: '1.5px solid var(--bg-dark)', background: 'var(--bg)', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-body)', width: '100%' },
  optionActive: { borderColor: 'var(--blue)', background: 'var(--blue-light)' },
  optionIcon: { fontSize: '20px', color: 'var(--blue)', flexShrink: 0, width: '28px', textAlign: 'center', fontWeight: 700 },
  optionTitle: { fontSize: '15px', fontWeight: 700, color: 'var(--navy)', marginBottom: '3px' },
  optionDesc: { fontSize: '13px', color: 'var(--navy-mid)', lineHeight: 1.4 },
  declineBtn: { width: '100%', padding: '12px', background: 'transparent', border: '1.5px solid #FCA5A5', borderRadius: '10px', color: '#EF4444', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'list',     label: 'קניות' },
  { id: 'master',   label: 'מוצרים' },
  { id: 'settings', label: 'הגדרות' },
]

export default function App() {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [activeTab, setActiveTab] = useState('list')

  // Auth state
  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u ?? null)
      if (!u) setProfile(null)
    })
  }, [])

  // Profile listener
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setProfile(snap.data())
    })
    return unsub
  }, [user])

  // אם יש משתמש מחובר אבל עדיין אין listId — צור רשימה
  useEffect(() => {
    if (
      user && profile &&
      !profile.listId &&
      !profile.pendingInviteFrom &&
      !profile.pendingInviteTo &&
      !profile.partnerUid
    ) {
      createSoloList(user.uid)
    }
  }, [user, profile])

  // Loading
  if (user === undefined || (user && profile === undefined)) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontFamily: 'var(--font-body)' }}>טוען...</div>
  }

  if (!user) return <AuthScreen />

  // בקשת שיתוף ממתינה
  if (profile?.pendingInviteFrom) {
    return <PendingInvite user={user} profile={profile} invite={profile.pendingInviteFrom} />
  }

  // עדיין אין listId (ממתין ליצירה)
  if (!profile?.listId) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontFamily: 'var(--font-body)' }}>מכין רשימה...</div>
  }

  return (
    <div style={s.shell}>
      <header style={s.header}>
        <div style={s.headerTop}>
          <h1 style={s.headerTitle}>MamiTavi</h1>
          {profile?.partnerEmail && (
            <p style={s.headerSub}>{profile.nickname || profile.name} & {profile.partnerEmail.split('@')[0]}</p>
          )}
        </div>
        <nav style={s.nav}>
          {TABS.map(tab => (
            <button key={tab.id}
              style={{ ...s.navBtn, ...(activeTab === tab.id ? s.navBtnActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={s.main}>
        {activeTab === 'list'     && <ShoppingList user={user} profile={profile} listId={profile.listId} />}
        {activeTab === 'master'   && <MasterProducts user={user} profile={profile} listId={profile.listId} />}
        {activeTab === 'settings' && <Settings user={user} profile={profile} />}
      </main>
    </div>
  )
}

const s = {
  shell: { height: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', background: 'var(--bg)' },
  header: { background: 'white', borderBottom: '1px solid var(--bg-dark)', flexShrink: 0, padding: '14px 20px 0', boxShadow: '0 2px 8px rgba(30,58,95,0.06)' },
  headerTop: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '2px' },
  headerTitle: { fontSize: '20px', fontWeight: 700, color: 'var(--navy)' },
  headerSub: { fontSize: '12px', color: 'var(--blue)', flexShrink: 0 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  nav: { display: 'flex', marginTop: '10px' },
  navBtn: { flex: 1, padding: '11px 8px', border: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, color: 'var(--navy-mid)', cursor: 'pointer', borderBottom: '3px solid transparent', transition: 'all 0.15s' },
  navBtnActive: { color: 'var(--blue-dark)', fontWeight: 700, borderBottom: '3px solid var(--blue)' },
}

const a = {
  container: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden', background: 'var(--bg)' },
  bgCircle1: { position: 'fixed', top: '-80px', right: '-80px', width: '360px', height: '360px', borderRadius: '50%', background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)', opacity: 0.4, pointerEvents: 'none' },
  bgCircle2: { position: 'fixed', bottom: '-60px', left: '-60px', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, #BFDBFE 0%, transparent 70%)', opacity: 0.5, pointerEvents: 'none' },
  card: { width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 },
  logo: { textAlign: 'center', marginBottom: '28px' },
  logoText: { fontSize: '36px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '-0.5px' },
  logoSub: { fontSize: '14px', color: 'var(--blue)', marginTop: '4px' },
  googleBtn: { width: '100%', padding: '13px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1.5px solid var(--bg-dark)', borderRadius: '10px', background: 'white', fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 500, color: 'var(--navy)', cursor: 'pointer', marginBottom: '20px' },
  divider: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  line: { flex: 1, height: '1px', background: 'var(--bg-dark)' },
  divText: { fontSize: '13px', color: 'var(--navy-mid)' },
  tabs: { display: 'flex', gap: '4px', background: 'var(--bg)', borderRadius: '12px', padding: '4px', marginBottom: '20px' },
  tab: { flex: 1, padding: '10px', border: 'none', borderRadius: '9px', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'var(--navy-mid)', transition: 'all 0.2s' },
  tabActive: { background: 'white', color: 'var(--navy)', boxShadow: '0 2px 8px rgba(30,58,95,0.10)' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: 600, color: 'var(--navy-mid)' },
}
