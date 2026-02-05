 import { useState } from "react";
 import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Checkbox } from "@/components/ui/checkbox";
 import { Badge } from "@/components/ui/badge";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import {
   ArrowLeft,
   MapPin,
   User,
   Calendar,
   Clock,
   Plus,
   Camera,
   CheckCircle2,
   Loader2,
   Phone,
   Package,
   Trash2,
   HandMetal,
   Edit,
   FileText,
 } from "lucide-react";
 import { format } from "date-fns";
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
 
 interface ChecklistItem {
   id: string;
   request_id: string;
   item_text: string;
   is_completed: boolean;
   completed_at: string | null;
   order_index: number;
 }
 
 interface Photo {
   id: string;
   request_id: string;
   photo_url: string;
   caption: string | null;
   created_at: string;
 }
 
 interface RequestDetailsProps {
   request: Request;
   onBack: () => void;
   isManager: boolean;
 }
 
 const RequestDetails = ({ request, onBack, isManager }: RequestDetailsProps) => {
   const { toast } = useToast();
   const queryClient = useQueryClient();
   const [newChecklistItem, setNewChecklistItem] = useState("");
   const [showProductDialog, setShowProductDialog] = useState(false);
   const [newItem, setNewItem] = useState({ product_id: "", quantity: 1 });
   const [workNotes, setWorkNotes] = useState("");
   const [showWorkNotesDialog, setShowWorkNotesDialog] = useState(false);
 
   // Check if current user is the one who accepted this request
   const { data: currentEmployee } = useQuery({
     queryKey: ["current-employee"],
     queryFn: async () => {
       const { data: userData } = await supabase.auth.getUser();
       if (!userData.user) return null;
       const { data, error } = await supabase
         .from("employees")
         .select("id, full_name")
         .eq("user_id", userData.user.id)
         .maybeSingle();
       if (error) return null;
       return data;
     },
   });
 
   const isAcceptedByMe = currentEmployee?.id === request.accepted_by;
   const canEdit = request.status === "in_progress" && (isAcceptedByMe || isManager);
 
   // Fetch products
   const { data: products } = useQuery({
     queryKey: ["products-active"],
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
 
   // Fetch request items
   const { data: requestItems } = useQuery({
     queryKey: ["request-items", request.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("request_items")
         .select(`
           *,
           product:products (id, name, unit)
         `)
         .eq("request_id", request.id);
       if (error) throw error;
       return data as RequestItem[];
     },
   });
 
   // Fetch checklist - using task_checklists table but we'll filter by checking if request notes contain task info
   // For requests we'll store checklist in notes or create a separate request_checklists approach
   // For simplicity, we'll use a JSON approach stored in notes field
   const { data: checklist, refetch: refetchChecklist } = useQuery({
     queryKey: ["request-checklist", request.id],
     queryFn: async () => {
       // Parse checklist from notes if it exists
       try {
         const notesData = request.notes ? JSON.parse(request.notes) : null;
         if (notesData?.checklist) {
           return notesData.checklist as ChecklistItem[];
         }
       } catch {
         // Notes is not JSON, that's ok
       }
       return [] as ChecklistItem[];
     },
   });
 
   // Fetch photos - we'll store them in the same storage bucket
   const { data: photos } = useQuery({
     queryKey: ["request-photos", request.id],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("task_photos")
         .select("*")
         .eq("task_id", request.id)
         .order("created_at", { ascending: false });
       if (error) throw error;
       return data as unknown as Photo[];
     },
   });
 
   // Complete request mutation
   const completeRequestMutation = useMutation({
     mutationFn: async () => {
       const now = new Date();
       
       // Get existing notes
       const { data: currentRequest } = await supabase
         .from("requests")
         .select("notes")
         .eq("id", request.id)
         .single();
 
       let finalNotes = currentRequest?.notes || "";
       
       // Add work completion info
       if (workNotes.trim()) {
         finalNotes += `\n\n--- Отчёт о выполнении ---\n${workNotes}`;
       }
       finalNotes += `\n\nВыполнено: ${format(now, "dd.MM.yyyy HH:mm")}`;
 
       const { error } = await supabase
         .from("requests")
         .update({
           status: "completed",
           completed_at: now.toISOString(),
           notes: finalNotes,
         })
         .eq("id", request.id);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["requests"] });
       toast({ title: "Заявка выполнена" });
       setShowWorkNotesDialog(false);
       onBack();
     },
   });
 
   // Accept request mutation
   const acceptRequestMutation = useMutation({
     mutationFn: async () => {
       const { data: userData } = await supabase.auth.getUser();
       if (!userData.user) throw new Error("Не авторизован");
 
       const { data: employee } = await supabase
         .from("employees")
         .select("id, full_name, phone")
         .eq("user_id", userData.user.id)
         .maybeSingle();
 
       const now = new Date();
 
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
         .eq("id", request.id);
 
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["requests"] });
       toast({ title: "Заявка принята в работу" });
     },
   });
 
   // Add item mutation
   const addItemMutation = useMutation({
     mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
       const product = products?.find(p => p.id === productId);
       if (!product) throw new Error("Товар не найден");
 
       const { error } = await supabase
         .from("request_items")
         .insert({
           request_id: request.id,
           product_id: productId,
           quantity,
           price: product.price,
         });
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["request-items", request.id] });
       toast({ title: "Товар добавлен" });
       setShowProductDialog(false);
       setNewItem({ product_id: "", quantity: 1 });
     },
   });
 
   // Delete item mutation
   const deleteItemMutation = useMutation({
     mutationFn: async (itemId: string) => {
       const { error } = await supabase.from("request_items").delete().eq("id", itemId);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["request-items", request.id] });
       toast({ title: "Товар удален" });
     },
   });
 
   // Upload photo mutation
   const uploadPhotoMutation = useMutation({
     mutationFn: async (file: File) => {
       const { data: userData } = await supabase.auth.getUser();
       const fileName = `requests/${request.id}/${Date.now()}_${file.name}`;
 
       const { error: uploadError } = await supabase.storage
         .from("news")
         .upload(fileName, file);
 
       if (uploadError) throw uploadError;
 
       const { data: urlData } = supabase.storage
         .from("news")
         .getPublicUrl(fileName);
 
       // Store in task_photos but using request_id as task_id for now
       const { error: dbError } = await supabase.from("task_photos").insert({
         task_id: request.id,
         photo_url: urlData.publicUrl,
         uploaded_by: userData.user?.id,
       });
 
       if (dbError) throw dbError;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["request-photos", request.id] });
       toast({ title: "Фото загружено" });
     },
     onError: (error: Error) => {
       toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
     },
   });
 
   // Update notes mutation
   const updateNotesMutation = useMutation({
     mutationFn: async (notes: string) => {
       const { data: current } = await supabase
         .from("requests")
         .select("notes")
         .eq("id", request.id)
         .single();
 
       const existingNotes = current?.notes || "";
       const newNotes = existingNotes + (existingNotes ? "\n\n" : "") + notes;
 
       const { error } = await supabase
         .from("requests")
         .update({ notes: newNotes })
         .eq("id", request.id);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["requests"] });
       toast({ title: "Заметка добавлена" });
       setWorkNotes("");
     },
   });
 
   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
       uploadPhotoMutation.mutate(file);
     }
   };
 
   const getStatusBadge = (status: string) => {
     const config: Record<string, { label: string; color: string }> = {
       pending: { label: "Ожидает", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
       in_progress: { label: "В работе", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
       completed: { label: "Выполнено", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
       cancelled: { label: "Отменено", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
     };
     const cfg = config[status] || config.pending;
     return <Badge variant="secondary" className={cfg.color}>{cfg.label}</Badge>;
   };
 
   const getPriorityBadge = (priority: string) => {
     const config: Record<string, { label: string; color: string }> = {
       low: { label: "Низкий", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
       medium: { label: "Средний", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
       high: { label: "Высокий", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
       urgent: { label: "Срочно!", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
     };
     const cfg = config[priority] || config.medium;
     return <Badge variant="secondary" className={cfg.color}>{cfg.label}</Badge>;
   };
 
   const calculateTotal = (items: RequestItem[]) => {
     return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
   };
 
   return (
     <div className="space-y-4">
       {/* Header with back button */}
       <div className="flex items-center justify-between">
         <Button variant="ghost" onClick={onBack} className="p-2">
           <ArrowLeft className="h-5 w-5 mr-2" />
           Назад
         </Button>
       </div>
 
       {/* Main Info Card */}
       <Card className="border-border/50">
         <CardHeader className="pb-3">
           <div className="flex flex-wrap items-center gap-2">
             {getStatusBadge(request.status)}
             {getPriorityBadge(request.priority)}
           </div>
         </CardHeader>
         <CardContent className="space-y-4">
           {/* Client Info */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="space-y-1">
               <Label className="text-xs text-muted-foreground">Клиент</Label>
               <p className="font-semibold text-lg flex items-center gap-2">
                 <User className="h-4 w-4 text-primary" />
                 {request.name}
               </p>
             </div>
             <div className="space-y-1">
               <Label className="text-xs text-muted-foreground">Телефон</Label>
               <a
                 href={`tel:${request.phone}`}
                 className="font-semibold text-lg text-primary flex items-center gap-2 hover:underline"
               >
                 <Phone className="h-4 w-4" />
                 {request.phone}
               </a>
             </div>
           </div>
 
           {/* Address */}
           <div className="space-y-1">
             <Label className="text-xs text-muted-foreground">Адрес</Label>
             <p className="flex items-center gap-2">
               <MapPin className="h-4 w-4 text-primary" />
               {request.address}
             </p>
           </div>
 
           {/* Description */}
           <div className="space-y-1">
             <Label className="text-xs text-muted-foreground">Описание проблемы</Label>
             <p className="bg-muted/50 p-3 rounded-lg whitespace-pre-wrap">{request.message}</p>
           </div>
 
           {/* Timestamps */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
             <div className="flex items-center gap-2 text-sm">
               <Calendar className="h-4 w-4 text-muted-foreground" />
               <div>
                 <div className="text-xs text-muted-foreground">Создано</div>
                 <div>{format(new Date(request.created_at), "dd MMM yyyy, HH:mm", { locale: ru })}</div>
               </div>
             </div>
             {request.accepted_at && (
               <div className="flex items-center gap-2 text-sm">
                 <Clock className="h-4 w-4 text-blue-500" />
                 <div>
                   <div className="text-xs text-muted-foreground">Принято</div>
                   <div>{format(new Date(request.accepted_at), "dd MMM yyyy, HH:mm", { locale: ru })}</div>
                 </div>
               </div>
             )}
             {request.completed_at && (
               <div className="flex items-center gap-2 text-sm">
                 <CheckCircle2 className="h-4 w-4 text-green-500" />
                 <div>
                   <div className="text-xs text-muted-foreground">Выполнено</div>
                   <div>{format(new Date(request.completed_at), "dd MMM yyyy, HH:mm", { locale: ru })}</div>
                 </div>
               </div>
             )}
           </div>
 
           {/* Accepted by info */}
           {request.accepted_employee && (
             <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
               <div className="flex items-center gap-2">
                 <HandMetal className="h-5 w-5 text-green-600" />
                 <div>
                   <div className="text-xs text-green-700 dark:text-green-400">Принял в работу</div>
                   <div className="font-semibold">{request.accepted_employee.full_name}</div>
                   {request.accepted_employee.phone && (
                     <a href={`tel:${request.accepted_employee.phone}`} className="text-sm text-primary">
                       {request.accepted_employee.phone}
                     </a>
                   )}
                 </div>
               </div>
             </div>
           )}
 
           {/* Action buttons */}
           <div className="flex flex-wrap gap-2 pt-2">
             {request.status === "pending" && (
               <Button
                 onClick={() => acceptRequestMutation.mutate()}
                 disabled={acceptRequestMutation.isPending}
                 className="flex-1 sm:flex-none"
               >
                 {acceptRequestMutation.isPending ? (
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 ) : (
                   <HandMetal className="h-4 w-4 mr-2" />
                 )}
                 Принять в работу
               </Button>
             )}
             {request.status === "in_progress" && canEdit && (
               <Button
                 onClick={() => setShowWorkNotesDialog(true)}
                 className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
               >
                 <CheckCircle2 className="h-4 w-4 mr-2" />
                 Завершить заявку
               </Button>
             )}
           </div>
         </CardContent>
       </Card>
 
       {/* Work Notes - показываем если заявка принята */}
       {(request.status === "in_progress" || request.status === "completed") && request.notes && (
         <Card className="border-border/50">
           <CardHeader className="pb-2">
             <CardTitle className="text-lg flex items-center gap-2">
               <FileText className="h-5 w-5" />
               Информация о работе
             </CardTitle>
           </CardHeader>
           <CardContent>
             <p className="whitespace-pre-wrap text-sm bg-muted/30 p-3 rounded-lg">{request.notes}</p>
           </CardContent>
         </Card>
       )}
 
       {/* Products Section */}
       <Card className="border-border/50">
         <CardHeader className="pb-2">
           <div className="flex items-center justify-between">
             <CardTitle className="text-lg flex items-center gap-2">
               <Package className="h-5 w-5" />
               Товары и услуги
             </CardTitle>
             {canEdit && (
               <Button size="sm" variant="outline" onClick={() => setShowProductDialog(true)}>
                 <Plus className="h-4 w-4 mr-1" />
                 Добавить
               </Button>
             )}
           </div>
         </CardHeader>
         <CardContent>
           {requestItems && requestItems.length > 0 ? (
             <div className="space-y-2">
               {requestItems.map(item => (
                 <div
                   key={item.id}
                   className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                 >
                   <div>
                     <span className="font-medium">{item.product?.name}</span>
                     <span className="text-muted-foreground ml-2 text-sm">
                       {item.quantity} {item.product?.unit} × {item.price.toFixed(0)} ₽
                     </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold">{(item.price * item.quantity).toFixed(0)} ₽</span>
                     {canEdit && (
                       <Button
                         size="icon"
                         variant="ghost"
                         className="h-8 w-8 text-destructive"
                         onClick={() => deleteItemMutation.mutate(item.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
                     )}
                   </div>
                 </div>
               ))}
               <div className="flex justify-between pt-3 border-t mt-3">
                 <span className="font-bold text-lg">Итого:</span>
                 <span className="font-bold text-lg text-primary">
                   {calculateTotal(requestItems).toFixed(0)} ₽
                 </span>
               </div>
             </div>
           ) : (
             <p className="text-sm text-muted-foreground text-center py-4">
               Нет добавленных товаров или услуг
             </p>
           )}
         </CardContent>
       </Card>
 
       {/* Photo Report - только для принятых заявок */}
       {(request.status === "in_progress" || request.status === "completed") && (
         <Card className="border-border/50">
           <CardHeader className="pb-2">
             <div className="flex items-center justify-between">
               <CardTitle className="text-lg flex items-center gap-2">
                 <Camera className="h-5 w-5" />
                 Фотоотчёт
               </CardTitle>
               {canEdit && (
                 <div>
                   <input
                     type="file"
                     accept="image/*"
                     onChange={handleFileChange}
                     className="hidden"
                     id="request-photo-upload"
                   />
                   <label htmlFor="request-photo-upload">
                     <Button asChild size="sm" variant="outline" disabled={uploadPhotoMutation.isPending}>
                       <span>
                         {uploadPhotoMutation.isPending ? (
                           <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                         ) : (
                           <Plus className="h-4 w-4 mr-1" />
                         )}
                         Добавить фото
                       </span>
                     </Button>
                   </label>
                 </div>
               )}
             </div>
           </CardHeader>
           <CardContent>
             {photos && photos.length > 0 ? (
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                 {photos.map((photo) => (
                   <div
                     key={photo.id}
                     className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
                     onClick={() => window.open(photo.photo_url, "_blank")}
                   >
                     <img
                       src={photo.photo_url}
                       alt="Фото работы"
                       className="w-full h-full object-cover hover:scale-105 transition-transform"
                     />
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-sm text-muted-foreground text-center py-4">
                 Нет фотографий
               </p>
             )}
           </CardContent>
         </Card>
       )}
 
       {/* Add Work Notes on Complete Dialog */}
       <Dialog open={showWorkNotesDialog} onOpenChange={setShowWorkNotesDialog}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Завершить заявку</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div className="space-y-2">
               <Label>Отчёт о выполненной работе</Label>
               <Textarea
                 placeholder="Опишите выполненную работу..."
                 value={workNotes}
                 onChange={(e) => setWorkNotes(e.target.value)}
                 rows={4}
               />
             </div>
             <div className="flex gap-2">
               <Button
                 variant="outline"
                 onClick={() => setShowWorkNotesDialog(false)}
                 className="flex-1"
               >
                 Отмена
               </Button>
               <Button
                 onClick={() => completeRequestMutation.mutate()}
                 disabled={completeRequestMutation.isPending}
                 className="flex-1 bg-green-600 hover:bg-green-700"
               >
                 {completeRequestMutation.isPending ? (
                   <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 ) : (
                   <CheckCircle2 className="h-4 w-4 mr-2" />
                 )}
                 Завершить
               </Button>
             </div>
           </div>
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
                   {products?.map((product) => (
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
                   addItemMutation.mutate({
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
 
 export default RequestDetails;