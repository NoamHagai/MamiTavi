// src/components/Settings.jsx
import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import toast from 'react-hot-toast'

export default function Settings({ user, profile }) {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  async function handleInvite(e) {
    e.preventDefault()
    const email = partnerEmail.trim().toLowerCase()
    if (!email) return
    if (email === profile.email) { toast.error('לא ניתן לשתף עם עצמך'); return }
    setLoading(true)
    try {
      const q = query(collection(db, 'users'), where('email', '==', email))
      const snap = await getDocs(q)
      if (snap.empty) { toast.error('לא נמצא משתמש עם המייל הזה'); setLoading(false); return }

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
      await updateDoc(doc(db, 'users', user.uid), { pendingInviteTo: email })

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
      const q = query(collection(db, 'users'), where('email', '==', profile.pendingInviteTo))
      const snap = await getDocs(q)
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), { pendingInviteFrom: null })
      }
      await updateDoc(doc(db, 'users', user.uid), { pendingInviteTo: null })
      toast.success('הבקשה בוטלה')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setCancelling(false)
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const q = query(collection(db, 'users'), where('email', '==', profile.partnerEmail))
      const snap = await getDocs(q)

      // Remove partner from list members (current user keeps list solo)
      await updateDoc(doc(db, 'lists', profile.listId), { members: [user.uid] })

      // Clear own partnerEmail (keep listId — user keeps their items)
      await updateDoc(doc(db, 'users', user.uid), { partnerEmail: null })

      // Clear partner's link (cross-user — allowed by rules)
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), {
          partnerEmail: null,
          listId: null,
        })
      }

      toast.success('השותף/ה נותק/ה')
      setConfirmDisconnect(false)
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setDisconnecting(false)
  }

  return (
    <div style={s.page}>
      <div style={s.content}>

        {/* User info */}
        <div style={s.section}>
          <p style={s.sectionTitle}>החשבון שלי</p>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>שם</span>
            <span style={s.infoValue}>{profile?.name || user.displayName || '—'}</span>
          </div>
          <div style={{ ...s.infoRow, borderBottom: 'none' }}>
            <span style={s.infoLabel}>אימייל</span>
            <span style={s.infoValue} dir="ltr">{user.email}</span>
          </div>
        </div>

        {/* Partner */}
        <div style={s.section}>
          <p style={s.sectionTitle}>שותף/ה</p>

          {/* Connected */}
          {profile?.partnerEmail && (
            <>
              <div style={{ ...s.infoRow, borderBottom: confirmDisconnect ? '1px solid var(--bg-dark)' : 'none' }}>
                <span style={s.infoLabel}>מחובר/ת עם</span>
                <span style={s.infoValue} dir="ltr">{profile.partnerEmail}</span>
              </div>
              {!confirmDisconnect ? (
                <button
                  className="btn-ghost"
                  onClick={() => setConfirmDisconnect(true)}
                  style={{ marginTop: '12px', color: '#EF4444', fontSize: '13px', padding: '6px 0' }}
                >
                  ניתוק שותף/ה
                </button>
              ) : (
                <div style={s.confirmBox}>
                  <p style={s.confirmText}>לנתק את {profile.partnerEmail}?</p>
                  <p style={s.confirmSub}>שני החשבונות יתנתקו. הפריטים שלך יישמרו.</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-ghost" onClick={() => setConfirmDisconnect(false)} style={{ flex: 1, fontSize: '14px' }}>
                      ביטול
                    </button>
                    <button onClick={handleDisconnect} disabled={disconnecting} style={s.disconnectBtn}>
                      {disconnecting ? 'מנתק...' : 'כן, נתק'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Waiting for response */}
          {!profile?.partnerEmail && profile?.pendingInviteTo && (
            <div style={s.waitingBox}>
              <p style={s.waitingText}>ממתין לאישור מ-</p>
              <p style={s.waitingEmail}>{profile.pendingInviteTo}</p>
              <button
                className="btn-ghost"
                onClick={handleCancelInvite}
                disabled={cancelling}
                style={{ color: '#EF4444', fontSize: '13px', marginTop: '8px' }}
              >
                {cancelling ? 'מבטל...' : 'בטל בקשה'}
              </button>
            </div>
          )}

          {/* No partner, no pending */}
          {!profile?.partnerEmail && !profile?.pendingInviteTo && (
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={s.desc}>שלח/י בקשת שיתוף לבן/בת הזוג</p>
              <input
                className="input"
                type="email"
                placeholder="partner@example.com"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                dir="ltr"
              />
              <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '12px' }}>
                {loading ? 'שולח...' : 'שלח בקשת שיתוף'}
              </button>
            </form>
          )}
        </div>

        {/* Logout */}
        <div style={s.section}>
          <button className="btn-secondary" onClick={() => signOut(auth)} style={{ width: '100%', padding: '12px' }}>
            התנתקות
          </button>
        </div>

      </div>
    </div>
  )
}

const s = {
  page: { flex: 1, overflowY: 'auto', paddingBottom: '80px' },
  content: { padding: '16px' },
  section: {
    background: 'white', borderRadius: '14px',
    padding: '18px', marginBottom: '12px',
    boxShadow: '0 1px 6px rgba(30,58,95,0.07)',
  },
  sectionTitle: { fontSize: '11px', fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg-dark)' },
  infoLabel: { fontSize: '14px', color: 'var(--navy-mid)' },
  infoValue: { fontSize: '14px', fontWeight: 600, color: 'var(--navy)' },
  desc: { fontSize: '14px', color: 'var(--navy-mid)', marginBottom: '4px' },
  confirmBox: { marginTop: '12px', background: '#FEF2F2', borderRadius: '10px', padding: '12px' },
  confirmText: { fontSize: '14px', color: '#991B1B', fontWeight: 600, marginBottom: '4px' },
  confirmSub: { fontSize: '12px', color: '#B91C1C', marginBottom: '10px' },
  disconnectBtn: { flex: 1, background: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  waitingBox: { textAlign: 'center', padding: '8px 0' },
  waitingText: { fontSize: '13px', color: 'var(--navy-mid)' },
  waitingEmail: { fontSize: '15px', fontWeight: 700, color: 'var(--blue-dark)', marginTop: '4px' },
}
