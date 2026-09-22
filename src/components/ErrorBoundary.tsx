import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Глобальный и модульный ErrorBoundary.
 * 
 * Назначение:
 * Перехватывает любые непредвиденные JavaScript-ошибки в дочерних React-компонентах.
 * Предотвращает размонтирование DOM-дерева и появление "белого экрана".
 * Предоставляет кнопку перезагрузки и отображает понятное сообщение для пользователя.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Обновляем состояние, чтобы следующий рендер показал запасной UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Логируем ошибку с полным стеком для быстрой отладки
    console.error("[ErrorBoundary] Перехвачена критическая ошибка компонента:", error);
    console.error("[ErrorBoundary] Стек вызовов компонента:", errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[350px] w-full flex flex-col items-center justify-center p-6 text-center bg-background border border-border/50 rounded-2xl shadow-sm my-4">
          <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-500 animate-pulse">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold mb-2">
            {this.props.fallbackTitle || "Что-то пошло не так при отображении блока"}
          </h2>

          <p className="text-sm sm:text-base text-muted-foreground max-w-md mb-6">
            {this.props.fallbackMessage || "Произошла временная ошибка отображения. Пожалуйста, обновите страницу или перейдите на главную."}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button 
              onClick={this.handleReload} 
              variant="default" 
              className="gap-2 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" />
              Обновить страницу
            </Button>

            <Button 
              onClick={this.handleGoHome} 
              variant="outline" 
              className="gap-2 rounded-xl"
            >
              <Home className="h-4 w-4" />
              На главную
            </Button>
          </div>

          {/* В режиме разработки или для технических специалистов выводим текст ошибки */}
          {this.state.error && (
            <div className="mt-6 p-3 bg-muted/50 rounded-lg text-left max-w-xl w-full text-xs font-mono text-muted-foreground overflow-auto max-h-32 border border-border/30">
              <span className="font-bold text-red-500">Детали ошибки: </span>
              {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
