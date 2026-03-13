import { useState, useEffect } from 'react';
import { Plus, Trash2, LayoutGrid } from 'lucide-react';
import axios from 'axios';

interface Court {
  id_court: number;
  name: string;
  order_index: number;
}

const ConfigQuadrasPage = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [newName, setNewName] = useState('');

  const fetchCourts = () => {
    axios.get('http://localhost:3001/api/tournaments/1/courts')
      .then((res: any) => setCourts(res.data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchCourts();
  }, []);

  const handleAdd = () => {
    if (!newName) return;
    axios.post('http://localhost:3001/api/courts', {
      id_tournament: 1,
      name: newName,
      order_index: courts.length + 1
    })
    .then(() => {
      setNewName('');
      fetchCourts();
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <LayoutGrid className="text-premium-accent" size={32} />
        <div>
          <h2 className="text-3xl font-bold">Configuração de Quadras</h2>
          <p className="text-zinc-500 text-sm">Defina os nomes e a ordem das quadras do complexo.</p>
        </div>
      </div>

      <div className="premium-card flex gap-4">
        <input 
          type="text" 
          placeholder="Ex: Quadra Central, Quadra 1..." 
          className="premium-input flex-1"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button className="btn-primary flex items-center gap-2" onClick={handleAdd}>
          <Plus size={18} />
          <span>Adicionar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courts.map((court) => (
          <div key={court.id_court} className="premium-card !p-6 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center font-bold text-premium-accent">
                {court.order_index}
              </div>
              <span className="text-xl font-bold text-zinc-200">{court.name}</span>
            </div>
            <button className="text-zinc-600 hover:text-red-500 transition-colors p-2 opacity-0 group-hover:opacity-100">
              <Trash2 size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfigQuadrasPage;
