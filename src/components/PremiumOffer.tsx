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
      <div className="container">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Star className="h-5 w-5 fill-current" />
            <span className="font-semibold">Премиум предложение</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
            Умный видеодомофон нового поколения
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Революционная система безопасности с искусственным интеллектом для вашего дома
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <Card className="overflow-hidden border-2 border-primary/20 shadow-2xl">
            <CardContent className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-2xl font-bold mb-6">Возможности системы</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ScanFace className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Распознавание лиц</h4>
                        <p className="text-sm text-muted-foreground">
                          Автоматическая идентификация жильцов и уведомления о незнакомых посетителях
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Smartphone className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Видеозвонки на телефон</h4>
                        <p className="text-sm text-muted-foreground">
                          Отвечайте на звонки с домофона из любой точки мира через мобильное приложение
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Video className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Облачный видеоархив</h4>
                        <p className="text-sm text-muted-foreground">
                          Все видеозаписи доступны в любое время через личный кабинет
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <HardDrive className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Локальное хранение</h4>
                        <p className="text-sm text-muted-foreground">
                          Дублирование записей на внутреннем накопителе для максимальной надежности
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-primary/5 rounded-2xl p-6 border border-primary/20">
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-primary mb-2">от 25 000 ₽</div>
                      <p className="text-sm text-muted-foreground">включая установку</p>
                    </div>
                    <ul className="space-y-2 mb-6 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="text-primary">✓</span>
                        <span>Гарантия 3 года</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-primary">✓</span>
                        <span>Бесплатное обслуживание 1 год</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-primary">✓</span>
                        <span>Настройка и обучение</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-primary">✓</span>
                        <span>Техподдержка 24/7</span>
                      </li>
                    </ul>
                    <Button onClick={scrollToContact} className="w-full" size="lg">
                      Получить консультацию
                    </Button>
                  </div>
                  
                  <p className="text-xs text-center text-muted-foreground">
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
