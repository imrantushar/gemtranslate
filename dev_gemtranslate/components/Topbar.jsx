import { useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import Icon from './Icon';
import { NAV } from './Sidebar';
import { useThemeMode } from '../lib/theme';

export default function Topbar({ collapsed, onToggle }) {
	const { pathname } = useLocation();
	const { isDark, toggle: toggleTheme } = useThemeMode();
	const themeLabel = isDark ? __('Switch to light mode', 'gemtranslate') : __('Switch to dark mode', 'gemtranslate');
	const current = NAV.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));

	return (
		<header className="gtrans-topbar gtrans-flex gtrans-h-14 gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-between gtrans-border-b gtrans-border-edge gtrans-bg-surface gtrans-px-4">
			<div className="gtrans-flex gtrans-items-center gtrans-gap-3">
				<button
					type="button"
					onClick={onToggle}
					aria-label={collapsed ? __('Expand menu', 'gemtranslate') : __('Collapse menu', 'gemtranslate')}
					aria-expanded={!collapsed}
					className="gtrans-bare gtrans-flex gtrans-h-8 gtrans-w-8 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-border-0 gtrans-bg-transparent gtrans-p-0 gtrans-text-muted hover:gtrans-bg-body hover:gtrans-text-ink"
				>
					<Icon name="panel" size={18} />
				</button>

				<span className="gtrans-flex gtrans-h-8 gtrans-w-8 gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-center gtrans-rounded-lg gtrans-bg-primary gtrans-text-white" aria-hidden="true">
					<Icon name="globe" />
				</span>
				<span className="gtrans-text-base gtrans-font-semibold gtrans-text-ink">
					gem<span className="gtrans-text-primary">Translate</span>
				</span>

				{current && (
					<span className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-muted">
						<Icon name="chevron" size={14} />
						<span className="gtrans-text-sm gtrans-font-semibold gtrans-text-label">{current.label()}</span>
					</span>
				)}
			</div>

			<div className="gtrans-flex gtrans-items-center gtrans-gap-3">
				<span className="gtrans-rounded-full gtrans-border gtrans-border-line gtrans-px-2 gtrans-py-0.5 gtrans-text-2xs gtrans-text-muted">
					v{window.gtrans?.version || '1.0.0'}
				</span>
				<button
					type="button"
					onClick={toggleTheme}
					title={themeLabel}
					aria-label={themeLabel}
					className="gtrans-bare gtrans-flex gtrans-h-9 gtrans-w-9 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-p-0 gtrans-text-description hover:gtrans-text-primary"
				>
					<Icon name={isDark ? 'sun' : 'moon'} size={18} />
				</button>
			</div>
		</header>
	);
}
