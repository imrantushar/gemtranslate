import { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';

import Icon from './Icon';

/**
 * Debounced search field with a leading icon and a clear button — the
 * GemCRM `Search` component. `onSearch(keyword)` fires after the user stops
 * typing (or immediately on Enter / clear).
 */
export default function SearchBox({ value = '', onSearch, placeholder, delay = 500, className = '' }) {
	const [text, setText] = useState(value);
	const timer = useRef(null);
	const last = useRef(value);

	// Follow external resets (e.g. switching post type clears the keyword).
	useEffect(() => {
		setText(value);
		last.current = value;
	}, [value]);

	useEffect(() => () => clearTimeout(timer.current), []);

	const fire = (keyword) => {
		clearTimeout(timer.current);
		if (keyword === last.current) return;
		last.current = keyword;
		onSearch(keyword);
	};

	const change = (e) => {
		const next = e.target.value;
		setText(next);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => fire(next), delay);
	};

	return (
		<div className={`gtrans-relative gtrans-inline-block gtrans-w-full gtrans-max-w-[300px] ${className}`}>
			<span className="gtrans-pointer-events-none gtrans-absolute gtrans-left-3 gtrans-top-1/2 gtrans--translate-y-1/2 gtrans-flex gtrans-text-placeholder">
				<Icon name="search" size={16} />
			</span>
			<input
				type="search"
				value={text}
				onChange={change}
				onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), fire(text))}
				placeholder={placeholder || __('Search…', 'gemtranslate')}
				aria-label={placeholder || __('Search', 'gemtranslate')}
				className="gtrans-h-[38px] gtrans-w-full gtrans-pl-10 gtrans-pr-9"
			/>
			{text && (
				<button
					type="button"
					onClick={() => {
						setText('');
						fire('');
					}}
					aria-label={__('Clear search', 'gemtranslate')}
					className="gtrans-bare gtrans-absolute gtrans-right-1 gtrans-top-1/2 gtrans--translate-y-1/2 gtrans-flex gtrans-h-7 gtrans-w-7 gtrans-cursor-pointer gtrans-items-center gtrans-justify-center gtrans-border-0 gtrans-bg-transparent gtrans-p-0 gtrans-text-placeholder hover:gtrans-text-danger"
				>
					<span aria-hidden="true">✕</span>
				</button>
			)}
		</div>
	);
}
