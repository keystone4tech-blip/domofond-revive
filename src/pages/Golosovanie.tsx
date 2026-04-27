import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Vote, Calendar, MapPin, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Voting {
  id: string;
  title: string;
  description: string | null;
  voting_type: string;
  building_address: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  legal_basis: string | null;
}

interface Question {
  id: string;
  question_text: string;
  options: string[];
  order_index: number;
}

const Golosovanie = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [list, setList] = useState<Voting[]>([]);
  const [voting, setVoting] = useState<Voting | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Форма
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [apartment, setApartment] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (id) loadOne(id); else loadList();
  }, [id]);

  const loadList = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("votings")
      .select("*")
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    setList((data || []) as Voting[]);
    setLoading(false);
  };

  const loadOne = async (votingId: string) => {
    setLoading(true);
    const [{ data: v }, { data: q }] = await Promise.all([
      supabase.from("votings").select("*").eq("id", votingId).maybeSingle(),
      supabase.from("voting_questions").select("*").eq("voting_id", votingId).order("order_index"),
    ]);
    if (v) setVoting(v as Voting);
    setQuestions(((q || []) as any[]).map((x) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })));
    setLoading(false);
  };

  const requestCode = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      return toast({ title: "Введите телефон", variant: "destructive" });
    }
    setRequestingCode(true);
    const { data, error } = await supabase.functions.invoke("voting-submit", {
      body: { action: "request_code", voting_id: voting?.id, phone },
    });
    setRequestingCode(false);
    if (error || (data as any)?.error) {
      return toast({ title: "Ошибка", description: error?.message || (data as any)?.error, variant: "destructive" });
    }
    setCodeRequested(true);
    // Dev: показываем код в toast пока нет SMS-провайдера
    if ((data as any)?.dev_code) {
      toast({ title: "Код отправлен (DEV)", description: `Ваш код: ${(data as any).dev_code}` });
    } else {
      toast({ title: "Код отправлен на телефон" });
    }
  };

  const submit = async () => {
    if (!isOwner) return toast({ title: "Подтвердите статус собственника", variant: "destructive" });
    if (!fullName || !apartment || !code) return toast({ title: "Заполните все поля", variant: "destructive" });
    if (questions.some((q) => !answers[q.id])) return toast({ title: "Ответьте на все вопросы", variant: "destructive" });

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("voting-submit", {
      body: {
        action: "verify_and_submit",
        voting_id: voting?.id,
        phone, code,
        full_name: fullName,
        apartment,
        area_sqm: areaSqm || null,
        is_owner_confirmed: true,
        answers: Object.entries(answers).map(([question_id, selected_option]) => ({ question_id, selected_option })),
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      return toast({ title: "Ошибка", description: error?.message || (data as any)?.error, variant: "destructive" });
    }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  // ============ СПИСОК ============
  if (!id) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Vote className="h-7 w-7 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">Электронные голосования</h1>
            </div>
            <p className="text-muted-foreground mb-8">
              Платформа для проведения общих собраний собственников (ОСС) и опросов жителей ЖК.
              Голосования по выбору обслуживающей организации и решению других вопросов проводятся
              в соответствии с положениями Жилищного кодекса РФ. Идентификация — по номеру телефона
              с подтверждением SMS-кодом.
            </p>

            {list.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Активных голосований пока нет.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {list.map((v) => (
                  <Card key={v.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg">{v.title}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" /> {v.building_address}
                          </CardDescription>
                        </div>
                        <Badge variant={v.status === "active" ? "default" : "secondary"}>
                          {v.status === "active" ? "Идёт" : v.status === "finished" ? "Завершено" : v.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {v.voting_type === "oss" ? "ОСС по ЖК РФ" : "Опрос жильцов"}
                        {v.ends_at && (
                          <span className="ml-2">
                            <Calendar className="h-3 w-3 inline mr-1" />
                            до {new Date(v.ends_at).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>
                      <Button size="sm" onClick={() => navigate(`/golosovanie/${v.id}`)}>
                        Подробнее
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ============ КАРТОЧКА ГОЛОСОВАНИЯ ============
  if (!voting) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <p>Голосование не найдено. <Link to="/golosovanie" className="text-primary underline">Назад к списку</Link></p>
        </main>
        <Footer />
      </div>
    );
  }

  const isActive = voting.status === "active" && (!voting.ends_at || new Date(voting.ends_at) > new Date());

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Бюллетень принят</h1>
            <p className="text-muted-foreground mb-6">
              Ваш голос учтён. Результаты будут опубликованы после завершения голосования.
            </p>
            <Button onClick={() => navigate("/golosovanie")}>К списку голосований</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <div>
            <Link to="/golosovanie" className="text-sm text-muted-foreground hover:text-primary">
              ← К списку голосований
            </Link>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{voting.title}</CardTitle>
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Идёт" : "Завершено"}
                </Badge>
              </div>
              <CardDescription>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" /> {voting.building_address}
                </div>
                {voting.legal_basis && (
                  <div className="flex items-center gap-1 mt-1 text-xs">
                    <ShieldCheck className="h-3 w-3" /> {voting.legal_basis}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            {voting.description && (
              <CardContent className="pt-0 text-sm whitespace-pre-wrap">{voting.description}</CardContent>
            )}
          </Card>

          {!isActive ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Приём голосов завершён.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Бюллетень</CardTitle>
                <CardDescription>
                  Заполните поля, ответьте на вопросы и подтвердите личность по SMS.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">ФИО собственника *</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Иванов Иван Иванович" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">№ квартиры *</Label>
                    <Input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder="42" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Площадь, м² (необязательно)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={areaSqm}
                      onChange={(e) => setAreaSqm(e.target.value.replace(",", "."))}
                      placeholder="56.3"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Телефон для SMS *</Label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 (___) ___-__-__"
                      className="mt-1"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="rounded-lg border p-3">
                      <div className="font-medium text-sm mb-2">
                        Вопрос {idx + 1}. {q.question_text}
                      </div>
                      <RadioGroup
                        value={answers[q.id] || ""}
                        onValueChange={(v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
                      >
                        {q.options.map((opt) => (
                          <div key={opt} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                            <Label htmlFor={`${q.id}-${opt}`} className="cursor-pointer">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 rounded-lg border p-3 bg-muted/30">
                  <Checkbox id="is_owner" checked={isOwner} onCheckedChange={(v) => setIsOwner(!!v)} className="mt-0.5" />
                  <Label htmlFor="is_owner" className="text-xs font-normal cursor-pointer">
                    Я подтверждаю, что являюсь собственником указанной квартиры и согласен на обработку персональных данных
                    в целях проведения голосования. Понимаю, что заведомо ложные данные могут повлечь оспаривание решения.
                  </Label>
                </div>

                {!codeRequested ? (
                  <Button onClick={requestCode} disabled={requestingCode || !phone || !isOwner} className="w-full">
                    {requestingCode ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Получить SMS-код
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Код из SMS *</Label>
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6 цифр"
                        className="mt-1 tracking-widest text-center font-mono text-lg"
                      />
                    </div>
                    <Button onClick={submit} disabled={submitting || !code} className="w-full">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Подтвердить и проголосовать
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCodeRequested(false)} className="w-full">
                      Изменить телефон
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Golosovanie;
