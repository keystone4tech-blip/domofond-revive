import { useEffect, useState } from "react";
import { Star, Smartphone, Video, HardDrive, ScanFace, Shield, Lock, Camera, Bell, Home, Zap, Wifi, Clock, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PremiumBlock {
  id: string;
  badge_text: string;
  badge_color: string;
  badge_icon: string;
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
  Star,
  ScanFace,
  Smartphone,
  Video,
  HardDrive,
  Shield,
  Lock,
  Camera,
  Bell,
  Home,
  Zap,
  Wifi,
  Clock,
  Award,
};

const colorMap: Record<string, string> = {
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  warning: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  accent: "bg-purple-500/10 text-purple-600 border-purple-500/20",
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
    <section className="py-8 md:py-12 bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="container px-4">
        <div className={`grid gap-6 ${
          blocks.length === 1 ? "max-w-5xl mx-auto" :
          blocks.length === 2 ? "md:grid-cols-2 max-w-6xl mx-auto" :
          blocks.length === 3 ? "md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto" :
          "md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto"
        }`}>
          {blocks.map((block) => {
            const BadgeIcon = iconMap[block.badge_icon] || Star;
            const badgeColorClass = colorMap[block.badge_color] || colorMap.primary;
            
            return (
              <Card key={block.id} className="overflow-hidden border-2 border-primary/20 shadow-xl hover:shadow-2xl transition-shadow">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full mb-4 border ${badgeColorClass}`}>
                      <BadgeIcon className="h-4 w-4 fill-current" />
                      <span className="text-sm font-semibold">{block.badge_text}</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">
                      {block.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {block.description}
                    </p>
                  </div>

                  <div className="space-y-4 mb-6">
                    <h4 className="font-semibold text-sm">Возможности:</h4>
                    {block.features.map((feature, index) => {
                      const IconComponent = iconMap[feature.icon] || Star;
                      return (
                        <div key={index} className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <IconComponent className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h5 className="font-semibold text-sm mb-1">{feature.title}</h5>
                            <p className="text-xs text-muted-foreground">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-primary/5 rounded-xl p-4 border border-primary/20 mb-4">
                    <div className="text-center mb-3">
                      <div className="text-2xl font-bold text-primary mb-1">{block.price}</div>
                      <p className="text-xs text-muted-foreground">{block.price_description}</p>
                    </div>
                    <ul className="space-y-2 mb-4 text-xs">
                      {block.benefits.map((benefit, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="text-primary flex-shrink-0">✓</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    <Button onClick={scrollToContact} className="w-full" size="sm">
                      Консультация
                    </Button>
                  </div>
                  
                  <p className="text-xs text-center text-muted-foreground">
                    {block.disclaimer}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PremiumOffer;
