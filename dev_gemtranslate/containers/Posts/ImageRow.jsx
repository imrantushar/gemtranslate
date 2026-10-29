import { __, sprintf } from '@wordpress/i18n';
import clsx from 'clsx';

import { pickImage } from '../../lib/media';

/** True when a tokenised source has real text, not just `{N}` markup tokens. */
export const hasText = (source) => String(source || '').replace(/\{\d+\}/g, '').trim() !== '';

/**
 * One image on the page. The source image is shown for reference; the
 * translation is a replacement image for this language, picked from the media
 * library. An empty choice means the page keeps showing the source image.
 *
 * Shared by the Blocks, Simple and Advanced editors.
 */
export default function ImageRow({ label, type, source, count = 1, draft, onChange, onNotify }) {
	const filled = draft.trim() !== '';

	const choose = async () => {
		const url = await pickImage();
		if (url) onChange(url);
		else if (!window.wp?.media) {
			onNotify?.({ tone: 'error', message: __('The media library is not available on this screen.', 'gemtranslate') });
		}
	};

	const secondary =
		'gtrans-bare gtrans-cursor-pointer gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-px-3 gtrans-py-1.5 gtrans-text-xs gtrans-text-label hover:gtrans-bg-body';

	return (
		<div className="gtrans-rounded-md gtrans-border gtrans-border-line gtrans-bg-surface gtrans-p-3">
			<div className="gtrans-mb-2 gtrans-flex gtrans-flex-wrap gtrans-items-center gtrans-gap-2 gtrans-text-xs">
				<code title={type}>{label}</code>
				{count > 1 && (
					<span className="gtrans-text-muted">
						{sprintf(
							/* translators: %d: number of places the same image is used. */
							__('used %d×', 'gemtranslate'),
							count
						)}
					</span>
				)}
				<span
					className={clsx(
						'gtrans-ml-auto gtrans-rounded gtrans-px-2 gtrans-py-0.5',
						filled ? 'gtrans-bg-emerald-100 gtrans-text-emerald-800' : 'gtrans-bg-body gtrans-text-muted'
					)}
				>
					{filled ? __('Custom image', 'gemtranslate') : __('Same as source', 'gemtranslate')}
				</span>
			</div>
			<div className="gtrans-grid gtrans-grid-cols-1 lg:gtrans-grid-cols-2 gtrans-gap-3">
				<ImageBox url={source} label={__('Source image', 'gemtranslate')} />
				<div className="gtrans-flex gtrans-flex-col gtrans-gap-2">
					<ImageBox
						url={draft}
						label={__('Image for this language', 'gemtranslate')}
						empty={__('No replacement. The source image is shown.', 'gemtranslate')}
					/>
					<div className="gtrans-flex gtrans-flex-wrap gtrans-gap-2">
						<button type="button" onClick={choose} className={secondary}>
							{filled ? __('Change image', 'gemtranslate') : __('Choose image', 'gemtranslate')}
						</button>
						{filled && (
							<button type="button" onClick={() => onChange('')} className={secondary}>
								{__('Use source image', 'gemtranslate')}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function ImageBox({ url, label, empty }) {
	return (
		<div>
			<div className="gtrans-mb-1 gtrans-text-xs gtrans-text-muted">{label}</div>
			<div className="gtrans-flex gtrans-min-h-[120px] gtrans-items-center gtrans-justify-center gtrans-rounded-md gtrans-border gtrans-border-dashed gtrans-border-line gtrans-bg-body gtrans-p-2">
				{url ? (
					<img src={url} alt="" className="gtrans-max-h-48 gtrans-max-w-full gtrans-rounded gtrans-object-contain" />
				) : (
					<span className="gtrans-px-2 gtrans-text-center gtrans-text-xs gtrans-text-muted">{empty}</span>
				)}
			</div>
		</div>
	);
}
