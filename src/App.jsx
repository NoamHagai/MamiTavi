// src/App.jsx
import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import InvitePartner from './components/InvitePartner'
import ShoppingList from './components/ShoppingList'
import MasterProducts from './components/MasterProducts'
import Settings from './components/Settings'
import PendingInvite from './components/PendingInvite'

const TABS = [
  { id: 'list',     label: 'קניות' },
  { id: 'master',   label: 'מוצרים' },
  { id: 'settings', label: 'הגדרות' },
]

export default function App() {
  const { user } = useAuth()
  const [liveProfile, setLiveProfile] = useState(undefined)
  const [activeTab, setActiveTab] = useState('list')

  // Listen to own profile — skip stale offline cache to prevent flicker
  useEffect(() => {
    if (!user) { setLiveProfile(null); return }
    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      { includeMetadataChanges: true },
      snap => {
        if (snap.metadata.fromCache) return  // wait for server-confirmed data
        if (snap.exists()) {
          setLiveProfile(snap.data())
        } else {
          setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: user.displayName || 'משתמש',
            email: user.email?.toLowerCase() || '',
            isPremium: false,
            createdAt: serverTimestamp(),
            partnerEmail: null,
            partnerUid: null,
            listId: null,
            pendingInviteFrom: null,
            pendingInviteTo: null,
          })
        }
      }
    )
    return unsub
  }, [user])

  // When connected (listId set), clear own pendingInviteTo (self-write — no rules needed)
  useEffect(() => {
    if (user && liveProfile?.listId && liveProfile?.pendingInviteTo) {
      updateDoc(doc(db, 'users', user.uid), { pendingInviteTo: null })
    }
  }, [user, liveProfile?.listId, liveProfile?.pendingInviteTo])

  if (user === undefined || (user && liveProfile === undefined)) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)', fontFamily: 'var(--font-body)', fontSize: '16px' }}>
        טוען...
      </div>
    )
  }

  if (!user) return <AuthScreen />

  // Incoming invite — intercept before anything else
  if (liveProfile?.pendingInviteFrom) {
    return <PendingInvite user={user} profile={liveProfile} invite={liveProfile.pendingInviteFrom} />
  }

  if (!liveProfile?.listId) {
    return (
      <InvitePartner
        user={user}
        profile={liveProfile}
        onDone={(listId, partnerEmail) => {
          if (listId) setLiveProfile(p => ({ ...p, listId, partnerEmail }))
        }}
      />
    )
  }

  return (
    <div style={s.shell}>
      <header style={s.header}>
        <h1 style={s.headerTitle}>MamiTavi</h1>
        {liveProfile?.partnerEmail && (
          <p style={s.headerSub}>{liveProfile.name} & {liveProfile.partnerEmail.split('@')[0]}</p>
        )}
        <nav style={s.nav}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              style={{ ...s.navBtn, ...(activeTab === tab.id ? s.navBtnActive : {}) }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={s.main}>
        {activeTab === 'list'     && <ShoppingList user={user} profile={liveProfile} listId={liveProfile.listId} />}
        {activeTab === 'master'   && <MasterProducts user={user} profile={liveProfile} listId={liveProfile.listId} />}
        {activeTab === 'settings' && <Settings user={user} profile={liveProfile} />}
      </main>
    </div>
  )
}

const s = {
  shell: { height: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', background: 'var(--bg)' },
  header: {
    background: 'white',
    borderBottom: '1px solid var(--bg-dark)',
    flexShrink: 0,
    padding: '14px 20px 0',
    boxShadow: '0 2px 8px rgba(30,58,95,0.06)',
  },
  headerTitle: { fontSize: '20px', fontWeight: 700, color: 'var(--navy)', letterSpacing: '-0.3px' },
  headerSub: { fontSize: '12px', color: 'var(--blue)', marginTop: '2px', marginBottom: '10px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  nav: { display: 'flex', marginTop: '10px' },
  navBtn: {
    flex: 1, padding: '11px 8px',
    border: 'none', background: 'transparent',
    fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 500,
    color: 'var(--navy-mid)', cursor: 'pointer',
    borderBottom: '3px solid transparent',
    transition: 'all 0.15s',
  },
  navBtnActive: {
    color: 'var(--blue-dark)',
    fontWeight: 700,
    borderBottom: '3px solid var(--blue)',
  },
}
