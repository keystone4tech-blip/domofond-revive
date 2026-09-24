// ============================================================================
// Компонент: BindProductsDialog
// Назначение: Модальное окно привязки совместимого оборудования и услуг к подъезду.
// Особенности:
//   1. Двухпанельный интерфейс в стиле вкладки «Товары и услуги» с деревом папок/подпапок.
//   2. Фильтр «Выбранные для подъезда» для моментального просмотра привязанного оборудования.
//   3. Поиск позиций в реальном времени по наименованию и фильтрация по категории.
//   4. Индивидуальный выбор типа цены для каждого товара:
//      - «Розница» (базовая розничная цена)
//      - «Акция» (акционная цена из номенклатуры)
//      - «На монтаже» (льготная цена при монтаже)
//      - «Своя цена» (ввод произвольной стоимости специально для жителей этого подъезда)
//   5. Быстрое пакетное сохранение в связующую таблицу entrance_products.
// ============================================================================

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Folder,
  FolderTree,
  Search,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Tag,
  Wrench,
  DollarSign,
  Edit3,
  X,
} from "lucide-react";

// Интерфейс подъезда
interface Entrance {
  id: string;
  city: string;
  street: string;
  house: string;
  entrance: string;
  intercom_type?: string | null;
  service_type?: string | null;
}

// Интерфейс товара
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price?: number | null;
  installation_price?: number | null;
  unit: string;
  category: string | null;
  folder_id: string | null;
  image_url?: string | null;
  is_active: boolean;
}

// Интерфейс папки
interface ProductFolder {
  id: string;
  name: string;
  parent_id: string | null;
}

// Конфигурация привязки одного товара
interface ProductBindingConfig {
  isSelected: boolean;
  priceType: "retail" | "promo" | "installation" | "custom";
  customPrice: string;
}

interface BindProductsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entrance: Entrance | null;
  onSaved: () => void;
}

export const BindProductsDialog: React.FC<BindProductsDialogProps> = ({
  isOpen,
  onClose,
  entrance,
  onSaved,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Состояние выбранной папки: "all" | "none" | "selected" | UUID
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Карта настроек привязок: product_id -> ProductBindingConfig
  const [bindingsMap, setBindingsMap] = useState<Record<string, ProductBindingConfig>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // ============================================================================
  // Запрос списка папок
  // ============================================================================
  const { data: folders = [] } = useQuery({
    queryKey: ["product_folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_folders")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as ProductFolder[];
    },
    enabled: isOpen,
  });

  // ============================================================================
  // Запрос всех активных товаров
  // ============================================================================
  const { data: products = [], isLoading: isProductsLoading } = useQuery({
    queryKey: ["products_for_binding"],
    queryFn: async () => {
      console.log("[BindProductsDialog] Загрузка товаров для каталога подъезда...");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Product[];
    },
    enabled: isOpen,
  });

  // ============================================================================
  // Запрос текущих привязок для выбранного подъезда
  // ============================================================================
  const { data: currentBindings = [], isLoading: isBindingsLoading } = useQuery({
    queryKey: ["entrance_products", entrance?.id],
    queryFn: async () => {
      if (!entrance?.id) return [];
      console.log(`[BindProductsDialog] Загрузка привязок для подъезда ID: ${entrance.id}`);
      const { data, error } = await supabase
        .from("entrance_products" as any)
        .select("id, product_id, price_type, custom_price")
        .eq("entrance_id", entrance.id);

      if (error) {
        console.error("[BindProductsDialog] Ошибка загрузки entrance_products:", error);
        throw error;
      }
      return (data || []) as any[];
    },
    enabled: isOpen && !!entrance?.id,
  });

  // Инициализация карты привязок при открытии диалога
  useEffect(() => {
    if (!isOpen) return;

    const newMap: Record<string, ProductBindingConfig> = {};

    // 1. Инициализируем существующие привязки
    currentBindings.forEach((b) => {
      newMap[b.product_id] = {
        isSelected: true,
        priceType: (b.price_type as any) || "retail",
        customPrice: b.custom_price != null ? String(b.custom_price) : "",
      };
    });

    setBindingsMap(newMap);
    setSelectedFolderId("all");
    setSearchQuery("");
  }, [isOpen, currentBindings]);

  // Дерево папок с отступами
  const folderTreeFlat = useMemo(() => {
    const result: { folder: ProductFolder; level: number; displayName: string }[] = [];

    const traverse = (parentId: string | null, level: number) => {
      const children = folders.filter((f) => f.parent_id === parentId);
      for (const child of children) {
        const indent = "— ".repeat(level);
        result.push({
          folder: child,
          level,
          displayName: `${indent}${child.name}`,
        });
        traverse(child.id, level + 1);
      }
    };

    traverse(null, 0);

    const visitedIds = new Set(result.map((r) => r.folder.id));
    const orphans = folders.filter((f) => !visitedIds.has(f.id));
    for (const orphan of orphans) {
      result.push({
        folder: orphan,
        level: 0,
        displayName: orphan.name,
      });
    }

    return result;
  }, [folders]);

  // Подсчет товаров по папкам
  const countsByFolder = useMemo(() => {
    const counts: Record<string, number> = {
      all: products.length,
      none: 0,
      selected: 0,
    };

    for (const p of products) {
      if (bindingsMap[p.id]?.isSelected) {
        counts.selected = (counts.selected || 0) + 1;
      }
      if (!p.folder_id) {
        counts.none = (counts.none || 0) + 1;
      } else {
        counts[p.folder_id] = (counts[p.folder_id] || 0) + 1;
      }
    }

    return counts;
  }, [products, bindingsMap]);

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Фильтр по папке / статусу привязки
      if (selectedFolderId === "selected") {
        if (!bindingsMap[p.id]?.isSelected) return false;
      } else if (selectedFolderId === "none") {
        if (p.folder_id !== null) return false;
      } else if (selectedFolderId !== "all") {
        if (p.folder_id !== selectedFolderId) return false;
      }

      // Фильтр по категории
      if (categoryFilter !== "all" && p.category !== categoryFilter) {
        return false;
      }

      // Поиск по строке
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }

      return true;
    });
  }, [products, selectedFolderId, categoryFilter, searchQuery, bindingsMap]);

  // Переключение выбора товара
  const toggleProduct = (productId: string) => {
    setBindingsMap((prev) => {
      const current = prev[productId];
      const isSelected = !current?.isSelected;
      return {
        ...prev,
        [productId]: {
          isSelected,
          priceType: current?.priceType || "retail",
          customPrice: current?.customPrice || "",
        },
      };
    });
  };

  // Изменение типа цены товара
  const changePriceType = (
    productId: string,
    priceType: "retail" | "promo" | "installation" | "custom"
  ) => {
    setBindingsMap((prev) => {
      const current = prev[productId] || { isSelected: true, priceType: "retail", customPrice: "" };
      return {
        ...prev,
        [productId]: {
          ...current,
          isSelected: true, // Автоматически отмечаем товар, если изменили тип цены
          priceType,
        },
      };
    });
  };

  // Изменение кастомной цены
  const changeCustomPrice = (productId: string, val: string) => {
    setBindingsMap((prev) => {
      const current = prev[productId] || { isSelected: true, priceType: "custom", customPrice: "" };
      return {
        ...prev,
        [productId]: {
          ...current,
          isSelected: true,
          priceType: "custom",
          customPrice: val,
        },
      };
    });
  };

  // Расчет итоговой цены для отображения
  const getDisplayPrice = (product: Product, config?: ProductBindingConfig) => {
    if (!config || !config.isSelected) return `${product.price.toFixed(0)} ₽`;

    switch (config.priceType) {
      case "promo":
        return product.promo_price != null
          ? `${product.promo_price.toFixed(0)} ₽ (Акция)`
          : `${product.price.toFixed(0)} ₽`;
      case "installation":
        return product.installation_price != null
          ? `${product.installation_price.toFixed(0)} ₽ (Монтаж)`
          : `${product.price.toFixed(0)} ₽`;
      case "custom":
        return config.customPrice.trim()
          ? `${parseFloat(config.customPrice) || 0} ₽ (Своя цена)`
          : "— ₽";
      case "retail":
      default:
        return `${product.price.toFixed(0)} ₽ (Розница)`;
    }
  };

  // Выбрать все отфильтрованные товары
  const handleSelectAllFiltered = () => {
    setBindingsMap((prev) => {
      const next = { ...prev };
      filteredProducts.forEach((p) => {
        next[p.id] = {
          isSelected: true,
          priceType: next[p.id]?.priceType || "retail",
          customPrice: next[p.id]?.customPrice || "",
        };
      });
      return next;
    });
  };

  // Снять выбор со всех отфильтрованных товаров
  const handleDeselectAllFiltered = () => {
    setBindingsMap((prev) => {
      const next = { ...prev };
      filteredProducts.forEach((p) => {
        if (next[p.id]) {
          next[p.id] = {
            ...next[p.id],
            isSelected: false,
          };
        }
      });
      return next;
    });
  };

  // Сохранение привязок в БД
  const handleSave = async () => {
    if (!entrance?.id) return;
    setIsSaving(true);
    console.log(`[BindProductsDialog] Сохранение привязок для подъезда ${entrance.id}...`);

    try {
      // 1. Удаляем старые привязки
      const { error: deleteErr } = await supabase
        .from("entrance_products" as any)
        .delete()
        .eq("entrance_id", entrance.id);

      if (deleteErr) throw deleteErr;

      // 2. Формируем новые записи
      const selectedEntries = Object.entries(bindingsMap).filter(([_, cfg]) => cfg.isSelected);

      if (selectedEntries.length > 0) {
        const rowsToInsert = selectedEntries.map(([productId, cfg]) => {
          let customPriceNum: number | null = null;
          if (cfg.priceType === "custom" && cfg.customPrice.trim()) {
            const parsed = parseFloat(cfg.customPrice);
            if (!isNaN(parsed)) customPriceNum = parsed;
          }

          return {
            entrance_id: entrance.id,
            product_id: productId,
            price_type: cfg.priceType,
            custom_price: customPriceNum,
          };
        });

        const { error: insertErr } = await supabase
          .from("entrance_products" as any)
          .insert(rowsToInsert as any);

        if (insertErr) throw insertErr;
      }

      console.log(`[BindProductsDialog] Успешно сохранено привязок: ${selectedEntries.length}`);
      toast({
        title: "Оборудование привязано",
        description: `Для подъезда сохранено позиций: ${selectedEntries.length}`,
      });

      queryClient.invalidateQueries({ queryKey: ["entrance_products"] });
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("[BindProductsDialog] Ошибка сохранения привязок:", err);
      toast({
        title: "Ошибка сохранения",
        description: err.message || "Не удалось сохранить привязку оборудования",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCount = Object.values(bindingsMap).filter((c) => c.isSelected).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl bg-card border shadow-2xl">
        {/* Шапка модального окна */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/30 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Привязка оборудования и услуг к подъезду
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                {entrance ? (
                  <span className="font-semibold text-foreground">
                    {entrance.city}, ул. {entrance.street}, д. {entrance.house}, Подъезд №{entrance.entrance}
                    {entrance.intercom_type && ` • Домофон: ${entrance.intercom_type}`}
                  </span>
                ) : (
                  "Выберите оборудование для жителей подъезда"
                )}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Badge variant="outline" className="text-xs px-2.5 py-1 bg-background font-medium">
                Выбрано для подъезда:{" "}
                <strong className="text-primary ml-1 text-sm">{selectedCount}</strong>
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Основное двухпанельное тело (Дерево папок слева + Каталог справа) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
          {/* ============================================================== */}
          {/* ЛЕВАЯ ПАНЕЛЬ: Дерево папок и фильтры */}
          {/* ============================================================== */}
          <div className="md:col-span-1 p-3 overflow-y-auto space-y-1.5 bg-muted/10">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 block mb-1">
              Фильтры и папки
            </span>

            {/* Фильтр "Уже привязано к подъезду" */}
            <div
              onClick={() => setSelectedFolderId("selected")}
              className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs font-semibold transition-all ${
                selectedFolderId === "selected"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="truncate">Выбрано в подъезд</span>
              </div>
              <Badge
                variant={selectedFolderId === "selected" ? "outline" : "secondary"}
                className={`text-[10px] shrink-0 ${
                  selectedFolderId === "selected" ? "border-primary-foreground/30 text-primary-foreground" : ""
                }`}
              >
                {countsByFolder.selected || 0}
              </Badge>
            </div>

            {/* Папка "Все товары" */}
            <div
              onClick={() => setSelectedFolderId("all")}
              className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs font-medium transition-colors ${
                selectedFolderId === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Package className="h-4 w-4 shrink-0" />
                <span className="truncate">Все товары каталога</span>
              </div>
              <Badge
                variant={selectedFolderId === "all" ? "outline" : "secondary"}
                className={`text-[10px] shrink-0 ${
                  selectedFolderId === "all" ? "border-primary-foreground/30 text-primary-foreground" : ""
                }`}
              >
                {countsByFolder.all || 0}
              </Badge>
            </div>

            {/* Папка "Без папки" */}
            <div
              onClick={() => setSelectedFolderId("none")}
              className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-xs font-medium transition-colors ${
                selectedFolderId === "none"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Folder className="h-4 w-4 shrink-0 text-amber-500/70" />
                <span className="truncate">Без папки</span>
              </div>
              <Badge
                variant={selectedFolderId === "none" ? "outline" : "secondary"}
                className={`text-[10px] shrink-0 ${
                  selectedFolderId === "none" ? "border-primary-foreground/30 text-primary-foreground" : ""
                }`}
              >
                {countsByFolder.none || 0}
              </Badge>
            </div>

            <div className="border-t my-2 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 block mb-1">
                Категории
              </span>
            </div>

            {/* Список папок и подпапок */}
            {folderTreeFlat.map(({ folder, level }) => {
              const count = countsByFolder[folder.id] || 0;
              const isSelected = selectedFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  style={{ paddingLeft: `${Math.max(10, level * 14 + 10)}px` }}
                  className={`flex items-center justify-between pr-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {level > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                    <Folder
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isSelected ? "text-primary-foreground" : "text-amber-500"
                      }`}
                    />
                    <span className="truncate" title={folder.name}>
                      {folder.name}
                    </span>
                  </div>
                  <Badge
                    variant={isSelected ? "outline" : "secondary"}
                    className={`text-[9px] px-1.5 py-0 ${
                      isSelected ? "border-primary-foreground/30 text-primary-foreground" : ""
                    }`}
                  >
                    {count}
                  </Badge>
                </div>
              );
            })}
          </div>

          {/* ============================================================== */}
          {/* ПРАВАЯ ПАНЕЛЬ: Список товаров с настройкой цен */}
          {/* ============================================================== */}
          <div className="md:col-span-3 flex flex-col min-h-0 bg-background">
            {/* Панель поиска и массового выбора */}
            <div className="p-3 border-b bg-muted/20 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Быстрый поиск по названию или описанию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-normal"
                  onClick={handleSelectAllFiltered}
                >
                  Выбрать все ({filteredProducts.length})
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs font-normal text-muted-foreground"
                  onClick={handleDeselectAllFiltered}
                >
                  Снять выбор
                </Button>
              </div>
            </div>

            {/* Список товаров */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {isProductsLoading || isBindingsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-xs">
                  {selectedFolderId === "selected"
                    ? "К этому подъезду пока не привязано ни одного товара. Выберите категорию слева и отметьте нужные товары."
                    : searchQuery
                    ? "По вашему запросу товары не найдены."
                    : "В этой папке нет товаров."}
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const binding = bindingsMap[product.id] || {
                    isSelected: false,
                    priceType: "retail",
                    customPrice: "",
                  };
                  const isChecked = binding.isSelected;

                  return (
                    <div
                      key={product.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isChecked
                          ? "border-primary/50 bg-primary/5 shadow-xs"
                          : "border-border/70 hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        {/* Левая часть: Чекбокс, фото, название */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleProduct(product.id)}
                            id={`check-${product.id}`}
                            className="shrink-0"
                          />

                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-9 w-9 rounded-lg object-cover border shrink-0 bg-muted"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground/40 shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                          )}

                          <label
                            htmlFor={`check-${product.id}`}
                            className="cursor-pointer min-w-0 flex-1"
                          >
                            <p className="text-xs font-semibold text-foreground truncate hover:text-primary transition-colors">
                              {product.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                              <span>
                                Базовая розница: <strong>{product.price.toFixed(0)} ₽</strong>
                              </span>
                              {product.promo_price != null && (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  Акция: {product.promo_price.toFixed(0)} ₽
                                </span>
                              )}
                              {product.installation_price != null && (
                                <span className="text-sky-600 dark:text-sky-400 font-medium">
                                  Монтаж: {product.installation_price.toFixed(0)} ₽
                                </span>
                              )}
                              <span>• {product.unit}</span>
                            </div>
                          </label>
                        </div>

                        {/* Правая часть: Выбор цены для подъезда */}
                        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                          {/* Селект типа цены */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground hidden lg:inline">Цена:</span>
                            <Select
                              value={binding.priceType}
                              onValueChange={(val: any) => changePriceType(product.id, val)}
                            >
                              <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="retail">
                                  Розница ({product.price.toFixed(0)} ₽)
                                </SelectItem>
                                {product.promo_price != null && (
                                  <SelectItem value="promo">
                                    Акция ({product.promo_price.toFixed(0)} ₽)
                                  </SelectItem>
                                )}
                                {product.installation_price != null && (
                                  <SelectItem value="installation">
                                    Монтаж ({product.installation_price.toFixed(0)} ₽)
                                  </SelectItem>
                                )}
                                <SelectItem value="custom">✏️ Своя цена...</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Инпут своей цены, если выбран режим custom */}
                          {binding.priceType === "custom" && (
                            <div className="flex items-center gap-1 w-24">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                placeholder="₽"
                                value={binding.customPrice}
                                onChange={(e) => changeCustomPrice(product.id, e.target.value)}
                                className="h-8 text-xs px-2 bg-background font-semibold"
                                autoFocus
                              />
                            </div>
                          )}

                          {/* Итоговая рассчитанная цена */}
                          <div className="text-right pl-2 shrink-0 min-w-[70px]">
                            <span
                              className={`text-xs font-bold ${
                                isChecked ? "text-primary" : "text-muted-foreground"
                              }`}
                            >
                              {getDisplayPrice(product, binding)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Подвал с кнопками */}
        <DialogFooter className="p-3 sm:p-4 border-t bg-muted/20 shrink-0 flex flex-row items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {selectedCount > 0 ? (
              <span>
                Будет привязано к подъезду: <strong>{selectedCount}</strong> позиций
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                Внимание: ни один товар не выбран (жильцы не увидят оборудование)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-premium-gold font-semibold"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Сохранить привязку ({selectedCount})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BindProductsDialog;
