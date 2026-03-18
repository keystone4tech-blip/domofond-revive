import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Contact from "@/components/Contact";
import DocumentsList from "@/components/DocumentsList";
import Footer from "@/components/Footer";

const Kontakty = () => {
  const [isVisible, setIsVisible] = useState({
    content: false,
    documents: false
  });

  useEffect(() => {
    // Анимация содержимого (0.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 500);

    // Анимация документов (1.0 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, documents: true })), 1000);
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <div
          className={`${
            isVisible.content ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-700`}
        >
          <Contact />
        </div>

        <div
          className={`py-16 md:py-24 ${
            isVisible.documents ? 'opacity-100' : 'opacity-0'
          } transition-opacity duration-700`}
        >
          <div className="container">
            <DocumentsList />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Kontakty;