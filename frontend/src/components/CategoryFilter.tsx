import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Filter } from 'lucide-react';

interface CategoryFilterProps {
  categories?: Array<{ id: number; name: string }>;
  playerCounts?: Record<number, number>;
  selectedCategory?: number | null;
  onSelectCategory?: (categoryId: number | null) => void;
}

export function CategoryFilter({
  categories = [
    { id: 1, name: 'Masculino Iniciante / 6ª' },
    { id: 2, name: 'Masculino 4ª' },
    { id: 3, name: 'Feminino Iniciante' },
    { id: 4, name: 'Feminino 6ª' },
    { id: 5, name: 'Feminino 4ª' }
  ],
  playerCounts = {},
  selectedCategory = null,
  onSelectCategory = () => {}
}: CategoryFilterProps) {
  const [counts, setCounts] = useState<Record<number, number>>(playerCounts);
  const [hoveredCat, setHoveredCat] = useState<number | null>(null);

  useEffect(() => {
    // Carregar contagem de atletas por categoria
    const fetchCounts = async () => {
      try {
        // Simular fetch de contagens
        const newCounts: Record<number, number> = {};
        categories.forEach(cat => {
          // Em produção, isso viria da API
          newCounts[cat.id] = playerCounts[cat.id] || 0;
        });
        setCounts(newCounts);
      } catch (err) {
        console.error('Erro ao carregar contagem de atletas:', err);
      }
    };

    fetchCounts();
  }, [categories, playerCounts]);

  const isPair = (num: number) => num > 0 && num % 2 === 0;
  const isValid = (num: number) => num >= 10 && isPair(num);

  return (
    <div className="w-full max-w-xs space-y-4 sticky top-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-green-400" />
          <h3 className="text-lg font-black uppercase italic tracking-tight text-white">
            Categorias
          </h3>
        </div>
        <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
          Selecione para filtrar ou gerar rodadas
        </p>
      </div>

      {/* Category List */}
      <div className="space-y-2">
        {categories.map((cat) => {
          const count = counts[cat.id] || 0;
          const pair = isPair(count);
          const valid = isValid(count);
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              onMouseEnter={() => setHoveredCat(cat.id)}
              onMouseLeave={() => setHoveredCat(null)}
              className={`
                w-full rounded-2xl border-2 p-4 transition-all duration-300 text-left
                ${isSelected
                  ? 'bg-green-500/20 border-green-400 shadow-lg shadow-green-500/20'
                  : 'bg-white/[0.03] border-white/10 hover:border-green-400/50'
                }
                ${hoveredCat === cat.id ? 'scale-102' : 'scale-100'}
              `}
            >
              {/* Category Name */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-black text-white uppercase italic tracking-tight leading-tight">
                    {cat.name}
                  </p>
                </div>
                {/* Status Badge */}
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                    valid
                      ? 'bg-green-500/20 text-green-400'
                      : count > 0 && !pair
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-zinc-500/10 text-zinc-500'
                  }`}
                >
                  {valid ? (
                    <>
                      <CheckCircle2 size={12} />
                      Pronto
                    </>
                  ) : count > 0 && !pair ? (
                    <>
                      <AlertCircle size={12} />
                      Ímpar
                    </>
                  ) : (
                    'Vazio'
                  )}
                </div>
              </div>

              {/* Athlete Count */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 font-bold">ATLETAS</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{count}</span>
                    <span className="text-[10px] text-zinc-600 font-bold uppercase">
                      {count === 1 ? 'atleta' : 'atletas'}
                    </span>
                  </div>
                </div>

                {/* Berger Info */}
                {count > 0 && (
                  <div className="text-right space-y-1">
                    <p className="text-[10px] text-zinc-600 font-bold uppercase">Rodadas</p>
                    <p className="text-xl font-black text-white">
                      {pair ? count - 1 : '—'}
                    </p>
                    <p className="text-[9px] text-zinc-500 font-mono">
                      {pair ? `${count - 1} rodadas` : 'N precisa ser par'}
                    </p>
                  </div>
                )}
              </div>

              {/* Info Message */}
              {count > 0 && !pair && (
                <div className="mt-3 pt-3 border-t border-orange-500/20 text-[10px] text-orange-400 font-bold leading-relaxed">
                  ⚠️ Número ímpar! Algoritmo Berger precisa de N par para todos vs todos.
                </div>
              )}

              {count >= 10 && pair && (
                <div className="mt-3 pt-3 border-t border-green-500/20 text-[10px] text-green-400 font-bold leading-relaxed">
                  ✅ {count} atletas = {count - 1} rodadas (Berger ready)
                </div>
              )}

              {count > 0 && count < 10 && (
                <div className="mt-3 pt-3 border-t border-yellow-500/20 text-[10px] text-yellow-400 font-bold leading-relaxed">
                  ℹ️ Mínimo 10 atletas para começar
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 space-y-2">
        <p className="text-xs font-black text-green-400 uppercase tracking-widest">
          💡 Como Funciona
        </p>
        <ul className="text-[10px] text-zinc-400 space-y-1 leading-relaxed">
          <li>• <strong>N par:</strong> Rodadas = N - 1</li>
          <li>• <strong>Berger:</strong> Todos vs todos, sem repetição</li>
          <li>• <strong>Exemplo:</strong> 12 atletas = 11 rodadas</li>
          <li>• <strong>Ímpar:</strong> Adicione 1 atleta para rodar</li>
        </ul>
      </div>

      {/* Stats Summary */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">
          Resumo Geral
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-zinc-600 font-bold mb-1">Total</p>
            <p className="text-xl font-black text-white">
              {Object.values(counts).reduce((a, b) => a + b, 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600 font-bold mb-1">Categorias</p>
            <p className="text-xl font-black text-white">{categories.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryFilter;
