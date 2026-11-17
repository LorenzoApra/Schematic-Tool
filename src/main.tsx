import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeProjectStorage } from './lib/storage'
import { parseProject } from './lib/project'

await initializeProjectStorage((value) => parseProject(value) !== null)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
