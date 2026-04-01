import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Trash2, Search, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Account {
  id: string;
  account_number: string;
  address: string;
  apartment: string | null;
  period: string;
  debt_amount: number;
  created_at: string;
}

export function AccountsManager() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadResult, setUploadResult] = useState<{ added: number; updated: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("address", { ascending: true })
      .limit(500);

    if (error) {
      console.error(error);
      toast({ title: "Ошибка", description: "Не удалось загрузить данные", variant: "destructive" });
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const parseAndUploadFile = async (file: File) => {
    setUploading(true);
    setUploadResult(null);

    try {
      const buffer = await file.arrayBuffer();
      // Try CP1251 first, then UTF-8
      let text: string;
      try {
        const decoder = new TextDecoder("windows-1251");
        text = decoder.decode(buffer);
        // Check if it looks like valid Cyrillic
        if (!text.includes("а") && !text.includes("е") && !text.includes("о")) {
          throw new Error("Not CP1251");
        }
      } catch {
        text = new TextDecoder("utf-8").decode(buffer);
      }

      const lines = text.trim().split("\n").filter(l => l.trim());
      const records: { account_number: string; address: string; apartment: string | null; period: string; debt_amount: number }[] = [];

      for (const line of lines) {
        const parts = line.trim().replace(/\r$/, "").split(";");
        if (parts.length < 5) continue;

        const accountNumber = parts[0].trim();
        const fullAddress = parts[2].trim();
        const period = parts[3].trim();
        const debtAmount = parseFloat(parts[4].replace(",", ".")) || 0;

        // Extract apartment from address
        const aptMatch = fullAddress.match(/кв\.\s*(\d+)/i);
        const apartment = aptMatch ? aptMatch[1] : null;

        records.push({
          account_number: accountNumber,
          address: fullAddress,
          apartment,
          period,
          debt_amount: debtAmount,
        });
      }

      if (records.length === 0) {
        toast({ title: "Ошибка", description: "Файл пустой или неверного формата", variant: "destructive" });
        setUploading(false);
        return;
      }

      // Delete existing records for this period, then insert new ones
      const period = records[0].period;
      
      // Batch delete existing period data
      await supabase.from("accounts").delete().eq("period", period);

      // Insert in batches of 500
      let added = 0;
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500);
        const { error } = await supabase.from("accounts").insert(batch);
        if (error) {
          console.error("Insert batch error:", error);
          throw error;
        }
        added += batch.length;
      }

      setUploadResult({ added, updated: 0 });
      toast({
        title: "Загружено",
        description: `Добавлено ${added} записей за период ${period}`,
      });
      loadAccounts();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка загрузки файла";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseAndUploadFile(file);
      e.target.value = "";
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Удалить все записи лицевых счетов?")) return;
    const { error } = await supabase.from("accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Удалено", description: "Все записи удалены" });
      setAccounts([]);
    }
  };

  const filteredAccounts = accounts.filter(a =>
    a.address.toLowerCase().includes(search.toLowerCase()) ||
    a.account_number.includes(search) ||
    (a.apartment && a.apartment.includes(search))
  );

  const formatPeriod = (period: string) => {
    if (period.length === 4) {
      const month = period.substring(0, 2);
      const year = "20" + period.substring(2);
      const months = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
      return `${months[parseInt(month)] || month} ${year}`;
    }
    return period;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Лицевые счета и задолженности
          </CardTitle>
          <CardDescription>
            Загрузите файл с данными в формате: лицевой_счёт;флаг;адрес;период;сумма (разделитель — точка с запятой, кодировка CP1251 или UTF-8)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? "Загрузка..." : "Загрузить файл"}
            </Button>
            {accounts.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleDeleteAll}>
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить все
              </Button>
            )}
          </div>

          {uploadResult && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Загружено: {uploadResult.added} записей
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по адресу, номеру счёта или квартире..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            Всего записей: {accounts.length} | Показано: {filteredAccounts.length}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredAccounts.slice(0, 100).map((account) => (
              <div key={account.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{account.account_number}</Badge>
                    <Badge variant="secondary" className="text-xs">{formatPeriod(account.period)}</Badge>
                  </div>
                  <p className="text-sm truncate">{account.address}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-bold ${account.debt_amount > 0 ? "text-destructive" : "text-green-600"}`}>
                    {account.debt_amount.toFixed(2)} ₽
                  </span>
                </div>
              </div>
            ))}
            {filteredAccounts.length > 100 && (
              <p className="text-sm text-center text-muted-foreground py-2">
                Показаны первые 100 из {filteredAccounts.length}. Используйте поиск для фильтрации.
              </p>
            )}
            {filteredAccounts.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {accounts.length === 0 ? "Нет загруженных данных. Загрузите файл с лицевыми счетами." : "Ничего не найдено"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
