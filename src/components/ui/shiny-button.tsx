import type React from "react";

// Пропсы для интерактивной кнопки с эффектом перелива
interface ShinyButtonProps {
  children: React.ReactNode;          // Содержимое кнопки (текст, иконка)
  onClick?: (e: React.MouseEvent) => void; // Обработчик клика
  className?: string;                 // Дополнительные стили от Tailwind
  type?: "button" | "submit" | "reset"; // Тип кнопки
  disabled?: boolean;                 // Флаг отключения кнопки
  href?: string;                      // Если передано, рендерится как ссылка <a>
  target?: string;                    // Target для ссылки <a>
  rel?: string;                       // Rel для ссылки <a>
}

/**
 * Премиальный компонент ShinyButton
 * Поддерживает анимации вращающегося градиента контура и точечную подложку при наведении.
 * Рендерится как <a> при наличии props.href, иначе как <button>.
 * Стили вынесены в глобальный файл src/index.css для корректного парсинга @property.
 */
export function ShinyButton({ 
  children, 
  onClick, 
  className = "", 
  type = "button", 
  disabled = false,
  href,
  target,
  rel
}: ShinyButtonProps) {
  // Базовый класс .shiny-cta отвечает за анимацию границы и цвета бренда.
  // Класс .rounded-full задает овальную форму (360px) по умолчанию, но может переопределяться.
  const fullClassName = `shiny-cta ${className}`;

  // Рендеринг в виде ссылки <a>
  if (href) {
    return (
      <a 
        href={href} 
        target={target} 
        rel={rel} 
        className={fullClassName}
        onClick={(e) => {
          // Если кнопка отключена, предотвращаем переход по ссылке
          if (disabled) {
            e.preventDefault();
            return;
          }
          if (onClick) {
            onClick(e);
          }
        }}
      >
        <span>{children}</span>
      </a>
    );
  }

  // Рендеринг в виде стандартной кнопки <button>
  return (
    <button 
      type={type} 
      disabled={disabled} 
      className={fullClassName} 
      onClick={onClick}
    >
      <span>{children}</span>
    </button>
  );
}
