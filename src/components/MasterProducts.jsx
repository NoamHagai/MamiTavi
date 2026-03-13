// src/components/MasterProducts.jsx
import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'

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

export default function MasterProducts({ listId, user }) {
  const [products, setProducts] = useState([])
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('other')
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!listId) return
    const q = query(
      collection(db, 'lists', listId, 'products'),
      orderBy('name', 'asc')
    )
    return onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [listId])

  async function addProduct(e) {
    e.preventDefault()
    if (!newName.trim()) return
    await addDoc(collection(db, 'lists', listId, 'products'), {
      name: newName.trim(),
      category: newCategory,
      addedBy: user.uid,
      createdAt: serverTimestamp(),
    })
    setNewName('')
    setShowForm(false)
  }

  async function deleteProduct(id) {
    await deleteDoc(doc(db, 'lists', listId, 'products', id))
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Group by category
  const grouped = {}
  filtered.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  })

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <input
          className="input"
          placeholder="חיפוש מוצר..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: '14px', padding: '10px 14px' }}
        />
      </div>

      <div style={s.content}>
        {products.length === 0 && (
          <div style={s.empty}>
            <p style={s.emptyTitle}>הרשימה הכללית ריקה</p>
            <p style={s.emptyDesc}>הוסף מוצרים שאתם קונים בדרך כלל</p>
          </div>
        )}

        {Object.keys(grouped).map(cat => (
          <div key={cat} style={s.group}>
            <p style={s.catLabel}>
              {CATEGORIES.find(c => c.id === cat)?.label ?? 'אחר'}
            </p>
            {grouped[cat].map(p => (
              <div key={p.id} className="fade-up" style={s.row}>
                <span style={s.rowText}>{p.name}</span>
                <button
                  className="btn-ghost"
                  onClick={() => deleteProduct(p.id)}
                  style={{ color: '#C4A090', padding: '4px 8px', fontSize: '16px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="card fade-up" style={s.panel}>
            <h3 style={s.panelTitle}>הוספת מוצר לרשימה הכללית</h3>
            <form onSubmit={addProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="input"
                placeholder="שם המוצר..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
              <select
                className="input"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              >
                {CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <button className="btn-primary" type="submit" disabled={!newName.trim()} style={{ padding: '13px' }}>
                הוסף
              </button>
            </form>
          </div>
        </div>
      )}

      <button style={s.fab} onClick={() => setShowForm(true)}>+</button>
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', paddingBottom: '80px', overflowY: 'auto' },
  topBar: { padding: '12px 16px', borderBottom: '1px solid var(--cream-dark)', background: 'var(--cream)' },
  content: { padding: '8px 16px' },
  empty: { textAlign: 'center', paddingTop: '60px' },
  emptyTitle: { fontSize: '17px', fontWeight: 600, color: 'var(--espresso)', marginBottom: '6px' },
  emptyDesc: { fontSize: '14px', color: 'var(--espresso-mid)' },
  group: { marginBottom: '4px' },
  catLabel: { fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--rose-dark)', textTransform: 'uppercase', padding: '10px 4px 4px' },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '11px 14px', background: 'white', borderRadius: '10px',
    marginBottom: '5px', boxShadow: '0 1px 4px rgba(30,20,16,0.05)',
  },
  rowText: { fontSize: '15px', color: 'var(--espresso)' },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(30,20,16,0.4)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 100, backdropFilter: 'blur(4px)',
  },
  panel: { width: '100%', maxWidth: '480px', borderRadius: '20px 20px 0 0', paddingBottom: '32px' },
  panelTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '18px' },
  fab: {
    position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
    width: '52px', height: '52px', borderRadius: '50%',
    background: 'var(--espresso)', color: 'white',
    border: 'none', cursor: 'pointer', fontSize: '28px', fontWeight: 300,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(30,20,16,0.3)', zIndex: 50, lineHeight: 1,
  },
}
