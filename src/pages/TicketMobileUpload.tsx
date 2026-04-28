import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, CheckCircle, Loader2, Image as ImageIcon } from 'lucide-react';

export default function TicketMobileUpload() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    async function loadTicket() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, appointment:appointments(*, service:services(*))')
          .eq('id', id)
          .maybeSingle();

        if (error) throw error;
        setTicket(data);
      } catch (err) {
        console.error('Error cargando ticket:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTicket();
  }, [id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Image(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!id || !base64Image) return;
    setIsUploading(true);
    try {
      const { error } = await supabase
        .from('ticket_history')
        .insert([
          {
            ticket_id: id,
            description: description || 'Evidencia cargada desde dispositivo móvil',
            evidence_url: base64Image
          }
        ]);

      if (error) throw error;

      // Si el ticket está en estado 'accepted', pasarlo a 'repairing'
      if (ticket && ticket.status === 'accepted') {
        await supabase
          .from('tickets')
          .update({ status: 'repairing' })
          .eq('id', id);
      }

      setUploadSuccess(true);
    } catch (err) {
      console.error('Error al subir evidencia:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-slate-400 font-medium">No se encontró el ticket.</p>
        </div>
      </div>
    );
  }

  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-xl rounded-2xl p-6 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-black uppercase tracking-wider text-slate-100">¡Foto Guardada!</h2>
          <p className="text-slate-400 text-xs mt-2 font-medium">La evidencia ha sido vinculada correctamente al historial del ticket.</p>
          <Button 
            className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
            onClick={() => {
              setBase64Image(null);
              setDescription('');
              setUploadSuccess(false);
            }}
          >
            Subir otra foto
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="bg-slate-900/40 border-b border-slate-800/50 pb-6 text-center">
          <div className="inline-flex bg-slate-800/80 p-3 rounded-2xl mb-3 border border-slate-700/30">
            <Camera className="w-6 h-6 text-slate-300" />
          </div>
          <CardTitle className="text-xl font-black tracking-wide text-slate-100 uppercase">
            Subir Evidencia
          </CardTitle>
          <CardDescription className="text-xs text-slate-400 font-medium mt-1">
            Ticket #{ticket.appointment?.short_id} - {ticket.appointment?.customer_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Foto del Trabajo</Label>
            
            {!base64Image ? (
              <div className="border-2 border-dashed border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-500 hover:text-slate-400 hover:border-slate-700 transition-all bg-slate-900/50 relative">
                <ImageIcon className="w-10 h-10 mb-2 stroke-1" />
                <span className="text-xs font-bold uppercase tracking-widest text-[9px]">Capturar imagen</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex justify-center items-center">
                <img 
                  src={base64Image} 
                  alt="Previsualización" 
                  className="max-h-[250px] object-cover"
                />
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="absolute top-2 right-2 rounded-xl text-[10px] h-7 font-bold uppercase tracking-wider shadow-md"
                  onClick={() => setBase64Image(null)}
                >
                  Cambiar
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nota de Avance (Opcional)</Label>
            <Input 
              placeholder="Ej: Desmontaje de componentes..." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-200 focus:ring-slate-700 placeholder-slate-600 rounded-xl h-12 text-sm"
            />
          </div>

          <Button 
            className="w-full h-12 bg-slate-100 hover:bg-white text-slate-950 font-black tracking-wider uppercase text-xs rounded-2xl transition-all disabled:bg-slate-800 disabled:text-slate-600 active:scale-95 flex items-center justify-center gap-2"
            disabled={isUploading || !base64Image}
            onClick={handleUpload}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                Subiendo...
              </>
            ) : (
              'Guardar Evidencia'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
