import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useProgramStore } from '@/lib/store'
import { LockKeyhole, Play, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function formatDateTime(value: string) {
	return new Date(value).toLocaleString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	})
}

export function OneRepMaxPage() {
	const programs = useProgramStore(s => s.programs)
	const selectedProgram = useProgramStore(s => s.selectedProgram)
	const activeCycle = useProgramStore(s => s.activeCycle)
	const cycleHistory = useProgramStore(s => s.cycleHistory)
	const oneRepMax = useProgramStore(s => s.oneRepMax)
	const fetchPrograms = useProgramStore(s => s.fetchPrograms)
	const fetchActiveCycle = useProgramStore(s => s.fetchActiveCycle)
	const fetchCycleHistory = useProgramStore(s => s.fetchCycleHistory)
	const fetchProgram = useProgramStore(s => s.fetchProgram)
	const fetchOneRepMax = useProgramStore(s => s.fetchOneRepMax)
	const selectProgram = useProgramStore(s => s.selectProgram)
	const startCycle = useProgramStore(s => s.startCycle)
	const finishCycle = useProgramStore(s => s.finishCycle)
	const deleteCycle = useProgramStore(s => s.deleteCycle)

	const [draft, setDraft] = useState<Record<number, string>>({})
	const [startError, setStartError] = useState<string | null>(null)
	const [starting, setStarting] = useState(false)
	const [finishError, setFinishError] = useState<string | null>(null)
	const [finishing, setFinishing] = useState(false)
	const [finishReason, setFinishReason] = useState('')
	const [finishFeeling, setFinishFeeling] = useState('')
	const [deleteError, setDeleteError] = useState<string | null>(null)
	const [deletingCycleId, setDeletingCycleId] = useState<number | null>(null)

	useEffect(() => {
		void Promise.all([
			fetchPrograms(),
			fetchActiveCycle(),
			fetchCycleHistory(),
			fetchProgram(),
			fetchOneRepMax(),
		])
	}, [
		fetchPrograms,
		fetchActiveCycle,
		fetchCycleHistory,
		fetchProgram,
		fetchOneRepMax,
	])

	useEffect(() => {
		setDraft({})
		setStartError(null)
	}, [selectedProgram?.id, activeCycle?.id])

	const items = useMemo(() => {
		if (activeCycle && oneRepMax?.cycle_id === activeCycle.id) {
			return oneRepMax.items
		}
		return (
			selectedProgram?.one_rep_max_exercises.map(item => ({
				exercise_id: item.exercise_id,
				exercise_name: item.exercise.name,
				category: item.exercise.category,
				label: item.label || item.exercise.name,
				value: 0,
			})) ?? []
		)
	}, [activeCycle, oneRepMax, selectedProgram])

	const completedCycles = useMemo(
		() => cycleHistory.filter(item => !item.is_active),
		[cycleHistory],
	)

	async function handleProgramChange(value: string) {
		setStartError(null)
		await selectProgram(Number(value))
	}

	function getDraftValue(exerciseId: number, fallback: number) {
		return draft[exerciseId] ?? String(fallback || '')
	}

	function handleDraftChange(exerciseId: number, raw: string) {
		const digits = raw.replace(/\D/g, '').slice(0, 3)
		setDraft(prev => ({ ...prev, [exerciseId]: digits }))
	}

	async function handleStart() {
		if (!selectedProgram) return
		setStarting(true)
		setStartError(null)
		try {
			await startCycle({
				program_id: selectedProgram.id,
				items: items.map(item => ({
					exercise_id: item.exercise_id,
					value: Number(draft[item.exercise_id] ?? item.value ?? 0),
				})),
			})
			setDraft({})
		} catch (error) {
			setStartError(
				error instanceof Error
					? error.message
					: 'Не удалось начать цикл',
			)
		} finally {
			setStarting(false)
		}
	}

	async function handleFinish() {
		if (!finishReason.trim() || !finishFeeling.trim()) {
			setFinishError('Заполните поля.')
			return
		}
		setFinishing(true)
		setFinishError(null)
		try {
			await finishCycle(finishReason.trim(), finishFeeling.trim())
			setFinishReason('')
			setFinishFeeling('')
		} catch (error) {
			setFinishError(
				error instanceof Error
					? error.message
					: 'Не удалось завершить цикл',
			)
		} finally {
			setFinishing(false)
		}
	}

	async function handleDeleteCycle(cycleId: number, programName: string) {
		const confirmed = window.confirm(
			`Удалить цикл "${programName}" из истории? Это действие нельзя отменить.`,
		)
		if (!confirmed) return

		setDeleteError(null)
		setDeletingCycleId(cycleId)
		try {
			await deleteCycle(cycleId)
		} catch (error) {
			setDeleteError(
				error instanceof Error
					? error.message
					: 'Не удалось удалить цикл',
			)
		} finally {
			setDeletingCycleId(null)
		}
	}

	return (
		<div className='space-y-4'>
			<Card>
				<CardHeader>
					<CardTitle>Тренировочный цикл</CardTitle>
				</CardHeader>
				<CardContent className='space-y-5'>
					<div className='space-y-3'>
						<p className='text-sm font-medium'>Шаг 1. Программа</p>
						<Select
							value={
								selectedProgram
									? String(selectedProgram.id)
									: undefined
							}
							onValueChange={handleProgramChange}
							disabled={
								activeCycle != null || programs.length === 0
							}
						>
							<SelectTrigger className='w-full'>
								<SelectValue placeholder='Выберите программу' />
							</SelectTrigger>
							<SelectContent>
								{programs.map(program => (
									<SelectItem
										key={program.id}
										value={String(program.id)}
									>
										{program.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedProgram?.description ? (
							<p className='text-sm text-muted-foreground'>
								{selectedProgram.description}
							</p>
						) : null}
					</div>

					<div className='space-y-3 border-t pt-5'>
						<div className='flex items-center gap-2'>
							<p className='text-sm font-medium'>Шаг 2. 1ПМ</p>
							{activeCycle ? (
								<LockKeyhole className='h-4 w-4 text-muted-foreground' />
							) : null}
						</div>
						{items.map(item => (
							<div key={item.exercise_id} className='space-y-1'>
								<label className='block text-sm text-muted-foreground'>
									{item.label}, кг
								</label>
								<Input
									type='text'
									inputMode='numeric'
									pattern='[0-9]*'
									maxLength={3}
									disabled={activeCycle != null}
									value={getDraftValue(
										item.exercise_id,
										item.value,
									)}
									onChange={event =>
										handleDraftChange(
											item.exercise_id,
											event.target.value,
										)
									}
									placeholder='0'
								/>
							</div>
						))}
						{items.length === 0 ? (
							<p className='text-sm text-muted-foreground'>
								У выбранной программы нет настроенных упражнений
								1ПМ.
							</p>
						) : null}
					</div>

					<div className='space-y-3 border-t pt-5 flex justify-between items-start'>
						<p className='text-sm font-medium'>Шаг 3. Старт</p>
						{activeCycle ? (
							<div className='text-sm'>
								<p className='font-medium'>
									{activeCycle.program_name}
								</p>
								<p className='mt-1 text-muted-foreground'>
									Начало:{' '}
									{formatDateTime(activeCycle.started_at)}
								</p>
							</div>
						) : (
							<div className='space-y-3'>
								<Button
									className='w-full'
									onClick={handleStart}
									disabled={starting || !selectedProgram}
                                    variant='ghost'
								>
									<Play className='h-4 w-4' />
									{starting ? 'Запуск...' : 'Начать цикл'}
								</Button>
								{startError ? (
									<p className='text-sm text-destructive'>
										{startError}
									</p>
								) : null}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			{activeCycle ? (
				<Card>
					<CardHeader>
						<div className='flex justify-between items-center'>
							<CardTitle>Завершение цикла</CardTitle>
							<Button
								variant='ghost'
								onClick={handleFinish}
								disabled={finishing}
							>
								<Square className='h-4 w-4' />
								{finishing ? 'Завершение...' : 'Завершить'}
							</Button>
						</div>
						{finishError ? (
							<p className='text-sm text-destructive'>
								{finishError}
							</p>
						) : null}
					</CardHeader>
					<CardContent className='space-y-4'>
						<div className='space-y-1'>
							<label className='block text-sm text-muted-foreground'>
								Причина
							</label>
							<Input
								value={finishReason}
								onChange={event =>
									setFinishReason(event.target.value)
								}
							/>
						</div>
						<div className='space-y-1'>
							<label className='block text-sm text-muted-foreground'>
								Заметки
							</label>
							<Textarea
								className='min-h-24'
								value={finishFeeling}
								onChange={event =>
									setFinishFeeling(event.target.value)
								}
							/>
						</div>
					</CardContent>
				</Card>
			) : null}

				<Card>
					<CardHeader>
						<CardTitle>История циклов</CardTitle>
					</CardHeader>
					<CardContent className='space-y-3'>
						{deleteError ? (
							<p className='text-sm text-destructive'>{deleteError}</p>
						) : null}
						{completedCycles.length === 0 ? (
							<p className='text-sm text-muted-foreground'>
								Пока нет завершенных циклов.
							</p>
						) : (
							completedCycles.map(item => (
								<div key={item.id} className='border-t py-4'>
									<div className='flex flex-wrap items-center gap-2'>
										<Badge variant='secondary'>
											Завершен
										</Badge>
										<Badge variant='outline'>
											{item.program_name}
										</Badge>
										<span className='text-xs text-muted-foreground'>
											{formatDateTime(item.started_at)} →{' '}
											{item.completed_at
												? formatDateTime(item.completed_at)
												: 'в процессе'}
										</span>
									</div>
									<p className='mt-3 text-sm'>
										{item.completion_reason ||
											'Причина завершения не указана'}
									</p>
									{item.completion_feeling ? (
										<p className='mt-2 text-sm text-muted-foreground'>
											{item.completion_feeling}
										</p>
									) : null}
									<div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
										<p className='text-xs text-muted-foreground'>
											Завершено{' '}
											{item.completed_at
												? formatDateTime(item.completed_at)
												: 'без даты'}
										</p>
										<Button
											variant='ghost'
											size='sm'
											disabled={deletingCycleId === item.id}
											onClick={() =>
												handleDeleteCycle(
													item.id,
													item.program_name,
												)
											}
										>
											<Trash2 className='h-4 w-4' />
											Удалить
										</Button>
										</div>
								</div>
							))
						)}
					</CardContent>
				</Card>
		</div>
	)
}
