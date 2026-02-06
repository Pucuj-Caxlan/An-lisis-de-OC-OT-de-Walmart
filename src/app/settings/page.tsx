
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Shield, 
  Palette, 
  Bell, 
  Key, 
  CheckCircle2, 
  Save,
  Moon,
  Sun,
  Monitor,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Lock,
  Mail,
  Zap,
  Fingerprint
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userSettingsRef = user ? doc(db!, 'users', user.uid) : null;
  const { data: profile } = useDoc(userSettingsRef);

  const [formData, setFormData] = useState({
    displayName: '',
    role: 'Auditor Senior',
    forensicAlerts: true,
    weeklyDigest: false,
    theme: 'light',
    iaSensitivity: 75
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || user?.displayName || '',
        role: profile.role || 'Auditor Senior',
        forensicAlerts: profile.preferences?.notifications?.forensicAlerts ?? true,
        weeklyDigest: profile.preferences?.notifications?.weeklyDigest ?? false,
        theme: profile.preferences?.theme || 'light',
        iaSensitivity: profile.preferences?.iaSensitivity || 75
      });
    } else if (user) {
      setFormData(prev => ({
        ...prev,
        displayName: user.displayName || '',
      }));
    }
  }, [profile, user]);

  const handleSave = () => {
    if (!userSettingsRef) return;

    setDocumentNonBlocking(userSettingsRef, {
      displayName: formData.displayName,
      role: formData.role,
      preferences: {
        theme: formData.theme,
        iaSensitivity: formData.iaSensitivity,
        notifications: {
          forensicAlerts: formData.forensicAlerts,
          weeklyDigest: formData.weeklyDigest
        }
      },
      lastUpdated: new Date().toISOString()
    }, { merge: true });

    toast({
      title: "Configuración Guardada",
      description: "Tus preferencias se han actualizado correctamente en la nube.",
    });
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Configuración de Plataforma</h1>
            </div>
          </div>
          <Button onClick={handleSave} className="gap-2 shadow-lg">
            <Save className="h-4 w-4" /> Guardar Cambios
          </Button>
        </header>

        <main className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-headline font-bold text-slate-800">Panel de Control</h2>
              <p className="text-sm text-slate-500">Gestiona tu identidad, seguridad y el comportamiento de la IA Auditora.</p>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border shadow-sm">
              <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                {user?.displayName?.[0] || 'U'}
              </div>
              <div className="pr-4">
                <p className="text-xs font-black text-slate-800 uppercase leading-none">{user?.displayName || 'Usuario'}</p>
                <p className="text-[10px] text-slate-400 font-medium">{user?.email || 'Sesión Activa'}</p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-white border p-1 h-12 shadow-sm rounded-xl gap-2 overflow-x-auto justify-start w-full md:w-auto">
              <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white h-10 px-4 rounded-lg">
                <User className="h-4 w-4" /> Perfil
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white h-10 px-4 rounded-lg">
                <Shield className="h-4 w-4" /> Seguridad
              </TabsTrigger>
              <TabsTrigger value="interface" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white h-10 px-4 rounded-lg">
                <Palette className="h-4 w-4" /> Interfaz
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white h-10 px-4 rounded-lg">
                <Bell className="h-4 w-4" /> Notificaciones
              </TabsTrigger>
              <TabsTrigger value="api" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-white h-10 px-4 rounded-lg">
                <Key className="h-4 w-4" /> API & Dev
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-6 outline-none">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                  <CardTitle className="text-lg">Información Personal</CardTitle>
                  <CardDescription>Estos datos se utilizarán para la firma de reportes de auditoría.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo</Label>
                      <Input 
                        id="name" 
                        value={formData.displayName} 
                        onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                        placeholder="Ej. Pedro Pérez" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Cargo / Especialidad</Label>
                      <Input 
                        id="role" 
                        value={formData.role} 
                        onChange={(e) => setFormData({...formData, role: e.target.value})}
                        placeholder="Ej. Auditor Forense Senior" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico (No Editable)</Label>
                    <div className="flex gap-2">
                      <Input id="email" value={user?.email || 'No proporcionado'} disabled className="bg-slate-50" />
                      <Badge variant="outline" className="h-10 gap-1 px-4 text-emerald-600 bg-emerald-50 border-emerald-100 uppercase text-[10px] font-bold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verificado
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm overflow-hidden border-l-4 border-l-accent">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="h-5 w-5 text-accent" /> Sensibilidad de IA Auditora
                  </CardTitle>
                  <CardDescription>Ajusta el nivel de rigor que aplica el motor Gemini al detectar discrepancias semánticas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-slate-500">Modo Flexible</span>
                      <span className="text-primary">{formData.iaSensitivity}% (Modo Riguroso)</span>
                      <span className="text-slate-500">Auditoría Total</span>
                    </div>
                    <Slider 
                      value={[formData.iaSensitivity]} 
                      max={100} 
                      step={5} 
                      onValueChange={(val) => setFormData({...formData, iaSensitivity: val[0]})}
                    />
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 leading-relaxed italic">
                    Un nivel más alto incrementará las alertas de "Discrepancia Semántica" y "Red Flags" financieras.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6 outline-none">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b">
                  <CardTitle className="text-lg">Credenciales de Acceso</CardTitle>
                  <CardDescription>Actualiza tu contraseña periódicamente para mantener la seguridad forense.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center border shadow-sm">
                        <Lock className="h-6 w-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Contraseña</p>
                        <p className="text-xs text-slate-500">Última actualización: Hace 3 meses</p>
                      </div>
                    </div>
                    <Button variant="outline" className="gap-2">Cambiar Contraseña</Button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-white rounded-lg flex items-center justify-center border shadow-sm">
                        <Fingerprint className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Autenticación de Dos Factores (MFA)</p>
                        <p className="text-xs text-slate-500 text-rose-500 font-bold">Inactivo - Recomendado</p>
                      </div>
                    </div>
                    <Button className="bg-slate-800">Configurar</Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Dispositivos y Sesiones</CardTitle>
                  <CardDescription>Sesiones activas actualmente en la plataforma.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-dashed">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-4 w-4 text-emerald-500" />
                        <div className="text-xs">
                          <p className="font-bold">MacBook Pro - Ciudad de México</p>
                          <p className="text-slate-400">Navegador Chrome • Sesión actual</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500 uppercase text-[8px]">En Línea</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="interface" className="space-y-6 outline-none">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Preferencias de Visualización</CardTitle>
                  <CardDescription>Personaliza cómo interactúas con los dashboards de auditoría.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div 
                      onClick={() => setFormData({...formData, theme: 'light'})}
                      className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${formData.theme === 'light' ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <Sun className={`h-6 w-6 mb-3 ${formData.theme === 'light' ? 'text-primary' : 'text-slate-400'}`} />
                      <p className="text-sm font-bold">Tema Claro</p>
                      <p className="text-[10px] text-slate-500">Optimizado para lectura.</p>
                    </div>
                    <div 
                      onClick={() => setFormData({...formData, theme: 'dark'})}
                      className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${formData.theme === 'dark' ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <Moon className={`h-6 w-6 mb-3 ${formData.theme === 'dark' ? 'text-primary' : 'text-slate-400'}`} />
                      <p className="text-sm font-bold">Tema Oscuro</p>
                      <p className="text-[10px] text-slate-500">Reduce fatiga visual.</p>
                    </div>
                    <div 
                      onClick={() => setFormData({...formData, theme: 'system'})}
                      className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${formData.theme === 'system' ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <Monitor className={`h-6 w-6 mb-3 ${formData.theme === 'system' ? 'text-primary' : 'text-slate-400'}`} />
                      <p className="text-sm font-bold">Sistema</p>
                      <p className="text-[10px] text-slate-500">Auto-detectar.</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="text-sm font-bold">Densidad de Información</h4>
                    <div className="flex gap-4">
                      <Button variant="outline" size="sm" className="bg-slate-50">Compacto</Button>
                      <Button variant="default" size="sm" className="shadow-sm">Estándar</Button>
                      <Button variant="outline" size="sm" className="bg-slate-50">Espacioso</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6 outline-none">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Alertas Críticas</CardTitle>
                  <CardDescription>Configura cuándo deseas recibir notificaciones automáticas.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Alertas Forenses</Label>
                      <p className="text-xs text-slate-500">Notificar de inmediato si la IA detecta una anomalía de severidad alta.</p>
                    </div>
                    <Switch 
                      checked={formData.forensicAlerts} 
                      onCheckedChange={(v) => setFormData({...formData, forensicAlerts: v})} 
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-bold">Resumen Semanal (Digest)</Label>
                      <p className="text-xs text-slate-500">Recibir un reporte consolidado de tendencias cada lunes.</p>
                    </div>
                    <Switch 
                      checked={formData.weeklyDigest} 
                      onCheckedChange={(v) => setFormData({...formData, weeklyDigest: v})} 
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api" className="space-y-6 outline-none">
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-800 text-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <Key className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Gestión de Claves API</CardTitle>
                      <CardDescription className="text-slate-400">Usa estas llaves para integrar los datos de auditoría con Tririga o SAP.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Llave de Producción</h4>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold text-emerald-600 bg-emerald-50 border-emerald-100">Activo</Badge>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input 
                          type={showApiKey ? "text" : "password"} 
                          value="walmart_audit_live_7x92kLp02Msn81vXz" 
                          readOnly 
                          className="font-mono text-xs pr-10" 
                        />
                        <button 
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-primary transition-colors"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button variant="outline" size="icon"><Trash2 className="h-4 w-4 text-rose-400" /></Button>
                    </div>
                  </div>

                  <Button className="w-full gap-2 py-6 border-dashed border-2 bg-white text-slate-600 hover:bg-slate-50 border-slate-200 shadow-none">
                    <Plus className="h-4 w-4" /> Generar Nueva Clave API
                  </Button>
                </CardContent>
                <CardFooter className="bg-slate-50 py-3 border-t">
                  <p className="text-[10px] text-slate-400 flex items-center gap-2">
                    <Shield className="h-3 w-3" /> Las llaves API tienen acceso de solo lectura por defecto.
                  </p>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </div>
  );
}
