import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Package,
  Search,
  Loader2,
  Link as LinkIcon,
  Truck,
  Copy,
  Check
} from 'lucide-react';
import {
  useAllTicketParts,
  useAddTicketPart,
  useUpdateTicketPart,
  useDeleteTicketPart,
  useTickets
} from '../lib/supabase-client';
import { formatPrice } from '../lib/utils-booking';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useDialog } from '@/components/ui/dialog-provider';

const PART_STATUS = {
  pending: { label: 'Pendiente de compra', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  purchased: { label: 'Comprado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  shipped: { label: 'En camino', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  received: { label: 'Recibido', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function AdminSpareParts() {
  const { data: parts = [], isLoading: loadingParts } = useAllTicketParts();
  const { data: tickets = [] } = useTickets();
  const addPartMutation = useAddTicketPart();
  const updatePartMutation = useUpdateTicketPart();
  const deletePartMutation = useDeleteTicketPart();
  const { showConfirm, showAlert } = useDialog();

  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ticketFilter, setTicketFilter] = useState('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredParts = parts.filter(part => {
    const matchesSearch = part.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.ticket?.appointment?.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || part.status === statusFilter;
    const matchesTicket = ticketFilter === 'all' || part.ticket_id === ticketFilter;

    return matchesSearch && matchesStatus && matchesTicket;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddPart = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newPart = {
      name: formData.get('name') as string,
      value: parseFloat(formData.get('value') as string) || 0,
      tracking_number: formData.get('tracking_number') as string,
      reference_link: formData.get('reference_link') as string,
      ticket_id: formData.get('ticket_id') as string,
      status: formData.get('status') as string || 'pending',
    };

    if (!newPart.ticket_id) {
      showAlert('Error', 'Debes seleccionar un ticket para asociar el repuesto.');
      return;
    }

    try {
      await addPartMutation.mutateAsync(newPart);
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Hubo un error al guardar el repuesto.');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await updatePartMutation.mutateAsync({ id, status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = (id: string) => {
    showConfirm(
      'Eliminar repuesto',
      '¿Estás seguro de eliminar este registro de seguimiento?',
      async () => {
        try {
          await deletePartMutation.mutateAsync(id);
        } catch (err) {
          console.error(err);
        }
      },
      'ELIMINAR'
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Seguimiento de Repuestos</h1>
          <p className="text-slate-500 font-medium">Control de pedidos y partes asociadas a reparaciones</p>
        </div>
        <Button 
          onClick={() => setIsAdding(true)} 
          className="bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest px-6"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Repuesto
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main List */}
        <div className="lg:col-span-12 space-y-4">
          <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Buscar por nombre, tracking o cliente..." 
                  className="pl-10 h-11 border-slate-200 rounded-xl"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <select 
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Todos los estados</option>
                  {Object.entries(PART_STATUS).map(([key, value]) => (
                    <option key={key} value={key}>{value.label}</option>
                  ))}
                </select>
                <select 
                  className="h-11 max-w-[200px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  value={ticketFilter}
                  onChange={(e) => setTicketFilter(e.target.value)}
                >
                  <option value="all">Todos los tickets</option>
                  {tickets.map(t => (
                    <option key={t.id} value={t.id}>#{t.appointment?.short_id} - {t.appointment?.customer_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loadingParts ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
            </div>
          ) : filteredParts.length === 0 ? (
            <Card className="border-dashed border-2 py-20 text-center">
              <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No se encontraron repuestos con los filtros aplicados.</p>
              <Button variant="link" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTicketFilter('all'); }}>Limpiar filtros</Button>
            </Card>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Repuesto</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket / Cliente</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Seguimiento</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Referencia</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredParts.map((part) => (
                      <tr key={part.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{part.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium italic">Agregado el {new Date(part.created_at).toLocaleDateString()}</p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-mono text-[9px] mb-1 bg-white">#{part.ticket?.appointment?.short_id}</Badge>
                          <p className="text-sm font-bold text-slate-700">{part.ticket?.appointment?.customer_name}</p>
                        </td>
                        <td className="px-6 py-4 text-sm font-black text-slate-900">
                          {formatPrice(part.value)}
                        </td>
                        <td className="px-6 py-4">
                          {part.tracking_number ? (
                            <div className="flex items-center gap-2 group/copy">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 w-fit font-mono font-bold">
                                <Truck className="w-3.5 h-3.5 text-slate-400" />
                                {part.tracking_number}
                              </div>
                              <button 
                                onClick={() => handleCopy(part.tracking_number!, part.id)}
                                className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-all active:scale-90"
                                title="Copiar tracking"
                              >
                                {copiedId === part.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">No asignado</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {part.reference_link ? (
                            <Button variant="outline" size="sm" asChild className="h-8 rounded-lg border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 gap-1.5 text-[10px] font-bold">
                              <a href={part.reference_link} target="_blank" rel="noreferrer">
                                <LinkIcon className="w-3 h-3" /> Ver Link
                              </a>
                            </Button>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">Sin link</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            className={`h-9 rounded-lg border px-3 text-[11px] font-bold uppercase tracking-wider outline-none transition-all cursor-pointer ${PART_STATUS[part.status as keyof typeof PART_STATUS]?.color || ''}`}
                            value={part.status}
                            onChange={(e) => handleUpdateStatus(part.id, e.target.value)}
                          >
                            {Object.entries(PART_STATUS).map(([key, value]) => (
                              <option key={key} value={key} className="bg-white text-slate-900 font-bold uppercase">{value.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            onClick={() => handleDelete(part.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Modal Añadir */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-lg shadow-2xl rounded-[32px] overflow-hidden border-none animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-white border-b border-slate-100 p-8">
              <CardTitle className="text-2xl font-black text-slate-900">Registrar Repuesto</CardTitle>
              <CardDescription className="font-medium text-slate-500">Ingresa los datos del componente para seguimiento</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddPart}>
              <CardContent className="p-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ticket_id" className="text-xs font-black text-slate-400 uppercase tracking-widest">Asociar a Ticket</Label>
                  <select 
                    id="ticket_id" 
                    name="ticket_id" 
                    required
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  >
                    <option value="">Selecciona un ticket...</option>
                    {tickets.map(t => (
                      <option key={t.id} value={t.id}>
                        #{t.appointment?.short_id} - {t.appointment?.customer_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-black text-slate-400 uppercase tracking-widest">Nombre del Repuesto</Label>
                  <Input id="name" name="name" required placeholder="Ej: Pantalla iPhone 13 OLED" className="h-12 rounded-xl border-slate-200" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-xs font-black text-slate-400 uppercase tracking-widest">Estado Inicial</Label>
                  <select 
                    id="status" 
                    name="status" 
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                  >
                    {Object.entries(PART_STATUS).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="value" className="text-xs font-black text-slate-400 uppercase tracking-widest">Valor Costo</Label>
                    <Input id="value" name="value" type="number" step="0.01" required placeholder="0.00" className="h-12 rounded-xl border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tracking_number" className="text-xs font-black text-slate-400 uppercase tracking-widest">Nº Seguimiento</Label>
                    <Input id="tracking_number" name="tracking_number" placeholder="Opcional" className="h-12 rounded-xl border-slate-200" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reference_link" className="text-xs font-black text-slate-400 uppercase tracking-widest">Link de Referencia</Label>
                  <Input id="reference_link" name="reference_link" placeholder="https://..." className="h-12 rounded-xl border-slate-200" />
                </div>
              </CardContent>
              <div className="p-8 bg-slate-50 border-t flex flex-row-reverse gap-4">
                <Button 
                  type="submit" 
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-14 font-bold uppercase tracking-widest text-xs rounded-2xl shadow-lg transition-all active:scale-95"
                  disabled={addPartMutation.isPending}
                >
                  {addPartMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Repuesto'}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsAdding(false)}
                  className="flex-1 h-14 font-bold text-slate-500 hover:bg-slate-200 rounded-2xl"
                >
                  CANCELAR
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
