import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-center"
      toastOptions={{
        style: {
          fontFamily: "'DM Sans', sans-serif",
          background: '#2C1810',
          color: '#FDF6EC',
          borderRadius: '12px',
          fontSize: '14px',
        }
      }}
    />
  </React.StrictMode>
)
