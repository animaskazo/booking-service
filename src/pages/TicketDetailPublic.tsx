import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePublicTracking } from '../lib/public-tracking-context';
import { useTicketById, useTicketFindings, useTicketHistory } from '../lib/supabase-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ArrowLeft, CheckCircle, FileText, Package, Wrench } from 'lucide-react';
import { formatPrice } from '../lib/utils-booking';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TicketDetailPublic() {
  const { appointment, ticket: contextTicket, setTrackingData } = usePublicTracking();
  const navigate = useNavigate();

  // Si no hay datos en el contexto, rehidratar de sessionStorage
  useEffect(() => {
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

  // Usar hooks para obtener datos en tiempo real
  const { data: ticket } = useTicketById(contextTicket?.id);
  const { data: findings = [] } = useTicketFindings(contextTicket?.id);
  const { data: history = [] } = useTicketHistory(contextTicket?.id);

  if (!appointment || !contextTicket) return null;

  // Si aún no carga el ticket live, usamos el del contexto
  const currentTicket = ticket || contextTicket;

  const formatDate = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      return format(date, "d 'de' MMMM, HH:mm'hrs'", { locale: es });
    } catch (e) {
      return isoString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'evaluating':
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200">En Evaluación</Badge>;
      case 'quoted':
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Presupuestado</Badge>;
      case 'accepted':
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Reparación Aceptada</Badge>;
      case 'rejected':
        return <Badge className="bg-red-50 text-red-700 border-red-200">Rechazado</Badge>;
      case 'repairing':
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">En Reparación</Badge>;
      case 'ready':
        return <Badge className="bg-emerald-600 text-white font-bold border-emerald-600 shadow-sm animate-pulse">Listo para Retiro</Badge>;
      case 'closed':
        return <Badge className="bg-slate-900 text-white border-0">Entregado / Cerrado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center animate-in fade-in duration-500">
      <div className="w-full max-w-2xl space-y-6">

        {/* Botón Volver */}
        <div className="flex justify-start">
          <Button
            variant="ghost"
            onClick={() => navigate('/track/status')}
            className="text-slate-500 font-bold text-xs gap-1.5 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Estado
          </Button>
        </div>

        {/* Notificación de Retiro si está listo */}
        {currentTicket.status === 'ready' && (
          <div className="bg-emerald-600 text-white p-5 rounded-3xl flex items-center gap-4 shadow-lg shadow-emerald-600/20 animate-in slide-in-from-top-4 duration-500">
            <div className="bg-white/20 p-3 rounded-full">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="font-black text-base">¡Listo para retiro!</h2>
              <p className="text-emerald-50 text-xs mt-0.5 leading-relaxed font-medium">
                La reparación se ha completado. Puedes acudir a retirar tu equipo indicando tu código.
              </p>
            </div>
          </div>
        )}

        {/* Resumen del Técnico / Diagnóstico */}
        {currentTicket.description && (
          <Card className="border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden bg-white animate-in fade-in duration-300">
            <CardHeader className="p-6 pb-3 border-b border-slate-100 flex flex-row items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <div>
                <CardTitle className="text-lg font-bold tracking-tight">Evaluación y Diagnóstico</CardTitle>
                <CardDescription className="text-xs text-slate-400 font-medium">Observaciones generales del servicio técnico</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-slate-50/30">
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium bg-slate-50 border border-slate-100 rounded-2xl p-4">
                {currentTicket.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Card de Presupuesto */}
        <Card className="border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden bg-white">
          <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" /> Detalle del Presupuesto
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 font-medium">
                Conceptos e ítems técnicos evaluados
              </CardDescription>
            </div>
            {getStatusBadge(currentTicket.status)}
          </CardHeader>

          <CardContent className="p-6">
            {findings.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4 font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                Aún no hay ítems asociados al presupuesto.
              </p>
            ) : (
              <div className="space-y-2">
                {findings.map((finding) => (
                  <div key={finding.id} className="flex justify-between items-center text-xs text-slate-600 border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                    <span className="font-medium">{finding.description}</span>
                    <span className="font-bold text-slate-800">{formatPrice(finding.price)}</span>
                  </div>
                ))}

                <div className="pt-3 mt-3 border-t border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>Subtotal Evaluado</span>
                    <span>{formatPrice(currentTicket.budget || currentTicket.total_budget || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-600 font-bold bg-emerald-50/50 px-2 py-1 rounded-lg">
                    <span>Abono Realizado</span>
                    <span>- {formatPrice(appointment.amount || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 font-bold text-slate-900">
                    <span className="text-sm">Saldo Pendiente</span>
                    <span className="text-lg text-slate-950 font-black">
                      {formatPrice(Math.max(0, (currentTicket.budget || currentTicket.total_budget || 0) - (appointment.amount || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Historial */}
        <Card className="border border-slate-100 shadow-xl shadow-slate-200/40 rounded-3xl overflow-hidden bg-white">
          <CardHeader className="p-6 border-b border-slate-100">
            <CardTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Wrench className="w-5 h-5 text-slate-400" /> Historial de Reparación y Evidencias
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 font-medium">
              Cronología de actividades realizadas por el equipo técnico
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            {history.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4 font-medium border-2 border-dashed border-slate-100 rounded-2xl">
                Aún no hay avances reportados.
              </p>
            ) : (
              <div className="relative border-l border-slate-100 pl-6 ml-3 space-y-6">
                {history.map((step) => (
                  <div key={step.id} className="relative animate-in fade-in slide-in-from-left-2 duration-300">
                    {/* Punto indicador */}
                    <div className="absolute -left-[30px] top-1.5 w-3 h-3 bg-slate-900 rounded-full border-4 border-white shadow-sm flex-none" />

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        {step.created_at && formatDate(step.created_at)}
                      </p>
                      <p className="text-sm text-slate-700 font-medium leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
