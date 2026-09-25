import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Award, Users, Clock, Shield, TrendingUp, Star, CheckCircle, Zap } from "lucide-react";
import { useCountUp } from "@/hooks/use-count-up";

// Карта доступных иконок для счетчиков
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

export interface StatBlock {
  id: string;
  icon: string;
  value: string;
  label: string;
  source_type?: string;
  order_index: number;
}

// Эталонные блоки по умолчанию с реальными проверенными данными компании
const DEFAULT_STATS: StatBlock[] = [
  { 
    id: "default-clients", 
    icon: "Users", 
    value: "11 244", 
    label: "Довольных клиентов", 
    source_type: "accounts_db",
    order_index: 0 
  },
  { 
    id: "default-years-krd", 
    icon: "Clock", 
    value: "7 лет", 
    label: "На рынке Краснодара", 
    source_type: "krasnodar_years",
    order_index: 1 
  },
  { 
    id: "default-years-yufo", 
    icon: "TrendingUp", 
    value: "22 года", 
    label: "Опыт работы по ЮФО", 
    source_type: "yufo_years",
    order_index: 2 
  },
  { 
    id: "default-quality", 
    icon: "Award", 
    value: "100%", 
    label: "Гарантия качества", 
    source_type: "custom",
    order_index: 3 
  },
];

/**
 * Карточка одного статистического показателя
 * Поддерживает:
 * - Плавную числовую анимацию с разделением тысяч (например, «11 244»)
 * - Корректное сохранение процентов («100%») и суффиксов со словами («7 лет», «22 года»)
 * - Фиксированные строки со слэшами («24/7») без математических сбоев
 * - Премиальный лазурно-сапфировый стиль с мягким свечением и эффектом стекла
 */
const StatCard = ({ stat }: { stat: StatBlock }) => {
  const Icon = iconMap[stat.icon as keyof typeof iconMap] || Users;
  const rawValue = (stat.value || "").trim();

  // Проверяем, является ли значение специальным строковым форматом (например "24/7")
  const isSpecialNonNumeric = rawValue.includes("/") || isNaN(parseInt(rawValue.replace(/\s+/g, ""), 10));

  // Извлекаем первое числовое значение для плавной анимации
  const numericMatch = rawValue.match(/(\d[\d\s]*)/);
  const numericString = numericMatch ? numericMatch[0].replace(/\s+/g, "") : "0";
  const numericValue = parseInt(numericString, 10) || 0;

  // Суффикс (знаки %, +, слова "лет", "года" и т.п.)
  let suffix = "";
  if (numericMatch) {
    const afterNumber = rawValue.slice(numericMatch.index! + numericMatch[0].length);
    suffix = afterNumber;
  }

  // Хук плавной анимации чисел от 0 до numericValue
  const { count, elementRef } = useCountUp(isSpecialNonNumeric ? 0 : numericValue, 2000);

  // Форматируем число с красивым разделителем тысяч (например "11 244")
  const formattedCount = isSpecialNonNumeric 
    ? rawValue 
    : count.toLocaleString("ru-RU") + suffix;

  return (
    <div
      ref={elementRef}
      className="relative group p-6 rounded-2xl bg-card/75 backdrop-blur-md border border-border/70 hover:border-primary/50 shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-500 flex flex-col items-center justify-center text-center overflow-hidden"
    >
      {/* Деликатный верхний световой блик при наведении */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Иконка в сапфирово-лазурном круге с мягким свечением */}
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary transition-all duration-500 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-[0_0_25px_rgba(56,189,248,0.35)]">
        <Icon className="h-7 w-7 transition-transform duration-500" />
      </div>

      {/* Анимированное числовое значение */}
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300 mb-2">
        {formattedCount}
      </div>

      {/* Текстовая подпись показателя */}
      <div className="text-sm font-medium text-muted-foreground leading-snug">
        {stat.label}
      </div>
    </div>
  );
};

/**
 * Секция ключевых статистических показателей компании на главной странице
 */
const Stats = () => {
  const [stats, setStats] = useState<StatBlock[]>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  /**
   * Загрузка показателей: сначала проверяем API /api/public-stats с реальными данными из БД,
   * а при необходимости синхронизируемся с site_blocks.
   */
  const fetchStats = async () => {
    try {
      // 1. Пробуем получить актуальные данные через бэкенд эндпоинт
      const response = await fetch("/backend-api/api/public-stats");
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.stats?.blocks?.length > 0) {
          setStats(result.stats.blocks);
          return;
        }
      }

      // 2. Fallback: прямой запрос к таблице site_blocks
      const { data, error } = await supabase
        .from("site_blocks")
        .select("*")
        .eq("page", "index")
        .eq("block_name", "stats")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (!error && data && data.length > 0) {
        const statsData = data.map((block) => {
          const content = block.content as any;
          return {
            id: block.id,
            icon: content?.icon || "Users",
            value: content?.value || "0",
            label: content?.label || "",
            source_type: content?.source_type || "custom",
            order_index: block.order_index || 0,
          };
        });
        setStats(statsData);
      } else {
        setStats(DEFAULT_STATS);
      }
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <section id="stats" className="py-8 md:py-12 bg-muted/20 border-y border-border/40">
      <div className="container">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
