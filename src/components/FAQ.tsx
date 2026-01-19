import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Как быстро вы можете приехать на вызов?",
    answer: "Наши специалисты выезжают на объект в течение 2 часов после получения заявки в рабочее время. Также доступна срочная аварийная служба 24/7 для экстренных случаев."
  },
  {
    question: "Какая гарантия на выполненные работы?",
    answer: "Мы предоставляем гарантию до 3 лет на все виды работ и установленное оборудование. Гарантийный срок зависит от типа услуги и используемого оборудования."
  },
  {
    question: "Работаете ли вы с юридическими лицами?",
    answer: "Да, мы работаем как с физическими, так и с юридическими лицами. Для организаций предоставляем полный пакет документов, заключаем договоры на обслуживание."
  },
  {
    question: "Какие марки домофонов вы обслуживаете?",
    answer: "Мы работаем со всеми популярными марками домофонного оборудования: Cyfral, Vizit, Eltis, Forward, Metakom и другими. Также устанавливаем современные IP-домофоны."
  },
  {
    question: "Можно ли заказать установку домофона в частный дом?",
    answer: "Да, мы устанавливаем домофонные системы в частных домах, коттеджах и на дачах. Предлагаем как простые аудиодомофоны, так и современные видеодомофоны с Wi-Fi."
  },
  {
    question: "Какие способы оплаты вы принимаете?",
    answer: "Принимаем наличные, безналичный расчет по карте, банковский перевод для организаций. Оплата производится после выполнения работ и подписания акта."
  }
];

const FAQ = () => {
  return (
    <section id="faq" className="py-16 md:py-24 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl mb-4">
            Часто задаваемые вопросы
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Ответы на популярные вопросы о наших услугах
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border rounded-lg px-6 bg-card"
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
