import { useState, useRef, useEffect } from "react";
import { 
  Camera, 
  ShieldCheck, 
  KeyRound, 
  BellRing, 
  Smartphone, 
  Sparkles, 
  Wifi, 
  Eye, 
  CheckCircle2, 
  LockOpen,
  Volume2
} from "lucide-react";

/**
 * Интерактивный терминал «Умный домофон & Видеонаблюдение нового поколения»
 * Преимущества:
 * - Мгновенная загрузка (0 секунд задержки, без тяжелых библиотек и сбоев WebGL)
 * - 3D Tilt-эффект при движении курсора мыши
 * - Анимация сканера распознавания лиц Face ID
 * - Интерактивная кнопка открытия двери с обратной визуальной связью
 * - Парящие технологичные виджеты безопасности
 */
export const SmartIntercomTerminal = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [doorUnlocked, setDoorUnlocked] = useState(false);
  const [callActive, setCallActive] = useState(false);

  // Обработка 3D-наклона вслед за курсором мыши
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Плавный угол поворота от -12 до +12 градусов
    const rotateX = ((centerY - y) / centerY) * 10;
    const rotateY = ((x - centerX) / centerX) * 10;

    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  // Клик по кнопке ключа: имитация моментального открытия двери
  const handleUnlockDoor = () => {
    setDoorUnlocked(true);
    setTimeout(() => {
      setDoorUnlocked(false);
    }, 2800);
  };

  // Клик по вызову: имитация звонка в квартиру/на телефон
  const handleCall = () => {
    setCallActive(true);
    setTimeout(() => {
      setCallActive(false);
    }, 3000);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-[480px] lg:h-[540px] flex items-center justify-center select-none perspective-[1200px]"
    >
      {/* Мягкое фоновое сапфировое свечение вокруг устройства */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/25 via-sky-400/20 to-blue-600/10 rounded-full blur-3xl opacity-60 pointer-events-none" />

      {/* Парящий виджет №1 (Сверху справа): Видеопоток 4K Ultra HD */}
      <div className="absolute -top-2 -right-2 sm:right-4 z-30 bg-card/85 backdrop-blur-xl border border-sky-400/30 rounded-2xl p-3 shadow-lg shadow-sky-500/10 flex items-center gap-3 animate-[float_5s_ease-in-out_infinite]">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500">
          <Camera className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
        </div>
        <div className="text-left">
          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
            Ultra HD 4K
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">REC</span>
          </div>
          <div className="text-[11px] text-muted-foreground">Ночная подсветка 30м</div>
        </div>
      </div>

      {/* Парящий виджет №2 (Снизу слева): Face ID & Замок */}
      <div className="absolute -bottom-2 -left-2 sm:left-4 z-30 bg-card/85 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-3 shadow-lg shadow-emerald-500/10 flex items-center gap-3 animate-[float_6s_ease-in-out_infinite]" style={{ animationDelay: "1.5s" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="text-left">
          <div className="text-xs font-bold text-foreground flex items-center gap-1">
            Face ID 0.2 сек
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="text-[11px] text-muted-foreground">Распознавание жильцов</div>
        </div>
      </div>

      {/* Парящий виджет №3 (Снизу справа): Приложение на смартфоне */}
      <div className="hidden sm:flex absolute bottom-12 -right-4 z-30 bg-card/85 backdrop-blur-xl border border-primary/30 rounded-2xl p-3 shadow-lg shadow-primary/10 items-center gap-3 animate-[float_7s_ease-in-out_infinite]" style={{ animationDelay: "3s" }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="text-left">
          <div className="text-xs font-bold text-foreground">Звонок на смартфон</div>
          <div className="text-[11px] text-muted-foreground">iOS & Android приложение</div>
        </div>
      </div>

      {/* ОСНОВНОЙ КОРПУС ТЕРМИНАЛА IP-ДОМОФОНА С 3D TILT */}
      <div 
        style={{
          transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
          transition: isHovered ? "transform 0.12s ease-out" : "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)"
        }}
        className="relative z-20 w-[290px] sm:w-[330px] rounded-3xl p-3 sm:p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-sky-500/40 shadow-2xl shadow-sky-500/20 text-white overflow-hidden"
      >
        {/* Верхний световой бегущий кант (Shimmer) */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-shimmer" />

        {/* 1. ВЕРХНЯЯ АППАРАТНАЯ ПАНЕЛЬ ТЕРМИНАЛА */}
        <div className="flex items-center justify-between mb-3 px-2 pt-1 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] tracking-wider uppercase font-semibold text-slate-300">ДОМОФОНДАР IP</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Wifi className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[10px] font-mono text-sky-400">ONLINE</span>
          </div>
        </div>

        {/* 2. БЛОК КАМЕРЫ С ИК-ПОДСВЕТКОЙ */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-slate-700/80 shadow-inner">
            {/* ИК-светодиоды ночной подсветки по кругу */}
            <div className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-red-500/60 shadow-[0_0_6px_red]" />
            <div className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-red-500/60 shadow-[0_0_6px_red]" />
            <div className="absolute left-1.5 h-1.5 w-1.5 rounded-full bg-red-500/60 shadow-[0_0_6px_red]" />
            <div className="absolute right-1.5 h-1.5 w-1.5 rounded-full bg-red-500/60 shadow-[0_0_6px_red]" />
            
            {/* Центральный объектив камеры с бликом */}
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 border border-sky-400/40 shadow-lg shadow-sky-500/30">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-sky-600 via-blue-900 to-sky-400 opacity-90" />
              <div className="absolute top-2 left-2 h-2.5 w-2.5 rounded-full bg-white/70 blur-[0.5px]" />
            </div>
          </div>
        </div>

        {/* 3. СЕНСОРНЫЙ ЭКРАН С ВИДЕОПОТОКОМ И СКАНЕРОМ FACE ID */}
        <div className="relative rounded-2xl bg-slate-950/90 border border-sky-500/30 p-3 mb-3 overflow-hidden shadow-inner">
          {/* Сетка сканера безопасности */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c710_1px,transparent_1px),linear-gradient(to_bottom,#0284c710_1px,transparent_1px)] bg-[size:14px_14px]" />

          {/* Бегущий лазерный луч сканирования Face ID */}
          <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-[scan-line_2.8s_ease-in-out_infinite]" />

          <div className="relative z-10 flex flex-col items-center py-2 text-center">
            {doorUnlocked ? (
              <div className="animate-scale-in flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                  <LockOpen className="h-6 w-6 animate-bounce" />
                </div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">ДВЕРЬ ОТКРЫТА</div>
                <div className="text-[10px] text-emerald-300/80">Добро пожаловать домой!</div>
              </div>
            ) : callActive ? (
              <div className="animate-scale-in flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1.5 shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse">
                  <BellRing className="h-6 w-6" />
                </div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">ВЫЗОВ В КВАРТИРУ...</div>
                <div className="text-[10px] text-slate-300">Видеосигнал передан на смартфон</div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-sky-500/15 text-sky-400 flex items-center justify-center mb-1.5 border border-sky-400/30 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
                  <Eye className="h-5 w-5 animate-pulse" />
                </div>
                <div className="text-xs font-bold text-sky-300 flex items-center gap-1">
                  <span>Система активна</span>
                  <Sparkles className="h-3 w-3 text-sky-400" />
                </div>
                <div className="text-[10px] text-slate-400">Нажмите кнопку для открытия или вызова</div>
              </div>
            )}
          </div>
        </div>

        {/* 4. ИНТЕРАКТИВНЫЕ СЕНСОРНЫЕ КНОПКИ УПРАВЛЕНИЯ */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Кнопка открытия замка (Ключ) */}
          <button
            type="button"
            onClick={handleUnlockDoor}
            className={`relative group/btn py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all duration-300 ${
              doorUnlocked 
                ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)]" 
                : "bg-slate-800/90 hover:bg-sky-600/30 border-sky-500/30 hover:border-sky-400 text-sky-300 hover:text-white"
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>{doorUnlocked ? "Открыто!" : "Открыть замок"}</span>
          </button>

          {/* Кнопка вызова жильца / консьержа */}
          <button
            type="button"
            onClick={handleCall}
            className={`relative group/btn py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all duration-300 ${
              callActive
                ? "bg-amber-600 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                : "bg-slate-800/90 hover:bg-sky-600/30 border-sky-500/30 hover:border-sky-400 text-slate-300 hover:text-white"
            }`}
          >
            <BellRing className="h-4 w-4 text-sky-400 group-hover/btn:text-white" />
            <span>Вызов</span>
          </button>
        </div>

        {/* Нижний лаконичный бейдж */}
        <div className="mt-3 text-center text-[10px] text-slate-500 border-t border-white/5 pt-2">
          Умная СКУД • Безопасный двор • Домофондар
        </div>
      </div>
    </div>
  );
};

export default SmartIntercomTerminal;
