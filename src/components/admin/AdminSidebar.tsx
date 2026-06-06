import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { 
  Calculator, Sparkles, Newspaper, Vote, BarChart3, Tag, 
  FileText, Crown, MessageSquare, Hash, Grid, CreditCard, 
  Bot, History, Home, LogOut, Shield, ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

// Пропсы для боковой панели
interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean; // Для мобильной шторки
  setIsOpen?: (open: boolean) => void;
}

// Элементы навигации админки
const menuItems = [
  { id: "calculations", label: "Расчёты", icon: Calculator },
  { id: "seo", label: "🪄 SEO AI", icon: Sparkles },
  { id: "autonews", label: "📰 Авто-новости", icon: Newspaper },
  { id: "voting", label: "🗳️ Голосования", icon: Vote },
  { id: "stats", label: "Статистика", icon: BarChart3 },
  { id: "promotions", label: "Акции", icon: Tag },
  { id: "news", label: "Новости", icon: FileText },
  { id: "premium", label: "Премиум", icon: Crown },
  { id: "comments", label: "Комментарии", icon: MessageSquare },
  { id: "statsblocks", label: "Счётчики", icon: Hash },
  { id: "blocks", label: "Блоки", icon: Grid },
  { id: "accounts", label: "Лиц. счета", icon: CreditCard },
  { id: "chatwidget", label: "AI-чат", icon: Bot },
  { id: "chathistory", label: "История чатов", icon: History },
];

export const AdminSidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }: AdminSidebarProps) => {
  const navigate = useNavigate();

  // Логирование переключения вкладок
  const handleTabClick = (tabId: string) => {
    console.log(`[AdminSidebar] Переключение вкладки на: ${tabId}`);
    setActiveTab(tabId);
    if (setIsOpen) setIsOpen(false); // Закрываем мобильное меню при выборе
  };

  // Выход из сессии
  const handleLogout = async () => {
    console.log("[AdminSidebar] Выход из системы...");
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside className={cn(
      "w-64 h-screen flex flex-col justify-between transition-all duration-300",
      "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-slate-200/50 dark:border-slate-800/50",
      "fixed top-0 left-0 z-50",
      // Мобильная адаптивность
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Верхний блок: Логотип и роль */}
      <div>
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100 dark:border-slate-800/80">
          <Shield className="h-6 w-6 text-primary animate-pulse" />
          <div className="flex flex-col text-left">
            <span className="font-logo font-extrabold text-sm tracking-wide text-foreground uppercase">LuxTech Security</span>
            <span className="text-[10px] text-muted-foreground font-semibold">Панель управления</span>
          </div>
        </div>

        {/* Список вкладок (Скроллируемый контейнер) */}
        <nav className="p-4 space-y-1 max-h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]"
                    : "text-muted-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-muted-foreground/80")} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Нижний блок: Навигация на сайт и Выход */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 space-y-1 bg-white/40 dark:bg-slate-900/40">
        <Link 
          to="/" 
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-slate-100/70 dark:hover:bg-slate-800/50 hover:text-foreground transition-all duration-200"
        >
          <Home className="h-4 w-4 shrink-0" />
          <span>На главную</span>
        </Link>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Выйти</span>
        </button>
      </div>
    </aside>
  );
};
