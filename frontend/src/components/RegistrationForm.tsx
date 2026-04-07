// frontend/src/components/RegistrationForm.tsx
import React, { useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api';

interface RegistrationFormProps {
  categoryId: number;
  deadline: string;
  onSuccess: () => void;
}

export function RegistrationForm({ categoryId, deadline, onSuccess }: RegistrationFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [side, setSide] = useState<'RIGHT' | 'LEFT' | 'EITHER'>('EITHER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const daysLeft = Math.ceil(
    (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/athletes', {
        name: name.trim(),
        email: email.trim(),
        side,
        category_id: categoryId
      });
      setSuccess(true);
      setName('');
      setEmail('');
      setSide('EITHER');
      setTimeout(onSuccess, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  if (daysLeft <= 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">❌ Inscrições encerradas para esta categoria</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <p className="text-green-700">✓ Registrado com sucesso!</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 max-w-md">
      <h3 className="text-lg font-bold mb-4">Registre-se no torneio</h3>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 flex gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Seu nome completo"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="seu@email.com"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Lado preferido</label>
        <div className="space-y-2">
          {(['RIGHT', 'LEFT', 'EITHER'] as const).map((opt) => (
            <label key={opt} className="flex items-center">
              <input
                type="radio"
                name="side"
                value={opt}
                checked={side === opt}
                onChange={(e) => setSide(e.target.value as any)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">
                {opt === 'RIGHT' && 'Direita'}
                {opt === 'LEFT' && 'Esquerda'}
                {opt === 'EITHER' && 'Flexível'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4 text-xs text-gray-500">
        Inscrições encerram em <strong>{daysLeft} dias</strong>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {loading ? 'Registrando...' : 'Registrar'}
      </button>
    </form>
  );
}
