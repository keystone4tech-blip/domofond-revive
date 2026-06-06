import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
}

export const SessionTimeoutProvider = ({ children }: SessionTimeoutProviderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Референс таймера для очистки и сброса
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Константы времени неактивности (в миллисекундах)
  const ADMIN_TIMEOUT = 15 * 60 * 1000; // 15 минут для сотрудников (FSM, Admin)
  const CABINET_TIMEOUT = 30 * 60 * 1000; // 30 минут для личного кабинета (если не стоит "Запомнить меня")

  useEffect(() => {
    const path = location.pathname;
    
    // Проверяем, находится ли пользователь в защищенной зоне
    const isAdminArea = path.startsWith("/admin");
    const isFSMArea = path.startsWith("/fsm");
    const isCabinetArea = path.startsWith("/cabinet");

    // Если страница публичная (главная, контакты и т.д.), таймер не нужен
    if (!isAdminArea && !isFSMArea && !isCabinetArea) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // Проверяем, стоит ли галочка "Оставаться в системе"
    const rememberMe = localStorage.getItem("remember_me") === "true";

    // Если пользователь в ЛК и стоит галочка "Оставаться в системе" — отключаем автовыход
    if (isCabinetArea && rememberMe) {
      console.log("[SessionTimeout] Личный кабинет: автовыход отключен (включен режим 'Оставаться в системе')");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    // Вычисляем время таймаута для текущего раздела
    const currentTimeout = (isAdminArea || isFSMArea) ? ADMIN_TIMEOUT : CABINET_TIMEOUT;
    
    console.log(
      `[SessionTimeout] Мониторинг неактивности запущен. Таймаут: ${currentTimeout / 1000 / 60} мин. ` +
      `Раздел: ${path}. Режим 'Оставаться в системе': ${rememberMe ? 'Да' : 'Нет'}`
    );

    // Функция автовыхода
    const handleLogout = async () => {
      console.warn("[SessionTimeout] Сессия завершена по неактивности. Выполняем автовыход...");
      
      // Разлогиниваемся
      await supabase.auth.signOut();
      
      // Показываем уведомление безопасности
      toast({
        title: "Сессия завершена",
        description: "Вы вышли из системы из-за отсутствия активности в целях безопасности.",
        variant: "destructive",
      });

      // Перенаправляем на страницу авторизации с флагом таймаута
      navigate("/auth?timeout=true");
    };

    // Сброс таймера при активности
    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(handleLogout, currentTimeout);
    };

    // Слушатели событий активности
    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    
    // Инициализация первого таймера
    resetTimer();

    // Добавляем слушатели событий на документ
    events.forEach((event) => {
      document.addEventListener(event, resetTimer);
    });

    // Очистка при размонтировании или смене маршрута
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [location.pathname, navigate, toast]);

  return <>{children}</>;
};

export default SessionTimeoutProvider;
