# MamiTavi 🛒💑 — מאמי תביא

אפליקציית רשימת קניות משותפת לזוגות — React + Firebase.

---

## התקנה מהירה

### 1. הגדרת Firebase

1. היכנס ל-[Firebase Console](https://console.firebase.google.com)
2. צור פרויקט חדש
3. הוסף אפליקציית **Web** לפרויקט
4. הפעל **Authentication → Email/Password**
5. הפעל **Firestore Database** (בחר Production mode)
6. העתק את `firebaseConfig` שלך ל-`src/firebase.js`

### 2. Firestore Rules

בקונסול Firebase → Firestore → Rules, העתק את תוכן `firestore.rules` לתוך העורך ולחץ **Publish**.

### 3. התקנה והרצה

```bash
npm install
npm run dev
```

### 4. Build לפרודקשן

```bash
npm run build
```
העלה את תיקיית `dist/` ל-Firebase Hosting / Vercel / Netlify.

---

## מבנה האפליקציה

```
src/
├── firebase.js          ← הגדרות Firebase (מלא את הנתונים שלך!)
├── App.jsx              ← ניתוב בין מסכים
├── main.jsx
├── hooks/
│   └── useAuth.js       ← ניהול state של משתמש
├── components/
│   ├── AuthScreen.jsx   ← כניסה / הרשמה
│   ├── InvitePartner.jsx← שיתוף עם בן/בת הזוג
│   └── ShoppingList.jsx ← הרשימה הראשית
└── styles/
    └── global.css
```

---

## מודל Firestore

```
users/{uid}
  - name: string
  - email: string
  - isPremium: boolean       ← לשימוש עתידי בגביית תשלום
  - listId: string | null
  - partnerEmail: string | null
  - createdAt: timestamp

lists/{listId}
  - members: [uid1, uid2]
  - createdBy: uid
  - createdAt: timestamp
  
  items/{itemId}
    - text: string
    - category: string
    - qty: string | null
    - bought: boolean
    - addedBy: string
    - addedByUid: string
    - createdAt: timestamp
    - boughtAt: timestamp | null
    - boughtBy: string | null
```

---

## גביית תשלום — איך להוסיף?

הדגל `isPremium` על מסמך המשתמש מוכן לשימוש.

### אפשרויות מומלצות:

**תשלום חד-פעמי:**
- [Lemon Squeezy](https://lemonsqueezy.com) — פשוט, תמיכה ב-ILS
- [Paddle](https://paddle.com)

**מנוי חודשי:**
- [Stripe](https://stripe.com) + Firebase Functions לוידוא תשלום
- Lemon Squeezy (תומך גם במנויים)

**Flow מומלץ:**
1. משתמש לוחץ "שדרג לפרמיום" → מועבר לדף תשלום
2. לאחר תשלום → Webhook מעדכן `isPremium: true` ב-Firestore
3. בקוד: `if (profile.isPremium) { /* תכונות פרמיום */ }`

**רעיונות לתכונות פרמיום:**
- רשימות מרובות (נסיעות, אירועים)
- היסטוריית קניות
- סטטיסטיקות הוצאות
- תזכורות וחיפוש

---

## פריסה מומלצת

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

או פשוט חבר את ה-repo ל-**Vercel** — deploy אוטומטי בכל push.
