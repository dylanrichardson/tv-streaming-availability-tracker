import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Watchlist } from './pages/Watchlist';
import { Analytics } from './pages/Analytics';
import './index.css';

function App() {
  return (
    <BrowserRouter basename="/tv-streaming-availability-tracker">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Watchlist />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
