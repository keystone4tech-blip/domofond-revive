import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Newspaper, Calendar } from "lucide-react";
import { LikesSection } from "./LikesSection";
import { CommentsSection } from "./CommentsSection";

interface News {
  id: string;
  title: string;
  excerpt: string | null;
  image_url: string | null;
  published_at: string | null;
}

export const NewsSection = () => {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from("news")
        .select("*")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setNews(data || []);
    } catch (error) {
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || news.length === 0) return null;

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-12">
          <Newspaper className="h-8 w-8 text-primary" />
          <h2 className="text-3xl md:text-4xl font-bold text-center">Последние новости</h2>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {item.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <CardContent className="p-6">
                {item.published_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(item.published_at).toLocaleDateString("ru-RU")}
                  </div>
                )}
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                {item.excerpt && (
                  <p className="text-muted-foreground mb-4">{item.excerpt}</p>
                )}
              </CardContent>
              <CardFooter className="flex gap-2 border-t pt-4">
                <LikesSection contentType="news" contentId={item.id} />
                <CommentsSection contentType="news" contentId={item.id} />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};