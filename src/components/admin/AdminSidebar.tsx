import React from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { 
  Calculator, Sparkles, Newspaper, Vote, BarChart3, Tag, 
  FileText, Crown, MessageSquare, Hash, Grid, CreditCard, 
  Bot, History, Home, LogOut, Shield, ChevronLeft, ChevronRight, Database,
  LayoutDashboard, User, Camera, Trash2, FileCode2, X
} from "lucide-react";
import { cn } from "@/lib/utils";

// Пропсы для боковой панели администратора
interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean; // Флаг открытого мобильного меню
  setIsOpen?: (open: boolean) => void;
}

// 17 элементов навигации разделов управления админ-панели
const menuItems = [
  { id: "portfolio", label: "📸 Портфолио и отзывы", icon: Camera },
  { id: "calculations", label: "Расчёты стоимости", icon: Calculator },
  { id: "accounts", label: "Лицевые счета", icon: CreditCard },
  { id: "backups", label: "💾 Резервные копии БД", icon: Database },
  { id: "seo", label: "🪄 SEO AI Генератор", icon: Sparkles },
  { id: "autonews", label: "📰 Авто-новости AI", icon: Newspaper },
  { id: "voting", label: "🗳️ Голосования жителей", icon: Vote },
  { id: "stats", label: "Статистика переходов", icon: BarChart3 },
  { id: "promotions", label: "Акции и скидки", icon: Tag },
  { id: "news", label: "Новости сервиса", icon: FileText },
  { id: "premium", label: "Премиум-блоки", icon: Crown },
  { id: "comments", label: "Комментарии", icon: MessageSquare },
  { id: "statsblocks", label: "Счётчики сайта", icon: Hash },
  { id: "blocks", label: "Редактор блоков", icon: Grid },
  { id: "chatwidget", label: "AI-ассистент чата", icon: Bot },
  { id: "chathistory", label: "История диалогов чата", icon: History },
  { id: "deleted", label: "🗑️ Корзина удалённых", icon: Trash2 },
];

export const AdminSidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }: AdminSidebarProps) => {
  const navigate = useNavigate();

  // Логирование и переключение активной вкладки
  const handleTabClick = (tabId: string) => {
    console.log(`[AdminSidebar] Переключение вкладки админ-панели на: ${tabId}`);
    setActiveTab(tabId);
    if (setIsOpen) setIsOpen(false); // Автоматически скрываем мобильный сайдбар при выборе
  };

  // Выход из системы
  const handleLogout = async () => {
    console.log("[AdminSidebar] Выход администратора из системы...");
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <aside className={cn(
      "w-72 sm:w-80 lg:w-64 h-screen flex flex-col justify-between transition-all duration-300",
      "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800/80",
      "fixed top-0 left-0 z-50 shadow-2xl lg:shadow-none",
      // Мобильная адаптивность с плавной анимацией выдвижения
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Верхний блок: Логотип, статус роли и кнопка закрытия на мобильных */}
      <div>
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Shield className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-logo font-extrabold text-sm tracking-wide text-foreground uppercase">Домофондар</span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">Панель управления</span>
            </div>
          </div>

          {/* Кнопка закрытия сайдбара на мобильных экранах */}
          <button
            onClick={() => setIsOpen && setIsOpen(false)}
            className="lg:hidden p-1.5 rounded-xl text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Закрыть боковое меню"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Список вкладок (Скроллируемый контейнер с оптимизированным скроллбаром) */}
        <nav className="p-3 space-y-1 max-h-[calc(100vh-17rem)] overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 text-left",
                  isActive 
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/25 scale-[1.01]"
                    : "text-muted-foreground hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-muted-foreground/80")} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Нижний блок быстрых переходов: Инженерный паспорт (только для админа), CRM, ЛК, Сайт и Выход */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1 bg-slate-50/60 dark:bg-slate-900/60">
        
        {/* Инженерный паспорт платформы — доступен ТОЛЬКО администраторам */}
        <Link 
          to="/project" 
          onClick={() => setIsOpen && setIsOpen(false)}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300/40 dark:border-amber-800/40 hover:bg-amber-100/80 transition-all"
        >
          <FileCode2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate">Инженерный паспорт (877 ч)</span>
        </Link>

        {/* Переход в CRM FSM */}
        <Link 
          to="/fsm" 
          onClick={() => setIsOpen && setIsOpen(false)}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50/80 dark:hover:bg-blue-950/30 transition-all"
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span>CRM Заявки и мастера</span>
        </Link>

        {/* Переход в Личный кабинет */}
        <Link 
          to="/cabinet" 
          onClick={() => setIsOpen && setIsOpen(false)}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-foreground transition-all"
        >
          <User className="h-4 w-4 shrink-0" />
          <span>Личный кабинет</span>
        </Link>

        {/* Переход на Главную */}
        <Link 
          to="/" 
          onClick={() => setIsOpen && setIsOpen(false)}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-foreground transition-all"
        >
          <Home className="h-4 w-4 shrink-0" />
          <span>На главную страницу</span>
        </Link>

        {/* Кнопка выхода */}
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all text-left"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Выйти из аккаунта</span>
        </button>
      </div>
    </aside>
  );
};
