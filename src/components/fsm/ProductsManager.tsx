// ============================================================================
// Компонент: ProductsManager
// Назначение: Управление каталогом товаров и услуг в CRM-панели (FSM).
// Функционал:
//   1. Иерархическое дерево папок и подпапок (создание, переименование, удаление).
//   2. Фильтрация товаров по папкам ("Все товары", "Без папки", конкретная папка/подпапка).
//   3. Поиск позиций по наименованию и фильтрация по категории.
//   4. Массовое перемещение выбранных чекбоксами позиций в любую папку или подпапку.
//   5. Создание и редактирование товара с фото (загрузка файла / ссылка), розничной ценой,
//      ценой по акции и ценой на монтаже.
//   6. Импорт номенклатуры из файлов прайс-листов (.txt/.tsv/.csv) с ценами.
//   7. Пагинация и предпросмотр фотографий товаров.
// ============================================================================

import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  Package,
  Folder,
  FolderPlus,
  ChevronRight,
  Upload,
  Search,
  ArrowRightLeft,
  FolderTree,
  ImageIcon,
  Camera,
  X,
  ExternalLink,
  Tag,
  Wrench,
} from "lucide-react";
import { ImportNomenclatureDialog } from "./ImportNomenclatureDialog";

// Интерфейс для товара/услуги
interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promo_price?: number | null; // Цена по акции
  installation_price?: number | null; // Цена на монтаже
  unit: string;
  category: string | null;
  folder_id: string | null; // ID родительской папки
  image_url?: string | null; // Фото товара/услуги
  is_active: boolean;
  created_at: string;
}

// Интерфейс для папки номенклатуры
interface ProductFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string;
}

// Предопределенные категории
const categories = [
  { value: "service", label: "Услуга" },
  { value: "material", label: "Материал" },
  { value: "equipment", label: "Оборудование" },
  { value: "other", label: "Прочее" },
];

// Единицы измерения
const units = [
  { value: "шт", label: "шт" },
  { value: "м", label: "метр" },
  { value: "м²", label: "м²" },
  { value: "компл", label: "комплект" },
  { value: "час", label: "час" },
  { value: "услуга", label: "услуга" },
];

export const ProductsManager: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isManager } = useUserRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Состояние выбранной папки для фильтрации: "all" | "none" | UUID папки
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  // Поисковый запрос
  const [searchQuery, setSearchQuery] = useState<string>("");
  // Фильтр по категории
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Пагинация
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Выбранные чекбоксами товары для массовых действий
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  // Папка назначения для массового перемещения
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState<string>("none");

  // Модальные окна
  const [isProductDialogOpen, setIsProductDialogOpen] = useState<boolean>(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState<boolean>(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState<boolean>(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Редактируемый товар
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Состояние создания/редактирования папки
  const [editingFolder, setEditingFolder] = useState<ProductFolder | null>(null);
  const [folderForm, setFolderForm] = useState<{ name: string; parent_id: string | null }>({
    name: "",
    parent_id: null,
  });

  // Форма товара
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    promo_price: "",
    installation_price: "",
    unit: "шт",
    category: "equipment",
    folder_id: "none",
    image_url: "",
    is_active: true,
  });

  // Режим ввода фото: загрузка файла или ввод URL
  const [isPhotoUrlMode, setIsPhotoUrlMode] = useState<boolean>(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);

  // ============================================================================
  // Запрос списка папок
  // ============================================================================
  const {
    data: folders = [],
    isLoading: isFoldersLoading,
    refetch: refetchFolders,
  } = useQuery({
    queryKey: ["product_folders"],
    queryFn: async () => {
      console.log("[ProductsManager] Загрузка списка папок...");
      const { data, error } = await supabase
        .from("product_folders")
        .select("*")
        .order("name");

      if (error) {
        console.error("[ProductsManager] Ошибка при загрузке папок:", error);
        throw error;
      }
      return (data || []) as ProductFolder[];
    },
  });

  // ============================================================================
  // Запрос списка товаров
  // ============================================================================
  const {
    data: products = [],
    isLoading: isProductsLoading,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      console.log("[ProductsManager] Загрузка списка товаров...");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) {
        console.error("[ProductsManager] Ошибка при загрузке товаров:", error);
        throw error;
      }
      return (data || []) as Product[];
    },
  });

  // ============================================================================
  // Построение плоского дерева папок с уровнями вложенности (для селектов и списка)
  // ============================================================================
  const folderTreeFlat = useMemo(() => {
    const result: { folder: ProductFolder; level: number; displayName: string }[] = [];

    // Рекурсивный обход дерева
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

    // Добавляем папки, у которых parent_id ссылается на несуществующую папку
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
    };

    for (const p of products) {
      if (!p.folder_id) {
        counts.none = (counts.none || 0) + 1;
      } else {
        counts[p.folder_id] = (counts[p.folder_id] || 0) + 1;
      }
    }

    return counts;
  }, [products]);

  // ============================================================================
  // Фильтрация товаров по поиску, категории и выбранной папке
  // ============================================================================
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Фильтр по папке
      if (selectedFolderId === "none") {
        if (p.folder_id !== null) return false;
      } else if (selectedFolderId !== "all") {
        if (p.folder_id !== selectedFolderId) return false;
      }

      // 2. Фильтр по категории
      if (categoryFilter !== "all" && p.category !== categoryFilter) {
        return false;
      }

      // 3. Поиск по строке
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name?.toLowerCase().includes(q);
        const matchDesc = p.description?.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }

      return true;
    });
  }, [products, selectedFolderId, categoryFilter, searchQuery]);

  // Пагинация отфильтрованных товаров
  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Сброс страницы при смене фильтров
  const handleFolderSelect = (folderId: string) => {
    setSelectedFolderId(folderId);
    setCurrentPage(1);
    setSelectedProductIds([]);
  };

  // Сжатие изображения через Canvas для компактного сохранения в base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    console.log(`[ProductsManager] Обработка изображения: ${file.name}, исходный размер: ${(file.size / 1024).toFixed(1)} КБ`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800; // Оптимальный размер для фото товаров
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
          console.log(`[ProductsManager] Сжатие завершено: ${width}x${height}`);
          setProductForm((prev) => ({ ...prev, image_url: compressedDataUrl }));
        } else {
          setProductForm((prev) => ({ ...prev, image_url: img.src }));
        }
        setIsCompressingPhoto(false);
      };
      img.onerror = () => {
        setIsCompressingPhoto(false);
        toast({ title: "Ошибка", description: "Не удалось прочитать изображение", variant: "destructive" });
      };
    };
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // Мутации: Создание / Обновление / Удаление товаров
  // ============================================================================
  const createProductMutation = useMutation({
    mutationFn: async (data: typeof productForm) => {
      console.log("[ProductsManager] Создание нового товара:", data.name);
      const { error } = await supabase.from("products").insert({
        name: data.name,
        description: data.description || null,
        price: parseFloat(data.price),
        promo_price: data.promo_price.trim() ? parseFloat(data.promo_price) : null,
        installation_price: data.installation_price.trim() ? parseFloat(data.installation_price) : null,
        unit: data.unit,
        category: data.category,
        folder_id: data.folder_id === "none" ? null : data.folder_id,
        image_url: data.image_url.trim() ? data.image_url : null,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Успешно", description: "Товар успешно добавлен в каталог" });
      setIsProductDialogOpen(false);
      resetProductForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка создания", description: error.message, variant: "destructive" });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Product> & { id: string }) => {
      console.log("[ProductsManager] Обновление товара id:", id);
      const { error } = await supabase
        .from("products")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Успешно", description: "Данные товара обновлены" });
      setEditingProduct(null);
      setIsProductDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка обновления", description: error.message, variant: "destructive" });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("[ProductsManager] Удаление товара id:", id);
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Удалено", description: "Товар удален из каталога" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // ============================================================================
  // Мутации: Создание / Обновление / Удаление папок
  // ============================================================================
  const saveFolderMutation = useMutation({
    mutationFn: async () => {
      if (!folderForm.name.trim()) {
        throw new Error("Введите название папки");
      }

      if (editingFolder) {
        console.log("[ProductsManager] Редактирование папки:", editingFolder.id, folderForm);
        const { error } = await supabase
          .from("product_folders")
          .update({
            name: folderForm.name.trim(),
            parent_id: folderForm.parent_id,
          })
          .eq("id", editingFolder.id);
        if (error) throw error;
      } else {
        console.log("[ProductsManager] Создание новой папки:", folderForm);
        const { error } = await supabase.from("product_folders").insert({
          name: folderForm.name.trim(),
          parent_id: folderForm.parent_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_folders"] });
      toast({
        title: "Успешно",
        description: editingFolder ? "Папка переименована" : "Новая папка создана",
      });
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      setFolderForm({ name: "", parent_id: null });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка папки", description: error.message, variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      console.log("[ProductsManager] Удаление папки id:", folderId);
      const { error } = await supabase.from("product_folders").delete().eq("id", folderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_folders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (selectedFolderId === editingFolder?.id) {
        setSelectedFolderId("all");
      }
      toast({ title: "Папка удалена", description: "Товары из папки перемещены в 'Без папки'" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка при удалении", description: error.message, variant: "destructive" });
    },
  });

  // ============================================================================
  // Массовое перемещение товаров по папкам
  // ============================================================================
  const bulkMoveMutation = useMutation({
    mutationFn: async () => {
      if (selectedProductIds.length === 0) return;
      const targetFolder = bulkTargetFolderId === "none" ? null : bulkTargetFolderId;
      console.log(
        `[ProductsManager] Массовое перемещение ${selectedProductIds.length} позиций в папку: ${targetFolder}`
      );

      const { error } = await supabase
        .from("products")
        .update({ folder_id: targetFolder })
        .in("id", selectedProductIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Перемещение выполнено",
        description: `Перемещено позиций: ${selectedProductIds.length}`,
      });
      setSelectedProductIds([]);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка перемещения", description: error.message, variant: "destructive" });
    },
  });

  // Вспомогательные функции
  const resetProductForm = () => {
    setProductForm({
      name: "",
      description: "",
      price: "",
      promo_price: "",
      installation_price: "",
      unit: "шт",
      category: "equipment",
      folder_id: selectedFolderId !== "all" ? selectedFolderId : "none",
      image_url: "",
      is_active: true,
    });
    setEditingProduct(null);
    setIsPhotoUrlMode(false);
  };

  const startEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      promo_price: product.promo_price != null ? product.promo_price.toString() : "",
      installation_price: product.installation_price != null ? product.installation_price.toString() : "",
      unit: product.unit,
      category: product.category || "equipment",
      folder_id: product.folder_id || "none",
      image_url: product.image_url || "",
      is_active: product.is_active,
    });
    setIsPhotoUrlMode(false);
    setIsProductDialogOpen(true);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProductMutation.mutate({
        id: editingProduct.id,
        name: productForm.name,
        description: productForm.description || null,
        price: parseFloat(productForm.price),
        promo_price: productForm.promo_price.trim() ? parseFloat(productForm.promo_price) : null,
        installation_price: productForm.installation_price.trim() ? parseFloat(productForm.installation_price) : null,
        unit: productForm.unit,
        category: productForm.category,
        folder_id: productForm.folder_id === "none" ? null : productForm.folder_id,
        image_url: productForm.image_url.trim() ? productForm.image_url : null,
        is_active: productForm.is_active,
      });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const openCreateFolderDialog = (parentId: string | null = null) => {
    setEditingFolder(null);
    setFolderForm({ name: "", parent_id: parentId });
    setIsFolderDialogOpen(true);
  };

  const openEditFolderDialog = (folder: ProductFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folder);
    setFolderForm({ name: folder.name, parent_id: folder.parent_id });
    setIsFolderDialogOpen(true);
  };

  const toggleSelectAllPage = () => {
    const pageIds = paginatedProducts.map((p) => p.id);
    const allSelected = pageIds.every((id) => selectedProductIds.includes(id));
    if (allSelected) {
      setSelectedProductIds(selectedProductIds.filter((id) => !pageIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedProductIds, ...pageIds]));
      setSelectedProductIds(merged);
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedProductIds.includes(id)) {
      setSelectedProductIds(selectedProductIds.filter((item) => item !== id));
    } else {
      setSelectedProductIds([...selectedProductIds, id]);
    }
  };

  const getFolderName = (folderId: string | null) => {
    if (!folderId) return "—";
    const found = folders.find((f) => f.id === folderId);
    return found ? found.name : "—";
  };

  const getCategoryLabel = (category: string | null) => {
    return categories.find((c) => c.value === category)?.label || "Прочее";
  };

  if (isProductsLoading && isFoldersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Верхняя шапка действий */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Каталог товаров, услуг и оборудования
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Всего позиций в базе: <strong className="text-foreground">{products.length}</strong> | Папок:{" "}
            <strong className="text-foreground">{folders.length}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Кнопка импорта номенклатуры из файла */}
          <Button
            variant="outline"
            className="border-primary/30 hover:bg-primary/5 text-primary font-medium"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Загрузить номенклатуру
          </Button>

          {/* Кнопка добавления новой папки */}
          <Button
            variant="outline"
            onClick={() => openCreateFolderDialog(null)}
          >
            <FolderPlus className="h-4 w-4 mr-2 text-amber-500" />
            Новая папка
          </Button>

          {/* Кнопка создания единичного товара */}
          <Button
            onClick={() => {
              resetProductForm();
              setIsProductDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить позицию
          </Button>
        </div>
      </div>

      {/* Основной макет: Дерево папок слева + Таблица товаров справа */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* ================================================================== */}
        {/* ЛЕВАЯ КОЛОНКА: Дерево папок и подпапок */}
        {/* ================================================================== */}
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              Папки и структура
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Создать папку в корне"
              onClick={() => openCreateFolderDialog(null)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {/* Папка "Все товары" */}
            <div
              onClick={() => handleFolderSelect("all")}
              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
                selectedFolderId === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Package className="h-4 w-4 shrink-0" />
                <span className="truncate">Все товары</span>
              </div>
              <Badge
                variant={selectedFolderId === "all" ? "outline" : "secondary"}
                className={`ml-1 text-xs shrink-0 ${
                  selectedFolderId === "all" ? "text-primary-foreground border-primary-foreground/30" : ""
                }`}
              >
                {countsByFolder.all || 0}
              </Badge>
            </div>

            {/* Папка "Без папки" */}
            <div
              onClick={() => handleFolderSelect("none")}
              className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${
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
                className={`ml-1 text-xs shrink-0 ${
                  selectedFolderId === "none" ? "text-primary-foreground border-primary-foreground/30" : ""
                }`}
              >
                {countsByFolder.none || 0}
              </Badge>
            </div>

            <div className="border-t my-2 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3">
                Созданные папки
              </span>
            </div>

            {/* Список папок и подпапок */}
            {folderTreeFlat.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                Папки пока не созданы. Нажмите «Новая папка», чтобы упорядочить товары.
              </div>
            ) : (
              folderTreeFlat.map(({ folder, level }) => {
                const count = countsByFolder[folder.id] || 0;
                const isSelected = selectedFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    onClick={() => handleFolderSelect(folder.id)}
                    style={{ paddingLeft: `${Math.max(12, level * 16 + 12)}px` }}
                    className={`group flex items-center justify-between pr-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {level > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
                      <Folder
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? "text-primary-foreground" : "text-amber-500"
                        }`}
                      />
                      <span className="truncate" title={folder.name}>
                        {folder.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      <Badge
                        variant={isSelected ? "outline" : "secondary"}
                        className={`text-[10px] px-1.5 py-0 ${
                          isSelected ? "text-primary-foreground border-primary-foreground/30" : ""
                        }`}
                      >
                        {count}
                      </Badge>

                      {/* Кнопка создания подпапки */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${
                          isSelected ? "text-primary-foreground hover:bg-primary-foreground/20" : "hover:bg-muted"
                        }`}
                        title="Создать подпапку"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateFolderDialog(folder.id);
                        }}
                      >
                        <FolderPlus className="h-3 w-3" />
                      </Button>

                      {/* Кнопка редактирования папки */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${
                          isSelected ? "text-primary-foreground hover:bg-primary-foreground/20" : "hover:bg-muted"
                        }`}
                        title="Переименовать"
                        onClick={(e) => openEditFolderDialog(folder, e)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>

                      {/* Кнопка удаления папки */}
                      {isManager && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity ${
                            isSelected ? "hover:bg-destructive/20" : "hover:bg-destructive/10"
                          }`}
                          title="Удалить папку"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Удалить папку "${folder.name}"? Товары останутся без папки.`)) {
                              deleteFolderMutation.mutate(folder.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* ================================================================== */}
        {/* ПРАВАЯ КОЛОНКА: Таблица товаров, фильтрация, поиск, пагинация */}
        {/* ================================================================== */}
        <div className="lg:col-span-3 space-y-4">
          {/* Панель фильтров и поиска */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-card p-3 rounded-xl border">
            {/* Поиск */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по названию или описанию..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 h-9"
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

            {/* Фильтр категории */}
            <div className="flex items-center gap-2">
              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  setCategoryFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Панель массовых действий (если выбраны позиции чекбоксами) */}
          {selectedProductIds.length > 0 && (
            <div className="bg-primary/10 border border-primary/30 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <ArrowRightLeft className="h-4 w-4 shrink-0" />
                <span>
                  Выбрано позиций: <strong>{selectedProductIds.length}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <span className="text-xs text-muted-foreground">Переместить в:</span>
                <Select value={bulkTargetFolderId} onValueChange={setBulkTargetFolderId}>
                  <SelectTrigger className="w-[200px] h-8 text-xs bg-background">
                    <SelectValue placeholder="Выберите папку" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">📂 Без папки (в корень)</SelectItem>
                    {folderTreeFlat.map(({ folder, displayName }) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => bulkMoveMutation.mutate()}
                  disabled={bulkMoveMutation.isPending}
                >
                  {bulkMoveMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Переместить
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedProductIds([])}
                >
                  Снять выбор
                </Button>
              </div>
            </div>
          )}

          {/* Таблица товаров */}
          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[40px] text-center">
                      <Checkbox
                        checked={
                          paginatedProducts.length > 0 &&
                          paginatedProducts.every((p) => selectedProductIds.includes(p.id))
                        }
                        onCheckedChange={toggleSelectAllPage}
                        aria-label="Выбрать все на странице"
                      />
                    </TableHead>
                    <TableHead className="w-[50px] text-center">Фото</TableHead>
                    <TableHead>Наименование</TableHead>
                    <TableHead className="w-[120px]">Папка</TableHead>
                    <TableHead className="w-[100px]">Категория</TableHead>
                    <TableHead className="text-right w-[95px]">Розница</TableHead>
                    <TableHead className="text-right w-[95px]">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">Акция</span>
                    </TableHead>
                    <TableHead className="text-right w-[95px]">На монтаже</TableHead>
                    <TableHead className="w-[50px]">Ед.</TableHead>
                    <TableHead className="w-[60px] text-center">Статус</TableHead>
                    <TableHead className="text-right w-[85px]">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        {searchQuery ? "По запросу ничего не найдено." : "В данной папке нет товаров."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedProducts.map((product) => {
                      const isSelected = selectedProductIds.includes(product.id);
                      return (
                        <TableRow
                          key={product.id}
                          className={`${!product.is_active ? "opacity-50" : ""} ${
                            isSelected ? "bg-primary/5" : ""
                          }`}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectOne(product.id)}
                            />
                          </TableCell>

                          {/* Миниатюра фото товара */}
                          <TableCell className="text-center p-2">
                            {product.image_url ? (
                              <button
                                type="button"
                                onClick={() => setPreviewPhotoUrl(product.image_url || null)}
                                className="h-9 w-9 rounded-lg overflow-hidden border border-border/80 hover:ring-2 hover:ring-primary/50 transition-all bg-muted shrink-0 inline-flex items-center justify-center cursor-pointer"
                                title="Нажмите для увеличения фото"
                              >
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              </button>
                            ) : (
                              <div
                                className="h-9 w-9 rounded-lg bg-muted/60 border border-dashed border-border/60 flex items-center justify-center text-muted-foreground/40 mx-auto"
                                title="Нет фотографии"
                              >
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="font-medium">
                            <div>
                              <span className="text-foreground hover:text-primary transition-colors">
                                {product.name}
                              </span>
                              {product.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[120px]">
                              <Folder className="h-3 w-3 text-amber-500/70 shrink-0" />
                              <span className="truncate">{getFolderName(product.folder_id)}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {getCategoryLabel(product.category)}
                          </TableCell>

                          {/* Розница */}
                          <TableCell className="text-right font-semibold text-foreground">
                            {product.price.toFixed(0)} ₽
                          </TableCell>

                          {/* Акция */}
                          <TableCell className="text-right">
                            {product.promo_price != null ? (
                              <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-lg text-xs">
                                {product.promo_price.toFixed(0)} ₽
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* На монтаже */}
                          <TableCell className="text-right">
                            {product.installation_price != null ? (
                              <span className="font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 px-2 py-0.5 rounded-lg text-xs">
                                {product.installation_price.toFixed(0)} ₽
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">{product.unit}</TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={product.is_active}
                              onCheckedChange={(v) =>
                                toggleActiveMutation.mutate({ id: product.id, is_active: v })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => startEditProduct(product)}
                                title="Редактировать"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              {isManager && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    if (confirm(`Удалить "${product.name}"?`)) {
                                      deleteProductMutation.mutate(product.id);
                                    }
                                  }}
                                  title="Удалить"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Пагинация в подвале таблицы */}
            <div className="p-3 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
              <div>
                Показано {paginatedProducts.length} из {filteredProducts.length} позиций
                {filteredProducts.length !== products.length && ` (отфильтровано из ${products.length})`}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Назад
                  </Button>
                  <span className="px-2 font-medium text-foreground">
                    Стр. {currentPage} из {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Вперед
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ================================================================== */}
      {/* ДИАЛОГ: Создание / Редактирование товара */}
      {/* ================================================================== */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Редактировать позицию" : "Новая позиция в каталог"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProductSubmit} className="space-y-4">
            {/* Блок прикрепления фотографии */}
            <div className="space-y-2 p-3 rounded-xl border bg-muted/20">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-primary" />
                  Фотография товара / услуги
                </span>
                <button
                  type="button"
                  onClick={() => setIsPhotoUrlMode(!isPhotoUrlMode)}
                  className="text-[11px] text-primary hover:underline font-normal"
                >
                  {isPhotoUrlMode ? "Загрузить файл" : "Ввести ссылку (URL)"}
                </button>
              </Label>

              <div className="flex items-center gap-3">
                {/* Превью фото */}
                <div className="h-16 w-16 rounded-xl border border-dashed border-border flex items-center justify-center overflow-hidden bg-background shrink-0 relative group">
                  {productForm.image_url ? (
                    <>
                      <img
                        src={productForm.image_url}
                        alt="Превью"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setProductForm({ ...productForm, image_url: "" })}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                        title="Удалить фото"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>

                {/* Управление загрузкой */}
                <div className="flex-1 space-y-1.5">
                  {isPhotoUrlMode ? (
                    <Input
                      placeholder="https://example.com/image.jpg"
                      value={productForm.image_url}
                      onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                      className="text-xs h-9"
                    />
                  ) : (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="product-photo-upload"
                      />
                      <label htmlFor="product-photo-upload" className="cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 text-xs w-full sm:w-auto"
                          disabled={isCompressingPhoto}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {isCompressingPhoto ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              Сжатие фото...
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5 mr-2" />
                              {productForm.image_url ? "Заменить фото" : "Выбрать фото"}
                            </>
                          )}
                        </Button>
                      </label>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        PNG, JPG, WebP. Автоматически оптимизируется для быстрой загрузки.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-name">Наименование *</Label>
              <Input
                id="prod-name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                required
                placeholder="Например: Ключ бесконтактный RFID"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-desc">Описание</Label>
              <Textarea
                id="prod-desc"
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                rows={2}
                placeholder="Краткое описание характеристик или области применения"
              />
            </div>

            {/* Выбор папки */}
            <div className="space-y-2">
              <Label>Папка каталога</Label>
              <Select
                value={productForm.folder_id}
                onValueChange={(v) => setProductForm({ ...productForm, folder_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите папку" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">📂 Без папки (в корне)</SelectItem>
                  {folderTreeFlat.map(({ folder, displayName }) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Блок из 3 цен: Розница, Акция, На монтаже */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. Розничная цена */}
              <div className="space-y-1.5">
                <Label htmlFor="prod-price" className="text-xs font-semibold flex items-center gap-1">
                  <span>Розничная (₽) *</span>
                </Label>
                <Input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  required
                  placeholder="1500.00"
                />
                <p className="text-[10px] text-muted-foreground">Базовая цена</p>
              </div>

              {/* 2. Цена по акции */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="prod-promo-price"
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between"
                >
                  <span>Акция (₽)</span>
                  <Tag className="h-3 w-3" />
                </Label>
                <Input
                  id="prod-promo-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.promo_price}
                  onChange={(e) => setProductForm({ ...productForm, promo_price: e.target.value })}
                  placeholder="Цена по акции"
                  className="border-amber-200 dark:border-amber-900/60"
                />
                <p className="text-[10px] text-muted-foreground">Специальная цена</p>
              </div>

              {/* 3. Цена на монтаже */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="prod-install-price"
                  className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex items-center justify-between"
                >
                  <span>На монтаже (₽)</span>
                  <Wrench className="h-3 w-3" />
                </Label>
                <Input
                  id="prod-install-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productForm.installation_price}
                  onChange={(e) =>
                    setProductForm({ ...productForm, installation_price: e.target.value })
                  }
                  placeholder="Задается вручную"
                  className="border-sky-200 dark:border-sky-900/60"
                />
                <p className="text-[10px] text-muted-foreground">Ввод дома/монтаж</p>
              </div>
            </div>

            {/* Категория и единица измерения */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Категория</Label>
                <Select
                  value={productForm.category}
                  onValueChange={(v) => setProductForm({ ...productForm, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Единица измерения</Label>
                <Select
                  value={productForm.unit}
                  onValueChange={(v) => setProductForm({ ...productForm, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Switch
                checked={productForm.is_active}
                onCheckedChange={(v) => setProductForm({ ...productForm, is_active: v })}
              />
              <Label>Активен (доступен для заказов и в сметах)</Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProductDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
              >
                {(createProductMutation.isPending || updateProductMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingProduct ? "Сохранить" : "Добавить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* ДИАЛОГ: Создание / Редактирование папки */}
      {/* ================================================================== */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFolder ? "Редактировать папку" : "Новая папка каталога"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Название папки *</Label>
              <Input
                id="folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                placeholder="Например: Домофония, Видеонаблюдение..."
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Родительская папка (для создания подпапки)</Label>
              <Select
                value={folderForm.parent_id || "root"}
                onValueChange={(v) =>
                  setFolderForm({ ...folderForm, parent_id: v === "root" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Корневая папка (без родителя)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">📁 Корневой уровень (основная папка)</SelectItem>
                  {folderTreeFlat
                    // Исключаем саму редактируемую папку, чтобы не создать цикличность
                    .filter(({ folder }) => folder.id !== editingFolder?.id)
                    .map(({ folder, displayName }) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFolderDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              onClick={() => saveFolderMutation.mutate()}
              disabled={saveFolderMutation.isPending || !folderForm.name.trim()}
            >
              {saveFolderMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingFolder ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* ДИАЛОГ: Полноразмерный просмотр фотографии товара */}
      {/* ================================================================== */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={() => setPreviewPhotoUrl(null)}>
        <DialogContent className="sm:max-w-xl p-2 bg-background/95 backdrop-blur-md">
          <div className="relative flex items-center justify-center p-2">
            {previewPhotoUrl && (
              <img
                src={previewPhotoUrl}
                alt="Увеличенное фото"
                className="max-h-[80vh] w-auto object-contain rounded-lg shadow-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* ДИАЛОГ: Загрузка номенклатуры из файла прайс-листа */}
      {/* ================================================================== */}
      <ImportNomenclatureDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onSuccess={() => {
          refetchProducts();
          refetchFolders();
        }}
      />
    </div>
  );
};

export default ProductsManager;
