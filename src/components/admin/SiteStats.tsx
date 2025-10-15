import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, FileText, Megaphone, Boxes } from "lucide-react";

export const SiteStats = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalNews: 0,
    publishedNews: 0,
    totalPromotions: 0,
    activePromotions: 0,
    totalBlocks: 0,
    activeBlocks: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [
        { count: totalUsers },
        { count: totalNews },
        { count: publishedNews },
        { count: totalPromotions },
        { count: activePromotions },
        { count: totalBlocks },
        { count: activeBlocks },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("news").select("*", { count: "exact", head: true }),
        supabase.from("news").select("*", { count: "exact", head: true }).eq("is_published", true),
        supabase.from("promotions").select("*", { count: "exact", head: true }),
        supabase.from("promotions").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("site_blocks").select("*", { count: "exact", head: true }),
        supabase.from("site_blocks").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        totalNews: totalNews || 0,
        publishedNews: publishedNews || 0,
        totalPromotions: totalPromotions || 0,
        activePromotions: activePromotions || 0,
        totalBlocks: totalBlocks || 0,
        activeBlocks: activeBlocks || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin mx-auto" />;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Пользователи</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalUsers}</div>
          <p className="text-xs text-muted-foreground">Зарегистрировано</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Новости</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.publishedNews}</div>
          <p className="text-xs text-muted-foreground">
            Опубликовано из {stats.totalNews}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Акции</CardTitle>
          <Megaphone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activePromotions}</div>
          <p className="text-xs text-muted-foreground">
            Активных из {stats.totalPromotions}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Блоки</CardTitle>
          <Boxes className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.activeBlocks}</div>
          <p className="text-xs text-muted-foreground">
            Активных из {stats.totalBlocks}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};