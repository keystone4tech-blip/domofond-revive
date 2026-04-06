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

const NumberInput = ({ id, label, value, onChange, error, min = 0, placeholder, tooltip }: NumberInputProps) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="text-sm text-muted-foreground whitespace-nowrap">
        {label}
      </Label>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-primary transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">
            <p>{tooltip}</p>
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
      className={error ? "border-destructive focus-visible:ring-destructive" : undefined}
    />
    {error && (
      <p id={`${id}-error`} className="text-xs text-destructive">
        {error}
      </p>
    )}
  </div>
);

export default function Calculator() {
  const { toast } = useToast();

  const [numericValues, setNumericValues] = useState<Record<NumericFieldKey, string>>({
    entrances: "1",
    totalApartments: "100",
    smartIntercoms: "0",
    additionalCameras: "0",
    elevatorCameras: "0",
    gates: "0",
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
  const rates = getTariff(aptsPerEntrance);

  const gateMaintenanceCost = 5500;
  const gatePrice = gates > 0 ? Math.ceil(((gates * gateMaintenanceCost) / totalApartments) / 5) * 5 : 0;

  let tariffPerApt = 0;
  if (rates.valid) {
    const smartPrice = smartIntercoms > 0 ? rates.smart : 0;
    const addCamPrice = additionalCameras > 0 ? Math.ceil(additionalCameras / entrances) * rates.addCam : 0;
    const elevPrice = elevatorCameras > 0 ? Math.ceil(elevatorCameras / entrances) * rates.elev : 0;
    
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
        tariff_per_apt: rates.valid ? tariffPerApt : 0,
        is_individual: !rates.valid,
        tariff_details: {
          aptsPerEntrance,
          smartRate: rates.smart,
          additionalCameraRate: rates.addCam,
          elevatorRate: rates.elev,
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
            smart: rates.smart,
            addCam: rates.addCam,
            elev: rates.elev,
            gate: rates.gate,
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
              smartRate: rates.smart,
              additionalCameraRate: rates.addCam,
              elevatorRate: rates.elev,
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
    <div className="min-h-screen flex flex-col">
      <TooltipProvider>
        <Header />
      <main className="flex-1 pt-20">
        <section className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm mb-2">
                <CalcIcon className="w-8 h-8" />
              </div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight">Рассчитайте стоимость обслуживания</h1>
              <p className="text-primary-foreground/80 text-sm md:text-base max-w-xl mx-auto">
                Заполните параметры дома и оборудование. Калькулятор посчитает точный тариф для одной квартиры.
              </p>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Параметры дома</CardTitle>
                  <CardDescription>Укажите основные характеристики вашего многоквартирного дома.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberInput
                      id="entrances"
                      label="Подъездов"
                      value={numericValues.entrances}
                      onChange={handleNumericChange("entrances")}
                      min={1}
                      placeholder="1"
                      error={fieldErrors.entrances}
                    />
                    <NumberInput
                      id="apartments"
                      label="Квартир всего"
                      value={numericValues.totalApartments}
                      onChange={handleNumericChange("totalApartments")}
                      min={1}
                      placeholder="100"
                      error={fieldErrors.totalApartments}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg text-primary">Оборудование компании «ДомофонДар»</CardTitle>
                  <CardDescription className="text-sm font-medium text-foreground/80">
                    Установка или замена оборудования производится за счёт компании <span className="text-primary font-bold">абсолютно БЕСПЛАТНО</span>. 
                    Укажите необходимое количество для установки или модернизации.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberInput
                      id="smartIntercoms"
                      label="Умных домофонов"
                      value={numericValues.smartIntercoms}
                      onChange={handleNumericChange("smartIntercoms")}
                      min={0}
                      placeholder="0"
                      error={fieldErrors.smartIntercoms}
                      tooltip="Вызывная панель на каждую подъездную дверь."
                    />
                    <NumberInput
                      id="additionalCameras"
                      label="Доп. камер"
                      value={numericValues.additionalCameras}
                      onChange={handleNumericChange("additionalCameras")}
                      placeholder="0"
                      tooltip="Камеры, устанавливаемые дополнительно к домофонам или отдельно на придомовую территорию, фасады и подъезды."
                    />
                    <NumberInput
                      id="elevatorCameras"
                      label="Камер в лифте"
                      value={numericValues.elevatorCameras}
                      onChange={handleNumericChange("elevatorCameras")}
                      placeholder="0"
                      tooltip="Устанавливаются в кабины лифтов (пассажирских и грузовых), по 1 камере на каждый лифт."
                    />
                    <NumberInput
                      id="gates"
                      label="Калиток"
                      value={numericValues.gates}
                      onChange={handleNumericChange("gates")}
                      placeholder="0"
                      tooltip="Входы на придомовую территорию, оснащаемые вызывными панелями (как на подъездах). Если калиток нет, оставьте 0."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-5">
              <Card className="sticky top-24 border-primary/20 shadow-lg overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-lg">Ваш расчёт</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {!showResult ? (
                    <div className="text-center space-y-4 py-6">
                      <div className="mx-auto w-14 h-14 bg-muted rounded-full flex items-center justify-center">
                        <ShieldCheck className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium">Готово к расчёту</h3>
                      <p className="text-sm text-muted-foreground">Нажмите кнопку, чтобы узнать точную стоимость.</p>

                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="lg" className="w-full font-semibold">Узнать стоимость</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Показать результат</DialogTitle>
                            <DialogDescription>Представьтесь, чтобы мы сохранили ваш расчёт в админ-панель.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="name">Ваше имя</Label>
                              <Input
                                id="name"
                                placeholder="Иван"
                                value={name}
                                onChange={(event) => {
                                  setName(event.target.value);
                                  clearFieldError("name");
                                }}
                                className={fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : undefined}
                              />
                              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone">Телефон</Label>
                              <Input
                                id="phone"
                                placeholder="+7 (999) 000-00-00"
                                type="tel"
                                value={phone}
                                onChange={(event) => {
                                  setPhone(event.target.value);
                                  clearFieldError("phone");
                                }}
                                className={fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : undefined}
                              />
                              {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button disabled={isSubmitting} onClick={handleCalculate} className="w-full">
                              {isSubmitting ? "Отправка..." : "Показать расчёт"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : (
                    <div className="space-y-5 animate-in fade-in zoom-in duration-300">
                      {!rates.valid ? (
                        <Alert variant="destructive">
                          <InfoIcon className="h-4 w-4" />
                          <AlertTitle>Внимание</AlertTitle>
                          <AlertDescription>
                            Для домов с малым количеством квартир на 1 аппарат тариф рассчитывается индивидуально.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="text-center p-5 bg-primary/5 rounded-xl border border-primary/20">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Абонентская плата</p>
                            <p className="text-4xl font-extrabold text-primary">{tariffPerApt} ₽</p>
                            <p className="text-xs text-muted-foreground mt-1">с 1 квартиры в месяц</p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-semibold">Детализация:</p>
                            <ul className="text-sm space-y-1.5">
                              {smartIntercoms > 0 && (
                                <li className="flex justify-between py-1 border-b border-border">
                                  <span className="text-muted-foreground">Умный домофон</span>
                                  <span className="font-semibold">{rates.smart} ₽</span>
                                </li>
                              )}
                              {additionalCameras > 0 && (
                                <li className="flex justify-between py-1 border-b border-border">
                                  <span className="text-muted-foreground">Доп. камеры</span>
                                  <span className="font-semibold">{Math.ceil(additionalCameras / entrances) * rates.addCam} ₽</span>
                                </li>
                              )}
                              {elevatorCameras > 0 && (
                                <li className="flex justify-between py-1 border-b border-border">
                                  <span className="text-muted-foreground">Камеры в лифте</span>
                                  <span className="font-semibold">{Math.ceil(elevatorCameras / entrances) * rates.elev} ₽</span>
                                </li>
                              )}
                              {gates > 0 && (
                                <li className="flex justify-between py-1 border-b border-border">
                                  <span className="text-muted-foreground">Калитки</span>
                                  <span className="font-semibold">
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
                  <CardFooter className="flex flex-col gap-4 bg-muted/50 border-t pt-4">
                    <Dialog open={isCPDialogOpen} onOpenChange={setIsCPDialogOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 transition-colors">
                          <FileText className="w-4 h-4" />
                          Оформить КП (DOCX)
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Данные для КП</DialogTitle>
                          <DialogDescription>
                            Укажите адрес объекта для автоматического заполнения документа.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="city">Город</Label>
                            <Input
                              id="city"
                              value={address.city}
                              onChange={(e) => setAddress({ ...address, city: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="street">Улица</Label>
                            <Input
                              id="street"
                              placeholder="Прокофьева"
                              value={address.street}
                              onChange={(e) => setAddress({ ...address, street: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                              <Label htmlFor="house">Дом</Label>
                              <Input
                                id="house"
                                placeholder="10"
                                value={address.house}
                                onChange={(e) => setAddress({ ...address, house: e.target.value })}
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="block">Корпус/Литер</Label>
                              <Input
                                id="block"
                                placeholder="1"
                                value={address.block}
                                onChange={(e) => setAddress({ ...address, block: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            className="w-full gap-2" 
                            onClick={handleGenerateCP}
                            disabled={isGeneratingCP}
                          >
                            {isGeneratingCP ? (
                              <>
                                <Spinner className="w-4 h-4 animate-spin" />
                                Создаем документ...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Сгенерировать и скачать
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <p className="text-[10px] text-center text-muted-foreground w-full leading-relaxed">
                      Расчёт для ознакомления. Итоговая стоимость и перечень работ фиксируются в договоре.
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
