import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Динамически обновляет meta-теги страницы на основе данных из seo_page_meta.
 * Если для текущего пути нет записи — оставляет дефолтные теги из index.html.
 */
const SEOHead = () => {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const apply = async () => {
      const { data } = await supabase
        .from("seo_page_meta")
        .select("*")
        .eq("page_path", location.pathname)
        .maybeSingle();

      if (cancelled || !data) return;

      if (data.title) document.title = data.title;
      setMeta("name", "description", data.description);
      setMeta("name", "keywords", data.keywords);
      setMeta("property", "og:title", data.og_title || data.title);
      setMeta("property", "og:description", data.og_description || data.description);
      if (data.og_image) setMeta("property", "og:image", data.og_image);
      setLink("canonical", data.canonical_url);

      // JSON-LD
      removeJsonLd();
      if (data.json_ld) {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "seo-jsonld";
        script.textContent = typeof data.json_ld === "string" ? data.json_ld : JSON.stringify(data.json_ld);
        document.head.appendChild(script);
      }

      // H1 — обновляем первый h1 на странице, если задан
      if (data.h1) {
        const h1 = document.querySelector("h1");
        if (h1 && h1.textContent !== data.h1) {
          h1.textContent = data.h1;
        }
      }
    };

    apply();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return null;
};

function setMeta(attr: "name" | "property", key: string, value: string | null | undefined) {
  if (!value) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel: string, href: string | null | undefined) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function removeJsonLd() {
  const old = document.getElementById("seo-jsonld");
  if (old) old.remove();
}

export default SEOHead;
