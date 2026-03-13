// src/components/ShoppingList.jsx
import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { id: 'produce',  label: 'ירקות ופירות' },
  { id: 'dairy',    label: 'חלב וביצים' },
  { id: 'bakery',   label: 'מאפים' },
  { id: 'meat',     label: 'בשר ודגים' },
  { id: 'frozen',   label: 'קפואים' },
  { id: 'pantry',   label: 'מזווה' },
  { id: 'hygiene',  label: 'היגיינה' },
  { id: 'other',    label: 'אחר' },
]

function getCatLabel(id) {
  return CATEGORIES.find(c => c.id === id)?.label ?? 'אחר'
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
          <strong>{pending.length}</strong> פריטים לקנות
          {bought.length > 0 && <span style={{ color: 'var(--sage)', marginRight: '10px' }}> · {bought.length} נרכשו</span>}
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
            <p style={s.emptyTitle}>רשימת הקניות ריקה</p>
            <p style={s.emptyDesc}>הוסף פריטים או בחר מהרשימה הכללית</p>
          </div>
        )}

        {Object.keys(grouped).map(cat => (
          <div key={cat} style={s.group}>
            <p style={s.catLabel}>{getCatLabel(cat)}</p>
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
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button className="btn-primary" type="submit" disabled={!newItem.trim()} style={{ padding: '13px' }}>הוסף לרשימה</button>
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
                  <p style={s.catLabel}>{getCatLabel(cat)}</p>
                  {masterGrouped[cat].map(p => {
                    const inList = items.some(i => !i.bought && i.text === p.name)
                    return (
                      <div key={p.id} style={{ ...s.masterRow, opacity: inList ? 0.4 : 1 }} onClick={() => !inList && addFromMaster(p)}>
                        <span style={{ fontSize: '15px' }}>{p.name}</span>
                        {inList
                          ? <span style={{ fontSize: '12px', color: 'var(--sage)', fontWeight: 600 }}>ברשימה</span>
                          : <span style={{ fontSize: '22px', color: 'var(--rose-dark)', fontWeight: 300, lineHeight: 1 }}>+</span>
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

      <button style={s.fab} onClick={() => setShowAdd(true)}>+</button>
    </div>
  )
}

function ItemRow({ item, onToggle, onDelete, onQtyChange, delay = 0 }) {
  const qty = parseInt(item.qty) || 1
  return (
    <div className="fade-up" style={{ ...s.row, opacity: item.bought ? 0.5 : 1, animationDelay: `${delay}s` }}>
      <button style={{ ...s.checkbox, ...(item.bought ? s.checkboxDone : {}) }} onClick={onToggle}>
        {item.bought && '✓'}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...s.rowText, textDecoration: item.bought ? 'line-through' : 'none' }}>{item.text}</span>
        <p style={s.rowMeta}>{item.addedBy}</p>
      </div>
      {!item.bought && (
        <div style={s.qtyControl}>
          <button style={s.qtyBtn} onClick={() => onQtyChange(-1)}>−</button>
          <span style={s.qtyNum}>{qty}</span>
          <button style={s.qtyBtn} onClick={() => onQtyChange(1)}>+</button>
        </div>
      )}
      <button className="btn-ghost" onClick={onDelete} style={{ padding: '4px 8px', fontSize: '17px', color: '#C4A090' }}>×</button>
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '80px' },
  summary: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'white', borderBottom: '1px solid var(--cream-dark)' },
  summaryText: { fontSize: '14px', color: 'var(--espresso-mid)' },
  masterBtn: { background: 'var(--cream)', border: '1.5px solid var(--rose)', borderRadius: '8px', padding: '7px 14px', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--rose-dark)', cursor: 'pointer' },
  content: { padding: '8px 16px' },
  empty: { textAlign: 'center', paddingTop: '60px' },
  emptyTitle: { fontSize: '17px', fontWeight: 600, marginBottom: '6px' },
  emptyDesc: { fontSize: '14px', color: 'var(--espresso-mid)' },
  group: { marginBottom: '4px' },
  catLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--rose-dark)', textTransform: 'uppercase', padding: '10px 4px 4px' },
  row: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'white', borderRadius: '11px', marginBottom: '5px', boxShadow: '0 1px 5px rgba(30,20,16,0.05)' },
  checkbox: { width: '24px', height: '24px', flexShrink: 0, border: '2px solid var(--rose)', borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', transition: 'all 0.2s' },
  checkboxDone: { background: 'var(--sage)', borderColor: 'var(--sage)' },
  rowText: { fontSize: '15px', display: 'block' },
  rowMeta: { fontSize: '11px', color: '#BBB0A8', marginTop: '2px' },
  boughtSection: { marginTop: '12px' },
  boughtToggle: { fontSize: '13px', fontWeight: 600, width: '100%', textAlign: 'right', padding: '8px 4px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(30,20,16,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '20px' },
  panel: { width: '100%', maxWidth: '440px', borderRadius: '18px', paddingBottom: '24px' },
  panelTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '18px' },
  masterRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--cream)', borderRadius: '10px', marginBottom: '5px', cursor: 'pointer' },
  qtyControl: { display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--cream)', borderRadius: '8px', padding: '3px 6px' },
  qtyBtn: { width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px', fontWeight: 500, color: 'var(--rose-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: 0 },
  qtyNum: { fontSize: '14px', fontWeight: 700, minWidth: '16px', textAlign: 'center', color: 'var(--espresso)' },
  fab: { position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', width: '52px', height: '52px', borderRadius: '50%', background: 'var(--espresso)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '28px', fontWeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(30,20,16,0.3)', zIndex: 50, lineHeight: 1 },
}
