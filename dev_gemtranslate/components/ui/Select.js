import React, { useMemo } from 'react';
import ReactSelect from 'react-select';

/**
 * react-select wrapper, mirroring GemCRM's pattern (classNamePrefix +
 * global `.gtrans-select` CSS in styles/main.css, since react-select renders
 * its own class names rather than accepting Tailwind utilities directly).
 * Menus are portaled to <body> so they escape any overflow:hidden ancestor
 * (cards, modals) — same as GemCRM.
 *
 * `Select` is a drop-in for a native `<select>`: pass plain `<option>`
 * children, a scalar `value`, and an `onChange` — it adapts react-select's
 * option-object callback to the familiar `onChange(e)` / `e.target.value`
 * shape so call sites written for the native element don't need to change.
 * Use `RawSelect` directly when you already have an `options` array.
 */
export const RawSelect = React.forwardRef(({ className = '', ...rest }, ref) => (
	<ReactSelect
		ref={ref}
		className={`gtrans-select ${className}`.trim()}
		classNamePrefix="gtrans-select"
		menuPortalTarget={document.body}
		styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
		{...rest}
	/>
));
RawSelect.displayName = 'RawSelect';

function optionsFromChildren(children) {
	const out = [];
	React.Children.forEach(children, (child) => {
		if (!child || typeof child !== 'object') return;
		if (child.type === 'option') {
			out.push({ value: child.props.value, label: child.props.children });
		} else if (child.props && child.props.children) {
			out.push(...optionsFromChildren(child.props.children));
		}
	});
	return out;
}

export const Select = React.forwardRef(
	({ value, onChange, children, className = '', disabled, placeholder, ...rest }, ref) => {
		const options = useMemo(() => optionsFromChildren(children), [children]);
		const selected = options.find((o) => String(o.value) === String(value)) || null;
		return (
			<RawSelect
				ref={ref}
				className={className}
				options={options}
				value={selected}
				isDisabled={disabled}
				placeholder={placeholder}
				onChange={(opt) => onChange && onChange({ target: { value: opt ? opt.value : '' } })}
				{...rest}
			/>
		);
	},
);
Select.displayName = 'Select';
