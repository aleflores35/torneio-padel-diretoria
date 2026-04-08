import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { CategoryProvider } from './context/CategoryContext';

import AtletasPage from './pages/AtletasPage';
import ChavesPage from './pages/ChavesPage';
import JogosPage from './pages/JogosPage';
import QuadrasPage from './pages/QuadrasPage';
import PublicoPage from './pages/PublicoPage';
import ConfigQuadrasPage from './pages/ConfigQuadrasPage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import CheckoutPage from './pages/CheckoutPage';
import DuplasPage from './pages/DuplasPage';
import DashboardPage from './pages/DashboardPage';
import RankingPage from './pages/RankingPage';
import RondasPage from './pages/RondasPage';
import AdminSignupPage from './pages/AdminSignupPage';

function App() {
  return (
    <CategoryProvider>
      <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin-signup" element={<AdminSignupPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/publico" element={<PublicoPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/*" element={
          <Layout>
            <Routes>
              <Route path="/admin" element={<DashboardPage />} />
              <Route path="/admin/atletas" element={<AtletasPage />} />
              <Route path="/duplas" element={<DuplasPage />} />
              <Route path="/chaves" element={<ChavesPage />} />
              <Route path="/rodadas" element={<RondasPage />} />
              <Route path="/jogos" element={<JogosPage />} />
              <Route path="/quadras" element={<QuadrasPage />} />
              <Route path="/quadras/config" element={<ConfigQuadrasPage />} />
            </Routes>
          </Layout>
        } />
      </Routes>
      </Router>
    </CategoryProvider>
  );
}

export default App;
