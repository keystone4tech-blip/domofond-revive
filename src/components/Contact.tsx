import { useState } from "react";
import { Phone, Mail, MapPin, Clock, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2, { message: "Имя должно содержать минимум 2 символа" }).max(100),
  phone: z.string().trim().min(10, { message: "Введите корректный номер телефона" }).max(20),
  message: z.string().trim().min(10, { message: "Сообщение должно содержать минимум 10 символов" }).max(1000)
});

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    message: ""
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      contactSchema.parse(formData);
      setErrors({});
      
      // Simulate form submission
      toast({
        title: "Заявка отправлена!",
        description: "Мы свяжемся с вами в ближайшее время.",
      });
      
      setFormData({ name: "", phone: "", message: "" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: { [key: string]: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: ""
      });
    }
  };

  return (
    <section id="contact" className="py-16 md:py-24">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4">
            Свяжитесь с нами
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Оставьте заявку и мы перезвоним вам в течение 15 минут
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Телефон / WhatsApp</h3>
                <a href="tel:+79034118393" className="text-muted-foreground hover:text-primary transition-colors block">
                  +7 (903) 411-83-93
                </a>
                <p className="text-sm text-muted-foreground mt-1">Круглосуточная линия</p>
                <div className="flex gap-2 mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="tel:+79034118393">
                      <Phone className="h-4 w-4 mr-1" />
                      Позвонить
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="https://wa.me/79034118393" target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4 mr-1" />
                      WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Email</h3>
                <a href="mailto:domofondar@mail.ru" className="text-muted-foreground hover:text-primary transition-colors block">
                  domofondar@mail.ru
                </a>
                <p className="text-sm text-muted-foreground mt-1">Ответим в течение часа</p>
                <div className="mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="mailto:domofondar@mail.ru">
                      <Mail className="h-4 w-4 mr-1" />
                      Написать
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <Send className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Telegram</h3>
                <a href="https://t.me/domofondar123" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors block">
                  @domofondar123
                </a>
                <a href="https://t.me/Domofondar_bot" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary transition-colors mt-1 block">
                  Telegram бот
                </a>
                <div className="flex gap-2 mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="https://t.me/domofondar123" target="_blank" rel="noopener noreferrer">
                      <Send className="h-4 w-4 mr-1" />
                      Открыть чат
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="https://t.me/Domofondar_bot" target="_blank" rel="noopener noreferrer">
                      Telegram бот
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Адрес офиса</h3>
                <p className="text-muted-foreground">г. Краснодар, проезд Репина 1</p>
                <p className="text-sm text-muted-foreground mt-1">2 этаж, офис 134</p>
                <div className="mt-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="https://yandex.ru/maps/?text=Краснодар, проезд Репина 1" target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4 mr-1" />
                      Посмотреть на карте
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Режим работы</h3>
                <p className="text-muted-foreground">Пн-Пт: 9:00 - 17:00</p>
                <p className="text-sm text-muted-foreground mt-1">Аварийная служба: 24/7</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                name="name"
                placeholder="Ваше имя *"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <Input
                name="phone"
                placeholder="Телефон *"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone}</p>
              )}
            </div>

            <div>
              <Textarea
                name="message"
                placeholder="Опишите вашу проблему или вопрос *"
                rows={5}
                value={formData.message}
                onChange={handleChange}
                className={errors.message ? "border-destructive" : ""}
              />
              {errors.message && (
                <p className="text-sm text-destructive mt-1">{errors.message}</p>
              )}
            </div>

            <Button type="submit" size="lg" className="w-full gradient-primary text-primary-foreground">
              Отправить заявку
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Нажимая кнопку, вы соглашаетесь с политикой конфиденциальности
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Contact;
