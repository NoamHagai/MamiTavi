// src/App.jsx
import { useState, useEffect } from 'react'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import InvitePartner from './components/InvitePartner'
import ShoppingList from './components/ShoppingList'

export default function App() {
  const { user, profile, setProfile } = useAuth()
  const [liveProfile, setLiveProfile] = useState(null)

  // Real-time profile listener (to detect when partner connects)
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists()) setLiveProfile(snap.data())
    })
    return unsub
  }, [user])

  // Loading
  if (user === undefined) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--rose-dark)'
      }}>
        🛒
      </div>
    )
  }

  // Not logged in
  if (!user) return <AuthScreen />

  const activeProfile = liveProfile || profile

  // Logged in but no list yet — show invite
  if (!activeProfile?.listId) {
    return (
      <InvitePartner
        user={user}
        profile={activeProfile}
        onDone={(listId, partnerEmail) => {
          if (listId) {
            setLiveProfile(p => ({ ...p, listId, partnerEmail }))
          } else {
            // Skipped — create a solo list
            createSoloList(user, activeProfile, setLiveProfile)
          }
        }}
      />
    )
  }

  // Main app
  return (
    <ShoppingList
      user={user}
      profile={activeProfile}
      listId={activeProfile.listId}
    />
  )
}

// Create a solo list when user skips invite
async function createSoloList(user, profile, setLiveProfile) {
  const { doc, setDoc, collection, serverTimestamp, updateDoc } = await import('firebase/firestore')
  const { db } = await import('./firebase')
  const listRef = doc(collection(db, 'lists'))
  const listId = listRef.id
  await setDoc(listRef, {
    id: listId,
    members: [user.uid],
    createdAt: serverTimestamp(),
    createdBy: user.uid,
  })
  await updateDoc(doc(db, 'users', user.uid), { listId })
  setLiveProfile(p => ({ ...p, listId }))
}
