import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Copy, 
  Smartphone, 
  ShieldCheck, 
  ArrowRight,
  Loader2
} from 'lucide-react';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Simulação de carregamento de processamento
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const pixKey = "00020126580014BR.GOV.BCB.PIX0136diretoria-padel-financeiro-1234567895204000053039865802BR5915Diretoria Padel6009Porto Alegre62070503***6304E1F2";

  const handleCopy = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center">
        <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-premium-accent animate-spin mx-auto" />
            <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Gerando seu Checkout Seguro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060606] text-white flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top,_rgba(153,204,51,0.05),_transparent_40%)]">
      <div className="w-full max-w-2xl space-y-8 animate-in zoom-in duration-700">
        
        <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-premium-accent/10 border border-premium-accent/20 rounded-full flex items-center justify-center mx-auto text-premium-accent shadow-[0_0_40px_rgba(153,204,51,0.2)]">
                <CheckCircle2 size={40} />
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter">Inscrição <span className="text-premium-accent">Quase Lá</span></h1>
            <p className="text-zinc-500 max-w-md mx-auto">Para garantir seu lugar no chaveamento oficial, realize o pagamento da taxa de inscrição abaixo.</p>
        </div>

        <div className="premium-card !p-0 overflow-hidden border-white/5 bg-white/[0.02]">
            <div className="p-8 border-b border-white/5 bg-white/[0.01]">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Torneio</p>
                        <p className="text-xl font-black italic uppercase">Copa Diretoria Padel</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Total a Pagar</p>
                        <p className="text-3xl font-black text-premium-accent italic tracking-tighter">R$ 85,00</p>
                    </div>
                </div>
            </div>

            <div className="p-8 flex flex-col md:flex-row items-center gap-10">
                <div className="w-48 h-48 bg-white p-2 rounded-3xl shrink-0 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                    <img 
                        src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=diretoria-padel-checkout" 
                        alt="PIX QR Code" 
                        className="w-full h-full object-contain"
                    />
                </div>
                <div className="flex-1 space-y-6 w-full">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pix Copia e Cola</label>
                        <div className="flex items-center gap-2">
                            <input 
                                readOnly 
                                value={pixKey}
                                className="flex-1 h-12 bg-black/40 border border-white/5 rounded-xl px-4 text-[10px] font-mono text-zinc-400 overflow-hidden text-ellipsis"
                            />
                            <button 
                                onClick={handleCopy}
                                className={`h-12 w-12 flex items-center justify-center rounded-xl transition-all ${copied ? 'bg-green-500 text-black' : 'bg-premium-accent text-black hover:scale-105'}`}
                            >
                                <Copy size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                            <Smartphone size={16} className="text-zinc-600 mb-2" />
                            <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Instruções</p>
                            <p className="text-[10px] text-white font-bold leading-tight">Abra o app do seu banco e escolha Pix.</p>
                        </div>
                        <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                            <ShieldCheck size={16} className="text-zinc-600 mb-2" />
                            <p className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Segurança</p>
                            <p className="text-[10px] text-white font-bold leading-tight">Transação segura via Banco Central.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-col items-center gap-6">
            <button 
                onClick={() => navigate('/publico')}
                className="btn-primary w-full h-16 text-lg group shadow-[0_20px_40px_rgba(153,204,51,0.1)]"
            >
                <span>Já fiz o pagamento! Ir para o Portal</span>
                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
            <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.3em]">Ambiente Seguro Diretoria Padel</p>
        </div>

      </div>
    </div>
  );
};

export default CheckoutPage;
