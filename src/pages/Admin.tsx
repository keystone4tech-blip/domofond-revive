import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PromotionsManager } from "@/components/admin/PromotionsManager";
import { NewsManager } from "@/components/admin/NewsManager";
import { BlocksManager } from "@/components/admin/BlocksManager";
import { PremiumBlocksManager } from "@/components/admin/PremiumBlocksManager";
import { SiteStats } from "@/components/admin/SiteStats";
import { CommentsManager } from "@/components/admin/CommentsManager";
import { StatsBlocksManager } from "@/components/admin/StatsBlocksManager";
import { CalculationsManager } from "@/components/admin/CalculationsManager";
import { ChatWidgetManager } from "@/components/admin/ChatWidgetManager";
import { ChatHistoryManager } from "@/components/admin/ChatHistoryManager";
import { AccountsManager } from "@/components/admin/AccountsManager";
import { SEOManager } from "@/components/admin/SEOManager";
import { NewsAutomation } from "@/components/admin/NewsAutomation";
import { VotingManager } from "@/components/admin/VotingManager";
import { BackupsManager } from "@/components/admin/BackupsManager";
import { PortfolioManager } from "@/components/admin/PortfolioManager";
import { DeletedItemsManager } from "@/components/admin/DeletedItemsManager";
import { Loader2, Shield, Menu, ChevronRight, LayoutDashboard, User, Home, CreditCard, Calculator, X } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { cn } from "@/lib/utils";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasConsoleAccess, setHasConsoleAccess] = useState(false);
  
  // Активная вкладка управления
  const [activeTab, setActiveTab] = useState("calculations");
  
  // Состояние мобильного сайдбара
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false,
  });

  useEffect(() => {
    if (!loading && hasConsoleAccess) {
      console.log("[Admin] Инициализация панели администратора...");
      setTimeout(() => setIsVisible((prev) => ({ ...prev, header: true })), 200);
      setTimeout(() => setIsVisible((prev) => ({ ...prev, content: true })), 400);
    }
  }, [loading, hasConsoleAccess]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Доступ запрещен",
          description: "Необходимо войти в систему",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      console.log("[Admin] Проверка прав доступа для пользователя:", user.id);
      // 1. Проверяем роль в таблице базы данных
      const { data: role, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "director", "superadmin"])
        .limit(1)
        .maybeSingle();

      // 2. Резервная проверка роли из данных текущей сессии
      const localRole = (user as any)?.role || (user as any)?.userRole;
      const hasLocalAdminRole = ["admin", "director", "superadmin"].includes(localRole);

      if ((error || !role) && !hasLocalAdminRole) {
        console.warn("[Admin] Доступ отклонен. DB role:", role, "ошибка:", error, "localRole:", localRole);
        toast({
          title: "Доступ запрещен",
          description: "У вас нет прав для доступа к панели управления",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      console.log("[Admin] Доступ к панели администратора разрешен:", role?.role || localRole);
      setHasConsoleAccess(true);
    } catch (error) {
      console.error("[Admin] Ошибка при проверке доступа администратора:", error);
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasConsoleAccess) {
    return null;
  }

  const getTabLabel = () => {
    switch (activeTab) {
      case "portfolio": return "Портфолио и отзывы";
      case "calculations": return "Расчёты стоимости";
      case "accounts": return "Лицевые счета абонентов";
      case "backups": return "Резервные копии БД";
      case "seo": return "SEO AI Оптимизация";
      case "autonews": return "Автоматические новости";
      case "voting": return "Голосования жителей";
      case "stats": return "Статистика переходов";
      case "promotions": return "Акции компании";
      case "news": return "Новости сервиса";
      case "premium": return "Премиум-блоки";
      case "comments": return "Комментарии пользователей";
      case "statsblocks": return "Счётчики сайта";
      case "blocks": return "Редактор блоков";
      case "chatwidget": return "AI-ассистент чата";
      case "chathistory": return "История диалогов чата";
      case "deleted": return "Корзина удалённых";
      default: return "Администрирование";
    }
  };

  return (
    <div className="min-h-screen flex bg-background overflow-x-hidden w-full relative">
      
      {/* Затемняющая полупрозрачная подложка (Backdrop Overlay) для закрытия сайдбара по клику мимо */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => {
            console.log("[Admin] Закрытие мобильного сайдбара по клику на подложку");
            setIsMobileSidebarOpen(false);
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          aria-label="Закрыть боковое меню"
        />
      )}

      {/* Боковой сайдбар для ПК и мобильная шторка */}
      <AdminSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isMobileSidebarOpen}
        setIsOpen={setIsMobileSidebarOpen}
      />

      {/* Основная контентная область справа: overflow-x-hidden предотвращает горизонтальный скролл */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden lg:pl-64 transition-all duration-300">
        
        {/* Верхний Top Bar управления с быстрыми ссылками для мобильных и ПК */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 px-3 sm:px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Кнопка открытия меню разделов для мобильных */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-1 rounded-xl lg:hidden text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Открыть меню разделов"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Хлебные крошки / Название текущей вкладки */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-sm min-w-0">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] hidden sm:inline shrink-0">Админ панель</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60 hidden sm:inline shrink-0" />
              <span className="font-bold text-foreground tracking-tight truncate text-xs sm:text-sm">{getTabLabel()}</span>
            </div>
          </div>

          {/* Правая часть: быстрые ссылки в ЛК, CRM, переключатель темы */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Быстрый переход в CRM */}
            <Link
              to="/fsm"
              className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40 text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors"
              title="Перейти в CRM FSM"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CRM</span>
            </Link>

            {/* Быстрый переход в Личный кабинет */}
            <Link
              to="/cabinet"
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-foreground text-xs font-bold flex items-center gap-1 hover:bg-slate-200 transition-colors"
              title="Перейти в Личный кабинет"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Кабинет</span>
            </Link>

            {/* Статус администратора (на ПК) */}
            <div className="hidden md:flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 p-1.5 pl-2.5 pr-2.5 rounded-xl border border-purple-200/50 dark:border-purple-850">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                Администратор
              </span>
            </div>

            <ThemeToggle />
          </div>
        </header>

        {/* Скроллируемая область контента: pb-24 sm:pb-28 lg:pb-8 гарантирует, что нижние кнопки сохранения никогда не перекрываются */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 pb-24 sm:pb-28 lg:pb-8 w-full overflow-x-hidden min-w-0">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={`w-full ${isVisible.content ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
          >
            <TabsContent value="portfolio" className="mt-0 outline-none">
              <PortfolioManager />
            </TabsContent>

            <TabsContent value="calculations" className="mt-0 outline-none">
              <CalculationsManager />
            </TabsContent>

            <TabsContent value="accounts" className="mt-0 outline-none">
              <AccountsManager />
            </TabsContent>

            <TabsContent value="backups" className="mt-0 outline-none">
              <BackupsManager />
            </TabsContent>

            <TabsContent value="seo" className="mt-0 outline-none">
              <SEOManager />
            </TabsContent>

            <TabsContent value="autonews" className="mt-0 outline-none">
              <NewsAutomation />
            </TabsContent>

            <TabsContent value="voting" className="mt-0 outline-none">
              <VotingManager />
            </TabsContent>

            <TabsContent value="stats" className="mt-0 outline-none">
              <SiteStats />
            </TabsContent>

            <TabsContent value="promotions" className="mt-0 outline-none">
              <PromotionsManager />
            </TabsContent>

            <TabsContent value="news" className="mt-0 outline-none">
              <NewsManager />
            </TabsContent>

            <TabsContent value="premium" className="mt-0 outline-none">
              <PremiumBlocksManager />
            </TabsContent>

            <TabsContent value="comments" className="mt-0 outline-none">
              <CommentsManager />
            </TabsContent>

            <TabsContent value="statsblocks" className="mt-0 outline-none">
              <StatsBlocksManager />
            </TabsContent>

            <TabsContent value="blocks" className="mt-0 outline-none">
              <BlocksManager />
            </TabsContent>

            <TabsContent value="chatwidget" className="mt-0 outline-none">
              <ChatWidgetManager />
            </TabsContent>

            <TabsContent value="chathistory" className="mt-0 outline-none">
              <ChatHistoryManager />
            </TabsContent>

            <TabsContent value="deleted" className="mt-0 outline-none">
              <DeletedItemsManager />
            </TabsContent>
          </Tabs>
        </main>

        {/* Компактный нижний тулбар администратора для мобильных экранов (lg:hidden) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom shadow-lg">
          <div className="flex items-center justify-around h-16 px-1.5">
            {/* 1. Кнопка открытия всех 17 разделов */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
            >
              <Menu className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-[10px] font-bold text-foreground">Разделы</span>
            </button>

            {/* 2. Расчёты тарифов */}
            <button
              onClick={() => setActiveTab("calculations")}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all active:scale-95",
                activeTab === "calculations" ? "text-purple-600 dark:text-purple-400 font-bold" : "text-muted-foreground"
              )}
            >
              <Calculator className="h-5 w-5" />
              <span className="text-[10px] font-medium">Расчёты</span>
            </button>

            {/* 3. Лицевые счета */}
            <button
              onClick={() => setActiveTab("accounts")}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-all active:scale-95",
                activeTab === "accounts" ? "text-purple-600 dark:text-purple-400 font-bold" : "text-muted-foreground"
              )}
            >
              <CreditCard className="h-5 w-5" />
              <span className="text-[10px] font-medium">Счета</span>
            </button>

            {/* 4. CRM FSM */}
            <Link
              to="/fsm"
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-blue-600 dark:text-blue-400 hover:text-blue-700 active:scale-95 transition-all"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-[10px] font-semibold">CRM FSM</span>
            </Link>

            {/* 5. Личный кабинет */}
            <Link
              to="/cabinet"
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
            >
              <User className="h-5 w-5" />
              <span className="text-[10px] font-semibold">Кабинет</span>
            </Link>
          </div>
        </nav>

      </div>
    </div>
  );
};

const AdminWithErrorBoundary = () => (
  <ErrorBoundary title="Критическая ошибка панели администратора">
    <Admin />
  </ErrorBoundary>
);

export default AdminWithErrorBoundary;
