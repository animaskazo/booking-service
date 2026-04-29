import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function TrackReservation() {
  const [shortId, setShortId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/public-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ short_id: shortId, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Reserva no encontrada');
        return;
      }
      // Store data in sessionStorage to pass to next page
      sessionStorage.setItem('trackingData', JSON.stringify(data));
      navigate('/track/status');
    } catch (err) {
      setError('Error de red. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <Card className="w-full max-w-md p-6 space-y-4 shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-black text-center">Seguimiento de Reserva</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Código de reserva (6 dígitos)"
              value={shortId}
              onChange={(e) => setShortId(e.target.value)}
              required
            />
            <Input
              placeholder="Teléfono (ej: +56912345678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500">
              Ver estado
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
