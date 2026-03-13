// src/components/InvitePartner.jsx
import { useState } from 'react'
import {
  collection, query, where, getDocs,
  doc, updateDoc, setDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import toast from 'react-hot-toast'

export default function InvitePartner({ user, profile, onDone }) {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)

  async function handleSkip() {
    setSkipping(true)
    try {
      const listRef = doc(collection(db, 'lists'))
      const listId = listRef.id
      await setDoc(listRef, {
        id: listId,
        members: [user.uid],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      })
      await updateDoc(doc(db, 'users', user.uid), { listId })
      onDone(listId, null)
    } catch (err) {
      console.error('createSoloList error:', err)
      toast.error('שגיאה ביצירת הרשימה: ' + err.message)
      setSkipping(false)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    const email = partnerEmail.trim().toLowerCase()
    if (!email) return
    if (email === profile.email) { toast.error('לא ניתן לשתף עם עצמך 😄'); return }
    setLoading(true)
    try {
      const q = query(collection(db, 'users'), where('email', '==', email))
      const snap = await getDocs(q)
      if (snap.empty) {
        toast.error('לא נמצא משתמש עם המייל הזה.')
        setLoading(false)
        return
      }
      const partnerDoc = snap.docs[0]
      const partnerData = partnerDoc.data()
      const partnerId = partnerDoc.id

      let listId = profile.listId
      if (!listId) {
        const listRef = doc(collection(db, 'lists'))
        listId = listRef.id
        await setDoc(listRef, {
          id: listId,
          members: [user.uid, partnerId],
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })
      }

      await updateDoc(doc(db, 'users', user.uid), { partnerEmail: email, listId })
      await updateDoc(doc(db, 'users', partnerId), { partnerEmail: profile.email, listId })

      toast.success(`${partnerData.name} חובר/ה לרשימה! 💑`)
      onDone(listId, email)
    } catch (err) {
      console.error('invite error:', err)
      toast.error('שגיאה: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div style={styles.overlay}>
      <div className="card fade-up" style={styles.panel}>
        <div style={styles.icon}>💌</div>
        <h2 style={styles.title}>שתף/י עם בן/בת הזוג</h2>
        <p style={styles.desc}>
          הזינ/י את כתובת המייל של בן/בת זוגך.
          הם צריכים להיות רשומים לאפליקציה.
        </p>
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            className="input"
            type="email"
            placeholder="partner@example.com"
            value={partnerEmail}
            onChange={e => setPartnerEmail(e.target.value)}
            dir="ltr"
          />
          <button
            className="btn-primary"
            type="submit"
            disabled={loading || skipping}
            style={{ padding: '13px' }}
          >
            {loading ? 'מחפש...' : 'חבר/י לרשימה'}
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={handleSkip}
            disabled={skipping || loading}
            style={{ textAlign: 'center' }}
          >
            {skipping ? 'יוצר רשימה...' : 'אמשיך לבד בינתיים'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    minHeight: '100dvh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px',
    background: 'linear-gradient(135deg, var(--cream) 0%, #f9ede4 100%)',
  },
  panel: { width: '100%', maxWidth: '400px', textAlign: 'center' },
  icon: { fontSize: '52px', marginBottom: '16px' },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px', fontWeight: 600,
    marginBottom: '10px',
  },
  desc: { color: 'var(--espresso-mid)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' },
}
