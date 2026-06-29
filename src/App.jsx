import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Diet from './pages/Diet'
import Gym from './pages/Gym'
import Weight from './pages/Weight'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh bg-[#0f0f13]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/diet" element={<Diet />} />
          <Route path="/gym" element={<Gym />} />
          <Route path="/weight" element={<Weight />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
