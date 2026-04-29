import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicTracking } from '../lib/public-tracking-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar, CheckCircle, Clock, CreditCard, Shield, Wrench } from 'lucide-react';
import { formatPrice } from '../lib/utils-booking';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ReservationStatus() {
  const { appointment, ticket, setTrackingData } = usePublicTracking();
  const navigate = useNavigate();

  useEffect(() => {
    // Si no hay datos en el contexto, intentar cargarlos desde sessionStorage
    if (!appointment) {
      const stored = sessionStorage.getItem('trackingData');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTrackingData(parsed);
        } catch (e) {
          navigate('/track');
        }
      } else {
        navigate('/track');
      }
    }
  }, [appointment, navigate, setTrackingData]);

  if (!appointment) return null;

  const formatDate = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      return format(date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    } catch (e) {
      return isoString;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      return format(date, "HH:mm");
    } catch (e) {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-xl space-y-6">
        
        {/* Encabezado */}
        <div className="text-center space-y-2">
          <Badge variant="outline" className="bg-slate-900 text-white font-bold tracking-widest uppercase border-0 px-3 py-1 text-[10px]">
            Código #{appointment.short_id}
          </Badge>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Detalles de tu Reserva</h1>
          <p className="text-slate-500 font-medium text-sm">Estado e información de pago de tu agenda</p>
        </div>

        {/* Tarjeta Principal */}
        <Card className="border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden bg-white">
          <CardHeader className="p-6 bg-slate-900 text-white flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight">
                {appointment.paid ? 'Confirmada y Pagada' : 'Confirmada (Pago Pendiente)'}
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs font-medium">
                Reserva procesada mediante Flow
              </CardDescription>
            </div>
            {appointment.paid ? (
              <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-full shadow-inner animate-in zoom-in duration-300">
                <CheckCircle className="w-6 h-6" />
              </div>
            ) : (
              <div className="bg-amber-500/20 text-amber-400 p-2 rounded-full shadow-inner animate-in zoom-in duration-300">
                <Clock className="w-6 h-6" />
              </div>
            )}
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            
            {/* Detalles de Fecha y Hora */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="p-3 bg-white text-slate-700 rounded-xl shadow-sm border border-slate-100">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Fecha</p>
                  <p className="text-sm font-bold text-slate-800 capitalize">{formatDate(appointment.start_time)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="p-3 bg-white text-slate-700 rounded-xl shadow-sm border border-slate-100">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Horario</p>
                  <p className="text-sm font-bold text-slate-800">
                    {formatTime(appointment.start_time)} – {formatTime(appointment.end_time)}
                  </p>
                </div>
              </div>
            </div>

            {/* Información del Pago */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Información Financiera</h3>
              </div>
              <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-slate-700">Monto Abonado</p>
                  {appointment.flow_commerce_order && (
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Orden Flow: <span className="font-mono">{appointment.flow_commerce_order}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-slate-900">{formatPrice(appointment.amount || 0)}</p>
                  <Badge variant="outline" className={`mt-1 font-bold text-[9px] uppercase tracking-wide py-0.5 border-0 shadow-sm ${
                    appointment.paid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {appointment.paid ? 'Abonado' : 'Pendiente'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Botones de acción / Enlace al Ticket */}
            {ticket ? (
              <div className="border-t border-slate-100 pt-6 animate-in slide-in-from-bottom-2 duration-400">
                <Button 
                  onClick={() => navigate('/track/ticket')}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-2xl shadow-lg shadow-slate-900/20 group flex items-center justify-center gap-2"
                >
                  <Wrench className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  Ver Historial de Reparación y Ticket
                </Button>
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-6 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium bg-slate-50/50 rounded-2xl p-4 border border-dashed border-slate-200">
                <Shield className="w-4 h-4 opacity-40" />
                <span>La orden técnica aún no ha sido iniciada por el soporte</span>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Pie de página simple */}
        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Digital Solutions • Plataforma de Gestión
        </p>
      </div>
    </div>
  );
}
