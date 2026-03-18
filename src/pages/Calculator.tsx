import { useState, useEffect } from "react";
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

export default function Calculator() {
  const { toast } = useToast();

  const [entrances, setEntrances] = useState<number>(1);
  const [totalApartments, setTotalApartments] = useState<number>(100);
  
  // Equipment for the whole house
  const [smartIntercoms, setSmartIntercoms] = useState<number>(1);
  const [additionalCameras, setAdditionalCameras] = useState<number>(0);
  const [elevatorCameras, setElevatorCameras] = useState<number>(0);
  const [gates, setGates] = useState<number>(0);

  // Lead fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Reset result hide if user changes base parameters significantly, 
  // but it's friendlier to keep it shown if they already unlocked it.

  // Calculation logic
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
      const message = `Рассчет тарифа (с сайта):
Подъездов в доме: ${entrances}
Всего квартир: ${totalApartments}
Умных домофонов: ${smartIntercoms}
Доп. камер: ${additionalCameras}
Камер в лифте: ${elevatorCameras}
Калиток: ${gates}

Тариф на 1 кв: ${rates.valid ? tariffPerApt + ' руб/мес' : 'Индивидуально'}`;

      const { error } = await supabase.from('contacts').insert({
        name,
        phone,
        message,
        address: 'Калькулятор тарифа',
      });

      if (error) throw error;
      
      setShowResult(true);
      setIsDialogOpen(false);
      toast({ title: "Успех", description: "Расчет выполнен! Результат доступен на экране." });
    } catch (e: any) {
      toast({ title: "Ошибка", description: e.message || "Не удалось сохранить данные", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col pt-20">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl border shadow-sm">
            <div className="p-4 bg-primary/10 rounded-2xl shrink-0">
              <CalcIcon className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 mb-2">Рассчитайте стоимость обслуживания вашего дома самостоятельно!</h1>
              <p className="text-neutral-500">
                Заполните общие параметры вашего дома и необходимое оборудование. Укажите именно общие цифры на весь дом целиком (мы заключаем договор со всем домом). Калькулятор посчитает точный тариф для одной квартиры.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Общие параметры дома</CardTitle>
                  <CardDescription>Укажите базовые характеристики всего дома</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col justify-end space-y-2 h-full">
                      <Label htmlFor="entrances" className="leading-tight text-sm text-neutral-600">Кол-во подъездов во всем доме</Label>
                      <Input 
                        id="entrances" 
                        type="number" 
                        min="1" 
                        value={entrances || ""} 
                        onChange={(e) => setEntrances(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-auto"
                      />
                    </div>
                    <div className="flex flex-col justify-end space-y-2 h-full">
                      <Label htmlFor="apartments" className="leading-tight text-sm text-neutral-600">Общее кол-во квартир во всем доме</Label>
                      <Input 
                        id="apartments" 
                        type="number" 
                        min="1" 
                        value={totalApartments || ""} 
                        onChange={(e) => setTotalApartments(Math.max(1, parseInt(e.target.value) || 1))}
                        className="mt-auto"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Оборудование (на весь дом)</CardTitle>
                  <CardDescription>Укажите суммарное количество устройств, планируемых в доме</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col justify-end space-y-2 h-full">
                      <Label htmlFor="smartIntercoms" className="leading-tight text-sm text-neutral-600">Общее кол-во умных домофонов</Label>
                      <Input 
                        id="smartIntercoms" 
                        type="number" 
                        min="0" 
                        value={smartIntercoms === 0 ? "0" : smartIntercoms || ""} 
                        onChange={(e) => setSmartIntercoms(Math.max(0, parseInt(e.target.value) || 0))}
                        className="mt-auto"
                      />
                    </div>
                    <div className="flex flex-col justify-end space-y-2 h-full">
                      <Label htmlFor="additionalCameras" className="leading-tight text-sm text-neutral-600">Общее кол-во доп. камер</Label>
                      <Input 
                        id="additionalCameras" 
                        type="number" 
                        min="0" 
                        value={additionalCameras === 0 ? "0" : additionalCameras || ""} 
                        onChange={(e) => setAdditionalCameras(Math.max(0, parseInt(e.target.value) || 0))}
                        className="mt-auto"
                      />
                    </div>
                    <div className="flex flex-col justify-end space-y-2 h-full">
                      <Label htmlFor="elevatorCameras" className="leading-tight text-sm text-neutral-600">Общее кол-во камер в лифте</Label>
                      <Input 
                        id="elevatorCameras" 
                        type="number" 
                        min="0" 
                        value={elevatorCameras === 0 ? "0" : elevatorCameras || ""} 
                        onChange={(e) => setElevatorCameras(Math.max(0, parseInt(e.target.value) || 0))}
                        className="mt-auto"
                      />
                    </div>
                    <div className="flex flex-col justify-end space-y-2 h-full">
                      <Label htmlFor="gates" className="leading-tight text-sm text-neutral-600">Общее кол-во калиток</Label>
                      <Input 
                        id="gates" 
                        type="number" 
                        min="0" 
                        value={gates === 0 ? "0" : gates || ""} 
                        onChange={(e) => setGates(Math.max(0, parseInt(e.target.value) || 0))}
                        className="mt-auto"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-4">
              <Card className="sticky top-24 border-primary/20 shadow-lg bg-white overflow-hidden flex flex-col h-full lg:h-auto min-h-[300px]">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-lg">Ваш расчет</CardTitle>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex flex-col justify-center">
                  
                  {!showResult ? (
                    <div className="text-center space-y-4 py-8">
                      <div className="mx-auto w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                        <ShieldCheck className="w-8 h-8 text-neutral-400" />
                      </div>
                      <h3 className="text-lg font-medium text-neutral-700">Готово к расчету</h3>
                      <p className="text-sm text-neutral-500 mb-6">Введите количество оборудования и нажмите кнопку ниже, чтобы узнать точную стоимость.</p>
                      
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="lg" className="w-full font-semibold">Узнать стоимость</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Показать результат расчета</DialogTitle>
                            <DialogDescription>
                              Пожалуйста, представьтесь, чтобы мы могли сохранить ваш расчет и прикрепить его к вашему номеру.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="name">Ваше имя</Label>
                              <Input 
                                id="name" 
                                placeholder="Иван" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone">Контактный телефон</Label>
                              <Input 
                                id="phone" 
                                placeholder="+7 (999) 000-00-00" 
                                type="tel"
                                value={phone} 
                                onChange={(e) => setPhone(e.target.value)} 
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button disabled={isSubmitting} onClick={handleCalculate} className="w-full">
                              {isSubmitting ? "Отправка..." : "Показать расчет"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
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
                          <div className="space-y-2 text-center p-6 bg-primary/5 rounded-2xl border border-primary/20">
                            <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Абонентская плата</p>
                            <p className="text-5xl font-extrabold text-primary">{tariffPerApt} ₽</p>
                            <p className="text-sm text-neutral-500">с 1 квартиры в месяц</p>
                          </div>

                          <div className="space-y-3">
                            <p className="text-sm font-semibold text-neutral-700">Детализация на квартиру:</p>
                            <ul className="text-sm space-y-2 text-neutral-600">
                              <li className="flex justify-between items-center py-1 border-b border-neutral-100">
                                <span>Умный домофон:</span>
                                <span className="font-semibold text-neutral-900">{smartIntercoms > 0 ? rates.smart : 0} ₽</span>
                              </li>
                              {(additionalCameras > 0) && (
                                <li className="flex justify-between items-center py-1 border-b border-neutral-100">
                                  <span>Доп. камеры:</span>
                                  <span className="font-semibold text-neutral-900">{Math.ceil(additionalCameras / entrances) * rates.addCam} ₽</span>
                                </li>
                              )}
                              {(elevatorCameras > 0) && (
                                <li className="flex justify-between items-center py-1 border-b border-neutral-100">
                                  <span>Камеры в лифте:</span>
                                  <span className="font-semibold text-neutral-900">{Math.ceil(elevatorCameras / entrances) * rates.elev} ₽</span>
                                </li>
                              )}
                              {(gates > 0) && (
                                <li className="flex justify-between items-center py-1 border-b border-neutral-100">
                                  <span>Калитки:</span>
                                  <span className="font-semibold text-neutral-900">
                                    {rates.individualGate ? (
                                      <span className="text-amber-600 text-xs text-right">индивидуально</span>
                                    ) : (
                                      `${Math.ceil(gates / entrances) * rates.gate} ₽`
                                    )}
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
                  <CardFooter className="bg-neutral-50 border-t pt-4">
                    <p className="text-xs text-center text-neutral-400 w-full">
                      Данный расчет предоставляется для ознакомления. Итоговая стоимость фиксируется в договоре после детального осмотра.
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
