/*
import { DayTabsBar } from '@/components/DayTabsBar'
import { ExerciseDisplayContent } from '@/components/ExerciseDisplayContent'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { WeekPicker } from '@/components/WeekPicker'
import type {
	DayExerciseData,
	DayTextBlockData,
	ExerciseData,
	ExerciseSetData,
	ProgramData,
	ProgramSnapshotInput,
} from '@/lib/api'
import {
	fetchExercises,
	fetchOriginalProgram,
	fetchProgram,
	saveProgramSnapshot,
} from '@/lib/api'
import { useProgramStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { RotateCcw, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const WEEKDAY_SHORT_LABELS: Record<string, string> = {
	MON: 'Пн',
	TUE: 'Вт',
	WED: 'Ср',
	THU: 'Чт',
	FRI: 'Пт',
	SAT: 'Сб',
	SUN: 'Вс',
}
*/

export { ProgramAdaptationsPage as ProgramEditPage } from './ProgramAdaptationsPage'

type LoadType = 'PERCENT' | 'KG' | 'INDIVIDUAL' | 'BODYWEIGHT'

interface DraftSet {
	uid: string
	loadType: LoadType
	loadValue: string
	loadValueMax: string
	reps: string
	repsMax: string
	sets: string
}

interface DraftExercise {
	uid: string
	exerciseId: number
	supersetGroup: number | null
	sets: DraftSet[]
	notes: string
}

interface DraftDay {
	uid: string
	weekday: string
	title: string
	exercises: DraftExercise[]
	textBlocks: DayTextBlockData[]
}

interface DraftWeek {
	uid: string
	title: string
	days: DraftDay[]
}

interface DraftProgram {
	sourceSnapshotVersion: number | null
	weeks: DraftWeek[]
}

interface OriginalExerciseRef {
	key: string
	exerciseId: number
	supersetGroup: number | null
	sets: DraftSet[]
	notes: string
}

type DisplayExerciseItem =
	| {
			kind: 'current'
			key: string
			displayOrder: number
			exercise: DraftExercise
			source: 'original' | 'custom'
	  }
	| {
			kind: 'removed'
			key: string
			displayOrder: number
			exercise: OriginalExerciseRef
	  }

interface DeleteTarget {
	exerciseUid: string
	title: string
	description: string
}

interface ProgramEditPageProps {
	onClose?: () => void
}

function createUid() {
	return crypto.randomUUID()
}

function draftSet(
	set: ProgramData['weeks'][number]['days'][number]['exercises'][number]['sets'][number],
): DraftSet {
	return {
		uid: createUid(),
		loadType: set.load_type,
		loadValue: set.load_value == null ? '' : String(set.load_value),
		loadValueMax:
			set.load_value_max == null ? '' : String(set.load_value_max),
		reps: String(set.reps),
		repsMax: set.reps_max == null ? '' : String(set.reps_max),
		sets: String(set.sets),
	}
}

function draftExercise(exercise: DayExerciseData): DraftExercise {
	return {
		uid: createUid(),
		exerciseId: exercise.exercise.id,
		supersetGroup: exercise.superset_group,
		sets: exercise.sets.map(draftSet),
		notes: exercise.notes,
	}
}

function originalExerciseRef(
	exercise: DayExerciseData,
	key: string,
): OriginalExerciseRef {
	return {
		key,
		exerciseId: exercise.exercise.id,
		supersetGroup: exercise.superset_group,
		sets: exercise.sets.map(draftSet),
		notes: exercise.notes,
	}
}

function cloneExercise(source: OriginalExerciseRef): DraftExercise {
	return {
		uid: createUid(),
		exerciseId: source.exerciseId,
		supersetGroup: source.supersetGroup,
		sets: source.sets.map(set => ({
			...set,
			uid: createUid(),
		})),
		notes: source.notes,
	}
}

function draftFromProgram(program: ProgramData): DraftProgram {
	return {
		sourceSnapshotVersion: program.version,
		weeks: program.weeks.map(week => ({
			uid: createUid(),
			title: week.title,
			days: week.days.map(day => ({
				uid: createUid(),
				weekday: day.weekday,
				title: day.title,
				exercises: day.exercises.map(draftExercise),
				textBlocks: day.text_blocks,
			})),
		})),
	}
}

function normalizeSupersetGroups(exercises: DraftExercise[]) {
	const counts = new Map<number, number>()

	for (const exercise of exercises) {
		if (exercise.supersetGroup == null) continue
		counts.set(
			exercise.supersetGroup,
			(counts.get(exercise.supersetGroup) ?? 0) + 1,
		)
	}

	return exercises.map(exercise => ({
		...exercise,
		supersetGroup:
			exercise.supersetGroup != null &&
			(counts.get(exercise.supersetGroup) ?? 0) > 1
				? exercise.supersetGroup
				: null,
	}))
}

function buildSavePayload(
	draft: DraftProgram,
	commitMessage: string,
): ProgramSnapshotInput {
	return {
		commit_message: commitMessage,
		source_snapshot_version: draft.sourceSnapshotVersion,
		weeks: draft.weeks.map(week => ({
			title: week.title,
			days: week.days.map(day => ({
				title: day.title,
				weekday: day.weekday,
				exercises: normalizeSupersetGroups(day.exercises).map(
					exercise => ({
						exercise: exercise.exerciseId,
						superset_group: exercise.supersetGroup,
						notes: exercise.notes,
						sets: exercise.sets.map(set => ({
							load_type: set.loadType,
							load_value:
								set.loadType === 'PERCENT' ||
								set.loadType === 'KG'
									? Number(set.loadValue || 0)
									: null,
							load_value_max:
								(set.loadType === 'PERCENT' ||
									set.loadType === 'KG') &&
								set.loadValueMax
									? Number(set.loadValueMax)
									: null,
							reps: Number(set.reps || 0),
							reps_max: set.repsMax ? Number(set.repsMax) : null,
							sets: Number(set.sets || 0),
						})),
					}),
				),
				text_blocks: day.textBlocks,
			})),
		})),
	}
}

function contentSignature(draft: DraftProgram) {
	return JSON.stringify({
		weeks: draft.weeks.map(week => ({
			title: week.title,
			days: week.days.map(day => ({
				title: day.title,
				weekday: day.weekday,
				textBlocks: day.textBlocks,
				exercises: day.exercises.map(exercise => ({
					exerciseId: exercise.exerciseId,
					supersetGroup: exercise.supersetGroup,
					notes: exercise.notes,
					sets: exercise.sets.map(set => ({
						loadType: set.loadType,
						loadValue: set.loadValue,
						loadValueMax: set.loadValueMax,
						reps: set.reps,
						repsMax: set.repsMax,
						sets: set.sets,
					})),
				})),
			})),
		})),
	})
}

function renderDraftSetDisplay(set: DraftSet) {
	const repsLabel =
		set.repsMax && set.repsMax !== set.reps
			? `${set.reps}-${set.repsMax}`
			: set.reps
	const parts: string[] = []
	if (set.loadType === 'PERCENT') {
		parts.push(
			`${set.loadValueMax && set.loadValueMax !== set.loadValue ? `${set.loadValue}-${set.loadValueMax}` : set.loadValue}%`,
		)
	} else if (set.loadType === 'KG') {
		parts.push(
			`${set.loadValueMax && set.loadValueMax !== set.loadValue ? `${set.loadValue}-${set.loadValueMax}` : set.loadValue}кг`,
		)
	} else if (set.loadType === 'INDIVIDUAL') {
		parts.push('🏋')
	}
	parts.push(repsLabel)
	if (Number(set.sets || 0) > 1) {
		parts.push(set.sets)
	}
	return parts.join('×')
}

function toPreviewSetData(
	set: DraftSet,
	id: string,
	order = 1,
): ExerciseSetData {
	return {
		id,
		order,
		load_type: set.loadType,
		load_value:
			set.loadType === 'PERCENT' || set.loadType === 'KG'
				? Number(set.loadValue || 0)
				: null,
		load_value_max:
			(set.loadType === 'PERCENT' || set.loadType === 'KG') &&
			set.loadValueMax
				? Number(set.loadValueMax)
				: null,
		reps: Number(set.reps || 0),
		reps_max: set.repsMax ? Number(set.repsMax) : null,
		sets: Number(set.sets || 0),
		display: renderDraftSetDisplay(set),
	}
}

function isSetValid(set: DraftSet) {
	if (
		!set.reps ||
		Number(set.reps) <= 0 ||
		!set.sets ||
		Number(set.sets) <= 0
	) {
		return false
	}
	if (
		(set.loadType === 'PERCENT' || set.loadType === 'KG') &&
		!set.loadValue
	) {
		return false
	}
	return true
}

function isDraftValid(draft: DraftProgram) {
	return draft.weeks.every(week =>
		week.days.every(day =>
			day.exercises.every(
				exercise =>
					exercise.exerciseId > 0 &&
					exercise.sets.length > 0 &&
					exercise.sets.every(isSetValid),
			),
		),
	)
}

function exerciseComparableSignature(exercise: {
	exerciseId: number
	sets: DraftSet[]
	notes: string
}) {
	return JSON.stringify({
		exerciseId: exercise.exerciseId,
		notes: exercise.notes,
		sets: exercise.sets.map(set => ({
			loadType: set.loadType,
			loadValue: set.loadValue,
			reps: set.reps,
			sets: set.sets,
		})),
	})
}

function exercisesMatch(
	left: DraftExercise | OriginalExerciseRef,
	right: DraftExercise | OriginalExerciseRef,
) {
	return (
		exerciseComparableSignature(left) === exerciseComparableSignature(right)
	)
}

function findNextMatch(
	originals: OriginalExerciseRef[],
	currents: DraftExercise[],
	originalStart: number,
	currentStart: number,
) {
	for (
		let originalIndex = originalStart;
		originalIndex < originals.length;
		originalIndex += 1
	) {
		for (
			let currentIndex = currentStart;
			currentIndex < currents.length;
			currentIndex += 1
		) {
			if (
				exercisesMatch(originals[originalIndex], currents[currentIndex])
			) {
				return { originalIndex, currentIndex }
			}
		}
	}
	return null
}

function buildDisplayItems(
	originals: OriginalExerciseRef[],
	currents: DraftExercise[],
): DisplayExerciseItem[] {
	const items: DisplayExerciseItem[] = []
	let originalIndex = 0
	let currentIndex = 0
	let displayOrder = 1

	while (originalIndex < originals.length || currentIndex < currents.length) {
		if (
			originalIndex < originals.length &&
			currentIndex < currents.length &&
			exercisesMatch(originals[originalIndex], currents[currentIndex])
		) {
			items.push({
				kind: 'current',
				key: currents[currentIndex].uid,
				displayOrder,
				exercise: currents[currentIndex],
				source: 'original',
			})
			originalIndex += 1
			currentIndex += 1
			displayOrder += 1
			continue
		}

		const nextMatch = findNextMatch(
			originals,
			currents,
			originalIndex,
			currentIndex,
		)

		if (!nextMatch) {
			while (originalIndex < originals.length) {
				items.push({
					kind: 'removed',
					key: `removed:${originals[originalIndex].key}`,
					displayOrder,
					exercise: originals[originalIndex],
				})
				originalIndex += 1
				displayOrder += 1
			}
			while (currentIndex < currents.length) {
				items.push({
					kind: 'current',
					key: currents[currentIndex].uid,
					displayOrder,
					exercise: currents[currentIndex],
					source: 'custom',
				})
				currentIndex += 1
				displayOrder += 1
			}
			break
		}

		while (originalIndex < nextMatch.originalIndex) {
			items.push({
				kind: 'removed',
				key: `removed:${originals[originalIndex].key}`,
				displayOrder,
				exercise: originals[originalIndex],
			})
			originalIndex += 1
			displayOrder += 1
		}

		while (currentIndex < nextMatch.currentIndex) {
			items.push({
				kind: 'current',
				key: currents[currentIndex].uid,
				displayOrder,
				exercise: currents[currentIndex],
				source: 'custom',
			})
			currentIndex += 1
			displayOrder += 1
		}
	}

	return items
}

function getOriginalDayExercises(
	program: ProgramData | null,
	weekNumber: number | null,
	weekday: string | null,
) {
	if (!program || weekNumber == null || !weekday) return []
	const week = program.weeks.find(entry => entry.number === weekNumber)
	const day = week?.days.find(entry => entry.weekday === weekday)
	return (
		day?.exercises.map((exercise, index) =>
			originalExerciseRef(exercise, `${weekNumber}:${weekday}:${index}`),
		) ?? []
	)
}

export function ProgramEditPage({ onClose }: ProgramEditPageProps) {
	const refreshProgram = useProgramStore(s => s.fetchProgram)
	const refreshCompletions = useProgramStore(s => s.fetchCompletions)

	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)
	const [draft, setDraft] = useState<DraftProgram | null>(null)
	const [originalProgram, setOriginalProgram] = useState<ProgramData | null>(
		null,
	)
	const [catalog, setCatalog] = useState<ExerciseData[]>([])
	const [selectedWeekUid, setSelectedWeekUid] = useState<string | null>(null)
	const [selectedDayUid, setSelectedDayUid] = useState<string | null>(null)
	const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
	const [initialContentSignature, setInitialContentSignature] = useState('')
	const [originalContentSignature, setOriginalContentSignature] = useState('')

	useEffect(() => {
		let mounted = true

		async function load() {
			try {
				setLoading(true)
				const [program, original, exercises] = await Promise.all([
					fetchProgram(),
					fetchOriginalProgram(),
					fetchExercises(),
				])
				if (!mounted) return

				const nextDraft = draftFromProgram(program)
				setDraft(nextDraft)
				setOriginalProgram(original)
				setCatalog(exercises)
				setInitialContentSignature(contentSignature(nextDraft))
				setOriginalContentSignature(
					contentSignature(draftFromProgram(original)),
				)
				setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null)
				setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null)
				setError(null)
			} catch {
				if (!mounted) return
				setError('Не удалось загрузить редактор программы')
			} finally {
				if (mounted) {
					setLoading(false)
				}
			}
		}

		load()
		return () => {
			mounted = false
		}
	}, [])

	const selectedWeek = useMemo(
		() => draft?.weeks.find(week => week.uid === selectedWeekUid) ?? null,
		[draft, selectedWeekUid],
	)
	const selectedDay = useMemo(
		() =>
			selectedWeek?.days.find(day => day.uid === selectedDayUid) ?? null,
		[selectedWeek, selectedDayUid],
	)
	const editorWeeks = useMemo(
		() =>
			draft?.weeks.map((week, index) => ({
				id: week.uid,
				number: index + 1,
				title: week.title || `${index + 1} неделя`,
			})) ?? [],
		[draft],
	)
	const selectedWeekNumber = useMemo(() => {
		if (!draft) return null
		const index = draft.weeks.findIndex(
			week => week.uid === selectedWeekUid,
		)
		return index === -1 ? null : index + 1
	}, [draft, selectedWeekUid])
	const originalDayExercises = useMemo(
		() =>
			getOriginalDayExercises(
				originalProgram,
				selectedWeekNumber,
				selectedDay?.weekday ?? null,
			),
		[originalProgram, selectedWeekNumber, selectedDay?.weekday],
	)
	const displayItems = useMemo(
		() =>
			buildDisplayItems(
				originalDayExercises,
				selectedDay?.exercises ?? [],
			),
		[originalDayExercises, selectedDay?.exercises],
	)

	const hasChanges = draft
		? contentSignature(draft) !== initialContentSignature
		: false
	const canSave =
		draft != null && isDraftValid(draft) && hasChanges && !saving

	function resetEditorToProgram(program: ProgramData) {
		const nextDraft = draftFromProgram(program)
		setDraft(nextDraft)
		setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null)
		setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null)
		setError(null)
	}

	useEffect(() => {
		if (!selectedWeek && draft?.weeks.length) {
			setSelectedWeekUid(draft.weeks[0].uid)
			setSelectedDayUid(draft.weeks[0].days[0]?.uid ?? null)
		}
	}, [draft, selectedWeek])

	useEffect(() => {
		if (!selectedWeek) return
		if (!selectedWeek.days.some(day => day.uid === selectedDayUid)) {
			setSelectedDayUid(selectedWeek.days[0]?.uid ?? null)
		}
	}, [selectedWeek, selectedDayUid])

	function updateDraft(mutator: (current: DraftProgram) => DraftProgram) {
		setDraft(current => (current ? mutator(current) : current))
	}

	function updateSelectedWeek(mutator: (week: DraftWeek) => DraftWeek) {
		updateDraft(current => ({
			...current,
			weeks: current.weeks.map(week =>
				week.uid === selectedWeekUid ? mutator(week) : week,
			),
		}))
	}

	function updateSelectedDay(mutator: (day: DraftDay) => DraftDay) {
		updateSelectedWeek(week => ({
			...week,
			days: week.days.map(day =>
				day.uid === selectedDayUid ? mutator(day) : day,
			),
		}))
	}

	function getExerciseMeta(exerciseId: number) {
		return catalog.find(entry => entry.id === exerciseId) ?? null
	}

	function selectWeekByNumber(weekNumber: number) {
		const nextWeek = draft?.weeks[weekNumber - 1]
		if (!nextWeek) return
		setSelectedWeekUid(nextWeek.uid)
		setSelectedDayUid(nextWeek.days[0]?.uid ?? null)
	}

	function requestDeleteExercise(exercise: DraftExercise) {
		const exerciseName =
			getExerciseMeta(exercise.exerciseId)?.name ?? 'это упражнение'
		setDeleteTarget({
			exerciseUid: exercise.uid,
			title: `Удалить упражнение «${exerciseName}»?`,
			description:
				'Упражнение исчезнет из итоговой программы, но оригинальные удаления останутся видны в редакторе.',
		})
	}

	function confirmDeleteExercise() {
		if (!deleteTarget) return
		updateSelectedDay(currentDay => ({
			...currentDay,
			exercises: currentDay.exercises.filter(
				exercise => exercise.uid !== deleteTarget.exerciseUid,
			),
		}))
		setDeleteTarget(null)
	}

	function restoreRemovedExercise(
		itemIndex: number,
		exercise: OriginalExerciseRef,
	) {
		updateSelectedDay(currentDay => {
			const nextCurrentItem = displayItems
				.slice(itemIndex + 1)
				.find(
					(
						item,
					): item is Extract<
						DisplayExerciseItem,
						{ kind: 'current' }
					> => item.kind === 'current',
				)
			const insertIndex = nextCurrentItem
				? currentDay.exercises.findIndex(
						entry => entry.uid === nextCurrentItem.exercise.uid,
					)
				: currentDay.exercises.length
			const exercises = [...currentDay.exercises]
			const targetIndex =
				insertIndex === -1 ? exercises.length : insertIndex
			exercises.splice(targetIndex, 0, cloneExercise(exercise))
			return { ...currentDay, exercises }
		})
	}

	async function performSave() {
		if (!draft || !canSave) return

		try {
			setSaving(true)
			setError(null)
			const commitMessage =
				contentSignature(draft) === originalContentSignature
					? 'Откат к оригинальной программе'
					: 'Обновление программы'
			const result = await saveProgramSnapshot(
				buildSavePayload(draft, commitMessage),
			)
			const nextDraft = draftFromProgram(result)
			setDraft(nextDraft)
			setInitialContentSignature(contentSignature(nextDraft))
			setSelectedWeekUid(nextDraft.weeks[0]?.uid ?? null)
			setSelectedDayUid(nextDraft.weeks[0]?.days[0]?.uid ?? null)
			setNotice('Изменения программы сохранены.')
			await refreshProgram()
			await refreshCompletions()
			onClose?.()
		} catch {
			setError('Не удалось сохранить программу')
		} finally {
			setSaving(false)
		}
	}

	function restoreOriginalProgram() {
		if (!originalProgram) {
			setError('Не удалось загрузить оригинальную программу')
			return
		}
		resetEditorToProgram(originalProgram)
		setNotice(
			'В редактор загружена оригинальная программа. Сохраните изменения, чтобы применить откат.',
		)
		setResetConfirmOpen(false)
	}

	function renderExerciseCard(item: DisplayExerciseItem, itemIndex: number) {
		const exercise = item.exercise
		const exerciseMeta = getExerciseMeta(exercise.exerciseId)
		const previewSets = exercise.sets.map((set, index) =>
			toPreviewSetData(set, `${item.key}:${index}`, index + 1),
		)
		const isRemoved = item.kind === 'removed'
		const isCustom = item.kind === 'current' && item.source === 'custom'
		const hasSuperset = exercise.supersetGroup != null

		return (
			<div key={item.key} className={cn(isRemoved && 'bg-muted/30')}>
				<ExerciseDisplayContent
					className='py-4'
					displayOrder={item.displayOrder}
					exercise={{
						id: exerciseMeta?.id ?? exercise.exerciseId,
						name: exerciseMeta?.name ?? 'Упражнение',
						category: exerciseMeta?.category ?? '',
					}}
					sets={previewSets}
					notes={exercise.notes}
					showAccessoryWeight={false}
					nameClassName={
						isRemoved ? 'line-through opacity-70' : undefined
					}
					setsClassName={isRemoved ? 'opacity-60' : undefined}
					badges={
						<>
							{hasSuperset ? (
								<Badge variant='outline' className='text-xs'>
									Суперсет
								</Badge>
							) : null}
							{isCustom ? (
								<Badge variant='outline' className='text-xs'>
									Своё
								</Badge>
							) : null}
							{isRemoved ? (
								<Badge
									variant='outline'
									className='text-xs text-destructive'
								>
									Удалено
								</Badge>
							) : null}
						</>
					}
					footer={
						<div className='mt-4 flex items-center justify-between gap-2 border-t pt-4'>
							{isRemoved ? (
								<>
									<p className='text-xs text-muted-foreground'>
										Упражнение останется вне программы, пока
										вы не вернёте его.
									</p>
									<Button
										variant='ghost'
										size='sm'
										onClick={() =>
											restoreRemovedExercise(
												itemIndex,
												item.exercise,
											)
										}
									>
										Вернуть
									</Button>
								</>
							) : (
								<>
									{isCustom ? (
										<p className='text-xs text-muted-foreground'>
											Добавленное упражнение.
										</p>
									) : (
										<span />
									)}
									<Button
										variant='ghost'
										size='icon-sm'
										aria-label='Удалить упражнение'
										onClick={() =>
											requestDeleteExercise(item.exercise)
										}
									>
										<Trash2 className='h-4 w-4' />
									</Button>
								</>
							)}
						</div>
					}
				/>
			</div>
		)
	}

	if (loading) {
		return (
			<div className='flex flex-1 items-center justify-center px-4'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
			</div>
		)
	}

	if (!draft) {
		return (
			<div className='px-4 py-6'>
				<p className='text-sm text-destructive'>
					{error ?? 'Редактор недоступен'}
				</p>
				<Button className='mt-4' variant='ghost' onClick={onClose}>
					Вернуться
				</Button>
			</div>
		)
	}

	return (
		<div className='flex min-h-0 flex-1 flex-col'>
			<div className='shrink-0 pl-1 pr-2 pt-1 pb-1'>
				<div className='flex items-center gap-2'>
					<div className='flex-1'>
						<WeekPicker
							items={editorWeeks}
							selectedNumber={selectedWeekNumber}
							onSelect={selectWeekByNumber}
							itemButtonVariant='ghost'
							triggerButtonProps={{
								className:
									'h-auto justify-start px-0 text-lg font-semibold',
							}}
						/>
					</div>
					<Button
						variant='ghost'
						size='icon-sm'
						aria-label='Откатить к оригинальной программе'
						onClick={() => setResetConfirmOpen(true)}
					>
						<RotateCcw className='h-4 w-4' />
					</Button>
					<Button
						variant='ghost'
						size='icon-sm'
						aria-label={saving ? 'Сохранение' : 'Сохранить'}
						onClick={performSave}
						disabled={!canSave}
					>
						<Save className='h-4 w-4' />
					</Button>
				</div>
			</div>

				<Tabs
					value={selectedDay?.uid}
					onValueChange={value => setSelectedDayUid(value)}
					className='relative flex min-h-0 flex-1 flex-col px-4'
				>
					{selectedWeek ? (
						<DayTabsBar
							className='absolute inset-x-0 top-0 -mx-4'
							items={selectedWeek.days.map(day => ({
								key: day.uid,
								value: day.uid,
								label:
									WEEKDAY_SHORT_LABELS[day.weekday] ??
									day.weekday,
							}))}
						/>
					) : null}

						<div className='hide-scrollbar min-h-0 flex-1 overflow-y-auto'>
							<div className={selectedWeek ? 'pb-8 pt-14' : 'pb-8'}>
								<p className='text-sm py-4'>
									Можно только удалять упражнения, если нет
							возможности их выполнять. Собственная программа
							создается отдельно.
						</p>

						{error ? (
							<p className='text-sm text-destructive'>{error}</p>
						) : null}
						{notice ? (
							<p className='text-sm text-muted-foreground'>
								{notice}
							</p>
						) : null}

						{!selectedWeek ? (
							<Card>
								<CardContent className='py-8 text-center text-sm text-muted-foreground'>
									Программа недоступна.
								</CardContent>
							</Card>
						) : selectedDay ? (
							<TabsContent
								value={selectedDay.uid}
								className='space-y-3'
							>
								{displayItems.length === 0 ? (
									<Card>
										<CardContent className='py-8 text-center text-sm text-muted-foreground'>
											В этом дне пока нет упражнений.
										</CardContent>
									</Card>
								) : (
									<div className='divide-y divide-border/70 border-y border-border/70'>
										{displayItems.map((item, index) =>
											renderExerciseCard(item, index),
										)}
									</div>
								)}

								{selectedDay.textBlocks.length > 0 ? (
									<div className='space-y-3 pt-1'>
										{selectedDay.textBlocks.map(
											(block, index) => (
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
											),
										)}
									</div>
								) : null}
							</TabsContent>
						) : null}
					</div>
				</div>
			</Tabs>

			<Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Загрузить оригинальную программу?
						</DialogTitle>
						<DialogDescription>
							Редактор переключится на исходную программу. Чтобы
							применить откат, её нужно будет сохранить.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant='ghost'
							onClick={() => setResetConfirmOpen(false)}
						>
							Назад
						</Button>
						<Button
							variant='ghost'
							onClick={restoreOriginalProgram}
						>
							Загрузить
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={deleteTarget != null}
				onOpenChange={open => !open && setDeleteTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{deleteTarget?.title ?? 'Удалить упражнение?'}
						</DialogTitle>
						<DialogDescription>
							{deleteTarget?.description}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant='ghost'
							onClick={() => setDeleteTarget(null)}
						>
							Отмена
						</Button>
						<Button variant='ghost' onClick={confirmDeleteExercise}>
							Удалить
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
