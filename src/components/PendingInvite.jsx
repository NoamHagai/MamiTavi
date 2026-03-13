// src/components/PendingInvite.jsx
import { useState } from 'react'
import { doc, updateDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import toast from 'react-hot-toast'

export default function PendingInvite({ user, profile, invite }) {
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)

  async function handleAccept() {
    setAccepting(true)
    try {
      let listId = invite.fromListId
      if (listId) {
        await updateDoc(doc(db, 'lists', listId), { members: [invite.fromUid, user.uid] })
      } else {
        const listRef = doc(collection(db, 'lists'))
        listId = listRef.id
        await setDoc(listRef, {
          id: listId,
          members: [invite.fromUid, user.uid],
          createdAt: serverTimestamp(),
          createdBy: invite.fromUid,
        })
      }

      // Update invitation status
      await updateDoc(doc(db, 'invitations', invite.id), { status: 'accepted' })

      // Update own profile (self write)
      await updateDoc(doc(db, 'users', user.uid), {
        listId,
        partnerEmail: invite.fromEmail,
      })

      // Update sender's profile (cross-user — only listId + partnerEmail, allowed by rules)
      await updateDoc(doc(db, 'users', invite.fromUid), {
        listId,
        partnerEmail: profile?.email || user.email,
      })

      toast.success(`מחובר/ת עם ${invite.fromName}! 💑`)
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
      setAccepting(false)
    }
  }

  async function handleDecline() {
    setDeclining(true)
    try {
      await updateDoc(doc(db, 'invitations', invite.id), { status: 'declined' })
      toast.success('הבקשה נדחתה')
    } catch (err) {
      toast.error('שגיאה: ' + err.message)
      setDeclining(false)
    }
  }

  return (
    <div style={s.overlay}>
      <div className="card fade-up" style={s.panel}>
        <div style={s.icon}>💌</div>
        <h2 style={s.title}>בקשת שיתוף</h2>
        <p style={s.desc}>
          <strong>{invite.fromName}</strong>
          <br />
          <span style={{ fontSize: '13px', color: 'var(--navy-mid)' }}>{invite.fromEmail}</span>
          <br /><br />
          מזמין/ת אותך לנהל רשימת קניות משותפת
        </p>
        <div style={s.actions}>
          <button
            onClick={handleDecline}
            disabled={accepting || declining}
            style={s.declineBtn}
          >
            {declining ? '...' : 'דחה'}
          </button>
          <button
            className="btn-primary"
            onClick={handleAccept}
            disabled={accepting || declining}
            style={s.acceptBtn}
          >
            {accepting ? 'מתחבר...' : 'אשר ✓'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    minHeight: '100dvh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: '24px',
    background: 'linear-gradient(135deg, var(--bg) 0%, #dbeafe 100%)',
  },
  panel: { width: '100%', maxWidth: '400px', textAlign: 'center' },
  icon: { fontSize: '56px', marginBottom: '16px' },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '26px', fontWeight: 700,
    color: 'var(--navy)', marginBottom: '12px',
  },
  desc: { color: 'var(--navy-mid)', fontSize: '15px', lineHeight: 1.7, marginBottom: '28px' },
  actions: { display: 'flex', gap: '10px' },
  declineBtn: {
    flex: 1, padding: '13px',
    border: '1.5px solid var(--bg-dark)', borderRadius: '10px',
    background: 'white', color: 'var(--navy-mid)',
    fontFamily: 'var(--font-body)', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
  },
  acceptBtn: { flex: 2, padding: '13px', fontSize: '15px' },
}
