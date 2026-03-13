// src/components/ShoppingList.jsx
import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id: 'produce',  label: 'ירקות ופירות', emoji: '🥦' },
  { id: 'dairy',    label: 'חלב וביצים',   emoji: '🥛' },
  { id: 'bakery',   label: 'מאפים',        emoji: '🥖' },
  { id: 'meat',     label: 'בשר ודגים',    emoji: '🥩' },
  { id: 'frozen',   label: 'קפואים',       emoji: '🧊' },
  { id: 'pantry',   label: 'מזווה',        emoji: '🥫' },
  { id: 'hygiene',  label: 'היגיינה',      emoji: '🧴' },
  { id: 'other',    label: 'אחר',          emoji: '📦' },
]

function getCat(id) {
  return CATEGORIES.find(c => c.id === id) ?? { label: 'אחר', emoji: '📦' }
}

export default function ShoppingList({ user, profile, listId }) {
  const [items, setItems] = useState([])
  const [masterProducts, setMasterProducts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [showMasterPicker, setShowMasterPicker] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [newCategory, setNewCategory] = useState('other')
  const [newQty, setNewQty] = useState('')
  const [showBought, setShowBought] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!listId) return
    const q = query(collection(db, 'lists', listId, 'items'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [listId])

  useEffect(() => {
    if (!listId) return
    const q = query(collection(db, 'lists', listId, 'products'), orderBy('name', 'asc'))
    return onSnapshot(q, snap => setMasterProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [listId])

  async function addItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    await addDoc(collection(db, 'lists', listId, 'items'), {
      text: newItem.trim(),
      category: newCategory,
      qty: newQty.trim() || null,
      bought: false,
      addedBy: profile?.name || user.displayName || 'משתמש',
      addedByUid: user.uid,
      createdAt: serverTimestamp(),
    })
    setNewItem(''); setNewQty(''); setShowAdd(false)
  }

  async function addFromMaster(product) {
    const inList = items.some(i => !i.bought && i.text === product.name)
    if (inList) { toast.error(`${product.name} כבר ברשימה`); return }
    await addDoc(collection(db, 'lists', listId, 'items'), {
      text: product.name, category: product.category,
      qty: null, bought: false,
      addedBy: profile?.name || user.displayName || 'משתמש',
      addedByUid: user.uid, createdAt: serverTimestamp(),
    })
    toast.success(`${product.name} נוסף`)
  }

  async function toggleBought(item) {
    await updateDoc(doc(db, 'lists', listId, 'items', item.id), {
      bought: !item.bought,
      boughtAt: !item.bought ? serverTimestamp() : null,
      boughtBy: !item.bought ? (profile?.name || user.displayName) : null,
    })
  }

  async function deleteItem(id) {
    await deleteDoc(doc(db, 'lists', listId, 'items', id))
  }

  async function updateQty(item, delta) {
    const current = parseInt(item.qty) || 1
    const next = Math.max(1, current + delta)
    await updateDoc(doc(db, 'lists', listId, 'items', item.id), {
      qty: next === 1 ? null : String(next),
    })
  }

  async function clearBought() {
    const bought = items.filter(i => i.bought)
    await Promise.all(bought.map(i => deleteDoc(doc(db, 'lists', listId, 'items', i.id))))
    toast.success(`${bought.length} פריטים הוסרו`)
  }

  const pending = items.filter(i => !i.bought)
  const bought  = items.filter(i =>  i.bought)
  const grouped = {}
  pending.forEach(item => {
    const cat = item.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  })

  const filteredMaster = masterProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const masterGrouped = {}
  filteredMaster.forEach(p => {
    if (!masterGrouped[p.category]) masterGrouped[p.category] = []
    masterGrouped[p.category].push(p)
  })

  return (
    <div style={s.page}>
      <div style={s.summary}>
        <span style={s.summaryText}>
          <strong style={{ color: 'var(--navy)', fontSize: '16px' }}>{pending.length}</strong>
          <span> פריטים לקנות</span>
          {bought.length > 0 && <span style={{ color: 'var(--green)', marginRight: '10px' }}> · {bought.length} ✓</span>}
        </span>
        {masterProducts.length > 0 && (
          <button style={s.masterBtn} onClick={() => setShowMasterPicker(true)}>
            + מהרשימה הכללית
          </button>
        )}
      </div>

      <div style={s.content}>
        {pending.length === 0 && (
          <div style={s.empty}>
            <p style={s.emptyIcon}>🛒</p>
            <p style={s.emptyTitle}>הרשימה ריקה</p>
            <p style={s.emptyDesc}>לחץ + להוסיף פריט</p>
          </div>
        )}

        {Object.keys(grouped).map(cat => (
          <div key={cat} style={s.group}>
            <p style={s.catLabel}>
              <span style={s.catEmoji}>{getCat(cat).emoji}</span>
              {getCat(cat).label}
            </p>
            {grouped[cat].map((item, i) => (
              <ItemRow key={item.id} item={item} delay={i * 0.03}
                onToggle={() => toggleBought(item)} onDelete={() => deleteItem(item.id)}
                onQtyChange={delta => updateQty(item, delta)} />
            ))}
          </div>
        ))}

        {bought.length > 0 && (
          <div style={s.boughtSection}>
            <button className="btn-ghost" style={s.boughtToggle} onClick={() => setShowBought(v => !v)}>
              {showBought ? '▲' : '▼'} נרכש ({bought.length})
            </button>
            {showBought && (
              <>
                {bought.map(item => (
                  <ItemRow key={item.id} item={item} onToggle={() => toggleBought(item)} onDelete={() => deleteItem(item.id)} />
                ))}
                <button className="btn-secondary" onClick={clearBought} style={{ width: '100%', marginTop: '8px', fontSize: '13px', padding: '10px' }}>
                  נקה פריטים שנרכשו
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showAdd && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="card fade-up" style={s.panel}>
            <h3 style={s.panelTitle}>הוספת פריט</h3>
            <form onSubmit={addItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="input" placeholder="שם הפריט..." value={newItem} onChange={e => setNewItem(e.target.value)} autoFocus />
              <input className="input" placeholder="כמות (אופציונלי)" value={newQty} onChange={e => setNewQty(e.target.value)} />
              <select className="input" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
              </select>
              <button className="btn-primary" type="submit" disabled={!newItem.trim()} style={{ padding: '14px', fontSize: '16px' }}>הוסף לרשימה</button>
            </form>
          </div>
        </div>
      )}

      {showMasterPicker && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowMasterPicker(false)}>
          <div className="card fade-up" style={{ ...s.panel, maxHeight: '75dvh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={s.panelTitle}>בחר מהרשימה הכללית</h3>
            <input className="input" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: '12px', fontSize: '14px' }} />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {Object.keys(masterGrouped).map(cat => (
                <div key={cat}>
                  <p style={s.catLabel}>
                    <span style={s.catEmoji}>{getCat(cat).emoji}</span>
                    {getCat(cat).label}
                  </p>
                  {masterGrouped[cat].map(p => {
                    const inList = items.some(i => !i.bought && i.text === p.name)
                    return (
                      <div key={p.id} style={{ ...s.masterRow, opacity: inList ? 0.4 : 1 }} onClick={() => !inList && addFromMaster(p)}>
                        <span style={{ fontSize: '15px' }}>{p.name}</span>
                        {inList
                          ? <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>ברשימה</span>
                          : <span style={{ fontSize: '22px', color: 'var(--blue)', fontWeight: 300, lineHeight: 1 }}>+</span>
                        }
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <button style={s.fab} onClick={() => setShowAdd(true)}>
        <span style={{ fontSize: '22px', lineHeight: 1 }}>+</span>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>הוסף</span>
      </button>
    </div>
  )
}

function ItemRow({ item, onToggle, onDelete, onQtyChange, delay = 0 }) {
  const qty = parseInt(item.qty) || 1
  return (
    <div className="fade-up" style={{ ...s.row, opacity: item.bought ? 0.55 : 1, animationDelay: `${delay}s` }}>
      <button style={{ ...s.checkbox, ...(item.bought ? s.checkboxDone : {}) }} onClick={onToggle}>
        {item.bought && '✓'}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...s.rowText, textDecoration: item.bought ? 'line-through' : 'none', color: item.bought ? 'var(--navy-mid)' : 'var(--navy)' }}>
          {item.text}
        </span>
      </div>
      {!item.bought && (
        <div style={s.qtyControl}>
          <button style={s.qtyBtn} onClick={() => onQtyChange(-1)}>−</button>
          <span style={s.qtyNum}>{qty}</span>
          <button style={s.qtyBtn} onClick={() => onQtyChange(1)}>+</button>
        </div>
      )}
      <button className="btn-ghost" onClick={onDelete} style={{ padding: '6px 10px', fontSize: '18px', color: '#9DB4D4' }}>×</button>
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '90px' },
  summary: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'white', borderBottom: '1px solid var(--bg-dark)' },
  summaryText: { fontSize: '14px', color: 'var(--navy-mid)', display: 'flex', alignItems: 'center', gap: '4px' },
  masterBtn: { background: 'var(--blue-light)', border: '1.5px solid var(--blue)', borderRadius: '8px', padding: '8px 14px', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--blue-dark)', cursor: 'pointer' },
  content: { padding: '8px 16px' },
  empty: { textAlign: 'center', paddingTop: '70px' },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: 'var(--navy)' },
  emptyDesc: { fontSize: '14px', color: 'var(--navy-mid)' },
  group: { marginBottom: '6px' },
  catLabel: { fontSize: '12px', fontWeight: 700, color: 'var(--navy-mid)', padding: '12px 4px 5px', display: 'flex', alignItems: 'center', gap: '5px' },
  catEmoji: { fontSize: '14px' },
  row: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 12px', background: 'white', borderRadius: '12px', marginBottom: '6px', boxShadow: '0 1px 6px rgba(30,58,95,0.07)', minHeight: '58px' },
  checkbox: { width: '32px', height: '32px', flexShrink: 0, border: '2.5px solid var(--blue)', borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'white', transition: 'all 0.2s' },
  checkboxDone: { background: 'var(--green)', borderColor: 'var(--green)' },
  rowText: { fontSize: '16px', display: 'block', fontWeight: 500 },
  boughtSection: { marginTop: '12px' },
  boughtToggle: { fontSize: '13px', fontWeight: 600, width: '100%', textAlign: 'right', padding: '8px 4px', color: 'var(--navy-mid)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,30,60,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '20px' },
  panel: { width: '100%', maxWidth: '440px', borderRadius: '18px', paddingBottom: '24px' },
  panelTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '18px', color: 'var(--navy)' },
  masterRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--bg)', borderRadius: '10px', marginBottom: '5px', cursor: 'pointer', minHeight: '50px' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg)', borderRadius: '10px', padding: '4px 6px', border: '1.5px solid var(--bg-dark)' },
  qtyBtn: { width: '30px', height: '30px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '20px', fontWeight: 500, color: 'var(--blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 },
  qtyNum: { fontSize: '15px', fontWeight: 700, minWidth: '20px', textAlign: 'center', color: 'var(--navy)' },
  fab: { position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', height: '52px', paddingInline: '28px', borderRadius: '26px', background: 'var(--blue-dark)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 20px rgba(29,78,216,0.4)', zIndex: 50 },
}
