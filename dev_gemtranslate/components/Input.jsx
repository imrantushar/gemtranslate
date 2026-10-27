import clsx from 'clsx';

export function Field({ label, hint, error, children }) {
	return (
		<label className="ztrans-block">
			{label && <span className="ztrans-mb-1 ztrans-block ztrans-text-xs ztrans-font-medium ztrans-text-gray-700">{label}</span>}
			{children}
			{hint && !error && <span className="ztrans-mt-1 ztrans-block ztrans-text-xs ztrans-text-ztrans-muted">{hint}</span>}
			{error && <span className="ztrans-mt-1 ztrans-block ztrans-text-xs ztrans-text-ztrans-danger">{error}</span>}
		</label>
	);
}

export function TextInput({ className, ...props }) {
	return <input type="text" className={clsx('ztrans-w-full', className)} {...props} />;
}

export function TextArea({ className, rows = 4, ...props }) {
	return <textarea rows={rows} className={clsx('ztrans-w-full ztrans-font-mono ztrans-text-sm', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
	return (
		<select className={clsx('ztrans-w-full', className)} {...props}>
			{children}
		</select>
	);
}

export function Checkbox({ label, ...props }) {
	return (
		<label className="ztrans-inline-flex ztrans-items-center ztrans-gap-2 ztrans-text-sm ztrans-text-gray-800">
			<input type="checkbox" {...props} />
			{label}
		</label>
	);
}
