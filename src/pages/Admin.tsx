import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2, Shield, Menu, ChevronRight } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasConsoleAccess, setHasConsoleAccess] = useState(false);
  
  // Активная вкладка
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

      const { data: role, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "director"])
        .maybeSingle();

      if (error || !role) {
        toast({
          title: "Доступ запрещен",
          description: "У вас нет прав для доступа к панели управления",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setHasConsoleAccess(true);
    } catch (error) {
      console.error("Error checking admin access:", error);
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
      case "calculations": return "Расчёты стоимости";
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
      case "accounts": return "Лицевые счета абонентов";
      case "chatwidget": return "AI-ассистент чата";
      case "chathistory": return "История диалогов чата";
      default: return "Администрирование";
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Боковой сайдбар для ПК и мобильная шторка */}
      <AdminSidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isMobileSidebarOpen}
        setIsOpen={setIsMobileSidebarOpen}
      />

      {/* Основная контентная область справа */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-64 transition-all duration-300">
        
        {/* Верхний Top Bar управления */}
        <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-900/75 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Кнопка бургера для мобильных */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl lg:hidden text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Хлебные крошки */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] hidden sm:inline">Панель</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60 hidden sm:inline" />
              <span className="font-bold text-foreground tracking-tight">{getTabLabel()}</span>
            </div>
          </div>

          {/* Кнопки переключения тем и выходов */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100/55 dark:bg-slate-800/40 p-1.5 pl-3 pr-2.5 rounded-xl border border-slate-200/30 dark:border-slate-850">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Администратор
              </span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Скроллируемая область контента */}
        <main className="flex-1 p-4 lg:p-6 max-w-full overflow-x-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className={`w-full ${isVisible.content ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
          >
            <TabsContent value="calculations" className="mt-0 outline-none">
              <CalculationsManager />
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

            <TabsContent value="accounts" className="mt-0 outline-none">
              <AccountsManager />
            </TabsContent>

            <TabsContent value="chatwidget" className="mt-0 outline-none">
              <ChatWidgetManager />
            </TabsContent>

            <TabsContent value="chathistory" className="mt-0 outline-none">
              <ChatHistoryManager />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Admin;
