import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Компонент автоматической прокрутки страницы:
 * 1. При переходе между страницами (смена pathname) скроллит страницу наверх.
 * 2. При переключении вкладок через URL-параметры (например, ?tab=requisites или ?tab=documents) скроллит страницу наверх к вкладкам.
 * 3. Если передан якорь (например, /#about или /#services), плавно скроллит к соответствующей секции.
 */
const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // Если в URL передан якорь (хэш) — скроллим к соответствующему элементу
    if (hash) {
      const targetId = hash.replace("#", "");
      console.log(`[ScrollToTop] Обнаружен хэш ${hash}, поиск элемента #${targetId}...`);
      
      // Небольшая задержка, чтобы DOM успел отрендериться
      const timer = setTimeout(() => {
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }, 100);

      return () => clearTimeout(timer);
    }

    // Иначе прокручиваем страницу наверх при смене пути или query-параметров (?tab=...)
    console.log(`[ScrollToTop] Переход на: ${pathname}${search}, прокрутка страницы наверх`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname, search, hash]);

  return null;
};

export default ScrollToTop;