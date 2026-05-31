import { ChangeEvent, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { InfoIcon, Calculator as CalcIcon, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { downloadProposal, generateProposalDocx } from "@/utils/docxGenerator";
import { FileText, CheckCircle2, Loader2 as Spinner, HelpCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

const getTariff = (aptsPerIntercom: number) => {
  if (aptsPerIntercom < 15) return { smart: 0, addCam: 0, elev: 0, gate: 0, individualGate: false, valid: false };
  if (aptsPerIntercom <= 24) return { smart: 150, addCam: 50, elev: 0, gate: 0, individualGate: true, valid: true };
  if (aptsPerIntercom <= 29) return { smart: 105, addCam: 30, elev: 0, gate: 40, individualGate: false, valid: true };
  if (aptsPerIntercom <= 39) return { smart: 85, addCam: 25, elev: 45, gate: 30, individualGate: false, valid: true };
  if (aptsPerIntercom <= 59) return { smart: 80, addCam: 20, elev: 35, gate: 25, individualGate: false, valid: true };
  if (aptsPerIntercom <= 79) return { smart: 70, addCam: 15, elev: 30, gate: 25, individualGate: false, valid: true };
  if (aptsPerIntercom <= 99) return { smart: 65, addCam: 15, elev: 30, gate: 25, individualGate: false, valid: true };
  if (aptsPerIntercom <= 150) return { smart: 60, addCam: 15, elev: 20, gate: 15, individualGate: false, valid: true };
  return { smart: 50, addCam: 10, elev: 15, gate: 10, individualGate: false, valid: true };
};

type NumericFieldKey =
  | "entrances"
  | "totalApartments"
  | "smartIntercoms"
  | "additionalCameras"
  | "elevatorCameras"
  | "gates";

type FieldErrors = Partial<Record<NumericFieldKey | "name" | "phone", string>>;

const sanitizeNumericInput = (value: string) => value.replace(/\D/g, "");

const parseNumericInput = (value: string, min: number, fallback: number) => {
  if (!value.trim()) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;

  return Math.max(min, parsed);
};

interface NumberInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  min?: number;
  placeholder?: string;
  tooltip?: string;
}

const NumberInput = ({ id, label, value, onChange, error, min = 0, placeholder, tooltip }: NumberInputProps) => {
  // RULE 2: Логируем рендер инпута параметров
  return (
    <div className="space-y-2 text-left">
      <div className="flex items-center gap-1.5 justify-start">
        <Label htmlFor={id} className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-slate-400 hover:text-amber-500 transition-colors focus:outline-none">
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs bg-slate-900/90 backdrop-blur-md text-white border-slate-700 rounded-lg p-2.5">
              <p className="leading-normal">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder={placeholder ?? String(min)}
        value={value}
        onChange={onChange}
        className={`bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-11 transition-all rounded-xl placeholder-slate-400 ${
          error ? "border-destructive focus-visible:ring-destructive" : ""
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive font-semibold mt-1">
          {error}
        </p>
      )}
    </div>
  );
};

export default function Calculator() {
  const { toast } = useToast();

  const [numericValues, setNumericValues] = useState<Record<NumericFieldKey, string>>({
    entrances: "",
    totalApartments: "",
    smartIntercoms: "",
    additionalCameras: "",
    elevatorCameras: "",
    gates: "",
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastCalculationId, setLastCalculationId] = useState<string | null>(null);
  
  // Состояние для КП
  const [isCPDialogOpen, setIsCPDialogOpen] = useState(false);
  const [isGeneratingCP, setIsGeneratingCP] = useState(false);
  const [address, setAddress] = useState({
    city: "г. Краснодар",
    street: "",
    house: "",
    block: "",
  });

  const entrances = parseNumericInput(numericValues.entrances, 1, 1);
  const totalApartments = parseNumericInput(numericValues.totalApartments, 1, 100);
  const smartIntercoms = parseNumericInput(numericValues.smartIntercoms, 0, 0);
  const additionalCameras = parseNumericInput(numericValues.additionalCameras, 0, 0);
  const elevatorCameras = parseNumericInput(numericValues.elevatorCameras, 0, 0);
  const gates = parseNumericInput(numericValues.gates, 0, 0);

  const aptsPerEntrance = Math.ceil(totalApartments / entrances);
  const aptsPerIntercom = Math.ceil(totalApartments / Math.max(smartIntercoms, 1));
  
  const generalRates = getTariff(aptsPerEntrance);
  const intercomRates = getTariff(aptsPerIntercom);

  const gateMaintenanceCost = 5500;
  const gatePrice = gates > 0 ? Math.ceil(((gates * gateMaintenanceCost) / totalApartments) / 5) * 5 : 0;

  let tariffPerApt = 0;
  // Используем общую валидность по подъездам
  if (generalRates.valid) {
    const smartPrice = smartIntercoms > 0 ? intercomRates.smart : 0;
    const addCamPrice = additionalCameras > 0 ? Math.ceil(additionalCameras / entrances) * generalRates.addCam : 0;
    const elevPrice = elevatorCameras > 0 ? Math.ceil(elevatorCameras / entrances) * generalRates.elev : 0;
    
    tariffPerApt = smartPrice + addCamPrice + elevPrice + gatePrice;
  }

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      return { ...current, [field]: undefined };
    });
  };

  const handleNumericChange = (field: NumericFieldKey) => (event: ChangeEvent<HTMLInputElement>) => {
    setNumericValues((current) => ({
      ...current,
      [field]: sanitizeNumericInput(event.target.value),
    }));
    clearFieldError(field);
  };

  const validateForm = () => {
    const nextErrors: FieldErrors = {};

    if (!numericValues.entrances.trim()) nextErrors.entrances = "Укажите количество подъездов";
    if (!numericValues.totalApartments.trim()) nextErrors.totalApartments = "Укажите количество квартир";
    if (!numericValues.smartIntercoms.trim()) nextErrors.smartIntercoms = "Укажите количество домофонов";
    if (!name.trim()) nextErrors.name = "Введите имя";
    if (!phone.trim()) nextErrors.phone = "Введите телефон";

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCalculate = async () => {
    if (!validateForm()) {
      toast({
        title: "Заполните обязательные поля",
        description: "Проверьте имя, телефон и основные параметры дома.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("calculations").insert({
        name: name.trim(),
        phone: phone.trim(),
        entrances,
        total_apartments: totalApartments,
        smart_intercoms: smartIntercoms,
        additional_cameras: additionalCameras,
        elevator_cameras: elevatorCameras,
        gates,
        tariff_per_apt: generalRates.valid ? tariffPerApt : 0,
        is_individual: !generalRates.valid,
        tariff_details: {
          aptsPerEntrance,
          aptsPerIntercom,
          smartRate: smartIntercoms > 0 ? intercomRates.smart : 0,
          additionalCameraRate: generalRates.addCam,
          elevatorRate: generalRates.elev,
          gateRate: gatePrice,
          gateTotalCost: gates * gateMaintenanceCost,
          individualGate: false,
        },
      });

      if (error) throw error;

      // Получаем ID созданной записи
      const { data: latestCalc } = await supabase
        .from("calculations")
        .select("id")
        .eq("phone", phone.trim())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (latestCalc) {
        setLastCalculationId(latestCalc.id);
      }

      setShowResult(true);
      setIsDialogOpen(false);
      toast({ title: "Успех", description: "Расчёт сохранён и отправлен в админ-панель." });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Не удалось сохранить данные";
      toast({ title: "Ошибка", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCP = async () => {
    if (!address.street.trim() || !address.house.trim()) {
      toast({
        title: "Заполните адрес",
        description: "Укажите улицу и номер дома для формирования КП.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCP(true);
    try {
      const proposalData = {
        address,
        calculation: {
          entrances,
          totalApartments: totalApartments,
          smartIntercoms: smartIntercoms,
          additionalCameras: additionalCameras,
          elevatorCameras: elevatorCameras,
          gates,
          tariffPerApt,
          rates: {
            smart: intercomRates.smart,
            addCam: generalRates.addCam,
            elev: generalRates.elev,
            gate: generalRates.gate,
          }
        }
      };

      // 1. Генерируем файл
      const blob = await generateProposalDocx(proposalData);
      const fileName = `КП_Домофондар_${address.street.replace(/\s+/g, '_')}_${address.house}.docx`;
      const filePath = `${Date.now()}_${fileName}`;

      // 2. Загружаем в Storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("proposals")
        .upload(filePath, blob);

      let publicUrl = "";
      if (!uploadError && uploadData) {
        const { data: { publicUrl: url } } = supabase.storage
          .from("proposals")
          .getPublicUrl(filePath);
        publicUrl = url;
      } else if (uploadError) {
        console.error("Storage error:", uploadError);
        // Если бакета нет, мы все равно дадим скачать файл, но в логах пометим
      }

      // 3. Обновляем запись в БД
      if (lastCalculationId) {
        const { error: updateError } = await supabase
          .from("calculations")
          .update({
            tariff_details: {
              aptsPerEntrance,
              aptsPerIntercom,
              smartRate: smartIntercoms > 0 ? intercomRates.smart : 0,
              additionalCameraRate: generalRates.addCam,
              elevatorRate: generalRates.elev,
              gateRate: gatePrice,
              gateTotalCost: gates * gateMaintenanceCost,
              individualGate: false,
              address_info: address,
              cp_url: publicUrl || null
            }
          })
          .eq("id", lastCalculationId);
          
        if (updateError) console.error("Database update error:", updateError);
      }

      // 4. Скачиваем пользователю
      await downloadProposal(proposalData);

      setIsCPDialogOpen(false);
      toast({
        title: "Готово!",
        description: "Коммерческое предложение сформировано и скачано.",
      });
    } catch (error) {
      console.error("CP Generation error:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать документ. Попробуйте позже.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCP(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0F172A] transition-colors duration-300">
      <TooltipProvider>
        <Header />
      <main className="flex-1 pt-20">
        {/* Премиальный LuxTech Security баннер */}
        <section className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/20 text-white py-12 md:py-16 relative overflow-hidden shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.07),transparent)] pointer-events-none"></div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-gold-glow text-white mb-2 animate-pulse-glow">
                <CalcIcon className="w-8 h-8" />
              </div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-amber-400 to-slate-100">
                Рассчитайте стоимость обслуживания
              </h1>
              <p className="text-slate-400 text-xs md:text-sm max-w-xl mx-auto font-medium">
                Заполните параметры вашего жилого комплекса или дома. Умный калькулятор мгновенно рассчитает точный прозрачный тариф на одну квартиру.
              </p>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Левая колонка: параметры и оборудование */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Карточка 1: Параметры дома */}
              <Card className="glass-premium border-none rounded-[24px] shadow-xl hover:shadow-2xl transition-all p-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                    <span className="text-amber-500">🏢</span> Параметры дома
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                    Укажите основные конструктивные характеристики вашего многоквартирного дома.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                      <NumberInput
                        id="entrances"
                        label="Подъездов в доме *"
                        value={numericValues.entrances}
                        onChange={handleNumericChange("entrances")}
                        min={1}
                        placeholder="Например: 4"
                        error={fieldErrors.entrances}
                      />
                      <NumberInput
                        id="apartments"
                        label="Квартир всего *"
                        value={numericValues.totalApartments}
                        onChange={handleNumericChange("totalApartments")}
                        min={1}
                        placeholder="Например: 160"
                        error={fieldErrors.totalApartments}
                      />
                  </div>
                </CardContent>
              </Card>

              {/* Карточка 2: Оборудование */}
              <Card className="glass-premium border-none rounded-[24px] shadow-xl hover:shadow-2xl transition-all p-2">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-bold font-display text-amber-500 flex items-center gap-2">
                    <span>🛡️</span> Оборудование компании «Домофондар»
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Установка, монтаж и модернизация оборудования производится за счёт нашей компании <span className="text-amber-500 font-bold">абсолютно БЕСПЛАТНО</span>. Укажите потребности дома.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                      <NumberInput
                        id="smartIntercoms"
                        label="Умных домофонов *"
                        value={numericValues.smartIntercoms}
                        onChange={handleNumericChange("smartIntercoms")}
                        min={0}
                        placeholder="Кол-во входных дверей"
                        error={fieldErrors.smartIntercoms}
                        tooltip="Вызывная панель с Face ID и мобильным приложением на каждую подъездную дверь."
                      />
                      <NumberInput
                        id="additionalCameras"
                        label="Доп. камер наблюдения"
                        value={numericValues.additionalCameras}
                        onChange={handleNumericChange("additionalCameras")}
                        placeholder="Например: 8"
                        tooltip="Камеры, устанавливаемые на придомовую территорию, парковку, детские площадки или фасады."
                      />
                      <NumberInput
                        id="elevatorCameras"
                        label="Камер в лифтах"
                        value={numericValues.elevatorCameras}
                        onChange={handleNumericChange("elevatorCameras")}
                        placeholder="Количество лифтов"
                        tooltip="Устанавливаются антивандальные HD-камеры в кабинах лифтов, по 1 камере на каждый лифт дома."
                      />
                      <NumberInput
                        id="gates"
                        label="Калиток во двор"
                        value={numericValues.gates}
                        onChange={handleNumericChange("gates")}
                        placeholder="Кол-во калиток"
                        tooltip="Входы на огороженную придомовую территорию ЖК, оснащаемые вызывными панелями компании."
                      />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Правая колонка: Ваш расчет */}
            <div className="lg:col-span-5">
              <Card className="sticky top-24 glass-premium border-none rounded-[24px] shadow-2xl overflow-hidden animate-in fade-in duration-300">
                <CardHeader className="bg-slate-900/10 dark:bg-slate-950/20 border-b border-slate-200/50 dark:border-slate-800/80">
                  <CardTitle className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                    <span className="text-amber-500">📊</span> Ваш расчет
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {!showResult ? (
                    <div className="text-center space-y-4 py-6">
                      <div className="mx-auto w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center animate-pulse">
                        <ShieldCheck className="w-7 h-7 text-amber-500" />
                      </div>
                      <h3 className="font-bold font-display text-foreground text-base">Готово к расчету</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                        Введите контакты и отправьте параметры на сервер для мгновенной калькуляции.
                      </p>

                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="lg" className="w-full btn-premium-gold hover:shadow-gold-glow font-bold h-11 text-sm">
                            Узнать стоимость
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md glass-premium border-none rounded-[24px] shadow-2xl p-6 text-left animate-in fade-in duration-200">
                          <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                            <DialogTitle className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                              <span>📝</span> Получение расчета
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Представьтесь, чтобы зафиксировать ваш персональный тариф и сохранить расчет в админ-панели.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="name" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ваше имя *</Label>
                              <Input
                                id="name"
                                placeholder="Иван"
                                value={name}
                                onChange={(event) => {
                                  setName(event.target.value);
                                  clearFieldError("name");
                                }}
                                className={`bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-11 transition-all rounded-xl placeholder-slate-400 ${
                                  fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""
                                }`}
                              />
                              {fieldErrors.name && <p className="text-xs text-destructive font-semibold">{fieldErrors.name}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Телефон для связи *</Label>
                              <Input
                                id="phone"
                                placeholder="+7 (999) 000-00-00"
                                type="tel"
                                value={phone}
                                onChange={(event) => {
                                  setPhone(event.target.value);
                                  clearFieldError("phone");
                                }}
                                className={`bg-white/40 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-medium h-11 transition-all rounded-xl placeholder-slate-400 ${
                                  fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""
                                }`}
                              />
                              {fieldErrors.phone && <p className="text-xs text-destructive font-semibold">{fieldErrors.phone}</p>}
                            </div>
                          </div>
                          <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
                            <Button disabled={isSubmitting} onClick={() => {
                              // RULE 2: Логируем попытку калькуляции
                              console.log("[Калькулятор] Пользователь нажал 'Показать расчет', имя:", name, "телефон:", phone);
                              handleCalculate();
                            }} className="w-full btn-premium-gold hover:shadow-gold-glow font-bold h-11 rounded-xl">
                              {isSubmitting ? (
                                <>
                                  <Spinner className="mr-2 h-4 w-4 animate-spin shrink-0" />
                                  Отправка данных...
                                </>
                              ) : (
                                "Показать расчет"
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in zoom-in duration-300">
                      
                      {/* RULE 2: Логируем итоговые тарифные показатели при рендере результатов */}
                      {(() => {
                        console.log("[Калькулятор] Отрисовка результатов расчета. Квартир в подъезде:", aptsPerEntrance, "тариф:", tariffPerApt);
                        return null;
                      })()}

                      {!generalRates.valid ? (
                        <Alert className="bg-red-500/10 border-red-500/20 text-destructive rounded-2xl text-left">
                          <InfoIcon className="h-4 w-4 text-destructive" />
                          <AlertTitle className="font-bold font-display text-sm">Внимание</AlertTitle>
                          <AlertDescription className="text-xs leading-relaxed mt-1 font-medium">
                            Для домов с малым количеством квартир на один аппарат (менее 15) тариф рассчитывается в индивидуальном коммерческом порядке.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="text-center p-5 bg-amber-500/5 rounded-2xl border border-amber-500/20 shadow-sm shadow-amber-500/5">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Рекомендуемый тариф</p>
                            <p className="text-4xl font-black text-amber-500 font-display">{tariffPerApt} ₽</p>
                            <p className="text-[10px] text-slate-400 mt-1 font-semibold">с одной квартиры в месяц</p>
                          </div>

                          <div className="space-y-2 text-left">
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 dark:border-slate-800">Детализация расчета:</p>
                            <ul className="text-xs space-y-2.5 pt-1.5 font-medium text-slate-700 dark:text-slate-350">
                              {smartIntercoms > 0 && (
                                <li className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">🚪 Умный IP-домофон</span>
                                  <span className="font-semibold text-foreground">{intercomRates.smart} ₽</span>
                                </li>
                              )}
                              {additionalCameras > 0 && (
                                <li className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">🎥 Камеры на территории</span>
                                  <span className="font-semibold text-foreground">{Math.ceil(additionalCameras / entrances) * generalRates.addCam} ₽</span>
                                </li>
                              )}
                              {elevatorCameras > 0 && (
                                <li className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">🛗 Камеры в лифтах</span>
                                  <span className="font-semibold text-foreground">{Math.ceil(elevatorCameras / entrances) * generalRates.elev} ₽</span>
                                </li>
                              )}
                              {gates > 0 && (
                                <li className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">🚧 Умные калитки (двор)</span>
                                  <span className="font-semibold text-foreground">
                                    {gatePrice} ₽
                                  </span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
                {showResult && (
                  <CardFooter className="flex flex-col gap-4 bg-slate-900/5 dark:bg-slate-950/20 border-t border-slate-200/50 dark:border-slate-800/80 pt-4 p-6">
                    <Dialog open={isCPDialogOpen} onOpenChange={setIsCPDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full gap-2 btn-premium-gold hover:shadow-gold-glow font-bold h-11 text-sm rounded-xl">
                          <FileText className="w-4 h-4" />
                          Оформить коммерческое предложение (DOCX)
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px] glass-premium border-none rounded-[24px] shadow-2xl p-6 text-left animate-in fade-in duration-200">
                        <DialogHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
                          <DialogTitle className="text-lg font-bold text-foreground font-display flex items-center gap-2">
                            <span>📄</span> Сведения об объекте
                          </DialogTitle>
                          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Укажите адрес жилого дома для автоматического брендированного заполнения КП.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 text-left">
                          <div className="grid gap-1.5">
                            <Label htmlFor="city" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Город / Населенный пункт</Label>
                            <Input
                              id="city"
                              value={address.city}
                              onChange={(e) => setAddress({ ...address, city: e.target.value })}
                              className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-10 text-sm font-medium rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="street" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Улица / Проспект / Переулок</Label>
                            <Input
                              id="street"
                              placeholder="Например: Прокофьева"
                              value={address.street}
                              onChange={(e) => setAddress({ ...address, street: e.target.value })}
                              className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-10 text-sm font-medium rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                              <Label htmlFor="house" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Номер дома</Label>
                              <Input
                                id="house"
                                placeholder="Например: 10"
                                value={address.house}
                                onChange={(e) => setAddress({ ...address, house: e.target.value })}
                                className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-10 text-sm font-medium rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label htmlFor="block" className="text-xs font-semibold text-slate-500 dark:text-slate-400">Корпус / Литер</Label>
                              <Input
                                id="block"
                                placeholder="Например: 1"
                                value={address.block}
                                onChange={(e) => setAddress({ ...address, block: e.target.value })}
                                className="bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 h-10 text-sm font-medium rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800">
                          <Button 
                            className="w-full gap-2 btn-premium-gold hover:shadow-gold-glow font-bold h-11 text-sm rounded-xl" 
                            onClick={() => {
                              // RULE 2: Логируем запуск генерации КП
                              console.log("[Калькулятор] Запуск генерации КП для адреса:", address);
                              handleGenerateCP();
                            }}
                            disabled={isGeneratingCP}
                          >
                            {isGeneratingCP ? (
                              <>
                                <Spinner className="w-4 h-4 animate-spin mr-1.5" />
                                Форматируем документ...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                Сгенерировать и скачать
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <p className="text-[10px] text-center text-slate-500 dark:text-slate-400 w-full leading-relaxed font-semibold">
                      * Данный расчет является ознакомительным. Точная стоимость обслуживания, перечень оборудования и регламент регламентных работ фиксируются непосредственно в договоре.
                    </p>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>
      </TooltipProvider>
      <Footer />
    </div>
  );
}
