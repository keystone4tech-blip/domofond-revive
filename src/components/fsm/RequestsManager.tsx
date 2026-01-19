import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
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
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  CircleDashed
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Request {
  id: string;
  name: string;
  phone: string;
  address: string;
  message: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  completed_at: string | null;
  notes: string | null;
}

const RequestsManager = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Обновляем состояние при изменении фильтров
  useEffect(() => {
    fetchRequests();
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (id: string, status: Request['status']) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          status,
          updated_at: new Date().toISOString(),
          ...(status === 'completed' && { completed_at: new Date().toISOString() })
        })
        .eq('id', id);

      if (error) throw error;

      // Обновляем локальный стейт
      setRequests(requests.map(req => 
        req.id === id ? { ...req, status, updated_at: new Date().toISOString() } : req
      ));
    } catch (error) {
      console.error('Error updating request status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
      pending: { 
        label: 'Ожидает', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
        icon: Clock 
      },
      in_progress: { 
        label: 'В работе', 
        color: 'bg-blue-100 text-blue-800 border-blue-200', 
        icon: AlertCircle 
      },
      completed: { 
        label: 'Выполнено', 
        color: 'bg-green-100 text-green-800 border-green-200', 
        icon: CheckCircle2 
      },
      cancelled: { 
        label: 'Отменено', 
        color: 'bg-gray-100 text-gray-800 border-gray-200', 
        icon: CircleDashed 
      }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { label: string; color: string }> = {
      low: { label: 'Низкий', color: 'bg-gray-100 text-gray-800 border-gray-200' },
      medium: { label: 'Средний', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      high: { label: 'Высокий', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      urgent: { label: 'Срочный', color: 'bg-red-100 text-red-800 border-red-200' }
    };

    const config = priorityConfig[priority] || priorityConfig.medium;

    return (
      <Badge variant="outline" className={`${config.color}`}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Загрузка заявок...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-2xl font-bold">Заявки</h2>
        
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
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

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Приоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              <SelectItem value="low">Низкий</SelectItem>
              <SelectItem value="medium">Средний</SelectItem>
              <SelectItem value="high">Высокий</SelectItem>
              <SelectItem value="urgent">Срочный</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Сообщение</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Приоритет</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Нет заявок
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span>{request.name}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {request.phone}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {request.address}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-sm">
                        {request.message}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(request.created_at), 'dd MMM yyyy', { locale: ru })}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), 'HH:mm', { locale: ru })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(request.status)}
                    </TableCell>
                    <TableCell>
                      {getPriorityBadge(request.priority)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedRequest(request);
                            setIsDetailOpen(true);
                          }}>
                            Просмотреть
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateRequestStatus(request.id, 'in_progress')}>
                            Принять в работу
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateRequestStatus(request.id, 'completed')}>
                            Отметить как выполнено
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Детали заявки */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали заявки</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Клиент</h4>
                  <p className="font-medium">{selectedRequest.name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Телефон</h4>
                  <a href={`tel:${selectedRequest.phone}`} className="text-primary hover:underline flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {selectedRequest.phone}
                  </a>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Адрес</h4>
                  <p className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {selectedRequest.address}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Дата создания</h4>
                  <p>{format(new Date(selectedRequest.created_at), 'dd MMM yyyy HH:mm', { locale: ru })}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Сообщение</h4>
                <p className="whitespace-pre-wrap">{selectedRequest.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Статус</h4>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Приоритет</h4>
                  <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => updateRequestStatus(selectedRequest.id, 'in_progress')}
                  variant="outline"
                >
                  Принять в работу
                </Button>
                <Button 
                  onClick={() => updateRequestStatus(selectedRequest.id, 'completed')}
                >
                  Отметить как выполнено
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestsManager;