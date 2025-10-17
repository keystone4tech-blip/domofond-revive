import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import { LikesSection } from "./LikesSection";
import { CommentsSection } from "./CommentsSection";

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

export const PromotionsSection = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setPromotions(data || []);
    } catch (error) {
      console.error("Error fetching promotions:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || promotions.length === 0) return null;

  return (
    <section className="py-16 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-12">
          <Megaphone className="h-8 w-8 text-primary" />
          <h2 className="text-3xl md:text-4xl font-bold text-center">Актуальные акции</h2>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promotions.map((promotion) => (
            <Card key={promotion.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              {promotion.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={promotion.image_url}
                    alt={promotion.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{promotion.title}</h3>
                {promotion.description && (
                  <p className="text-muted-foreground">{promotion.description}</p>
                )}
              </CardContent>
              <CardFooter className="flex gap-2 border-t pt-4">
                <LikesSection contentType="promotion" contentId={promotion.id} />
                <CommentsSection contentType="promotion" contentId={promotion.id} />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};