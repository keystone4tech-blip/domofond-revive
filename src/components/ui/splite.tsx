'use client'

import { Suspense, lazy, Component, ReactNode, ErrorInfo } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'

// Лениво импортируем библиотеку Spline, чтобы не замедлять первоначальную загрузку страницы.
const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

interface SplineErrorBoundaryProps {
  children: ReactNode
}

interface SplineErrorBoundaryState {
  hasError: boolean
}

// Специализированный предохранитель ошибок для 3D WebGL сцен
class SplineErrorBoundary extends Component<SplineErrorBoundaryProps, SplineErrorBoundaryState> {
  constructor(props: SplineErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[SplineScene] Ошибка рендеринга WebGL 3D-сцены (переключение на резервную визуализацию):', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Элегантная неоновая заглушка с щитом безопасности, если у пользователя отключен WebGL или сбой сети
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-blue-500/10 via-transparent to-primary/10 rounded-3xl border border-blue-500/20">
          <div className="p-4 rounded-full bg-blue-500/10 mb-4 animate-pulse">
            <ShieldCheck className="h-16 w-16 text-blue-500" />
          </div>
          <p className="text-sm font-semibold text-foreground/80">Интеллектуальная система безопасности</p>
          <p className="text-xs text-muted-foreground mt-1">Домофондар • Надежная защита вашего дома</p>
        </div>
      )
    }

    return this.props.children
  }
}

// Компонент-обертка для отображения 3D-сцен из Spline с индикатором загрузки и защитой от сбоев.
export function SplineScene({ scene, className }: SplineSceneProps) {
  console.log(`[SplineScene] Загрузка 3D-сцены: "${scene}"`)

  return (
    <SplineErrorBoundary>
      <Suspense 
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            {/* Красивый вращающийся лоадер-спиннер во время загрузки 3D модели */}
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        }
      >
        <Spline
          scene={scene}
          className={className}
        />
      </Suspense>
    </SplineErrorBoundary>
  )
}
