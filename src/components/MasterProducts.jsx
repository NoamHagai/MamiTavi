// src/components/MasterProducts.jsx
import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'

const CATEGORIES = [
  { id: 'produce', label: 'ירקות ופירות' },
  { id: 'dairy',   label: 'חלב וביצים' },
  { id: 'bakery',  label: 'מאפים' },
  { id: 'meat',    label: 'בשר ודגים' },
  { id: 'frozen',  label: 'קפואים' },
  { id: 'pantry',  label: 'מזווה' },
  { id: 'hygiene', label: 'היגיינה' },
  { id: 'other',   label: 'אחר' },
]

function getCat(id) { return CATEGORIES.find(c => c.id === id)?.label ?? 'אחר' }

export default function MasterProducts({ user, listId }) {
  const [products, setProducts] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('other')
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('other')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'lists', listId, 'products'), orderBy('name', 'asc'))
    return onSnapshot(q, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [listId])

  async function addProduct(e) {
    e.preventDefault()
    if (!newName.trim()) return
    await addDoc(collection(db, 'lists', listId, 'products'), {
      name: newName.trim(), category: newCategory,
      addedBy: user.uid, createdAt: serverTimestamp(),
    })
    setNewName(''); setShowAdd(false)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editName.trim()) return
    await updateDoc(doc(db, 'lists', listId, 'products', editProduct.id), {
      name: editName.trim(), category: editCategory,
    })
    setEditProduct(null)
  }

  async function deleteProduct(id) {
    await deleteDoc(doc(db, 'lists', listId, 'products', id))
  }

  function openEdit(p) {
    setEditProduct(p); setEditName(p.name); setEditCategory(p.category || 'other')
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const grouped = {}
  filtered.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  })

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <input className="input" placeholder="חיפוש מוצר..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: '14px', padding: '10px 14px' }} />
      </div>

      <div style={s.content}>
        {products.length === 0 && (
          <div style={s.empty}>
            <p style={s.emptyTitle}>רשימת המוצרים ריקה</p>
            <p style={s.emptyDesc}>הוסף מוצרים שאתם קונים בדרך כלל</p>
          </div>
        )}

        {Object.keys(grouped).map(cat => (
          <div key={cat} style={s.group}>
            <p style={s.catLabel}>{getCat(cat)}</p>
            {grouped[cat].map(p => (
              <div key={p.id} className="fade-up" style={s.row} onClick={() => openEdit(p)}>
                <span style={s.rowText}>{p.name}</span>
                <button className="btn-ghost" onClick={e => { e.stopPropagation(); deleteProduct(p.id) }} style={{ fontSize: '18px', padding: '4px 10px' }}>×</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add */}
      {showAdd && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="card fade-up" style={s.panel}>
            <h3 style={s.panelTitle}>הוספת מוצר</h3>
            <form onSubmit={addProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="input" placeholder="שם המוצר..." value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
              <select className="input" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button className="btn-primary" type="submit" disabled={!newName.trim()} style={{ padding: '13px' }}>הוסף</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit */}
      {editProduct && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setEditProduct(null)}>
          <div className="card fade-up" style={s.panel}>
            <h3 style={s.panelTitle}>עריכת מוצר</h3>
            <form onSubmit={saveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} autoFocus />
              <select className="input" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button className="btn-primary" type="submit" disabled={!editName.trim()} style={{ padding: '13px' }}>שמור</button>
            </form>
          </div>
        </div>
      )}

      <button style={s.fab} onClick={() => setShowAdd(true)}>
        <span style={{ fontSize: '22px', lineHeight: 1 }}>+</span>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>הוסף מוצר</span>
      </button>
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '90px' },
  topBar: { padding: '12px 16px', borderBottom: '1px solid var(--bg-dark)', background: 'white', flexShrink: 0 },
  content: { padding: '8px 16px' },
  empty: { textAlign: 'center', paddingTop: '70px' },
  emptyTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: 'var(--navy)' },
  emptyDesc: { fontSize: '14px', color: 'var(--navy-mid)' },
  group: { marginBottom: '4px' },
  catLabel: { fontSize: '12px', fontWeight: 700, color: 'var(--navy-mid)', padding: '12px 4px 5px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'white', borderRadius: '11px', marginBottom: '5px', boxShadow: '0 1px 4px rgba(30,58,95,0.06)', cursor: 'pointer' },
  rowText: { fontSize: '15px', color: 'var(--navy)', fontWeight: 500 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,30,60,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '20px' },
  panel: { width: '100%', maxWidth: '440px', borderRadius: '18px', paddingBottom: '24px' },
  panelTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '18px', color: 'var(--navy)' },
  fab: { position: 'fixed', bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))', left: '50%', transform: 'translateX(-50%)', height: '54px', paddingInline: '32px', borderRadius: '27px', background: 'var(--blue)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 24px rgba(59,130,246,0.45)', zIndex: 50, fontFamily: 'var(--font-body)' },
}
