import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';

import Icon from './Icon';

const MENU_WIDTH = 200;
const GAP = 4;

/**
 * Row/action overflow menu, modelled on GemCRM's OptionMenu: a bordered icon
 * button that opens a short list of actions, each with an icon and a label.
 *
 * options: [{ label, icon, onClick, danger, disabled, hidden, hasBorder }]
 *   - `hasBorder` draws a divider after the item (e.g. before a destructive one).
 *   - Falsy entries and `hidden: true` entries are skipped, so call sites can
 *     write conditions inline: `cond && { ... }`.
 *
 * The menu is portaled into the admin root (Tailwind utilities are scoped to
 * it) and positioned from the trigger's rect, so table/card overflow can't clip
 * it. It closes on outside click, Escape, scroll and resize.
 */
export default function OptionMenu({ options = [], label, size = 'sm', align = 'right' }) {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState({ top: 0, left: 0 });
	const trigger = useRef(null);
	const menu = useRef(null);

	const items = options.filter((o) => o && !o.hidden);

	const place = useCallback(() => {
		if (!trigger.current) return;
		const r = trigger.current.getBoundingClientRect();
		const height = menu.current?.offsetHeight || 0;
		let left = align === 'left' ? r.left : r.right - MENU_WIDTH;
		left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
		let top = r.bottom + GAP;
		// Flip above the trigger when there is no room below.
		if (height && top + height > window.innerHeight - 8 && r.top - GAP - height > 8) {
			top = r.top - GAP - height;
		}
		setPos({ top, left });
	}, [align]);

	useLayoutEffect(() => {
		if (open) place();
	}, [open, place, items.length]);

	useEffect(() => {
		if (!open) return undefined;
		const onDown = (e) => {
			if (menu.current?.contains(e.target) || trigger.current?.contains(e.target)) return;
			setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === 'Escape') {
				setOpen(false);
				trigger.current?.focus();
			}
		};
		const close = () => setOpen(false);
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onKey);
		window.addEventListener('scroll', close, true);
		window.addEventListener('resize', close);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('scroll', close, true);
			window.removeEventListener('resize', close);
		};
	}, [open]);

	if (items.length === 0) return null;

	const root = document.getElementById('gemtranslate-admin-root') || document.body;
	const dim = size === 'md' ? 'gtrans-h-10 gtrans-w-10' : 'gtrans-h-8 gtrans-w-8';

	return (
		<>
			<button
				ref={trigger}
				type="button"
				aria-label={label || __('Open options', 'gemtranslate')}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((o) => !o)}
				className={clsx(
					'gtrans-bare gtrans-inline-flex gtrans-flex-shrink-0 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-transparent gtrans-p-0 gtrans-text-description hover:gtrans-border-primary hover:gtrans-text-primary',
					dim,
					open && 'gtrans-border-primary gtrans-text-primary'
				)}
			>
				<Icon name="more" size={18} />
			</button>
			{open &&
				createPortal(
					<div
						ref={menu}
						role="menu"
						style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH, zIndex: 100000 }}
						className="gtrans-rounded gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-p-1.5 gtrans-shadow-lg"
					>
						{items.map((item, i) => (
							<div key={i}>
								<button
									type="button"
									role="menuitem"
									disabled={item.disabled}
									onClick={() => {
										setOpen(false);
										item.onClick?.();
									}}
									className={clsx(
										'gtrans-bare gtrans-flex gtrans-w-full gtrans-cursor-pointer gtrans-items-center gtrans-gap-2.5 gtrans-rounded gtrans-border-0 gtrans-bg-transparent gtrans-px-3 gtrans-py-2 gtrans-text-left gtrans-text-sm gtrans-font-medium',
										item.danger
											? 'gtrans-text-danger hover:gtrans-bg-danger-light'
											: 'gtrans-text-ink hover:gtrans-bg-body',
										item.disabled && 'gtrans-cursor-not-allowed gtrans-opacity-50'
									)}
								>
									{item.icon && <Icon name={item.icon} size={16} />}
									{item.label}
								</button>
								{item.hasBorder && i < items.length - 1 && (
									<div className="gtrans-my-1.5 gtrans-h-px gtrans-bg-line" />
								)}
							</div>
						))}
					</div>,
					root
				)}
		</>
	);
}
