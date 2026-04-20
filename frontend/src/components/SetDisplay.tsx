import type { ReactNode } from 'react'

import type { ExerciseSetData } from '@/lib/api'
import { calcWeight, getOneRepMaxValue } from '@/lib/calc'
import { useProgramStore } from '@/lib/store'

interface SetDisplayProps {
	set: ExerciseSetData
	oneRepMaxExerciseId?: number | null
	weightEditor?: ReactNode
	rightAddon?: ReactNode
}

function formatNumber(value: number | null | undefined): string {
	if (value == null) return ''
	return value % 1 === 0 ? value.toFixed(0) : String(value)
}

function formatRange(
	minValue: number | null | undefined,
	maxValue: number | null | undefined,
): string {
	const first = formatNumber(minValue)
	if (!first) return ''

	const last = formatNumber(maxValue)
	if (!last || last === first) return first

	return `${first}–${last}`
}

export function SetDisplay({
	set,
	oneRepMaxExerciseId,
	weightEditor,
	rightAddon,
}: SetDisplayProps) {
	const one_rep_max = useProgramStore(s => s.oneRepMax)

	let weight_value = ''
	let percent_label = ''

	if (set.load_type === 'PERCENT' && set.load_value != null) {
		const orm = getOneRepMaxValue(one_rep_max, oneRepMaxExerciseId)

		if (orm != null) {
			const min_weight = calcWeight(orm, Number(set.load_value))
			const max_weight =
				set.load_value_max != null
					? calcWeight(orm, Number(set.load_value_max))
					: null

			weight_value = formatRange(min_weight, max_weight)
		}

		percent_label = `${formatRange(Number(set.load_value), set.load_value_max)}%`
	}

	if (set.load_type === 'KG' && set.load_value != null) {
		weight_value = formatRange(Number(set.load_value), set.load_value_max)
	}

	const reps_label =
		set.reps_max != null && set.reps_max !== set.reps
			? `${set.reps}–${set.reps_max}`
			: String(set.reps)

	const volume_node = (
		<>
			<span>{reps_label}</span>
			{set.sets > 1 ? (
				<>
					<span className='mx-0.5 text-sm text-muted-foreground'>×</span>
					<span>{set.sets}</span>
				</>
			) : null}
		</>
	)

	const weight_node = weight_value ? (
		<>
			<span>{weight_value}</span>
			<span className='ml-0.5 text-sm text-muted-foreground'>кг</span>
		</>
	) : null

	return (
		<div className='grid w-full grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-baseline gap-x-2 font-mono text-sm tabular-nums'>
			<div className='min-w-0 whitespace-nowrap text-left font-medium text-foreground'>
				{weightEditor ?? weight_node}
			</div>

			<div className='min-w-0 whitespace-nowrap text-left text-foreground'>
				{volume_node}
			</div>

			<div className='min-w-0 whitespace-nowrap text-right text-muted-foreground'>
				{rightAddon ?? percent_label}
			</div>
		</div>
	)
}