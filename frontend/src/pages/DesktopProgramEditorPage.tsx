import { Button } from '@/components/ui/button'
import type { AuthUser } from '@/lib/api'
import { ProgramEditPage } from '@/pages/ProgramEditPage'

interface DesktopProgramEditorPageProps {
	user: AuthUser
	onLogout: () => void
}

function getInitial(userName?: string, username?: string) {
	const source = userName || username || 'T'
	return source.trim().charAt(0).toUpperCase()
}

export function DesktopProgramEditorPage({
	user,
	onLogout,
}: DesktopProgramEditorPageProps) {
	const fullName = [user.first_name, user.last_name]
		.filter(Boolean)
		.join(' ')
		.trim()

	return (
		<div className='min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),_transparent_24%),var(--background)] text-foreground'>
			<div className='mx-auto grid min-h-screen max-w-[1680px] gap-6 px-4 py-4 xl:grid-cols-[320px_minmax(0,1fr)] xl:px-6 xl:py-6'>
				<aside className='space-y-4'>
					<Button asChild variant='ghost' size='sm'>
						<a href='/'>Вернуться в приложение</a>
					</Button>
				</aside>

				<main className='min-h-0 overflow-hidden rounded-[28px] border border-border/70 bg-background/95 shadow-[0_24px_80px_rgba(15,23,42,0.12)]'>
					<ProgramEditPage />
				</main>
			</div>
		</div>
	)
}
