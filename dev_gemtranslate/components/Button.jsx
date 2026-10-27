import clsx from 'clsx';

const VARIANTS = {
	primary: 'gtrans-bg-gtrans-primary gtrans-text-white hover:gtrans-bg-gtrans-primary-hover',
	secondary: 'gtrans-bg-white gtrans-text-gray-800 gtrans-border gtrans-border-gtrans-border hover:gtrans-bg-gray-50',
	ghost: 'gtrans-bg-transparent gtrans-text-gray-700 hover:gtrans-bg-gray-100',
	danger: 'gtrans-bg-gtrans-danger gtrans-text-white hover:gtrans-bg-red-700',
};

export default function Button({ variant = 'primary', size = 'md', className, children, loading, ...props }) {
	const sizeCls =
		size === 'sm'
			? 'gtrans-px-2.5 gtrans-py-1 gtrans-text-xs'
			: size === 'lg'
				? 'gtrans-px-5 gtrans-py-2.5 gtrans-text-sm'
				: 'gtrans-px-4 gtrans-py-2 gtrans-text-sm';

	return (
		<button
			type="button"
			disabled={loading || props.disabled}
			className={clsx(
				'gtrans-inline-flex gtrans-items-center gtrans-justify-center gtrans-gap-2 gtrans-rounded-md gtrans-font-medium gtrans-transition disabled:gtrans-opacity-60 disabled:gtrans-cursor-not-allowed',
				VARIANTS[variant] || VARIANTS.primary,
				sizeCls,
				className
			)}
			{...props}
		>
			{loading && (
				<span className="gtrans-inline-block gtrans-h-3 gtrans-w-3 gtrans-animate-spin gtrans-rounded-full gtrans-border-2 gtrans-border-current gtrans-border-t-transparent" />
			)}
			{children}
		</button>
	);
}
