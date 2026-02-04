import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Loader2, Package } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

const categories = [
  { value: "service", label: "Услуга" },
  { value: "material", label: "Материал" },
  { value: "equipment", label: "Оборудование" },
  { value: "other", label: "Прочее" },
];

const units = [
  { value: "шт", label: "шт" },
  { value: "м", label: "метр" },
  { value: "м²", label: "м²" },
  { value: "час", label: "час" },
  { value: "услуга", label: "услуга" },
];

const ProductsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isManager } = useUserRole();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    unit: "шт",
    category: "service",
    is_active: true,
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("name");

      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("products").insert({
        name: data.name,
        description: data.description || null,
        price: parseFloat(data.price),
        unit: data.unit,
        category: data.category,
        is_active: data.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар добавлен" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Product> & { id: string }) => {
      const { error } = await supabase
        .from("products")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар обновлен" });
      setEditingProduct(null);
      setIsDialogOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Товар удален" });
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

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      unit: "шт",
      category: "service",
      is_active: true,
    });
    setEditingProduct(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateMutation.mutate({
        id: editingProduct.id,
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        unit: formData.unit,
        category: formData.category,
        is_active: formData.is_active,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const startEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      unit: product.unit,
      category: product.category || "service",
      is_active: product.is_active,
    });
    setIsDialogOpen(true);
  };

  const getCategoryLabel = (category: string | null) => {
    return categories.find(c => c.value === category)?.label || "Прочее";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Товары и услуги
        </CardTitle>
        <div className="flex gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Редактировать" : "Новый товар"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Цена *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Единица измерения</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(v) => setFormData({ ...formData, unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(u => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Категория</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>Активен</Label>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingProduct ? "Сохранить" : "Добавить"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {!products || products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Нет товаров. Добавьте первый товар или услугу.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead>Ед.</TableHead>
                  <TableHead>Активен</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className={!product.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-medium">
                      <div>
                        {product.name}
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryLabel(product.category)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {product.price.toFixed(0)} ₽
                    </TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell>
                      <Switch
                        checked={product.is_active}
                        onCheckedChange={(v) => toggleActiveMutation.mutate({ id: product.id, is_active: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(product)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isManager && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteMutation.mutate(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductsManager;
