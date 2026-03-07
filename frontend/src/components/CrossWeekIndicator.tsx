import { forwardRef, useImperativeHandle, useRef } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export interface CrossWeekIndicatorHandle {
	update(direction: 'next' | 'prev', progress: number, weekNum: number): void
	hide(): void
}

export const CrossWeekIndicator = forwardRef<CrossWeekIndicatorHandle>(
	function CrossWeekIndicator(_, ref) {
		const containerRef = useRef<HTMLDivElement>(null)
		const badgeRef = useRef<HTMLDivElement>(null)
		const labelRef = useRef<HTMLSpanElement>(null)
		const arrowLeftRef = useRef<SVGSVGElement>(null)
		const arrowRightRef = useRef<SVGSVGElement>(null)

		useImperativeHandle(ref, () => ({
			update(direction, progress, weekNum) {
				const container = containerRef.current
				const badge = badgeRef.current
				const label = labelRef.current
				if (!container || !badge || !label) return

				// Show container, align to correct side
				container.style.display = 'flex'
				container.style.justifyContent =
					direction === 'next' ? 'flex-end' : 'flex-start'

				// Badge: slide in from edge, fade in
				const translateX =
					direction === 'next'
						? `translateX(${(1 - progress) * 100}%)`
						: `translateX(${-(1 - progress) * 100}%)`
				badge.style.transform = translateX
				badge.style.opacity = String(Math.min(progress * 2.5, 1))
				badge.style.marginRight = direction === 'next' ? '0.75rem' : ''
				badge.style.marginLeft = direction === 'prev' ? '0.75rem' : ''

				// Color: muted by default, primary when ready
				const ready = progress >= 1
				badge.style.color = ready
					? 'var(--color-primary)'
					: 'var(--color-muted-foreground)'
				badge.style.borderColor = ready
					? 'var(--color-primary)'
					: 'var(--color-border)'

				// Arrows
				if (arrowLeftRef.current)
					arrowLeftRef.current.style.display =
						direction === 'prev' ? '' : 'none'
				if (arrowRightRef.current)
					arrowRightRef.current.style.display =
						direction === 'next' ? '' : 'none'

				// Label
				label.textContent = `Нед. ${weekNum}`
			},
			hide() {
				if (containerRef.current)
					containerRef.current.style.display = 'none'
			},
		}))

		return (
			<div
				ref={containerRef}
				className='pointer-events-none fixed inset-0 z-50 flex items-center'
				style={{ display: 'none' }}
			>
				<div
					ref={badgeRef}
					className='flex items-center gap-1.5 rounded-full border px-4 py-2.5 shadow-md bg-background'
				>
					<ArrowLeft
						ref={arrowLeftRef}
						className='h-4 w-4'
						style={{ display: 'none' }}
					/>
					<span
						ref={labelRef}
						className='text-sm font-medium whitespace-nowrap'
					/>
					<ArrowRight
						ref={arrowRightRef}
						className='h-4 w-4'
						style={{ display: 'none' }}
					/>
				</div>
			</div>
		)
	},
)
