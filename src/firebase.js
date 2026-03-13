import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDHE0cEBSBO-v7GBWPpWbmdW5-0FjDAR38",
  authDomain: "mamitavi.firebaseapp.com",
  projectId: "mamitavi",
  storageBucket: "mamitavi.firebasestorage.app",
  messagingSenderId: "766525783745",
  appId: "1:766525783745:web:7a5f4097a3e01afb5ade40"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app