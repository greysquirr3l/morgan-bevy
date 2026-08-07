import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installFrontendCrashHandler } from './utils/crashHandler'

// Install the frontend crash handler before rendering so any error during
// React boot is captured.
installFrontendCrashHandler()

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
