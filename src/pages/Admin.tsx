import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Loader2, Shield } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasConsoleAccess, setHasConsoleAccess] = useState(false);
  const [activeTab, setActiveTab] = useState("calculations");
  const [isVisible, setIsVisible] = useState({
    header: false,
    content: false,
  });

  useEffect(() => {
    if (!loading && hasConsoleAccess) {
      setTimeout(() => setIsVisible((prev) => ({ ...prev, header: true })), 500);
      setTimeout(() => setIsVisible((prev) => ({ ...prev, content: true })), 1000);
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasConsoleAccess) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div
          className={`mb-8 space-y-2 ${
            isVisible.header ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
          } transition-all duration-700 ease-out`}
        >
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Панель управления</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Доступ для администратора и директора. Администратор остаётся защищённым от изменения роли.
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={`w-full ${isVisible.content ? "opacity-100" : "opacity-0"} transition-opacity duration-700`}
        >
          <TabsList className="mb-6 flex h-auto w-full max-w-full items-center justify-start gap-2 overflow-x-auto rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="calculations" className="shrink-0 whitespace-nowrap">Расчёты</TabsTrigger>
            <TabsTrigger value="seo" className="shrink-0 whitespace-nowrap">🪄 SEO AI</TabsTrigger>
            <TabsTrigger value="stats" className="shrink-0 whitespace-nowrap">Статистика</TabsTrigger>
            <TabsTrigger value="promotions" className="shrink-0 whitespace-nowrap">Акции</TabsTrigger>
            <TabsTrigger value="news" className="shrink-0 whitespace-nowrap">Новости</TabsTrigger>
            <TabsTrigger value="premium" className="shrink-0 whitespace-nowrap">Премиум</TabsTrigger>
            <TabsTrigger value="comments" className="shrink-0 whitespace-nowrap">Комментарии</TabsTrigger>
            <TabsTrigger value="statsblocks" className="shrink-0 whitespace-nowrap">Счётчики</TabsTrigger>
            <TabsTrigger value="blocks" className="shrink-0 whitespace-nowrap">Блоки</TabsTrigger>
            <TabsTrigger value="accounts" className="shrink-0 whitespace-nowrap">Лиц. счета</TabsTrigger>
            <TabsTrigger value="chatwidget" className="shrink-0 whitespace-nowrap">AI-чат</TabsTrigger>
            <TabsTrigger value="chathistory" className="shrink-0 whitespace-nowrap">История чатов</TabsTrigger>
          </TabsList>

          <TabsContent value="calculations">
            <CalculationsManager />
          </TabsContent>

          <TabsContent value="seo">
            <SEOManager />
          </TabsContent>

          <TabsContent value="stats">
            <SiteStats />
          </TabsContent>

          <TabsContent value="promotions">
            <PromotionsManager />
          </TabsContent>

          <TabsContent value="news">
            <NewsManager />
          </TabsContent>

          <TabsContent value="premium">
            <PremiumBlocksManager />
          </TabsContent>

          <TabsContent value="comments">
            <CommentsManager />
          </TabsContent>

          <TabsContent value="statsblocks">
            <StatsBlocksManager />
          </TabsContent>

          <TabsContent value="blocks">
            <BlocksManager />
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsManager />
          </TabsContent>

          <TabsContent value="chatwidget">
            <ChatWidgetManager />
          </TabsContent>

          <TabsContent value="chathistory">
            <ChatHistoryManager />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Admin;
