import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Kontakty = () => {
  const [isVisible, setIsVisible] = useState({
    content: false
  });

  useEffect(() => {
    // Анимация содержимого (0.5 сек)
    setTimeout(() => setIsVisible(prev => ({ ...prev, content: true })), 500);
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main
        className={`${
          isVisible.content ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-700`}
      >
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Kontakty;