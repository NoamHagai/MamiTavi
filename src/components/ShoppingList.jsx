// src/components/ShoppingList.jsx
import { useState, useEffect, useRef } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id: 'produce', label: '🥦 ירקות ופירות' },
  { id: 'dairy',   label: '🥛 חלב וביצים' },
  { id: 'bakery',  label: '🍞 מאפים' },
  { id: 'meat',    label: '🥩 בשר ודגים' },
  { id: 'frozen',  label: '🧊 קפואים' },
  { id: 'pantry',  label: '🫙 מזווה' },
  { id: 'hygiene', label: '🧴 היגיינה' },
  { id: 'other',   label: '📦 אחר' },
]

function getCategoryLabel(id) {
  return CATEGORIES.find(c => c.id === id)?.label ?? '📦 אחר'
}

export default function ShoppingList({ user, profile, listId }) {
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState('')
  const [newCategory, setNewCategory] = useState('other')
  const [newQty, setNewQty] = useState('')
  const [showBought, setShowBought] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterCat, setFilterCat] = useState('all')
  const inputRef = useRef(null)

  // Real-time listener
  useEffect(() => {
    if (!listId) return
    const q = query(
      collection(db, 'lists', listId, 'items'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [listId])

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    await addDoc(collection(db, 'lists', listId, 'items'), {
      text: newItem.trim(),
      category: newCategory,
      qty: newQty.trim() || null,
      bought: false,
      addedBy: profile.name || user.displayName || 'אנונימי',
      addedByUid: user.uid,
      createdAt: serverTimestamp(),
    })
    setNewItem('')
    setNewQty('')
    if (inputRef.current) inputRef.current.focus()
  }

  async function toggleBought(item) {
    await updateDoc(doc(db, 'lists', listId, 'items', item.id), {
      bought: !item.bought,
      boughtAt: !item.bought ? serverTimestamp() : null,
      boughtBy: !item.bought ? (profile.name || user.displayName) : null,
    })
  }

  async function deleteItem(itemId) {
    await deleteDoc(doc(db, 'lists', listId, 'items', itemId))
  }

  async function clearBought() {
    const bought = items.filter(i => i.bought)
    await Promise.all(bought.map(i => deleteDoc(doc(db, 'lists', listId, 'items', i.id))))
    toast.success(`${bought.length} פריטים שנרכשו הוסרו`)
  }

  const pending = items.filter(i => !i.bought)
  const bought  = items.filter(i => i.bought)

  const filteredPending = filterCat === 'all'
    ? pending
    : pending.filter(i => i.category === filterCat)

  // Group pending by category
  const grouped = {}
  filteredPending.forEach(item => {
    const cat = item.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  })

  const activeCats = Object.keys(grouped)

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>🛒</span>
          <div>
            <h1 style={styles.headerTitle}>MamiTavi</h1>
            {profile?.partnerEmail && (
              <p style={styles.headerSub}>
                {profile.name} & {profile.partnerEmail.split('@')[0]}
              </p>
            )}
          </div>
        </div>
        <button
          className="btn-ghost"
          onClick={() => signOut(auth)}
          style={{ fontSize: '13px' }}
          title="התנתק"
        >
          יציאה
        </button>
      </header>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryNum}>{pending.length}</span>
          <span style={styles.summaryLabel}>לקנות</span>
        </div>
        <div style={styles.summaryDivider} />
        <div style={styles.summaryItem}>
          <span style={{ ...styles.summaryNum, color: 'var(--sage)' }}>{bought.length}</span>
          <span style={styles.summaryLabel}>נרכש</span>
        </div>
        {!profile?.partnerEmail && (
          <>
            <div style={styles.summaryDivider} />
            <div style={{ ...styles.summaryItem, cursor: 'pointer' }} onClick={() => window.location.reload()}>
              <span style={{ fontSize: '18px' }}>💑</span>
              <span style={{ ...styles.summaryLabel, color: 'var(--rose-dark)' }}>חבר/י שותפ/ה</span>
            </div>
          </>
        )}
      </div>

      {/* Category filter */}
      {pending.length > 0 && (
        <div style={styles.filterRow}>
          <button
            style={{ ...styles.filterChip, ...(filterCat === 'all' ? styles.filterChipActive : {}) }}
            onClick={() => setFilterCat('all')}
          >הכל</button>
          {[...new Set(pending.map(i => i.category || 'other'))].map(cat => (
            <button
              key={cat}
              style={{ ...styles.filterChip, ...(filterCat === cat ? styles.filterChipActive : {}) }}
              onClick={() => setFilterCat(cat)}
            >
              {getCategoryLabel(cat).split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Items */}
      <div style={styles.content}>
        {activeCats.length === 0 && pending.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: '56px' }}>🛒</span>
            <p style={styles.emptyTitle}>הרשימה ריקה</p>
            <p style={styles.emptyDesc}>הוסיפו פריטים ומאמי תביא! 🛒</p>
          </div>
        )}

        {activeCats.map(cat => (
          <div key={cat} style={styles.categoryGroup}>
            <p style={styles.categoryLabel}>{getCategoryLabel(cat)}</p>
            {grouped[cat].map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                onToggle={() => toggleBought(item)}
                onDelete={() => deleteItem(item.id)}
                delay={idx * 0.04}
              />
            ))}
          </div>
        ))}

        {/* Bought section */}
        {bought.length > 0 && (
          <div style={styles.boughtSection}>
            <button
              className="btn-ghost"
              style={styles.boughtToggle}
              onClick={() => setShowBought(s => !s)}
            >
              {showBought ? '▲' : '▼'} נרכש ({bought.length})
            </button>
            {showBought && (
              <>
                {bought.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleBought(item)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
                <button
                  className="btn-secondary"
                  onClick={clearBought}
                  style={{ width: '100%', marginTop: '8px', fontSize: '13px', padding: '10px' }}
                >
                  נקה פריטים שנרכשו
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add item panel */}
      {showAddForm && (
        <div style={styles.addOverlay} onClick={e => e.target === e.currentTarget && setShowAddForm(false)}>
          <div className="card fade-up" style={styles.addPanel}>
            <h3 style={styles.addTitle}>הוספת פריט</h3>
            <form onSubmit={async e => { await addItem(e); setShowAddForm(false) }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                ref={inputRef}
                className="input"
                placeholder="שם הפריט..."
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="input"
                  placeholder="כמות (אופציונלי)"
                  value={newQty}
                  onChange={e => setNewQty(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <select
                className="input"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <button
                className="btn-primary"
                type="submit"
                disabled={!newItem.trim()}
                style={{ padding: '13px' }}
              >
                הוסף לרשימה
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        style={styles.fab}
        onClick={() => setShowAddForm(true)}
        aria-label="הוסף פריט"
      >
        +
      </button>
    </div>
  )
}

function ItemRow({ item, onToggle, onDelete, delay = 0 }) {
  return (
    <div
      className="fade-up"
      style={{
        ...styles.itemRow,
        opacity: item.bought ? 0.55 : 1,
        animationDelay: `${delay}s`,
      }}
    >
      <button
        style={{
          ...styles.checkbox,
          ...(item.bought ? styles.checkboxDone : {}),
        }}
        onClick={onToggle}
        aria-label="סמן כנרכש"
      >
        {item.bought && '✓'}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          ...styles.itemText,
          textDecoration: item.bought ? 'line-through' : 'none',
          color: item.bought ? 'var(--espresso-mid)' : 'var(--espresso)',
        }}>
          {item.text}
          {item.qty && <span style={styles.itemQty}> × {item.qty}</span>}
        </span>
        <p style={styles.itemMeta}>{item.addedBy}</p>
      </div>
      <button
        className="btn-ghost"
        onClick={onDelete}
        style={{ padding: '6px 8px', fontSize: '16px', color: '#C4A090' }}
        aria-label="מחק"
      >
        ×
      </button>
    </div>
  )
}

const styles = {
  page: { maxWidth: '480px', margin: '0 auto', minHeight: '100dvh', paddingBottom: '100px' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 20px 12px',
    position: 'sticky', top: 0, zIndex: 10,
    background: 'var(--cream)',
    borderBottom: '1px solid var(--cream-dark)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerIcon: { fontSize: '28px' },
  headerTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px', fontWeight: 600, lineHeight: 1.1,
  },
  headerSub: { fontSize: '12px', color: 'var(--rose-dark)', marginTop: '2px' },

  summaryBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '24px', padding: '14px 20px',
    background: 'white',
    borderBottom: '1px solid var(--cream-dark)',
  },
  summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  summaryNum: { fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 600, color: 'var(--espresso)', lineHeight: 1 },
  summaryLabel: { fontSize: '11px', color: 'var(--espresso-mid)', fontWeight: 500 },
  summaryDivider: { width: '1px', height: '32px', background: 'var(--cream-dark)' },

  filterRow: {
    display: 'flex', gap: '6px', padding: '12px 16px',
    overflowX: 'auto', scrollbarWidth: 'none',
  },
  filterChip: {
    flexShrink: 0, padding: '6px 14px',
    border: '1.5px solid var(--cream-dark)',
    borderRadius: '20px',
    background: 'white',
    fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', transition: 'all 0.15s',
    color: 'var(--espresso-mid)',
  },
  filterChipActive: {
    background: 'var(--espresso)', color: 'white',
    border: '1.5px solid var(--espresso)',
  },

  content: { padding: '8px 16px' },
  categoryGroup: { marginBottom: '6px' },
  categoryLabel: {
    fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em',
    color: 'var(--rose-dark)', textTransform: 'uppercase',
    padding: '10px 4px 4px',
  },

  itemRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 14px',
    background: 'white',
    borderRadius: '12px',
    marginBottom: '6px',
    boxShadow: '0 1px 6px rgba(44,24,16,0.06)',
    transition: 'opacity 0.2s',
  },
  checkbox: {
    width: '26px', height: '26px', flexShrink: 0,
    border: '2px solid var(--rose)',
    borderRadius: '50%',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontWeight: 700, color: 'white',
    transition: 'all 0.2s',
  },
  checkboxDone: {
    background: 'var(--sage)',
    borderColor: 'var(--sage)',
  },
  itemText: { fontSize: '15px', display: 'block', fontWeight: 400 },
  itemQty: { color: 'var(--rose-dark)', fontSize: '13px' },
  itemMeta: { fontSize: '11px', color: '#B8A898', marginTop: '2px' },

  empty: { textAlign: 'center', paddingTop: '80px', paddingBottom: '40px' },
  emptyTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', marginTop: '16px', color: 'var(--espresso)' },
  emptyDesc: { color: 'var(--espresso-mid)', fontSize: '14px', marginTop: '6px' },

  boughtSection: { marginTop: '16px', padding: '4px' },
  boughtToggle: { color: 'var(--espresso-mid)', fontSize: '13px', fontWeight: 600, width: '100%', textAlign: 'right', padding: '8px 4px' },

  addOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(44,24,16,0.4)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 100, padding: '0',
    backdropFilter: 'blur(4px)',
  },
  addPanel: {
    width: '100%', maxWidth: '480px',
    borderRadius: '24px 24px 0 0',
    paddingBottom: '32px',
  },
  addTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px', fontWeight: 600,
    marginBottom: '18px',
  },

  fab: {
    position: 'fixed',
    bottom: '28px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '60px', height: '60px',
    borderRadius: '50%',
    background: 'var(--espresso)',
    color: 'var(--cream)',
    border: 'none', cursor: 'pointer',
    fontSize: '32px', fontWeight: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 24px rgba(44,24,16,0.35)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    zIndex: 50,
    lineHeight: 1,
  },
}
