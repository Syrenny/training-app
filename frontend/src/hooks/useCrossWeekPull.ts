import { useCallback, useMemo, useRef } from 'react'
import type { Swiper as SwiperType } from 'swiper'
import { getAdjacentWeekNumber } from '@/lib/navigation'
import { useProgramStore } from '@/lib/store'
import type { CrossWeekIndicatorHandle } from '@/components/CrossWeekIndicator'

/** Fraction of screen width the user must drag past the edge to switch weeks. */
const CROSS_WEEK_RATIO = 0.45
/** Maximum px the content shifts when pulling at the edge. */
const MAX_PULL_PX = 120
/** Minimum drag (px) before cross-week pull activates. */
const DEAD_ZONE_PX = 12
/** Movement (px) needed to lock gesture direction. */
const DIRECTION_LOCK_PX = 10

function easeOutQuad(t: number) {
	return 1 - Math.pow(1 - t, 2)
}

function getTouchPoint(event: MouseEvent | TouchEvent | PointerEvent) {
	if ('touches' in event && event.touches[0]) return event.touches[0]
	return event as MouseEvent
}

interface GestureState {
	startX: number
	startY: number
	locked: 'h' | 'v' | null
	active: boolean
	dir: 'next' | 'prev' | null
	progress: number
}

const GESTURE_IDLE: GestureState = {
	startX: 0,
	startY: 0,
	locked: null,
	active: false,
	dir: null,
	progress: 0,
}

export function useCrossWeekPull() {
	const selectedWeek = useProgramStore(s => s.selectedWeek)
	const weeks = useProgramStore(s => s.weeks)
	const navigateNext = useProgramStore(s => s.navigateNext)
	const navigatePrev = useProgramStore(s => s.navigatePrev)

	const containerRef = useRef<HTMLDivElement>(null)
	const indicatorRef = useRef<CrossWeekIndicatorHandle>(null)
	const gesture = useRef<GestureState>({ ...GESTURE_IDLE })

	const prevWeekNum = useMemo(
		() =>
			selectedWeek !== null
				? getAdjacentWeekNumber(selectedWeek, weeks, 'prev')
				: null,
		[selectedWeek, weeks],
	)
	const nextWeekNum = useMemo(
		() =>
			selectedWeek !== null
				? getAdjacentWeekNumber(selectedWeek, weeks, 'next')
				: null,
		[selectedWeek, weeks],
	)

	const storeRef = useRef({ nextWeekNum, prevWeekNum, navigateNext, navigatePrev })
	storeRef.current = { nextWeekNum, prevWeekNum, navigateNext, navigatePrev }

	const applyContainerOffset = useCallback((offset: number, animate: boolean) => {
		const el = containerRef.current
		if (!el) return
		if (animate) {
			el.style.transition = 'transform 300ms ease-out'
			el.style.transform = ''
			el.style.willChange = 'auto'
		} else {
			el.style.transition = 'none'
			el.style.transform = offset ? `translateX(${offset}px)` : ''
			el.style.willChange = offset ? 'transform' : 'auto'
		}
	}, [])

	const onTouchStart = useCallback(
		(_: SwiperType, event: MouseEvent | TouchEvent | PointerEvent) => {
			const pt = getTouchPoint(event)
			gesture.current = {
				...GESTURE_IDLE,
				startX: pt.clientX,
				startY: pt.clientY,
			}
		},
		[],
	)

	const onTouchMove = useCallback(
		(swiper: SwiperType, event: MouseEvent | TouchEvent | PointerEvent) => {
			const g = gesture.current
			const pt = getTouchPoint(event)
			const dx = pt.clientX - g.startX
			const dy = pt.clientY - g.startY

			// Direction lock: wait for enough movement, then commit
			if (g.locked === null) {
				if (Math.abs(dx) + Math.abs(dy) < DIRECTION_LOCK_PX) return
				g.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
			}

			// Vertical gesture — don't interfere, let ScrollArea handle it
			if (g.locked === 'v') return

			const { nextWeekNum, prevWeekNum } = storeRef.current
			const threshold = window.innerWidth * CROSS_WEEK_RATIO

			let shouldPull = false
			let dir: 'next' | 'prev' | null = null
			let progress = 0
			let offset = 0
			let weekNum: number | null = null

			if (swiper.isEnd && dx < -DEAD_ZONE_PX && nextWeekNum !== null) {
				shouldPull = true
				dir = 'next'
				weekNum = nextWeekNum
				progress = Math.min((Math.abs(dx) - DEAD_ZONE_PX) / threshold, 1)
				offset = -(MAX_PULL_PX * easeOutQuad(progress))
			} else if (swiper.isBeginning && dx > DEAD_ZONE_PX && prevWeekNum !== null) {
				shouldPull = true
				dir = 'prev'
				weekNum = prevWeekNum
				progress = Math.min((dx - DEAD_ZONE_PX) / threshold, 1)
				offset = MAX_PULL_PX * easeOutQuad(progress)
			}

			// Apply container offset (no re-render)
			applyContainerOffset(offset, false)

			// Update indicator (no re-render)
			if (shouldPull && dir && weekNum !== null) {
				indicatorRef.current?.update(dir, progress, weekNum)
			} else if (g.active) {
				indicatorRef.current?.hide()
			}

			g.active = shouldPull
			g.dir = dir
			g.progress = progress
		},
		[applyContainerOffset],
	)

	const onTouchEnd = useCallback(async () => {
		const g = gesture.current
		const shouldNavigate = g.active && g.progress >= 1
		const dir = g.dir

		// Reset gesture
		gesture.current = { ...GESTURE_IDLE }

		// Animate container back
		applyContainerOffset(0, true)

		// Hide indicator
		indicatorRef.current?.hide()

		// Navigate if threshold was reached
		if (shouldNavigate) {
			const { navigateNext, navigatePrev } = storeRef.current
			if (dir === 'next') await navigateNext()
			else if (dir === 'prev') await navigatePrev()
		}
	}, [applyContainerOffset])

	return {
		containerRef,
		indicatorRef,
		onTouchStart,
		onTouchMove,
		onTouchEnd,
	}
}
