import { __ } from '@wordpress/i18n';

export default function Spinner({ size = 16 }) {
	return (
		<span
			role="status"
			aria-label={__('Loading', 'gemtranslate')}
			className="gtrans-inline-block gtrans-animate-spin gtrans-rounded-full gtrans-border-2 gtrans-border-primary gtrans-border-t-transparent"
			style={{ width: size, height: size }}
		/>
	);
}

export function LoadingBlock({ children }) {
	return (
		<div className="gtrans-flex gtrans-items-center gtrans-justify-center gtrans-gap-2 gtrans-py-10 gtrans-text-sm gtrans-text-muted">
			<Spinner /> {children || __('Loading…', 'gemtranslate')}
		</div>
	);
}
