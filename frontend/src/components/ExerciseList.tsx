import { Card, CardContent } from '@/components/ui/card'
import type { DayExerciseData, DayTextBlockData } from '@/lib/api'
import { completionKey, useProgramStore } from '@/lib/store'
import { CompletionButton } from './CompletionButton'
import { ExerciseCard } from './ExerciseCard'
import { SupersetCard } from './SupersetCard'
import { TextBlockItem } from './TextBlockItem'
import { WarmupTeaserCard } from './WarmupTeaserCard'
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
	onOpenWarmup: () => void
	showCompletionControl?: boolean
}

export function ExerciseList({
	title,
	exercises,
	textBlocks,
	weekNumber,
	weekday,
	onOpenWarmup,
	showCompletionControl = true,
}: ExerciseListProps) {
	const completions = useProgramStore(s => s.completions)
	const toggleCompletion = useProgramStore(s => s.toggleCompletion)

	const key = completionKey(weekNumber, weekday)
	const completionDate = completions.get(key)
	const isCompleted = completionDate != null

	return (
		<div>
			<Card className='mb-5 mt-25 gap-0 rounded-2xl border-transparent bg-transparent py-0 shadow-none'>
				<CardContent className='px-0 py-3'>
					<div className='flex items-center justify-between gap-3'>
						<div className='min-w-0 flex-1'>
							{title ? (
								<p className='text-md font-semibold text-muted-foreground'>
									{title}
								</p>
							) : null}
							<div className={title ? 'mt-2' : ''}>
							{exercises.length > 0 ? (
								<WorkoutSummaryCard exercises={exercises} />
							) : (
								<p className='text-sm text-muted-foreground'>
									В этой тренировке пока нет упражнений.
								</p>
							)}
							</div>
						</div>
						{showCompletionControl ? (
							<CompletionButton
								completed={isCompleted}
								completionDate={completionDate}
								onToggle={() =>
									toggleCompletion(weekNumber, weekday)
								}
							/>
						) : null}
					</div>
				</CardContent>
			</Card>

			<div className='divide-y divide-border/70 border-y border-border/70'>
				<WarmupTeaserCard onOpen={onOpenWarmup} />
				{exercises.length > 0
					? groupExercises(exercises).map(item =>
							item.type === 'single' ? (
								<ExerciseCard
									key={item.exercise.slot_key}
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
						)
					: null}
			</div>

			{exercises.length === 0 ? (
				<p className='text-muted-foreground text-center py-8'>
					Нет упражнений
				</p>
			) : null}
			{textBlocks.length > 0 ? (
				<div className='mt-4 space-y-3'>
					{textBlocks.map((block, index) => (
						<TextBlockItem
							key={`${block.kind}:${index}`}
							kind={block.kind}
							content={block.content}
						/>
					))}
				</div>
			) : null}
		</div>
	)
}
