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
  Package,
  Eye
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import RequestDetails from "./RequestDetails";

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show request details view
  if (selectedRequest) {
    return (
      <RequestDetails
        request={selectedRequest}
        onBack={() => setSelectedRequest(null)}
        isManager={isManager}
      />
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

                    {/* Products section for new request */}
                    {!editingRequest && (
                      <div className="border-t pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Товары и услуги
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setShowProductDialog(true)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Добавить
                          </Button>
                        </div>
                        {requestItems.length > 0 ? (
                          <div className="space-y-2">
                            {requestItems.map((item, idx) => {
                              const product = products?.find(p => p.id === item.product_id);
                              return (
                                <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                  <div>
                                    <span className="font-medium">{product?.name}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {item.quantity} × {item.price.toFixed(0)} ₽
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">{(item.price * item.quantity).toFixed(0)} ₽</span>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex justify-between pt-2 border-t text-sm font-semibold">
                              <span>Итого:</span>
                              <span>{requestItems.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(0)} ₽</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Нет добавленных товаров</p>
                        )}
                      </div>
                    )}

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
                  className={`hover:border-primary/50 transition-colors cursor-pointer ${request.priority === 'urgent' ? 'border-red-500/50 border-2' : 'border-border/50'}`}
                  onClick={() => setSelectedRequest(request)}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <User className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-lg">{request.name}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.priority)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {format(new Date(request.created_at), "dd MMM", { locale: ru })}
                        <br />
                        {format(new Date(request.created_at), "HH:mm")}
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <a
                          href={`tel:${request.phone}`}
                          className="text-primary hover:underline font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {request.phone}
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{request.address}</span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded">
                      {request.message}
                    </p>

                    {/* Accepted by info */}
                    {request.accepted_employee && (
                      <div className="flex items-center gap-2 text-sm p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <HandMetal className="h-4 w-4 text-green-600" />
                        <span className="font-medium text-green-700 dark:text-green-400">
                          {request.accepted_employee.full_name}
                        </span>
                        {request.accepted_at && (
                          <span className="text-muted-foreground">
                            • {format(new Date(request.accepted_at), "dd.MM HH:mm")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2 border-t">
                      {request.status === "pending" && (
                        <Button
                          size="sm"
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Подробнее
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            startEdit(request);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                      {product.name} - {product.price.toFixed(0)} ₽/{product.unit}
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
                step="0.1"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (newItem.product_id) {
                  const product = products?.find(p => p.id === newItem.product_id);
                  if (product) {
                    setRequestItems([
                      ...requestItems,
                      {
                        product_id: newItem.product_id,
                        quantity: newItem.quantity,
                        price: product.price,
                      },
                    ]);
                    setShowProductDialog(false);
                    setNewItem({ product_id: "", quantity: 1 });
                  }
                }
              }}
              disabled={!newItem.product_id}
            >
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestsManager;
