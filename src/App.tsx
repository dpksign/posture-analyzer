import { Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Capture from './pages/Capture'
import Analyzing from './pages/Analyzing'
import Report from './pages/Report'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/capture" element={<Capture />} />
      <Route path="/analyzing" element={<Analyzing />} />
      <Route path="/report" element={<Report />} />
    </Routes>
  )
}
