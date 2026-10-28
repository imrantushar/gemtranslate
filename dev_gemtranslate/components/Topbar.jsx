import { useLocation } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import Icon from './Icon';
import HeaderNav from './HeaderNav';
import { TOPBAR_ACTIONS_ID } from './TopbarActions';
import { NAV } from './nav';
import { useThemeMode } from '../lib/theme';
import { canManage } from '../lib/currentUser';

export default function Topbar() {
	const { pathname } = useLocation();
	const { isDark, toggle: toggleTheme } = useThemeMode();
	const themeLabel = isDark ? __('Switch to light mode', 'gemtranslate') : __('Switch to dark mode', 'gemtranslate');
	const current = NAV.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));

	return (
		<header className="gtrans-topbar gtrans-flex gtrans-h-[72px] gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-between gtrans-gap-4 gtrans-border-b gtrans-border-edge gtrans-bg-surface gtrans-px-5">
			<div className="gtrans-flex gtrans-flex-shrink-0 gtrans-items-center gtrans-gap-3">
				<span className="gtrans-flex gtrans-h-[34px] gtrans-w-[34px] gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-center gtrans-rounded-lg gtrans-bg-primary gtrans-text-white" aria-hidden="true">
					<span className="dashicons dashicons-translation" style={{ width: 20, height: 20, fontSize: 20 }} />
				</span>
				<span className="gtrans-text-lg gtrans-font-semibold gtrans-text-ink">
					gem<span className="gtrans-text-primary">Translate</span>
				</span>

				{current && (
					<span className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-muted">
						<Icon name="chevron" size={14} />
						<span className="gtrans-text-sm gtrans-font-semibold gtrans-text-label">{current.label()}</span>
					</span>
				)}

			</div>

			{canManage && (
				<div className="gtrans-flex gtrans-min-w-0 gtrans-flex-1 gtrans-justify-center">
					<HeaderNav />
				</div>
			)}

			<div className="gtrans-flex gtrans-flex-shrink-0 gtrans-items-center gtrans-gap-3">
				{/* Pages portal their primary actions here (see <TopbarActions>). */}
				<div id={TOPBAR_ACTIONS_ID} className="gtrans-flex gtrans-items-center gtrans-gap-2" />
				<span className="gtrans-rounded-full gtrans-border gtrans-border-line gtrans-px-2 gtrans-py-0.5 gtrans-text-xs gtrans-text-muted">
					v{window.gtrans?.version || '1.0.0'}
				</span>
				<button
					type="button"
					onClick={toggleTheme}
					title={themeLabel}
					aria-label={themeLabel}
					className="gtrans-bare gtrans-flex gtrans-h-10 gtrans-w-10 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-p-0 gtrans-text-description hover:gtrans-text-primary"
				>
					<Icon name={isDark ? 'sun' : 'moon'} size={18} />
				</button>
			</div>
		</header>
	);
}
