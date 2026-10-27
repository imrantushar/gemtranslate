import clsx from 'clsx';

export function Field({ label, hint, error, children }) {
	return (
		<label className="gtrans-block">
			{label && <span className="gtrans-mb-1 gtrans-block gtrans-text-xs gtrans-font-medium gtrans-text-gray-700">{label}</span>}
			{children}
			{hint && !error && <span className="gtrans-mt-1 gtrans-block gtrans-text-xs gtrans-text-gtrans-muted">{hint}</span>}
			{error && <span className="gtrans-mt-1 gtrans-block gtrans-text-xs gtrans-text-gtrans-danger">{error}</span>}
		</label>
	);
}

export function TextInput({ className, ...props }) {
	return <input type="text" className={clsx('gtrans-w-full', className)} {...props} />;
}

export function TextArea({ className, rows = 4, ...props }) {
	return <textarea rows={rows} className={clsx('gtrans-w-full gtrans-font-mono gtrans-text-sm', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
	return (
		<select className={clsx('gtrans-w-full', className)} {...props}>
			{children}
		</select>
	);
}

export function Checkbox({ label, ...props }) {
	return (
		<label className="gtrans-inline-flex gtrans-items-center gtrans-gap-2 gtrans-text-sm gtrans-text-gray-800">
			<input type="checkbox" {...props} />
			{label}
		</label>
	);
}
