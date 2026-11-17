import clsx from 'clsx';

/**
 * Toggle switch — GemCRM's ui/Switch look: 36×20 pill track (primary when on),
 * white thumb. A real checkbox sits underneath for keyboard/screen-reader use.
 */
export default function Switch({ checked, onChange, disabled = false, label, className }) {
	return (
		<label
			className={clsx(
				'gtrans-relative gtrans-inline-flex gtrans-flex-shrink-0 gtrans-select-none gtrans-items-center',
				disabled ? 'gtrans-cursor-not-allowed gtrans-opacity-60' : 'gtrans-cursor-pointer',
				className
			)}
		>
			<input
				type="checkbox"
				role="switch"
				className="gtrans-peer gtrans-sr-only"
				checked={!!checked}
				disabled={disabled}
				aria-label={typeof label === 'string' ? label : undefined}
				onChange={(e) => onChange?.(e.target.checked)}
			/>
			<span
				aria-hidden="true"
				className={clsx(
					'gtrans-relative gtrans-inline-flex gtrans-h-5 gtrans-w-9 gtrans-items-center gtrans-rounded-full gtrans-transition-colors peer-focus-visible:gtrans-ring-2 peer-focus-visible:gtrans-ring-primary peer-focus-visible:gtrans-ring-offset-2',
					checked ? 'gtrans-bg-primary' : 'gtrans-bg-line'
				)}
			>
				<span
					className={clsx(
						'gtrans-inline-block gtrans-h-4 gtrans-w-4 gtrans-transform gtrans-rounded-full gtrans-bg-white gtrans-shadow gtrans-transition-transform',
						checked ? 'gtrans-translate-x-[18px]' : 'gtrans-translate-x-0.5'
					)}
				/>
			</span>
		</label>
	);
}

/** Settings row: bold title + description on the left, switch on the right. */
export function SettingRow({ label, description, checked, onChange, disabled, badge }) {
	return (
		<label
			className={clsx(
				'gtrans-flex gtrans-items-start gtrans-justify-between gtrans-gap-6 gtrans-py-3',
				disabled ? 'gtrans-cursor-not-allowed gtrans-opacity-60' : 'gtrans-cursor-pointer'
			)}
		>
			<span className="gtrans-min-w-0">
				<span className="gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-text-sm gtrans-font-semibold gtrans-text-ink">
					{label}
					{badge}
				</span>
				{description && (
					<span className="gtrans-mt-1 gtrans-block gtrans-text-sm gtrans-text-description">{description}</span>
				)}
			</span>
			<Switch checked={checked} onChange={onChange} disabled={disabled} label={typeof label === 'string' ? label : undefined} />
		</label>
	);
}
