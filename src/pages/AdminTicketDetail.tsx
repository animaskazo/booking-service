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
  useTicketParts,
  useAddTicketPart,
  useUpdateTicketPart,
  useDeleteTicketPart,
  sendBudgetEmail,
  sendReadyEmail,
  supabase,
  useBusinessSettings,
  useTicketPaymentLinks,
  useAddManualPayment,
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
  Loader2,
  Package,
  Truck,
  ExternalLink,
  CreditCard,
  Copy,
  Link,
  ArrowUpCircle,
  Info,
  Pencil,
  X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatPrice } from '../lib/utils-booking';
const PART_STATUS = {
  pending: { label: 'Pendiente de compra', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  purchased: { label: 'Comprado', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  shipped: { label: 'En camino', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  received: { label: 'Recibido', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function AdminTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: bSettings = { notification_email: 'contacto@powerfix.cl' } } = useBusinessSettings();
  
  const { data: ticket, isLoading: isLoadingTicket } = useTicketById(id);
  const { data: findings = [] } = useTicketFindings(id);
  const { data: history = [] } = useTicketHistory(id);
  const { data: ticketParts = [] } = useTicketParts(id);
  const { data: paymentLinks = [] } = useTicketPaymentLinks(id);
  
  const updateTicketMutation = useUpdateTicket();
  const addFindingMutation = useAddTicketFinding();
  const deleteFindingMutation = useDeleteTicketFinding();
  const addHistoryMutation = useAddTicketHistory();
  const addPartMutation = useAddTicketPart();
  const updatePartMutation = useUpdateTicketPart();
  const deletePartMutation = useDeleteTicketPart();

  const [newFinding, setNewFinding] = useState({ description: '', price: '' });
  const [newHistory, setNewHistory] = useState({ description: '', evidence_url: '' });
  const [localDescription, setLocalDescription] = useState<string | null>(null);
  const [deviceForm, setDeviceForm] = useState<{ device_model: string; reported_issue: string; serial_number: string; device_password: string } | null>(null);
  const [editingDevice, setEditingDevice] = useState(false);
  const isDeviceLocked = ['closed', 'ready', 'rejected'].includes(ticket?.status ?? '');
  const [isSending, setIsSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [activeView, setActiveView] = useState<'presupuesto' | 'reparacion' | 'repuestos'>('presupuesto');
  const [newPart, setNewPart] = useState({ name: '', value: '', tracking: '', link: '', status: 'pending' });
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);

  // Payment link modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ description: '', amount: '' });
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [paymentEmail, setPaymentEmail] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isSendingPaymentEmail, setIsSendingPaymentEmail] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Transfer modal state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ description: '', amount: '', paid_at: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
  const addManualPaymentMutation = useAddManualPayment();
  
  const { showAlert, showError } = useDialog();

  // Sincronizar descripción local cuando cargue el ticket
  React.useEffect(() => {
    if (ticket && localDescription === null) {
      setLocalDescription(ticket.description || '');
    }
  }, [ticket, localDescription]);

  // Sincronizar ficha del equipo (Modelo, Falla, Serie, Password)
  React.useEffect(() => {
    if (ticket && deviceForm === null) {
      setDeviceForm({
        device_model: ticket.device_model || '',
        reported_issue: ticket.reported_issue || (ticket.appointment as any)?.notes || '',
        serial_number: ticket.serial_number || '',
        device_password: ticket.device_password || '',
      });
    }
  }, [ticket, deviceForm]);

  // Sincronizar la vista activa según el estado inicial
  React.useEffect(() => {
    if (ticket) {
      setActiveView(['evaluating', 'quoted'].includes(ticket.status) ? 'presupuesto' : 'reparacion');
    }
  }, [ticket?.status]);

  // El aviso de "listo para retiro" se envía al momento de la transición a 'ready'
  // (botón MARCAR PENDIENTE DE RETIRO), no al abrir el detalle.

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
  
  const handleAddPart = async () => {
    if (!newPart.name || !newPart.value || !id) return;
    await addPartMutation.mutateAsync({
      ticket_id: id,
      name: newPart.name,
      value: parseFloat(newPart.value),
      tracking_number: newPart.tracking,
      reference_link: newPart.link,
      status: newPart.status
    });
    setNewPart({ name: '', value: '', tracking: '', link: '', status: 'pending' });
  };

  const handleUpdatePartStatus = async (partId: string, newStatus: string) => {
    await updatePartMutation.mutateAsync({ id: partId, status: newStatus });
  };

  const handleDeletePart = async (partId: string) => {
    await deletePartMutation.mutateAsync(partId);
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

  const isDeviceDirty = deviceForm !== null && (
    (deviceForm.device_model || '') !== (ticket.device_model || '') ||
    (deviceForm.reported_issue || '') !== (ticket.reported_issue || '') ||
    (deviceForm.serial_number || '') !== (ticket.serial_number || '') ||
    (deviceForm.device_password || '') !== (ticket.device_password || '')
  );

  const handleSaveDevice = () => {
    if (!deviceForm) return;
    updateTicketMutation.mutate(
      {
        id: ticket.id,
        device_model: deviceForm.device_model || null,
        reported_issue: deviceForm.reported_issue || null,
        serial_number: deviceForm.serial_number || null,
        device_password: deviceForm.device_password || null,
      } as any,
      {
        onSuccess: () => setEditingDevice(false),
        onError: () => showError(
          'No se pudo guardar',
          'Es probable que falte ejecutar la migración SQL (sql/tickets_device_fields_migration.sql) en Supabase.'
        ),
      }
    );
  };

  const handleCancelDeviceEdit = () => {
    setDeviceForm({
      device_model: ticket.device_model || '',
      reported_issue: ticket.reported_issue || (ticket.appointment as any)?.notes || '',
      serial_number: ticket.serial_number || '',
      device_password: ticket.device_password || '',
    });
    setEditingDevice(false);
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
        customerPhone: ticket.appointment?.customer_phone || '',
        shortId: ticket.appointment?.short_id || '',
        totalAmount: Math.max(0, findingsTotal - servicePrice),
        description: ticket.description || '',
        findings: findings,
        servicePrice: servicePrice,
        techSupportEmail: bSettings?.notification_email || 'contacto@powerfix.cl'
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

  const handleCreatePaymentLink = async () => {
    if (!ticket || !paymentForm.description || !paymentForm.amount) return;
    setIsCreatingLink(true);
    try {
      const res = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/create-ticket-payment-link`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticket_id: ticket.id,
            description: paymentForm.description,
            amount: parseFloat(paymentForm.amount),
            customer_email: paymentEmail || ticket.appointment?.customer_email || '',
            customer_name: ticket.appointment?.customer_name || '',
            short_id: ticket.appointment?.short_id || '',
          }),
        }
      );
      const data = await res.json();
      if (data.paymentUrl) {
        setPaymentLink(data.paymentUrl);
      } else {
        showError('Error al crear link', data.error || 'No se pudo generar el link de pago en Flow.');
      }
    } catch (err) {
      showError('Error inesperado', 'No se pudo conectar con el servidor de pagos.');
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleSendPaymentEmail = async () => {
    if (!ticket || !paymentLink) return;
    setIsSendingPaymentEmail(true);
    try {
      const res = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/send-payment-link-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: ticket.appointment?.customer_name || '',
            customer_email: paymentEmail || ticket.appointment?.customer_email || '',
            short_id: ticket.appointment?.short_id || '',
            description: paymentForm.description,
            amount: parseFloat(paymentForm.amount),
            payment_url: paymentLink,
            tech_support_email: bSettings?.notification_email || 'contacto@powerfix.cl',
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        showAlert('Email Enviado', `El link de pago fue enviado correctamente a ${paymentEmail || ticket.appointment?.customer_email}.`);
        setShowPaymentModal(false);
        setPaymentForm({ description: '', amount: '' });
        setPaymentLink(null);
        setLinkCopied(false);
      } else {
        showError('Error al enviar', data.error || 'No se pudo enviar el correo.');
      }
    } catch (err) {
      showError('Error inesperado', 'No se pudo conectar con el servidor de correo.');
    } finally {
      setIsSendingPaymentEmail(false);
    }
  };

  const handleCopyLink = () => {
    if (!paymentLink) return;
    navigator.clipboard.writeText(paymentLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleAddTransfer = async () => {
    if (!ticket || !transferForm.description || !transferForm.amount) return;
    try {
      await addManualPaymentMutation.mutateAsync({
        ticket_id: ticket.id,
        description: transferForm.description,
        amount: parseFloat(transferForm.amount),
        paid_at: new Date(transferForm.paid_at).toISOString(),
      });
      showAlert('Abono Registrado', 'La transferencia se ha registrado exitosamente.');
      setShowTransferModal(false);
      setTransferForm({ description: '', amount: '', paid_at: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
    } catch (err) {
      showError('Error al registrar', 'No se pudo registrar la transferencia.');
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

          {/* Phase 3: Spare Parts Tracking */}
          {activeView === 'reparacion' && (
            <Card className="border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg">
                      <Package className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Seguimiento de Repuestos</CardTitle>
                      <CardDescription>Control de partes y componentes para esta reparación</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                
                {/* Add Part Form */}
                {['evaluating', 'quoted', 'accepted', 'repairing'].includes(ticket.status) && (
                  <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre Repuesto</label>
                        <Input 
                          placeholder="Ej: Batería Original" 
                          value={newPart.name}
                          onChange={(e) => setNewPart({...newPart, name: e.target.value})}
                          className="bg-white border-slate-200 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Costo</label>
                        <Input 
                          type="number"
                          placeholder="0" 
                          value={newPart.value}
                          onChange={(e) => setNewPart({...newPart, value: e.target.value})}
                          className="bg-white border-slate-200 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº Seguimiento</label>
                        <Input 
                          placeholder="Tracking ID" 
                          value={newPart.tracking}
                          onChange={(e) => setNewPart({...newPart, tracking: e.target.value})}
                          className="bg-white border-slate-200 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Link Referencia</label>
                        <Input 
                          placeholder="https://..." 
                          value={newPart.link}
                          onChange={(e) => setNewPart({...newPart, link: e.target.value})}
                          className="bg-white border-slate-200 h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado Inicial</label>
                        <select 
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none transition-all"
                          value={newPart.status}
                          onChange={(e) => setNewPart({...newPart, status: e.target.value})}
                        >
                          {Object.entries(PART_STATUS).map(([key, value]) => (
                            <option key={key} value={key}>{value.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button 
                      onClick={handleAddPart} 
                      className="w-full bg-slate-900 hover:bg-slate-800 gap-2 font-bold uppercase text-xs tracking-widest h-12 rounded-xl"
                      disabled={!newPart.name || !newPart.value}
                    >
                      <Plus className="w-4 h-4" /> AGREGAR REPUESTO
                    </Button>
                  </div>
                )}

                {/* Parts List */}
                <div className="space-y-4">
                  {ticketParts.map((part) => (
                    <div key={part.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:shadow-sm transition-all">
                      <div className="flex items-start gap-4">
                        <div className="bg-slate-100 p-2.5 rounded-xl">
                          <Package className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${PART_STATUS[part.status as keyof typeof PART_STATUS]?.color || ''} border shadow-none font-bold uppercase text-[9px]`}>
                              {PART_STATUS[part.status as keyof typeof PART_STATUS]?.label || part.status}
                            </Badge>
                          </div>
                          <h4 className="font-bold text-slate-900">{part.name}</h4>
                          <div className="flex flex-wrap gap-3 mt-1">
                            <span className="text-xs font-black text-emerald-600">{formatPrice(part.value)}</span>
                            {part.tracking_number && (
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                                <Truck className="w-3 h-3" /> {part.tracking_number}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 mt-3">
                            {Object.entries(PART_STATUS).map(([key, _]) => (
                              <button
                                key={key}
                                onClick={() => handleUpdatePartStatus(part.id, key)}
                                className={`px-2 py-1 rounded-md text-[8px] font-bold border transition-all ${part.status === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                              >
                                {key === 'pending' ? 'Pendiente' : key === 'purchased' ? 'Comprado' : key === 'shipped' ? 'En camino' : 'Recibido'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50">
                        {part.reference_link && (
                          <Button variant="outline" size="sm" asChild className="h-9 rounded-lg border-slate-200 gap-2 text-xs font-bold">
                            <a href={part.reference_link} target="_blank" rel="noreferrer">
                              <ExternalLink className="w-3.5 h-3.5" /> Ver Link
                            </a>
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-slate-300 hover:text-red-500 hover:bg-red-50"
                          onClick={() => handleDeletePart(part.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {ticketParts.length === 0 && (
                    <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-medium italic">No hay repuestos registrados para este ticket.</p>
                    </div>
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
          {/* ── Ficha del equipo: Modelo, Falla, N° Serie, Password ── */}
          <Card className="border-slate-200 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm uppercase tracking-widest font-black text-slate-400">Datos del Equipo</CardTitle>
                {!isDeviceLocked && (
                  <div className="flex items-center gap-1">
                    {editingDevice && (
                      <button
                        type="button"
                        title="Cancelar edición"
                        onClick={handleCancelDeviceEdit}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <Button
                      variant={editingDevice ? 'default' : 'ghost'}
                      size="sm"
                      title={editingDevice ? 'Guardar datos del equipo' : 'Editar datos del equipo'}
                      className={`h-7 px-2.5 rounded-lg gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 ${editingDevice ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                      onClick={() => (editingDevice ? handleSaveDevice() : setEditingDevice(true))}
                      disabled={editingDevice && (!isDeviceDirty || updateTicketMutation.isPending)}
                    >
                      {editingDevice ? <Save className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                      {editingDevice ? 'Guardar' : 'Editar'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modelo</label>
                <Input
                  placeholder="Ej: MacBook Pro 14 M3 / RTX 4070 / PS5"
                  value={deviceForm?.device_model ?? ''}
                  onChange={(e) => setDeviceForm(prev => prev ? { ...prev, device_model: e.target.value } : prev)}
                  disabled={!editingDevice || isDeviceLocked}
                  className="bg-slate-50 border-slate-200 disabled:opacity-100 disabled:cursor-default"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Falla reportada</label>
                <textarea
                  className="w-full min-h-[80px] p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm resize-none bg-slate-50 disabled:opacity-100 disabled:cursor-default"
                  placeholder="Ej: No enciende, se calienta y se apaga..."
                  value={deviceForm?.reported_issue ?? ''}
                  onChange={(e) => setDeviceForm(prev => prev ? { ...prev, reported_issue: e.target.value } : prev)}
                  disabled={!editingDevice || isDeviceLocked}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">N° de Serie</label>
                  <Input
                    placeholder="Ej: C02XG0KGJHD3"
                    value={deviceForm?.serial_number ?? ''}
                    onChange={(e) => setDeviceForm(prev => prev ? { ...prev, serial_number: e.target.value } : prev)}
                    disabled={!editingDevice || isDeviceLocked}
                    className="bg-slate-50 border-slate-200 font-mono disabled:opacity-100 disabled:cursor-default"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password del equipo</label>
                  <Input
                    placeholder="Clave / PIN / patrón"
                    value={deviceForm?.device_password ?? ''}
                    onChange={(e) => setDeviceForm(prev => prev ? { ...prev, device_password: e.target.value } : prev)}
                    disabled={!editingDevice || isDeviceLocked}
                    className="bg-slate-50 border-slate-200 font-mono disabled:opacity-100 disabled:cursor-default"
                  />
                </div>
              </div>
              {editingDevice && isDeviceDirty && (
                <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5 pt-1">
                  <AlertCircle className="w-3 h-3" /> Tienes cambios sin guardar.
                </p>
              )}
            </CardContent>
          </Card>

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

          {/* ── Resumen Financiero — visible después de aprobar presupuesto ── */}
          {['accepted', 'repairing', 'ready', 'closed'].includes(ticket.status) && findings.length > 0 && (() => {
            const subtotal = findings.reduce((acc, f) => acc + f.price, 0);
            const servicePrice = ticket.appointment?.service?.price || 0;
            const isExpress = ticket.appointment?.service?.name?.toLowerCase().includes('express');
            const abonoInicial = isExpress ? 0 : servicePrice;
            const abonosPagados = paymentLinks
              .filter(pl => pl.status === 'paid')
              .reduce((acc, pl) => acc + pl.amount, 0);
            const saldoPendiente = Math.max(0, subtotal - abonoInicial - abonosPagados);
            const fmt = (n: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

            return (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 rounded-t-[inherit]">
                  <CardTitle className="text-sm uppercase tracking-widest font-black text-slate-400">Resumen Financiero</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Ítems */}
                  <div className="divide-y divide-slate-50">

                    {/* Total reparación */}
                    <div className="flex justify-between items-center px-5 py-3">
                      <span className="text-xs text-slate-500 font-medium">Total reparación</span>
                      <span className="text-sm font-bold text-slate-800">{fmt(subtotal)}</span>
                    </div>

                    {/* Abono inicial */}
                    {servicePrice > 0 && (
                      <div className="flex justify-between items-center px-5 py-3">
                        <span className="text-xs font-medium flex items-center gap-1.5 text-slate-500">
                          {isExpress ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Tarifa express (no descuenta)</>
                          ) : (
                            <><span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" /> Abono inicial (evaluación)</>
                          )}
                        </span>
                        <span className={`text-sm font-bold ${isExpress ? 'text-amber-600' : 'text-blue-600'}`}>
                          {isExpress ? '' : '−'}{fmt(servicePrice)}
                        </span>
                      </div>
                    )}

                    {/* Abonos posteriores vía link */}
                    {paymentLinks.filter(pl => pl.status === 'paid').map(pl => (
                      <div key={pl.id} className="flex justify-between items-start px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-default border-b border-slate-50 last:border-0 focus-within:relative focus-within:z-50">
                        <div className="space-y-0.5">
                          <span className="text-xs font-medium flex items-center gap-1.5 text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            Abono pagado
                            {pl.paid_at && (
                              <button type="button" className="relative group/info ml-1 flex items-center outline-none">
                                <Info className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer" />
                                {/* Tooltip UP */}
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-focus/info:opacity-100 group-focus/info:translate-y-0">
                                  Pagado el {format(parseISO(pl.paid_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                                  {pl.flow_order && <> · Flow #{pl.flow_order}</>}
                                  {/* Arrow */}
                                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                </span>
                              </button>
                            )}
                          </span>
                          <p className="text-[10px] text-slate-400 font-medium pl-3">{pl.description}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-600 shrink-0 ml-4">−{fmt(pl.amount)}</span>
                      </div>
                    ))}

                    {/* Links pendientes */}
                    {paymentLinks.filter(pl => pl.status === 'pending').map(pl => (
                      <div key={pl.id} className="flex justify-between items-start px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-default border-b border-slate-50 last:border-0 focus-within:relative focus-within:z-50">
                        <div className="space-y-0.5">
                          <span className="text-xs font-medium flex items-center gap-1.5 text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            Esperando pago
                            <button type="button" className="relative group/info ml-1 flex items-center outline-none">
                              <Info className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 transition-colors cursor-pointer" />
                              {/* Tooltip UP */}
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-focus/info:opacity-100 group-focus/info:translate-y-0">
                                Creado el {format(parseISO(pl.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                              </span>
                            </button>
                          </span>
                          <p className="text-[10px] text-slate-400 font-medium pl-3">{pl.description}</p>
                          <div className="pl-3 pt-1.5">
                            <button
                              type="button"
                              className="text-[9px] font-black text-slate-500 bg-white border border-slate-200 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm tracking-widest transition-all flex items-center gap-1.5 px-3 py-1 rounded-full uppercase"
                              onClick={() => navigator.clipboard.writeText(pl.payment_url)}
                            >
                              <Copy className="w-3 h-3" /> Copiar link
                            </button>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-amber-600 shrink-0 ml-4">{fmt(pl.amount)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className={`flex justify-between items-center px-5 py-4 border-t-2 ${saldoPendiente === 0 ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-100 bg-slate-50/60'} ${['accepted', 'repairing', 'ready'].includes(ticket.status) ? '' : 'rounded-b-[inherit]'}`}>
                    <div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Saldo Pendiente</p>
                      {saldoPendiente === 0 && (
                        <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Cuenta completamente saldada</p>
                      )}
                    </div>
                    <span className={`text-xl font-black ${saldoPendiente === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {saldoPendiente === 0 ? '✓ $0' : fmt(saldoPendiente)}
                    </span>
                  </div>

                  {['accepted', 'repairing', 'ready'].includes(ticket.status) && (
                    <div className="flex flex-col sm:flex-row gap-2 p-5 border-t border-slate-100 bg-white rounded-b-[inherit]">
                      <Button
                        variant="outline"
                        className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded-xl h-10 px-4 gap-2 font-bold text-xs transition-all active:scale-95"
                        onClick={() => {
                          setShowTransferModal(true);
                          setTransferForm({ description: 'Abono vía transferencia', amount: '', paid_at: format(new Date(), "yyyy-MM-dd'T'HH:mm") });
                        }}
                      >
                        <Plus className="w-4 h-4" /> ABONO MANUAL
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded-xl h-10 px-4 gap-2 font-bold text-xs transition-all active:scale-95"
                        onClick={() => {
                          setShowPaymentModal(true);
                          setPaymentEmail(ticket.appointment?.customer_email || '');
                          setPaymentLink(null);
                          setPaymentForm({ description: '', amount: '' });
                        }}
                      >
                        <CreditCard className="w-4 h-4" /> LINK DE PAGO
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}


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
              disabled={updateTicketMutation.isPending}
              onClick={() => updateTicketMutation.mutate(
                { id: ticket.id, status: 'ready' },
                {
                  onSuccess: async () => {
                    const sent = await sendReadyEmail(ticket.id);
                    if (sent) {
                      showAlert('Listo para retiro', `Se marcó el ticket #${ticket.appointment?.short_id} como pendiente de retiro y se avisó al cliente por email.`);
                    } else {
                      showError('Estado actualizado', 'El ticket quedó listo para retiro, pero el email al cliente no pudo enviarse. Revisa la configuración de correo.');
                    }
                  },
                }
              )}
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

      {/* Payment Link Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              if (!isCreatingLink && !isSendingPaymentEmail) {
                setShowPaymentModal(false);
                setPaymentLink(null);
                setPaymentForm({ description: '', amount: '' });
                setLinkCopied(false);
              }
            }}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <Card className="relative z-10 w-full max-w-xl shadow-2xl overflow-hidden rounded-[32px] border border-slate-100 bg-white">

              {/* Header — mismo patrón que Enviar Presupuesto */}
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-900 p-1.5 rounded-lg text-white">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <CardTitle className="text-xl font-black text-slate-900">
                        {!paymentLink ? 'Crear Link de Pago' : 'Link Generado'}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs font-medium text-slate-500">
                      {!paymentLink
                        ? `Ticket #${ticket.appointment?.short_id} · ${ticket.appointment?.customer_name}`
                        : 'Revisa el link y envíalo al cliente por correo'
                      }
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                    onClick={() => {
                      setShowPaymentModal(false);
                      setPaymentLink(null);
                      setPaymentForm({ description: '', amount: '' });
                      setLinkCopied(false);
                    }}
                  >
                    <XCircle className="w-6 h-6" />
                  </Button>
                </div>

              </CardHeader>

              <CardContent className="p-6 space-y-6">

                {/* ── Fase 1: Formulario ── */}
                {!paymentLink ? (
                  <div className="space-y-6">

                    {/* Monto total de reparación — referencia */}
                    {findings.length > 0 && (() => {
                      const subtotal = findings.reduce((acc, f) => acc + f.price, 0);
                      const evaluacionAbono = ticket.appointment?.service?.price || 0;
                      const abonosPagados = paymentLinks
                        .filter(pl => pl.status === 'paid')
                        .reduce((acc, pl) => acc + pl.amount, 0);
                      const saldoPendiente = Math.max(0, subtotal - evaluacionAbono - abonosPagados);

                      return (
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                            Resumen del Ticket
                          </p>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500 font-medium">Subtotal reparación</span>
                              <span className="font-bold text-slate-700">
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(subtotal)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-500 font-medium">Abono evaluación</span>
                              <span className="font-bold text-blue-600">
                                -{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(evaluacionAbono)}
                              </span>
                            </div>
                            {abonosPagados > 0 && (
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Abono{paymentLinks.filter(pl => pl.status === 'paid').length > 1 ? 's' : ''} pagado{paymentLinks.filter(pl => pl.status === 'paid').length > 1 ? 's' : ''}
                                </span>
                                <span className="font-bold text-emerald-600">
                                  -{new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(abonosPagados)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                              <span className="text-slate-900 font-black text-sm">Saldo Pendiente</span>
                              <span className={`font-black text-base ${saldoPendiente === 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {saldoPendiente === 0
                                  ? '✓ Saldado'
                                  : new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(saldoPendiente)
                                }
                              </span>
                            </div>
                          </div>
                          {saldoPendiente > 0 && (
                            <div className="mt-3 flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-[10px] font-black border-slate-200 text-slate-600 hover:bg-slate-100 uppercase tracking-widest gap-1.5 rounded-lg transition-all active:scale-95"
                                onClick={() => setPaymentForm(prev => ({ ...prev, amount: String(saldoPendiente) }))}
                              >
                                <ArrowUpCircle className="w-3 h-3" />
                                Usar saldo pendiente · {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(saldoPendiente)}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        Descripción del Cobro <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className="w-full min-h-[90px] p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm resize-none bg-slate-50 font-medium text-slate-900 placeholder:text-slate-400"
                        placeholder="Ej: Abono por reparación de placa base, repuesto batería..."
                        value={paymentForm.description}
                        onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                        disabled={isCreatingLink}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        Monto a Cobrar (CLP)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                        <Input
                          type="number"
                          placeholder="50000"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          className="pl-7 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl h-12 font-bold text-slate-900 text-sm"
                          disabled={isCreatingLink}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-slate-100">
                      <Button
                        variant="outline"
                        className="flex-1 h-12 border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95"
                        onClick={() => {
                          setShowPaymentModal(false);
                          setPaymentForm({ description: '', amount: '' });
                        }}
                        disabled={isCreatingLink}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5"
                        disabled={!paymentForm.description || !paymentForm.amount || isCreatingLink}
                        onClick={handleCreatePaymentLink}
                      >
                        {isCreatingLink ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</>
                        ) : (
                          <>
                            <span className="flex items-center gap-1.5"><Link className="w-3.5 h-3.5" /> Generar Link</span>
                            {paymentForm.amount && (
                              <span className="text-[9px] font-bold text-white/60 tracking-widest">
                                {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(parseFloat(paymentForm.amount) || 0)}
                              </span>
                            )}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Fase 2: Link listo → enviar email ── */
                  <div className="space-y-5">
                    {/* Resumen del cobro */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumen del Cobro</p>
                      <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-medium">Concepto</span>
                        <span className="font-bold text-slate-900 text-right max-w-[55%] truncate">{paymentForm.description}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-500 font-medium">Monto</span>
                        <span className="font-black text-slate-900 text-lg">
                          {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(parseFloat(paymentForm.amount) || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Link generado */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        Link de Pago Generado
                      </label>
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="flex-1 text-xs text-slate-500 truncate font-medium">{paymentLink}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                          onClick={handleCopyLink}
                        >
                          {linkCopied
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            : <Copy className="w-3.5 h-3.5" />
                          }
                        </Button>
                        <a
                          href={paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 w-7 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      {linkCopied && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-1.5 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Copiado al portapapeles
                        </p>
                      )}
                    </div>

                    {/* Email destino */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                        Email de Envío
                      </label>
                      <Input
                        type="email"
                        value={paymentEmail}
                        onChange={(e) => setPaymentEmail(e.target.value)}
                        className="bg-slate-50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl h-12 font-bold text-slate-900 text-sm"
                        placeholder="email@cliente.com"
                        disabled={isSendingPaymentEmail}
                      />
                      <p className="text-[9px] font-medium text-slate-400 mt-1">
                        Puedes modificar el email antes de enviar el link.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2 border-t border-slate-100">
                      <Button
                        variant="outline"
                        className="flex-1 h-12 border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95"
                        onClick={() => {
                          setPaymentLink(null);
                          setLinkCopied(false);
                        }}
                        disabled={isSendingPaymentEmail}
                      >
                        ← Editar
                      </Button>
                      <Button
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2"
                        disabled={!paymentEmail || isSendingPaymentEmail}
                        onClick={handleSendPaymentEmail}
                      >
                        {isSendingPaymentEmail ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                        ) : (
                          <><Mail className="w-4 h-4" /> Enviar por Correo</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {showSendModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSendModal(false)} />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <Card className="relative z-10 w-full max-w-md shadow-2xl overflow-hidden rounded-[32px] border border-slate-100 bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-6">
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
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowTransferModal(false)} />
          
          <div className="flex min-h-full items-center justify-center p-4">
            <Card className="relative z-10 w-full max-w-md shadow-2xl overflow-hidden rounded-[32px] border border-slate-100 bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <CardTitle className="text-xl font-black text-slate-900">Registrar Abono</CardTitle>
                    </div>
                    <CardDescription className="text-xs font-medium text-slate-500">
                      Registra una transferencia o pago manual
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setShowTransferModal(false)}>
                    <XCircle className="w-6 h-6" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Fecha y Hora</label>
                    <Input 
                      type="datetime-local"
                      value={transferForm.paid_at}
                      onChange={(e) => setTransferForm({...transferForm, paid_at: e.target.value})}
                      className="bg-slate-50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl h-12 font-bold text-slate-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Monto (CLP)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                      <Input 
                        type="number"
                        placeholder="Ej: 25000"
                        value={transferForm.amount}
                        onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                        className="pl-7 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-slate-900 rounded-xl h-12 font-bold text-slate-900 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Comentario / Descripción</label>
                    <textarea 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm resize-none bg-slate-50 font-medium text-slate-900 placeholder:text-slate-400"
                      placeholder="Ej: Transferencia Banco Estado..."
                      rows={2}
                      value={transferForm.description}
                      onChange={(e) => setTransferForm({...transferForm, description: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95"
                    onClick={() => setShowTransferModal(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-12 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2"
                    disabled={addManualPaymentMutation.isPending || !transferForm.amount || !transferForm.description}
                    onClick={handleAddTransfer}
                  >
                    {addManualPaymentMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                    ) : (
                      <><Save className="w-4 h-4" /> Registrar Pago</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
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
            <h1 className="text-3xl font-black tracking-tighter uppercase mb-1">{activeView === 'reparacion' ? 'Resumen de Reparación' : 'Presupuesto Técnico'}</h1>
            <p className="text-lg font-bold text-slate-500">#{ticket.appointment?.short_id}</p>
          </div>
          <div className="text-right">
            <img src="/powerfix-negro.png" alt="PowerFix" style={{ height: '13px', width: 'auto', marginLeft: 'auto', marginBottom: '8px' }} />
            <div className="flex items-center justify-end gap-3 mb-2">
              <img
                src="/msi.png"
                alt="MSI"
                className="h-6 w-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <img
                src="/gigabyte.png"
                alt="Gigabyte"
                className="h-6 w-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
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
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Datos del Equipo</h3>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs leading-relaxed grid grid-cols-2 gap-2">
            <p><span className="font-bold">Modelo: </span>{deviceForm?.device_model || ticket.device_model || '---'}</p>
            <p><span className="font-bold">N° Serie: </span>{deviceForm?.serial_number || ticket.serial_number || '---'}</p>
            <p className="col-span-2"><span className="font-bold">Falla reportada: </span>{deviceForm?.reported_issue || ticket.reported_issue || '---'}</p>
            <p><span className="font-bold">Password: </span>{deviceForm?.device_password || ticket.device_password || '---'}</p>
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
          {activeView === 'reparacion' ? 'Documento de respaldo de la reparación - PowerFix' : 'Este presupuesto es válido por 15 días - PowerFix'}
        </div>
      </div>
    </div>
  );
}
