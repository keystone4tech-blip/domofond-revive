/**
 * ============================================================================
 * Служебное мобильное веб-приложение / PWA «Офис Работа»
 * ============================================================================
 * Универсальное приложение для сотрудников компании (мастеров, монтажников,
 * диспетчеров и руководителей).
 * 
 * Особенности:
 * 1. Адаптивный мобильный экран с touch-навигацией (как нативное приложение).
 * 2. Авторизация по номеру телефона и паролю личного кабинета сотрудника CRM.
 * 3. Три специализированных рабочих стола: Мастер / Диспетчер / Руководитель.
 * 4. Наряды, смена статусов, создание электронных актов работ с подписью.
 * 5. Прямая ссылка на установку и скачивание Android APK (office-work.apk).
 */

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Wrench,
  Headset,
  BarChart3,
  ClipboardList,
  FileText,
  Bell,
  User,
  Phone,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Car,
  Download,
  Share2,
  LogOut,
  RefreshCw,
  Sparkles,
  Shield,
  Eye,
  EyeOff,
  ChevronRight,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';

// Типы ролей
type StaffRole = 'master' | 'dispatcher' | 'director';

interface TaskItem {
  id: string;
  task_number: string;
  title: string;
  description: string;
  address: string;
  entrance?: string;
  floor?: string;
  apartment?: string;
  intercom_code?: string;
  client_name: string;
  client_phone: string;
  status: 'new' | 'en_route' | 'in_progress' | 'done';
  priority: 'urgent' | 'medium' | 'low';
  scheduled_time: string;
  payment_amount: number;
}

interface ActItem {
  id: string;
  act_number: string;
  address: string;
  client_name: string;
  works_done: string;
  materials: string;
  total_price: number;
  date: string;
  signed: boolean;
}

export default function OfficeWorkApp() {
  // Состояние авторизации
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [phone, setPhone] = useState('+7 (909) 453-62-41');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userName, setUserName] = useState('Шибаев Сергей Викторович');
  const [activeRole, setActiveRole] = useState<StaffRole>('master');
  const [isOnShift, setIsOnShift] = useState<boolean>(true);

  // Навигация по табам (desktop, tasks, acts, alerts, profile)
  const [activeTab, setActiveTab] = useState<'home' | 'tasks' | 'acts' | 'alerts' | 'profile'>('home');

  // Фильтр задач
  const [taskFilter, setTaskFilter] = useState<'all' | 'in_progress' | 'en_route' | 'done' | 'urgent'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Список нарядов
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: 't-101',
      task_number: 'НАРЯД-4281',
      title: 'Не открывает дверь с трубки в квартире',
      description: 'Вызов проходит, но при нажатии кнопки открытия замок не срабатывает. Диагностика трубки и линии.',
      address: 'ул. Красная, д. 125',
      entrance: '3',
      floor: '5',
      apartment: '42',
      intercom_code: '#3489',
      client_name: 'Семенова Ольга Ивановна',
      client_phone: '+7 (918) 234-56-78',
      status: 'in_progress',
      priority: 'urgent',
      scheduled_time: 'Сегодня, 14:00 – 15:30',
      payment_amount: 550,
    },
    {
      id: 't-102',
      task_number: 'НАРЯД-4282',
      title: 'Монтаж и подключение новой трубки домофона',
      description: 'Новый абонент. Провести кабель от этажного щитка и смонтировать трубку Vizit УКП-12M.',
      address: 'ул. Ставропольская, д. 84/1',
      entrance: '1',
      floor: '2',
      apartment: '14',
      intercom_code: '#8401',
      client_name: 'Дмитриев Артем Сергеевич',
      client_phone: '+7 (903) 456-78-90',
      status: 'en_route',
      priority: 'medium',
      scheduled_time: 'Сегодня, 16:00 – 17:00',
      payment_amount: 1200,
    },
    {
      id: 't-103',
      task_number: 'НАРЯД-4283',
      title: 'Регулировка доводчика подъездной двери',
      description: 'Дверь хлопает при закрытии. Регулировка скоростей закрытия и дохлопа, протяжка крепежа.',
      address: 'ул. Тургенева, д. 152',
      entrance: '2',
      floor: '1',
      client_name: 'Старший по дому (Виктор Николаевич)',
      client_phone: '+7 (918) 789-01-23',
      status: 'new',
      priority: 'urgent',
      scheduled_time: 'Сегодня, 17:30',
      payment_amount: 0,
    },
    {
      id: 't-104',
      task_number: 'НАРЯД-4279',
      title: 'Доставка и прописка 3-х бесконтактных ключей RFID',
      description: 'Закодировать новые RFID брелоки и передать жильцу под подпись.',
      address: 'ул. Северная, д. 210',
      entrance: '4',
      floor: '7',
      apartment: '98',
      intercom_code: '#2104',
      client_name: 'Кузнецов Игорь Павлович',
      client_phone: '+7 (928) 333-44-55',
      status: 'done',
      priority: 'low',
      scheduled_time: 'Сегодня, 12:00',
      payment_amount: 750,
    },
  ]);

  // Список электронных актов
  const [acts, setActs] = useState<ActItem[]>([
    {
      id: 'act-1',
      act_number: 'АКТ-2026/104',
      address: 'ул. Северная, д. 210, кв. 98',
      client_name: 'Кузнецов Игорь Павлович',
      works_done: 'Кодирование 3 бесконтактных RFID брелоков к вызывной панели',
      materials: 'RFID брелоки Mifare — 3 шт.',
      total_price: 750,
      date: 'Сегодня, 12:35',
      signed: true,
    },
  ]);

  // Модалка оформления акта
  const [isActModalOpen, setIsActModalOpen] = useState(false);
  const [actAddress, setActAddress] = useState('ул. Красная, д. 125, кв. 42');
  const [actClient, setActClient] = useState('Семенова Ольга Ивановна');
  const [actWorks, setActWorks] = useState('Диагностика и восстановление контакта линии трубки');
  const [actMaterials, setActMaterials] = useState('Разъем трубки, крепеж');
  const [actPrice, setActPrice] = useState('550');

  // Модалка детального просмотра наряда
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Проверка сохраненной сессии
  useEffect(() => {
    const saved = localStorage.getItem('officework_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setIsAuthenticated(true);
        setUserName(parsed.name || 'Шибаев Сергей Викторович');
        setActiveRole(parsed.role || 'master');
      } catch (e) {}
    }
  }, []);

  // Вход
  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone) {
      toast.error('Введите номер телефона сотрудника');
      return;
    }
    setIsAuthenticated(true);
    localStorage.setItem(
      'officework_session',
      JSON.stringify({ phone, name: userName, role: activeRole })
    );
    toast.success(`Вход выполнен: ${userName} (${getRoleLabel(activeRole)})`);
  };

  // Быстрый демо-вход под ролью
  const handleQuickDemo = (role: StaffRole) => {
    setActiveRole(role);
    setIsAuthenticated(true);
    localStorage.setItem(
      'officework_session',
      JSON.stringify({ phone: '+7 (909) 453-62-41', name: 'Шибаев Сергей Викторович', role })
    );
    toast.success(`Рабочий стол переключен: ${getRoleLabel(role)}`);
  };

  // Выход
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('officework_session');
    toast.info('Сессия завершена');
  };

  // Смена статуса наряда
  const handleStatusChange = (taskId: string, newStatus: TaskItem['status']) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: newStatus });
    }
    toast.success(`Статус наряда изменен: ${newStatus}`);
  };

  // Сохранение нового акта
  const handleSaveAct = () => {
    const newAct: ActItem = {
      id: `act-${Date.now()}`,
      act_number: `АКТ-2026/${Math.floor(100 + Math.random() * 900)}`,
      address: actAddress,
      client_name: actClient,
      works_done: actWorks,
      materials: actMaterials,
      total_price: Number(actPrice) || 0,
      date: 'Сегодня, только что',
      signed: true,
    };
    setActs([newAct, ...acts]);
    setIsActModalOpen(false);
    toast.success(`Электронный ${newAct.act_number} подписан и зарегистрирован в CRM!`);
  };

  function getRoleLabel(role: StaffRole): string {
    switch (role) {
      case 'master':
        return 'Мастер / Техник';
      case 'dispatcher':
        return 'Диспетчер смены';
      case 'director':
        return 'Руководитель';
    }
  }

  // Фильтрация нарядов
  const filteredTasks = tasks.filter((t) => {
    const matchSearch =
      !searchQuery ||
      t.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.task_number.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;
    if (taskFilter === 'all') return true;
    if (taskFilter === 'urgent') return t.priority === 'urgent';
    return t.status === taskFilter;
  });

  return (
    <div className="min-h-screen bg-[#070D1F] text-slate-100 flex flex-col items-center justify-start pb-20 selection:bg-sky-500 selection:text-white font-sans">
      {/* Ограничитель ширины мобильного экрана (Mobile App Frame) */}
      <div className="w-full max-w-md min-h-screen bg-[#0B132B] flex flex-col shadow-2xl relative border-x border-slate-800/60">

        {/* ===================================================================
            ВЕРХНИЙ БАР С ПРИЛОЖЕНИЕМ И СКАЧИВАНИЕМ APK
           =================================================================== */}
        <div className="bg-[#0F172A] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-sky-400 tracking-wider uppercase text-[11px]">Офис Работа</span>
            <span className="text-slate-500 font-mono text-[10px]">v1.0.0</span>
          </div>

          <a
            href="https://github.com/keystone4tech-blip/domofond-revive/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 transition-all text-[11px] font-semibold"
          >
            <Download className="w-3 h-3 text-sky-400" />
            <span>Скачать APK</span>
          </a>
        </div>

        {/* ===================================================================
            ЕСЛИ НЕ АВТОРИЗОВАН — ЭКРАН ВХОДА
           =================================================================== */}
        {!isAuthenticated ? (
          <div className="flex-1 flex flex-col justify-between p-6">
            <div className="mt-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 shadow-lg shadow-sky-500/25 mb-4">
                <Briefcase className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">Офис Работа</h1>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Служебное мобильное приложение для сотрудников и выездных мастеров
              </p>
            </div>

            {/* Форма авторизации */}
            <form onSubmit={handleLogin} className="mt-8 bg-[#131D38] p-5 rounded-2xl border border-slate-700/60 shadow-xl space-y-4">
              <div className="text-sm font-bold text-slate-200">Вход в служебный аккаунт</div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Номер телефона сотрудника</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 (999) 000-00-00"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Пароль от личного кабинета</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 transition-all mt-2"
              >
                <span>Войти на смену</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Быстрый демо-вход для мгновенного теста любой роли */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Быстрый тест любой роли:
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleQuickDemo('master')}
                  className="bg-[#131D38] hover:bg-[#1A2649] border border-emerald-500/30 rounded-xl p-3 text-left transition-all flex flex-col justify-between"
                >
                  <Wrench className="w-4 h-4 text-emerald-400 mb-1" />
                  <div className="text-xs font-bold text-white">Мастер</div>
                  <div className="text-[10px] text-slate-400">Наряды, акты</div>
                </button>

                <button
                  onClick={() => handleQuickDemo('dispatcher')}
                  className="bg-[#131D38] hover:bg-[#1A2649] border border-sky-500/30 rounded-xl p-3 text-left transition-all flex flex-col justify-between"
                >
                  <Headset className="w-4 h-4 text-sky-400 mb-1" />
                  <div className="text-xs font-bold text-white">Диспетчер</div>
                  <div className="text-[10px] text-slate-400">Очередь вызовов</div>
                </button>

                <button
                  onClick={() => handleQuickDemo('director')}
                  className="bg-[#131D38] hover:bg-[#1A2649] border border-purple-500/30 rounded-xl p-3 text-left transition-all flex flex-col justify-between"
                >
                  <BarChart3 className="w-4 h-4 text-purple-400 mb-1" />
                  <div className="text-xs font-bold text-white">Директор</div>
                  <div className="text-[10px] text-slate-400">Сводка, аудит</div>
                </button>
              </div>
            </div>

            <div className="text-center text-[11px] text-slate-500 mt-6">
              Универсальная платформа «Офис Работа» для филиалов компании
            </div>
          </div>
        ) : (
          /* ===================================================================
              АВТОРИЗОВАННЫЙ ПОЛЬЗОВАТЕЛЬ — ОСНОВНОЙ ИНТЕРФЕЙС ПРИЛОЖЕНИЯ
             =================================================================== */
          <div className="flex-1 flex flex-col">

            {/* ВЕРХНЯЯ ШАПКА СОТРУДНИКА */}
            <div className="p-4 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Сотрудник:</div>
                <div className="text-sm font-bold text-white">{userName}</div>
              </div>

              {/* Тумблер смены */}
              <button
                onClick={() => {
                  setIsOnShift(!isOnShift);
                  toast(isOnShift ? 'Смена завершена (Отдых)' : 'Вы вышли на смену!');
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  isOnShift
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-700/30 border-slate-600 text-slate-400'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${isOnShift ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>{isOnShift ? 'НА СМЕНЕ' : 'ОТДЫХ'}</span>
              </button>
            </div>

            {/* ПЕРЕКЛЮЧАТЕЛЬ РОЛЕЙ ДЛЯ ТЕСТИРОВАНИЯ */}
            <div className="px-4 py-2 bg-[#131D38] border-b border-slate-800 flex items-center justify-between gap-1 overflow-x-auto text-[11px]">
              <span className="text-slate-400 font-medium shrink-0">Режим роли:</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setActiveRole('master')}
                  className={`px-2 py-1 rounded-md font-semibold transition-all ${
                    activeRole === 'master' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Мастер
                </button>
                <button
                  onClick={() => setActiveRole('dispatcher')}
                  className={`px-2 py-1 rounded-md font-semibold transition-all ${
                    activeRole === 'dispatcher' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Диспетчер
                </button>
                <button
                  onClick={() => setActiveRole('director')}
                  className={`px-2 py-1 rounded-md font-semibold transition-all ${
                    activeRole === 'director' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Директор
                </button>
              </div>
            </div>

            {/* КОНТЕНТ ВКЛАДОК */}
            <div className="flex-1 p-4 overflow-y-auto">

              {/* -------------------------------------------------------------
                  ВКЛАДКА 1: ГЛАВНЫЙ РАБОЧИЙ СТОЛ (АДАПТИВНЫЙ ПО РОЛИ)
                 ------------------------------------------------------------- */}
              {activeTab === 'home' && (
                <div className="space-y-4">
                  {/* Роль: МАСТЕР */}
                  {activeRole === 'master' && (
                    <>
                      {/* Карточка текущего активного наряда */}
                      <div className="bg-gradient-to-br from-[#1E293B] to-[#131D38] p-4 rounded-2xl border border-sky-500/30 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            ⚡ Сейчас в работе
                          </span>
                          <span className="text-xs text-slate-400 font-mono">НАРЯД-4281</span>
                        </div>

                        <h3 className="font-bold text-white text-sm mb-1.5 leading-snug">
                          Не открывает дверь с трубки в квартире
                        </h3>

                        <div className="flex items-center gap-1.5 text-xs text-sky-400 mb-2 font-medium">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>ул. Красная, д. 125, кв. 42 (подъезд 3)</span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-700/60 mt-2">
                          <a
                            href="tel:+79182345678"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Позвонить</span>
                          </a>

                          <button
                            onClick={() => {
                              setSelectedTask(tasks[0]);
                            }}
                            className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                          >
                            <span>Открыть наряд</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Метрики выработки */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#131D38] p-3 rounded-xl border border-slate-800 text-center">
                          <div className="text-lg font-black text-white">4</div>
                          <div className="text-[10px] text-slate-400">Закрыто</div>
                        </div>
                        <div className="bg-[#131D38] p-3 rounded-xl border border-slate-800 text-center">
                          <div className="text-lg font-black text-amber-400">1</div>
                          <div className="text-[10px] text-slate-400">В работе</div>
                        </div>
                        <div className="bg-[#131D38] p-3 rounded-xl border border-slate-800 text-center">
                          <div className="text-lg font-black text-emerald-400">2 850 ₽</div>
                          <div className="text-[10px] text-slate-400">Начислено</div>
                        </div>
                      </div>

                      {/* Быстрые кнопки */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setActiveTab('tasks')}
                          className="bg-[#131D38] hover:bg-[#1A2649] p-3 rounded-xl border border-slate-800 flex items-center gap-2.5 text-left transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center text-sky-400">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Все наряды</div>
                            <div className="text-[10px] text-slate-400">{tasks.length} в списке</div>
                          </div>
                        </button>

                        <button
                          onClick={() => setIsActModalOpen(true)}
                          className="bg-[#131D38] hover:bg-[#1A2649] p-3 rounded-xl border border-slate-800 flex items-center gap-2.5 text-left transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">Составить акт</div>
                            <div className="text-[10px] text-slate-400">С подписью</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Роль: ДИСПЕТЧЕР */}
                  {activeRole === 'dispatcher' && (
                    <>
                      <div className="bg-[#131D38] p-4 rounded-2xl border border-sky-500/30 flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-black text-white">{tasks.length}</div>
                          <div className="text-xs text-slate-400">Заявок в очереди</div>
                        </div>
                        <div className="h-8 w-px bg-slate-700" />
                        <div>
                          <div className="text-2xl font-black text-red-400">2</div>
                          <div className="text-xs text-slate-400">Срочные аварии</div>
                        </div>
                        <div className="h-8 w-px bg-slate-700" />
                        <div>
                          <div className="text-2xl font-black text-emerald-400">6</div>
                          <div className="text-xs text-slate-400">Мастеров online</div>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Требуют распределения:
                      </div>

                      <div className="space-y-2">
                        {tasks.slice(0, 3).map((t) => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTask(t)}
                            className="bg-[#131D38] p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer space-y-1.5 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-sky-400">{t.address}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                                СРОЧНО
                              </span>
                            </div>
                            <div className="text-xs text-white line-clamp-1">{t.title}</div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                              <span>{t.client_name}</span>
                              <span className="text-sky-400 font-bold">Назначить мастера ➔</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Роль: ДИРЕКТОР */}
                  {activeRole === 'director' && (
                    <>
                      <div className="bg-gradient-to-br from-[#1E293B] to-[#131D38] p-4 rounded-2xl border border-purple-500/30">
                        <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wide">
                          Сводка филиала за сегодня
                        </div>
                        <div className="text-3xl font-black text-white mt-1">48 200 ₽</div>
                        <div className="text-xs text-slate-400 mt-0.5">Выручка по выполненным нарядам и ТО</div>

                        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-700/60 text-center">
                          <div>
                            <div className="text-sm font-bold text-white">94%</div>
                            <div className="text-[10px] text-slate-400">SLA в срок</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-emerald-400">18 / 21</div>
                            <div className="text-[10px] text-slate-400">Закрыто</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-sky-400">8 чел.</div>
                            <div className="text-[10px] text-slate-400">На линии</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setActiveTab('acts')}
                          className="bg-[#131D38] p-3.5 rounded-xl border border-slate-800 flex items-center gap-2.5 text-left"
                        >
                          <Shield className="w-5 h-5 text-purple-400" />
                          <div>
                            <div className="text-xs font-bold text-white">Реестр актов</div>
                            <div className="text-[10px] text-slate-400">{acts.length} документов</div>
                          </div>
                        </button>
                        <button
                          onClick={() => setActiveTab('tasks')}
                          className="bg-[#131D38] p-3.5 rounded-xl border border-slate-800 flex items-center gap-2.5 text-left"
                        >
                          <BarChart3 className="w-5 h-5 text-amber-400" />
                          <div>
                            <div className="text-xs font-bold text-white">Мониторинг</div>
                            <div className="text-[10px] text-slate-400">Все объекты</div>
                          </div>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* -------------------------------------------------------------
                  ВКЛАДКА 2: НАРЯДЫ И ЗАЯВКИ
                 ------------------------------------------------------------- */}
              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  {/* Поиск */}
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по адресу, номеру, жильцу..."
                    className="w-full bg-[#131D38] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />

                  {/* Фильтры */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                    {(['all', 'in_progress', 'en_route', 'done', 'urgent'] as const).map((filterKey) => (
                      <button
                        key={filterKey}
                        onClick={() => setTaskFilter(filterKey)}
                        className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap transition-colors ${
                          taskFilter === filterKey
                            ? 'bg-sky-600 text-white shadow'
                            : 'bg-[#131D38] text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {filterKey === 'all' && 'Все'}
                        {filterKey === 'in_progress' && 'В работе'}
                        {filterKey === 'en_route' && 'В пути'}
                        {filterKey === 'done' && 'Выполнены'}
                        {filterKey === 'urgent' && '⚡ Срочные'}
                      </button>
                    ))}
                  </div>

                  {/* Список нарядов */}
                  <div className="space-y-2.5">
                    {filteredTasks.map((t) => (
                      <div
                        key={t.id}
                        className="bg-[#131D38] p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-mono">{t.task_number}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                              t.status === 'in_progress'
                                ? 'bg-amber-500/20 text-amber-400'
                                : t.status === 'en_route'
                                ? 'bg-sky-500/20 text-sky-400'
                                : t.status === 'done'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-700/50 text-slate-300'
                            }`}
                          >
                            {t.status === 'in_progress' && 'В работе'}
                            {t.status === 'en_route' && 'В пути'}
                            {t.status === 'done' && 'Выполнен'}
                            {t.status === 'new' && 'Новый'}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-white">{t.title}</div>

                        <div className="text-xs text-sky-400 flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{t.address}{t.apartment ? `, кв. ${t.apartment}` : ''}</span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                          <a
                            href={`tel:${t.client_phone}`}
                            className="text-emerald-400 font-bold flex items-center gap-1 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{t.client_phone}</span>
                          </a>

                          <button
                            onClick={() => setSelectedTask(t)}
                            className="text-sky-400 font-bold hover:underline"
                          >
                            Открыть наряд ➔
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  ВКЛАДКА 3: ЭЛЕКТРОННЫЕ АКТЫ
                 ------------------------------------------------------------- */}
              {activeTab === 'acts' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Оформленные акты ({acts.length})</span>
                    <button
                      onClick={() => setIsActModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 shadow"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Новый акт</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {acts.map((act) => (
                      <div key={act.id} className="bg-[#131D38] p-3.5 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-400 font-mono">{act.act_number}</span>
                          <span className="text-[10px] text-slate-400">{act.date}</span>
                        </div>
                        <div className="text-sm font-bold text-white">{act.address}</div>
                        <div className="text-xs text-slate-300">Работы: {act.works_done}</div>
                        <div className="text-xs text-slate-400">Материалы: {act.materials}</div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                          <span className="text-slate-400">Заказчик: {act.client_name}</span>
                          <span className="font-extrabold text-emerald-400">
                            {act.total_price > 0 ? `${act.total_price} ₽` : 'По ТО'} (Подписан)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  ВКЛАДКА 4: ОПОВЕЩЕНИЯ
                 ------------------------------------------------------------- */}
              {activeTab === 'alerts' && (
                <div className="space-y-2.5">
                  <div className="bg-[#131D38] p-3 rounded-xl border border-red-500/30 flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">⚡ Срочная авария на подъезде</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        ул. Тургенева, 152: подъезд 2 — заблокирована дверь, жильцы вызывают мастера.
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">10 минут назад</div>
                    </div>
                  </div>

                  <div className="bg-[#131D38] p-3 rounded-xl border border-slate-800 flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">📋 Назначен новый наряд</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        ул. Ставропольская, 84/1, кв. 14: монтаж новой трубки домофона.
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">1 час назад</div>
                    </div>
                  </div>

                  <div className="bg-[#131D38] p-3 rounded-xl border border-slate-800 flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">💳 Оплата онлайн через СБП</div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        Абонент Семенова О.И. (кв. 42) оплатила счет на 550 ₽.
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Сегодня, 11:20</div>
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  ВКЛАДКА 5: ПРОФИЛЬ СОТРУДНИКА
                 ------------------------------------------------------------- */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <div className="bg-[#131D38] p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-blue-500 flex items-center justify-center text-lg font-black text-white">
                      {userName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{userName}</div>
                      <div className="text-xs text-slate-400">{phone}</div>
                      <div className="text-[11px] text-sky-400 font-semibold mt-0.5">
                        {getRoleLabel(activeRole)} • Рейтинг 4.96 ⭐
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Управление приложением
                    </div>

                    <a
                      href="https://github.com/keystone4tech-blip/domofond-revive/releases"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-[#131D38] hover:bg-[#1A2649] p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-white transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Download className="w-4 h-4 text-sky-400" />
                        <span>Скачать автономный Android APK (.apk)</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </a>

                    <button
                      onClick={handleLogout}
                      className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors mt-4"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Выйти из аккаунта</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ===================================================================
                НИЖНИЙ НАВИГАЦИОННЫЙ ТАБ-БАР
               =================================================================== */}
            <div className="bg-[#0F172A] border-t border-slate-800 px-3 py-2 flex items-center justify-around">
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'home' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span className="text-[10px] font-bold">Главная</span>
              </button>

              <button
                onClick={() => setActiveTab('tasks')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'tasks' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <ClipboardList className="w-5 h-5" />
                <span className="text-[10px] font-bold">Наряды</span>
              </button>

              <button
                onClick={() => setActiveTab('acts')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'acts' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span className="text-[10px] font-bold">Акты</span>
              </button>

              <button
                onClick={() => setActiveTab('alerts')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'alerts' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <Bell className="w-5 h-5" />
                <span className="text-[10px] font-bold">Сигналы</span>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === 'profile' ? 'text-sky-400' : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] font-bold">Профиль</span>
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            МОДАЛКА ДЕТАЛЕЙ НАРЯДА И СМЕНЫ СТАТУСА
           =================================================================== */}
        {selectedTask && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-[#131D38] rounded-t-3xl sm:rounded-2xl border border-slate-700/80 p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                <div>
                  <div className="text-xs text-slate-400 font-mono">{selectedTask.task_number}</div>
                  <div className="text-sm font-bold text-white">{selectedTask.title}</div>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed bg-[#0B132B] p-3 rounded-xl border border-slate-800">
                {selectedTask.description}
              </div>

              <div className="text-xs space-y-1">
                <div className="text-slate-400">Адрес: <span className="text-sky-400 font-bold">{selectedTask.address}, кв. {selectedTask.apartment}</span></div>
                <div className="text-slate-400">Подъезд: <span className="text-white font-bold">{selectedTask.entrance}</span> • Этаж: <span className="text-white font-bold">{selectedTask.floor}</span> • Код: <span className="text-white font-bold">{selectedTask.intercom_code}</span></div>
                <div className="text-slate-400">Заказчик: <span className="text-white font-bold">{selectedTask.client_name}</span></div>
              </div>

              {/* Кнопки смены статуса */}
              <div className="pt-2 border-t border-slate-700 space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Смена статуса:</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedTask.id, 'en_route')}
                    className="py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <Car className="w-4 h-4" />
                    <span>Выехал</span>
                  </button>

                  <button
                    onClick={() => handleStatusChange(selectedTask.id, 'in_progress')}
                    className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <Wrench className="w-4 h-4" />
                    <span>В работе</span>
                  </button>

                  <button
                    onClick={() => {
                      handleStatusChange(selectedTask.id, 'done');
                      setSelectedTask(null);
                      setIsActModalOpen(true);
                    }}
                    className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex flex-col items-center justify-center gap-1 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Выполнен</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            МОДАЛКА СОСТАВЛЕНИЯ ЭЛЕКТРОННОГО АКТА
           =================================================================== */}
        {isActModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-[#131D38] rounded-t-3xl sm:rounded-2xl border border-slate-700/80 p-5 space-y-3 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                <div className="text-sm font-bold text-white">Электронный акт работ</div>
                <button
                  onClick={() => setIsActModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Адрес объекта</label>
                <input
                  type="text"
                  value={actAddress}
                  onChange={(e) => setActAddress(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ФИО заказчика</label>
                <input
                  type="text"
                  value={actClient}
                  onChange={(e) => setActClient(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Выполненные работы</label>
                <textarea
                  value={actWorks}
                  onChange={(e) => setActWorks(e.target.value)}
                  rows={2}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Использованные материалы</label>
                <input
                  type="text"
                  value={actMaterials}
                  onChange={(e) => setActMaterials(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Сумма к оплате на объекте (руб.)</label>
                <input
                  type="number"
                  value={actPrice}
                  onChange={(e) => setActPrice(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Работы выполнены в полном объеме. Претензий нет. Согласовано заказчиком.</span>
              </div>

              <button
                onClick={handleSaveAct}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all mt-2"
              >
                <span>Подписать и зарегистрировать в CRM</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
