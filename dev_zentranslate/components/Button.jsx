import clsx from 'clsx';

const VARIANTS = {
	primary: 'ztrans-bg-ztrans-primary ztrans-text-white hover:ztrans-bg-ztrans-primary-hover',
	secondary: 'ztrans-bg-white ztrans-text-gray-800 ztrans-border ztrans-border-ztrans-border hover:ztrans-bg-gray-50',
	ghost: 'ztrans-bg-transparent ztrans-text-gray-700 hover:ztrans-bg-gray-100',
	danger: 'ztrans-bg-ztrans-danger ztrans-text-white hover:ztrans-bg-red-700',
};

export default function Button({ variant = 'primary', size = 'md', className, children, loading, ...props }) {
	const sizeCls =
		size === 'sm'
			? 'ztrans-px-2.5 ztrans-py-1 ztrans-text-xs'
			: size === 'lg'
				? 'ztrans-px-5 ztrans-py-2.5 ztrans-text-sm'
				: 'ztrans-px-4 ztrans-py-2 ztrans-text-sm';

	return (
		<button
			type="button"
			disabled={loading || props.disabled}
			className={clsx(
				'ztrans-inline-flex ztrans-items-center ztrans-justify-center ztrans-gap-2 ztrans-rounded-md ztrans-font-medium ztrans-transition disabled:ztrans-opacity-60 disabled:ztrans-cursor-not-allowed',
				VARIANTS[variant] || VARIANTS.primary,
				sizeCls,
				className
			)}
			{...props}
		>
			{loading && (
				<span className="ztrans-inline-block ztrans-h-3 ztrans-w-3 ztrans-animate-spin ztrans-rounded-full ztrans-border-2 ztrans-border-current ztrans-border-t-transparent" />
			)}
			{children}
		</button>
	);
}
