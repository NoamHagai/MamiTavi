// src/App.jsx
import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, collection, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import InvitePartner from './components/InvitePartner'
import ShoppingList from './components/ShoppingList'

export default function App() {
  const { user } = useAuth()
  const [liveProfile, setLiveProfile] = useState(undefined) // undefined = טוען

  // Real-time profile listener
  useEffect(() => {
    if (!user) { setLiveProfile(null); return }
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) {
        setLiveProfile(snap.data())
      } else {
        // פרופיל לא קיים עדיין — צור אחד (קורה לפעמים עם Google)
        setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName || 'משתמש',
          email: user.email?.toLowerCase() || '',
          isPremium: false,
          createdAt: serverTimestamp(),
          partnerEmail: null,
          listId: null,
        }).then(() => {}) // onSnapshot יתפוס את השינוי אוטומטית
      }
    })
    return unsub
  }, [user])

  // Loading — מחכים לאימות
  if (user === undefined || (user && liveProfile === undefined)) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '16px',
        fontFamily: 'var(--font-display)', color: 'var(--rose-dark)'
      }}>
        <span style={{ fontSize: '52px' }}>🛒</span>
        <p style={{ fontSize: '18px', fontWeight: 400 }}>טוען...</p>
      </div>
    )
  }

  // לא מחובר
  if (!user) return <AuthScreen />

  // מחובר אבל אין רשימה עדיין
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

  // האפליקציה הראשית
  return (
    <ShoppingList
      user={user}
      profile={liveProfile}
      listId={liveProfile.listId}
    />
  )
}

async function createSoloList(user) {
  const listRef = doc(collection(db, 'lists'))
  const listId = listRef.id
  await setDoc(listRef, {
    id: listId,
    members: [user.uid],
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  })
  await updateDoc(doc(db, 'users', user.uid), { listId })
  // onSnapshot ב-App יתפוס את השינוי אוטומטית ויעביר לרשימה
}

