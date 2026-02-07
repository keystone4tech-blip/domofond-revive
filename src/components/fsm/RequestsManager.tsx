import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Package,
  Eye,
  Banknote,
  Calendar,
  ClipboardCheck
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
  product?: { id: string; name: string; unit: string; category: string | null };
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
  const [activeTab, setActiveTab] = useState("pending");
  
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

  // Fetch all requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(`
          *,
          assigned_employee:employees!requests_assigned_to_fkey (id, full_name, phone),
          accepted_employee:employees!requests_accepted_by_fkey (id, full_name, phone)
        `)
        .order("created_at", { ascending: false });

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

  // Fetch request items for all requests
  const { data: allRequestItems } = useQuery({
    queryKey: ["all-request-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_items")
        .select(`
          *,
          product:products (id, name, unit, category)
        `);
      if (error) throw error;
      return data as RequestItem[];
    },
  });

  // Fetch employees
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

  // Calculate request sum with items
  const getRequestSum = (requestId: string) => {
    const items = allRequestItems?.filter(i => i.request_id === requestId) || [];
    let serviceSum = 0;
    let productSum = 0;
    
    items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      if (item.product?.category === "Товар" || item.product?.category === "товар") {
        productSum += itemTotal;
      } else {
        serviceSum += itemTotal;
      }
    });
    
    return { serviceSum, productSum, total: serviceSum + productSum, items };
  };

  // Get filtered requests by status
  const pendingRequests = useMemo(() => 
    requests?.filter(r => r.status === "pending") || [], [requests]);
  const inProgressRequests = useMemo(() => 
    requests?.filter(r => r.status === "in_progress") || [], [requests]);
  const completedRequests = useMemo(() => 
    requests?.filter(r => r.status === "completed") || [], [requests]);
  const cancelledRequests = useMemo(() => 
    requests?.filter(r => r.status === "cancelled") || [], [requests]);

  // Get masters with active requests
  const mastersWithRequests = useMemo(() => {
    const masterMap = new Map<string, { employee: Employee; requests: Request[] }>();
    
    requests?.forEach(req => {
      const empId = req.accepted_by;
      const emp = req.accepted_employee;
      if (empId && emp) {
        if (!masterMap.has(empId)) {
          masterMap.set(empId, { employee: emp, requests: [] });
        }
        masterMap.get(empId)!.requests.push(req);
      }
    });
    
    return Array.from(masterMap.values());
  }, [requests]);

  // Statistics
  const stats = {
    total: requests?.length || 0,
    pending: pendingRequests.length,
    inProgress: inProgressRequests.length,
    completed: completedRequests.length,
    cancelled: cancelledRequests.length,
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
      queryClient.invalidateQueries({ queryKey: ["all-request-items"] });
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
      let acceptNote = `✅ Принял: `;
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

  // Render request card
  const renderRequestCard = (request: Request) => {
    const { serviceSum, productSum, total, items } = getRequestSum(request.id);
    
    return (
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
              <Calendar className="h-3 w-3 inline mr-1" />
              {format(new Date(request.created_at), "dd.MM.yy HH:mm")}
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary flex-shrink-0" />
              <a
                href={`tel:${request.phone}`}
                className="text-primary hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
              >
                {request.phone}
              </a>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{request.address}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded">
            {request.message}
          </p>

          {/* Items and sum */}
          {items.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-400">Товары/услуги ({items.length})</span>
              </div>
              <div className="space-y-1">
                {items.slice(0, 3).map(item => (
                  <div key={item.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[60%]">{item.product?.name}</span>
                    <span>{item.quantity} × {item.price.toFixed(0)} ₽</span>
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-xs text-muted-foreground">+ ещё {items.length - 3}</div>
                )}
              </div>
              <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
                <div className="flex gap-3 text-xs">
                  {serviceSum > 0 && <span>Услуги: {serviceSum.toFixed(0)} ₽</span>}
                  {productSum > 0 && <span>Товары: {productSum.toFixed(0)} ₽</span>}
                </div>
                <div className="flex items-center gap-1 text-sm font-bold text-blue-700 dark:text-blue-400">
                  <Banknote className="h-3 w-3" />
                  {total.toFixed(0)} ₽
                </div>
              </div>
            </div>
          )}

          {/* Accepted by info */}
          {request.accepted_employee && (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <HandMetal className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  Принял: {request.accepted_employee.full_name}
                </span>
              </div>
              {request.accepted_at && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(request.accepted_at), "dd.MM.yyyy HH:mm")}
                </div>
              )}
              {request.accepted_employee.phone && (
                <div className="text-xs">
                  <a 
                    href={`tel:${request.accepted_employee.phone}`} 
                    className="text-green-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {request.accepted_employee.phone}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Completed info */}
          {request.completed_at && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded">
              <div className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Выполнено: {format(new Date(request.completed_at), "dd.MM.yyyy HH:mm")}
                </span>
              </div>
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
                <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto">
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
    );
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
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${activeTab === 'all' ? 'border-primary' : ''}`} onClick={() => setActiveTab("all")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Всего</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${activeTab === 'pending' ? 'border-yellow-500' : ''}`} onClick={() => setActiveTab("pending")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Ожидают</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${activeTab === 'in_progress' ? 'border-blue-500' : ''}`} onClick={() => setActiveTab("in_progress")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">В работе</div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${activeTab === 'completed' ? 'border-green-500' : ''}`} onClick={() => setActiveTab("completed")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Выполнено</div>
          </CardContent>
        </Card>
        <Card className={`${stats.urgent > 0 ? 'border-red-500' : ''}`}>
          <CardContent className="p-4 text-center">
            <div className={`text-2xl font-bold ${stats.urgent > 0 ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`}>{stats.urgent}</div>
            <div className="text-xs text-muted-foreground">Срочных</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="pending" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Новые</span>
              <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">В работе</span>
              <Badge variant="secondary" className="ml-1">{stats.inProgress}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Выполнено</span>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="flex items-center gap-1">
              <CircleDashed className="h-4 w-4" />
              <span className="hidden sm:inline">Отменено</span>
              {stats.cancelled > 0 && <Badge variant="secondary" className="ml-1">{stats.cancelled}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="masters" className="flex items-center gap-1">
              <HandMetal className="h-4 w-4" />
              <span className="hidden sm:inline">Мастера</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1">
              <Banknote className="h-4 w-4" />
              <span className="hidden sm:inline">Отчёты</span>
            </TabsTrigger>
          </TabsList>

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

                {/* Products section */}
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

        {/* Pending Requests */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Новые заявки
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет новых заявок
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(renderRequestCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* In Progress Requests */}
        <TabsContent value="in_progress" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                В работе
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inProgressRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет заявок в работе
                </div>
              ) : (
                <div className="space-y-3">
                  {inProgressRequests.map(renderRequestCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Completed Requests */}
        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Выполненные заявки
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет выполненных заявок
                </div>
              ) : (
                <div className="space-y-3">
                  {completedRequests.map(renderRequestCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cancelled Requests */}
        <TabsContent value="cancelled" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CircleDashed className="h-5 w-5 text-gray-500" />
                Отменённые заявки
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cancelledRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Нет отменённых заявок
                </div>
              ) : (
                <div className="space-y-3">
                  {cancelledRequests.map(renderRequestCard)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Masters with Requests */}
        <TabsContent value="masters" className="mt-4">
          <div className="space-y-4">
            {mastersWithRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Нет мастеров с активными заявками
                </CardContent>
              </Card>
            ) : (
              mastersWithRequests.map(({ employee, requests: masterRequests }) => (
                <Card key={employee.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HandMetal className="h-5 w-5 text-primary" />
                        {employee.full_name}
                      </div>
                      <Badge variant="secondary">{masterRequests.length} заявок</Badge>
                    </CardTitle>
                    {employee.phone && (
                      <a href={`tel:${employee.phone}`} className="text-sm text-primary hover:underline">
                        {employee.phone}
                      </a>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {masterRequests.map(renderRequestCard)}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-4">
          <EmployeeFinancialReports 
            allRequests={requests || []} 
            allRequestItems={allRequestItems || []}
            employees={employees || []}
          />
        </TabsContent>
      </Tabs>

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

// Employee Financial Reports Component - Updated to show all employees
interface EmployeeFinancialReportsProps {
  allRequests: Request[];
  allRequestItems: RequestItem[];
  employees: Employee[];
}

const EmployeeFinancialReports = ({ allRequests, allRequestItems, employees }: EmployeeFinancialReportsProps) => {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return format(d, "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  // Filter requests by date
  const filteredByDate = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59);
    
    return allRequests.filter(r => {
      const createdDate = new Date(r.created_at);
      return createdDate >= from && createdDate <= to;
    });
  }, [allRequests, dateFrom, dateTo]);

  // Filter by employee if selected
  const filteredRequests = useMemo(() => {
    if (selectedEmployee === "all") return filteredByDate;
    return filteredByDate.filter(r => r.accepted_by === selectedEmployee);
  }, [filteredByDate, selectedEmployee]);

  // Overall statistics
  const overallStats = useMemo(() => {
    const completed = filteredRequests.filter(r => r.status === "completed");
    const cancelled = filteredRequests.filter(r => r.status === "cancelled");
    const pending = filteredRequests.filter(r => r.status === "pending");
    const inProgress = filteredRequests.filter(r => r.status === "in_progress");
    
    let totalServices = 0;
    let totalProducts = 0;
    
    completed.forEach(req => {
      const items = allRequestItems.filter(i => i.request_id === req.id);
      items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        if (item.product?.category === "Товар" || item.product?.category === "товар") {
          totalProducts += itemTotal;
        } else {
          totalServices += itemTotal;
        }
      });
    });
    
    return {
      total: filteredRequests.length,
      completed: completed.length,
      cancelled: cancelled.length,
      pending: pending.length,
      inProgress: inProgress.length,
      totalServices,
      totalProducts,
      grandTotal: totalServices + totalProducts,
    };
  }, [filteredRequests, allRequestItems]);

  // Calculate totals by employee
  const employeeStats = useMemo(() => {
    const stats: Record<string, {
      name: string;
      phone: string | null;
      completedCount: number;
      cancelledCount: number;
      inProgressCount: number;
      serviceSum: number;
      productSum: number;
      total: number;
    }> = {};

    // Initialize all employees
    employees.forEach(emp => {
      stats[emp.id] = {
        name: emp.full_name,
        phone: emp.phone,
        completedCount: 0,
        cancelledCount: 0,
        inProgressCount: 0,
        serviceSum: 0,
        productSum: 0,
        total: 0,
      };
    });

    // Process requests
    filteredByDate.forEach(req => {
      if (!req.accepted_by) return;
      
      const empId = req.accepted_by;
      if (!stats[empId] && req.accepted_employee) {
        stats[empId] = {
          name: req.accepted_employee.full_name,
          phone: req.accepted_employee.phone,
          completedCount: 0,
          cancelledCount: 0,
          inProgressCount: 0,
          serviceSum: 0,
          productSum: 0,
          total: 0,
        };
      }
      
      if (!stats[empId]) return;

      if (req.status === "completed") {
        stats[empId].completedCount++;
        
        const items = allRequestItems.filter(i => i.request_id === req.id);
        items.forEach(item => {
          const itemTotal = item.price * item.quantity;
          if (item.product?.category === "Товар" || item.product?.category === "товар") {
            stats[empId].productSum += itemTotal;
          } else {
            stats[empId].serviceSum += itemTotal;
          }
          stats[empId].total += itemTotal;
        });
      } else if (req.status === "cancelled") {
        stats[empId].cancelledCount++;
      } else if (req.status === "in_progress") {
        stats[empId].inProgressCount++;
      }
    });

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .filter(emp => emp.completedCount > 0 || emp.cancelledCount > 0 || emp.inProgressCount > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredByDate, allRequestItems, employees]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Финансовый отчёт по сотрудникам
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Период с</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-2">
              <Label>по</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Сотрудник</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все сотрудники</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards - Overall Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{overallStats.total}</div>
            <div className="text-xs text-muted-foreground">Всего заявок</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{overallStats.completed}</div>
            <div className="text-xs text-muted-foreground">Выполнено</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{overallStats.inProgress}</div>
            <div className="text-xs text-muted-foreground">В работе</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 dark:bg-gray-900/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{overallStats.cancelled}</div>
            <div className="text-xs text-muted-foreground">Отменено</div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{overallStats.totalServices.toFixed(0)} ₽</div>
            <div className="text-xs text-muted-foreground">Услуги (выполнено)</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 dark:bg-orange-900/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{overallStats.totalProducts.toFixed(0)} ₽</div>
            <div className="text-xs text-muted-foreground">Товары (выполнено)</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{overallStats.grandTotal.toFixed(0)} ₽</div>
            <div className="text-xs text-muted-foreground">Общая сумма</div>
          </CardContent>
        </Card>
      </div>

      {/* Employee breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Статистика по сотрудникам</CardTitle>
        </CardHeader>
        <CardContent>
          {employeeStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Нет данных за выбранный период
            </div>
          ) : (
            <div className="space-y-3">
              {employeeStats.map(employee => (
                <Card key={employee.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            <span className="font-semibold text-lg">{employee.name}</span>
                          </div>
                          {employee.phone && (
                            <a href={`tel:${employee.phone}`} className="text-sm text-muted-foreground hover:underline">
                              {employee.phone}
                            </a>
                          )}
                        </div>
                      </div>
                      
                      {/* Request counts */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Выполнено: {employee.completedCount}
                        </Badge>
                        {employee.inProgressCount > 0 && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            В работе: {employee.inProgressCount}
                          </Badge>
                        )}
                        {employee.cancelledCount > 0 && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                            <CircleDashed className="h-3 w-3 mr-1" />
                            Отменено: {employee.cancelledCount}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Financial breakdown */}
                      {employee.completedCount > 0 && (
                        <div className="flex flex-wrap gap-4">
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded min-w-[100px] text-center">
                            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">
                              {employee.serviceSum.toFixed(0)} ₽
                            </div>
                            <div className="text-xs text-muted-foreground">Услуги</div>
                          </div>
                          <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded min-w-[100px] text-center">
                            <div className="text-lg font-bold text-orange-700 dark:text-orange-400">
                              {employee.productSum.toFixed(0)} ₽
                            </div>
                            <div className="text-xs text-muted-foreground">Товары</div>
                          </div>
                          <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded min-w-[100px] text-center">
                            <div className="text-lg font-bold text-green-700 dark:text-green-400">
                              {employee.total.toFixed(0)} ₽
                            </div>
                            <div className="text-xs text-muted-foreground">Итого</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RequestsManager;
