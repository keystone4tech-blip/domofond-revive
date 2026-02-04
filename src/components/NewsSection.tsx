import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, Calendar, X } from "lucide-react";
import { LikesSection } from "./LikesSection";
import { CommentsSection } from "./CommentsSection";
import Modal from "./Modal";

interface NewsItem {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  image_url: string | null;
  published_at: string | null;
}

export const NewsSection = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const openModal = (newsItem: NewsItem) => {
    setSelectedNews(newsItem);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedNews(null);
  };

  if (loading || news.length === 0) return null;

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Newspaper className="h-6 w-6 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-center">Последние новости</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {news.map((item) => (
            <Card 
              key={item.id} 
              className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              onClick={() => openModal(item)}
            >
              {item.image_url && (
                <div className="relative h-40 sm:h-48 overflow-hidden">
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                </div>
              )}
              <CardContent className="p-4 sm:p-6">
                {item.published_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(item.published_at).toLocaleDateString("ru-RU")}
                  </div>
                )}
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{item.title}</h3>
                {item.excerpt && (
                  <p className="text-sm sm:text-base text-muted-foreground line-clamp-3">
                    {item.excerpt}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex items-center gap-2 border-t pt-4">
                <LikesSection contentType="news" contentId={item.id} />
                <CommentsSection contentType="news" contentId={item.id} />
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(item);
                  }}
                >
                  Подробнее
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Modal for news details */}
        <Modal isOpen={isModalOpen} onClose={closeModal}>
          {selectedNews && (
            <div className="p-6">
              {selectedNews.image_url && (
                <div className="relative h-64 sm:h-80 mb-6 overflow-hidden rounded-lg">
                  <img
                    src={selectedNews.image_url}
                    alt={selectedNews.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="mb-4">
                {selectedNews.published_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(selectedNews.published_at).toLocaleDateString("ru-RU")}
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{selectedNews.title}</h3>
                <div className="prose max-w-none">
                  {selectedNews.content || selectedNews.excerpt}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t flex justify-between">
                <div className="flex gap-2">
                  <LikesSection contentType="news" contentId={selectedNews.id} />
                  <CommentsSection contentType="news" contentId={selectedNews.id} />
                </div>
                <Button onClick={closeModal}>
                  Закрыть
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </section>
  );
};