import { useState } from 'react';
import {
  useStockItems,
  useCreateStockItem,
  useUpdateStockItem,
  useDeleteStockItem,
  supabase,
} from '../lib/supabase-client';
import { useDialog } from '@/components/ui/dialog-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  XCircle,
  Search,
  Loader2,
  Camera,
  Boxes,
} from 'lucide-react';

interface StockForm {
  name: string;
  photo_url: string;
  serial_number: string;
  rma: string;
  quantity: string;
}

const EMPTY_FORM: StockForm = { name: '', photo_url: '', serial_number: '', rma: '', quantity: '1' };

export default function AdminStock() {
  const { data: items = [], isLoading } = useStockItems();
  const createMutation = useCreateStockItem();
  const updateMutation = useUpdateStockItem();
  const deleteMutation = useDeleteStockItem();
  const { showConfirm, showAlert, showError } = useDialog();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StockForm>(EMPTY_FORM);
  const [isUploading, setIsUploading] = useState(false);

  const filtered = items.filter((i) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [i.name, i.serial_number, i.rma].some((v) => (v || '').toLowerCase().includes(q));
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name || '',
      photo_url: item.photo_url || '',
      serial_number: item.serial_number || '',
      rma: item.rma || '',
      quantity: String(item.quantity ?? 0),
    });
    setShowModal(true);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `stock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('tickets').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('tickets').getPublicUrl(fileName);
      setForm((prev) => ({ ...prev, photo_url: publicUrl }));
    } catch (err) {
      console.error(err);
      showError('Error de Carga', 'No se pudo subir la foto.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showError('Falta el nombre', 'El componente necesita un nombre.');
      return;
    }
    const qty = Math.max(0, parseInt(form.quantity || '0', 10) || 0);
    const payload = {
      name: form.name.trim(),
      photo_url: form.photo_url || null,
      serial_number: form.serial_number.trim() || null,
      rma: form.rma.trim() || null,
      quantity: qty,
    };
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
        showAlert('Stock actualizado', 'El componente fue actualizado.');
      } else {
        await createMutation.mutateAsync(payload);
        showAlert('Stock creado', 'El componente fue agregado al inventario.');
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      showError('Error al guardar', 'No se pudo guardar el componente. Verifica haber ejecutado la migración sql/stock_migration.sql.');
    }
  };

  const handleDelete = (id: string, name: string) => {
    showConfirm(
      'Eliminar del stock',
      `¿Eliminar "${name}" del inventario de forma permanente?`,
      async () => {
        try {
          await deleteMutation.mutateAsync(id);
        } catch (err) {
          console.error(err);
        }
      },
      'ELIMINAR'
    );
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
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Control de Stock</h1>
          <p className="text-slate-500 font-medium">Inventario de componentes para reparaciones</p>
        </div>
        <Button onClick={openCreate} className="bg-slate-900 hover:bg-slate-800 rounded-xl px-6 h-11 gap-2 font-bold uppercase text-[11px] tracking-widest">
          <Plus className="w-4 h-4" /> Agregar componente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Buscar por nombre, serie o RMA..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 rounded-xl bg-white border-slate-200"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-20 text-center">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">{search.trim() ? 'Sin resultados para esta búsqueda.' : 'No hay componentes en stock.'}</p>
          {!search.trim() && <p className="text-sm text-slate-400">Agrega el primer componente con el botón superior.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-white border-b">
                <tr>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Foto</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Nombre</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">N° Serie</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">RMA</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Cantidad</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-slate-100 bg-slate-50" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-900">{item.name}</td>
                    <td className="p-4 font-mono text-xs text-slate-600">{item.serial_number || '---'}</td>
                    <td className="p-4 font-mono text-xs text-slate-600">{item.rma || '---'}</td>
                    <td className="p-4">
                      <Badge className={`${item.quantity > 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'} border shadow-none font-black text-xs`}>
                        x{item.quantity}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="text-slate-900 h-8 w-8" title="Editar" onClick={() => openEdit(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-500 h-8 w-8" title="Eliminar" onClick={() => handleDelete(item.id, item.name)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <Card className="relative z-10 w-full max-w-lg shadow-2xl overflow-hidden rounded-[32px] border border-slate-100 bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100/60 pb-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-900 p-1.5 rounded-lg text-white">
                        <Package className="w-4 h-4" />
                      </div>
                      <CardTitle className="text-xl">{editingId ? 'Editar componente' : 'Nuevo componente'}</CardTitle>
                    </div>
                    <CardDescription>Datos del inventario</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-red-50 hover:text-red-500" onClick={() => setShowModal(false)}>
                    <XCircle className="w-6 h-6" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre *</label>
                  <Input
                    placeholder="Ej: Batería MacBook Pro 14"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foto</label>
                  <div className="flex items-center gap-3">
                    {form.photo_url ? (
                      <img src={form.photo_url} alt="Vista previa" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                        <Camera className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                    <input type="file" accept="image/*" id="stock-photo" className="hidden" onChange={handlePhotoChange} />
                    <Button
                      variant="outline"
                      type="button"
                      disabled={isUploading}
                      className="h-10 gap-2 border-dashed border-slate-200 text-[10px] font-bold rounded-xl tracking-widest uppercase"
                      onClick={() => document.getElementById('stock-photo')?.click()}
                    >
                      {isUploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
                      ) : (
                        <><Camera className="w-4 h-4" /> {form.photo_url ? 'Cambiar foto' : 'Subir foto'}</>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">N° de Serie</label>
                    <Input
                      placeholder="Ej: SN-88412"
                      value={form.serial_number}
                      onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                      className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RMA</label>
                    <Input
                      placeholder="Ej: RMA-2024-031"
                      value={form.rma}
                      onChange={(e) => setForm({ ...form, rma: e.target.value })}
                      className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad</label>
                  <Input
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="h-12 rounded-xl bg-slate-50/50 border-slate-200"
                  />
                </div>
              </CardContent>
              <div className="p-8 bg-white border-t flex flex-row-reverse gap-4">
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white h-12 font-bold uppercase tracking-widest text-xs"
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? 'GUARDANDO...' : editingId ? 'GUARDAR CAMBIOS' : 'AGREGAR AL STOCK'}
                </Button>
                <Button type="button" variant="outline" className="h-12 px-6 border-slate-200 font-bold uppercase tracking-widest text-xs" onClick={() => setShowModal(false)}>
                  CANCELAR
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
