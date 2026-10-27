export default function PageHeader({ title, description, actions }) {
	return (
		<header className="gtrans-mb-6 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3">
			<div>
				<h1 className="gtrans-m-0 gtrans-text-2xl gtrans-font-semibold gtrans-text-gray-900">{title}</h1>
				{description && (
					<p className="gtrans-mt-1 gtrans-mb-0 gtrans-max-w-2xl gtrans-text-sm gtrans-text-gtrans-muted">{description}</p>
				)}
			</div>
			{actions && <div className="gtrans-flex gtrans-gap-2">{actions}</div>}
		</header>
	);
}
