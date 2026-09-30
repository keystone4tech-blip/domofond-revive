import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Wrench, ListChecks, PackageSearch } from "lucide-react";

// ============================================================================
// Подбор оборудования: наглядная настройка галочками.
//   Таб 1 «По анкете»: 3 сценария (нет / трубка / монитор) → какие УСЛУГИ показывать.
//   Таб 2 «Оборудование к услуге»: у каждой услуги — какое ОБОРУДОВАНИЕ предлагать.
// Кабинет по анкете жильца выбирает сценарий → показывает отмеченные услуги →
// при выборе услуги показывает привязанное к ней оборудование (с учётом привязки к подъезду).
// ============================================================================

const SCENARIOS: { key: string; title: string; hint: string }[] = [
  { key: "none",    title: "Нет домофона",        hint: "У жильца ничего не установлено" },
  { key: "handset", title: "Установлена трубка",  hint: "Стоит обычная трубка (ТКП)" },
  { key: "monitor", title: "Установлен монитор",  hint: "Стоит видеомонитор" },
];

interface Prod { id: string; name: string; category: string | null; price: number; }

export const EquipmentMatchingManager: React.FC = () => {
  const { toast } = useToast();

  const { data: products = [], refetch: refetchProducts } = useQuery({
    queryKey: ["products_for_matching"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id,name,category,price,is_active").order("name");
      if (error) throw error;
      return (data || []).filter((p: any) => p.is_active !== false) as Prod[];
    },
  });
  const { data: scenarioLinks = [], refetch: refetchScenario } = useQuery({
    queryKey: ["scenario_services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scenario_services").select("scenario,product_id");
      if (error) { console.warn(error.message); return [] as any[]; }
      return (data || []) as { scenario: string; product_id: string }[];
    },
  });
  const { data: serviceLinks = [], refetch: refetchServiceLinks } = useQuery({
    queryKey: ["service_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_products").select("service_id,product_id");
      if (error) { console.warn(error.message); return [] as any[]; }
      return (data || []) as { service_id: string; product_id: string }[];
    },
  });

  const services = useMemo(() => products.filter((p) => p.category === "service"), [products]);
  const equipment = useMemo(() => products.filter((p) => p.category !== "service"), [products]);

  // --- Таб 1: сценарий → услуги ---
  const [scenSearch, setScenSearch] = useState("");
  const scenarioHas = (scenario: string, productId: string) =>
    scenarioLinks.some((l) => l.scenario === scenario && l.product_id === productId);
  const toggleScenario = async (scenario: string, productId: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("scenario_services").insert({ scenario, product_id: productId });
      if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("scenario_services").delete().eq("scenario", scenario).eq("product_id", productId);
      if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    }
    refetchScenario();
  };

  // --- Таб 2: услуга → оборудование ---
  const [selectedService, setSelectedService] = useState<string>("");
  const [equipSearch, setEquipSearch] = useState("");
  const serviceHas = (serviceId: string, productId: string) =>
    serviceLinks.some((l) => l.service_id === serviceId && l.product_id === productId);
  const toggleServiceEquip = async (serviceId: string, productId: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("service_products").insert({ service_id: serviceId, product_id: productId });
      if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("service_products").delete().eq("service_id", serviceId).eq("product_id", productId);
      if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    }
    refetchServiceLinks();
  };

  const filteredServices = (q: string) => services.filter((s) => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const filteredEquipment = equipment.filter((e) => !equipSearch.trim() || e.name.toLowerCase().includes(equipSearch.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> Подбор оборудования</h2>
        <p className="text-sm text-muted-foreground">Настройте галочками, что предлагать жильцу в зависимости от того, что у него установлено.</p>
      </div>

      <Tabs defaultValue="scenarios">
        <TabsList>
          <TabsTrigger value="scenarios" className="gap-1.5"><ListChecks className="h-4 w-4" /> По анкете</TabsTrigger>
          <TabsTrigger value="equipment" className="gap-1.5"><PackageSearch className="h-4 w-4" /> Оборудование к услуге</TabsTrigger>
        </TabsList>

        {/* ТАБ 1: сценарий → услуги */}
        <TabsContent value="scenarios" className="mt-4">
          <div className="relative max-w-sm mb-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={scenSearch} onChange={(e) => setScenSearch(e.target.value)} placeholder="Поиск услуги…" className="pl-9 h-9" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {SCENARIOS.map((sc) => (
              <Card key={sc.key} className="shadow-sm">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-base">{sc.title}</CardTitle>
                  <p className="text-[11px] text-muted-foreground">{sc.hint}</p>
                </CardHeader>
                <CardContent className="p-2 max-h-[420px] overflow-y-auto space-y-1">
                  {services.length === 0 && <p className="text-xs text-muted-foreground p-2">Сначала создайте услуги во вкладке «Товары и услуги».</p>}
                  {filteredServices(scenSearch).map((s) => {
                    const on = scenarioHas(sc.key, s.id);
                    return (
                      <label key={s.id} className="flex items-start gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={on} onCheckedChange={(v) => toggleScenario(sc.key, s.id, !!v)} className="mt-0.5" />
                        <span className="leading-snug">{s.name}</span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ТАБ 2: услуга → оборудование */}
        <TabsContent value="equipment" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Список услуг */}
            <Card className="shadow-sm lg:col-span-1">
              <CardHeader className="py-3 px-4 border-b"><CardTitle className="text-base">Услуги</CardTitle></CardHeader>
              <CardContent className="p-2 max-h-[460px] overflow-y-auto space-y-1">
                {services.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSelectedService(s.id)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${selectedService === s.id ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted/50"}`}>
                    {s.name}
                    {serviceLinks.filter((l) => l.service_id === s.id).length > 0 && (
                      <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{serviceLinks.filter((l) => l.service_id === s.id).length}</Badge>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Оборудование выбранной услуги */}
            <Card className="shadow-sm lg:col-span-2">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-base">
                  {selectedService ? "Оборудование для услуги" : "Выберите услугу слева"}
                </CardTitle>
                {selectedService && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {services.find((s) => s.id === selectedService)?.name}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-2">
                {!selectedService ? (
                  <p className="text-sm text-muted-foreground p-3">Слева выберите услугу, затем отметьте галочками оборудование, которое к ней относится.</p>
                ) : (
                  <>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input value={equipSearch} onChange={(e) => setEquipSearch(e.target.value)} placeholder="Поиск оборудования…" className="pl-9 h-9" />
                    </div>
                    <div className="max-h-[400px] overflow-y-auto space-y-1">
                      {filteredEquipment.map((e) => {
                        const on = serviceHas(selectedService, e.id);
                        return (
                          <label key={e.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                            <Checkbox checked={on} onCheckedChange={(v) => toggleServiceEquip(selectedService, e.id, !!v)} />
                            <span className="flex-1 leading-snug">{e.name}</span>
                            <span className="text-[11px] text-muted-foreground shrink-0">{Number(e.price)} ₽</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EquipmentMatchingManager;
