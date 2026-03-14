// src/components/InvitePartner.jsx
import { useState } from 'react'
import { collection, query, where, getDocs, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import toast from 'react-hot-toast'

export default function InvitePartner({ user, profile, onDone }) {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [skipping, setSkipping] = useState(false)

  async function handleSkip() {
    setSkipping(true)
    try {
      const batch = writeBatch(db)
      const listRef = doc(collection(db, 'lists'))
      const listId = listRef.id
      batch.set(listRef, {
        id: listId, members: [user.uid],
        createdAt: serverTimestamp(), createdBy: user.uid,
      })
      batch.update(doc(db, 'users', user.uid), { listId })
      await batch.commit()
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
    if (email === profile?.email) { toast.error('לא ניתן לשתף עם עצמך'); return }
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
      if (partnerData.pendingInviteFrom) {
        toast.error('המשתמש כבר קיבל בקשה ממישהו אחר')
        setLoading(false)
        return
      }

      const batch = writeBatch(db)
      batch.update(doc(db, 'users', partnerDoc.id), {
        pendingInviteFrom: {
          uid: user.uid,
          email: profile?.email || user.email,
          name: profile?.name || user.displayName || 'משתמש',
          listId: profile?.listId || null,
        }
      })
      batch.update(doc(db, 'users', user.uid), {
        pendingInviteTo: { uid: partnerDoc.id, email }
      })
      await batch.commit()

      toast.success(`הזמנה נשלחה ל-${partnerData.name}`)
      setPartnerEmail('')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setLoading(false)
  }

  async function handleCancelInvite() {
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', profile.pendingInviteTo.uid), { pendingInviteFrom: null })
      batch.update(doc(db, 'users', user.uid), { pendingInviteTo: null })
      await batch.commit()
      toast.success('הבקשה בוטלה')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
  }

  // Waiting state — invite sent, waiting for partner to accept
  if (profile?.pendingInviteTo) {
    return (
      <div style={styles.overlay}>
        <div className="card fade-up" style={styles.panel}>
          <h2 style={styles.title}>ההזמנה נשלחה</h2>
          <p style={styles.desc}>
            נשלחה בקשת שיתוף אל<br />
            <strong>{profile.pendingInviteTo.email}</strong>
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
        <h2 style={styles.title}>שתף/י עם שותף</h2>
        <p style={styles.desc}>
          הזינ/י את כתובת המייל של השותף.
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
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px', fontWeight: 600,
    color: 'var(--navy)', marginBottom: '10px',
  },
  desc: { color: 'var(--navy-mid)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' },
}
