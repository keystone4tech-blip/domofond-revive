import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Payment = () => {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    // Отправляем событие о загрузке iframe в родительское окно
    const handleIframeLoad = () => {
      setIframeLoaded(true);
    };

    // Добавляем обработчик события загрузки iframe
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.addEventListener('load', handleIframeLoad);
    }

    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleIframeLoad);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-center mb-8">Оплата за техническое обслуживание</h1>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <iframe 
                src="https://pay.kk.bank/services/33936?hh" 
                frameBorder="0" 
                scrolling="no" 
                height="1000" 
                width="100%"
                title="Форма оплаты за техническое обслуживание"
                onLoad={() => setIframeLoaded(true)}
              ></iframe>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Payment;