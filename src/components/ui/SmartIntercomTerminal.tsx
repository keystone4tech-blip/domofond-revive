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
  Phone,
  PhoneOff,
  Video,
  Database,
  Bluetooth,
  Key,
  Info,
  X,
  Volume2,
  ScanFace,
  ScanLine
} from "lucide-react";
import visitorImage from "@/assets/visitor_call.jpg";

// Типы интерактивных режимов терминала
type IntercomMode = "incoming_call" | "in_call" | "door_open" | "idle";

// Описание летающих интерактивных фич с подробной информацией при клике
interface FeatureInfo {
  id: string;
  title: string;
  badge: string;
  icon: any;
  color: string;
  description: string;
  details: string[];
}

const FEATURES_DATA: Record<string, FeatureInfo> = {
  face_id: {
    id: "face_id",
    title: "Вход по Face ID",
    badge: "0.2 сек",
    icon: ScanFace,
    color: "sky",
    description: "Добавьте фото в Личный кабинет и проходите в подъезд по лицу без ключей.",
    details: [
      "Добавьте селфи в Личный кабинет со смартфона — доступ активируется мгновенно",
      "Сверхбыстрое распознавание за 0.2 секунды даже в темноте, шапке или очках",
      "3D-защита от подделок: сенсоры глубины не позволят пройти по фото с экрана"
    ]
  },
  hd_video: {
    id: "hd_video",
    title: "Видео HD качества",
    badge: "1080p HD",
    icon: Video,
    color: "sky",
    description: "Четкое широкоугольное изображение посетителей без задержек и размытия.",
    details: [
      "Широкий угол обзора 160° — видно всю площадку перед дверью",
      "Инфракрасная ночная подсветка до 30 метров без слепящих лучей",
      "Адаптивный битрейт — стабильное видео даже при слабом мобильном интернете"
    ]
  },
  archive_5days: {
    id: "archive_5days",
    title: "Архив видеозаписи 5 дней",
    badge: "5 дней",
    icon: Database,
    color: "blue",
    description: "Безопасное облачное хранение всех событий и звонков в течение 5 суток.",
    details: [
      "Запись каждого звонка и попыток открытия двери",
      "Удобная перемотка архива по таймлайну со смартфона",
      "Возможность сохранить и скачать фрагмент видеозаписи"
    ]
  },
  live_247: {
    id: "live_247",
    title: "Просмотр камер 24/7",
    badge: "Онлайн 24/7",
    icon: Eye,
    color: "emerald",
    description: "Круглосуточный прямой эфир с камер подъезда, двора и парковки.",
    details: [
      "Контроль придомовой территории из любой точки планеты",
      "Мгновенное подключение к трансляции в одно касание",
      "Безопасный доступ только для подтвержденных жильцов дома"
    ]
  },
  bluetooth: {
    id: "bluetooth",
    title: "Bluetooth-открывание двери",
    badge: "Hands-Free",
    icon: Bluetooth,
    color: "indigo",
    description: "Бесключевой доступ: дверь распознает ваш смартфон и открывается сама.",
    details: [
      "Свободные руки: не нужно доставать ключи, когда несете сумки",
      "Автоматическое открывание при приближении на расстояние 1–2 метра",
      "Шифрованный протокол BLE с защитой от перехвата сигнала"
    ]
  },
  crypto_keys: {
    id: "crypto_keys",
    title: "Ключи с повышенной защитой",
    badge: "Крипто-RFID",
    icon: Key,
    color: "amber",
    description: "Электронные ключи нового поколения с защитой от несанкционированного клонирования.",
    details: [
      "Уникальный цифровой криптографический чип в каждом ключе",
      "Невозможно сделать нелегальный дубликат в обычной мастерской",
      "Мгновенная блокировка потерянного ключа в системе управляющей компании"
    ]
  }
};

export const SmartIntercomTerminal = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 3D Tilt координаты
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  
  // Режимы интерактивного видеозвонка
  const [mode, setMode] = useState<IntercomMode>("incoming_call");
  const [callDuration, setCallDuration] = useState(0);

  // Активная карточка-подсказка летающего значка
  const [activeFeature, setActiveFeature] = useState<FeatureInfo | null>(null);

  // Таймер разговора
  useEffect(() => {
    let interval: any = null;
    if (mode === "in_call") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [mode]);

  // Обработка 3D-наклона терминала и слежения зрачка камеры за мышью
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Угол наклона корпуса (-7° ... +7°)
    const rotateX = ((centerY - y) / centerY) * 7;
    const rotateY = ((x - centerX) / centerX) * 7;
    setRotate({ x: rotateX, y: rotateY });

    // Смещение зрачка камеры (-6px ... +6px)
    const eyeX = ((x - centerX) / centerX) * 6;
    const eyeY = ((y - centerY) / centerY) * 6;
    setEyeOffset({ x: eyeX, y: eyeY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
    setEyeOffset({ x: 0, y: 0 });
  };

  // Форматирование секунд в таймер разговора MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Сценарии кнопок вызова
  const handleAnswerCall = () => {
    setMode("in_call");
  };

  const handleDeclineCall = () => {
    setMode("idle");
  };

  const handleUnlockDoor = () => {
    setMode("door_open");
    setTimeout(() => {
      setMode("idle");
    }, 3200);
  };

  const handleRestartCall = () => {
    setMode("incoming_call");
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-[580px] sm:h-[620px] lg:h-[660px] flex items-center justify-center select-none perspective-[1200px]"
    >
      {/* Мягкое фоновое сапфировое свечение вокруг устройства */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-sky-400/20 to-blue-600/15 rounded-full blur-3xl opacity-60 pointer-events-none" />

      {/* ============================================================== */}
      {/* 6 СПОКОЙНЫХ ПАРЯЩИХ ЗНАЧКОВ С ЛЕГКИМ МИКРО-ПЛАВАНИЕМ           */}
      {/* ============================================================== */}

      {/* 1. Вход по Face ID (Слева вверху) */}
      <button
        type="button"
        onClick={() => setActiveFeature(FEATURES_DATA.face_id)}
        className="absolute top-2 sm:top-4 left-1 sm:left-4 z-30 p-2 sm:p-2.5 rounded-2xl bg-card/90 backdrop-blur-xl border border-sky-400/40 shadow-md shadow-sky-500/15 hover:shadow-sky-500/30 hover:scale-105 transition-all duration-300 flex items-center gap-2 group cursor-pointer text-left animate-gentle-hover"
      >
        <div className="relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors">
          <ScanFace className="h-4 w-4" />
        </div>
        <div className="pr-1">
          <div className="text-[11px] font-bold text-foreground flex items-center gap-1">
            Вход по Face ID
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold">0.2с</span>
          </div>
          <div className="text-[10px] text-muted-foreground">Добавьте фото в ЛК</div>
        </div>
      </button>

      {/* 2. Видео HD качества (Справа вверху) */}
      <button
        type="button"
        onClick={() => setActiveFeature(FEATURES_DATA.hd_video)}
        className="absolute top-2 sm:top-4 right-1 sm:right-4 z-30 p-2 sm:p-2.5 rounded-2xl bg-card/90 backdrop-blur-xl border border-sky-400/40 shadow-md shadow-sky-500/15 hover:shadow-sky-500/30 hover:scale-105 transition-all duration-300 flex items-center gap-2 group cursor-pointer text-left animate-gentle-hover"
        style={{ animationDelay: "1.2s" }}
      >
        <div className="relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500 group-hover:bg-sky-500 group-hover:text-white transition-colors">
          <Video className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
        <div className="pr-1">
          <div className="text-[11px] font-bold text-foreground flex items-center gap-1">
            Видео HD качества
            <Info className="h-3 w-3 text-sky-400 opacity-60 group-hover:opacity-100" />
          </div>
          <div className="text-[10px] text-muted-foreground">1080p • Обзор 160°</div>
        </div>
      </button>

      {/* 3. Архив видеозаписи 5 дней (Слева по центру) */}
      <button
        type="button"
        onClick={() => setActiveFeature(FEATURES_DATA.archive_5days)}
        className="hidden sm:flex absolute top-[44%] left-0 sm:left-2 z-30 p-2 rounded-2xl bg-card/90 backdrop-blur-xl border border-blue-400/40 shadow-md shadow-blue-500/15 hover:shadow-blue-500/30 hover:scale-105 transition-all duration-300 items-center gap-2 group cursor-pointer text-left animate-gentle-hover"
        style={{ animationDelay: "2.4s" }}
      >
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
          <Database className="h-4 w-4" />
        </div>
        <div className="pr-1">
          <div className="text-[11px] font-bold text-foreground flex items-center gap-1">
            Архив записи 5 дней
            <Info className="h-3 w-3 text-blue-400 opacity-60 group-hover:opacity-100" />
          </div>
          <div className="text-[10px] text-muted-foreground">Облако • Перемотка</div>
        </div>
      </button>

      {/* 4. Просмотр камер 24/7 (Справа по центру) */}
      <button
        type="button"
        onClick={() => setActiveFeature(FEATURES_DATA.live_247)}
        className="hidden sm:flex absolute top-[44%] right-0 sm:right-2 z-30 p-2 rounded-2xl bg-card/90 backdrop-blur-xl border border-emerald-400/40 shadow-md shadow-emerald-500/15 hover:shadow-emerald-500/30 hover:scale-105 transition-all duration-300 items-center gap-2 group cursor-pointer text-left animate-gentle-hover"
        style={{ animationDelay: "3.6s" }}
      >
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
          <Eye className="h-4 w-4" />
        </div>
        <div className="pr-1">
          <div className="text-[11px] font-bold text-foreground flex items-center gap-1">
            Просмотр камер 24/7
            <Info className="h-3 w-3 text-emerald-400 opacity-60 group-hover:opacity-100" />
          </div>
          <div className="text-[10px] text-muted-foreground">Двор, парковка, вход</div>
        </div>
      </button>

      {/* 5. Bluetooth открывание (Снизу слева) */}
      <button
        type="button"
        onClick={() => setActiveFeature(FEATURES_DATA.bluetooth)}
        className="absolute bottom-2 sm:bottom-4 left-1 sm:left-4 z-30 p-2 sm:p-2.5 rounded-2xl bg-card/90 backdrop-blur-xl border border-indigo-400/40 shadow-md shadow-indigo-500/15 hover:shadow-indigo-500/30 hover:scale-105 transition-all duration-300 flex items-center gap-2 group cursor-pointer text-left animate-gentle-hover"
        style={{ animationDelay: "1.8s" }}
      >
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
          <Bluetooth className="h-4 w-4" />
        </div>
        <div className="pr-1">
          <div className="text-[11px] font-bold text-foreground flex items-center gap-1">
            Bluetooth-доступ
            <Info className="h-3 w-3 text-indigo-400 opacity-60 group-hover:opacity-100" />
          </div>
          <div className="text-[10px] text-muted-foreground">Hands-Free без ключей</div>
        </div>
      </button>

      {/* 6. Ключи с повышенной защитой (Снизу справа) */}
      <button
        type="button"
        onClick={() => setActiveFeature(FEATURES_DATA.crypto_keys)}
        className="absolute bottom-2 sm:bottom-4 right-1 sm:right-4 z-30 p-2 sm:p-2.5 rounded-2xl bg-card/90 backdrop-blur-xl border border-amber-400/40 shadow-md shadow-amber-500/15 hover:shadow-amber-500/30 hover:scale-105 transition-all duration-300 flex items-center gap-2 group cursor-pointer text-left animate-gentle-hover"
        style={{ animationDelay: "3.2s" }}
      >
        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
          <Key className="h-4 w-4" />
        </div>
        <div className="pr-1">
          <div className="text-[11px] font-bold text-foreground flex items-center gap-1">
            Крипто-ключи
            <Info className="h-3 w-3 text-amber-400 opacity-60 group-hover:opacity-100" />
          </div>
          <div className="text-[10px] text-muted-foreground">Защита от дубликатов</div>
        </div>
      </button>

      {/* ============================================================== */}
      {/* КОРПУС ТЕРМИНАЛА IP-ДОМОФОНА (ВЫТЯНУТЫЙ, ПРОСТОРНЫЙ, ПРЕМИУМ)  */}
      {/* ============================================================== */}
      <div 
        style={{
          transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(${isHovered ? 1.02 : 1}, ${isHovered ? 1.02 : 1}, 1)`,
          transition: isHovered ? "transform 0.12s ease-out" : "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)"
        }}
        className="relative z-20 w-[305px] sm:w-[345px] rounded-3xl p-3.5 sm:p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-sky-500/40 shadow-2xl shadow-sky-500/25 text-white overflow-hidden flex flex-col gap-3"
      >
        {/* Верхний световой перелив */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-shimmer" />

        {/* 1. ВЕРХНЯЯ АППАРАТНАЯ ПАНЕЛЬ ТЕРМИНАЛА */}
        <div className="flex items-center justify-between px-2 pt-0.5 border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] tracking-wider uppercase font-semibold text-slate-300">ДОМОФОНДАР IP</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Wifi className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[10px] font-mono text-sky-400">ONLINE</span>
          </div>
        </div>

        {/* 2. РОСКОШНЫЙ КРУПНЫЙ ОБЪЕКТИВ КАМЕРЫ (КАК В ПЕРВОЙ ВЕРСИИ) */}
        <div className="relative flex items-center justify-center py-1 group/lens">
          {/* Внешний корпус камеры */}
          <div className="relative flex h-21 w-21 sm:h-22 sm:w-22 items-center justify-center rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border-2 border-slate-700/80 shadow-inner">
            
            {/* Круговой лазерный сканирующий радар фокуса */}
            <div className={`absolute inset-0 rounded-full border border-dashed border-sky-400/40 ${isHovered ? "animate-[camera-radar_4s_linear_infinite]" : "opacity-30"}`} />

            {/* ИК-диоды ночной подсветки по кругу */}
            <div className="absolute top-1.5 h-1.5 w-1.5 rounded-full bg-red-500/70 shadow-[0_0_6px_red]" />
            <div className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-red-500/70 shadow-[0_0_6px_red]" />
            <div className="absolute left-1.5 h-1.5 w-1.5 rounded-full bg-red-500/70 shadow-[0_0_6px_red]" />
            <div className="absolute right-1.5 h-1.5 w-1.5 rounded-full bg-red-500/70 shadow-[0_0_6px_red]" />

            {/* Внутренняя просветленная оптика с диафрагмой */}
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 border border-sky-400/50 shadow-lg shadow-sky-500/40 overflow-hidden">
              
              {/* Зрачок камеры, плавно следящий за курсором мыши */}
              <div 
                style={{
                  transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                  transition: "transform 0.1s ease-out"
                }}
                className="relative flex h-8 w-8 items-center justify-center rounded-full camera-shimmer-lens shadow-inner"
              >
                {/* Центральный апертурный зрачок */}
                <div className="h-4 w-4 rounded-full bg-slate-950 border border-sky-300/60 flex items-center justify-center shadow-inner">
                  <div className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-ping opacity-75" />
                </div>

                {/* Световые блики многослойной оптики */}
                <div className="absolute top-1 left-1.5 h-2.5 w-2.5 rounded-full bg-white/80 blur-[0.5px]" />
                <div className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-sky-200/60" />
              </div>
            </div>

            {/* Бейдж статуса автофокуса при наведении */}
            <div className="absolute -bottom-1.5 px-2 py-0.2 rounded-full bg-sky-500/20 border border-sky-400/40 text-[8px] font-mono text-sky-300">
              {isHovered ? "TRACKING ON" : "AUTO-FOCUS"}
            </div>
          </div>
        </div>

        {/* 3. ПРОСТОРНЫЙ ЭКРАН ВИДЕОДОМОФОНА С ДЕВУШКОЙ ЯНДЕКС ЕДА ВО ДВОРЕ */}
        <div className="relative rounded-2xl bg-slate-950 border border-sky-500/35 overflow-hidden shadow-inner h-[255px] sm:h-[265px] flex flex-col justify-between">
          
          {/* СЦЕНАРИЙ А: ВХОДЯЩИЙ ВИДЕОЗВОНОК (ДЕВУШКА ВО ДВОРЕ У ПОДЪЕЗДА) */}
          {mode === "incoming_call" && (
            <div className="relative w-full h-full flex flex-col justify-between p-3 animate-fade-in">
              {/* Фотокадр девушки с доставкой Яндекс Еда во дворе жилого комплекса */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img 
                  src={visitorImage} 
                  alt="Доставка Яндекс Еда у подъезда" 
                  className="w-full h-full object-cover object-center filter brightness-95 contrast-105"
                />
                {/* Мягкие градиентные затемнения для идеальной читаемости интерфейса */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
                
                {/* Рамка распознавания Face ID вокруг лица курьера */}
                <div className="absolute top-[32%] left-[42%] w-[22%] h-[24%] border-2 border-emerald-400 rounded-lg animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.7)] pointer-events-none">
                  <div className="absolute -top-3.5 left-0 bg-emerald-500/90 text-[7px] text-slate-950 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                    FACE ID
                  </div>
                </div>

                {/* Бегущий лазерный луч сканера Face ID */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-[scan-line_2.8s_ease-in-out_infinite] pointer-events-none" />
              </div>

              {/* Верхняя строка статуса камеры: реальный интерфейс домофона */}
              <div className="relative z-10 flex items-center justify-between w-full bg-slate-950/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold animate-pulse">
                  <BellRing className="h-3.5 w-3.5" />
                  <span>ВХОДЯЩИЙ ВЫЗОВ</span>
                </div>
                <div className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  CAM 03 • 1080p
                </div>
              </div>

              {/* Нижняя панель действий: лаконично, просторно, без лишних надписей */}
              <div className="relative z-10 w-full pt-2">
                <div className="grid grid-cols-2 gap-2.5 w-full bg-slate-950/80 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={handleAnswerCall}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 animate-ring-pulse transition-all shadow-md active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Ответить</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeclineCall}
                    className="py-2.5 px-3 rounded-xl bg-rose-600/85 hover:bg-rose-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>Отклонить</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* СЦЕНАРИЙ Б: РАЗГОВОР АКТИВЕН */}
          {mode === "in_call" && (
            <div className="relative w-full h-full flex flex-col justify-between p-3 animate-fade-in">
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img 
                  src={visitorImage} 
                  alt="Доставка Яндекс Еда у подъезда" 
                  className="w-full h-full object-cover object-center filter brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
              </div>

              {/* Верхняя строка статуса разговора с таймером */}
              <div className="relative z-10 flex items-center justify-between w-full bg-slate-950/75 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                  <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                  <span>Идет разговор...</span>
                </div>
                <div className="font-mono text-xs font-bold text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-400/30">
                  {formatTime(callDuration)}
                </div>
              </div>

              {/* Нижняя панель с кнопками «Открыть дверь» и «Завершить» */}
              <div className="relative z-10 w-full pt-2">
                <div className="grid grid-cols-2 gap-2.5 w-full bg-slate-950/80 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={handleUnlockDoor}
                    className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(2,132,199,0.5)] transition-all hover:scale-102 active:scale-95"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>Открыть дверь</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeclineCall}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span>Завершить</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* СЦЕНАРИЙ В: ДВЕРЬ ОТКРЫТА */}
          {mode === "door_open" && (
            <div className="relative w-full h-full flex flex-col items-center justify-center p-4 text-center animate-scale-in bg-slate-950">
              <div className="h-14 w-14 rounded-full bg-emerald-500/25 text-emerald-400 flex items-center justify-center mb-2 shadow-[0_0_30px_rgba(16,185,129,0.7)]">
                <LockOpen className="h-8 w-8 animate-bounce" />
              </div>
              <div className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider">ДВЕРЬ РАЗБЛОКИРОВАНА ✓</div>
              <div className="text-xs text-emerald-200/90 mt-1">Электромагнитный замок открыт</div>
              <div className="text-[10px] text-slate-400 mt-2">Добро пожаловать домой!</div>
            </div>
          )}

          {/* СЦЕНАРИЙ Г: РЕЖИМ ОЖИДАНИЯ / FACE ID СКАНИРОВАНИЕ */}
          {mode === "idle" && (
            <div className="relative w-full h-full flex flex-col justify-between p-3.5 text-center animate-fade-in bg-slate-950">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1 text-sky-400 text-[11px] font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Терминал готов к работе</span>
                </div>
                <div className="text-[9px] text-slate-500 font-mono">РЕЖИМ ОЖИДАНИЯ</div>
              </div>

              <div className="flex flex-col items-center my-auto">
                <div className="h-13 w-13 rounded-full bg-sky-500/15 text-sky-400 flex items-center justify-center mb-2 border border-sky-400/30 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
                  <ScanLine className="h-7 w-7 animate-pulse" />
                </div>
                <div className="text-xs font-bold text-white">Сканирование Face ID & Ключ</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Нажмите «Позвонить» для проверки входящего звонка</div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 w-full pt-1">
                <button
                  type="button"
                  onClick={handleRestartCall}
                  className="py-2.5 px-3 rounded-xl bg-sky-600/90 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  <span>Позвонить</span>
                </button>

                <button
                  type="button"
                  onClick={handleUnlockDoor}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-sky-400/30 transition-all active:scale-95"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Открыть</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. НИЖНЯЯ ПАНЕЛЬ СТАТУСА */}
        <div className="text-center text-[10px] text-slate-400 border-t border-white/5 pt-1 flex items-center justify-between px-1">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-sky-400" />
            Интерактивный симулятор
          </span>
          <span className="text-slate-500">Домофондар 2026</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ВСплывающая карточка с подробной информацией о фиче (по клику) */}
      {/* ============================================================== */}
      {activeFeature && (
        <div className="absolute inset-x-2 sm:inset-x-6 bottom-2 z-40 bg-card/95 backdrop-blur-2xl border-2 border-primary/40 rounded-2xl p-4 shadow-2xl shadow-primary/20 animate-scale-in text-left">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shrink-0">
                <activeFeature.icon className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  {activeFeature.title}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {activeFeature.badge}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">{activeFeature.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveFeature(null)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-1.5 mt-2 pt-2 border-t border-border/60">
            {activeFeature.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-neutral-200">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>{detail}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setActiveFeature(null)}
              className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Понятно ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartIntercomTerminal;
