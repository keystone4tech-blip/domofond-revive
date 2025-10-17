import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, Users, Clock, Shield, TrendingUp, Star, CheckCircle, Zap } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";

const iconMap = {
  Users,
  Clock,
  Award,
  Shield,
  TrendingUp,
  Star,
  CheckCircle,
  Zap,
};

interface StatBlock {
  id: string;
  icon: string;
  value: string;
  label: string;
  color?: string;
  order_index: number;
}

const StatCard = ({ stat }: { stat: StatBlock }) => {
  const Icon = iconMap[stat.icon as keyof typeof iconMap] || Users;
  const numericValue = parseInt(stat.value.replace(/[^\d]/g, '')) || 0;
  const suffix = stat.value.replace(/[\d\s]/g, '');
  const { count } = useCountUp(numericValue, 2000);
  
  return (
    <div
      className="flex flex-col items-center justify-center p-6 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-border hover:border-primary/50 transition-all duration-300 group"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4 relative animate-pulse-glow">
        <Icon className="h-7 w-7 text-primary transition-all duration-300 group-hover:scale-110" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 animate-glow" />
      </div>
      <div className="text-3xl font-bold text-primary mb-2">
        {count}{suffix}
      </div>
      <div className="text-sm text-center text-muted-foreground">{stat.label}</div>
    </div>
  );
};

const About = () => {
  const [stats, setStats] = useState<StatBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("site_blocks")
        .select("*")
        .eq("page", "index")
        .eq("block_name", "stats")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const statsData = data.map((block) => {
          const content = block.content as any;
          return {
            id: block.id,
            icon: content?.icon || "Users",
            value: content?.value || "0",
            label: content?.label || "",
            color: content?.color,
            order_index: block.order_index || 0,
          };
        });
        setStats(statsData);
      } else {
        // Default stats if none in database
        setStats([
          { id: '1', icon: 'Users', value: '10 000+', label: 'Довольных клиентов', order_index: 0 },
          { id: '2', icon: 'Clock', value: '18 лет', label: 'На рынке с 2005 года', order_index: 1 },
          { id: '3', icon: 'Award', value: '100%', label: 'Гарантия качества', order_index: 2 },
          { id: '4', icon: 'Shield', value: '24/7', label: 'Аварийная служба', order_index: 3 },
        ]);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <section id="about" className="py-16 md:py-24">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-6">
              Почему выбирают нас
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="text-lg">
                <span className="font-semibold text-foreground">Домофондар</span> — это профессиональная команда 
                специалистов с многолетним опытом работы в сфере установки и обслуживания домофонных систем.
              </p>
              <p>
                Мы работаем как с жилыми комплексами, так и с коммерческими объектами, предлагая индивидуальный 
                подход к каждому клиенту. Наши специалисты регулярно проходят обучение и сертификацию, чтобы 
                предоставлять услуги высочайшего качества.
              </p>
              <p>
                Используем только проверенное оборудование от ведущих производителей и предоставляем расширенную 
                гарантию на все выполненные работы.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {stats.map((stat) => (
              <StatCard key={stat.id} stat={stat} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
