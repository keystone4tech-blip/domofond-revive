import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import PremiumOffer from "@/components/PremiumOffer";
import { PromotionsSection } from "@/components/PromotionsSection";
import { NewsSection } from "@/components/NewsSection";
import About from "@/components/About";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import Stats from "@/components/Stats";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <PremiumOffer />
        <PromotionsSection />
        <Stats />
        <About />
        <NewsSection />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
