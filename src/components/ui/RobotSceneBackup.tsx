import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";

/**
 * Резервная копия 3D сцены робота (Spline)
 * Если потребуется вернуть робота в секцию Hero:
 * 1. Импортируйте: import { RobotSceneBackup } from "@/components/ui/RobotSceneBackup";
 * 2. Вставьте компонент <RobotSceneBackup /> в правую колонку Hero.tsx.
 */
export const RobotSceneBackup = () => {
  return (
    <div className="relative w-full h-[480px] lg:h-[560px]">
      {/* Spotlight подсветка с фирменным синим свечением бренда */}
      <Spotlight
        className="-top-20 left-0 md:left-20 md:-top-10"
        fill="rgba(37, 99, 235, 0.25)"
      />
      {/* Мягкое свечение за роботом */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full blur-3xl opacity-50" />
      
      {/* Интерактивная 3D сцена Spline */}
      <div className="w-full h-full relative z-20">
        <SplineScene 
          scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default RobotSceneBackup;
