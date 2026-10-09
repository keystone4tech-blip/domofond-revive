// ============================================================================
// src/components/crm/PageInstructionAccordion.tsx
// Адаптивная плашка-инструкция для каждой страницы CRM «Домофондар»
// Размещается в самом верху активной вкладки. По умолчанию закрыта, открывается по клику.
// Содержит 3 обязательных блока простым языком:
// 1. Что на этой странице
// 2. Для чего она нужна
// 3. Порядок работы (пошаговая инструкция)
// ============================================================================

import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  MousePointerClick, 
  Lightbulb,
  X
} from "lucide-react";
import { getPageQuickGuide, PageQuickGuide } from "@/data/pageQuickGuides";

interface PageInstructionAccordionProps {
  tabId: string;
  className?: string;
}

export const PageInstructionAccordion: React.FC<PageInstructionAccordionProps> = ({ 
  tabId, 
  className = "" 
}) => {
  // Состояние: открыта или закрыта инструкция (по умолчанию закрыта для чистоты экрана)
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Получаем данные инструкции для текущей вкладки
  const guide: PageQuickGuide | undefined = getPageQuickGuide(tabId);

  // При смене вкладки автоматически закрываем плашку, чтобы не загромождать рабочее поле
  useEffect(() => {
    setIsOpen(false);
    console.log(`[PageInstructionAccordion] Переключение вкладки на "${tabId}". Инструкция готова:`, !!guide);
  }, [tabId]);

  // Если для этой вкладки нет инструкции (или это служебная вкладка), не рендерим ничего
  if (!guide) {
    return null;
  }

  // Переключение состояния аккордеона с логированием
  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    console.log(`[PageInstructionAccordion] Инструкция для "${guide.tabTitle}" (${tabId}): ${nextState ? "ОТКРЫТА" : "ЗАКРЫТА"}`);
  };

  return (
    <div className={`w-full mb-4 transition-all duration-200 ${className}`}>
      {/* Верхняя компактная плашка-кнопка (в закрытом состоянии занимает минимум места) */}
      <div
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={`group cursor-pointer select-none rounded-xl border transition-all duration-200 flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm ${
          isOpen
            ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100 dark:bg-amber-950/20 shadow-amber-500/5 rounded-b-none"
            : "bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200"
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Иконка с цветным кружком */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isOpen 
              ? "bg-amber-500 text-white shadow-sm" 
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white"
          }`}>
            <BookOpen className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Название плашки */}
            <span className="font-bold text-xs sm:text-sm tracking-tight truncate">
              Инструкция для страницы: <span className="text-amber-600 dark:text-amber-400 font-extrabold">{guide.tabTitle}</span>
            </span>

            {/* Бейдж категории */}
            {guide.badge && (
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                {guide.badge}
              </span>
            )}

            <span className="text-[11px] text-muted-foreground hidden lg:inline font-normal">
              — {isOpen ? "нажмите для сворачивания регламента" : "нажмите для ознакомления с пошаговым регламентом"}
            </span>
          </div>
        </div>

        {/* Правая часть: кнопка/стрелка переключения */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 hidden sm:inline">
            {isOpen ? "Свернуть" : "Регламент работы"}
          </span>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
            isOpen 
              ? "bg-amber-500/20 border-amber-500/30 text-amber-800 dark:text-amber-200" 
              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 group-hover:text-amber-600 group-hover:border-amber-400"
          }`}>
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Развернутое содержимое инструкции */}
      {isOpen && (
        <div className="bg-white dark:bg-slate-900 border-x border-b border-amber-500/30 rounded-b-xl p-3.5 sm:p-5 space-y-4 shadow-md animate-in fade-in-50 slide-in-from-top-2 duration-200">
          
          {/* Сетка: 1. Что на странице + 2. Для чего она */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            
            {/* Блок 1: Что на этой странице */}
            <div className="bg-slate-50 dark:bg-slate-850/60 p-3 sm:p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs sm:text-sm">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>1. Назначение и состав раздела:</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {guide.whatIsHere}
              </p>
            </div>

            {/* Блок 2: Для чего она нужна */}
            <div className="bg-slate-50 dark:bg-slate-850/60 p-3 sm:p-4 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>2. Задачи и регламентные цели:</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {guide.whyNeedIt}
              </p>
            </div>
          </div>

          {/* Блок 3: Порядок работы (пошаговая инструкция) */}
          <div className="bg-amber-500/5 dark:bg-amber-950/20 p-3.5 sm:p-4 rounded-xl border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2 text-amber-800 dark:text-amber-300 font-bold text-xs sm:text-sm">
              <MousePointerClick className="w-4 h-4 shrink-0" />
              <span>3. Порядок работы (пошаговая инструкция):</span>
            </div>

            {guide.howToWork.summary && (
              <p className="text-xs text-muted-foreground mb-3 font-medium">
                {guide.howToWork.summary}
              </p>
            )}

            {/* Карточки пошаговых действий */}
            <div className="space-y-2.5">
              {guide.howToWork.steps.map((step) => (
                <div 
                  key={step.stepNumber} 
                  className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-amber-500/25 flex flex-col sm:flex-row sm:items-start gap-2.5 shadow-xs"
                >
                  {/* Номер шага */}
                  <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                    {step.stepNumber}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                      <span>{step.title}</span>
                    </div>

                    {/* Что конкретно нажать / сделать */}
                    <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-snug">
                      👉 <span className="font-medium">{step.action}</span>
                    </div>

                    {/* Что произойдет в результате */}
                    {step.result && (
                      <div className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span><strong>Результат:</strong> {step.result}</span>
                      </div>
                    )}

                    {/* Полезная рекомендация */}
                    {step.tip && (
                      <div className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded border border-amber-500/20 mt-1 flex items-start gap-1">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span><strong>Регламентное примечание:</strong> {step.tip}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Шпаргалка по главным кнопкам на экране (если задано) */}
          {guide.keyButtons && guide.keyButtons.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-850/60 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800">
              <span className="text-xs font-bold text-foreground block mb-2">
                🎛️ Ключевые элементы управления раздела:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {guide.keyButtons.map((btn, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-bold text-primary block leading-tight mb-0.5">{btn.name}</span>
                    <span className="text-[11px] text-muted-foreground leading-tight block">{btn.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Важное правило или предупреждение безопасности */}
          {guide.importantNote && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-500/30 p-2.5 sm:p-3 rounded-xl flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Обязательное требование регламента:</strong> {guide.importantNote}
              </div>
            </div>
          )}

          {/* Нижняя кнопка быстрого закрытия */}
          <div className="flex justify-end pt-1">
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Свернуть регламент</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageInstructionAccordion;
