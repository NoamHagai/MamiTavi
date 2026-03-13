// src/components/Settings.jsx
import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import toast from 'react-hot-toast'

export default function Settings({ user, profile }) {
  const [partnerEmail, setPartnerEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleInvite(e) {
    e.preventDefault()
    const email = partnerEmail.trim().toLowerCase()
    if (!email) return
    if (email === profile.email) { toast.error('לא ניתן לשתף עם עצמך'); return }
    setLoading(true)
    try {
      const q = query(collection(db, 'users'), where('email', '==', email))
      const snap = await getDocs(q)
      if (snap.empty) {
        toast.error('לא נמצא משתמש עם המייל הזה')
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
          id: listId, members: [user.uid, partnerId],
          createdAt: serverTimestamp(), createdBy: user.uid,
        })
      } else {
        // הוסף את השותף לרשימה קיימת
        await updateDoc(doc(db, 'lists', listId), {
          members: [user.uid, partnerId]
        })
      }

      await updateDoc(doc(db, 'users', user.uid), { partnerEmail: email, listId })
      await updateDoc(doc(db, 'users', partnerId), { partnerEmail: profile.email, listId })
      toast.success(`${partnerData.name} חובר לרשימה!`)
      setPartnerEmail('')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
    }
    setLoading(false)
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
          <div style={s.infoRow}>
            <span style={s.infoLabel}>אימייל</span>
            <span style={s.infoValue} dir="ltr">{user.email}</span>
          </div>
        </div>

        {/* Partner */}
        <div style={s.section}>
          <p style={s.sectionTitle}>שותף/ה</p>
          {profile?.partnerEmail ? (
            <div style={s.infoRow}>
              <span style={s.infoLabel}>מחובר/ת עם</span>
              <span style={s.infoValue} dir="ltr">{profile.partnerEmail}</span>
            </div>
          ) : (
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={s.desc}>חבר/י שותף/ה לרשימה המשותפת</p>
              <input
                className="input"
                type="email"
                placeholder="partner@example.com"
                value={partnerEmail}
                onChange={e => setPartnerEmail(e.target.value)}
                dir="ltr"
              />
              <button className="btn-primary" type="submit" disabled={loading} style={{ padding: '12px' }}>
                {loading ? 'מחפש...' : 'חבר שותף/ה'}
              </button>
            </form>
          )}
        </div>

        {/* Logout */}
        <div style={s.section}>
          <button
            className="btn-secondary"
            onClick={() => signOut(auth)}
            style={{ width: '100%', padding: '12px' }}
          >
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
    boxShadow: '0 1px 6px rgba(30,20,16,0.06)',
  },
  sectionTitle: { fontSize: '12px', fontWeight: 700, color: 'var(--rose-dark)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '14px' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--cream-dark)' },
  infoLabel: { fontSize: '14px', color: 'var(--espresso-mid)' },
  infoValue: { fontSize: '14px', fontWeight: 600, color: 'var(--espresso)' },
  desc: { fontSize: '14px', color: 'var(--espresso-mid)', marginBottom: '4px' },
}
