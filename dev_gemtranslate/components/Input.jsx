import clsx from 'clsx';

export function Field({ label, hint, error, children }) {
	return (
		<label className="gtrans-block">
			{label && <span className="gtrans-mb-1 gtrans-block gtrans-text-xs gtrans-font-medium gtrans-text-label">{label}</span>}
			{children}
			{hint && !error && <span className="gtrans-mt-1 gtrans-block gtrans-text-xs gtrans-text-muted">{hint}</span>}
			{error && <span className="gtrans-mt-1 gtrans-block gtrans-text-xs gtrans-text-danger">{error}</span>}
		</label>
	);
}

export function TextInput({ className, ...props }) {
	return <input type="text" className={clsx('gtrans-w-full', className)} {...props} />;
}

export function TextArea({ className, rows = 4, ...props }) {
	return <textarea rows={rows} className={clsx('gtrans-w-full gtrans-font-mono gtrans-text-sm', className)} {...props} />;
}

// One select everywhere: the react-select wrapper (native <select> can't be themed).
export { Select } from './ui/Select';

export function Checkbox({ label, ...props }) {
	return (
		<label className="gtrans-inline-flex gtrans-items-center gtrans-gap-2 gtrans-text-sm gtrans-text-ink">
			<input type="checkbox" {...props} />
			{label}
		</label>
	);
}
