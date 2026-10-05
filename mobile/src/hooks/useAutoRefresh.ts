// mobile/src/hooks/useAutoRefresh.ts — Умное обновление данных «почти в реальном времени»
//
// Задача: обновлять заявки / платежи / баланс без постоянной нагрузки на сервер.
// Поэтому опрос:
//   • идёт ТОЛЬКО когда экран активен (useFocusEffect) и приложение на переднем плане (AppState);
//   • останавливается в фоне и при отсутствии интернета;
//   • мгновенно обновляет данные при открытии экрана и при возврате приложения из фона;
//   • интервал по умолчанию 25 секунд (лёгкий, не перегружает сервер).
//
// Хук спроектирован так, чтобы позже можно было подключить push через WebSocket (wss):
// событие сокета просто вызовет тот же callback немедленно.

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

interface Options {
  /** Интервал опроса в миллисекундах (по умолчанию 25000 = 25 сек) */
  interval?: number;
  /** Обновлять сразу при фокусе экрана (по умолчанию true) */
  refreshOnFocus?: boolean;
  /** Включён ли опрос (по умолчанию true) */
  enabled?: boolean;
}

export function useAutoRefresh(callback: () => void | Promise<void>, options: Options = {}) {
  const { interval = 25000, refreshOnFocus = true, enabled = true } = options;
  const savedCallback = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Всегда держим актуальную ссылку на callback, не перезапуская таймер
  useEffect(() => { savedCallback.current = callback; }, [callback]);

  const run = useCallback(() => {
    // Не опрашиваем в оффлайне — чтобы не плодить заведомо провальные запросы
    const { isOffline, isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return;
    if (isOffline) return;
    try { savedCallback.current(); } catch { /* no-op */ }
  }, []);

  const startTimer = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(run, interval);
  }, [enabled, interval, run]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Опрос живёт только пока экран в фокусе
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      if (refreshOnFocus) run();     // мгновенное обновление при открытии экрана
      startTimer();

      // Реакция на сворачивание/разворачивание приложения
      const sub = AppState.addEventListener('change', (next) => {
        const prev = appState.current;
        appState.current = next;
        if (prev.match(/inactive|background/) && next === 'active') {
          // Вернулись из фона — сразу обновляем и перезапускаем таймер
          run();
          startTimer();
        } else if (next.match(/inactive|background/)) {
          // Ушли в фон — останавливаем опрос, чтобы не нагружать сеть/батарею
          stopTimer();
        }
      });

      return () => {
        stopTimer();
        sub.remove();
      };
    }, [enabled, refreshOnFocus, run, startTimer, stopTimer])
  );
}
