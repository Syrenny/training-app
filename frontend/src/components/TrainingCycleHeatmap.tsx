import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import type { DayData, WeekDetailData } from '@/lib/api'
import { completionKey, useProgramStore } from '@/lib/store'

const WEEKDAY_ORDER = [
	'MON',
	'TUE',
	'WED',
	'THU',
	'FRI',
	'SAT',
	'SUN',
] as const

const WEEKDAY_LABELS: Record<string, string> = {
	MON: 'Пн',
	TUE: 'Вт',
	WED: 'Ср',
	THU: 'Чт',
	FRI: 'Пт',
	SAT: 'Сб',
	SUN: 'Вс',
}

interface HeatmapCell {
	day: DayData
	isCompleted: boolean
}

interface HeatmapColumn {
	weekNumber: number
	weekTitle: string
	cells: Record<string, HeatmapCell | null>
}

function isWorkoutDay(day: DayData) {
	return day.exercises.length > 0
}

function buildColumns(
	weeks: WeekDetailData[],
	completions: Map<string, string>,
): HeatmapColumn[] {
	return weeks.map(week => {
		const cells = Object.fromEntries(
			WEEKDAY_ORDER.map(weekday => [weekday, null]),
		) as Record<string, HeatmapCell | null>

		for (const day of week.days) {
			if (!isWorkoutDay(day)) {
				continue
			}

			cells[day.weekday] = {
				day,
				isCompleted: completions.has(completionKey(week.number, day.weekday)),
			}
		}

		return {
			weekNumber: week.number,
			weekTitle: week.title,
			cells,
		}
	})
}

function getVisibleWeekdays(columns: HeatmapColumn[]) {
	return WEEKDAY_ORDER.filter(weekday =>
		columns.some(column => column.cells[weekday] !== null),
	)
}

function formatWeekLabel(column: HeatmapColumn) {
	return column.weekTitle.trim() || `Неделя ${column.weekNumber}`
}

function formatCellLabel(column: HeatmapColumn, cell: HeatmapCell) {
	const status = cell.isCompleted ? 'выполнена' : 'не выполнена'
	const dayTitle = cell.day.title.trim()
	const label = dayTitle ? `${cell.day.weekday_display} • ${dayTitle}` : cell.day.weekday_display
	return `${formatWeekLabel(column)} • ${label} • ${status}`
}

function HeatmapSquare({
	column,
	cell,
}: {
	column: HeatmapColumn
	cell: HeatmapCell | null
}) {
	if (!cell) {
		return (
			<div
				className='mx-auto h-4 w-4 rounded-[4px] bg-transparent'
				aria-hidden='true'
			/>
		)
	}

	return (
		<div
			role='img'
			aria-label={formatCellLabel(column, cell)}
			title={formatCellLabel(column, cell)}
			className={
				cell.isCompleted
					? 'mx-auto h-4 w-4 rounded-[4px] border border-emerald-500/90 bg-emerald-500 shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-card)_18%,transparent)] transition-colors'
					: 'mx-auto h-4 w-4 rounded-[4px] border border-border/80 bg-muted/55 transition-colors'
			}
		/>
	)
}

export function TrainingCycleHeatmap() {
	const weeks = useProgramStore(s => s.weeks)
	const weekDetailCache = useProgramStore(s => s.weekDetailCache)
	const selectedProgram = useProgramStore(s => s.selectedProgram)
	const completions = useProgramStore(s => s.completions)
	const loading = useProgramStore(s => s.loading)

	const detailedWeeks = weeks
		.map(week => weekDetailCache[week.number])
		.filter((week): week is WeekDetailData => Boolean(week))
	const columns = buildColumns(detailedWeeks, completions)
	const visibleWeekdays = getVisibleWeekdays(columns)
	const totalWorkouts = columns.reduce(
		(total, column) =>
			total +
			visibleWeekdays.filter(weekday => column.cells[weekday] !== null).length,
		0,
	)
	const completedWorkouts = columns.reduce(
		(total, column) =>
			total +
			visibleWeekdays.filter(weekday => column.cells[weekday]?.isCompleted).length,
		0,
	)
	const progressPercent =
		totalWorkouts > 0
			? Math.round((completedWorkouts / totalWorkouts) * 100)
			: 0

	return (
		<div className='space-y-4 px-4'>
			<div className='flex items-start justify-between gap-3'>
				<div className='space-y-1'>
					<h2 className='text-xl font-semibold leading-none'>Прогресс цикла</h2>
					<p className='text-sm text-muted-foreground'>
						{selectedProgram?.name || 'Текущая программа'}
					</p>
				</div>
				<div className='text-right'>
					<p className='text-3xl font-semibold leading-none'>
						{completedWorkouts}/{totalWorkouts}
					</p>
					<p className='mt-1 text-xs text-muted-foreground'>
						{progressPercent}% выполнено
					</p>
				</div>
			</div>

			{loading && detailedWeeks.length === 0 ? (
				<div className='space-y-3'>
					<div className='h-4 w-40 animate-pulse rounded-full bg-muted' />
					<div className='h-28 animate-pulse rounded-2xl bg-muted/60' />
				</div>
			) : totalWorkouts === 0 ? (
				<div className='rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground'>
					Когда в программе появятся тренировочные дни, здесь отобразится сетка прогресса.
				</div>
			) : (
				<div className='space-y-4'>
					<p className='text-sm text-muted-foreground'>
						{completedWorkouts === totalWorkouts
							? 'Цикл закрыт полностью.'
							: `Выполнено ${completedWorkouts} из ${totalWorkouts} тренировок.`}
					</p>

					<Table className='w-full table-fixed border-separate border-spacing-y-2'>
						<TableHeader className='[&_tr]:border-0'>
							<TableRow className='border-0 hover:bg-transparent'>
								<TableHead className='h-4 w-10 p-0 pr-3' />
								{columns.map(column => (
									<TableHead
										key={column.weekNumber}
										className='h-4 p-0 text-center text-[11px] leading-none font-normal text-muted-foreground'
										title={formatWeekLabel(column)}
									>
										{column.weekNumber % 2 === 1 ? column.weekNumber : ''}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody className='[&_tr]:border-0'>
							{visibleWeekdays.map(weekday => (
								<TableRow
									key={weekday}
									className='border-0 hover:bg-transparent'
								>
									<TableHead className='h-4 w-10 p-0 pr-3 text-[11px] leading-none font-normal text-muted-foreground'>
										{WEEKDAY_LABELS[weekday]}
									</TableHead>
									{columns.map(column => (
										<TableCell
											key={`${column.weekNumber}-${weekday}`}
											className='h-4 p-0 text-center'
										>
											<HeatmapSquare
												column={column}
												cell={column.cells[weekday]}
											/>
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>

					<div className='flex items-center justify-end gap-2 text-xs text-muted-foreground'>
						<span className='h-3.5 w-3.5 rounded-[4px] border border-emerald-500/90 bg-emerald-500' />
						<span>Выполнено</span>
					</div>
				</div>
			)}
		</div>
	)
}
