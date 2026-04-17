import { Tabs } from '@/components/ui/tabs'
import { useCrossWeekPull } from '@/hooks/useCrossWeekPull'
import type { DayData } from '@/lib/api'
import { useProgramStore } from '@/lib/store'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'
import { Swiper, SwiperSlide } from 'swiper/react'
import { CrossWeekIndicator } from './CrossWeekIndicator'
import { DayTabsBar } from './DayTabsBar'
import { ExerciseList } from './ExerciseList'

interface DayTabsProps {
	weekNumber: number
	days: DayData[]
}

export function DayTabs({ weekNumber, days }: DayTabsProps) {
	const selectedDay = useProgramStore(s => s.selectedDay)
	const setDay = useProgramStore(s => s.setDay)
	const completions = useProgramStore(s => s.completions)

	const swiperRef = useRef<SwiperType | null>(null)
	const programmatic = useRef(false)
	const daysRef = useRef(days)
	daysRef.current = days

	const {
		containerRef,
		indicatorRef,
		onTouchStart,
		onTouchMove,
		onTouchEnd,
	} = useCrossWeekPull()

	const activeDay = useMemo(() => {
		const validDay = days.find(d => d.weekday === selectedDay)
		return validDay ? selectedDay! : days[0]?.weekday
	}, [days, selectedDay])

	const activeIndex = useMemo(
		() => days.findIndex(d => d.weekday === activeDay),
		[days, activeDay],
	)

	const handleSlideChange = useCallback(
		(swiper: SwiperType) => {
			if (programmatic.current) {
				programmatic.current = false
				return
			}
			const day = daysRef.current[swiper.activeIndex]
			if (day) setDay(day.weekday)
		},
		[setDay],
	)

	const handleTouchMove = useCallback(
		(swiper: SwiperType, event: MouseEvent | TouchEvent | PointerEvent) => {
			if (!programmatic.current) onTouchMove(swiper, event)
		},
		[onTouchMove],
	)

	const handleTouchEnd = useCallback(
		async (_swiper: SwiperType) => {
			if (!programmatic.current) await onTouchEnd()
		},
		[onTouchEnd],
	)

	const handleTabClick = useCallback(
		(day: string) => {
			const index = daysRef.current.findIndex(d => d.weekday === day)
			if (
				index !== -1 &&
				swiperRef.current &&
				swiperRef.current.activeIndex !== index
			) {
				programmatic.current = true
				swiperRef.current.slideTo(index, 300)
			}
			setDay(day)
		},
		[setDay],
	)

	useEffect(() => {
		const swiper = swiperRef.current
		if (swiper && swiper.activeIndex !== activeIndex && activeIndex >= 0) {
			programmatic.current = true
			swiper.slideTo(activeIndex, 0)
		}
	}, [activeIndex])

	if (days.length === 0) {
		return (
			<p className='text-muted-foreground text-center py-8'>
				Нет тренировочных дней
			</p>
		)
	}

	return (
		<div className='flex flex-col flex-1 min-h-0'>
			<Tabs value={activeDay} onValueChange={handleTabClick}>
				<DayTabsBar
					items={days.map(day => ({
						key: day.weekday,
						value: day.weekday,
						label: day.weekday_display,
						indicator: completions.has(`${weekNumber}:${day.weekday}`),
					}))}
				/>
			</Tabs>

			<CrossWeekIndicator ref={indicatorRef} />

			<div className='flex-1 min-h-0 mt-4'>
				<div ref={containerRef} className='h-full'>
					<Swiper
						className='h-full'
						key={days.map(d => d.weekday).join(',')}
						onSwiper={swiper => {
							swiperRef.current = swiper
						}}
						initialSlide={activeIndex >= 0 ? activeIndex : 0}
						onSlideChange={handleSlideChange}
						onTouchStart={onTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
						spaceBetween={16}
						resistanceRatio={0}
					>
						{days.map(day => (
							<SwiperSlide key={day.weekday} className='h-full'>
								<div className='hide-scrollbar h-full overflow-y-auto overscroll-y-contain'>
									<ExerciseList
										title={day.title}
										exercises={day.exercises}
										textBlocks={day.text_blocks}
										weekNumber={weekNumber}
										weekday={day.weekday}
									/>
								</div>
							</SwiperSlide>
						))}
					</Swiper>
				</div>
			</div>
		</div>
	)
}
