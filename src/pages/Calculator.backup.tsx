import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { InfoIcon, Calculator as CalcIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Calculator() {
  const [entrances, setEntrances] = useState<number>(1);
  const [apartments, setApartments] = useState<number>(25);
  
  // Equipment per entrance
  const [smartIntercoms, setSmartIntercoms] = useState<number>(1);
  const [additionalCameras, setAdditionalCameras] = useState<number>(0);
  const [elevatorCameras, setElevatorCameras] = useState<number>(0);
  const [gates, setGates] = useState<number>(0);

  const getTariff = (apts: number) => {
    if (apts < 15) return { smart: 0, addCam: 0, elev: 0, gate: 0, individualGate: false, valid: false };
    if (apts <= 24) return { smart: 150, addCam: 50, elev: 0, gate: 0, individualGate: true, valid: true };
    if (apts <= 29) return { smart: 105, addCam: 30, elev: 0, gate: 40, individualGate: false, valid: true };
    if (apts <= 39) return { smart: 85, addCam: 25, elev: 45, gate: 30, individualGate: false, valid: true };
    if (apts <= 59) return { smart: 80, addCam: 20, elev: 35, gate: 25, individualGate: false, valid: true };
    if (apts <= 79) return { smart: 70, addCam: 15, elev: 30, gate: 25, individualGate: false, valid: true };
    if (apts <= 99) return { smart: 65, addCam: 15, elev: 30, gate: 25, individualGate: false, valid: true };
    if (apts <= 150) return { smart: 60, addCam: 15, elev: 20, gate: 15, individualGate: false, valid: true };
    return { smart: 50, addCam: 10, elev: 15, gate: 10, individualGate: false, valid: true };
  };

  const rates = getTariff(apartments);
  
  let tariffPerApt = 0;
  if (rates.valid) {
    const smartPrice = smartIntercoms > 0 ? rates.smart : 0;
    tariffPerApt = smartPrice + (additionalCameras * rates.addCam) + (elevatorCameras * rates.elev) + (gates * rates.gate);
  }

  const totalMonthly = tariffPerApt * apartments * entrances;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col pt-20">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 rounded-xl">
              <CalcIcon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Калькулятор тарифа</h1>
              <p className="text-neutral-500">Рассчитайте ежемесячную абонентскую плату для вашего дома</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Общие параметры</CardTitle>
                  <CardDescription>Укажите базовые характеристики дома</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entrances">Кол-во подъездов в доме</Label>
                      <Input 
                        id="entrances" 
                        type="number" 
                        min="1" 
                        value={entrances} 
                        onChange={(e) => setEntrances(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="apartments">Квартир в одном подъезде</Label>
                      <Input 
                        id="apartments" 
                        type="number" 
                        min="1" 
                        value={apartments} 
                        onChange={(e) => setApartments(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Оборудование (из расчета на 1 подъезд)</CardTitle>
                  <CardDescription>Укажите количество устройств, устанавливаемых в одном подъезде</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smartIntercoms">Умных домофонов</Label>
                      <Input 
                        id="smartIntercoms" 
                        type="number" 
                        min="0" 
                        value={smartIntercoms} 
                        onChange={(e) => setSmartIntercoms(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="additionalCameras">Дополнительных камер</Label>
                      <Input 
                        id="additionalCameras" 
                        type="number" 
                        min="0" 
                        value={additionalCameras} 
                        onChange={(e) => setAdditionalCameras(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="elevatorCameras">Камер в лифте</Label>
                      <Input 
                        id="elevatorCameras" 
                        type="number" 
                        min="0" 
                        value={elevatorCameras} 
                        onChange={(e) => setElevatorCameras(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gates">Калиток</Label>
                      <Input 
                        id="gates" 
                        type="number" 
                        min="0" 
                        value={gates} 
                        onChange={(e) => setGates(Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-5">
              <Card className="sticky top-24 border-primary/20 shadow-lg bg-white/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Итоговый расчет</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!rates.valid ? (
                    <Alert variant="destructive">
                      <InfoIcon className="h-4 w-4" />
                      <AlertTitle>Внимание</AlertTitle>
                      <AlertDescription>
                        Для домов с количеством квартир в подъезде менее 15, тариф рассчитывается индивидуально. Обратитесь к менеджеру.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <div className="space-y-1 p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <p className="text-sm font-medium text-neutral-500">Тариф за 1 квартиру в месяц:</p>
                        <p className="text-4xl font-bold text-primary">{tariffPerApt} ₽</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm text-neutral-500">Из чего складывается тариф (на 1 кв.):</p>
                        <ul className="text-sm space-y-2 mt-2">
                          <li className="flex justify-between">
                            <span>Умный домофон:</span>
                            <span className="font-medium">{smartIntercoms > 0 ? rates.smart : 0} ₽</span>
                          </li>
                          <li className="flex justify-between">
                            <span>Доп. камеры ({additionalCameras} шт.):</span>
                            <span className="font-medium">{additionalCameras * rates.addCam} ₽</span>
                          </li>
                          <li className="flex justify-between">
                            <span>Камеры в лифте ({elevatorCameras} шт.):</span>
                            <span className="font-medium">{elevatorCameras * rates.elev} ₽</span>
                          </li>
                          <li className="flex justify-between">
                            <span>Калитки ({gates} шт.):</span>
                            <span className="font-medium">
                              {rates.individualGate && gates > 0 ? (
                                <span className="text-amber-600 text-xs">цена индивид.</span>
                              ) : (
                                `${gates * rates.gate} ₽`
                              )}
                            </span>
                          </li>
                        </ul>
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-sm text-neutral-500">Итого абонентская плата по дому:</p>
                        <p className="text-xl font-bold text-neutral-900">{totalMonthly.toLocaleString('ru-RU')} ₽ / мес</p>
                        <p className="text-xs text-neutral-400 mt-1">Ориентировочная сумма за {apartments * entrances} квартир в {entrances} подъездах</p>
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-center text-neutral-400 w-full">
                    Данный расчет является предварительным. Итоговая стоимость может быть скорректирована после осмотра объекта.
                  </p>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
