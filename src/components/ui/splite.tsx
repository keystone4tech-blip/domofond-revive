'use client'

import { Suspense, lazy } from 'react'
import { Loader2 } from 'lucide-react'

// Лениво импортируем библиотеку Spline, чтобы не замедлять первоначальную загрузку страницы.
const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

// Компонент-обертка для отображения 3D-сцен из Spline с индикатором загрузки.
export function SplineScene({ scene, className }: SplineSceneProps) {
  console.log(`[SplineScene] Загрузка 3D-сцены: "${scene}"`); // Логирование

  return (
    <Suspense 
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-slate-950/10 dark:bg-slate-900/10 backdrop-blur-sm rounded-2xl">
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
  )
}
