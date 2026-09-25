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
 * Оснащена:
 * - Бегущим световым лучом по контуру в стиле ShinyButton (.shiny-border-card)
 * - Сапфирово-лазурным стеклянным фоном в тон дизайну сайта для светлой и темной тем
 * - Переливающимся бейджем иконки (.shiny-icon-badge)
 * - Числовым переливом (.hero-title-shimmer)
 * - Точным форматированием чисел с разделителями тысяч («11 244») и пробелом перед словами («7 лет», «22 года»)
 */
const StatCard = ({ stat }: { stat: StatBlock }) => {
  const Icon = iconMap[stat.icon as keyof typeof iconMap] || Users;
  const rawValue = (stat.value || "").trim();

  // Проверяем спецформаты вроде 24/7 (со слэшем)
  const isSpecialNonNumeric = rawValue.includes("/") || isNaN(parseInt(rawValue.replace(/\s+/g, ""), 10));

  // Строго извлекаем ведущую числовую группу и текстовый суффикс
  // Пример: "7 лет" -> digits = 7, suffix = "лет"
  // Пример: "22 года" -> digits = 22, suffix = "года"
  // Пример: "11 244" -> digits = 11244, suffix = ""
  // Пример: "100%" -> digits = 100, suffix = "%"
  let numericValue = 0;
  let suffix = "";

  if (!isSpecialNonNumeric) {
    const match = rawValue.match(/^([\d\s]+)(.*)$/);
    if (match) {
      numericValue = parseInt(match[1].replace(/\s+/g, ""), 10) || 0;
      suffix = match[2].trim();
    } else {
      numericValue = parseInt(rawValue.replace(/[^\d]/g, ""), 10) || 0;
    }
  }

  // Хук плавной анимации чисел от 0 до numericValue
  const { count, elementRef } = useCountUp(isSpecialNonNumeric ? 0 : numericValue, 2000);

  // Формируем результирующую строку:
  // Если суффикс начинается с букв ("лет", "года"), гарантируем пробел!
  let displayValue = rawValue;
  if (!isSpecialNonNumeric) {
    const formattedNum = count.toLocaleString("ru-RU");
    if (suffix) {
      const isWord = /^[a-zA-Zа-яА-ЯёЁ]/.test(suffix);
      displayValue = isWord ? `${formattedNum} ${suffix}` : `${formattedNum}${suffix}`;
    } else {
      displayValue = formattedNum;
    }
  }

  return (
    <div
      ref={elementRef}
      className="shiny-border-card group cursor-default"
    >
      <div className="shiny-border-card-inner">
        {/* Иконка в переливающемся бейдже с бегущим лучом */}
        <div className="shiny-icon-badge mb-3 sm:mb-4">
          <div className="shiny-icon-badge-inner">
            <Icon className="h-6 w-6 sm:h-7 sm:w-7 transition-transform duration-500 group-hover:scale-110" />
          </div>
        </div>

        {/* Анимированное значение с бегущим переливом */}
        <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight hero-title-shimmer mb-2">
          {displayValue}
        </div>

        {/* Текстовая подпись показателя */}
        <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-neutral-300 leading-snug">
          {stat.label}
        </div>
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
   * Загрузка показателей: сначала проверяем API /backend-api/api/public-stats с реальными данными из БД,
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
    <section id="stats" className="py-8 md:py-12 bg-gradient-to-b from-muted/30 via-background to-muted/20 border-y border-border/40">
      <div className="container">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 md:gap-6">
          {stats.map((stat) => (
            <StatCard key={stat.id} stat={stat} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
