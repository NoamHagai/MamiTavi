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
  const [cancelling, setCancelling] = useState(false)

  // Already sent an invite — show waiting state
  const waitingFor = profile?.pendingInviteTo

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

      if (partnerData.partnerEmail || partnerData.pendingInviteFrom) {
        toast.error('המשתמש כבר מחובר או ממתין לבקשה אחרת')
        setLoading(false)
        return
      }

      // Write invite to partner's doc (cross-user update — allowed by rules)
      await updateDoc(doc(db, 'users', partnerId), {
        pendingInviteFrom: {
          uid: user.uid,
          name: profile?.name || user.displayName || 'משתמש',
          email: profile.email,
          listId: profile.listId || null,
        }
      })

      // Mark self as waiting
      await updateDoc(doc(db, 'users', user.uid), {
        pendingInviteTo: email,
      })

      toast.success(`הזמנה נשלחה ל-${partnerData.name}!`)
      setPartnerEmail('')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setLoading(false)
  }

  async function handleCancelInvite() {
    setCancelling(true)
    try {
      // Find partner and clear their pendingInviteFrom
      const q = query(collection(db, 'users'), where('email', '==', waitingFor))
      const snap = await getDocs(q)
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), { pendingInviteFrom: null })
      }
      // Clear own pendingInviteTo
      await updateDoc(doc(db, 'users', user.uid), { pendingInviteTo: null })
      toast.success('הבקשה בוטלה')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setCancelling(false)
  }

  if (waitingFor) {
    return (
      <div style={styles.overlay}>
        <div className="card fade-up" style={styles.panel}>
          <div style={styles.icon}>⏳</div>
          <h2 style={styles.title}>ממתין לאישור</h2>
          <p style={styles.desc}>
            נשלחה בקשת שיתוף אל<br />
            <strong>{waitingFor}</strong>
            <br /><br />
            הם יצטרכו לאשר את החיבור מהאפליקציה.
          </p>
          <button
            className="btn-ghost"
            onClick={handleCancelInvite}
            disabled={cancelling}
            style={{ color: '#EF4444', fontSize: '14px' }}
          >
            {cancelling ? 'מבטל...' : 'בטל את הבקשה'}
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
          <button
            className="btn-primary"
            type="submit"
            disabled={loading || skipping}
            style={{ padding: '13px' }}
          >
            {loading ? 'שולח...' : 'שלח בקשת שיתוף'}
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
    background: 'linear-gradient(135deg, var(--bg) 0%, #dbeafe 100%)',
  },
  panel: { width: '100%', maxWidth: '400px', textAlign: 'center' },
  icon: { fontSize: '52px', marginBottom: '16px' },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px', fontWeight: 600,
    color: 'var(--navy)',
    marginBottom: '10px',
  },
  desc: { color: 'var(--navy-mid)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' },
}
