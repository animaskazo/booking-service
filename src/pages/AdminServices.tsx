import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Clock,
  DollarSign,
  Save,
  X,
  Calendar as CalendarIcon,
  Loader2,
} from 'lucide-react';

import {
  useServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
} from '../lib/supabase-client';
import { ServiceWithAvailability, formatPrice } from '../lib/utils-booking';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const CATEGORIES = [
  'General',
  'Servicio Técnico',
  'Soporte',
  'Postventa',
  'Compra por mayor'
];

export default function AdminServices() {
  const { data: services = [], isLoading: loadingServices } = useServices();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isAddingService, setIsAddingService] = useState(false);

  // Mutations
  const createService = useCreateService();
  const deleteService = useDeleteService();

  const selectedService = services.find(s => s.id === selectedServiceId);

  const handleCreateService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newService = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      duration_min: parseInt(formData.get('duration') as string),
      price: parseFloat(formData.get('price') as string),
      color: formData.get('color') as string || '#3B82F6',
      category: formData.get('category') as string || 'General',
    };

    try {
      const result = await createService.mutateAsync(newService);
      setIsAddingService(false);
      setSelectedServiceId(result.id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteService = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de eliminar este servicio? Se borrarán también sus disponibilidades.')) {
      try {
        await deleteService.mutateAsync(id);
        if (selectedServiceId === id) setSelectedServiceId(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Local */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Administrar Servicios</h1>
          <p className="text-slate-500">Configura tus servicios y horarios de atención</p>
        </div>
        <Button onClick={() => setIsAddingService(true)} className="bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold shadow-lg transition-all active:scale-95 uppercase text-xs tracking-widest px-6">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Servicio
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar: Lista de Servicios */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="font-semibold text-slate-700 px-1">Servicios Disponibles</h3>
          <ScrollArea className="h-[calc(100vh-250px)]">
            <div className="space-y-3 pr-4">
              {loadingServices ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                </div>
              ) : services.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-slate-500">
                    No hay servicios aún
                  </CardContent>
                </Card>
              ) : (
                services.map((service) => (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all duration-200 hover:border-slate-400 hover:shadow-sm ${selectedServiceId === service.id ? 'border-slate-900 shadow-md' : 'border-slate-200'}`}
                    onClick={() => { setSelectedServiceId(service.id); setIsAddingService(false); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: service.color }} />
                          <div>
                            <h4 className="font-bold text-slate-900">{service.name}</h4>
                            <div className="flex gap-3 text-xs text-slate-500 mt-1">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {service.duration_min}m</span>
                              <span className="flex items-center gap-1">
                                {service.price === 0 ? (
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 py-0 text-[10px]">Gratis</Badge>
                                ) : (
                                  <><DollarSign className="w-3 h-3" /> {service.price}</>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all h-9 w-9"
                          onClick={(e) => handleDeleteService(service.id, e)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content: Detalle y Disponibilidad */}
        <div className="lg:col-span-8">
          {isAddingService ? (
            <Card className="border-2 border-slate-900 shadow-xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b">
                <div className="flex justify-between items-center">
                  <CardTitle>Añadir Nuevo Servicio</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setIsAddingService(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleCreateService} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label htmlFor="name">Nombre del Servicio</Label>
                      <Input id="name" name="name" required placeholder="Ej: Consulta General" />
                    </div>
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label htmlFor="color">Color Etiqueta</Label>
                      <Input id="color" name="color" type="color" defaultValue="#3B82F6" className="h-10" />
                    </div>
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label htmlFor="category">Categoría</Label>
                      <select
                        id="category"
                        name="category"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        defaultValue="General"
                      >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Input id="description" name="description" placeholder="Breve descripción del servicio" />
                    </div>
                    <div className="space-y-2 col-span-1">
                      <Label htmlFor="price">Precio ($)</Label>
                      <Input id="price" name="price" type="number" required min="0" step="0.01" defaultValue="0" />
                      <p className="text-[10px] text-slate-500 font-medium">💡 Pon 0 para que figure como <strong className="text-emerald-600">Gratis</strong></p>
                    </div>
                  </div>
                  <div className="pt-4 flex gap-3">
                    <Button type="submit" className="flex-[2] bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all active:scale-95">
                      CREAR SERVICIO
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setIsAddingService(false)} className="flex-1 h-12 font-bold border-slate-200 hover:bg-slate-50 uppercase tracking-widest text-xs transition-all active:scale-95">
                      CANCELAR
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : selectedService ? (
            <ServiceDetailsSection key={selectedService.id} service={selectedService} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-dashed p-12">
              <CalendarIcon className="w-16 h-16 mb-4 opacity-20" />
              <p>Selecciona un servicio para ver y editar su configuración</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceDetailsSection({ service }: { service: ServiceWithAvailability }) {
  const updateServiceMutation = useUpdateService();
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await updateServiceMutation.mutateAsync({
        id: service.id,
        name: formData.get('name') as string,
        description: formData.get('description') as string,
        duration_min: 30, // Default, will be ignored by logic
        price: parseFloat(formData.get('price') as string),
        color: formData.get('color') as string,
        category: formData.get('category') as string || 'General',
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      {/* Detalle del Servicio */}
      <Card className="shadow-lg border-t-4" style={{ borderTopColor: service.color }}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">Configurar {service.name}</CardTitle>
              <CardDescription>Modifica los detalles del servicio seleccionado</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-slate-50">ID: {service.id.slice(0, 8)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-slate-700 font-bold">Nombre del Servicio</Label>
                <Input id="edit-name" name="name" defaultValue={service.name} required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color" className="text-slate-700 font-bold">Color Identificador</Label>
                <div className="flex gap-3">
                  <Input id="edit-color" name="color" type="color" defaultValue={service.color} className="w-20 h-11 p-1" />
                  <Input value={service.color} readOnly className="flex-1 h-11 bg-slate-50 text-slate-500 font-mono text-xs" />
                </div>
              </div>
              <div className="space-y-2 col-span-1 md:col-span-2">
                <Label htmlFor="edit-category" className="text-slate-700 font-bold">Categoría / Tipo de Servicio</Label>
                <select
                  id="edit-category"
                  name="category"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  defaultValue={service.category}
                >
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-2 col-span-1 md:col-span-2">
                <Label htmlFor="edit-desc" className="text-slate-700 font-bold">Descripción (opcional)</Label>
                <Input id="edit-desc" name="description" defaultValue={service.description} className="h-11" placeholder="Ej: Servicio de mantenimiento preventivo para equipos Apple" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-price" className="text-slate-700 font-bold">Precio del Servicio ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input id="edit-price" name="price" type="number" defaultValue={service.price} step="0.01" required className="pl-10 h-11" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium">💡 Ingrese 0 para mostrar la etiqueta <strong className="text-emerald-600">Gratis</strong> al cliente</p>
              </div>
            </div>

            <div className="pt-4 border-t flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400 hidden sm:block">Los cambios se aplicarán de inmediato.</p>
              <Button type="submit" className="flex-1 sm:flex-none sm:px-10 bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs transition-all active:scale-95" disabled={updateServiceMutation.isPending}>
                {updateServiceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    GUARDANDO...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    ACTUALIZAR SERVICIO
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
