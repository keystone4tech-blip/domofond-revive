import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, X } from "lucide-react";
import { LikesSection } from "./LikesSection";
import { CommentsSection } from "./CommentsSection";
import Modal from "./Modal";

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  full_description: string | null;
  image_url: string | null;
  created_at: string;
}

export const PromotionsSection = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const openModal = (promotion: Promotion) => {
    setSelectedPromotion(promotion);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPromotion(null);
  };

  if (loading || promotions.length === 0) return null;

  return (
    <section className="py-8 md:py-12 bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Megaphone className="h-6 w-6 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-center">Актуальные акции</h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {promotions.map((promotion) => (
            <Card 
              key={promotion.id} 
              className="overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              onClick={() => openModal(promotion)}
            >
              {promotion.image_url && (
                <div className="relative h-40 sm:h-48 overflow-hidden">
                  <img
                    src={promotion.image_url}
                    alt={promotion.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                </div>
              )}
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">{promotion.title}</h3>
                {promotion.description && (
                  <p className="text-sm sm:text-base text-muted-foreground line-clamp-3">
                    {promotion.description}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex items-center gap-2 border-t pt-4">
                <LikesSection contentType="promotion" contentId={promotion.id} />
                <CommentsSection contentType="promotion" contentId={promotion.id} />
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(promotion);
                  }}
                >
                  Подробнее
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Modal for promotion details */}
        <Modal isOpen={isModalOpen} onClose={closeModal}>
          {selectedPromotion && (
            <div className="p-6">
              {selectedPromotion.image_url && (
                <div className="relative h-64 sm:h-80 mb-6 overflow-hidden rounded-lg">
                  <img
                    src={selectedPromotion.image_url}
                    alt={selectedPromotion.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-2xl font-bold mb-2">{selectedPromotion.title}</h3>
                <div className="prose max-w-none">
                  {selectedPromotion.full_description || selectedPromotion.description}
                </div>
              </div>
              <div className="mt-6 pt-4 border-t flex justify-between">
                <div className="flex gap-2">
                  <LikesSection contentType="promotion" contentId={selectedPromotion.id} />
                  <CommentsSection contentType="promotion" contentId={selectedPromotion.id} />
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