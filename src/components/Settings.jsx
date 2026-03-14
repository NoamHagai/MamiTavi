// src/components/Settings.jsx
import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { collection, query, where, getDocs, addDoc, doc, updateDoc, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import toast from 'react-hot-toast'

export default function Settings({ user, profile }) {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  async function handleInvite(e) {
    e.preventDefault()
    const email = partnerEmail.trim().toLowerCase()
    if (!email) return
    if (email === profile?.email) { toast.error('לא ניתן לשתף עם עצמך'); return }
    if (profile?.partnerEmail) { toast.error('כבר מחובר עם שותף/ה'); return }
    setLoading(true)
    try {
      const q = query(collection(db, 'users'), where('email', '==', email))
      const snap = await getDocs(q)
      if (snap.empty) { toast.error('לא נמצא משתמש עם המייל הזה'); setLoading(false); return }

      const partnerDoc = snap.docs[0]
      const partnerData = partnerDoc.data()

      if (partnerData.partnerEmail) { toast.error('המשתמש כבר מחובר לשותף אחר'); setLoading(false); return }
      if (partnerData.pendingInviteFrom) { toast.error('המשתמש כבר קיבל בקשה'); setLoading(false); return }

      const batch = writeBatch(db)
      batch.update(doc(db, 'users', partnerDoc.id), {
        pendingInviteFrom: {
          uid: user.uid,
          email: profile?.email || user.email,
          name: profile?.name || user.displayName || 'משתמש',
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

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const currentListId = profile.listId
      const myUid = user.uid
      const partnerUid = profile.partnerUid

      // קח את כל הנתונים מהרשימה המשותפת
      const [itemsSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, 'lists', currentListId, 'items')),
        getDocs(collection(db, 'lists', currentListId, 'products')),
      ])
      const itemsData = itemsSnap.docs.map(d => d.data())
      const productsData = productsSnap.docs.map(d => d.data())

      // צור רשימה חדשה לי — עם שניהם כ-members זמנית
      const myListRef = doc(collection(db, 'lists'))
      await setDoc(myListRef, {
        members: [myUid, partnerUid],
        createdAt: serverTimestamp(),
        createdBy: myUid,
      })

      // צור רשימה חדשה לשותף — עם שניהם כ-members זמנית
      const partnerListRef = doc(collection(db, 'lists'))
      await setDoc(partnerListRef, {
        members: [myUid, partnerUid],
        createdAt: serverTimestamp(),
        createdBy: partnerUid,
      })

      // העתק נתונים לשתי הרשימות
      await Promise.all([
        ...itemsData.map(d => addDoc(collection(db, 'lists', myListRef.id, 'items'), d)),
        ...productsData.map(d => addDoc(collection(db, 'lists', myListRef.id, 'products'), d)),
        ...itemsData.map(d => addDoc(collection(db, 'lists', partnerListRef.id, 'items'), d)),
        ...productsData.map(d => addDoc(collection(db, 'lists', partnerListRef.id, 'products'), d)),
      ])

      // עדכן members ופרופילים — כל אחד רק עם עצמו
      const batch = writeBatch(db)
      batch.update(doc(db, 'lists', myListRef.id), { members: [myUid] })
      batch.update(doc(db, 'lists', partnerListRef.id), { members: [partnerUid] })
      batch.update(doc(db, 'users', myUid), {
        partnerEmail: null, partnerUid: null, listId: myListRef.id,
      })
      batch.update(doc(db, 'users', partnerUid), {
        partnerEmail: null, partnerUid: null, listId: partnerListRef.id,
      })
      await batch.commit()

      toast.success('התנתקת — הרשימה שמורה אצל שניכם')
      setConfirmDisconnect(false)
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setDisconnecting(false)
  }

  return (
    <div style={s.page}>
      <div style={s.content}>

        {/* פרטי חשבון */}
        <div style={s.section}>
          <p style={s.sectionTitle}>החשבון שלי</p>
          <div style={s.row}>
            <span style={s.label}>שם</span>
            <span style={s.value}>{profile?.name || user.displayName || '—'}</span>
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <span style={s.label}>אימייל</span>
            <span style={s.value} dir="ltr">{user.email}</span>
          </div>
        </div>

        {/* שותף/ה */}
        <div style={s.section}>
          <p style={s.sectionTitle}>שותף/ה</p>

          {/* מחובר */}
          {profile?.partnerEmail && (
            <>
              <div style={{ ...s.row, borderBottom: confirmDisconnect ? '1px solid var(--bg-dark)' : 'none' }}>
                <span style={s.label}>מחובר עם</span>
                <span style={s.value} dir="ltr">{profile.partnerEmail}</span>
              </div>
              {!confirmDisconnect ? (
                <button className="btn-ghost" onClick={() => setConfirmDisconnect(true)} style={{ marginTop: '10px', color: '#EF4444', fontSize: '13px', padding: '4px 0' }}>
                  ניתוק שותף/ה
                </button>
              ) : (
                <div style={s.confirmBox}>
                  <p style={s.confirmTitle}>לנתק את {profile.partnerEmail}?</p>
                  <p style={s.confirmSub}>כל אחד יקבל רשימה נפרדת משלו.</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button className="btn-ghost" onClick={() => setConfirmDisconnect(false)} style={{ flex: 1 }}>ביטול</button>
                    <button onClick={handleDisconnect} disabled={disconnecting} style={s.disconnectBtn}>
                      {disconnecting ? 'מנתק...' : 'כן, נתק'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ממתין לאישור */}
          {!profile?.partnerEmail && profile?.pendingInviteTo && (
            <div style={s.waitBox}>
              <p style={s.waitText}>ההזמנה נשלחה</p>
              <p style={s.waitEmail}>{profile.pendingInviteTo.email}</p>
              <button className="btn-ghost" onClick={handleCancelInvite} style={{ color: '#EF4444', fontSize: '13px', marginTop: '8px' }}>
                בטל בקשה
              </button>
            </div>
          )}

          {/* אין שותף */}
          {!profile?.partnerEmail && !profile?.pendingInviteTo && (
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={s.desc}>שלח/י הזמנה לשותף/ה שרשום/ה באפליקציה</p>
              <input className="input" type="email" placeholder="partner@example.com" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} dir="ltr" />
              <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '12px' }}>
                {loading ? 'שולח...' : 'שלח הזמנה'}
              </button>
            </form>
          )}
        </div>

        {/* התנתקות */}
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
  page: { flex: 1, overflowY: 'auto', paddingBottom: '40px' },
  content: { padding: '16px' },
  section: { background: 'white', borderRadius: '14px', padding: '18px', marginBottom: '12px', boxShadow: '0 1px 6px rgba(30,58,95,0.07)' },
  sectionTitle: { fontSize: '11px', fontWeight: 700, color: 'var(--blue-dark)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bg-dark)' },
  label: { fontSize: '14px', color: 'var(--navy-mid)' },
  value: { fontSize: '14px', fontWeight: 600, color: 'var(--navy)' },
  desc: { fontSize: '14px', color: 'var(--navy-mid)' },
  confirmBox: { marginTop: '12px', background: '#FEF2F2', borderRadius: '10px', padding: '12px' },
  confirmTitle: { fontSize: '14px', color: '#991B1B', fontWeight: 600, marginBottom: '4px' },
  confirmSub: { fontSize: '12px', color: '#B91C1C' },
  disconnectBtn: { flex: 1, background: '#EF4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', fontFamily: 'var(--font-body)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  waitBox: { textAlign: 'center', padding: '8px 0' },
  waitText: { fontSize: '13px', color: 'var(--navy-mid)' },
  waitEmail: { fontSize: '15px', fontWeight: 700, color: 'var(--blue-dark)', marginTop: '4px' },
}
