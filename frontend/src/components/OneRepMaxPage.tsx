import { Button } from '@/components/ui/button'
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
import { LockKeyhole, Play, Square } from 'lucide-react'
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

	const [draft, setDraft] = useState<Record<number, string>>({})
	const [startError, setStartError] = useState<string | null>(null)
	const [starting, setStarting] = useState(false)
	const [finishError, setFinishError] = useState<string | null>(null)
	const [finishing, setFinishing] = useState(false)
	const [finishReason, setFinishReason] = useState('')
	const [finishFeeling, setFinishFeeling] = useState('')

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
					{cycleHistory.filter(item => !item.is_active).length ===
					0 ? (
						<p className='text-sm text-muted-foreground'>
							Пока нет завершенных циклов.
						</p>
					) : (
						cycleHistory
							.filter(item => !item.is_active)
							.map(item => (
								<div key={item.id} className='rounded-2xl py-4'>
									<p className='font-medium'>
										{item.program_name}
									</p>
									<p className='mt-1 text-sm text-muted-foreground'>
										{formatDateTime(item.started_at)} →{' '}
										{item.completed_at
											? formatDateTime(item.completed_at)
											: 'в процессе'}
									</p>
									{item.completion_reason ? (
										<p className='mt-2 text-sm'>
											Причина: {item.completion_reason}
										</p>
									) : null}
									{item.completion_feeling ? (
										<p className='mt-1 text-sm text-muted-foreground'>
											{item.completion_feeling}
										</p>
									) : null}
								</div>
							))
					)}
				</CardContent>
			</Card>
		</div>
	)
}
