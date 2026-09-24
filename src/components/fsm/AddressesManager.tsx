import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Package,
  DoorClosed,
  MapPin,
  Check,
  Loader2,
  Copy,
  Info
} from "lucide-react";
import { BindProductsDialog } from "./BindProductsDialog";

// Интерфейс подъезда из таблицы entrances
export interface Entrance {
  id: string;
  city: string;
  street: string;
  house: string;
  entrance: string;
  intercom_type: string | null;
  service_type?: 'installation' | 'maintenance' | 'rent' | string; // Статус объекта: монтаж (льготный), ТО (розница), аренда (розница)
  has_smart_intercom?: boolean | null; // Флаг умного домофона (позволяет жильцам покупать ЛК)
  notes: string | null;
  created_at: string;
}

// Интерфейс товара из таблицы products
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  promo_price?: number | null;
  installation_price?: number | null;
  unit: string;
  image_url: string | null;
  is_active: boolean;
}

// Детали привязки товара к подъезду с ценой
export interface EntranceProductBinding {
  product_id: string;
  price_type: string;
  custom_price: number | null;
}

export const AddressesManager: React.FC = () => {
  const { toast } = useToast();

  // --- Основные состояния данных ---
  const [entrances, setEntrances] = useState<Entrance[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [entranceProducts, setEntranceProducts] = useState<Record<string, string[]>>({}); // entrance_id -> array of product_ids
  const [entranceProductDetails, setEntranceProductDetails] = useState<Record<string, Record<string, EntranceProductBinding>>>({}); // entrance_id -> product_id -> details
  
  // --- Состояния загрузки и поиска ---
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Состояния раскрытия дерева ---
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());
  const [expandedHouses, setExpandedHouses] = useState<Set<string>>(new Set());
  const [selectedEntrance, setSelectedEntrance] = useState<Entrance | null>(null);

  // --- Модальные окна ---
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    city: "Краснодар",
    street: "",
    house: "",
    entrance: "1",
    intercom_type: "",
    notes: ""
  });

  const [isBindProductsOpen, setIsBindProductsOpen] = useState(false);
  const [selectedProductIdsToBind, setSelectedProductIdsToBind] = useState<string[]>([]);
  const [savingBinding, setSavingBinding] = useState(false);

  // Загрузка всех необходимых данных при старте
  useEffect(() => {
    console.log("[AddressesManager] Инициализация компонента адресов...");
    loadAllData();
  }, []);

  // Функция комплексной загрузки: подъезды, товары и привязки
  const loadAllData = async () => {
    setLoading(true);
    try {
      console.log("[AddressesManager] Запрос списка подъездов и товаров из БД...");
      const [entrancesRes, productsRes, bindingsRes] = await Promise.all([
        supabase.from("entrances" as any).select("*").order("city").order("street").order("house").order("entrance"),
        supabase.from("products").select("*").eq("is_active", true).order("name"),
        supabase.from("entrance_products" as any).select("*")
      ]);

      if (entrancesRes.error) throw entrancesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (bindingsRes.error) throw bindingsRes.error;

      setEntrances((entrancesRes.data as any) || []);
      setProducts((productsRes.data as any) || []);

      // Группируем связи: entrance_id -> product_id[] и entrance_id -> product_id -> details
      const bindingsMap: Record<string, string[]> = {};
      const detailsMap: Record<string, Record<string, EntranceProductBinding>> = {};

      ((bindingsRes.data as any) || []).forEach((row: any) => {
        if (!bindingsMap[row.entrance_id]) {
          bindingsMap[row.entrance_id] = [];
        }
        bindingsMap[row.entrance_id].push(row.product_id);

        if (!detailsMap[row.entrance_id]) {
          detailsMap[row.entrance_id] = {};
        }
        detailsMap[row.entrance_id][row.product_id] = {
          product_id: row.product_id,
          price_type: row.price_type || "retail",
          custom_price: row.custom_price != null ? Number(row.custom_price) : null,
        };
      });
      setEntranceProducts(bindingsMap);
      setEntranceProductDetails(detailsMap);

      console.log(`[AddressesManager] Загружено подъездов: ${entrancesRes.data?.length || 0}, товаров: ${productsRes.data?.length || 0}`);
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка загрузки адресов:", err);
      toast({
        title: "Ошибка загрузки",
        description: err.message || "Не удалось загрузить данные адресов",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Синхронизация адресов из таблицы счетов (accounts)
  const handleSyncFromAccounts = async () => {
    setSyncing(true);
    console.log("[AddressesManager] Запуск синхронизации адресов из лицевых счетов...");
    try {
      const { data, error } = await (supabase.rpc as any)("sync_entrances_from_accounts");
      if (error) throw error;

      console.log(`[AddressesManager] Синхронизация завершена. Добавлено новых подъездов: ${data}`);
      toast({
        title: "Синхронизация завершена",
        description: Number(data) > 0 
          ? `Успешно добавлено новых подъездов: ${data}` 
          : "Все адреса из лицевых счетов уже синхронизированы",
      });

      await loadAllData();
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка синхронизации:", err);
      toast({
        title: "Ошибка синхронизации",
        description: err.message || "Не удалось синхронизировать адреса",
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  // Создание нового адреса вручную
  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddressForm.street.trim() || !newAddressForm.house.trim() || !newAddressForm.entrance.trim()) {
      toast({
        title: "Заполните поля",
        description: "Улица, дом и подъезд обязательны для заполнения",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("[AddressesManager] Создание нового адреса:", newAddressForm);
      const { data, error } = await supabase.from("entrances" as any).insert([{
        city: newAddressForm.city.trim(),
        street: newAddressForm.street.trim(),
        house: newAddressForm.house.trim(),
        entrance: newAddressForm.entrance.trim(),
        intercom_type: newAddressForm.intercom_type || null,
        notes: newAddressForm.notes?.trim() || null
      }] as any).select().single() as any;

      if (error) throw error;

      console.log("[AddressesManager] Адрес успешно создан с ID:", data.id);
      toast({
        title: "Адрес добавлен",
        description: `${data.city}, ${data.street}, д. ${data.house}, п. ${data.entrance}`
      });

      setIsAddAddressOpen(false);
      setNewAddressForm({
        city: "Краснодар",
        street: "",
        house: "",
        entrance: "1",
        intercom_type: "",
        notes: ""
      });

      await loadAllData();
      setExpandedCities(prev => new Set(prev).add(data.city));
      setExpandedHouses(prev => new Set(prev).add(`${data.city}::${data.street}::${data.house}`));
      setSelectedEntrance(data);
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка создания адреса:", err);
      toast({
        title: "Ошибка сохранения",
        description: err.message || "Возможно, такой подъезд уже существует",
        variant: "destructive"
      });
    }
  };

  // Удаление подъезда
  const handleDeleteEntrance = async (entranceId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот подъезд из базы? Все привязки оборудования к нему также будут удалены.")) {
      return;
    }

    try {
      console.log("[AddressesManager] Удаление подъезда ID:", entranceId);
      const { error } = await supabase.from("entrances" as any).delete().eq("id", entranceId);
      if (error) throw error;

      toast({ title: "Удалено", description: "Подъезд успешно удален" });
      if (selectedEntrance?.id === entranceId) {
        setSelectedEntrance(null);
      }
      await loadAllData();
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка при удалении:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  // Сохранение привязанных товаров к выбранному подъезду
  const handleSaveProductBindings = async () => {
    if (!selectedEntrance) return;
    setSavingBinding(true);
    console.log(`[AddressesManager] Сохранение привязок товаров для подъезда ID ${selectedEntrance.id}:`, selectedProductIdsToBind);

    try {
      // 1. Удаляем все текущие привязки для этого подъезда
      const { error: deleteError } = await supabase
        .from("entrance_products" as any)
        .delete()
        .eq("entrance_id", selectedEntrance.id);

      if (deleteError) throw deleteError;

      // 2. Добавляем новые выбранные привязки
      if (selectedProductIdsToBind.length > 0) {
        const rowsToInsert = selectedProductIdsToBind.map(productId => ({
          entrance_id: selectedEntrance.id,
          product_id: productId
        }));

        const { error: insertError } = await supabase
          .from("entrance_products" as any)
          .insert(rowsToInsert as any);

        if (insertError) throw insertError;
      }

      toast({
        title: "Привязка сохранена",
        description: `Привязано товаров и услуг: ${selectedProductIdsToBind.length}`
      });

      setEntranceProducts(prev => ({
        ...prev,
        [selectedEntrance.id]: selectedProductIdsToBind
      }));

      setIsBindProductsOpen(false);
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка при сохранении привязок:", err);
      toast({
        title: "Ошибка",
        description: err.message || "Не удалось сохранить привязку оборудования",
        variant: "destructive"
      });
    } finally {
      setSavingBinding(false);
    }
  };

  // Быстрое применение привязанных товаров ко ВСЕМ подъездам текущего дома
  const handleApplyToAllEntrancesInHouse = async () => {
    if (!selectedEntrance) return;
    
    const siblingEntrances = entrances.filter(
      e => e.city === selectedEntrance.city && e.street === selectedEntrance.street && e.house === selectedEntrance.house
    );

    if (!confirm(`Привязать этот же набор оборудования (${(entranceProducts[selectedEntrance.id] || []).length} шт.) ко ВСЕМ подъездам дома (${siblingEntrances.length} подъездов)?`)) {
      return;
    }

    setLoading(true);
    console.log(`[AddressesManager] Массовая привязка к дому ${selectedEntrance.street}, ${selectedEntrance.house} (${siblingEntrances.length} подъездов)`);
    try {
      const currentProducts = entranceProducts[selectedEntrance.id] || [];
      const currentDetails = entranceProductDetails[selectedEntrance.id] || {};

      for (const ent of siblingEntrances) {
        await supabase.from("entrance_products" as any).delete().eq("entrance_id", ent.id);
        if (currentProducts.length > 0) {
          const rows = currentProducts.map((pId) => ({
            entrance_id: ent.id,
            product_id: pId,
            price_type: currentDetails[pId]?.price_type || "retail",
            custom_price: currentDetails[pId]?.custom_price != null ? currentDetails[pId].custom_price : null,
          }));
          await supabase.from("entrance_products" as any).insert(rows as any);
        }
      }

      toast({
        title: "Успешно применено",
        description: `Оборудование скопировано на все ${siblingEntrances.length} подъездов дома`
      });

      await loadAllData();
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка массовой привязки:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Обновление модели домофона и примечаний подъезда
  const handleUpdateEntranceInfo = async (intercomType: string, notes: string) => {
    if (!selectedEntrance) return;
    try {
      const cleanType = intercomType.trim() ? intercomType.trim() : null;
      console.log(`[AddressesManager] Обновление информации подъезда ID ${selectedEntrance.id}:`, cleanType);
      const { error } = await supabase
        .from("entrances" as any)
        .update({ intercom_type: cleanType, notes: notes } as any)
        .eq("id", selectedEntrance.id);

      if (error) throw error;

      toast({ title: "Сохранено", description: "Данные подъезда обновлены" });
      setSelectedEntrance(prev => prev ? { ...prev, intercom_type: cleanType, notes: notes } : null);
      
      setEntrances(prev => prev.map(e => e.id === selectedEntrance.id ? { ...e, intercom_type: cleanType, notes: notes } : e));
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка обновления информации:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  // Обновление статуса обслуживания одного подъезда (монтаж, ТО, аренда)
  const handleUpdateEntranceServiceType = async (entranceId: string, serviceType: string) => {
    try {
      console.log(`[AddressesManager] Смена статуса подъезда ID ${entranceId} на "${serviceType}"`);
      const { error } = await supabase
        .from("entrances" as any)
        .update({ service_type: serviceType } as any)
        .eq("id", entranceId);

      if (error) throw error;

      const label = serviceType === "installation" ? "«На монтаже» (льготный прайс)" : serviceType === "rent" ? "«Аренда» (розничный прайс)" : "«На ТО» (розничный прайс)";
      toast({ title: "Статус обновлен", description: `Подъезд переведен в статус ${label}` });

      setSelectedEntrance(prev => prev && prev.id === entranceId ? { ...prev, service_type: serviceType } : prev);
      setEntrances(prev => prev.map(e => e.id === entranceId ? { ...e, service_type: serviceType } : e));
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка смены статуса подъезда:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  // Пакетное обновление статуса для ВСЕХ подъездов дома
  const handleUpdateHouseServiceType = async (city: string, street: string, house: string, serviceType: string) => {
    try {
      console.log(`[AddressesManager] Пакетная смена статуса дома ${street}, д. ${house} на "${serviceType}"`);
      const { error } = await supabase
        .from("entrances" as any)
        .update({ service_type: serviceType } as any)
        .eq("city", city)
        .eq("street", street)
        .eq("house", house);

      if (error) throw error;

      const label = serviceType === "installation" ? "«На монтаже» (льготный прайс)" : serviceType === "rent" ? "«Аренда» (розничный прайс)" : "«На ТО» (розничный прайс)";
      toast({ title: "Статус дома обновлен", description: `Все подъезды дома ${street}, д. ${house} переведены в статус ${label}` });

      setEntrances(prev => prev.map(e => (e.city === city && e.street === street && e.house === house) ? { ...e, service_type: serviceType } : e));
      if (selectedEntrance && selectedEntrance.city === city && selectedEntrance.street === street && selectedEntrance.house === house) {
        setSelectedEntrance(prev => prev ? { ...prev, service_type: serviceType } : null);
      }
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка смены статуса дома:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  // Переключение флага «Умный дом» для конкретного подъезда
  const handleToggleSmartIntercom = async (entranceId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    console.log(`[AddressesManager] Смена «Умный дом» для подъезда ${entranceId}: ${newVal}`);
    try {
      const { error } = await supabase
        .from("entrances" as any)
        .update({ has_smart_intercom: newVal } as any)
        .eq("id", entranceId);

      if (error) throw error;

      setEntrances(prev => prev.map(e => e.id === entranceId ? { ...e, has_smart_intercom: newVal } : e));
      if (selectedEntrance?.id === entranceId) {
        setSelectedEntrance(prev => prev ? { ...prev, has_smart_intercom: newVal } : null);
      }
      toast({
        title: newVal ? "Умный дом активирован" : "Умный дом отключен",
        description: newVal 
          ? "Жильцы этого подъезда могут оплачивать подключение Личного кабинета" 
          : "Оплата Личного кабинета скрыта для жильцов",
      });
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка изменения Умный дом:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  // Переключение флага «Умный дом» для ВСЕХ подъездов дома сразу
  const handleToggleHouseSmartIntercom = async (city: string, street: string, house: string, targetVal: boolean) => {
    console.log(`[AddressesManager] Установка «Умный дом» = ${targetVal} для всего дома: ${city}, ${street}, ${house}`);
    try {
      const { error } = await supabase
        .from("entrances" as any)
        .update({ has_smart_intercom: targetVal } as any)
        .eq("city", city)
        .eq("street", street)
        .eq("house", house);

      if (error) throw error;

      setEntrances(prev => prev.map(e => 
        e.city === city && e.street === street && e.house === house 
          ? { ...e, has_smart_intercom: targetVal } 
          : e
      ));
      if (selectedEntrance && selectedEntrance.city === city && selectedEntrance.street === street && selectedEntrance.house === house) {
        setSelectedEntrance(prev => prev ? { ...prev, has_smart_intercom: targetVal } : null);
      }
      toast({
        title: "Применено ко всему дому",
        description: targetVal 
          ? "Умный дом активирован для всех подъездов дома" 
          : "Умный дом отключен для всех подъездов дома",
      });
    } catch (err: any) {
      console.error("[AddressesManager] Ошибка применения ко всему дому:", err);
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  // Иерархическая группировка адресов: Город -> Дом -> Подъезды
  const addressTree = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = entrances.filter(e => {
      if (!q) return true;
      const full = `${e.city} ${e.street} ${e.house} ${e.entrance} ${e.intercom_type || ""}`.toLowerCase();
      return full.includes(q);
    });

    const tree: Record<string, Record<string, Entrance[]>> = {};

    filtered.forEach(e => {
      if (!tree[e.city]) {
        tree[e.city] = {};
      }
      const houseKey = `${e.street}, д. ${e.house}`;
      if (!tree[e.city][houseKey]) {
        tree[e.city][houseKey] = [];
      }
      tree[e.city][houseKey].push(e);
    });

    Object.keys(tree).forEach(city => {
      Object.keys(tree[city]).forEach(house => {
        tree[city][house].sort((a, b) => {
          const numA = parseInt(a.entrance) || 0;
          const numB = parseInt(b.entrance) || 0;
          return numA - numB;
        });
      });
    });

    return tree;
  }, [entrances, searchQuery]);

  const toggleCity = (city: string) => {
    setExpandedCities(prev => {
      const next = new Set(prev);
      if (next.has(city)) {
        next.delete(city);
      } else {
        next.add(city);
      }
      return next;
    });
  };

  const toggleHouse = (houseKeyId: string) => {
    setExpandedHouses(prev => {
      const next = new Set(prev);
      if (next.has(houseKeyId)) {
        next.delete(houseKeyId);
      } else {
        next.add(houseKeyId);
      }
      return next;
    });
  };

  const linkedProductsForSelected = useMemo(() => {
    if (!selectedEntrance) return [];
    const productIds = entranceProducts[selectedEntrance.id] || [];
    return products.filter(p => productIds.includes(p.id));
  }, [selectedEntrance, entranceProducts, products]);

  return (
    <div className="space-y-4">
      {/* Шапка раздела */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Управление адресами и оборудованием
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Дерево городов, домов и подъездов с привязкой совместимого оборудования и услуг
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromAccounts}
            disabled={syncing}
            className="flex-1 sm:flex-initial rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin text-primary" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2 text-primary" />
            )}
            Синхронизировать из счетов
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddAddressOpen(true)}
            className="flex-1 sm:flex-initial btn-premium-gold rounded-xl font-semibold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Добавить адрес
          </Button>
        </div>
      </div>

      {/* Поисковая строка и статистика */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по городу, улице, дому или типу домофона..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Очистить
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
          <Badge variant="secondary" className="font-semibold">
            Подъездов: {entrances.length}
          </Badge>
          <Badge variant="outline" className="font-semibold">
            Городов: {Object.keys(addressTree).length}
          </Badge>
        </div>
      </div>

      {/* Основная рабочая сетка: Слева дерево адресов, Справа карточка выбранного подъезда */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ЛЕВАЯ КОЛОНКА: Дерево адресов */}
        <div className="lg:col-span-7 space-y-2 max-h-[750px] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white/30 dark:bg-slate-900/30 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Загрузка структуры адресов...</p>
            </div>
          ) : Object.keys(addressTree).length === 0 ? (
            <div className="p-8 text-center bg-white/30 dark:bg-slate-900/30 rounded-2xl border border-slate-200/40 dark:border-slate-800/40">
              <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-foreground">Адреса не найдены</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Нажмите «Синхронизировать из счетов» для автоматического импорта адресов из файла
              </p>
              <Button size="sm" variant="outline" onClick={handleSyncFromAccounts} disabled={syncing}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Синхронизировать сейчас
              </Button>
            </div>
          ) : (
            Object.entries(addressTree).map(([city, houses]) => {
              const isCityExpanded = expandedCities.has(city);
              const totalHouses = Object.keys(houses).length;
              const totalEntrances = Object.values(houses).reduce((acc, list) => acc + list.length, 0);

              return (
                <div
                  key={city}
                  className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/70 overflow-hidden shadow-xs"
                >
                  {/* Заголовок города */}
                  <button
                    type="button"
                    onClick={() => toggleCity(city)}
                    className="w-full flex items-center justify-between p-3 px-4 hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors text-left font-bold text-sm text-foreground"
                  >
                    <div className="flex items-center gap-2.5">
                      {isCityExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <MapPin className="h-4 w-4 text-amber-500 shrink-0" />
                      <span>{city}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        {totalHouses} домов • {totalEntrances} подъездов
                      </Badge>
                    </div>
                  </button>

                  {/* Список домов в городе */}
                  {isCityExpanded && (
                    <div className="pl-6 pr-3 pb-3 pt-1 space-y-1.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-950/20">
                      {Object.entries(houses).map(([houseName, entranceList]) => {
                        const houseKeyId = `${city}::${houseName}`;
                        const isHouseExpanded = expandedHouses.has(houseKeyId);

                        // Определение общего статуса дома
                        const isAllInstallation = entranceList.every(e => e.service_type === "installation");
                        const isAllRent = entranceList.every(e => e.service_type === "rent");
                        const isAllMaintenance = entranceList.every(e => e.service_type === "maintenance" || !e.service_type);

                        return (
                          <div
                            key={houseKeyId}
                            className="rounded-lg border border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 overflow-hidden"
                          >
                            {/* Заголовок дома */}
                            <button
                              type="button"
                              onClick={() => toggleHouse(houseKeyId)}
                              className="w-full flex items-center justify-between p-2.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left text-xs font-semibold text-foreground"
                            >
                              <div className="flex items-center gap-2">
                                {isHouseExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                <span>{houseName}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isAllInstallation ? (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold">
                                    🟡 Монтаж
                                  </Badge>
                                ) : isAllRent ? (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-bold">
                                    🔵 Аренда
                                  </Badge>
                                ) : isAllMaintenance ? (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-green-500/15 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800 font-bold">
                                    🟢 На ТО
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                                    🟡/🟢 Смешанный
                                  </Badge>
                                )}
                                <span className="text-[10px] text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                                  {entranceList.length} под.
                                </span>
                              </div>
                            </button>

                            {/* Панель быстрого переключения статуса ВСЕГО дома и подъезды */}
                            {isHouseExpanded && (
                              <div>
                                <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 px-3 bg-slate-100/60 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                                  <span className="text-[10px] text-muted-foreground font-semibold">Статус дома:</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const first = entranceList[0];
                                        handleUpdateHouseServiceType(first.city, first.street, first.house, 'installation');
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                        isAllInstallation 
                                          ? "bg-amber-500 text-white shadow-xs" 
                                          : "bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 hover:bg-amber-50"
                                      }`}
                                      title="Установить для всех подъездов дома льготные цены на монтаже"
                                    >
                                      🟡 На монтаж
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const first = entranceList[0];
                                        handleUpdateHouseServiceType(first.city, first.street, first.house, 'maintenance');
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                        isAllMaintenance 
                                          ? "bg-green-600 text-white shadow-xs" 
                                          : "bg-white dark:bg-slate-900 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-800/60 hover:bg-green-50"
                                      }`}
                                      title="Установить для всех подъездов дома стандартные розничные цены ТО"
                                    >
                                      🟢 На ТО
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const first = entranceList[0];
                                        handleUpdateHouseServiceType(first.city, first.street, first.house, 'rent');
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                        isAllRent 
                                          ? "bg-blue-600 text-white shadow-xs" 
                                          : "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 hover:bg-blue-50"
                                      }`}
                                      title="Установить для всех подъездов дома схему Аренда"
                                    >
                                      🔵 Аренда
                                    </button>
                                  </div>
                                </div>

                                <div className="p-2 pt-1 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {entranceList.map(ent => {
                                    const isSelected = selectedEntrance?.id === ent.id;
                                    const linkedCount = (entranceProducts[ent.id] || []).length;
                                    const entStatus = ent.service_type || "maintenance";

                                    return (
                                      <button
                                        key={ent.id}
                                        type="button"
                                        onClick={() => {
                                          console.log("[AddressesManager] Выбран подъезд ID:", ent.id);
                                          setSelectedEntrance(ent);
                                        }}
                                        className={`flex items-center justify-between p-2 px-3 rounded-lg border text-left transition-all ${
                                          isSelected
                                            ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs ring-1 ring-primary"
                                            : "border-slate-200/70 dark:border-slate-800/70 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 text-foreground text-xs"
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-[11px]" title={entStatus === "installation" ? "На монтаже (льготные цены)" : entStatus === "rent" ? "Аренда" : "На ТО"}>
                                            {entStatus === "installation" ? "🟡" : entStatus === "rent" ? "🔵" : "🟢"}
                                          </span>
                                          <DoorClosed className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-slate-400"}`} />
                                          <span className="truncate">Подъезд {ent.entrance}</span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {ent.has_smart_intercom && (
                                            <Badge
                                              className="text-[9px] px-1.5 py-0 h-4 font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/40"
                                              title="Умный дом (доступна покупка ЛК)"
                                            >
                                              📱 Умный дом
                                            </Badge>
                                          )}
                                          {ent.intercom_type && ent.intercom_type.trim() && (
                                            <Badge
                                              variant="outline"
                                              className="text-[9px] px-1.5 py-0 h-4 font-normal bg-slate-100 dark:bg-slate-800 truncate max-w-[90px]"
                                              title={ent.intercom_type}
                                            >
                                              {ent.intercom_type}
                                            </Badge>
                                          )}
                                          {linkedCount > 0 ? (
                                            <Badge className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold">
                                              📦 {linkedCount} поз.
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-500/10 font-semibold">
                                              ⚠️ Нет оборуд.
                                            </Badge>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ПРАВАЯ КОЛОНКА: Детализация выбранного подъезда и привязанные товары */}
        <div className="lg:col-span-5 sticky top-4 space-y-4">
          {selectedEntrance ? (
            <Card className="border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider mb-1">
                      {selectedEntrance.city}
                    </Badge>
                    <CardTitle className="text-base font-bold text-foreground">
                      {selectedEntrance.street}, д. {selectedEntrance.house}
                    </CardTitle>
                    <CardDescription className="text-xs font-semibold text-primary mt-0.5">
                      Подъезд №{selectedEntrance.entrance}
                    </CardDescription>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteEntrance(selectedEntrance.id)}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                    title="Удалить подъезд"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4 text-xs">
                {/* Блок управления статусом подъезда и ценовым тарифом */}
                <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Статус подъезда:</span>
                    <Badge variant="outline" className="text-[10px] font-semibold">
                      {(selectedEntrance.service_type === "installation")
                        ? "🟡 На монтаже"
                        : (selectedEntrance.service_type === "rent")
                        ? "🔵 Аренда"
                        : "🟢 На ТО"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleUpdateEntranceServiceType(selectedEntrance.id, "installation")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                        selectedEntrance.service_type === "installation"
                          ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🟡 Монтаж
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateEntranceServiceType(selectedEntrance.id, "maintenance")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                        selectedEntrance.service_type === "maintenance" || !selectedEntrance.service_type
                          ? "bg-green-600 text-white border-green-700 shadow-xs"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🟢 На ТО
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateEntranceServiceType(selectedEntrance.id, "rent")}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                        selectedEntrance.service_type === "rent"
                          ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      🔵 Аренда
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                    <span>
                      {selectedEntrance.service_type === "installation"
                        ? "⚠️ Льготные цены монтажа для жильцов"
                        : "Стандартный розничный прайс"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateHouseServiceType(
                        selectedEntrance.city,
                        selectedEntrance.street,
                        selectedEntrance.house,
                        selectedEntrance.service_type || "maintenance"
                      )}
                      className="text-primary hover:underline font-semibold"
                      title="Применить этот же статус ко всем остальным подъездам этого дома"
                    >
                      Для всего дома ➔
                    </button>
                  </div>
                </div>

                {/* Блок управления статусом «Умный дом» */}
                <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📱</span>
                      <div>
                        <span className="font-bold text-foreground block text-xs">Умный домофон:</span>
                        <span className="text-[10px] text-muted-foreground">
                          {selectedEntrance.has_smart_intercom
                            ? "Разрешена заблаговременная покупка ЛК жильцами"
                            : "Покупка ЛК скрыта (требуются загруженные учетные записи)"}
                        </span>
                      </div>
                    </div>

                    <Switch
                      checked={!!selectedEntrance.has_smart_intercom}
                      onCheckedChange={() => handleToggleSmartIntercom(selectedEntrance.id, !!selectedEntrance.has_smart_intercom)}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-indigo-200/50 dark:border-indigo-800/40 text-[11px]">
                    <span className="text-muted-foreground">Применить ко всем подъездам дома:</span>
                    <button
                      type="button"
                      onClick={() => handleToggleHouseSmartIntercom(
                        selectedEntrance.city,
                        selectedEntrance.street,
                        selectedEntrance.house,
                        !selectedEntrance.has_smart_intercom
                      )}
                      className="text-primary hover:underline font-semibold"
                    >
                      Для всего дома ➔
                    </button>
                  </div>
                </div>

                {/* Настройка типа домофона подъезда */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Модель / Тип домофона:
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Например: Vizit БВД-343 или Цифрал"
                      defaultValue={selectedEntrance.intercom_type || ""}
                      onBlur={(e) => {
                        if (e.target.value !== selectedEntrance.intercom_type) {
                          handleUpdateEntranceInfo(e.target.value, selectedEntrance.notes || "");
                        }
                      }}
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                </div>

                {/* Блок прикрепленных товаров и оборудования */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Package className="h-4 w-4 text-primary" />
                      Оборудование для продажи:
                    </span>
                    <Badge variant="secondary" className="font-mono">
                      {linkedProductsForSelected.length} привязано
                    </Badge>
                  </div>

                  {linkedProductsForSelected.length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800 text-muted-foreground">
                      <Info className="h-5 w-5 mx-auto mb-1 opacity-40" />
                      <p>К этому подъезду пока не привязано специальное оборудование.</p>
                      <p className="text-[11px] mt-0.5">Жильцы видят только общие товары каталога.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {linkedProductsForSelected.map((prod) => {
                        const detail = selectedEntrance
                          ? entranceProductDetails[selectedEntrance.id]?.[prod.id]
                          : null;

                        let priceText = `${Number(prod.price).toFixed(0)} ₽ (Розница)`;
                        let priceClass = "text-muted-foreground";

                        if (detail) {
                          if (detail.price_type === "custom" && detail.custom_price != null) {
                            priceText = `${Number(detail.custom_price).toFixed(0)} ₽ (Своя цена)`;
                            priceClass = "text-primary font-bold";
                          } else if (detail.price_type === "promo" && prod.promo_price != null) {
                            priceText = `${Number(prod.promo_price).toFixed(0)} ₽ (Акция)`;
                            priceClass = "text-amber-600 dark:text-amber-400 font-bold";
                          } else if (detail.price_type === "installation" && prod.installation_price != null) {
                            priceText = `${Number(prod.installation_price).toFixed(0)} ₽ (Монтаж)`;
                            priceClass = "text-sky-600 dark:text-sky-400 font-bold";
                          } else {
                            priceText = `${Number(prod.price).toFixed(0)} ₽ (Розница)`;
                          }
                        }

                        return (
                          <div
                            key={prod.id}
                            className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {prod.image_url ? (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="h-7 w-7 rounded object-cover shrink-0"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-slate-400 shrink-0" />
                              )}
                              <div className="truncate">
                                <div className="font-semibold truncate text-xs">{prod.name}</div>
                                <div className={`text-[10px] font-mono ${priceClass}`}>{priceText}</div>
                              </div>
                            </div>

                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {prod.category === "equipment"
                                ? "Оборудование"
                                : prod.category === "key"
                                ? "Ключ"
                                : "Услуга"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Кнопки управления привязкой */}
                  <div className="flex flex-col gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedProductIdsToBind(entranceProducts[selectedEntrance.id] || []);
                        setIsBindProductsOpen(true);
                      }}
                      className="w-full btn-premium-gold h-8 rounded-xl font-semibold text-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Прикрепить товары / ключи
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleApplyToAllEntrancesInHouse}
                      className="w-full h-8 rounded-xl text-xs font-semibold border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5 text-blue-500" />
                      Применить ко всем подъездам дома
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="p-8 text-center bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-muted-foreground">
              <DoorClosed className="h-10 w-10 mx-auto mb-2 opacity-30 text-primary" />
              <p className="font-semibold text-foreground text-sm">Выберите подъезд в дереве слева</p>
              <p className="text-xs mt-1">
                Вы сможете настроить модель домофона и прикрепить оборудование, которое увидят жители этой парадной.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ДИАЛОГ 1: Добавление нового адреса вручную */}
      <Dialog open={isAddAddressOpen} onOpenChange={setIsAddAddressOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Добавить адрес и подъезд
            </DialogTitle>
            <DialogDescription className="text-xs">
              Введите данные дома и подъезда для ручного добавления в общую базу
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAddress} className="space-y-3 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Город / Населенный пункт</Label>
              <Input
                value={newAddressForm.city}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                placeholder="Краснодар"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Улица</Label>
              <Input
                value={newAddressForm.street}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, street: e.target.value })}
                placeholder="ул. Душистая"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Номер дома</Label>
                <Input
                  value={newAddressForm.house}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, house: e.target.value })}
                  placeholder="50 или 18/1"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Номер подъезда</Label>
                <Input
                  value={newAddressForm.entrance}
                  onChange={(e) => setNewAddressForm({ ...newAddressForm, entrance: e.target.value })}
                  placeholder="1"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Модель установленного домофона</Label>
              <Input
                value={newAddressForm.intercom_type}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, intercom_type: e.target.value })}
                placeholder="Vizit, Цифрал, Метаком..."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Примечания (для мастеров)</Label>
              <Input
                value={newAddressForm.notes}
                onChange={(e) => setNewAddressForm({ ...newAddressForm, notes: e.target.value })}
                placeholder="Код калитки, расположение щитовой..."
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddAddressOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" size="sm" className="btn-premium-gold font-semibold">
                Сохранить адрес
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ДИАЛОГ 2: Интерактивная привязка товаров к подъезду с деревом папок и типами цен */}
      <BindProductsDialog
        isOpen={isBindProductsOpen}
        onClose={() => setIsBindProductsOpen(false)}
        entrance={selectedEntrance}
        onSaved={async () => {
          await loadAllData();
        }}
      />
    </div>
  );
};

export default AddressesManager;
