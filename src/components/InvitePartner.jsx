// src/components/InvitePartner.jsx
import { useState, useEffect } from 'react'
import {
  collection, query, where, getDocs, onSnapshot,
  doc, updateDoc, setDoc, serverTimestamp, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import toast from 'react-hot-toast'

export default function InvitePartner({ user, profile, onDone }) {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [sentInvite, setSentInvite] = useState(null) // pending sent invitation

  // Listen for pending invitation I sent
  useEffect(() => {
    const q = query(
      collection(db, 'invitations'),
      where('fromUid', '==', user.uid),
      where('status', '==', 'pending')
    )
    return onSnapshot(q, snap => {
      setSentInvite(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() })
    })
  }, [user.uid])

  // If the sent invite was accepted, the profile's listId gets set → App re-routes automatically

  async function handleSkip() {
    setSkipping(true)
    try {
      const listRef = doc(collection(db, 'lists'))
      const listId = listRef.id
      await setDoc(listRef, {
        id: listId, members: [user.uid],
        createdAt: serverTimestamp(), createdBy: user.uid,
      })
      await updateDoc(doc(db, 'users', user.uid), { listId })
      onDone(listId, null)
    } catch (err) {
      toast.error('שגיאה ביצירת הרשימה: ' + err.message)
      setSkipping(false)
    }
  }

  async function handleInvite(e) {
    e.preventDefault()
    const email = partnerEmail.trim().toLowerCase()
    if (!email) return
    if (email === profile?.email) { toast.error('לא ניתן לשתף עם עצמך 😄'); return }
    setLoading(true)
    try {
      const q = query(collection(db, 'users'), where('email', '==', email))
      const snap = await getDocs(q)
      if (snap.empty) { toast.error('לא נמצא משתמש עם המייל הזה.'); setLoading(false); return }

      const partnerDoc = snap.docs[0]
      const partnerData = partnerDoc.data()

      if (partnerData.partnerEmail) {
        toast.error('המשתמש כבר מחובר לשותף אחר')
        setLoading(false)
        return
      }

      // Create invitation in its own collection (no cross-user writes!)
      const inviteRef = doc(collection(db, 'invitations'))
      await setDoc(inviteRef, {
        fromUid: user.uid,
        fromEmail: profile?.email || user.email,
        fromName: profile?.name || user.displayName || 'משתמש',
        fromListId: profile?.listId || null,
        toUid: partnerDoc.id,
        toEmail: email,
        status: 'pending',
        createdAt: serverTimestamp(),
      })

      toast.success(`הזמנה נשלחה ל-${partnerData.name}!`)
      setPartnerEmail('')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setLoading(false)
  }

  async function handleCancelInvite() {
    try {
      await deleteDoc(doc(db, 'invitations', sentInvite.id))
      toast.success('הבקשה בוטלה')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
  }

  // Waiting state
  if (sentInvite) {
    return (
      <div style={styles.overlay}>
        <div className="card fade-up" style={styles.panel}>
          <div style={styles.icon}>⏳</div>
          <h2 style={styles.title}>ממתין לאישור</h2>
          <p style={styles.desc}>
            נשלחה בקשת שיתוף אל<br />
            <strong>{sentInvite.toEmail}</strong>
            <br /><br />
            הם יצטרכו לאשר את החיבור מהאפליקציה.
          </p>
          <button
            className="btn-ghost"
            onClick={handleCancelInvite}
            style={{ color: '#EF4444', fontSize: '14px' }}
          >
            בטל בקשה
          </button>
        </div>
      </div>
    )
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
          <button className="btn-primary" type="submit" disabled={loading || skipping} style={{ padding: '13px' }}>
            {loading ? 'שולח...' : 'שלח בקשת שיתוף'}
          </button>
          <button className="btn-ghost" type="button" onClick={handleSkip} disabled={skipping || loading} style={{ textAlign: 'center' }}>
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
    background: 'linear-gradient(135deg, var(--bg) 0%, #dbeafe 100%)',
  },
  panel: { width: '100%', maxWidth: '400px', textAlign: 'center' },
  icon: { fontSize: '52px', marginBottom: '16px' },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px', fontWeight: 600,
    color: 'var(--navy)', marginBottom: '10px',
  },
  desc: { color: 'var(--navy-mid)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' },
}
