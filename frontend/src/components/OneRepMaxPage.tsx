import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { useProgramStore } from '@/lib/store'
import { RotateCcw, Save } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function getOneRepMaxDraftKey(programId: number) {
	return `training-app-orm-draft:${programId}`
}

function loadOneRepMaxDraft(programId: number): Record<number, string> {
	if (typeof window === 'undefined') return {}
	try {
		const raw = window.localStorage.getItem(getOneRepMaxDraftKey(programId))
		if (!raw) return {}
		const parsed = JSON.parse(raw) as Record<string, string>
		return Object.fromEntries(
			Object.entries(parsed).map(([key, value]) => [Number(key), value]),
		)
	} catch {
		return {}
	}
}

function saveOneRepMaxDraft(programId: number, draft: Record<number, string>) {
	if (typeof window === 'undefined') return
	if (Object.keys(draft).length === 0) {
		window.localStorage.removeItem(getOneRepMaxDraftKey(programId))
		return
	}
	window.localStorage.setItem(
		getOneRepMaxDraftKey(programId),
		JSON.stringify(draft),
	)
}

function clearOneRepMaxDraft(programId: number) {
	if (typeof window === 'undefined') return
	window.localStorage.removeItem(getOneRepMaxDraftKey(programId))
}

export function OneRepMaxPage() {
	const programs = useProgramStore(s => s.programs)
	const selectedProgram = useProgramStore(s => s.selectedProgram)
	const oneRepMax = useProgramStore(s => s.oneRepMax)
	const fetchPrograms = useProgramStore(s => s.fetchPrograms)
	const fetchProgram = useProgramStore(s => s.fetchProgram)
	const fetchOneRepMax = useProgramStore(s => s.fetchOneRepMax)
	const fetchCompletions = useProgramStore(s => s.fetchCompletions)
	const selectProgram = useProgramStore(s => s.selectProgram)
	const saveOneRepMax = useProgramStore(s => s.saveOneRepMax)
	const resetCompletions = useProgramStore(s => s.resetCompletions)

	const [draft, setDraft] = useState<Record<number, string>>({})
	const [saveError, setSaveError] = useState<string | null>(null)
	const [resetError, setResetError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [resetting, setResetting] = useState(false)

	useEffect(() => {
		void Promise.all([
			fetchPrograms(),
			fetchProgram(),
			fetchOneRepMax(),
			fetchCompletions(),
		])
	}, [
		fetchPrograms,
		fetchProgram,
		fetchOneRepMax,
		fetchCompletions,
	])

	useEffect(() => {
		if (!selectedProgram) {
			setDraft({})
			setSaveError(null)
			return
		}
		setDraft(loadOneRepMaxDraft(selectedProgram.id))
		setSaveError(null)
	}, [selectedProgram?.id])

	useEffect(() => {
		if (!selectedProgram) return
		saveOneRepMaxDraft(selectedProgram.id, draft)
	}, [draft, selectedProgram?.id])

	const items = useMemo(() => {
		if (selectedProgram && oneRepMax?.program_id === selectedProgram.id) {
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
	}, [oneRepMax, selectedProgram])
	const basePrograms = useMemo(
		() => programs.filter(program => !program.is_custom),
		[programs],
	)
	const customPrograms = useMemo(
		() => programs.filter(program => program.is_custom),
		[programs],
	)

	async function handleProgramChange(value: string) {
		setSaveError(null)
		setResetError(null)
		await selectProgram(Number(value))
	}

	function getDraftValue(exerciseId: number, fallback: number) {
		return draft[exerciseId] ?? String(fallback || '')
	}

	function handleDraftChange(exerciseId: number, raw: string) {
		const digits = raw.replace(/\D/g, '').slice(0, 3)
		setDraft(prev => ({ ...prev, [exerciseId]: digits }))
	}

	async function handleSave() {
		if (!selectedProgram) return
		setSaving(true)
		setSaveError(null)
		try {
			await saveOneRepMax(
				items.map(item => ({
					exercise_id: item.exercise_id,
					value: Number(draft[item.exercise_id] ?? item.value ?? 0),
				})),
			)
			clearOneRepMaxDraft(selectedProgram.id)
			await fetchOneRepMax()
		} catch (error) {
			setSaveError(
				error instanceof Error
					? error.message
					: 'Не удалось сохранить 1ПМ',
			)
		} finally {
			setSaving(false)
		}
	}

	async function handleResetCompletions() {
		if (!selectedProgram) return
		const confirmed = window.confirm(
			`Сбросить все отметки по программе "${selectedProgram.name}"?`,
		)
		if (!confirmed) return

		setResetting(true)
		setResetError(null)
		try {
			await resetCompletions()
		} catch (error) {
			setResetError(
				error instanceof Error
					? error.message
					: 'Не удалось сбросить отметки',
			)
		} finally {
			setResetting(false)
		}
	}

	return (
		<div className='space-y-4'>
			<Card>
				<CardHeader>
					<CardTitle>Программа</CardTitle>
				</CardHeader>
				<CardContent className='space-y-5'>
					<div className='space-y-3'>
						<Select
							value={
								selectedProgram
									? String(selectedProgram.id)
									: undefined
							}
							onValueChange={handleProgramChange}
							disabled={programs.length === 0}
						>
							<SelectTrigger className='w-full'>
								<SelectValue placeholder='Выберите программу' />
							</SelectTrigger>
						<SelectContent>
								{customPrograms.length > 0 ? (
									<SelectGroup>
										<SelectLabel>Мои программы</SelectLabel>
										{customPrograms.map(program => (
											<SelectItem
												key={program.id}
												value={String(program.id)}
											>
												{program.name}
											</SelectItem>
										))}
									</SelectGroup>
								) : null}
								{customPrograms.length > 0 &&
								basePrograms.length > 0 ? (
									<SelectSeparator />
								) : null}
								{basePrograms.length > 0 ? (
									<SelectGroup>
										<SelectLabel>Базовые программы</SelectLabel>
										{basePrograms.map(program => (
											<SelectItem
												key={program.id}
												value={String(program.id)}
											>
												{program.name}
											</SelectItem>
										))}
									</SelectGroup>
								) : null}
							</SelectContent>
						</Select>
						{selectedProgram?.description ? (
							<p className='text-sm text-muted-foreground'>
								{selectedProgram.description}
							</p>
						) : null}
						{selectedProgram ? (
							<div className='flex flex-wrap gap-2'>
								<Badge variant='outline'>
									{selectedProgram.is_custom
										? 'Своя программа'
										: 'Базовая программа'}
								</Badge>
								{selectedProgram.is_custom &&
								selectedProgram.source_program_name ? (
									<Badge variant='secondary'>
										Основа: {selectedProgram.source_program_name}
									</Badge>
								) : null}
							</div>
						) : null}
					</div>

					<div className='space-y-3 border-t pt-5'>
						<p className='text-sm font-medium'>1ПМ</p>
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
						<div className='flex justify-between flex-wrap gap-2 pt-2'>
							<Button
								variant='ghost'
								onClick={handleResetCompletions}
								disabled={resetting || !selectedProgram}
							>
								<RotateCcw className='h-4 w-4' />
								{resetting ? 'Сброс...' : 'Сбросить отметки'}
							</Button>
							<Button
								variant='ghost'
								onClick={handleSave}
								disabled={saving || !selectedProgram}
							>
								<Save className='h-4 w-4' />
								{saving ? 'Сохранение...' : 'Сохранить 1ПМ'}
							</Button>
						</div>
						{saveError ? (
							<p className='text-sm text-destructive'>{saveError}</p>
						) : null}
						{resetError ? (
							<p className='text-sm text-destructive'>{resetError}</p>
						) : null}
					</div>
					</CardContent>
				</Card>
		</div>
	)
}
