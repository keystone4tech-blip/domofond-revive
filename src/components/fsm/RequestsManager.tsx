import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  Plus,
  Edit,
  Trash2,
  Loader2,
  User,
  HandMetal,
  Calendar,
  Package
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";

interface Request {
  id: string;
  name: string;
  phone: string;
  address: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  notes: string | null;
  assigned_employee?: { id: string; full_name: string; phone: string | null } | null;
  accepted_employee?: { id: string; full_name: string; phone: string | null } | null;
}

interface RequestItem {
  id: string;
  request_id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: { id: string; name: string; unit: string };
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  category: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  phone: string | null;
}

const RequestsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isManager } = useUserRole();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    message: "",
    priority: "medium",
    assigned_to: ""
  });

  // Items for request
  const [requestItems, setRequestItems] = useState<{ product_id: string; quantity: number; price: number }[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [newItem, setNewItem] = useState({ product_id: "", quantity: 1 });

  // Fetch requests with employees
  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", statusFilter, employeeFilter],
    queryFn: async () => {
      let query = supabase
        .from("requests")
        .select(`
          *,
          assigned_employee:employees!requests_assigned_to_fkey (id, full_name, phone),
          accepted_employee:employees!requests_accepted_by_fkey (id, full_name, phone)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (employeeFilter !== "all") {
        query = query.or(`assigned_to.eq.${employeeFilter},accepted_by.eq.${employeeFilter}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Auto-upgrade priority for old pending requests
      const now = new Date();
      const updatedData = (data || []).map(req => {
        if (req.status === "pending" || req.status === "in_progress") {
          const daysSinceCreated = differenceInDays(now, new Date(req.created_at));
          if (daysSinceCreated >= 2 && req.priority !== "urgent") {
            // Update in background
            supabase
              .from("requests")
              .update({ priority: "urgent" })
              .eq("id", req.id)
              .then();
            return { ...req, priority: "urgent" };
          }
        }
        return req;
      });

      // Sort by priority
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return updatedData.sort((a, b) => 
        (priorityOrder[a.priority as keyof typeof priorityOrder] || 3) - 
        (priorityOrder[b.priority as keyof typeof priorityOrder] || 3)
      ) as Request[];
    },
  });

  // Fetch employees for filter and assignment
  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, phone")
        .eq("is_active", true);
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch items for selected request
  const { data: selectedRequestItems } = useQuery({
    queryKey: ["request-items", selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest?.id) return [];
      const { data, error } = await supabase
        .from("request_items")
        .select(`
          *,
          product:products (id, name, unit)
        `)
        .eq("request_id", selectedRequest.id);
      if (error) throw error;
      return data as RequestItem[];
    },
    enabled: !!selectedRequest?.id,
  });

  // Statistics
  const stats = {
    total: requests?.length || 0,
    pending: requests?.filter(r => r.status === "pending").length || 0,
    inProgress: requests?.filter(r => r.status === "in_progress").length || 0,
    completed: requests?.filter(r => r.status === "completed").length || 0,
    urgent: requests?.filter(r => r.priority === "urgent").length || 0,
  };

  // Create request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase
        .from("requests")
        .insert({
          name: data.name,
          phone: data.phone,
          address: data.address,
          message: data.message,
          priority: data.priority,
          assigned_to: data.assigned_to || null,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;

      // Insert items if any
      if (requestItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("request_items")
          .insert(requestItems.map(item => ({
            request_id: result.id,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
          })));
        if (itemsError) throw itemsError;
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Заявка создана" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Update request mutation
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Request> & { id: string }) => {
      const { error } = await supabase
        .from("requests")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Заявка обновлена" });
      setEditingRequest(null);
      setIsDialogOpen(false);
    },
  });

  // Accept request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Не авторизован");

      // Get employee record
      const { data: employee } = await supabase
        .from("employees")
        .select("id, full_name, phone")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      const now = new Date();

      // Create acceptance note
      let acceptNote = `Принял: `;
      if (employee) {
        acceptNote += employee.full_name;
        if (employee.phone) acceptNote += `, тел: ${employee.phone}`;
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", userData.user.id)
          .single();
        if (profile) {
          acceptNote += profile.full_name || "Сотрудник";
          if (profile.phone) acceptNote += `, тел: ${profile.phone}`;
        }
      }
      acceptNote += ` • ${format(now, "dd.MM.yyyy HH:mm")}`;

      const { error } = await supabase
        .from("requests")
        .update({
          status: "in_progress",
          accepted_by: employee?.id || null,
          accepted_at: now.toISOString(),
          notes: acceptNote,
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Заявка принята в работу" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Complete request mutation
  const completeRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const now = new Date();
      const { data: request } = await supabase
        .from("requests")
        .select("notes")
        .eq("id", requestId)
        .single();

      const completeNote = (request?.notes || "") + ` | Выполнено: ${format(now, "dd.MM.yyyy HH:mm")}`;

      const { error } = await supabase
        .from("requests")
        .update({
          status: "completed",
          completed_at: now.toISOString(),
          notes: completeNote,
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Заявка выполнена" });
      setIsDetailOpen(false);
    },
  });

  // Delete request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast({ title: "Заявка удалена" });
    },
  });

  // Add item to request
  const addItemMutation = useMutation({
    mutationFn: async ({ requestId, productId, quantity }: { requestId: string; productId: string; quantity: number }) => {
      const product = products?.find(p => p.id === productId);
      if (!product) throw new Error("Товар не найден");

      const { error } = await supabase
        .from("request_items")
        .insert({
          request_id: requestId,
          product_id: productId,
          quantity,
          price: product.price,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-items"] });
      toast({ title: "Товар добавлен" });
      setShowProductDialog(false);
      setNewItem({ product_id: "", quantity: 1 });
    },
  });

  // Delete item from request
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("request_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request-items"] });
      toast({ title: "Товар удален" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      address: "",
      message: "",
      priority: "medium",
      assigned_to: ""
    });
    setRequestItems([]);
    setEditingRequest(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRequest) {
      updateRequestMutation.mutate({
        id: editingRequest.id,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        message: formData.message,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
      });
    } else {
      createRequestMutation.mutate(formData);
    }
  };

  const startEdit = (request: Request) => {
    setEditingRequest(request);
    setFormData({
      name: request.name,
      phone: request.phone,
      address: request.address,
      message: request.message,
      priority: request.priority,
      assigned_to: request.assigned_to || "",
    });
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      pending: { label: "Ожидает", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
      in_progress: { label: "В работе", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: AlertCircle },
      completed: { label: "Выполнено", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
      cancelled: { label: "Отменено", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", icon: CircleDashed },
    };
    const cfg = config[status] || config.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant="secondary" className={`${cfg.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { label: string; color: string }> = {
      low: { label: "Низкий", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
      medium: { label: "Средний", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      high: { label: "Высокий", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
      urgent: { label: "Срочно!", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse" },
    };
    const cfg = config[priority] || config.medium;
    return <Badge variant="secondary" className={cfg.color}>{cfg.label}</Badge>;
  };

  const calculateTotal = (items: RequestItem[]) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("all")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Всего</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("pending")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Ожидают</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("in_progress")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">В работе</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter("completed")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Выполнено</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${stats.urgent > 0 ? 'border-red-500' : ''}`}>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${stats.urgent > 0 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>{stats.urgent}</div>
            <div className="text-xs text-muted-foreground">Срочных</div>
          </CardContent>
        </Card>
      </div>

      {/* Header with filters and create button */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <CardTitle>Заявки</CardTitle>
            
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="completed">Выполнено</SelectItem>
                  <SelectItem value="cancelled">Отменено</SelectItem>
                </SelectContent>
              </Select>

              <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Мастер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все мастера</SelectItem>
                  {employees?.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingRequest ? "Редактировать заявку" : "Новая заявка"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Имя клиента *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Телефон *</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Адрес *</Label>
                      <Input
                        id="address"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="message">Описание проблемы *</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        rows={3}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Приоритет</Label>
                        <Select
                          value={formData.priority}
                          onValueChange={(v) => setFormData({ ...formData, priority: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Низкий</SelectItem>
                            <SelectItem value="medium">Средний</SelectItem>
                            <SelectItem value="high">Высокий</SelectItem>
                            <SelectItem value="urgent">Срочно</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Назначить мастеру</Label>
                        <Select
                          value={formData.assigned_to}
                          onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees?.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createRequestMutation.isPending || updateRequestMutation.isPending}
                    >
                      {(createRequestMutation.isPending || updateRequestMutation.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingRequest ? "Сохранить" : "Создать заявку"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!requests || requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет заявок
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <Card 
                  key={request.id} 
                  className={`hover:border-primary/50 transition-colors cursor-pointer ${request.priority === 'urgent' ? 'border-red-500/50' : ''}`}
                  onClick={() => {
                    setSelectedRequest(request);
                    setIsDetailOpen(true);
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row gap-3 justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{request.name}</span>
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.priority)}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <a href={`tel:${request.phone}`} className="hover:text-primary" onClick={e => e.stopPropagation()}>
                            {request.phone}
                          </a>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {request.address}
                        </div>
                        <p className="text-sm line-clamp-2">{request.message}</p>
                        
                        {/* Show who accepted */}
                        {request.accepted_employee && (
                          <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                            <User className="h-3 w-3" />
                            Принял: {request.accepted_employee.full_name}
                            {request.accepted_at && (
                              <span className="text-muted-foreground">
                                • {format(new Date(request.accepted_at), "dd.MM HH:mm", { locale: ru })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), "dd MMM, HH:mm", { locale: ru })}
                        </div>
                        <div className="flex gap-1">
                          {request.status === "pending" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptRequestMutation.mutate(request.id);
                              }}
                              disabled={acceptRequestMutation.isPending}
                            >
                              <HandMetal className="h-4 w-4 mr-1" />
                              Принять
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRequest(request);
                                setIsDetailOpen(true);
                              }}>
                                Подробнее
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                startEdit(request);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Редактировать
                              </DropdownMenuItem>
                              {request.status === "in_progress" && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  completeRequestMutation.mutate(request.id);
                                }}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Выполнено
                                </DropdownMenuItem>
                              )}
                              {isManager && (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteRequestMutation.mutate(request.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Удалить
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали заявки</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {getStatusBadge(selectedRequest.status)}
                {getPriorityBadge(selectedRequest.priority)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Клиент</Label>
                  <p className="font-medium">{selectedRequest.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Телефон</Label>
                  <a href={`tel:${selectedRequest.phone}`} className="text-primary hover:underline flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {selectedRequest.phone}
                  </a>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Адрес</Label>
                  <p className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {selectedRequest.address}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Описание</Label>
                <p className="whitespace-pre-wrap">{selectedRequest.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Дата создания</Label>
                  <p className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedRequest.created_at), "dd MMMM yyyy, HH:mm", { locale: ru })}
                  </p>
                </div>
                {selectedRequest.accepted_at && (
                  <div>
                    <Label className="text-muted-foreground">Время принятия</Label>
                    <p>{format(new Date(selectedRequest.accepted_at), "dd MMMM yyyy, HH:mm", { locale: ru })}</p>
                  </div>
                )}
                {selectedRequest.completed_at && (
                  <div>
                    <Label className="text-muted-foreground">Время выполнения</Label>
                    <p>{format(new Date(selectedRequest.completed_at), "dd MMMM yyyy, HH:mm", { locale: ru })}</p>
                  </div>
                )}
              </div>

              {/* Accepted by info */}
              {selectedRequest.accepted_employee && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <Label className="text-green-700 dark:text-green-400">Принял заявку</Label>
                  <p className="font-medium">{selectedRequest.accepted_employee.full_name}</p>
                  {selectedRequest.accepted_employee.phone && (
                    <a href={`tel:${selectedRequest.accepted_employee.phone}`} className="text-sm text-primary">
                      {selectedRequest.accepted_employee.phone}
                    </a>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedRequest.notes && (
                <div>
                  <Label className="text-muted-foreground">Примечания</Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded">{selectedRequest.notes}</p>
                </div>
              )}

              {/* Products/Items Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Товары и услуги
                  </Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowProductDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить
                  </Button>
                </div>
                
                {selectedRequestItems && selectedRequestItems.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRequestItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <span className="font-medium">{item.product?.name}</span>
                          <span className="text-muted-foreground ml-2">
                            {item.quantity} {item.product?.unit} × {item.price} ₽
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{(item.price * item.quantity).toFixed(0)} ₽</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteItemMutation.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t font-bold">
                      <span>Итого:</span>
                      <span>{calculateTotal(selectedRequestItems).toFixed(0)} ₽</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Нет добавленных товаров</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedRequest.status === "pending" && (
                  <Button 
                    onClick={() => acceptRequestMutation.mutate(selectedRequest.id)}
                    disabled={acceptRequestMutation.isPending}
                  >
                    <HandMetal className="h-4 w-4 mr-2" />
                    Принять в работу
                  </Button>
                )}
                {selectedRequest.status === "in_progress" && (
                  <Button 
                    onClick={() => completeRequestMutation.mutate(selectedRequest.id)}
                    disabled={completeRequestMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Выполнено
                  </Button>
                )}
                <Button variant="outline" onClick={() => startEdit(selectedRequest)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Редактировать
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить товар/услугу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Товар</Label>
              <Select
                value={newItem.product_id}
                onValueChange={(v) => setNewItem({ ...newItem, product_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите товар" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {product.price} ₽/{product.unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Количество</Label>
              <Input
                type="number"
                min="1"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (selectedRequest && newItem.product_id) {
                  addItemMutation.mutate({
                    requestId: selectedRequest.id,
                    productId: newItem.product_id,
                    quantity: newItem.quantity,
                  });
                }
              }}
              disabled={!newItem.product_id || addItemMutation.isPending}
            >
              {addItemMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestsManager;
