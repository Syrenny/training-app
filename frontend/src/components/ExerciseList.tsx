import { Card, CardContent } from '@/components/ui/card'
import type { DayExerciseData, DayTextBlockData } from '@/lib/api'
import { completionKey, useProgramStore } from '@/lib/store'
import { CompletionButton } from './CompletionButton'
import { ExerciseCard } from './ExerciseCard'
import { SupersetCard } from './SupersetCard'
import { WorkoutSummaryCard } from './WorkoutSummaryCard'

type ExerciseItem =
	| { type: 'single'; exercise: DayExerciseData; displayOrder: number }
	| {
			type: 'superset'
			group: number
			exercises: DayExerciseData[]
			displayOrder: number
	  }

function groupExercises(exercises: DayExerciseData[]): ExerciseItem[] {
	const items: ExerciseItem[] = []
	let i = 0
	let displayOrder = 1
	while (i < exercises.length) {
		const ex = exercises[i]
		if (ex.superset_group != null) {
			const grouped: DayExerciseData[] = []
			const groupId = ex.superset_group
			while (
				i < exercises.length &&
				exercises[i].superset_group === groupId
			) {
				grouped.push(exercises[i])
				i++
			}
			items.push({
				type: 'superset',
				group: groupId,
				exercises: grouped,
				displayOrder,
			})
		} else {
			items.push({ type: 'single', exercise: ex, displayOrder })
			i++
		}
		displayOrder++
	}
	return items
}

interface ExerciseListProps {
	title: string
	exercises: DayExerciseData[]
	textBlocks: DayTextBlockData[]
	weekNumber: number
	weekday: string
}

export function ExerciseList({
	title,
	exercises,
	textBlocks,
	weekNumber,
	weekday,
}: ExerciseListProps) {
	const completions = useProgramStore(s => s.completions)
	const toggleCompletion = useProgramStore(s => s.toggleCompletion)

	const key = completionKey(weekNumber, weekday)
	const completionDate = completions.get(key)
	const isCompleted = completionDate != null

	return (
		<div>
			<Card className='mb-5 gap-0 rounded-2xl border-transparent bg-transparent py-0 shadow-none'>
				<CardContent className='px-0 py-3'>
					{title ? (
						<div className='flex justify-between'>
							<p className='mb-2 text-md font-semibold text-muted-foreground'>
								{title}
							</p>
							<CompletionButton
								completed={isCompleted}
								completionDate={completionDate}
								onToggle={() =>
									toggleCompletion(weekNumber, weekday)
								}
							/>
						</div>
					) : null}
					<div className='flex items-start justify-start gap-3'>
						<div className='min-w-0 flex-1'>
							{exercises.length > 0 ? (
								<WorkoutSummaryCard exercises={exercises} />
							) : (
								<p className='text-sm text-muted-foreground'>
									В этой тренировке пока нет упражнений.
								</p>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
			{exercises.length === 0 ? (
				<p className='text-muted-foreground text-center py-8'>
					Нет упражнений
				</p>
			) : (
				<div className='divide-y divide-border/70 border-y border-border/70'>
					{groupExercises(exercises).map(item =>
						item.type === 'single' ? (
							<ExerciseCard
								key={item.exercise.id}
								dayExercise={item.exercise}
								displayOrder={item.displayOrder}
							/>
						) : (
							<SupersetCard
								key={`ss-${item.group}`}
								exercises={item.exercises}
								displayOrder={item.displayOrder}
							/>
						),
					)}
				</div>
			)}
			{textBlocks.length > 0 ? (
				<div className='mt-4 space-y-3'>
					{textBlocks.map((block, index) => (
						<div
							key={`${block.kind}:${index}`}
							className={
								block.kind === 'REST'
									? 'rounded-2xl bg-muted px-4 py-3 text-sm font-medium text-foreground'
									: 'rounded-2xl bg-green-600/15 px-4 py-3 text-sm text-foreground'
							}
						>
							{block.content}
						</div>
					))}
				</div>
			) : null}
		</div>
	)
}
