import { useState } from "react";
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

export default function Calculator() {
  const { toast } = useToast();

  const [entrances, setEntrances] = useState<number>(1);
  const [totalApartments, setTotalApartments] = useState<number>(100);
  const [smartIntercoms, setSmartIntercoms] = useState<number>(1);
  const [additionalCameras, setAdditionalCameras] = useState<number>(0);
  const [elevatorCameras, setElevatorCameras] = useState<number>(0);
  const [gates, setGates] = useState<number>(0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const aptsPerIntercom = Math.ceil(totalApartments / (smartIntercoms || 1));
  const rates = getTariff(aptsPerIntercom);

  let tariffPerApt = 0;
  if (rates.valid) {
    const smartPrice = smartIntercoms > 0 ? rates.smart : 0;
    const addCamPrice = additionalCameras > 0 ? Math.ceil(additionalCameras / entrances) * rates.addCam : 0;
    const elevPrice = elevatorCameras > 0 ? Math.ceil(elevatorCameras / entrances) * rates.elev : 0;
    const gatePrice = gates > 0 && !rates.individualGate ? Math.ceil(gates / entrances) * rates.gate : 0;
    tariffPerApt = smartPrice + addCamPrice + elevPrice + gatePrice;
  }

  const handleCalculate = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: "Ошибка", description: "Пожалуйста, заполните имя и телефон", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("calculations").insert({
        name,
        phone,
        entrances,
        total_apartments: totalApartments,
        smart_intercoms: smartIntercoms,
        additional_cameras: additionalCameras,
        elevator_cameras: elevatorCameras,
        gates,
        tariff_per_apt: rates.valid ? tariffPerApt : 0,
        is_individual: !rates.valid,
      });

      if (error) throw error;

      setShowResult(true);
      setIsDialogOpen(false);
      toast({ title: "Успех", description: "Расчёт выполнен!" });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message || "Не удалось сохранить данные", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const NumberInput = ({ id, label, value, onChange, min = 0 }: { id: string; label: string; value: number; onChange: (v: number) => void; min?: number }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-muted-foreground">{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        value={value === 0 && min === 0 ? "0" : value || ""}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-20">
        {/* Hero section */}
        <section className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-2">
                <CalcIcon className="w-8 h-8" />
              </div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
                Рассчитайте стоимость обслуживания
              </h1>
              <p className="text-primary-foreground/80 text-sm md:text-base max-w-xl mx-auto">
                Заполните параметры дома и оборудование. Калькулятор посчитает точный тариф для одной квартиры.
              </p>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Forms */}
            <div className="lg:col-span-7 space-y-6">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Параметры дома</CardTitle>
                  <CardDescription>Базовые характеристики всего дома</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberInput id="entrances" label="Подъездов" value={entrances} onChange={setEntrances} min={1} />
                    <NumberInput id="apartments" label="Квартир всего" value={totalApartments} onChange={setTotalApartments} min={1} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Оборудование</CardTitle>
                  <CardDescription>Суммарное количество на весь дом</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <NumberInput id="smartIntercoms" label="Умных домофонов" value={smartIntercoms} onChange={setSmartIntercoms} />
                    <NumberInput id="additionalCameras" label="Доп. камер" value={additionalCameras} onChange={setAdditionalCameras} />
                    <NumberInput id="elevatorCameras" label="Камер в лифте" value={elevatorCameras} onChange={setElevatorCameras} />
                    <NumberInput id="gates" label="Калиток" value={gates} onChange={setGates} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Result card */}
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
                            <DialogDescription>Представьтесь, чтобы мы сохранили ваш расчёт.</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="name">Ваше имя</Label>
                              <Input id="name" placeholder="Иван" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone">Телефон</Label>
                              <Input id="phone" placeholder="+7 (999) 000-00-00" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
                            Для домов с малым количеством квартир на 1 аппарат (менее 15), тариф рассчитывается индивидуально.
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
                              <li className="flex justify-between py-1 border-b border-border">
                                <span className="text-muted-foreground">Умный домофон</span>
                                <span className="font-semibold">{smartIntercoms > 0 ? rates.smart : 0} ₽</span>
                              </li>
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
                                    {rates.individualGate ? <span className="text-amber-600 text-xs">индивидуально</span> : `${Math.ceil(gates / entrances) * rates.gate} ₽`}
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
                  <CardFooter className="bg-muted/50 border-t pt-4">
                    <p className="text-xs text-center text-muted-foreground w-full">
                      Расчёт для ознакомления. Итоговая стоимость фиксируется в договоре.
                    </p>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
