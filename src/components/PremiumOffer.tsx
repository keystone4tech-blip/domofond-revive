import { Star, Smartphone, Video, HardDrive, ScanFace } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PremiumOffer = () => {
  const scrollToContact = () => {
    const element = document.getElementById("contact");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="container px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 sm:px-4 py-2 rounded-full mb-4">
            <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            <span className="text-sm sm:text-base font-semibold">Премиум предложение</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl mb-4">
            Умный видеодомофон нового поколения
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
            Революционная система безопасности с искусственным интеллектом для вашего дома
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <Card className="overflow-hidden border-2 border-primary/20 shadow-2xl">
            <CardContent className="p-4 sm:p-6 md:p-8 lg:p-12">
              <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-center">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Возможности системы</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ScanFace className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1 text-sm sm:text-base">Распознавание лиц</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Автоматическая идентификация жильцов и уведомления о незнакомых посетителях
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Smartphone className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1 text-sm sm:text-base">Видеозвонки на телефон</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Отвечайте на звонки с домофона из любой точки мира через мобильное приложение
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Video className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1 text-sm sm:text-base">Облачный видеоархив</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Все видеозаписи доступны в любое время через личный кабинет
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <HardDrive className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1 text-sm sm:text-base">Локальное хранение</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Дублирование записей на внутреннем накопителе для максимальной надежности
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6 mt-6 md:mt-0">
                  <div className="bg-primary/5 rounded-2xl p-4 sm:p-6 border border-primary/20">
                    <div className="text-center mb-4">
                      <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">от 25 000 ₽</div>
                      <p className="text-xs sm:text-sm text-muted-foreground">включая установку</p>
                    </div>
                    <ul className="space-y-2 mb-4 sm:mb-6 text-xs sm:text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-primary flex-shrink-0">✓</span>
                        <span>Гарантия 3 года</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-primary flex-shrink-0">✓</span>
                        <span>Бесплатное обслуживание 1 год</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-primary flex-shrink-0">✓</span>
                        <span>Настройка и обучение</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-primary flex-shrink-0">✓</span>
                        <span>Техподдержка 24/7</span>
                      </li>
                    </ul>
                    <Button onClick={scrollToContact} className="w-full" size="lg">
                      Получить консультацию
                    </Button>
                  </div>
                  
                  <p className="text-xs text-center text-muted-foreground px-2">
                    * Окончательная стоимость зависит от конфигурации и особенностей объекта
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default PremiumOffer;
