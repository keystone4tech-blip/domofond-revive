'use client'

import React from "react";
import { SplineScene } from "@/components/ui/splite";
import { Card } from "@/components/ui/card"
import { Spotlight } from "@/components/ui/spotlight"
 
// Базовый демонстрационный компонент, показывающий интеграцию SplineScene и Spotlight
// в карточке со стекломорфизмом и текстом.
export function SplineSceneBasic() {
  console.log("[SplineSceneBasic] Рендеринг демонстрационного 3D-блока"); // Логирование

  return (
    <Card className="w-full h-[500px] bg-black/[0.96] relative overflow-hidden rounded-3xl border-slate-800">
      {/* Мягкая подсветка в верхнем левом углу */}
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      
      <div className="flex h-full flex-col md:flex-row">
        {/* Левая текстовая колонка с описанием */}
        <div className="flex-1 p-8 relative z-10 flex flex-col justify-center text-left">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 font-display">
            Интерактивный 3D
          </h1>
          <p className="mt-4 text-neutral-300 max-w-lg text-sm sm:text-base leading-relaxed">
            Оживите ваш интерфейс с помощью великолепных 3D-сцен. Создавайте захватывающий 
            пользовательский опыт, который привлекает внимание и выводит дизайн на новый уровень.
          </p>
        </div>

        {/* Правая колонка с интерактивной 3D сценой */}
        <div className="flex-1 relative min-h-[300px] md:min-h-0">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </Card>
  )
}
