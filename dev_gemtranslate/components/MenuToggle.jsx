import { __ } from '@wordpress/i18n';

import Icon from './Icon';

export default function MenuToggle({ collapsed, onToggle, className = '' }) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={collapsed ? __('Expand menu', 'gemtranslate') : __('Collapse menu', 'gemtranslate')}
			aria-expanded={!collapsed}
			className={`gtrans-bare gtrans-flex gtrans-h-8 gtrans-w-8 gtrans-flex-shrink-0 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-rounded gtrans-border-0 gtrans-bg-transparent gtrans-p-0 gtrans-text-muted hover:gtrans-bg-body hover:gtrans-text-ink ${className}`}
		>
			<Icon name="panel" size={18} />
		</button>
	);
}
