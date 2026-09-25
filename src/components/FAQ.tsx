import { useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, ShieldCheck, CreditCard, Wrench, 
  Smartphone, Building2, KeyRound, CalendarDays 
} from "lucide-react";

/**
 * Структура вопроса в базе знаний FAQ
 */
interface FAQItem {
  id: string;
  category: string;
  icon: any;
  question: string;
  answer: string;
}

/**
 * Проверенная база актуальных вопросов и ответов ООО «ДомофонДар»
 */
const faqs: FAQItem[] = [
  {
    id: "repair-time",
    category: "Сроки сервиса",
    icon: Clock,
    question: "В какие сроки мастер приезжает на ремонт домофона?",
    answer: "Выполнение заявок на диагностику и ремонт оборудования осуществляется в срок до 2 рабочих дней — это лучшая скорость обслуживания в Краснодаре. Прием онлайн-заявок через сайт домофондар.рф и Личный кабинет абонента ведется круглосуточно, а выезды мастеров производятся в рабочие часы службы сервиса: Пн–пт с 9:00 до 17:00, сб с 9:00 до 15:00."
  },
  {
    id: "warranty",
    category: "Гарантия",
    icon: ShieldCheck,
    question: "Какая гарантия предоставляется на оборудование и работы?",
    answer: "На все устанавливаемое оборудование действует официальная гарантия завода-изготовителя и компании ООО «ДомофонДар» до 3 лет. На выполненные нашими специалистами монтажные и ремонтные работы предоставляется гарантия 1 год по официальному договору."
  },
  {
    id: "payment-methods",
    category: "Оплата",
    icon: CreditCard,
    question: "Как оплатить техническое обслуживание домофона?",
    answer: "Оплатить ежемесячное обслуживание или заказ услуг можно онлайн без комиссии в Личном кабинете на сайте домофондар.рф с помощью Системы быстрых платежей (СБП) или банковской картой любого банка РФ. Также оплата принимается по бумажной или электронной квитанции в кассах банков. Для ТСЖ и юридических лиц доступен безналичный расчет по расчетному счету."
  },
  {
    id: "request-submit",
    category: "Заявки",
    icon: Wrench,
    question: "Как подать заявку на вызов мастера или ремонт?",
    answer: "Удобнее и быстрее всего подать заявку через Личный кабинет абонента на сайте домофондар.рф — вы сможете в реальном времени отслеживать статус обращения и время визита мастера. Также заявку можно оформить по телефону диспетчерской службы: +7 (903) 411-83-93."
  },
  {
    id: "keys-order",
    category: "Ключи",
    icon: KeyRound,
    question: "Как заказать дополнительные ключи от подъезда?",
    answer: "Заказать бесконтактные RFID-ключи с криптографической защитой от дублирования можно через Личный кабинет или по телефону. Наш мастер оперативно привезет ключи и запрограммирует их непосредственно у вашей двери с проверкой открывания."
  },
  {
    id: "smart-intercom",
    category: "Умный домофон",
    icon: Smartphone,
    question: "Как работает сервис «Умный домофон» и видеозвонки?",
    answer: "Умный домофон позволяет принимать видеозвонки с подъездной двери прямо на смартфон в приложении (iOS/Android), открывать подъезд гостям или курьерам из любой точки мира, просматривать видеокамеры двора и архивы до 5 дней, а также заходить в подъезд по распознаванию лица (Face ID за 0.2 сек) или через Bluetooth без ключей."
  },
  {
    id: "working-hours",
    category: "График",
    icon: CalendarDays,
    question: "Какой график работы офиса и диспетчерской службы?",
    answer: "Офис компании и служба выездных мастеров работают: с понедельника по пятницу с 9:00 до 17:00, в субботу с 9:00 до 15:00, воскресенье — выходной день. Отправка онлайн-заявок на сайте и оплата услуг в Личном кабинете доступны круглосуточно без перерывов."
  },
  {
    id: "b2b-clients",
    category: "Юрлицам и ТСЖ",
    icon: Building2,
    question: "Работаете ли вы с ТСЖ, управляющими компаниями и юридическими лицами?",
    answer: "Да, мы обслуживаем как многоквартирные жилые дома (МКД), так и офисные центры, коммерческие здания и склады. Предоставляем полный комплект закрывающих бухгалтерских документов, работаем по безналичному расчету и закрепляем персонального инженера за каждым объектом."
  }
];

const FAQ = () => {
  // Логирование монтирования компонента FAQ
  useEffect(() => {
    console.log("[FAQ] Компонент FAQ смонтирован. Загружено 8 актуальных вопросов с проверенными данными.");
  }, []);

  return (
    <section id="faq" className="py-8 md:py-16 bg-transparent">
      <div className="container px-4">
        <div className="text-center mb-10 sm:mb-12">
          {/* Унифицированный градиентный заголовок */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl mb-3 section-title-gradient">
            Часто задаваемые вопросы
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Вся необходимая информация о сроках ремонта, гарантиях, оплате и возможностях умных домофонов
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-3.5">
            {faqs.map((faq) => {
              const Icon = faq.icon;
              return (
                <AccordionItem 
                  key={faq.id} 
                  value={faq.id}
                  className="border border-border/60 hover:border-primary/40 rounded-2xl px-4 sm:px-6 bg-card/60 backdrop-blur-sm transition-all duration-200 overflow-hidden shadow-sm"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-4 sm:py-5 gap-3">
                    <div className="flex items-center gap-3 w-full pr-2">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-semibold text-primary border-primary/30">
                            {faq.category}
                          </Badge>
                        </div>
                        <span className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                          {faq.question}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs sm:text-sm text-muted-foreground pb-5 pt-1 pl-11 pr-2 leading-relaxed border-t border-border/40 mt-1">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
