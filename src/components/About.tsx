import { useEffect } from "react";

const About = () => {
  // Логирование монтирования
  useEffect(() => {
    console.log("[About] Секция 'Почему выбирают нас' смонтирована. Заголовок переведен на единый градиентный стиль.");
  }, []);

  return (
    <section id="about" className="py-8 md:py-12">
      <div className="container">
        <div className="grid gap-8">
          <div className="text-center">
            {/* Унифицированный градиентный заголовок */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl mb-4 section-title-gradient text-center">
              Почему выбирают нас
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="text-lg text-center">
                <span className="font-semibold text-foreground">Домофондар</span> — это профессиональная команда
                специалистов с многолетним опытом работы в сфере установки и обслуживания домофонных систем.
              </p>
              <p className="text-center">
                Мы работаем как с жилыми комплексами, так и с коммерческими объектами, предлагая индивидуальный
                подход к каждому клиенту. Наши специалисты регулярно проходят обучение и сертификацию, чтобы
                предоставлять услуги высочайшего качества.
              </p>
              <p className="text-center">
                Используем только проверенное оборудование от ведущих производителей и предоставляем расширенную
                гарантию на все выполненные работы.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
