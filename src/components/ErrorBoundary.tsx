import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("[ErrorBoundary] Перехвачена ошибка:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const errorTitle = this.props.title || "Критическая ошибка рендеринга страницы";
      return (
        <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4 font-display">⚠️ {errorTitle}</h1>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Произошел сбой при отрисовке интерфейса. Пожалуйста, передайте разработчику текст ошибки ниже:
          </p>
          <pre className="bg-slate-950 p-4 rounded-xl text-xs max-w-xl overflow-auto border border-red-900/50 text-red-400 font-mono text-left">
            {this.state.error?.stack || String(this.state.error)}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
