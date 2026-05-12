export default function PageHeader({ title, description, actions }) {
	return (
		<header className="ztrans-mb-6 ztrans-flex ztrans-flex-wrap ztrans-items-center ztrans-justify-between ztrans-gap-3">
			<div>
				<h1 className="ztrans-m-0 ztrans-text-2xl ztrans-font-semibold ztrans-text-gray-900">{title}</h1>
				{description && (
					<p className="ztrans-mt-1 ztrans-mb-0 ztrans-max-w-2xl ztrans-text-sm ztrans-text-ztrans-muted">{description}</p>
				)}
			</div>
			{actions && <div className="ztrans-flex ztrans-gap-2">{actions}</div>}
		</header>
	);
}
