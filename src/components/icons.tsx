export function Icon({ name, size = 20 }: { name: string; size?: number }) {
	const paths: Record<string, string> = {
		dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
		campaign: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
		chapters: 'M4 4h6a3 3 0 013 3v14a4 4 0 00-4-3H4z M13 7a3 3 0 013-3h5v14h-5a3 3 0 00-3 3',
		players: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M17 4a4 4 0 010 8',
		encounters: 'M4 3l17 17 M3 4l4-1-1 4 M20 3L3 20 M21 4l-4-1 1 4 M3 17l4 4 M17 21l4-4',
		bestiary: 'M5 3l4 3h6l4-3-1 7 3 4-4 7H7l-4-7 3-4z M8 12h1 M15 12h1 M9 17h6',
		journal: 'M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4',
		settings: 'M12 8a4 4 0 100 8 4 4 0 000-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2',
		chevron: 'M9 5l7 7-7 7',
		dice: 'M12 2l10 6v9l-10 5-10-5V8z M2 8l10 5 10-5 M12 13v9 M7 5l10 14 M17 5L7 19',
		plus: 'M12 5v14 M5 12h14',
		arrow: 'M4 12h16 M14 6l6 6-6 6',
		eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6',
		shield: 'M12 2l8 3v6c0 5-8 11-8 11S4 16 4 11V5z',
		clock: 'M12 3a9 9 0 100 18 9 9 0 000-18 M12 7v5l3 2',
		close: 'M6 6l12 12 M6 18L18 6',
		check: 'M5 12l4 4L19 6',
		search: 'M11 4a7 7 0 100 14 7 7 0 000-14 M21 21l-5-5',
	}
	return (
		<svg
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			stroke-width='1.5'
			stroke-linecap='round'
			stroke-linejoin='round'
			aria-hidden='true'
		>
			<path d={paths[name] || paths.chapters} />
		</svg>
	)
}
