"use client"

import React, { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { 
  SidebarInset, 
  SidebarTrigger 
} from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  FileText, 
  AlertCircle, 
  Filter,
  Download,
  Clock,
  ChevronRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
  Cell,
  Tooltip,
} from 'recharts';
import { MOCK_OC_DATA, OCData } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';

export default function Dashboard() {
  const [selectedTab, setSelectedTab] = useState('summary');

  // KPI Calculations
  const totalImpact = MOCK_OC_DATA.reduce((acc, curr) => acc + curr.impactAmount, 0);
  const totalOrders = MOCK_OC_DATA.length;
  const anomalyCount = MOCK_OC_DATA.filter(d => d.isAnomaly).length;
  const pendingOrders = MOCK_OC_DATA.filter(d => d.status === 'Pendiente').length;

  const impactByFormat = [
    { name: 'Bodega Aurrera', value: MOCK_OC_DATA.filter(d => d.format === 'Bodega Aurrera').reduce((acc, curr) => acc + curr.impactAmount, 0) },
    { name: 'Walmart Supercenter', value: MOCK_OC_DATA.filter(d => d.format === 'Walmart Supercenter').reduce((acc, curr) => acc + curr.impactAmount, 0) },
    { name: 'Sam\'s Club', value: MOCK_OC_DATA.filter(d => d.format === 'Sam\'s Club').reduce((acc, curr) => acc + curr.impactAmount, 0) },
    { name: 'Walmart Express', value: MOCK_OC_DATA.filter(d => d.format === 'Walmart Express').reduce((acc, curr) => acc + curr.impactAmount, 0) },
  ].sort((a, b) => b.value - a.value);

  const trendData = [
    { month: 'Ene', value: 95400 },
    { month: 'Feb', value: 16800 },
    { month: 'Mar', value: 251201 },
  ];

  const topCauses = [
    { cause: 'Logística - CEDIS', impact: 285400, count: 4 },
    { cause: 'Inventario - Exceso', impact: 85000, count: 2 },
    { cause: 'Proveedores - Discrepancia', impact: 4500, count: 1 },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800">Dashboard de Nivel VP</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" /> Filtros Avanzados
            </Button>
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <Download className="h-4 w-4" /> Exportar Reporte
            </Button>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-6 md:p-8">
          {/* Quick Stats Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Impacto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline">${totalImpact.toLocaleString()}</div>
                <p className="flex items-center mt-1 text-xs text-emerald-600 font-medium">
                  <ArrowUpRight className="h-3 w-3 mr-1" /> +12.5% vs mes anterior
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total OC/OT</CardTitle>
                <FileText className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline">{totalOrders}</div>
                <p className="flex items-center mt-1 text-xs text-rose-600 font-medium">
                  <ArrowDownRight className="h-3 w-3 mr-1" /> -4.2% vs mes anterior
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm border-l-4 border-l-accent hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Anomalías Detectadas</CardTitle>
                <AlertCircle className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline">{anomalyCount}</div>
                <p className="text-xs text-muted-foreground mt-1">2 alertas críticas sin revisar</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Órdenes Pendientes</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline">{pendingOrders}</div>
                <p className="text-xs text-muted-foreground mt-1">Requieren atención inmediata</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="summary" className="space-y-6" onValueChange={setSelectedTab}>
            <TabsList className="bg-white p-1 border shadow-sm">
              <TabsTrigger value="summary">Resumen Ejecutivo</TabsTrigger>
              <TabsTrigger value="format">Por Formato</TabsTrigger>
              <TabsTrigger value="geography">Geografía</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Main Trend Chart */}
                <Card className="lg:col-span-4 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-headline">Tendencia Mensual de Impacto</CardTitle>
                    <CardDescription>Evolución del costo de OC/OT en el año actual</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} tickFormatter={(val) => `$${val / 1000}k`} />
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-3 border rounded-lg shadow-xl">
                                  <p className="text-sm font-bold text-slate-800">{payload[0].payload.month}</p>
                                  <p className="text-primary font-medium">${payload[0].value?.toLocaleString()}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#2962FF" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#2962FF', strokeWidth: 2, stroke: '#fff' }} 
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Distribution by Format */}
                <Card className="lg:col-span-3 border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-headline">Impacto por Formato</CardTitle>
                    <CardDescription>Distribución económica por canal de venta</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={impactByFormat} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{fontSize: 11}} />
                        <Tooltip 
                          cursor={{fill: '#f0f4f7'}}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-3 border rounded-lg shadow-xl">
                                  <p className="text-sm font-bold text-slate-800">{payload[0].payload.name}</p>
                                  <p className="text-primary font-medium">${payload[0].value?.toLocaleString()}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {impactByFormat.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#2962FF' : '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Top 10 Root Causes List */}
              <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
                <Card className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-headline">Principales Causas Raíz</CardTitle>
                      <CardDescription>Problemas recurrentes con mayor impacto financiero</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="text-primary">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topCauses.map((cause, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{cause.cause}</p>
                              <p className="text-xs text-muted-foreground">{cause.count} ocurrencias registradas</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">${cause.impact.toLocaleString()}</p>
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold text-primary/70">Crítico</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-headline">Órdenes Recientes & Drill-down</CardTitle>
                    <CardDescription>Últimas actualizaciones en el sistema de OC/OT</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {MOCK_OC_DATA.slice(0, 5).map((order) => (
                        <div key={order.id} className="group cursor-pointer flex items-center justify-between p-3 rounded-lg hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/20">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary uppercase">{order.orderNumber}</span>
                            <span className="text-sm text-slate-700">{order.format} - {order.country}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-bold">${order.impactAmount.toLocaleString()}</p>
                              <Badge variant={order.status === 'Completado' ? 'default' : 'outline'} className="text-[10px]">
                                {order.status}
                              </Badge>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="format">
              <Card className="border-none shadow-sm p-12 text-center text-muted-foreground">
                <BarChart3 className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p>Análisis por formato detallado cargando...</p>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </div>
  );
}