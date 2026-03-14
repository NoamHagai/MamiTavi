// src/components/MasterProducts.jsx
import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, updateDoc, serverTimestamp
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

function getCat(id) {
  return CATEGORIES.find(c => c.id === id) ?? { label: 'אחר' }
}

export default function MasterProducts({ listId, user, profile }) {
  const [products, setProducts] = useState([])
  const [productLists, setProductLists] = useState([])
  const [activeList, setActiveList] = useState('general')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('other')
  const [showForm, setShowForm] = useState(false)
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [search, setSearch] = useState('')

  // Listen to list doc for productLists
  useEffect(() => {
    if (!listId) return
    return onSnapshot(doc(db, 'lists', listId), snap => {
      if (snap.exists()) {
        setProductLists(snap.data().productLists || [])
      }
    })
  }, [listId])

  useEffect(() => {
    if (!listId) return
    const q = query(collection(db, 'lists', listId, 'products'), orderBy('name', 'asc'))
    return onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [listId])

  async function addProduct(e) {
    e.preventDefault()
    if (!newName.trim()) return
    // Always added to כללי — no productListIds assigned
    await addDoc(collection(db, 'lists', listId, 'products'), {
      name: newName.trim(),
      category: newCategory,
      productListIds: [],
      addedBy: user.uid,
      createdAt: serverTimestamp(),
    })
    setNewName('')
    setShowForm(false)
  }

  async function deleteProduct(id) {
    await deleteDoc(doc(db, 'lists', listId, 'products', id))
  }

  async function addProductList(e) {
    e.preventDefault()
    const name = newListName.trim()
    if (!name) return
    const id = Date.now().toString()
    await updateDoc(doc(db, 'lists', listId), {
      productLists: [...productLists, { id, name }],
    })
    setActiveList(id)
    setNewListName('')
    setShowNewList(false)
  }

  async function deleteProductList(listIdToDelete) {
    // Remove this list id from all products that have it
    const affected = products.filter(p => (p.productListIds || []).includes(listIdToDelete))
    await Promise.all(affected.map(p =>
      updateDoc(doc(db, 'lists', listId, 'products', p.id), {
        productListIds: (p.productListIds || []).filter(id => id !== listIdToDelete),
      })
    ))
    await updateDoc(doc(db, 'lists', listId), {
      productLists: productLists.filter(pl => pl.id !== listIdToDelete),
    })
    setActiveList('general')
  }

  async function toggleProductInList(product, targetListId) {
    const current = product.productListIds || []
    const updated = current.includes(targetListId)
      ? current.filter(id => id !== targetListId)
      : [...current, targetListId]
    await updateDoc(doc(db, 'lists', listId, 'products', product.id), {
      productListIds: updated,
    })
  }

  async function addAllToCart(listProducts) {
    const cartRef = collection(db, 'lists', listId, 'items')
    // Get current cart items to avoid duplicates
    let added = 0
    for (const p of listProducts) {
      await addDoc(cartRef, {
        text: p.name,
        category: p.category,
        qty: null,
        bought: false,
        addedBy: profile?.name || user.displayName || 'משתמש',
        addedByUid: user.uid,
        createdAt: serverTimestamp(),
      })
      added++
    }
    toast.success(`${added} פריטים נוספו לרשימת הקניות`)
  }

  // Products shown in current view
  const visibleProducts = activeList === 'general'
    ? products
    : products.filter(p => (p.productListIds || []).includes(activeList))

  const filtered = visibleProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = {}
  filtered.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  })

  // For the picker: products NOT yet in this custom list
  const notInList = products.filter(p => !(p.productListIds || []).includes(activeList))
  const filteredPicker = notInList.filter(p =>
    p.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  return (
    <div style={s.page}>

      {/* List tabs */}
      <div style={s.tabBar}>
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(activeList === 'general' ? s.tabActive : {}) }}
            onClick={() => setActiveList('general')}
          >
            כללי
          </button>
          {productLists.map(pl => (
            <div key={pl.id} style={s.tabWrap}>
              <button
                style={{ ...s.tab, ...(activeList === pl.id ? s.tabActive : {}) }}
                onClick={() => setActiveList(pl.id)}
              >
                {pl.name}
              </button>
              {activeList === pl.id && (
                <button style={s.tabDelete} onClick={() => deleteProductList(pl.id)}>×</button>
              )}
            </div>
          ))}
          <button style={s.addTabBtn} onClick={() => setShowNewList(true)}>+</button>
        </div>
      </div>

      {/* Search */}
      <div style={s.topBar}>
        <input
          className="input"
          placeholder="חיפוש מוצר..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: '14px', padding: '10px 14px' }}
        />
        {activeList !== 'general' && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button style={s.actionBtn} onClick={() => { setShowPicker(true); setPickerSearch('') }}>
              + הוסף מהכללי
            </button>
            {visibleProducts.length > 0 && (
              <button style={{ ...s.actionBtn, ...s.actionBtnGreen }} onClick={() => addAllToCart(visibleProducts)}>
                הוסף הכל לקניות
              </button>
            )}
          </div>
        )}
      </div>

      <div style={s.content}>
        {filtered.length === 0 && (
          <div style={s.empty}>
            <p style={s.emptyTitle}>
              {activeList === 'general' ? 'הרשימה הכללית ריקה' : 'הרשימה ריקה'}
            </p>
            <p style={s.emptyDesc}>
              {activeList === 'general'
                ? 'הוסף מוצרים שאתם קונים בדרך כלל'
                : 'לחץ "הוסף מהכללי" כדי להוסיף מוצרים לרשימה זו'}
            </p>
          </div>
        )}

        {Object.keys(grouped).map(cat => (
          <div key={cat} style={s.group}>
            <p style={s.catLabel}>{getCat(cat).label}</p>
            {grouped[cat].map(p => (
              <div key={p.id} className="fade-up" style={s.row}>
                <span style={s.rowText}>{p.name}</span>
                <button
                  className="btn-ghost"
                  onClick={() => activeList === 'general' ? deleteProduct(p.id) : toggleProductInList(p, activeList)}
                  style={{ color: 'var(--navy-mid)', padding: '4px 10px', fontSize: '18px' }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add product modal (only in כללי) */}
      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="card fade-up" style={s.panel}>
            <h3 style={s.panelTitle}>הוספת מוצר לכללי</h3>
            <form onSubmit={addProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="input"
                placeholder="שם המוצר..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
              <select className="input" value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button className="btn-primary" type="submit" disabled={!newName.trim()} style={{ padding: '13px' }}>
                הוסף
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New list modal */}
      {showNewList && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowNewList(false)}>
          <div className="card fade-up" style={s.panel}>
            <h3 style={s.panelTitle}>רשימה חדשה</h3>
            <form onSubmit={addProductList} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                className="input"
                placeholder='לדוגמה: ארוחת ערב, חג...'
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                autoFocus
              />
              <button className="btn-primary" type="submit" disabled={!newListName.trim()} style={{ padding: '13px' }}>
                צור רשימה
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Picker: add products from כללי to this custom list */}
      {showPicker && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowPicker(false)}>
          <div className="card fade-up" style={{ ...s.panel, maxHeight: '75dvh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={s.panelTitle}>הוסף מהכללי</h3>
            <input
              className="input"
              placeholder="חיפוש..."
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              style={{ marginBottom: '12px', fontSize: '14px' }}
            />
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredPicker.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--navy-mid)', paddingTop: '20px', fontSize: '14px' }}>
                  כל המוצרים כבר ברשימה
                </p>
              )}
              {filteredPicker.map(p => (
                <div key={p.id} style={s.pickerRow} onClick={() => toggleProductInList(p, activeList)}>
                  <span style={{ fontSize: '15px' }}>{p.name}</span>
                  <span style={{ fontSize: '22px', color: 'var(--blue)', fontWeight: 300, lineHeight: 1 }}>+</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FAB — only show in כללי */}
      {activeList === 'general' && (
        <button style={s.fab} onClick={() => setShowForm(true)}>
          <span style={{ fontSize: '22px', lineHeight: 1 }}>+</span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>הוסף מוצר</span>
        </button>
      )}
    </div>
  )
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingBottom: '90px' },
  tabBar: { background: 'white', borderBottom: '1px solid var(--bg-dark)', paddingInline: '16px', paddingTop: '10px', flexShrink: 0 },
  tabs: { display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', scrollbarWidth: 'none' },
  tabWrap: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  tab: { padding: '6px 14px', borderRadius: '20px', border: '1.5px solid var(--bg-dark)', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--navy-mid)', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabActive: { background: 'var(--blue-dark)', borderColor: 'var(--blue-dark)', color: 'white' },
  tabDelete: { marginRight: '4px', width: '20px', height: '20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px', color: 'var(--navy-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 },
  addTabBtn: { padding: '6px 14px', borderRadius: '20px', border: '1.5px dashed var(--bg-dark)', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--navy-mid)', cursor: 'pointer', flexShrink: 0 },
  topBar: { padding: '12px 16px', borderBottom: '1px solid var(--bg-dark)', background: 'white', flexShrink: 0 },
  actionBtn: { flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid var(--blue)', background: 'var(--blue-light)', fontFamily: 'var(--font-body)', fontSize: '13px', fontWeight: 600, color: 'var(--blue-dark)', cursor: 'pointer' },
  actionBtnGreen: { border: '1.5px solid var(--green)', background: '#DCFCE7', color: '#15803D' },
  content: { padding: '8px 16px' },
  empty: { textAlign: 'center', paddingTop: '60px' },
  emptyTitle: { fontSize: '17px', fontWeight: 600, color: 'var(--navy)', marginBottom: '6px' },
  emptyDesc: { fontSize: '14px', color: 'var(--navy-mid)' },
  group: { marginBottom: '4px' },
  catLabel: { fontSize: '12px', fontWeight: 700, color: 'var(--navy-mid)', padding: '10px 4px 4px' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'white', borderRadius: '10px', marginBottom: '5px', boxShadow: '0 1px 4px rgba(30,58,95,0.06)' },
  rowText: { fontSize: '15px', color: 'var(--navy)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(10,30,60,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '20px' },
  panel: { width: '100%', maxWidth: '440px', borderRadius: '18px', paddingBottom: '24px' },
  panelTitle: { fontSize: '18px', fontWeight: 700, marginBottom: '18px', color: 'var(--navy)' },
  pickerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--bg)', borderRadius: '10px', marginBottom: '5px', cursor: 'pointer', minHeight: '50px' },
  fab: { position: 'fixed', bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))', left: '50%', transform: 'translateX(-50%)', height: '54px', paddingInline: '32px', borderRadius: '27px', background: 'var(--blue)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 24px rgba(59,130,246,0.55)', zIndex: 50, fontFamily: 'var(--font-body)' },
}
