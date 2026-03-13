// src/App.jsx
import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import InvitePartner from './components/InvitePartner'
import ShoppingList from './components/ShoppingList'
import MasterProducts from './components/MasterProducts'
import Settings from './components/Settings'

const TABS = [
  { id: 'list',     label: 'רשימת קניות' },
  { id: 'master',   label: 'מוצרים' },
  { id: 'settings', label: 'הגדרות' },
]

export default function App() {
  const { user } = useAuth()
  const [liveProfile, setLiveProfile] = useState(undefined)
  const [activeTab, setActiveTab] = useState('list')

  useEffect(() => {
    if (!user) { setLiveProfile(null); return }
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
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
          listId: null,
        })
      }
    })
    return unsub
  }, [user])

  if (user === undefined || (user && liveProfile === undefined)) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose-dark)', fontFamily: 'var(--font-body)', fontSize: '16px' }}>
        טוען...
      </div>
    )
  }

  if (!user) return <AuthScreen />

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
      {/* Header */}
      <header style={s.header}>
        <h1 style={s.headerTitle}>MamiTavi</h1>
        {liveProfile?.partnerEmail && (
          <p style={s.headerSub}>{liveProfile.name} & {liveProfile.partnerEmail.split('@')[0]}</p>
        )}
      </header>

      {/* Page content */}
      <main style={s.main}>
        {activeTab === 'list'     && <ShoppingList user={user} profile={liveProfile} listId={liveProfile.listId} />}
        {activeTab === 'master'   && <MasterProducts user={user} profile={liveProfile} listId={liveProfile.listId} />}
        {activeTab === 'settings' && <Settings user={user} profile={liveProfile} />}
      </main>

      {/* Bottom nav */}
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
    </div>
  )
}

const s = {
  shell: { height: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto', background: 'var(--cream)' },
  header: {
    padding: '16px 20px 12px',
    background: 'white',
    borderBottom: '1px solid var(--cream-dark)',
    flexShrink: 0,
  },
  headerTitle: { fontSize: '20px', fontWeight: 700, color: 'var(--espresso)', letterSpacing: '-0.3px' },
  headerSub: { fontSize: '12px', color: 'var(--rose-dark)', marginTop: '2px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  nav: {
    display: 'flex',
    background: 'white',
    borderTop: '1px solid var(--cream-dark)',
    flexShrink: 0,
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  navBtn: {
    flex: 1, padding: '14px 8px',
    border: 'none', background: 'transparent',
    fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
    color: 'var(--espresso-mid)', cursor: 'pointer',
    borderTop: '2px solid transparent',
    transition: 'all 0.15s',
  },
  navBtnActive: {
    color: 'var(--espresso)',
    fontWeight: 700,
    borderTop: '2px solid var(--espresso)',
  },
}
