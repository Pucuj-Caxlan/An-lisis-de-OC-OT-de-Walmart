
"use client"

import * as React from "react"
import {
  LayoutDashboard,
  FileSearch,
  UploadCloud,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  BarChart3,
  BrainCircuit,
  FileText
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigation = [
  {
    title: "Dashboard VP",
    icon: LayoutDashboard,
    url: "/",
  },
  {
    title: "Análisis Detallado",
    icon: FileSearch,
    url: "/analysis",
  },
  {
    title: "Carga Excel",
    icon: UploadCloud,
    url: "/upload",
  },
  {
    title: "Carga PDF",
    icon: FileText,
    url: "/upload-pdf",
  },
  {
    title: "Tendencias e Impacto",
    icon: TrendingUp,
    url: "/trends",
  },
  {
    title: "Anomalías",
    icon: AlertTriangle,
    url: "/anomalies",
  }
]

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="border-r shadow-sm">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <BarChart3 className="text-white h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-headline font-bold text-sm tracking-tight text-primary uppercase">Walmart</span>
            <span className="text-[10px] text-muted-foreground font-medium">Análisis OC/OT</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Navegación Principal
          </SidebarGroupLabel>
          <SidebarMenu>
            {navigation.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url}
                  tooltip={item.title}
                  className={`hover:bg-primary/10 transition-colors duration-200 ${pathname === item.url ? 'text-primary bg-primary/5' : ''}`}
                >
                  <Link href={item.url}>
                    <item.icon className={`h-5 w-5 ${pathname === item.url ? 'text-primary' : ''}`} />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Inteligencia
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={pathname === '/chat'}
                tooltip="IA Asistente"
                className={`hover:bg-primary/10 transition-colors duration-200 ${pathname === '/chat' ? 'text-primary bg-primary/5' : ''}`}
              >
                <Link href="/chat">
                  <BrainCircuit className={`h-5 w-5 ${pathname === '/chat' ? 'text-primary' : ''}`} />
                  <span className="font-medium">IA Asistente</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Ayuda">
              <HelpCircle className="h-5 w-5" />
              <span>Soporte Técnico</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
