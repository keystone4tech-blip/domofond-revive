import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Phone, User, Building2, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Calculation {
  id: string;
  name: string;
  phone: string;
  entrances: number;
  total_apartments: number;
  smart_intercoms: number;
  additional_cameras: number;
  elevator_cameras: number;
  gates: number;
  tariff_per_apt: number;
  is_individual: boolean;
  created_at: string;
  tariff_details?: any;
}

export const CalculationsManager = () => {
  const { toast } = useToast();
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalculations();

    const channel = supabase
      .channel("calculations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "calculations" }, () => {
        fetchCalculations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCalculations = async () => {
    const { data, error } = await supabase
      .from("calculations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setCalculations(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("calculations").delete().eq("id", id);
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Удалено" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Расчёты ({calculations.length})</h2>
          <p className="text-sm text-muted-foreground">
            Сюда автоматически приходят заявки из калькулятора с контактами и параметрами дома.
          </p>
        </div>
      </div>

      {calculations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Расчётов пока нет
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {calculations.map((calc) => (
            <Card key={calc.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <User className="h-4 w-4 text-primary" />
                        {calc.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <a href={`tel:${calc.phone}`} className="hover:text-primary">{calc.phone}</a>
                      </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(calc.created_at), "dd MMM yyyy, HH:mm", { locale: ru })}
                        </div>
                      </div>

                      {calc.tariff_details?.address_info && (
                        <div className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/5 p-2 rounded-md border border-primary/10">
                          <Building2 className="h-4 w-4" />
                          <span>
                            {calc.tariff_details.address_info.city}, ул. {calc.tariff_details.address_info.street}, {calc.tariff_details.address_info.house}
                            {calc.tariff_details.address_info.block && ` (корп. ${calc.tariff_details.address_info.block})`}
                          </span>
                        </div>
                      )}

                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {calc.entrances} подъ. / {calc.total_apartments} кв.
                      </Badge>
                      {calc.smart_intercoms > 0 && <Badge variant="secondary">Домофоны: {calc.smart_intercoms}</Badge>}
                      {calc.additional_cameras > 0 && <Badge variant="secondary">Доп. камеры: {calc.additional_cameras}</Badge>}
                      {calc.elevator_cameras > 0 && <Badge variant="secondary">Лифт. камеры: {calc.elevator_cameras}</Badge>}
                      {calc.gates > 0 && <Badge variant="secondary">Калитки: {calc.gates}</Badge>}
                    </div>

                    <div className="text-sm font-semibold">
                      {calc.is_individual ? (
                        <span className="text-amber-600">Индивидуальный расчёт</span>
                      ) : (
                        <span className="text-primary">Тариф: {calc.tariff_per_apt} ₽/кв/мес</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {calc.tariff_details?.cp_url && (
                      <Button 
                        asChild 
                        variant="outline" 
                        size="sm" 
                        className="gap-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                      >
                        <a href={calc.tariff_details.cp_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4" />
                          КП
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(calc.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
