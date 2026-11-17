import clsx from 'clsx';

export default function Logo({ className, small = false }) {
	return (
		<span className={clsx('gtrans-flex gtrans-items-center gtrans-gap-2.5', className)}>
			<span
				className={clsx(
					'gtrans-flex gtrans-flex-shrink-0 gtrans-items-center gtrans-justify-center gtrans-rounded-lg gtrans-bg-primary gtrans-text-white',
					small ? 'gtrans-h-7 gtrans-w-7' : 'gtrans-h-9 gtrans-w-9'
				)}
				aria-hidden="true"
			>
				<span className="dashicons dashicons-translation" style={{ width: small ? 16 : 20, height: small ? 16 : 20, fontSize: small ? 16 : 20 }} />
			</span>
			<span className={clsx('gtrans-font-bold gtrans-tracking-tight gtrans-text-heading', small ? 'gtrans-text-lg' : 'gtrans-text-xl')}>
				GemTranslate
			</span>
		</span>
	);
}
