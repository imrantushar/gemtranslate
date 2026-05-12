export default function Spinner({ size = 16 }) {
	return (
		<span
			role="status"
			aria-label="Loading"
			className="ztrans-inline-block ztrans-animate-spin ztrans-rounded-full ztrans-border-2 ztrans-border-ztrans-primary ztrans-border-t-transparent"
			style={{ width: size, height: size }}
		/>
	);
}

export function LoadingBlock({ children = 'Loading…' }) {
	return (
		<div className="ztrans-flex ztrans-items-center ztrans-justify-center ztrans-gap-2 ztrans-py-10 ztrans-text-sm ztrans-text-ztrans-muted">
			<Spinner /> {children}
		</div>
	);
}
