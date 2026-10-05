// ============================================================================
// Описание типов и структуры прав доступа для CRM-системы «Домофондар»
// ============================================================================

// Интерфейс роли CRM из таблицы crm_roles
export interface CRMRole {
  id: string;                   // Уникальный строковый идентификатор роли (например: director, master, manager)
  name: string;                 // Понятное отображаемое название (например: "Директор", "Мастер")
  description: string | null;   // Описание обязанностей и сферы ответственности роли
  permissions: string[];        // Массив идентификаторов вкладок CRM, к которым разрешен доступ
  is_system: boolean;           // Флаг системной роли (системные роли нельзя удалить)
  created_at?: string;          // Дата создания
  updated_at?: string;          // Дата последнего обновления
}

// Описание вкладки CRM для конструктора прав
export interface CRMTabDefinition {
  id: string;                   // Идентификатор вкладки (совпадает с activeTab в CRM.tsx)
  label: string;                // Название вкладки на русском языке
  description: string;          // Краткое пояснение назначения вкладки
  category: "operations" | "catalog" | "management"; // Категория для группировки в UI
}

// Алиас для обратной совместимости
export type FSMTabDefinition = CRMTabDefinition;

// Полный реестр всех 17 вкладок CRM-системы «Домофондар»
export const CRM_TABS: CRMTabDefinition[] = [
  // Операционный блок
  { 
    id: "dashboard", 
    label: "Панель управления", 
    description: "Сводные показатели, статистика по выездам, быстрый доступ к задачам",
    category: "operations"
  },
  { 
    id: "tasks", 
    label: "Задачи", 
    description: "Управление сервисными задачами, назначение мастеров, контроль исполнения",
    category: "operations"
  },
  {
    id: "requests",
    label: "Заявки клиентов",
    description: "Поток заявок от жильцов на монтаж, обслуживание и ключи",
    category: "operations"
  },
  {
    id: "new-buildings",
    label: "Новые дома",
    description: "Объекты на монтаже: заявки, контроль оборудования, история подъездов и выгрузки",
    category: "operations"
  },
  {
    id: "installer-sheet",
    label: "Лист монтажника", 
    description: "Поквартирный учет оборудования по домам и формирование актов выдачи",
    category: "operations"
  },

  // Справочники и фонд
  {
    id: "products",
    label: "Товары и услуги",
    description: "Каталог оборудования, услуг монтажа и расходных материалов",
    category: "catalog"
  },
  {
    id: "equipment-matching",
    label: "Подбор оборудования",
    description: "Сценарии по анкете жильца → услуги → привязанное оборудование",
    category: "catalog"
  },
  {
    id: "addresses",
    label: "Адреса и подъезды", 
    description: "Структура жилого фонда, адреса, подъезды и метки умного домофона",
    category: "catalog"
  },
  { 
    id: "accounts", 
    label: "Лицевые счета", 
    description: "База лицевых счетов абонентов, реестры начислений и баланса",
    category: "catalog"
  },
  { 
    id: "logins", 
    label: "Логопасы", 
    description: "Учетные записи (логины и пароли) для мобильного приложения домофона",
    category: "catalog"
  },

  // Управление и аналитика
  { 
    id: "employees", 
    label: "Сотрудники и роли", 
    description: "Кадровый состав, создание ролей и гибкая настройка прав доступа",
    category: "management"
  },
  {
    id: "clients",
    label: "Клиенты / Объекты",
    description: "База абонентов, жильцов и обслуживаемых объектов",
    category: "management"
  },
  {
    id: "cabinets",
    label: "Личные кабинеты",
    description: "Зарегистрированные пользователи: поиск, фильтры, удаление кабинетов",
    category: "management"
  },
  { 
    id: "map", 
    label: "Карта мастеров", 
    description: "Онлайн-отслеживание местоположения монтажников и сервисных мастеров",
    category: "management"
  },
  { 
    id: "reports", 
    label: "Финансовые отчеты", 
    description: "Отчеты по выручке, выполненным заявкам и задолженностям",
    category: "management"
  },
  { 
    id: "verification", 
    label: "Верификация аккаунтов", 
    description: "Проверка документов абонентов и заявок на смену персональных данных",
    category: "management"
  },
  { 
    id: "instructions", 
    label: "Инструкция", 
    description: "База знаний, производственные регламенты и пошаговые инструкции для сотрудников",
    category: "management"
  },
];

// Экспорт алиаса для обратной совместимости
export const FSM_TABS = CRM_TABS;

