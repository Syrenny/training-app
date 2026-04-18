import { DayTabsBar } from '@/components/DayTabsBar'
import { ExerciseDisplayContent } from '@/components/ExerciseDisplayContent'
import { PageHeaderOverlay } from '@/components/PageHeaderOverlay'
import { WeekPicker } from '@/components/WeekPicker'
import { WorkoutSummaryCard } from '@/components/WorkoutSummaryCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Tabs } from '@/components/ui/tabs'
import type {
	DayExerciseData,
	ExerciseData,
	ProgramAdaptation,
	ProgramAdaptationInput,
	ProgramData,
} from '@/lib/api'
import {
	cancelProgramAdaptation,
	createProgramAdaptation,
	fetchExercises,
	fetchOriginalProgram,
	fetchProgramAdaptations,
} from '@/lib/api'
import { useProgramStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { MinusCircle, PencilLine, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

type ScopeValue = ProgramAdaptationInput['scope']

interface ScopeOption {
	value: ScopeValue
	label: string
}

interface EditorExerciseItem {
	displayOrder: number
	original: DayExerciseData
	current: DayExerciseData | null
	effectiveAdaptation: ProgramAdaptation | null
	kind: 'current' | 'replaced' | 'removed'
}

interface PendingAction {
	action: ProgramAdaptationInput['action']
	item: EditorExerciseItem
	allowedScopes: ScopeOption[]
}

const SCOPE_LABELS: Record<ScopeValue, string> = {
	ONLY_HERE: 'Только сейчас',
	CURRENT_CYCLE: 'До конца цикла',
	FUTURE_CYCLES: 'Во всех будущих циклах',
}

const SCOPE_PRIORITY: Record<ScopeValue, number> = {
	FUTURE_CYCLES: 0,
	CURRENT_CYCLE: 1,
	ONLY_HERE: 2,
}

function formatDateTime(value: string) {
	return new Date(value).toLocaleString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function getRelevantAdaptations(
	adaptations: ProgramAdaptation[],
	activeCycleId: number | null | undefined,
) {
	return adaptations
		.filter(item => {
			if (item.is_canceled) return false
			if (item.scope === 'FUTURE_CYCLES') return true
			return activeCycleId != null && item.cycle_id === activeCycleId
		})
		.sort((left, right) => {
			const scopeDiff =
				SCOPE_PRIORITY[left.scope] - SCOPE_PRIORITY[right.scope]
			if (scopeDiff !== 0) return scopeDiff
			const createdDiff =
				new Date(left.created_at).getTime() -
				new Date(right.created_at).getTime()
			if (createdDiff !== 0) return createdDiff
			return left.id - right.id
		})
}

function renderTextBlocks(
	blocks: ProgramData['weeks'][number]['days'][number]['text_blocks'],
) {
	if (blocks.length === 0) return null
	return (
		<div className='mt-4 space-y-3'>
			{blocks.map((block, index) => (
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
	)
}

export function ProgramAdaptationsPage() {
	const activeCycle = useProgramStore(s => s.activeCycle)
	const selectedProgram = useProgramStore(s => s.selectedProgram)
	const selectedWeek = useProgramStore(s => s.selectedWeek)
	const selectedDay = useProgramStore(s => s.selectedDay)
	const weeks = useProgramStore(s => s.weeks)
	const weekDetailCache = useProgramStore(s => s.weekDetailCache)
	const setWeek = useProgramStore(s => s.setWeek)
	const setDay = useProgramStore(s => s.setDay)
	const fetchProgram = useProgramStore(s => s.fetchProgram)
	const fetchPrograms = useProgramStore(s => s.fetchPrograms)
	const fetchActiveCycle = useProgramStore(s => s.fetchActiveCycle)

	const [catalog, setCatalog] = useState<ExerciseData[]>([])
	const [originalProgram, setOriginalProgram] = useState<ProgramData | null>(
		null,
	)
	const [adaptations, setAdaptations] = useState<ProgramAdaptation[]>([])
	const [loading, setLoading] = useState(true)
	const [pageError, setPageError] = useState<string | null>(null)
	const [pending, setPending] = useState<PendingAction | null>(null)
	const [scope, setScope] = useState<ScopeValue>('FUTURE_CYCLES')
	const [replacementExerciseId, setReplacementExerciseId] = useState('')
	const [reason, setReason] = useState('')
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const [cancelTarget, setCancelTarget] = useState<ProgramAdaptation | null>(
		null,
	)
	const [cancelReason, setCancelReason] = useState('')
	const [cancelError, setCancelError] = useState<string | null>(null)
	const [canceling, setCanceling] = useState(false)

	async function refreshAdaptationContext(programId: number) {
		const [nextOriginalProgram, nextAdaptations] = await Promise.all([
			fetchOriginalProgram(),
			fetchProgramAdaptations(programId),
		])
		setOriginalProgram(nextOriginalProgram)
		setAdaptations(nextAdaptations)
	}

	useEffect(() => {
		let mounted = true

		async function load() {
			try {
				setLoading(true)
				await Promise.all([
					fetchPrograms(),
					fetchActiveCycle(),
					fetchProgram(),
				])
				const exercises = await fetchExercises()
				const original = await fetchOriginalProgram()
				if (!mounted) return
				setCatalog(exercises)
				setOriginalProgram(original)
				setPageError(null)
			} catch {
				if (!mounted) return
				setPageError('Не удалось загрузить редактор адаптаций')
			} finally {
				if (mounted) setLoading(false)
			}
		}

		void load()
		return () => {
			mounted = false
		}
	}, [fetchActiveCycle, fetchProgram, fetchPrograms])

	useEffect(() => {
		if (!selectedProgram) return
		let mounted = true

		void (async () => {
			try {
				const [nextOriginalProgram, nextAdaptations] =
					await Promise.all([
						fetchOriginalProgram(),
						fetchProgramAdaptations(selectedProgram.id),
					])
				if (!mounted) return
				setOriginalProgram(nextOriginalProgram)
				setAdaptations(nextAdaptations)
			} catch {
				if (!mounted) return
				setAdaptations([])
			}
		})()

		return () => {
			mounted = false
		}
	}, [selectedProgram?.id])

	const week =
		selectedWeek != null ? (weekDetailCache[selectedWeek] ?? null) : null
	const day = useMemo(
		() => week?.days.find(item => item.weekday === selectedDay) ?? null,
		[selectedDay, week],
	)
	const originalDay = useMemo(() => {
		if (!originalProgram || selectedWeek == null || !selectedDay)
			return null
		const originalWeek = originalProgram.weeks.find(
			item => item.number === selectedWeek,
		)
		return (
			originalWeek?.days.find(item => item.weekday === selectedDay) ??
			null
		)
	}, [originalProgram, selectedDay, selectedWeek])

	const baseScopeOptions = useMemo<ScopeOption[]>(() => {
		if (
			activeCycle &&
			selectedProgram &&
			activeCycle.program_id === selectedProgram.id
		) {
			return [
				{ value: 'ONLY_HERE', label: SCOPE_LABELS.ONLY_HERE },
				{ value: 'CURRENT_CYCLE', label: SCOPE_LABELS.CURRENT_CYCLE },
				{ value: 'FUTURE_CYCLES', label: SCOPE_LABELS.FUTURE_CYCLES },
			]
		}
		return [{ value: 'FUTURE_CYCLES', label: SCOPE_LABELS.FUTURE_CYCLES }]
	}, [activeCycle, selectedProgram])

	const effectiveAdaptationsBySlot = useMemo(() => {
		const relevant = getRelevantAdaptations(adaptations, activeCycle?.id)
		const next = new Map<string, ProgramAdaptation>()
		for (const item of relevant) {
			next.set(item.slot_key, item)
		}
		return next
	}, [activeCycle?.id, adaptations])

	const displayItems = useMemo<EditorExerciseItem[]>(() => {
		if (!originalDay) return []
		const currentBySlot = new Map(
			(day?.exercises ?? []).map(item => [item.slot_key, item]),
		)
		return originalDay.exercises.map((original, index) => {
			const current = currentBySlot.get(original.slot_key) ?? null
			const effectiveAdaptation =
				effectiveAdaptationsBySlot.get(original.slot_key) ?? null
			let kind: EditorExerciseItem['kind'] = 'current'
			if (!current) {
				kind = 'removed'
			} else if (current.exercise.id !== original.exercise.id) {
				kind = 'replaced'
			}

			return {
				displayOrder: index + 1,
				original,
				current,
				effectiveAdaptation,
				kind,
			}
		})
	}, [day?.exercises, effectiveAdaptationsBySlot, originalDay])

	function getAllowedScopes(
		item: EditorExerciseItem,
		action: ProgramAdaptationInput['action'],
	) {
		if (action === 'REPLACE' && item.kind === 'removed') {
			return []
		}
		if (action === 'REPLACE' && item.kind === 'replaced') {
			return baseScopeOptions.filter(
				option => option.value === 'ONLY_HERE',
			)
		}
		return baseScopeOptions
	}

	function openAction(
		item: EditorExerciseItem,
		action: ProgramAdaptationInput['action'],
	) {
		const allowedScopes = getAllowedScopes(item, action)
		if (allowedScopes.length === 0) {
			setPageError(
				'Эту замену можно продолжить только после явной отмены прошлого правила.',
			)
			return
		}

		setPending({ action, item, allowedScopes })
		setScope(allowedScopes[0].value)
		setReplacementExerciseId('')
		setReason('')
		setSubmitError(null)
		setPageError(null)
	}

	function closeAction() {
		setPending(null)
		setScope(baseScopeOptions[0]?.value ?? 'FUTURE_CYCLES')
		setReplacementExerciseId('')
		setReason('')
		setSubmitError(null)
		setSubmitting(false)
	}

	function openCancel(adaptation: ProgramAdaptation) {
		setCancelTarget(adaptation)
		setCancelReason('')
		setCancelError(null)
	}

	function closeCancel() {
		setCancelTarget(null)
		setCancelReason('')
		setCancelError(null)
		setCanceling(false)
	}

	async function handleSubmit() {
		if (!pending || !selectedProgram || !selectedWeek || !selectedDay)
			return
		if (pending.action === 'REPLACE' && !replacementExerciseId) return

		const currentExercise = pending.item.current ?? pending.item.original

		setSubmitting(true)
		setSubmitError(null)
		try {
			await createProgramAdaptation({
				program_id: selectedProgram.id,
				scope,
				action: pending.action,
				slot_key: pending.item.original.slot_key,
				week_number: selectedWeek,
				weekday: selectedDay,
				original_exercise_id: currentExercise.exercise.id,
				replacement_exercise_id:
					pending.action === 'REPLACE'
						? Number(replacementExerciseId)
						: null,
				reason,
			})
			await fetchProgram()
			await refreshAdaptationContext(selectedProgram.id)
			closeAction()
		} catch (nextError) {
			setSubmitError(
				nextError instanceof Error
					? nextError.message
					: 'Не удалось сохранить адаптацию',
			)
			setSubmitting(false)
		}
	}

	async function handleCancelAdaptation() {
		if (!cancelTarget || !selectedProgram) return

		setCanceling(true)
		setCancelError(null)
		try {
			await cancelProgramAdaptation(
				cancelTarget.id,
				cancelReason || undefined,
			)
			await fetchProgram()
			await refreshAdaptationContext(selectedProgram.id)
			closeCancel()
		} catch (nextError) {
			setCancelError(
				nextError instanceof Error
					? nextError.message
					: 'Не удалось отменить адаптацию',
			)
			setCanceling(false)
		}
	}

	function renderExerciseCard(item: EditorExerciseItem) {
		const preview = item.current ?? item.original
		const replaceScopes = getAllowedScopes(item, 'REPLACE')
		const canReplace = replaceScopes.length > 0
		const effectiveScopeLabel = item.effectiveAdaptation
			? SCOPE_LABELS[item.effectiveAdaptation.scope]
			: null

		const badges = [
			item.kind === 'removed' ? (
				<Badge
					key='removed'
					variant='outline'
					className='text-xs text-destructive'
				>
					Удалено
				</Badge>
			) : null,

			item.kind === 'replaced' ? (
				<Badge key='replaced' variant='outline' className='text-xs'>
					Заменено
				</Badge>
			) : null,

			effectiveScopeLabel ? (
				<Badge key='scope' variant='secondary' className='text-xs'>
					{effectiveScopeLabel}
				</Badge>
			) : null,
		].filter(Boolean)

		return (
			<div
				key={item.original.slot_key}
				className={cn(item.kind === 'removed' && 'bg-muted/30')}
			>
				<ExerciseDisplayContent
					className='py-4'
					exercise={preview.exercise}
					sets={preview.sets}
					notes={preview.notes}
					showAccessoryWeight={false}
					nameClassName={
						item.kind === 'removed'
							? 'line-through opacity-70'
							: undefined
					}
					setsClassName={
						item.kind === 'removed' ? 'opacity-60' : undefined
					}
					badges={badges}
					footer={
						<div className='mt-4 border-t pt-4'>
							{item.kind === 'replaced' ? (
								<p className='mb-3 text-sm text-muted-foreground'>
									Вместо: {item.original.exercise.name}
								</p>
							) : null}
							{item.kind === 'removed' ? (
								<div className='flex flex-wrap items-center justify-between gap-2'>
									<p className='text-sm text-muted-foreground'>
										Упражнение скрыто активной адаптацией.
									</p>
									{item.effectiveAdaptation ? (
										<Button
											variant='ghost'
											size='sm'
											onClick={() =>
												openCancel(
													item.effectiveAdaptation!,
												)
											}
										>
											<RotateCcw className='h-4 w-4' />
											Отменить правило
										</Button>
									) : null}
								</div>
							) : (
								<div className='flex flex-wrap items-center justify-between gap-2'>
									<div className='flex flex-wrap gap-5'>
										{item.effectiveAdaptation ? (
											<Button
												variant='ghost'
												size='sm'
												onClick={() =>
													openCancel(
														item.effectiveAdaptation!,
													)
												}
											>
												<RotateCcw className='h-4 w-4' />
												Отменить правило
											</Button>
										) : null}
										<Button
											variant='ghost'
											size='sm'
											onClick={() =>
												openAction(item, 'DELETE')
											}
										>
											<MinusCircle className='h-4 w-4' />
											Удалить
										</Button>
										<Button
											variant='ghost'
											size='sm'
											onClick={() =>
												openAction(item, 'REPLACE')
											}
											disabled={!canReplace}
										>
											<PencilLine className='h-4 w-4' />
											Заменить
										</Button>
									</div>
								</div>
							)}
						</div>
					}
				/>
			</div>
		)
	}

	if (loading) {
		return (
			<div className='flex items-center justify-center py-16'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent' />
			</div>
		)
	}

	const hasOverlayHeader = Boolean(week)

	return (
		<div className='relative flex min-h-0 flex-1 flex-col'>
			{hasOverlayHeader ? (
				<PageHeaderOverlay>
					<WeekPicker
						items={weeks}
						selectedNumber={selectedWeek}
						onSelect={setWeek}
					/>
				</PageHeaderOverlay>
			) : (
				<div className='shrink-0 px-4 py-3'>
					<div className='rounded-full border border-white/20 bg-white/15 px-3 py-2 shadow-lg backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-black/25'>
						<WeekPicker
							items={weeks}
							selectedNumber={selectedWeek}
							onSelect={setWeek}
						/>
					</div>
				</div>
			)}

			<div
				className={`flex min-h-0 flex-1 px-4`}
			>
					<Tabs
						value={selectedDay ?? undefined}
						onValueChange={setDay}
						className='flex min-h-0 flex-1 flex-col'
					>
						{week ? (
							<DayTabsBar
								className='absolute left-4 right-4 top-[4rem]'
								items={week.days.map(item => ({
									key: item.weekday,
									value: item.weekday,
								label: item.weekday_display,
							}))}
						/>
					) : null}

						<div className='hide-scrollbar min-h-0 flex-1 overflow-y-auto'>
							<div className='space-y-4 pb-24 mt-25'>
							{pageError ? (
								<p className='text-sm text-destructive'>
									{pageError}
								</p>
							) : null}

						{!day ? (
							<Card>
								<CardContent className='py-8 text-center text-sm text-muted-foreground'>
									В выбранной неделе нет тренировочного дня.
								</CardContent>
							</Card>
						) : (
							<>
								<Card className='gap-0 bg-transparent py-0 shadow-none mb-5'>
									<CardContent className='px-0 py-3'>
										{day.title ? (
											<p className='mb-2 text-md font-semibold text-muted-foreground'>
												{day.title}
											</p>
										) : null}
										{day.exercises.length > 0 ? (
											<WorkoutSummaryCard
												exercises={day.exercises}
											/>
										) : (
											<p className='text-sm text-muted-foreground'>
												В этой тренировке пока нет
												упражнений.
											</p>
										)}
									</CardContent>
								</Card>

								{displayItems.length === 0 ? (
									<Card>
										<CardContent className='py-8 text-center text-sm text-muted-foreground'>
											В выбранном дне нет упражнений.
										</CardContent>
									</Card>
								) : (
									<div className='divide-y divide-border/70 border-y border-border/70'>
										{displayItems.map(renderExerciseCard)}
									</div>
								)}

								{renderTextBlocks(day.text_blocks)}
							</>
						)}

						<Card>
							<CardHeader>
								<CardTitle>Модификации</CardTitle>
							</CardHeader>
							<CardContent className='space-y-3'>
								{adaptations.length === 0 ? (
									<p className='text-sm text-muted-foreground'>
										Изменений нет
									</p>
								) : (
									adaptations.map(item => (
										<div
											key={item.id}
											className='py-4 border-t'
										>
											<div className='flex flex-wrap items-center gap-2'>
												<Badge
													variant={
														item.is_canceled
															? 'outline'
															: 'secondary'
													}
												>
													{item.is_canceled
														? 'Отменено'
														: item.action_label}
												</Badge>
												<Badge variant='outline'>
													{SCOPE_LABELS[item.scope]}
												</Badge>
												<span className='text-xs text-muted-foreground'>
													Неделя {item.week_number},{' '}
													{item.weekday}
												</span>
											</div>
											<p className='mt-3 text-sm'>
												{item.original_exercise_name ??
													'Упражнение'}
												{item.replacement_exercise_name
													? ` → ${item.replacement_exercise_name}`
													: ''}
											</p>
											{item.reason ? (
												<p className='mt-2 text-sm text-muted-foreground'>
													{item.reason}
												</p>
											) : null}
											{item.is_canceled ? (
												<p className='mt-2 text-sm text-muted-foreground'>
													Отменено{' '}
													{item.canceled_at
														? formatDateTime(
																item.canceled_at,
															)
														: ''}
													.
													{item.cancellation_reason
														? ` ${item.cancellation_reason}`
														: ''}
												</p>
											) : (
												<div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
													<p className='text-xs text-muted-foreground'>
														Создано{' '}
														{formatDateTime(
															item.created_at,
														)}
													</p>
													<Button
														variant='ghost'
														size='sm'
														onClick={() =>
															openCancel(item)
														}
													>
														<RotateCcw className='h-4 w-4' />
														Отменить
													</Button>
												</div>
											)}
										</div>
									))
								)}
							</CardContent>
						</Card>
							</div>
						</div>
					</Tabs>
				</div>

			<Dialog
				open={pending != null}
				onOpenChange={open => (!open ? closeAction() : null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{pending?.action === 'DELETE'
								? 'Удалить упражнение'
								: 'Заменить упражнение'}
						</DialogTitle>
						<DialogDescription>
							{(pending?.item.current ?? pending?.item.original)
								?.exercise.name ?? 'Упражнение'}{' '}
							— выберите область действия и, если нужно, новую
							замену.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-1'>
							<label className='block text-sm text-muted-foreground'>
								Область действия
							</label>
							<Select
								value={scope}
								onValueChange={value =>
									setScope(
										value as ProgramAdaptationInput['scope'],
									)
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(pending?.allowedScopes ?? []).map(
										item => (
											<SelectItem
												key={item.value}
												value={item.value}
											>
												{item.label}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</div>

						{pending?.action === 'REPLACE' ? (
							<div className='space-y-1'>
								<label className='block text-sm text-muted-foreground'>
									Новое упражнение
								</label>
								<Select
									value={replacementExerciseId}
									onValueChange={setReplacementExerciseId}
								>
									<SelectTrigger>
										<SelectValue placeholder='Выберите упражнение' />
									</SelectTrigger>
									<SelectContent>
										{catalog
											.filter(
												item =>
													item.id !==
													(
														pending.item.current ??
														pending.item.original
													).exercise.id,
											)
											.map(item => (
												<SelectItem
													key={item.id}
													value={String(item.id)}
												>
													{item.name}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>
						) : null}

						<div className='space-y-1'>
							<label className='block text-sm text-muted-foreground'>
								Причина
							</label>
							<Input
								value={reason}
								onChange={event =>
									setReason(event.target.value)
								}
								placeholder='Например: колено не терпит этот вариант'
							/>
						</div>

						{submitError ? (
							<p className='text-sm text-destructive'>
								{submitError}
							</p>
						) : null}
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={closeAction}>
							Отмена
						</Button>
						<Button onClick={handleSubmit} disabled={submitting}>
							{submitting ? 'Сохраняю...' : 'Сохранить адаптацию'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={cancelTarget != null}
				onOpenChange={open => (!open ? closeCancel() : null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Отменить адаптацию</DialogTitle>
						<DialogDescription>
							Если тренировка по этому правилу уже была проведена,
							укажите причину отмены. Иначе правило просто
							удалится.
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-4'>
						<div className='space-y-1'>
							<label className='block text-sm text-muted-foreground'>
								Причина отмены
							</label>
							<Input
								value={cancelReason}
								onChange={event =>
									setCancelReason(event.target.value)
								}
								placeholder='Например: правило создал по ошибке'
							/>
						</div>

						{cancelError ? (
							<p className='text-sm text-destructive'>
								{cancelError}
							</p>
						) : null}
					</div>

					<DialogFooter>
						<Button variant='outline' onClick={closeCancel}>
							Назад
						</Button>
						<Button
							onClick={handleCancelAdaptation}
							disabled={canceling}
						>
							{canceling ? 'Отменяю...' : 'Подтвердить'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
