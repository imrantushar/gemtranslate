import { useNavigate } from 'react-router-dom';
import { __ } from '@wordpress/i18n';

import Button from '../../components/Button';
import Icon from '../../components/Icon';

const FEATURES = [
	{ icon: 'translation', label: () => __('Translate posts', 'gemtranslate'), note: () => __('Pages, posts & more', 'gemtranslate') },
	{ icon: 'superhero-alt', label: () => __('AI translation', 'gemtranslate'), note: () => __('Bring your own key', 'gemtranslate') },
	{ icon: 'menu', label: () => __('Menus & strings', 'gemtranslate'), note: () => __('Theme & plugin labels', 'gemtranslate') },
	{ icon: 'admin-site-alt3', label: () => __('Language switcher', 'gemtranslate'), note: () => __('Widget, menu or block', 'gemtranslate') },
];

export default function Congratulation({ languageCount }) {
	const navigate = useNavigate();

	return (
		<div className="gtrans-flex gtrans-min-h-full gtrans-items-center gtrans-justify-center gtrans-px-6 gtrans-py-16">
			<div className="gtrans-w-full gtrans-max-w-[560px] gtrans-rounded-lg gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-surface gtrans-p-8 gtrans-text-center">
				<span className="gtrans-mx-auto gtrans-mb-4 gtrans-flex gtrans-h-16 gtrans-w-16 gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-bg-success-light gtrans-text-success">
					<Icon name="check" size={30} />
				</span>

				<h2 className="gtrans-m-0 gtrans-text-[26px] gtrans-font-extrabold gtrans-tracking-tight gtrans-text-heading">
					{__('Your site is ready to go global.', 'gemtranslate')}
				</h2>
				<p className="gtrans-mb-0 gtrans-mt-2 gtrans-text-sm gtrans-text-description">
					{languageCount > 0
						? __('Your languages are set up. Pick a post to translate, or let AI do the first draft.', 'gemtranslate')
						: __('GemTranslate is set up. Add languages any time from the Languages screen.', 'gemtranslate')}
				</p>

				<div className="gtrans-mt-6 gtrans-grid gtrans-grid-cols-2 gtrans-gap-2.5 gtrans-text-left">
					{FEATURES.map((f) => (
						<div key={f.icon} className="gtrans-flex gtrans-items-start gtrans-gap-3 gtrans-rounded-md gtrans-border gtrans-border-solid gtrans-border-line gtrans-bg-body gtrans-p-3">
							<span className="gtrans-flex gtrans-h-8 gtrans-w-8 gtrans-shrink-0 gtrans-items-center gtrans-justify-center gtrans-rounded-md gtrans-bg-primary-light gtrans-text-primary">
								<span className={`dashicons dashicons-${f.icon}`} style={{ width: 16, height: 16, fontSize: 16 }} aria-hidden="true" />
							</span>
							<span>
								<span className="gtrans-block gtrans-text-[13px] gtrans-font-semibold gtrans-text-ink">{f.label()}</span>
								<span className="gtrans-block gtrans-text-[11.5px] gtrans-text-description">{f.note()}</span>
							</span>
						</div>
					))}
				</div>

				<div className="gtrans-mt-7 gtrans-flex gtrans-flex-wrap gtrans-justify-center gtrans-gap-3">
					<Button onClick={() => navigate('/posts')}>{__('Translate your first post', 'gemtranslate')}</Button>
					<Button variant="secondary" onClick={() => navigate('/dashboard')}>{__('Go to dashboard', 'gemtranslate')}</Button>
				</div>
			</div>
		</div>
	);
}
