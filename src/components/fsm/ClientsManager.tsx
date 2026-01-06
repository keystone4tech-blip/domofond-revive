import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Loader2, MapPin, Phone, User } from "lucide-react";

interface Client {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  contact_person: string | null;
  notes: string | null;
  created_at: string;
}

const ClientsManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    contact_person: "",
    notes: "",
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Client[];
    },
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("clients").insert({
        name: data.name,
        address: data.address,
        phone: data.phone || null,
        contact_person: data.contact_person || null,
        notes: data.notes || null,
        created_by: userData.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Клиент добавлен" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Client> & { id: string }) => {
      const { error } = await supabase
        .from("clients")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Данные обновлены" });
      setEditingClient(null);
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Клиент удален" });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      phone: "",
      contact_person: "",
      notes: "",
    });
    setEditingClient(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClient) {
      updateClientMutation.mutate({
        id: editingClient.id,
        name: formData.name,
        address: formData.address,
        phone: formData.phone || null,
        contact_person: formData.contact_person || null,
        notes: formData.notes || null,
      });
    } else {
      createClientMutation.mutate(formData);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Клиенты / Объекты</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); }}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Редактировать клиента" : "Новый клиент"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="ЖК Солнечный, Офис Компании..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Адрес *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  placeholder="г. Москва, ул. Примерная, д. 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+7 (999) 123-45-67"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_person">Контактное лицо</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Заметки</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Дополнительная информация..."
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createClientMutation.isPending || updateClientMutation.isPending}
              >
                {(createClientMutation.isPending || updateClientMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingClient ? "Сохранить" : "Создать"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : clients?.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Нет клиентов</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Контакт</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients?.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[200px]">{client.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {client.contact_person && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {client.contact_person}
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {client.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingClient(client);
                          setFormData({
                            name: client.name,
                            address: client.address,
                            phone: client.phone || "",
                            contact_person: client.contact_person || "",
                            notes: client.notes || "",
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteClientMutation.mutate(client.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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

export default ClientsManager;
