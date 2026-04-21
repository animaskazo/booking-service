import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  MapPin, 
  Lock, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const SERVICE_TYPES = [
  'Belleza y Estética',
  'Barbería y Peluquería',
  'Salud y Bienestar',
  'Servicio Técnico (Celulares/PC)',
  'Asesoría Legal/Contable',
  'Clases Particulares/Cursos',
  'Deportes y Fitness',
  'Talleres Automotrices',
  'Veterinaria y Mascotas',
  'Otro'
];

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    serviceType: '',
    city: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Crear el usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
            service_type: formData.serviceType,
            city: formData.city
          }
        }
      });

      if (authError) throw authError;

      // 2. Redirigir al admin o mostrar mensaje de confirmación
      // Nota: Dependiendo de la config de Supabase, podría requerir confirmación por email
      alert('¡Cuenta creada con éxito! Por favor revisa tu email para confirmar (si es necesario).');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="absolute top-0 left-0 w-full h-2 bg-slate-900" />
      
      <Card className="w-full max-w-xl shadow-2xl border-slate-200 overflow-hidden">
        <CardHeader className="space-y-4 text-center bg-white pb-8">
          <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center mx-auto shadow-xl rotate-3 hover:rotate-0 transition-transform duration-300">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-black tracking-tight text-slate-900">Comienza hoy</CardTitle>
            <CardDescription className="text-base text-slate-500 max-w-sm mx-auto">
              Únete a cientos de profesionales que ya automatizan sus reservas con nosotros.
            </CardDescription>
          </div>
        </CardHeader>
        
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-6 px-8">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nombre Completo */}
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-700 font-bold ml-1">Nombre Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="fullName" 
                    name="fullName"
                    placeholder="Ej: Juan Pérez" 
                    className="pl-10 h-11 rounded-xl bg-slate-50/50 focus:bg-white transition-all border-slate-200"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 font-bold ml-1">Email Profesional</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="email" 
                    name="email"
                    type="email" 
                    placeholder="juan@tuempresa.com" 
                    className="pl-10 h-11 rounded-xl bg-slate-50/50 focus:bg-white transition-all border-slate-200"
                    value={formData.email}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700 font-bold ml-1">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="phone" 
                    name="phone"
                    placeholder="+56 9 1234 5678" 
                    className="pl-10 h-11 rounded-xl bg-slate-50/50 focus:bg-white transition-all border-slate-200"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
              </div>

              {/* Ciudad */}
              <div className="space-y-2">
                <Label htmlFor="city" className="text-slate-700 font-bold ml-1">Ciudad</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="city" 
                    name="city"
                    placeholder="Ej: Santiago, Chile" 
                    className="pl-10 h-11 rounded-xl bg-slate-50/50 focus:bg-white transition-all border-slate-200"
                    value={formData.city}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
              </div>

              {/* Tipo de Servicio */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="serviceType" className="text-slate-700 font-bold ml-1">Tipo de Servicio</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <select 
                    id="serviceType" 
                    name="serviceType"
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 py-2 text-sm focus:bg-white transition-all outline-none focus:ring-2 focus:ring-slate-900 appearance-none font-medium"
                    value={formData.serviceType}
                    onChange={handleInputChange}
                    required 
                  >
                    <option value="" disabled>Selecciona tu rubro...</option>
                    {SERVICE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none">
                    <ChevronRight className="w-4 h-4 rotate-90 text-slate-400" />
                  </div>
                </div>
              </div>

              {/*Password */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="password" title="Contraseña" className="text-slate-700 font-bold ml-1">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    id="password" 
                    name="password"
                    type="password" 
                    placeholder="Mínimo 6 caracteres"
                    className="pl-10 h-11 rounded-xl bg-slate-50/50 focus:bg-white transition-all border-slate-200"
                    value={formData.password}
                    onChange={handleInputChange}
                    required 
                  />
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4 px-8 pb-10 pt-6">
            <Button className="w-full h-14 font-bold text-lg rounded-2xl shadow-xl shadow-slate-200 bg-slate-900 hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Crear mi cuenta gratis'
              )}
            </Button>
            
            <p className="text-sm text-slate-500">
              ¿Ya tienes una cuenta? {' '}
              <button 
                type="button" 
                onClick={() => navigate('/login')} 
                className="text-slate-900 font-bold hover:underline"
              >
                Inicia sesión aquí
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
      
      <div className="fixed bottom-8 text-center w-full max-w-md text-xs text-slate-400">
        <p>Al registrarte, aceptas nuestros Términos de Servicio y Política de Privacidad.</p>
      </div>
    </div>
  );
}
