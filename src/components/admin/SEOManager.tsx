import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEOSettings } from "./seo/SEOSettings";
import { SEOKeywords } from "./seo/SEOKeywords";
import { SEOSuggestions } from "./seo/SEOSuggestions";
import { SEOHistory } from "./seo/SEOHistory";
import { Sparkles, KeyRound, ListChecks, History, Settings2 } from "lucide-react";

export const SEOManager = () => {
  const [tab, setTab] = useState("suggestions");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">AI SEO-оптимизация</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Автоматически улучшайте meta-теги, заголовки и тексты сайта с помощью искусственного интеллекта.
        Все предложения проверяются перед применением.
      </p>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 gap-1 h-auto">
          <TabsTrigger value="suggestions" className="gap-1.5">
            <ListChecks className="h-4 w-4" />
            <span className="hidden sm:inline">Предложения</span>
            <span className="sm:hidden">Заявки</span>
          </TabsTrigger>
          <TabsTrigger value="keywords" className="gap-1.5">
            <KeyRound className="h-4 w-4" />
            Ключи
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            История
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="h-4 w-4" />
            Настройки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="mt-4">
          <SEOSuggestions />
        </TabsContent>
        <TabsContent value="keywords" className="mt-4">
          <SEOKeywords />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <SEOHistory />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SEOSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};
