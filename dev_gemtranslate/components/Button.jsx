import { Button as UIButton } from './ui';

/**
 * Thin wrapper over the shared `ui/Button` primitive — kept as the default
 * export so existing call sites (`import Button from '../../components/Button'`)
 * don't need to change. Variant/size/colors come from the design tokens in
 * tailwind.config.js, shared with GemCRM.
 */
export default function Button({ variant = 'primary', size = 'md', className, children, loading, ...props }) {
	return (
		<UIButton variant={variant} size={size} className={className} loading={loading} {...props}>
			{children}
		</UIButton>
	);
}
