import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { z } from "zod";
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
import { Vote, Calendar, MapPin, Loader2, CheckCircle2, ShieldCheck, ChevronLeft, ChevronRight, AlertCircle, User, Home, Phone, KeyRound } from "lucide-react";
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
            <StepperBallot
              voting={voting}
              questions={questions}
              fullName={fullName} setFullName={setFullName}
              phone={phone} setPhone={setPhone}
              apartment={apartment} setApartment={setApartment}
              areaSqm={areaSqm} setAreaSqm={setAreaSqm}
              isOwner={isOwner} setIsOwner={setIsOwner}
              answers={answers} setAnswers={setAnswers}
              code={code} setCode={setCode}
              codeRequested={codeRequested}
              requestingCode={requestingCode}
              submitting={submitting}
              onRequestCode={requestCode}
              onSubmit={submit}
              onChangePhone={() => setCodeRequested(false)}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

// =============== STEPPER ===============

const fioSchema = z
  .string()
  .trim()
  .min(5, "ФИО должно содержать минимум 5 символов")
  .max(120, "ФИО слишком длинное")
  .regex(/^[А-Яа-яЁё\s\-]+$/u, "Используйте только русские буквы, пробел и дефис")
  .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Укажите фамилию, имя и (желательно) отчество");

const apartmentSchema = z
  .string()
  .trim()
  .min(1, "Укажите номер квартиры")
  .max(10, "Слишком длинный номер")
  .regex(/^[0-9]+[А-Яа-я]?$/u, "Только цифры, можно с буквой (например, 12А)");

const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, "").length >= 11, "Введите телефон полностью (11 цифр)")
  .refine((v) => /^[+]?[78]/.test(v.replace(/\D/g, "").replace(/^/, "+")), "Номер должен начинаться с +7 или 8");

const areaSchema = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || (Number(v) > 5 && Number(v) < 1000), "Площадь должна быть в диапазоне 5–1000 м²");

const codeSchema = z.string().regex(/^\d{6}$/, "Код состоит из 6 цифр");

interface StepperProps {
  voting: Voting;
  questions: Question[];
  fullName: string; setFullName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  apartment: string; setApartment: (v: string) => void;
  areaSqm: string; setAreaSqm: (v: string) => void;
  isOwner: boolean; setIsOwner: (v: boolean) => void;
  answers: Record<string, string>; setAnswers: (cb: (p: Record<string, string>) => Record<string, string>) => void;
  code: string; setCode: (v: string) => void;
  codeRequested: boolean;
  requestingCode: boolean;
  submitting: boolean;
  onRequestCode: () => void;
  onSubmit: () => void;
  onChangePhone: () => void;
}

const StepperBallot = (p: StepperProps) => {
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const formatPhone = (raw: string) => {
    const d = raw.replace(/\D/g, "").replace(/^8/, "7").slice(0, 11);
    if (!d) return "";
    const parts = ["+7"];
    if (d.length > 1) parts.push(" (" + d.slice(1, 4));
    if (d.length >= 4) parts[1] += ")";
    if (d.length >= 5) parts.push(" " + d.slice(4, 7));
    if (d.length >= 8) parts.push("-" + d.slice(7, 9));
    if (d.length >= 10) parts.push("-" + d.slice(9, 11));
    return parts.join("");
  };

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const fio = fioSchema.safeParse(p.fullName); if (!fio.success) e.fullName = fio.error.issues[0].message;
    const apt = apartmentSchema.safeParse(p.apartment); if (!apt.success) e.apartment = apt.error.issues[0].message;
    const ph = phoneSchema.safeParse(p.phone); if (!ph.success) e.phone = ph.error.issues[0].message;
    const ar = areaSchema.safeParse(p.areaSqm); if (!ar.success) e.areaSqm = ar.error.issues[0].message;
    if (!p.isOwner) e.isOwner = "Подтвердите статус собственника";
    p.questions.forEach((q) => { if (!p.answers[q.id]) e[`q_${q.id}`] = "Выберите вариант ответа"; });
    if (p.codeRequested) {
      const c = codeSchema.safeParse(p.code); if (!c.success) e.code = c.error.issues[0].message;
    }
    return e;
  }, [p]);

  const steps = [
    { key: "personal", title: "Собственник", icon: User, fields: ["fullName", "apartment", "areaSqm"] },
    { key: "questions", title: "Вопросы", icon: Vote, fields: p.questions.map((q) => `q_${q.id}`) },
    { key: "confirm", title: "Подтверждение", icon: KeyRound, fields: ["phone", "isOwner", "code"] },
  ];

  const stepHasErrors = (idx: number) => steps[idx].fields.some((f) => errors[f]);

  const markStepTouched = (idx: number) => {
    const next = { ...touched };
    steps[idx].fields.forEach((f) => { next[f] = true; });
    setTouched(next);
  };

  const goNext = () => {
    markStepTouched(step);
    if (stepHasErrors(step)) return;
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const showError = (k: string) => touched[k] && errors[k];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Бюллетень</CardTitle>
        <CardDescription>
          Заполните данные собственника, ответьте на вопросы и подтвердите личность по SMS.
        </CardDescription>
        {/* Прогресс */}
        <div className="flex items-center gap-1 pt-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step && !stepHasErrors(i);
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" :
                  done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="h-3 w-3" />
                  <span className="hidden sm:inline">{s.title}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${done ? "bg-primary" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ШАГ 1: ЛИЧНЫЕ ДАННЫЕ */}
        {step === 0 && (
          <div className="space-y-3 animate-in fade-in-50">
            <Field label="ФИО собственника *" icon={User} error={showError("fullName") ? errors.fullName : ""}>
              <Input
                value={p.fullName}
                onChange={(e) => p.setFullName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                placeholder="Иванов Иван Иванович"
                aria-invalid={!!showError("fullName")}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="№ квартиры *" icon={Home} error={showError("apartment") ? errors.apartment : ""}>
                <Input
                  inputMode="text"
                  value={p.apartment}
                  onChange={(e) => p.setApartment(e.target.value.toUpperCase())}
                  onBlur={() => setTouched((t) => ({ ...t, apartment: true }))}
                  placeholder="42 или 12А"
                  aria-invalid={!!showError("apartment")}
                />
              </Field>
              <Field label="Площадь, м²" hint="не обязательно, но повысит юр. вес голоса" error={showError("areaSqm") ? errors.areaSqm : ""}>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={p.areaSqm}
                  onChange={(e) => p.setAreaSqm(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
                  onBlur={() => setTouched((t) => ({ ...t, areaSqm: true }))}
                  placeholder="56.3"
                  aria-invalid={!!showError("areaSqm")}
                />
              </Field>
            </div>
          </div>
        )}

        {/* ШАГ 2: ВОПРОСЫ */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in-50">
            {p.questions.length === 0 && (
              <p className="text-sm text-muted-foreground">У этого голосования пока нет вопросов.</p>
            )}
            {p.questions.map((q, idx) => {
              const errKey = `q_${q.id}`;
              const err = showError(errKey) ? errors[errKey] : "";
              return (
                <div key={q.id} className={`rounded-lg border p-3 ${err ? "border-destructive" : ""}`}>
                  <div className="font-medium text-sm mb-2">
                    Вопрос {idx + 1}. {q.question_text}
                  </div>
                  <RadioGroup
                    value={p.answers[q.id] || ""}
                    onValueChange={(v) => {
                      p.setAnswers((prev) => ({ ...prev, [q.id]: v }));
                      setTouched((t) => ({ ...t, [errKey]: true }));
                    }}
                  >
                    {q.options.map((opt) => (
                      <div key={opt} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                        <Label htmlFor={`${q.id}-${opt}`} className="cursor-pointer text-sm font-normal">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {err && <ErrorLine text={err} />}
                </div>
              );
            })}
          </div>
        )}

        {/* ШАГ 3: ПОДТВЕРЖДЕНИЕ */}
        {step === 2 && (
          <div className="space-y-3 animate-in fade-in-50">
            <Field label="Телефон для SMS *" icon={Phone} error={showError("phone") ? errors.phone : ""}>
              <Input
                type="tel"
                inputMode="tel"
                value={p.phone}
                onChange={(e) => p.setPhone(formatPhone(e.target.value))}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                placeholder="+7 (___) ___-__-__"
                aria-invalid={!!showError("phone")}
                disabled={p.codeRequested}
              />
            </Field>

            <div className={`flex items-start gap-2 rounded-lg border p-3 bg-muted/30 ${showError("isOwner") ? "border-destructive" : ""}`}>
              <Checkbox
                id="is_owner"
                checked={p.isOwner}
                onCheckedChange={(v) => { p.setIsOwner(!!v); setTouched((t) => ({ ...t, isOwner: true })); }}
                className="mt-0.5"
              />
              <Label htmlFor="is_owner" className="text-xs font-normal cursor-pointer">
                Я подтверждаю, что являюсь собственником указанной квартиры и согласен на обработку
                персональных данных в целях проведения голосования. Понимаю, что заведомо ложные
                данные могут повлечь оспаривание решения собрания.
              </Label>
            </div>
            {showError("isOwner") && <ErrorLine text={errors.isOwner} />}

            {!p.codeRequested ? (
              <Button
                onClick={() => { markStepTouched(2); if (!errors.phone && !errors.isOwner) p.onRequestCode(); }}
                disabled={p.requestingCode}
                className="w-full"
              >
                {p.requestingCode && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Получить SMS-код
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border p-3 bg-primary/5">
                <Field label="Код из SMS *" icon={KeyRound} error={showError("code") ? errors.code : ""}>
                  <Input
                    value={p.code}
                    onChange={(e) => { p.setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTouched((t) => ({ ...t, code: true })); }}
                    placeholder="------"
                    className="tracking-widest text-center font-mono text-lg"
                    aria-invalid={!!showError("code")}
                    autoFocus
                  />
                </Field>
                <Button
                  onClick={() => { markStepTouched(2); if (Object.keys(errors).length === 0) p.onSubmit(); }}
                  disabled={p.submitting || !p.code}
                  className="w-full"
                >
                  {p.submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Подтвердить и проголосовать
                </Button>
                <Button variant="ghost" size="sm" onClick={p.onChangePhone} className="w-full">
                  Изменить телефон
                </Button>
              </div>
            )}
          </div>
        )}

        {/* НАВИГАЦИЯ */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Назад
          </Button>
          {step < steps.length - 1 && (
            <Button onClick={goNext} className="flex-1">
              Далее <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============== Вспомогательные ==============
const Field = ({
  label, hint, error, icon: Icon, children,
}: { label: string; hint?: string; error?: string; icon?: any; children: React.ReactNode }) => (
  <div>
    <Label className="text-xs flex items-center gap-1">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground" />} {label}
    </Label>
    <div className="mt-1">{children}</div>
    {error ? <ErrorLine text={error} /> : hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
  </div>
);

const ErrorLine = ({ text }: { text: string }) => (
  <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
    <AlertCircle className="h-3 w-3" /> {text}
  </p>
);

export default Golosovanie;
