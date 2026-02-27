import { useRef, useCallback, useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExerciseList } from "./ExerciseList";
import { useProgramStore } from "@/lib/store";
import { getAdjacentWeekNumber } from "@/lib/navigation";
import type { DayData } from "@/lib/api";

interface DayTabsProps {
  days: DayData[];
}

/** Fraction of screen width the user must drag past the edge to switch weeks. */
const CROSS_WEEK_RATIO = 0.55;
/** Maximum px the content shifts when pulling at the edge. */
const MAX_PULL_PX = 120;

export function DayTabs({ days }: DayTabsProps) {
  const selectedDay = useProgramStore((s) => s.selectedDay);
  const selectedWeek = useProgramStore((s) => s.selectedWeek);
  const weeks = useProgramStore((s) => s.weeks);
  const setDay = useProgramStore((s) => s.setDay);
  const navigateNext = useProgramStore((s) => s.navigateNext);
  const navigatePrev = useProgramStore((s) => s.navigatePrev);

  const swiperRef = useRef<SwiperType | null>(null);
  const programmatic = useRef(false);

  const [pullProgress, setPullProgress] = useState(0);
  const [pullDirection, setPullDirection] = useState<"next" | "prev" | null>(
    null,
  );
  // Actual px offset to shift the content (dampened)
  const [pullOffset, setPullOffset] = useState(0);

  const prevWeekNum =
    selectedWeek !== null
      ? getAdjacentWeekNumber(selectedWeek, weeks, "prev")
      : null;
  const nextWeekNum =
    selectedWeek !== null
      ? getAdjacentWeekNumber(selectedWeek, weeks, "next")
      : null;

  if (days.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Нет тренировочных дней
      </p>
    );
  }

  const validDay = days.find((d) => d.weekday === selectedDay);
  const activeDay = validDay ? selectedDay! : days[0]?.weekday;
  const activeIndex = days.findIndex((d) => d.weekday === activeDay);

  const handleSlideChange = useCallback(
    (swiper: SwiperType) => {
      if (programmatic.current) {
        programmatic.current = false;
        return;
      }
      const day = days[swiper.activeIndex];
      if (day) {
        setDay(day.weekday);
      }
    },
    [days, setDay],
  );

  const handleTouchMove = useCallback(
    (swiper: SwiperType) => {
      if (programmatic.current) return;

      const diff = swiper.touches.diff;
      const threshold = window.innerWidth * CROSS_WEEK_RATIO;

      if (swiper.isEnd && diff < 0 && nextWeekNum !== null) {
        const absDiff = Math.abs(diff);
        const progress = Math.min(absDiff / threshold, 1);
        // Ease-out dampening: fast at first, slows down
        const dampened = MAX_PULL_PX * (1 - Math.pow(1 - progress, 2));
        setPullProgress(progress);
        setPullDirection("next");
        setPullOffset(-dampened);
      } else if (swiper.isBeginning && diff > 0 && prevWeekNum !== null) {
        const progress = Math.min(diff / threshold, 1);
        const dampened = MAX_PULL_PX * (1 - Math.pow(1 - progress, 2));
        setPullProgress(progress);
        setPullDirection("prev");
        setPullOffset(dampened);
      } else {
        if (pullDirection !== null) {
          setPullProgress(0);
          setPullDirection(null);
          setPullOffset(0);
        }
      }
    },
    [nextWeekNum, prevWeekNum, pullDirection],
  );

  const handleTouchEnd = useCallback(
    async (_swiper: SwiperType) => {
      const wasPulling = pullDirection;
      const wasReady = pullProgress >= 1;
      setPullProgress(0);
      setPullDirection(null);
      setPullOffset(0);

      if (programmatic.current) return;

      if (wasPulling === "next" && wasReady) {
        await navigateNext();
      } else if (wasPulling === "prev" && wasReady) {
        await navigatePrev();
      }
    },
    [pullDirection, pullProgress, navigateNext, navigatePrev],
  );

  const handleTabClick = (day: string) => {
    const index = days.findIndex((d) => d.weekday === day);
    if (index !== -1 && swiperRef.current) {
      programmatic.current = true;
      swiperRef.current.slideTo(index, 300);
    }
    setDay(day);
  };

  useEffect(() => {
    const swiper = swiperRef.current;
    if (swiper && swiper.activeIndex !== activeIndex && activeIndex >= 0) {
      programmatic.current = true;
      swiper.slideTo(activeIndex, 0);
    }
  }, [activeIndex]);

  const targetWeekNum =
    pullDirection === "next" ? nextWeekNum : prevWeekNum;
  const isPulling = pullDirection !== null && targetWeekNum !== null;

  return (
    <div>
      <Tabs value={activeDay} onValueChange={handleTabClick}>
        <TabsList className="w-full sticky top-0 z-10 bg-background">
          {days.map((day) => (
            <TabsTrigger
              key={day.weekday}
              value={day.weekday}
              className="flex-1 text-base"
            >
              {day.weekday_display}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Cross-week label — fixed to viewport center, slides in from the edge */}
      {isPulling && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center"
          style={{
            justifyContent:
              pullDirection === "next" ? "flex-end" : "flex-start",
          }}
        >
          <div
            className="flex items-center gap-1.5 rounded-full border px-4 py-2.5 shadow-md"
            style={{
              transform:
                pullDirection === "next"
                  ? `translateX(${(1 - pullProgress) * 100}%)`
                  : `translateX(${-(1 - pullProgress) * 100}%)`,
              margin: pullDirection === "next" ? "0 12px 0 0" : "0 0 0 12px",
              opacity: Math.min(pullProgress * 2.5, 1),
              color:
                pullProgress >= 1
                  ? "var(--color-primary)"
                  : "var(--color-muted-foreground)",
              borderColor:
                pullProgress >= 1
                  ? "var(--color-primary)"
                  : "var(--color-border)",
              backgroundColor: "var(--color-background)",
            }}
          >
            {pullDirection === "prev" && (
              <ArrowLeft className="h-4 w-4" />
            )}
            <span className="text-sm font-medium whitespace-nowrap">
              Нед. {targetWeekNum}
            </span>
            {pullDirection === "next" && (
              <ArrowRight className="h-4 w-4" />
            )}
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden">
        {/* Content that shifts to reveal the gap */}
        <div
          className="relative z-10 bg-background"
          style={{
            transform: isPulling ? `translateX(${pullOffset}px)` : undefined,
            transition: isPulling ? "none" : "transform 300ms ease-out",
            willChange: isPulling ? "transform" : "auto",
          }}
        >
          <Swiper
            key={days.map((d) => d.weekday).join(",")}
            onSwiper={(swiper) => {
              swiperRef.current = swiper;
            }}
            initialSlide={activeIndex >= 0 ? activeIndex : 0}
            onSlideChange={handleSlideChange}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            spaceBetween={16}
            resistanceRatio={0}
          >
            {days.map((day) => (
              <SwiperSlide key={day.weekday}>
                <ExerciseList exercises={day.exercises} />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </div>
  );
}
