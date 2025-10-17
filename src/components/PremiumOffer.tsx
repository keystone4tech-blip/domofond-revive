import { useEffect, useState } from "react";
import { Star, Smartphone, Video, HardDrive, ScanFace } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PremiumBlock {
  id: string;
  badge_text: string;
  title: string;
  description: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  price: string;
  price_description: string;
  benefits: string[];
  disclaimer: string;
  is_active: boolean;
}

const iconMap: Record<string, any> = {
  ScanFace,
  Smartphone,
  Video,
  HardDrive,
};

const PremiumOffer = () => {
  const [blocks, setBlocks] = useState<PremiumBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from("site_blocks")
        .select("*")
        .eq("page", "index")
        .eq("block_name", "premium_offer")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;

      if (data) {
        setBlocks(data.map(block => block.content as unknown as PremiumBlock));
      }
    } catch (error) {
      console.error("Error fetching premium blocks:", error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToContact = () => {
    const element = document.getElementById("contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (loading || blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block) => (
        <section key={block.id} className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <div className="container px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 sm:px-4 py-2 rounded-full mb-4">
                <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                <span className="text-sm sm:text-base font-semibold">{block.badge_text}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl mb-4">
                {block.title}
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
                {block.description}
              </p>
            </div>

            <div className="max-w-5xl mx-auto">
              <Card className="overflow-hidden border-2 border-primary/20 shadow-2xl">
                <CardContent className="p-4 sm:p-6 md:p-8 lg:p-12">
                  <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Возможности системы</h3>
                      <div className="space-y-3 sm:space-y-4">
                        {block.features.map((feature, index) => {
                          const IconComponent = iconMap[feature.icon] || Star;
                          return (
                            <div key={index} className="flex items-start gap-3 sm:gap-4">
                              <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-semibold mb-1 text-sm sm:text-base">{feature.title}</h4>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {feature.description}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4 sm:space-y-6 mt-6 md:mt-0">
                      <div className="bg-primary/5 rounded-2xl p-4 sm:p-6 border border-primary/20">
                        <div className="text-center mb-4">
                          <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">{block.price}</div>
                          <p className="text-xs sm:text-sm text-muted-foreground">{block.price_description}</p>
                        </div>
                        <ul className="space-y-2 mb-4 sm:mb-6 text-xs sm:text-sm">
                          {block.benefits.map((benefit, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <span className="text-primary flex-shrink-0">✓</span>
                              <span>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                        <Button onClick={scrollToContact} className="w-full" size="lg">
                          Получить консультацию
                        </Button>
                      </div>
                      
                      <p className="text-xs text-center text-muted-foreground px-2">
                        {block.disclaimer}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      ))}
    </>
  );
};

export default PremiumOffer;
