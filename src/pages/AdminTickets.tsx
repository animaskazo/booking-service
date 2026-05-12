import { useState } from 'react';
import { useTickets } from '../lib/supabase-client';
import { formatPrice } from '../lib/utils-booking';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Clock, ChevronRight, LayoutGrid, List } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const KANBAN_STATUSES = [
  { id: 'evaluating', label: 'Evaluación', color: 'border-t-blue-500' },
  { id: 'accepted', label: 'Aprobado', color: 'border-t-emerald-500' },
  { id: 'repairing', label: 'Reparación', color: 'border-t-purple-500' },
  { id: 'ready', label: 'Retiro', color: 'border-t-green-500' },
  { id: 'closed', label: 'Finalizado', color: 'border-t-slate-300' }
];

export default function AdminTickets() {
  const { data: tickets = [], isLoading } = useTickets();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'evaluating': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'quoted': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'accepted': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'repairing': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'ready': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'evaluating': return 'Pendiente de Evaluación';
      case 'quoted': return 'En Presupuesto';
      case 'accepted': return 'Reparación';
      case 'rejected': return 'Rechazado';
      case 'repairing': return 'Reparación';
      case 'ready': return 'Pendiente de Retiro';
      case 'closed': return 'Retirado';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tickets de Soporte</h1>
          <p className="text-slate-500 font-medium">Gestiona el proceso de reparación técnica</p>
        </div>

        <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
          <button 
            onClick={() => setViewMode('kanban')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <LayoutGrid className="w-4 h-4" /> Columnas
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <List className="w-4 h-4" /> Lista
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="grid gap-4">
          {tickets.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-20 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No hay tickets generados aún.</p>
              <p className="text-sm text-slate-400">Genera uno desde el detalle de una cita confirmada.</p>
            </div>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket.id} className="overflow-hidden hover:shadow-md transition-all border-slate-200">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-center">
                    <div className="p-6 flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant="outline" className="font-mono text-xs bg-slate-50">#{ticket.appointment?.short_id}</Badge>
                        <Badge className={`${getStatusColor(ticket.status)} border shadow-none font-bold uppercase text-[10px]`}>
                          {getStatusLabel(ticket.status)}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{ticket.appointment?.customer_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5 font-bold px-2 py-0.5 rounded-md text-xs border" style={{ backgroundColor: ticket.appointment?.service?.color ? `${ticket.appointment.service.color}15` : '#f1f5f9', color: ticket.appointment?.service?.color || '#475569', borderColor: ticket.appointment?.service?.color ? `${ticket.appointment.service.color}30` : '#e2e8f0' }}>
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ticket.appointment?.service?.color || '#475569' }} />
                          {ticket.appointment?.service?.name}
                        </div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-4 h-4" /> {new Date(ticket.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 md:bg-transparent p-6 flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 md:border-l border-slate-100">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presupuesto</p>
                        <p className="text-xl font-black text-slate-900">{formatPrice(ticket.total_budget || 0)}</p>
                      </div>
                      <Button asChild className="bg-slate-900 hover:bg-slate-800 rounded-xl px-6">
                        <Link to={`/admin/tickets/${ticket.id}`} className="flex items-center gap-2">
                          Gestionar <ChevronRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="flex gap-3 h-[calc(100vh-180px)] min-w-min">
          {KANBAN_STATUSES.map(col => {
            const colTickets = tickets.filter(t => {
              if (col.id === 'repairing' && (t.status === 'accepted' || t.status === 'repairing')) return true;
              return t.status === col.id;
            });

            return (
              <div key={col.id} className="flex-1 min-w-[180px] flex flex-col gap-2">
                <div className={`p-2 bg-slate-50 rounded-lg border-t-2 ${col.color} flex items-center justify-between sticky top-0 z-10`}>
                  <h3 className="font-black text-slate-900 uppercase text-[9px] tracking-widest truncate">{col.label}</h3>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-bold text-[9px] h-4 px-1.5">{colTickets.length}</Badge>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-hide">
                  {colTickets.map(ticket => (
                    <Card 
                      key={ticket.id} 
                      className="border-slate-200 hover:border-slate-900 hover:shadow-sm transition-all cursor-pointer group relative overflow-hidden" 
                      onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                    >
                      <div 
                        className="absolute left-0 top-0 bottom-0 w-1" 
                        style={{ backgroundColor: ticket.appointment?.service?.color || '#cbd5e1' }}
                      />
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold text-slate-400">#{ticket.appointment?.short_id}</span>
                          <span className="text-[9px] text-slate-400 font-bold">{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        <h4 className="font-bold text-slate-900 text-xs group-hover:text-blue-600 transition-colors line-clamp-1">
                          {ticket.appointment?.customer_name}
                        </h4>
                        
                        <div className="flex items-center justify-between items-end mt-1">
                          <div className="text-[9px] font-bold text-slate-500 line-clamp-1 max-w-[100px]">
                            {ticket.appointment?.service?.name}
                          </div>
                          <p className="text-xs font-black text-slate-900">{formatPrice(ticket.total_budget || 0)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {colTickets.length === 0 && (
                    <div className="h-16 border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center">
                      <p className="text-[9px] font-bold text-slate-200 uppercase tracking-widest">Vacío</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
