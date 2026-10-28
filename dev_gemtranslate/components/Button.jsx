import { Button as UIButton } from './ui';

/**
 * Thin wrapper over the shared `ui/Button` primitive — kept as the default
 * export so existing call sites (`import Button from '../../components/Button'`)
 * don't need to change. Variant/size/colors come from the design tokens in
 * tailwind.config.js, shared with GemCRM.
 *
 * Sizes follow GemCRM's page-level Button (components/Button), not the raw
 * primitive: xs = 32px / 12px text, sm and md = 40px / 14px text, lg = 48px /
 * 16px. So a `size="sm"` button is the standard 40px control.
 */
const SIZE_MAP = { xs: 'sm', sm: 'md', md: 'md', lg: 'lg' };
export default function Button({ variant = 'primary', size = 'md', className, children, loading, ...props }) {
	return (
		<UIButton variant={variant} size={SIZE_MAP[size] || 'md'} className={className} loading={loading} {...props}>
			{children}
		</UIButton>
	);
}
