import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  useTicketById, 
  useUpdateTicket, 
  useTicketFindings, 
  useAddTicketFinding, 
  useDeleteTicketFinding, 
  useTicketHistory, 
  useAddTicketHistory,
  sendBudgetEmail,
  supabase
} from '../lib/supabase-client';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import {
  ChevronLeft, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle,
  Camera,
  FileText, 
  Image as ImageIcon, 
  AlertCircle,
  Tag,
  Clock,
  User,
  Mail,
  Phone,
  Printer,
  Save,
  Wrench,
  Loader2
} from 'lucide-react';
import { formatPrice } from '../lib/utils-booking';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: ticket, isLoading: isLoadingTicket } = useTicketById(id);
  const { data: findings = [] } = useTicketFindings(id);
  const { data: history = [] } = useTicketHistory(id);
  
  const updateTicketMutation = useUpdateTicket();
  const addFindingMutation = useAddTicketFinding();
  const deleteFindingMutation = useDeleteTicketFinding();
  const addHistoryMutation = useAddTicketHistory();

  const [newFinding, setNewFinding] = useState({ description: '', price: '' });
  const [newHistory, setNewHistory] = useState({ description: '', evidence_url: '' });
  const [localDescription, setLocalDescription] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [activeView, setActiveView] = useState<'presupuesto' | 'reparacion'>('presupuesto');
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  
  const { showAlert, showError } = useDialog();

  // Sincronizar descripción local cuando cargue el ticket
  React.useEffect(() => {
    if (ticket && localDescription === null) {
      setLocalDescription(ticket.description || '');
    }
  }, [ticket, localDescription]);

  // Sincronizar la vista activa según el estado inicial
  React.useEffect(() => {
    if (ticket) {
      setActiveView(['evaluating', 'quoted'].includes(ticket.status) ? 'presupuesto' : 'reparacion');
    }
  }, [ticket?.status]);

  if (isLoadingTicket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Ticket no encontrado</h2>
        <Button onClick={() => navigate('/admin/tickets')} className="mt-4">Volver</Button>
      </div>
    );
  }

  const handleAddFinding = async () => {
    if (!newFinding.description || !newFinding.price) return;
    await addFindingMutation.mutateAsync({
      ticket_id: ticket.id,
      description: newFinding.description,
      price: parseFloat(newFinding.price)
    });
    setNewFinding({ description: '', price: '' });
    
    const servicePrice = ticket.appointment?.service?.price || 0;
    const newTotal = Math.max(0, (findings.reduce((acc, f) => acc + f.price, 0) + parseFloat(newFinding.price)) - servicePrice);
    updateTicketMutation.mutate({ id: ticket.id, total_budget: newTotal });
  };

  const handleDeleteFinding = async (findingId: string, findingPrice: number) => {
    await deleteFindingMutation.mutateAsync({ id: findingId, ticket_id: ticket.id });
    const servicePrice = ticket.appointment?.service?.price || 0;
    const newTotal = Math.max(0, (findings.reduce((acc, f) => acc + f.price, 0) - findingPrice) - servicePrice);
    updateTicketMutation.mutate({ id: ticket.id, total_budget: newTotal });
  };

  const handleAddHistory = async () => {
    if (!newHistory.description) return;
    await addHistoryMutation.mutateAsync({
      ticket_id: ticket.id,
      description: newHistory.description,
      evidence_url: newHistory.evidence_url || undefined
    });
    setNewHistory({ description: '', evidence_url: '' });
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

  const handleSaveDescription = () => {
    if (localDescription !== null) {
      updateTicketMutation.mutate({ id: ticket.id, description: localDescription });
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.7);
        };
      };
    });
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !ticket) return;
    setIsUploadingLocal(true);
    try {
      const compressedFile = await compressImage(file);
      const fileExt = compressedFile.name.split('.').pop() || 'jpg';
      const fileName = `${ticket.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('tickets')
        .upload(fileName, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tickets')
        .getPublicUrl(fileName);

      setNewHistory(prev => ({ ...prev, evidence_url: publicUrl }));
      showAlert('Foto Subida', 'La foto se ha guardado en el servidor y está lista para ser registrada.');
    } catch (err) {
      console.error(err);
      showError('Error de Carga', 'No se pudo subir la foto local.');
    } finally {
      setIsUploadingLocal(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    if (!ticket) return;
    setIsSending(true);
    try {
      const servicePrice = ticket.appointment?.service?.price || 0;
      const findingsTotal = findings.reduce((acc, f) => acc + f.price, 0);
      const success = await sendBudgetEmail({
        customerName: ticket.appointment?.customer_name || '',
        customerEmail: customEmail || ticket.appointment?.customer_email || '',
        shortId: ticket.appointment?.short_id || '',
        totalAmount: Math.max(0, findingsTotal - servicePrice),
        description: ticket.description || '',
        findings: findings,
        servicePrice: servicePrice
      });

      if (success) {
        updateTicketMutation.mutate({ id: ticket.id, status: 'quoted' });
        showAlert('Presupuesto Enviado', `El presupuesto del ticket #${ticket.appointment?.short_id} ha sido enviado correctamente al cliente.`);
      } else {
        showError('Error al Enviar', 'No pudimos enviar el presupuesto. Por favor, verifica tu conexión o configuración de Resend.');
      }
    } catch (err) {
      showError('Error Inesperado', 'Ocurrió un error al intentar procesar el envío.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/tickets')} className="rounded-xl border-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Ticket #{ticket.appointment?.short_id}</h1>
              <Badge className="bg-slate-900 text-white font-bold px-3 py-1 rounded-lg text-[10px] uppercase tracking-widest border-none">
                {getStatusLabel(ticket.status)}
              </Badge>
            </div>
            <p className="text-slate-500 font-medium flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" /> {ticket.appointment?.customer_name}
            </p>
          </div>
        </div>
        

      </div>

      {/* Visual Stepper */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
          {/* Progress Bar (hidden on mobile, connects nodes) */}
          <div className="hidden md:block absolute top-[18px] left-[5%] right-[5%] h-0.5 bg-slate-100 z-0" />
          
          {[
            { key: 'evaluating_quoted', label: 'Evaluación y presupuesto' },
            { key: 'repairing', label: 'Reparación' },
            { key: 'ready', label: 'Retiro' },
            { key: 'closed', label: 'Retirado' }
          ].map((step, index) => {
            const stepsMap: Record<string, number> = {
              evaluating: 0,
              quoted: 0,
              accepted: 1,
              repairing: 1,
              ready: 2,
              closed: 3,
              rejected: -1
            };
            const currentStepIndex = stepsMap[ticket.status] ?? 0;
            const isCompleted = stepsMap[ticket.status] === -1 ? false : index < currentStepIndex;
            const isActive = index === currentStepIndex;

            return (
              <div 
                key={step.key} 
                className="flex md:flex-col items-center gap-3 md:gap-2 z-10 w-full md:w-auto relative cursor-pointer group hover:opacity-80"
                onClick={() => {
                  if (step.key === 'evaluating_quoted') {
                    setActiveView('presupuesto');
                  } else {
                    setActiveView('reparacion');
                  }
                }}
              >
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                      : isActive 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-md ring-4 ring-slate-100' 
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                <div className="flex flex-col md:items-center">
                  <span className={`text-xs font-black uppercase tracking-wider ${isActive ? 'text-slate-900' : isCompleted ? 'text-slate-600' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Flujo de Trabajo Dinámico */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Phase 1: Evaluation & Budget */}
          {activeView === 'presupuesto' && (
            <Card className="border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Evaluación y Presupuesto</CardTitle>
                      <CardDescription>Detalla los hallazgos y costos del servicio</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Add Finding Form */}
                {['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl">
                    <div className="md:col-span-2">
                      <Input 
                        placeholder="Descripción del hallazgo..." 
                        value={newFinding.description}
                        onChange={(e) => setNewFinding({...newFinding, description: e.target.value})}
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <div>
                      <Input 
                        type="number" 
                        placeholder="Precio" 
                        value={newFinding.price}
                        onChange={(e) => setNewFinding({...newFinding, price: e.target.value})}
                        className="bg-white border-slate-200"
                      />
                    </div>
                    <Button onClick={handleAddFinding} className="bg-slate-900 hover:bg-slate-800 gap-2 font-bold uppercase text-[10px] tracking-widest h-10">
                      <Plus className="w-4 h-4" /> Agregar
                    </Button>
                  </div>
                )}

                {/* Findings Table */}
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                      <tr>
                        <th className="px-4 py-3 text-left">Hallazgo / Repuesto</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                        {['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) && <th className="px-4 py-3 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {findings.map((finding) => (
                        <tr key={finding.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4 font-medium text-slate-700">{finding.description}</td>
                          <td className="px-4 py-4 text-right font-black text-slate-900">{formatPrice(finding.price)}</td>
                          {['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) && (
                            <td className="px-4 py-4">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-slate-300 hover:text-red-500 h-8 w-8"
                                onClick={() => handleDeleteFinding(finding.id, finding.price)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {findings.length === 0 && (
                        <tr>
                          <td colSpan={['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) ? 3 : 2} className="px-4 py-10 text-center text-slate-400 italic">No hay hallazgos registrados aún.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/50">
                      <tr>
                        <td className="px-4 py-4 text-right font-bold text-slate-500 uppercase tracking-widest text-[10px]">Subtotal Reparación</td>
                        <td className="px-4 py-4 text-right font-black text-slate-900">{formatPrice(findings.reduce((acc, f) => acc + f.price, 0))}</td>
                        {['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) && <td></td>}
                      </tr>
                      <tr>
                        <td className="px-4 py-4 text-right font-bold text-blue-500 uppercase tracking-widest text-[10px]">Abono Evaluación (Se resta)</td>
                        <td className="px-4 py-4 text-right font-black text-blue-600">-{formatPrice(ticket.appointment?.service?.price || 0)}</td>
                        {['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) && <td></td>}
                      </tr>
                      <tr className="bg-slate-100/50">
                        <td className="px-4 py-4 text-right font-black text-slate-900 uppercase tracking-widest text-[10px]">Total Final a Pagar</td>
                        <td className="px-4 py-4 text-right text-xl font-black text-slate-900">
                          {formatPrice(Math.max(0, (findings.reduce((acc, f) => acc + f.price, 0)) - (ticket.appointment?.service?.price || 0)))}
                        </td>
                        {['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Phase 2: Repair History */}
          {activeView === 'reparacion' && (
            <Card className="border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Wrench className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Proceso de Reparación</CardTitle>
                      <CardDescription>Seguimiento e historial de trabajos realizados</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Add History Form */}
                {(ticket.status === 'accepted' || ticket.status === 'repairing') && (
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
                    {/* Add History Form */}
                    <div className="lg:col-span-6 bg-slate-50/50 border border-slate-100 p-6 rounded-2xl space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nuevo Avance</p>
                      <textarea 
                        className="w-full min-h-[80px] p-4 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm resize-none bg-white"
                        placeholder="Describe qué trabajo se realizó hoy..."
                        value={newHistory.description}
                        onChange={(e) => setNewHistory({...newHistory, description: e.target.value})}
                      />
                      <div className="flex gap-3 items-center">
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="local-upload" 
                          className="hidden" 
                          onChange={handleLocalFileChange}
                        />
                        <Button 
                          variant="outline" 
                          type="button"
                          disabled={isUploadingLocal}
                          className="flex-1 h-10 gap-2 border-dashed border-slate-200 text-[10px] font-bold rounded-xl tracking-widest uppercase"
                          onClick={() => document.getElementById('local-upload')?.click()}
                        >
                          {isUploadingLocal ? (
                            <><Loader2 className="w-4 h-4 animate-spin text-slate-400" /> Subiendo...</>
                          ) : newHistory.evidence_url ? (
                            <><CheckCircle className="w-4 h-4 text-emerald-500" /> Foto Lista</>
                          ) : (
                            <><Camera className="w-4 h-4 text-slate-500" /> Subir Foto Local</>
                          )}
                        </Button>
                        <Button 
                          className="bg-slate-900 hover:bg-slate-800 font-bold uppercase text-[10px] tracking-widest px-6 h-10"
                          disabled={!newHistory.description}
                          onClick={() => {
                            handleAddHistory();
                            if (ticket.status === 'accepted') {
                              updateTicketMutation.mutate({ id: ticket.id, status: 'repairing' });
                            }
                          }}
                        >
                          REGISTRAR
                        </Button>
                      </div>
                    </div>

                    {/* QR Code for Mobile Upload */}
                    <div className="lg:col-span-4 bg-slate-50 border border-slate-100 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                      <p className="text-xs font-bold text-slate-800 leading-tight max-w-[180px]">
                        Agrega evidencia desde tu celular. Escanea el QR
                      </p>
                      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm shrink-0 mt-1">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`${window.location.origin}/tickets/${ticket.id}/upload`)}`} 
                          alt="Código QR de subida" 
                          className="w-[100px] h-[100px]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="pt-6 border-t border-slate-100 mt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Historial de Evidencias y Avances</p>
                </div>
                <div className="relative pl-8 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {history.map((item) => (
                    <div key={item.id} className="relative">
                      <div className="absolute -left-[27px] top-1 w-[14px] h-[14px] rounded-full border-4 border-white bg-slate-300 z-10" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900">{format(parseISO(item.created_at), "d 'de' MMM, HH:mm", { locale: es })}</p>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                        {item.evidence_url && (
                          <div className="mt-3">
                            {(item.evidence_url.startsWith('data:image/') || item.evidence_url.match(/\.(jpeg|jpg|gif|png|webp)/i)) ? (
                              <div className="max-w-[125px] rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50 relative group transition-all duration-300 hover:shadow-md">
                                <img 
                                  src={item.evidence_url} 
                                  alt="Evidencia fotográfica" 
                                  className="w-full h-auto object-cover max-h-[100px] cursor-pointer"
                                  onClick={() => window.open(item.evidence_url, '_blank')}
                                />
                              </div>
                            ) : (
                              <a 
                                href={item.evidence_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                              >
                                <ImageIcon className="w-3 h-3" /> VER EVIDENCIA
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="text-center py-8 text-slate-400 italic text-sm">No hay avances registrados aún.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejected/Closed State Indicator */}
          {(ticket.status === 'rejected' || ticket.status === 'closed') && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <AlertCircle className={`w-8 h-8 mx-auto mb-3 ${ticket.status === 'rejected' ? 'text-red-400' : 'text-slate-400'}`} />
              <h2 className="text-lg font-black text-slate-900 uppercase">TICKET {ticket.status === 'rejected' ? 'RECHAZADO' : 'CERRADO'}</h2>
              <p className="text-slate-500 text-xs mt-1 font-medium">Este ticket ya no permite modificaciones operativas.</p>
            </div>
          )}
        </div>

        {/* Columna Derecha: Contexto del Ticket */}
        <div className="space-y-6">
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-sm uppercase tracking-widest font-black text-slate-400">Descripción General</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <textarea 
                className="w-full min-h-[150px] p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 outline-none transition-all text-sm resize-none bg-slate-50"
                placeholder="Describe el trabajo completo que se realizará..."
                value={localDescription ?? ''}
                onChange={(e) => setLocalDescription(e.target.value)}
                readOnly={['closed', 'ready', 'rejected'].includes(ticket.status)}
              />
              {localDescription !== ticket.description && (
                <div className="flex flex-col gap-2 mt-2 items-start">
                  <Button 
                    size="sm"
                    variant="outline" 
                    className="rounded-lg border-amber-200 bg-amber-50 text-amber-700 gap-2 font-bold text-xs hover:bg-amber-100 h-8 transition-all active:scale-95"
                    onClick={handleSaveDescription}
                    disabled={updateTicketMutation.isPending}
                  >
                    <Save className="w-3.5 h-3.5" /> GUARDAR DESCRIPCIÓN
                  </Button>
                  <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Tienes cambios sin guardar.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-sm uppercase tracking-widest font-black text-slate-400">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xl uppercase">
                  {ticket.appointment?.customer_name[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{ticket.appointment?.customer_name}</p>
                  <p className="text-xs text-slate-500">Cliente de Reserva #{ticket.appointment?.short_id}</p>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-slate-50">
                <p className="text-xs flex items-center gap-3 text-slate-600 font-medium">
                  <Mail className="w-4 h-4 text-slate-400" /> {ticket.appointment?.customer_email}
                </p>
                {ticket.appointment?.customer_phone && (
                  <p className="text-xs flex items-center gap-3 text-slate-600 font-medium">
                    <Phone className="w-4 h-4 text-slate-400" /> {ticket.appointment?.customer_phone}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-sm uppercase tracking-widest font-black text-slate-400">Detalles de Reserva</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> Servicio:</span>
                  <span className="font-bold text-slate-900">{ticket.appointment?.service?.name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Ingreso:</span>
                  <span className="font-bold text-slate-900">{ticket.appointment?.start_time ? format(parseISO(ticket.appointment.start_time), "dd/MM/yyyy", { locale: es }) : '---'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Estado:</span>
                  <Badge variant="outline" className="font-bold uppercase text-[9px] tracking-tighter">
                    {ticket.appointment?.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 px-6 md:px-8 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] print:hidden flex justify-between items-center">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">Acciones del Ticket</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button 
            variant="outline" 
            className="rounded-xl h-10 px-4 border-slate-200 gap-2 font-bold text-xs transition-all active:scale-95 hover:bg-slate-50 uppercase tracking-wide" 
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4" /> {activeView === 'reparacion' ? 'Resumen de Reparación' : 'Imprimir Presupuesto'}
          </Button>



          {ticket.status === 'evaluating' && findings.length > 0 && (
             <Button 
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 px-4 gap-2 font-bold text-xs transition-all active:scale-95"
                disabled={isSending}
                onClick={() => { setShowSendModal(true); setCustomEmail(ticket.appointment?.customer_email || ''); }}
             >
                <Save className="w-4 h-4" /> ENVIAR PRESUPUESTO
             </Button>
          )}

          {ticket.status === 'quoted' && (
             <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 gap-2 font-bold text-xs transition-all active:scale-95"
                disabled={updateTicketMutation.isPending}
                onClick={() => updateTicketMutation.mutate({ id: ticket.id, status: 'accepted' })}
             >
                <CheckCircle className="w-4 h-4" /> APROBAR PRESUPUESTO
             </Button>
          )}

          {(ticket.status === 'accepted' || ticket.status === 'repairing') && (
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 gap-2 font-bold text-xs transition-all active:scale-95"
              onClick={() => updateTicketMutation.mutate({ id: ticket.id, status: 'ready' })}
            >
              <CheckCircle className="w-4 h-4" /> MARCAR PENDIENTE DE RETIRO
            </Button>
          )}

          {ticket.status === 'ready' && (
             <Button 
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 px-4 gap-2 font-bold text-xs transition-all active:scale-95"
                onClick={() => updateTicketMutation.mutate({ id: ticket.id, status: 'closed' })}
             >
                <CheckCircle className="w-4 h-4" /> ENTREGAR EQUIPO (RETIRADO)
             </Button>
          )}
        </div>
      </div>

      {showSendModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in transition-all">
          <Card className="w-full max-w-md shadow-2xl border-t-8 border-slate-900 overflow-hidden rounded-2xl">
            <CardHeader className="bg-slate-50/80 border-b pb-6">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-900 p-1.5 rounded-lg text-white">
                      <FileText className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-xl font-black text-slate-900">Enviar Presupuesto</CardTitle>
                  </div>
                  <CardDescription className="text-xs font-medium text-slate-500">
                    Confirma los datos de envío al cliente
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setShowSendModal(false)}>
                  <XCircle className="w-6 h-6" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre del Cliente</label>
                  <p className="text-slate-900 font-bold p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                    {ticket.appointment?.customer_name}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Email de Envío</label>
                  <Input 
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl p-3 font-bold text-slate-900 text-sm h-11 mt-1"
                  />
                  <p className="text-[9px] font-medium text-slate-400 mt-1">Puedes modificar o agregar un email distinto para enviar el presupuesto.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <Button
                  variant="outline"
                  className="flex-1 h-12 border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95"
                  onClick={() => setShowSendModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2"
                  disabled={isSending}
                  onClick={async () => {
                    await handleSendEmail();
                    setShowSendModal(false);
                  }}
                >
                  {isSending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Confirmar y Enviar</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Estilos para Impresión de Presupuesto */}
      <style>{`
        @media print {
          @page { size: portrait; margin: 20mm; }
          body * { visibility: hidden; background: white !important; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print-hidden { display: none !important; }
          .card { border: none !important; box-shadow: none !important; }
        }
      `}</style>

      {/* Contenedor Invisible para Impresión */}
      <div className="hidden print:block print-area p-4 font-sans text-slate-900">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">Presupuesto Técnico</h1>
            <p className="text-lg font-bold text-slate-500">#{ticket.appointment?.short_id}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase">BookingPro</h2>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Servicio Técnico Especializado</p>
            <p className="text-xs font-medium text-slate-500">{format(new Date(), "dd 'de' MMMM, yyyy", { locale: es })}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-50 p-4 rounded-xl">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Datos del Cliente</h3>
            <p className="text-md font-bold">{ticket.appointment?.customer_name}</p>
            <p className="text-xs text-slate-600">{ticket.appointment?.customer_email}</p>
            <p className="text-xs text-slate-600">{ticket.appointment?.customer_phone}</p>
          </div>
          <div className="text-right bg-slate-50 p-4 rounded-xl">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Servicio Base</h3>
            <p className="text-md font-bold">{ticket.appointment?.service?.name}</p>
            <p className="text-xs text-slate-600">ID Reserva: {ticket.appointment?.id.slice(0,8)}</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción del Servicio</h3>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs leading-relaxed whitespace-pre-wrap italic">
            "{localDescription || ticket.description || 'Sin descripción detallada'}"
          </div>
        </div>

        {activeView === 'reparacion' && history.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Avances de la Reparación</h3>
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {history.map(item => (
                <div key={item.id} className="border-b border-slate-200/50 pb-2 last:border-0 last:pb-0 text-xs">
                  <span className="font-bold text-slate-600">{format(parseISO(item.created_at), "dd/MM HH:mm", { locale: es })}: </span>
                  <span className="text-slate-800">{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Detalle de Hallazgos</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-2 text-left font-black uppercase text-[10px]">Descripción</th>
                <th className="py-2 text-right font-black uppercase text-[10px]">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {findings.map(f => (
                <tr key={f.id}>
                  <td className="py-2 text-xs font-medium">{f.description}</td>
                  <td className="py-2 text-right text-xs font-bold">{formatPrice(f.price)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-300">
              <tr>
                <td className="py-2 text-right font-bold uppercase text-[9px]">Subtotal</td>
                <td className="py-2 text-right font-bold text-xs">{formatPrice(findings.reduce((acc, f) => acc + f.price, 0))}</td>
              </tr>
              <tr>
                <td className="py-2 text-right font-bold uppercase text-[9px] text-blue-600">Abono Evaluación (Deducido)</td>
                <td className="py-2 text-right font-bold text-xs text-blue-600">-{formatPrice(ticket.appointment?.service?.price || 0)}</td>
              </tr>
              <tr className="border-t-2 border-slate-900">
                <td className="py-4 text-right font-black uppercase text-sm">Total Final a Pagar</td>
                <td className="py-4 text-right font-black text-2xl">
                  {formatPrice(Math.max(0, (findings.reduce((acc, f) => acc + f.price, 0)) - (ticket.appointment?.service?.price || 0)))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center text-[9px] text-slate-400 uppercase tracking-[0.2em]">
          Este presupuesto es válido por 15 días - BookingPro System
        </div>
      </div>
    </div>
  );
}
