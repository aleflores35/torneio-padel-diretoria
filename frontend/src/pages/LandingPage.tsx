// frontend/src/pages/LandingPage.tsx
import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, TrendingUp } from 'lucide-react';
import api from '../api';
import { RegistrationForm } from '../components/RegistrationForm';

interface Category {
  id: number;
  name: string;
  description: string;
  tournament: {
    registration_open: boolean;
    registration_deadline: string;
    status: string;
  };
}

export function LandingPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories');
        setCategories(response.data);
        if (response.data.length > 0) {
          setSelectedCategory(response.data[0].id);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const activeCategory = categories.find(c => c.id === selectedCategory);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Trophy className="w-16 h-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Ranking Padel SRB 2026</h1>
          <p className="text-lg text-gray-600">Torneio contínuo com ranking atualizado em tempo real</p>
        </div>

        {/* Categories Tabs */}
        {categories.length > 0 && (
          <div className="mb-12">
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-6 py-2 rounded-full font-medium transition ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Category Info & Registration */}
            {activeCategory && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                {/* Registration Form */}
                <div className="md:col-span-1">
                  <RegistrationForm
                    categoryId={activeCategory.id}
                    deadline={activeCategory.tournament.registration_deadline}
                    onSuccess={() => {
                      // Refresh categories
                      api.get('/categories').then(r => setCategories(r.data));
                    }}
                  />
                </div>

                {/* Info Cards */}
                <div className="md:col-span-2 space-y-4">
                  <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-600">Próximo prazo</p>
                      <p className="font-bold">
                        {new Date(activeCategory.tournament.registration_deadline).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
                    <Users className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-600">Status do torneio</p>
                      <p className="font-bold uppercase text-sm">
                        {activeCategory.tournament.status === 'REGISTRATION' && '📝 Inscrições abertas'}
                        {activeCategory.tournament.status === 'RUNNING' && '🎮 Em andamento'}
                        {activeCategory.tournament.status === 'FINISHED' && '✅ Finalizado'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-4">
                    <h4 className="font-bold mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Como funciona
                    </h4>
                    <ul className="text-sm text-gray-700 space-y-1">
                      <li>✓ Registre-se na sua categoria</li>
                      <li>✓ Duplas sorteadas sem repetição</li>
                      <li>✓ Matches às quintas (até fim do ano)</li>
                      <li>✓ Cada partida, atualiza o ranking</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Trophy className="w-12 h-12 mx-auto text-blue-600 mb-4" />
            <h3 className="font-bold text-lg mb-2">Ranking Dinâmico</h3>
            <p className="text-gray-600 text-sm">Cada partida atualiza sua posição no ranking em tempo real</p>
          </div>

          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-green-600 mb-4" />
            <h3 className="font-bold text-lg mb-2">Duplas Justas</h3>
            <p className="text-gray-600 text-sm">Sorteio inteligente que respeita suas preferências</p>
          </div>

          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-purple-600 mb-4" />
            <h3 className="font-bold text-lg mb-2">Agenda Automática</h3>
            <p className="text-gray-600 text-sm">Seus jogos agendados nas datas e horários automáticos</p>
          </div>
        </div>
      </div>
    </div>
  );
}
