export default function PageHeader({ title, description, actions }) {
	return (
		<header className="gtrans-mb-6 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-justify-between gtrans-gap-3">
			<div className="gtrans-flex gtrans-flex-col gtrans-gap-1">
				<h1 className="gtrans-m-0 gtrans-text-xl gtrans-font-semibold gtrans-text-heading">{title}</h1>
				{description && (
					<p className="gtrans-m-0 gtrans-max-w-2xl gtrans-text-sm gtrans-text-description">{description}</p>
				)}
			</div>
			{actions && <div className="gtrans-flex gtrans-gap-2">{actions}</div>}
		</header>
	);
}
