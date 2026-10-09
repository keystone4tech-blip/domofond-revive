import React, { useState, useMemo } from "react";
import { 
  BookOpen, Search, Filter, CheckCircle2, AlertTriangle, 
  Lightbulb, ArrowRight, UserCheck, Shield, ChevronDown, 
  ChevronUp, ExternalLink, HelpCircle, Sparkles, Layers,
  LayoutDashboard, ClipboardList, FileText, Package, Users, 
  Building2, MapPin, BarChart3, ShieldCheck, FileSpreadsheet, 
  DoorClosed, KeyRound, ClipboardCheck, Wrench, Construction
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useUserRole } from "@/hooks/useUserRole";
import { FSM_INSTRUCTIONS, FSMSectionInstruction, InstructionScenario } from "@/data/fsmInstructionsData";
import { cn } from "@/lib/utils";

// Маппинг иконок к идентификаторам вкладок
const TAB_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutDashboard,
  tasks: ClipboardList,
  requests: FileText,
  "new-buildings": Construction,
  "installer-sheet": ClipboardCheck,
  products: Package,
  "equipment-matching": Wrench,
  addresses: DoorClosed,
  accounts: FileSpreadsheet,
  logins: KeyRound,
  employees: Users,
  clients: Building2,
  cabinets: Users,
  map: MapPin,
  reports: BarChart3,
  verification: ShieldCheck,
};

interface InstructionsManagerProps {
  onNavigateTab?: (tabId: string) => void; // Быстрый переход в соответствующий раздел CRM
}

export const InstructionsManager: React.FC<InstructionsManagerProps> = ({ onNavigateTab }) => {
  // Хук прав текущего сотрудника
  const { hasPermission, isAdmin, roles, assignedRoles, getRoleDisplayName } = useUserRole();

  // Поисковый запрос
  const [searchQuery, setSearchQuery] = useState("");
  
  // Режим фильтрации: "my" (только мои доступные разделы) или "all" (все разделы базы знаний)
  const [scopeFilter, setScopeFilter] = useState<"my" | "all">(isAdmin ? "all" : "my");

  // Фильтр по категориям: all | operations | catalog | management
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Состояние развернутых карточек разделов: ключ tabId -> boolean (по умолчанию ВСЕ СВЕРНУТЫ!)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Раскрытые сценарии внутри разделов
  const [expandedScenarios, setExpandedScenarios] = useState<Record<string, boolean>>({});

  // Переключение раскрытия карточки раздела
  const toggleSection = (tabId: string) => {
    console.log(`[InstructionsManager] Переключение карточки раздела: ${tabId}`);
    setExpandedSections((prev) => ({
      ...prev,
      [tabId]: !prev[tabId],
    }));
  };

  // Развернуть все / Свернуть все
  const handleExpandAll = (expand: boolean) => {
    const newState: Record<string, boolean> = {};
    filteredInstructions.forEach((item) => {
      newState[item.tabId] = expand;
    });
    setExpandedSections(newState);
  };

  // Переключение раскрытия сценария внутри карточки
  const toggleScenario = (scenarioId: string) => {
    setExpandedScenarios((prev) => ({
      ...prev,
      [scenarioId]: !prev[scenarioId],
    }));
  };

  // Фильтрация инструкций с учетом прав доступа и поискового запроса
  const filteredInstructions = useMemo(() => {
    return FSM_INSTRUCTIONS.filter((item) => {
      // 1. Фильтр по правам текущего пользователя:
      if (scopeFilter === "my" && !hasPermission(item.tabId)) {
        return false;
      }

      // 2. Фильтр по категории (Операции / Справочники / Управление)
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

      // 3. Поиск по тексту (название, описание, возможности, шаги сценариев)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesPurpose = item.purpose.toLowerCase().includes(query);
        const matchesTarget = item.targetAudience.toLowerCase().includes(query);
        const matchesFeatures = item.whatCanDo.some((f) => f.toLowerCase().includes(query));
        const matchesScenarios = item.scenarios.some((s) => 
          s.title.toLowerCase().includes(query) ||
          s.steps.some((st) => st.title.toLowerCase().includes(query) || st.description.toLowerCase().includes(query))
        );

        return matchesTitle || matchesPurpose || matchesTarget || matchesFeatures || matchesScenarios;
      }

      return true;
    });
  }, [scopeFilter, categoryFilter, searchQuery, hasPermission]);

  // Подсчет доступных сотруднику разделов
  const myAccessibleCount = useMemo(() => {
    return FSM_INSTRUCTIONS.filter((item) => hasPermission(item.tabId)).length;
  }, [hasPermission]);

  // Получаем красивое русское название текущей роли
  const currentRoleRussianName = useMemo(() => {
    return getRoleDisplayName();
  }, [getRoleDisplayName]);

  return (
    <div className="space-y-6 pb-12">
      {/* Верхний приветственный блок (Hero Card) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 md:p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/20 text-blue-200">
            <BookOpen className="h-3.5 w-3.5" />
            <span>База знаний и регламенты CRM «Домофондар»</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Инструкции и регламенты для сотрудников
          </h1>

          <p className="text-sm md:text-base text-blue-100/90 leading-relaxed">
            Все разделы представлены в структурированном виде. Выберите интересующий раздел или воспользуйтесь поиском, чтобы ознакомиться с регламентами и пошаговыми сценариями работы.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-blue-200">
            <div className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2.5 py-1">
              <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ваша роль: <strong className="text-white font-bold">{currentRoleRussianName}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/20 rounded-lg px-2.5 py-1">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>Доступно разделов в CRM: <strong className="text-white">{myAccessibleCount} из {FSM_INSTRUCTIONS.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Декоративные фоновые элементы */}
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-12 bottom-0 opacity-10 pointer-events-none hidden md:block">
          <BookOpen className="h-48 w-48 text-white" />
        </div>
      </div>

      {/* Панель фильтров и поиска */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card/60 backdrop-blur-sm border rounded-xl p-4 shadow-sm">
        {/* Поисковая строка */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Поиск по разделам, задачам, кнопкам, регламентам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/90 text-sm"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              Очистить
            </button>
          )}
        </div>

        {/* Переключатель режима (Мои разделы / Все разделы) */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              onClick={() => setScopeFilter("my")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                scopeFilter === "my" 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Только мои ({myAccessibleCount})
            </button>
            <button
              onClick={() => setScopeFilter("all")}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                scopeFilter === "all" 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Все ({FSM_INSTRUCTIONS.length})
            </button>
          </div>
        </div>

        {/* Фильтр по категории */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "Все" },
            { id: "operations", label: "Операции" },
            { id: "catalog", label: "Справочники" },
            { id: "management", label: "Управление" },
          ].map((cat) => (
            <Button
              key={cat.id}
              variant={categoryFilter === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat.id)}
              className="text-xs shrink-0"
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Быстрое управление раскрытием списка */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Найдено разделов: <strong>{filteredInstructions.length}</strong></span>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => handleExpandAll(true)}
            className="hover:text-primary transition-colors hover:underline"
          >
            Развернуть все
          </button>
          <span>•</span>
          <button 
            onClick={() => handleExpandAll(false)}
            className="hover:text-primary transition-colors hover:underline"
          >
            Свернуть все
          </button>
        </div>
      </div>

      {/* Компактный список разделов (Аккордеон) */}
      {filteredInstructions.length === 0 ? (
        <Card className="text-center p-8 border-dashed">
          <CardContent className="space-y-3 pt-6">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto stroke-1" />
            <h3 className="text-base font-bold text-foreground">Инструкции не найдены</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              По вашему запросу «{searchQuery}» ничего не найдено. Попробуйте изменить формулировку поиска или переключите фильтр на «Все разделы».
            </p>
            <Button variant="outline" size="sm" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setScopeFilter("all"); }}>
              Сбросить фильтры
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInstructions.map((instruction) => {
            const Icon = TAB_ICONS[instruction.tabId] || Layers;
            const isUserPermitted = hasPermission(instruction.tabId);
            // Если ищем через поиск — автоматически разворачиваем найденное, иначе берем состояние клика
            const isSectionExpanded = searchQuery.trim().length > 0 
              ? true 
              : (expandedSections[instruction.tabId] ?? false);

            return (
              <div
                key={instruction.tabId} 
                className={cn(
                  "border rounded-xl transition-all duration-200 overflow-hidden bg-card",
                  isSectionExpanded ? "shadow-md ring-1 ring-primary/20" : "hover:border-primary/40 hover:shadow-xs",
                  !isUserPermitted && "opacity-90 bg-slate-50/50 dark:bg-slate-900/30 border-dashed"
                )}
              >
                {/* Свернутый заголовок: интерактивная кликабельная строка */}
                <div 
                  onClick={() => toggleSection(instruction.tabId)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer gap-3 bg-muted/20 hover:bg-muted/40 transition-colors select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      isSectionExpanded 
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30" 
                        : "bg-primary/10 text-primary"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-foreground truncate">
                          {instruction.title}
                        </span>
                        {isUserPermitted ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                            Вам доступен
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300">
                            Требует расширения прав
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground hidden md:inline">
                          • {instruction.scenarios.length} сценария
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {instruction.purpose}
                      </p>
                    </div>
                  </div>

                  {/* Правый блок: кнопка разворота и переход */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isUserPermitted && onNavigateTab && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation(); // Не переключать раскрытие при переходе
                          onNavigateTab(instruction.tabId);
                        }}
                        className="text-xs gap-1 h-8 px-2.5 text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <span>В раздел</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center border bg-background text-muted-foreground transition-transform duration-200",
                      isSectionExpanded && "bg-primary/10 text-primary border-primary/30 rotate-180"
                    )}>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Развернутое содержимое раздела */}
                {isSectionExpanded && (
                  <div className="p-5 md:p-6 space-y-6 border-t bg-background/50">
                    {/* Целевая аудитория и дата */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/50">
                      <span><strong>Целевая аудитория:</strong> {instruction.targetAudience}</span>
                      <span>Обновлено: {instruction.lastUpdated}</span>
                    </div>

                    {/* 1. Блок "Для чего нужен раздел" */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Для чего нужен этот раздел</span>
                      </h4>
                      <p className="text-sm text-foreground/90 leading-relaxed bg-primary/5 p-3.5 rounded-xl border border-primary/10">
                        {instruction.purpose}
                      </p>
                    </div>

                    {/* 2. Блок "Что в нем можно сделать" */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Что здесь можно делать (Возможности)</span>
                      </h4>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {instruction.whatCanDo.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-muted/40 p-2.5 rounded-lg border border-border/40">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            <span className="text-foreground/90">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* 3. Пошаговые сценарии («Как сделать») */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                        <span>Пошаговые регламенты («Как сделать»)</span>
                      </h4>

                      <div className="space-y-2.5">
                        {instruction.scenarios.map((scenario) => {
                          const isExpanded = expandedScenarios[scenario.id] ?? true;

                          return (
                            <div 
                              key={scenario.id} 
                              className="rounded-xl border bg-card overflow-hidden shadow-xs"
                            >
                              <button
                                onClick={() => toggleScenario(scenario.id)}
                                className="w-full flex items-center justify-between p-3.5 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
                              >
                                <span className="text-sm font-bold text-foreground">
                                  {scenario.title}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{scenario.steps.length} шагов</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="p-4 space-y-3 border-t bg-background">
                                  <ol className="space-y-3">
                                    {scenario.steps.map((step, sIdx) => (
                                      <li 
                                        key={sIdx} 
                                        className="relative pl-6 border-l-2 border-primary/30 space-y-1.5 pb-2 last:pb-0"
                                      >
                                        {/* Номер шага маркером */}
                                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                          {sIdx + 1}
                                        </div>

                                        <h5 className="text-xs font-bold text-foreground">
                                          {step.title}
                                        </h5>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                          {step.description}
                                        </p>

                                        {/* Совет / Лайфхак */}
                                        {step.tip && (
                                          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-2 rounded-md text-[11px] border border-blue-200/50 dark:border-blue-800/50">
                                            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-blue-500 mt-0.5" />
                                            <span><strong>Совет:</strong> {step.tip}</span>
                                          </div>
                                        )}

                                        {/* Предостережение */}
                                        {step.warning && (
                                          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-2 rounded-md text-[11px] border border-amber-200/50 dark:border-amber-800/50">
                                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                                            <span><strong>Внимание:</strong> {step.warning}</span>
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. Важные нюансы и частые ошибки */}
                    {instruction.importantNotes && instruction.importantNotes.length > 0 && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Важные правила и частые ошибки</span>
                        </h4>
                        <ul className="space-y-1 text-xs text-foreground/80 list-disc list-inside">
                          {instruction.importantNotes.map((note, nIdx) => (
                            <li key={nIdx}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstructionsManager;
