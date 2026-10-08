/**
 * Типы данных для служебного мобильного приложения «Офис Работа»
 */

// Роли сотрудников компании
export type StaffRole = 
  | 'master'        // Сервисный мастер по ремонту домофонов и трубок
  | 'technician'    // Техник слаботочных систем
  | 'installer'     // Монтажник подъездного оборудования
  | 'dispatcher'    // Диспетчер / оператор распределения заявок
  | 'director'      // Руководитель компании / филиала
  | 'admin'         // Администратор CRM
  | 'superadmin';   // Главный инженер / суперадмин

// Статус рабочего дня / смены сотрудника
export type ShiftStatus = 'on_shift' | 'off_duty' | 'break';

// Приоритет наряда
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

// Статус выполнения наряда
export type TaskStatus = 
  | 'new'           // Новый наряд, поступил в диспетчерскую
  | 'assigned'      // Назначен конкретному мастеру
  | 'en_route'      // Мастер выехал на объект
  | 'in_progress'   // Мастер на объекте, выполняет работу
  | 'done'          // Работы успешно выполнены, акт оформлен
  | 'cancelled';    // Отменен (нет доступа, перенос жильцом и т.д.)

// Модель наряда / сервисной заявки
export interface StaffTask {
  id: string | number;
  task_number: string;              // Номер наряда, например "№ 2026-1042"
  title: string;                    // Заголовок (например: "Ремонт трубки УКП-7", "Замена электромагнитного замка")
  description: string;              // Описание проблемы абонента
  address: string;                  // Адрес дома: "ул. Красная, 125"
  entrance?: string;                // Подъезд: "2"
  floor?: string;                   // Этаж: "4"
  apartment?: string;               // Квартира: "48"
  intercom_code?: string;           // Код калитки / сервисный пароль: "#4589"
  client_name: string;              // ФИО жильца / контактного лица
  client_phone: string;             // Номер телефона для оперативной связи
  status: TaskStatus;               // Текущий статус наряда
  priority: TaskPriority;           // Срочность
  assigned_to_id?: string;          // ID назначенного сотрудника
  assigned_to_name?: string;        // ФИО назначенного мастера
  scheduled_time?: string;          // Назначенное время прибытия ("Сегодня к 14:30")
  created_at: string;               // Дата и время создания
  work_type: 'repair' | 'install' | 'maintenance' | 'inspection' | 'keys'; // Тип работы
  payment_amount?: number;          // Сумма к получению на объекте (если платная услуга)
  is_paid?: boolean;                // Оплачено ли онлайн
  notes?: string;                   // Служебные заметки диспетчера
  materials?: string[];             // Израсходованные комплектующие
  photos_before?: string[];         // Фото неисправности до ремонта
  photos_after?: string[];          // Фото результата после ремонта
}

// Электронный акт выполненных работ
export interface WorkAct {
  id: string;
  task_id: string | number;
  act_number: string;               // Номер акта "АКТ-2026/089"
  created_at: string;
  client_name: string;
  client_phone: string;
  address: string;
  apartment?: string;
  employee_name: string;
  employee_role: string;
  works_done: string;               // Перечень выполненных операций
  materials_used: string;           // Использованные материалы
  total_price: number;              // Итоговая стоимость
  client_signed: boolean;           // Подписано клиентом на экране
  client_signature_data?: string;   // Base64 подписи
}

// Профиль авторизованного сотрудника
export interface StaffUser {
  id: string;
  phone: string;
  full_name: string;
  email?: string;
  role: StaffRole;                  // Реальная роль из базы данных
  active_view_role: StaffRole;      // Активный режим отображения интерфейса (для тестирования)
  shift_status: ShiftStatus;        // Текущий статус («На смене» / «Выходной»)
  completed_today: number;          // Завершено нарядов сегодня
  total_earnings_today: number;     // Начислено за смену (руб.)
  rating: number;                   // Рейтинг мастера (например, 4.95)
}
