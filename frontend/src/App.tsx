import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

import AtletasPage from './pages/AtletasPage';
import ChavesPage from './pages/ChavesPage';
import JogosPage from './pages/JogosPage';
import QuadrasPage from './pages/QuadrasPage';
import PublicoPage from './pages/PublicoPage';
import ConfigQuadrasPage from './pages/ConfigQuadrasPage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/publico" element={<PublicoPage />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/admin" element={<AtletasPage />} />
              <Route path="/chaves" element={<ChavesPage />} />
              <Route path="/jogos" element={<JogosPage />} />
              <Route path="/quadras" element={<QuadrasPage />} />
              <Route path="/quadras/config" element={<ConfigQuadrasPage />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

export default App;
