import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Auth = () => {
  const [email, setEmail] = useState(""); // Стейт для хранения Email адреса
  const [password, setPassword] = useState(""); // Стейт для хранения пароля
  const [confirmPassword, setConfirmPassword] = useState(""); // Стейт для подтверждения пароля (повторный ввод)
  const [fullName, setFullName] = useState(""); // Стейт для полного имени (передается пустым при регистрации)
  const [loading, setLoading] = useState(false); // Стейт процесса загрузки запроса к API
  const [agreedToTerms, setAgreedToTerms] = useState(true); // Стейт согласия на обработку персональных данных (ФЗ-152 РФ, включен по умолчанию)

  // Вспомогательная функция для оценки надежности пароля (возвращает оценку от 0 до 5)
  // Используется для визуальной шкалы безопасности в форме регистрации
  const getPasswordStrength = (pass: string): number => {
    if (!pass) return 0; // Если пароль пустой, надежность равна 0
    let score = 0;
    if (pass.length >= 6) score += 1; // Длина от 6 символов
    if (pass.length >= 8) score += 1; // Длина от 8 символов (рекомендуемая)
    if (/[A-Z]/.test(pass)) score += 1; // Содержит хотя бы одну заглавную латинскую букву
    if (/[0-9]/.test(pass)) score += 1; // Содержит хотя бы одну цифру
    if (/[^A-Za-z0-9]/.test(pass)) score += 1; // Содержит спецсимвол (знаки препинания, решетки и т.д.)
    return score;
  };
  const navigate = useNavigate();
  const { toast } = useToast();

  const envApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_URL = typeof envApiUrl === 'string' && envApiUrl.startsWith('http') 
    ? envApiUrl 
    : `${window.location.origin}${envApiUrl}`;

  useEffect(() => {
    // Проверяем наличие токена локальной сессии при загрузке
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      console.log("[Auth] Обнаружена активная сессия, перенаправление в личный кабинет...");
      navigate("/cabinet");
    } else {
      localStorage.removeItem("auth_token");
    }
  }, [navigate]);

  // Обработчик регистрации нового пользователя
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Приводим email к нижнему регистру и обрезаем лишние пробелы для чистоты базы
    const cleanEmail = email.toLowerCase().trim();

    // 2. Проверяем обязательное согласие на обработку персональных данных (ФЗ-152 РФ)
    if (!agreedToTerms) {
      console.warn("[Регистрация] Отклонено: пользователь не принял условия обработки персональных данных");
      toast({
        title: "Необходимо согласие",
        description: "Для создания личного кабинета вы должны дать согласие на обработку ваших персональных данных в соответствии с ФЗ-152 РФ.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // 3. Проверяем совпадение паролей перед отправкой на сервер
    if (password !== confirmPassword) {
      console.warn("[Регистрация] Отклонено: введенные пароли не совпадают");
      toast({
        title: "Пароли не совпадают",
        description: "Введенные пароли не совпадают. Пожалуйста, проверьте правильность ввода.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      console.log(`[Регистрация] Отправка запроса на регистрацию для Email: "${cleanEmail}"`); // Логирование
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password, full_name: "" }), // Передаем пустое имя, ФИО заполняется в ЛК
      });

      const data = await response.json();

      if (!response.ok) {
        // Заменяем технические ошибки на понятный русский разговорный формат
        let friendlyMessage = data.error || "Не удалось завершить регистрацию.";
        
        // Анализируем технический текст ошибки
        const errMsg = String(friendlyMessage).toLowerCase();
        if (errMsg.includes("user already exists") || errMsg.includes("exists") || errMsg.includes("unique") || errMsg.includes("duplicate")) {
          friendlyMessage = "Этот Email-адрес уже зарегистрирован. Возможно, вы уже создавали аккаунт ранее? Пожалуйста, перейдите на вкладку 'Вход' или укажите другую почту.";
        }
        
        throw new Error(friendlyMessage);
      }

      toast({
        title: "Регистрация успешна!",
        description: "Добро пожаловать! Ваш профиль успешно создан.",
      });

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Генерируем событие для мгновенного реактивного обновления сессии в шапке сайта
      console.log("[Auth Page] Регистрация успешна, генерируем событие auth-change..."); // Логирование
      window.dispatchEvent(new Event("auth-change"));

      navigate("/cabinet");
    } catch (error: any) {
      console.error("[Регистрация] Ошибка API:", error);
      toast({
        title: "Ошибка регистрации",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Обработчик авторизации существующего пользователя
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Приводим email к нижнему регистру и обрезаем пробелы
    const cleanEmail = email.toLowerCase().trim();

    try {
      console.log(`[Вход] Попытка авторизации пользователя: "${cleanEmail}"`); // Логирование
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Человекопонятный перевод ошибок авторизации
        let friendlyMessage = data.error || "Не удалось войти.";
        const errMsg = String(friendlyMessage).toLowerCase();
        if (errMsg.includes("invalid email or password") || errMsg.includes("invalid credentials") || errMsg.includes("not found") || errMsg.includes("wrong")) {
          friendlyMessage = "Неверный адрес электронной почты или пароль. Пожалуйста, проверьте правильность ввода данных.";
        }
        throw new Error(friendlyMessage);
      }

      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // Генерируем событие для мгновенного реактивного обновления сессии в шапке сайта
      console.log("[Auth Page] Вход выполнен, генерируем событие auth-change..."); // Логирование
      window.dispatchEvent(new Event("auth-change"));

      toast({
        title: "Вход выполнен успешно!",
        description: "Добро пожаловать в ваш личный кабинет.",
      });

      navigate("/cabinet");
    } catch (error: any) {
      toast({
        title: "Ошибка входа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Личный кабинет</CardTitle>
            <CardDescription className="text-center">
              Войдите или зарегистрируйтесь для доступа к личному кабинету
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Пароль</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Войти
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Поле Email (основной идентификатор при регистрации) */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Электронная почта (Email)</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-background/50 border-border/80 focus:border-primary/50 transition-all"
                    />
                  </div>

                  {/* Поле первого ввода Пароля */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Пароль</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="bg-background/50 border-border/80 focus:border-primary/50 transition-all"
                    />
                    
                    {/* Визуальная рекомендательная шкала надежности пароля */}
                    {password.length > 0 && (
                      <div className="space-y-1.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-muted-foreground">Надежность пароля:</span>
                          <span className={
                            getPasswordStrength(password) <= 2 ? "text-red-500" :
                            getPasswordStrength(password) === 3 ? "text-amber-500" : "text-emerald-500"
                          }>
                            {getPasswordStrength(password) <= 1 ? "Очень слабый" :
                             getPasswordStrength(password) === 2 ? "Слабый" :
                             getPasswordStrength(password) === 3 ? "Средний" :
                             getPasswordStrength(password) === 4 ? "Хороший" : "Очень надежный"}
                          </span>
                        </div>
                        {/* Шкала из 5 сегментов */}
                        <div className="grid grid-cols-5 gap-1.5 h-1.5">
                          {[1, 2, 3, 4, 5].map((index) => {
                            const strength = getPasswordStrength(password);
                            const isActive = index <= strength;
                            let colorClass = "bg-muted";
                            if (isActive) {
                              if (strength <= 2) colorClass = "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]";
                              else if (strength === 3) colorClass = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
                              else colorClass = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
                            }
                            return (
                              <div
                                key={index}
                                className={`rounded-full transition-all duration-300 ${colorClass}`}
                              />
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          Рекомендуется: не менее 8 символов, заглавные буквы, цифры и спецсимволы.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Поле подтверждения пароля (повторный ввод) */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Подтвердите пароль</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-background/50 border-border/80 focus:border-primary/50 transition-all"
                    />
                  </div>

                  {/* Галочка согласия на обработку персональных данных (ФЗ-152) и оферту */}
                  <div className="flex items-start gap-2.5 py-1.5 text-left">
                    <input
                      id="signup-agreed"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
                    />
                    <Label htmlFor="signup-agreed" className="text-xs text-muted-foreground leading-normal cursor-pointer select-none font-medium">
                      Я соглашаюсь на <span className="text-primary hover:underline font-semibold">обработку персональных данных</span> в соответствии с ФЗ-152 РФ и принимаю условия <span className="text-primary hover:underline font-semibold">публичной оферты</span>.
                    </Label>
                  </div>

                  {/* Кнопка отправки формы */}
                  <Button 
                    type="submit" 
                    className={`w-full text-primary-foreground font-semibold transition-all mt-3 ${
                      agreedToTerms 
                        ? "gradient-primary hover:opacity-90 shadow-md" 
                        : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                    }`} 
                    disabled={loading || !agreedToTerms}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Создать личный кабинет
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Auth;
