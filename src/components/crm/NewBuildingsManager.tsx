import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Construction, Search, FileSpreadsheet, Package, ClipboardList, Building2,
  ChevronDown, ChevronRight, Loader2, Phone, DoorOpen, History, Download,
  CheckCircle2, Clock, CalendarClock,
} from "lucide-react";
import { houseKey, statusLabel } from "@/lib/newBuildings";

// ============================================================================
// Раздел «Новые дома» — объекты на монтаже (entrances.service_type='installation').
// Вкладки: Заявки по адресам · Оборудование по адресам · Общий итог (+Excel).
// Плюс карточка объекта с историей подъездов и оборудованием за период монтажа.
// ============================================================================

// Типы заявок, которые НЕ относятся к монтажу (служебные)
const SERVICE_ORDER_TYPES = ["verification_request", "data_change_request"];

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("ru-RU") : "—";

export const NewBuildingsManager = () => {
  const [subTab, setSubTab] = useState("requests");
  const [paidOnly, setPaidOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detailKey, setDetailKey] = useState<string | null>(null);

  // 1. Подъезды на монтаже
  const { data: montageEntrances = [], isLoading: loadingEntr } = useQuery({
    queryKey: ["nb_montage_entrances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entrances")
        .select("id, city, street, house, entrance, total_apartments, service_type, created_at")
        .eq("service_type", "installation");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // 2. Все заявки (их немного) — фильтруем на клиенте
  const { data: allRequests = [], isLoading: loadingReq } = useQuery({
    queryKey: ["nb_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("id, name, phone, street, house, entrance, apartment, status, payment_status, payment_amount, order_type, service_type, created_at, message")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // 3. Позиции заявок (оборудование)
  const { data: allItems = [] } = useQuery({
    queryKey: ["nb_request_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_items").select("id, request_id, product_id, quantity, price");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // 4. Справочник товаров
  const { data: products = [] } = useQuery({
    queryKey: ["nb_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, unit, category");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // 5. История статусов подъездов
  const { data: history = [] } = useQuery({
    queryKey: ["nb_entrance_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entrance_status_history")
        .select("*")
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const productMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  const itemsByRequest = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const it of allItems) { (m[it.request_id] ||= []).push(it); }
    return m;
  }, [allItems]);

  // Множество ключей монтажных домов + группировка подъездов по дому
  const houses = useMemo(() => {
    const map: Record<string, any> = {};
    for (const e of montageEntrances) {
      const key = houseKey(e.street, e.house);
      if (!map[key]) {
        map[key] = { key, city: e.city, street: e.street, house: e.house, entrances: [] as any[] };
      }
      map[key].entrances.push(e);
    }
    return map;
  }, [montageEntrances]);

  const houseKeys = useMemo(() => new Set(Object.keys(houses)), [houses]);

  // Заявки, относящиеся к монтажным домам (исключая служебные типы)
  const montageRequests = useMemo(() => {
    return allRequests.filter((r) => {
      if (SERVICE_ORDER_TYPES.includes(r.order_type)) return false;
      if (paidOnly && r.payment_status !== "paid") return false;
      const key = houseKey(r.street, r.house);
      return houseKeys.has(key);
    });
  }, [allRequests, houseKeys, paidOnly]);

  // Группируем заявки по дому
  const requestsByHouse = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const r of montageRequests) { (m[houseKey(r.street, r.house)] ||= []).push(r); }
    return m;
  }, [montageRequests]);

  // Агрегат оборудования по дому: product_id -> qty
  const equipmentByHouse = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const r of montageRequests) {
      const key = houseKey(r.street, r.house);
      const items = itemsByRequest[r.id] || [];
      for (const it of items) {
        m[key] ||= {};
        m[key][it.product_id] = (m[key][it.product_id] || 0) + (Number(it.quantity) || 0);
      }
    }
    return m;
  }, [montageRequests, itemsByRequest]);

  // Общий итог по всем домам: product_id -> qty
  const totals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const key of Object.keys(equipmentByHouse)) {
      for (const pid of Object.keys(equipmentByHouse[key])) {
        m[pid] = (m[pid] || 0) + equipmentByHouse[key][pid];
      }
    }
    return m;
  }, [equipmentByHouse]);

  const houseList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.values(houses)
      .filter((h: any) => {
        if (!q) return true;
        return `${h.street} ${h.house} ${h.city}`.toLowerCase().includes(q);
      })
      .sort((a: any, b: any) => `${a.street}${a.house}`.localeCompare(`${b.street}${b.house}`, "ru"));
  }, [houses, search]);

  const houseTitle = (h: any) => `${h.street || ""}, д. ${h.house || ""}`.trim();
  const pName = (pid: string) => productMap[pid]?.name || "Товар";
  const pUnit = (pid: string) => productMap[pid]?.unit || "шт";

  const reqSummary = (r: any): string => {
    const items = itemsByRequest[r.id] || [];
    if (!items.length) return r.message ? String(r.message).slice(0, 60) : "—";
    return items.map((it: any) => `${pName(it.product_id)} ×${it.quantity}`).join(", ");
  };

  // ------- Excel выгрузки -------
  const exportTotals = () => {
    const aoa: any[][] = [["Оборудование", "Ед.", "Всего заказать"]];
    const rows = Object.keys(totals)
      .map((pid) => ({ name: pName(pid), unit: pUnit(pid), qty: totals[pid] }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    for (const r of rows) aoa.push([r.name, r.unit, r.qty]);
    aoa.push([]);
    aoa.push(["Объектов на монтаже:", Object.keys(houses).length]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 40 }, { wch: 8 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Итог закупки");
    XLSX.writeFile(wb, `Новые_дома_закупка_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportByAddress = () => {
    const aoa: any[][] = [["Город", "Улица", "Дом", "Оборудование", "Ед.", "Количество"]];
    for (const h of Object.values(houses) as any[]) {
      const eq = equipmentByHouse[h.key] || {};
      const pids = Object.keys(eq).sort((a, b) => pName(a).localeCompare(pName(b), "ru"));
      if (!pids.length) {
        aoa.push([h.city || "", h.street || "", h.house || "", "— нет заказанного оборудования —", "", ""]);
      } else {
        for (const pid of pids) aoa.push([h.city || "", h.street || "", h.house || "", pName(pid), pUnit(pid), eq[pid]]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 36 }, { wch: 8 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Оборудование по адресам");
    XLSX.writeFile(wb, `Новые_дома_по_адресам_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportHouseSheet = (h: any) => {
    const eq = equipmentByHouse[h.key] || {};
    const aoa: any[][] = [[`Лист монтажника — ${houseTitle(h)}`], [], ["Оборудование", "Ед.", "Количество"]];
    const pids = Object.keys(eq).sort((a, b) => pName(a).localeCompare(pName(b), "ru"));
    if (!pids.length) aoa.push(["— нет заказанного оборудования —", "", ""]);
    for (const pid of pids) aoa.push([pName(pid), pUnit(pid), eq[pid]]);
    aoa.push([]);
    aoa.push(["Подъезды на монтаже:", (h.entrances || []).map((e: any) => e.entrance).filter(Boolean).join(", ")]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 40 }, { wch: 8 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Лист монтажника");
    const safe = `${h.street || ""}_${h.house || ""}`.replace(/[^\wа-яА-Я0-9]+/g, "_");
    XLSX.writeFile(wb, `Монтаж_${safe}.xlsx`);
  };

  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));

  const detailHouse = detailKey ? houses[detailKey] : null;

  const loading = loadingEntr || loadingReq;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Construction className="h-5 w-5 text-primary" /> Новые дома
          </h2>
          <p className="text-sm text-muted-foreground">
            Объекты на монтаже: {Object.keys(houses).length} · заявок: {montageRequests.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="nb_paid" className="text-xs text-muted-foreground">Только оплаченные</Label>
          <Switch id="nb_paid" checked={paidOnly} onCheckedChange={setPaidOnly} />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по адресу…" className="pl-10 h-9" />
      </div>

      <Tabs value={subTab} onValueChange={setSubTab} className="w-full">
        <TabsList className="bg-muted/60 p-1 rounded-xl flex-wrap h-auto">
          <TabsTrigger value="requests" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold">
            <ClipboardList className="h-4 w-4" /> Заявки по адресам
          </TabsTrigger>
          <TabsTrigger value="equipment" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold">
            <Package className="h-4 w-4" /> Оборудование по адресам
          </TabsTrigger>
          <TabsTrigger value="totals" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold">
            <FileSpreadsheet className="h-4 w-4" /> Общий итог
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : houseList.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Нет объектов на монтаже. Пометьте дом «На монтаж» во вкладке «Адреса и подъезды».
          </div>
        ) : (
          <>
            {/* ВКЛАДКА 1: Заявки по адресам */}
            <TabsContent value="requests" className="mt-4 space-y-3">
              {houseList.map((h: any) => {
                const reqs = requestsByHouse[h.key] || [];
                const open = expanded[h.key];
                return (
                  <Card key={h.key} className="border-border/60 shadow-sm">
                    <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => toggle(h.key)}>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <Building2 className="h-4 w-4 text-primary" /> {houseTitle(h)}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{reqs.length} заявок</Badge>
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={(e) => { e.stopPropagation(); setDetailKey(h.key); }}>
                            <History className="h-3.5 w-3.5" /> История
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {open && (
                      <CardContent className="px-4 pb-3 pt-0">
                        {reqs.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">Пока нет заявок по этому дому</p>
                        ) : (
                          <div className="w-full overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Клиент</TableHead>
                                  <TableHead>Подъезд / Кв.</TableHead>
                                  <TableHead>Заказ</TableHead>
                                  <TableHead>Оплата</TableHead>
                                  <TableHead>Статус</TableHead>
                                  <TableHead>Дата</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reqs.map((r: any) => (
                                  <TableRow key={r.id}>
                                    <TableCell className="font-medium">
                                      {r.name || "—"}
                                      {r.phone && <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</div>}
                                    </TableCell>
                                    <TableCell className="text-sm">п. {r.entrance || "—"}{r.apartment ? `, кв. ${r.apartment}` : ""}</TableCell>
                                    <TableCell className="text-xs max-w-[280px]">{reqSummary(r)}</TableCell>
                                    <TableCell>
                                      {r.payment_status === "paid"
                                        ? <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Оплачено</Badge>
                                        : <Badge variant="outline" className="text-amber-700 border-amber-300">Не оплачено</Badge>}
                                    </TableCell>
                                    <TableCell className="text-xs">{r.status}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </TabsContent>

            {/* ВКЛАДКА 2: Оборудование по адресам */}
            <TabsContent value="equipment" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportByAddress}>
                  <Download className="h-4 w-4" /> Excel по адресам
                </Button>
              </div>
              {houseList.map((h: any) => {
                const eq = equipmentByHouse[h.key] || {};
                const pids = Object.keys(eq).sort((a, b) => pName(a).localeCompare(pName(b), "ru"));
                return (
                  <Card key={h.key} className="border-border/60 shadow-sm">
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" /> {houseTitle(h)}
                        </CardTitle>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => exportHouseSheet(h)}>
                          <Download className="h-3.5 w-3.5" /> Лист монтажника
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                      {pids.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Оборудование пока не заказано</p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Оборудование</TableHead>
                              <TableHead className="text-right">Заказано</TableHead>
                              <TableHead className="text-right">Докупить</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pids.map((pid) => (
                              <TableRow key={pid}>
                                <TableCell className="text-sm">{pName(pid)}</TableCell>
                                <TableCell className="text-right">{eq[pid]} {pUnit(pid)}</TableCell>
                                <TableCell className="text-right font-semibold">{eq[pid]} {pUnit(pid)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* ВКЛАДКА 3: Общий итог */}
            <TabsContent value="totals" className="mt-4 space-y-3">
              <div className="flex justify-end">
                <Button className="gap-1.5" onClick={exportTotals}>
                  <Download className="h-4 w-4" /> Выгрузить в Excel
                </Button>
              </div>
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-base">Сколько всего докупить по всем объектам</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {Object.keys(totals).length === 0 ? (
                    <p className="p-6 text-center text-muted-foreground text-sm">Оборудование пока не заказано</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Оборудование</TableHead>
                          <TableHead className="text-right">Количество</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(totals)
                          .sort((a, b) => pName(a).localeCompare(pName(b), "ru"))
                          .map((pid) => (
                            <TableRow key={pid}>
                              <TableCell className="text-sm">{pName(pid)}</TableCell>
                              <TableCell className="text-right font-semibold">{totals[pid]} {pUnit(pid)}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Карточка объекта: история подъездов + оборудование */}
      <Dialog open={!!detailKey} onOpenChange={(o) => { if (!o) setDetailKey(null); }}>
        <DialogContent className="max-w-lg">
          {detailHouse && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" /> {houseTitle(detailHouse)}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Подъезды и их история */}
                {(detailHouse.entrances || []).map((e: any) => {
                  const hist = history.filter((hh) => hh.entrance_id === e.id);
                  const montageStart = [...hist].reverse().find((hh) => hh.status === "installation");
                  return (
                    <div key={e.id} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm flex items-center gap-1.5">
                          <DoorOpen className="h-4 w-4 text-muted-foreground" /> Подъезд {e.entrance || "—"}
                        </span>
                        <Badge variant="outline" className="text-amber-700 border-amber-300 gap-1">
                          <Clock className="h-3 w-3" /> {statusLabel(e.service_type)}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        На монтаже с: <b className="text-foreground">{fmtDate(montageStart?.changed_at || e.created_at)}</b>
                      </div>
                      {/* Лента переходов */}
                      {hist.length > 0 && (
                        <div className="mt-2 space-y-1 border-t pt-2">
                          {hist.map((hh) => (
                            <div key={hh.id} className="text-[11px] flex items-center justify-between gap-2">
                              <span>{statusLabel(hh.status)}</span>
                              <span className="text-muted-foreground">
                                {fmtDate(hh.changed_at)}{hh.changed_by_name ? ` · ${hh.changed_by_name}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Оборудование, заказанное за период монтажа */}
                <div className="rounded-xl border p-3">
                  <p className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" /> Заказано на объекте</p>
                  {(() => {
                    const eq = equipmentByHouse[detailHouse.key] || {};
                    const pids = Object.keys(eq);
                    if (!pids.length) return <p className="text-xs text-muted-foreground">Оборудование пока не заказано</p>;
                    return (
                      <div className="space-y-1">
                        {pids.sort((a, b) => pName(a).localeCompare(pName(b), "ru")).map((pid) => (
                          <div key={pid} className="text-sm flex items-center justify-between">
                            <span>{pName(pid)}</span>
                            <span className="font-medium">{eq[pid]} {pUnit(pid)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <Button variant="outline" className="w-full gap-1.5" onClick={() => exportHouseSheet(detailHouse)}>
                  <Download className="h-4 w-4" /> Лист монтажника (Excel)
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewBuildingsManager;
