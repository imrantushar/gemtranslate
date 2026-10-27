import clsx from 'clsx';

const CheckIcon = () => (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M20 6 9 17l-5-5" />
	</svg>
);

/**
 * Wizard stepper — mirrors GemCRM's Stepper (campaign form): numbered
 * circles joined by short lines; the active and completed steps are primary,
 * completed ones show a check. Only steps up to the current one are clickable.
 */
export default function Stepper({ steps, currentStepIndex, onStepClick }) {
	return (
		<ol className="gtrans-m-0 gtrans-flex gtrans-w-full gtrans-list-none gtrans-items-center gtrans-justify-center gtrans-p-0">
			{steps.map((step, index) => {
				const isActive = index === currentStepIndex;
				const isCompleted = index < currentStepIndex;
				const reachable = index <= currentStepIndex;

				return (
					<li key={step.key} className="gtrans-m-0 gtrans-flex gtrans-items-center gtrans-gap-2">
						<button
							type="button"
							disabled={!reachable}
							onClick={() => reachable && onStepClick?.(index)}
							aria-current={isActive ? 'step' : undefined}
							className={clsx(
								'gtrans-bare gtrans-flex gtrans-items-center gtrans-gap-2 gtrans-border-0 gtrans-bg-transparent gtrans-p-0 gtrans-select-none',
								reachable ? 'gtrans-cursor-pointer' : 'gtrans-cursor-default'
							)}
						>
							<span
								className={clsx(
									'gtrans-flex gtrans-h-[30px] gtrans-w-[30px] gtrans-items-center gtrans-justify-center gtrans-rounded-full gtrans-border gtrans-border-solid gtrans-text-xs gtrans-font-bold gtrans-transition-all gtrans-duration-300',
									isActive || isCompleted
										? 'gtrans-border-primary gtrans-bg-primary gtrans-text-white'
										: 'gtrans-border-line gtrans-bg-body gtrans-text-ink'
								)}
							>
								{isCompleted ? <CheckIcon /> : index + 1}
							</span>
							<span
								className={clsx(
									'gtrans-text-sm gtrans-font-medium gtrans-transition-colors gtrans-duration-300',
									isActive || isCompleted ? 'gtrans-text-primary' : 'gtrans-text-ink'
								)}
							>
								{step.label()}
							</span>
						</button>
						{index < steps.length - 1 && (
							<span
								aria-hidden="true"
								className={clsx(
									'gtrans-mx-2 gtrans-h-[3px] gtrans-w-[30px] gtrans-transition-colors gtrans-duration-300',
									isCompleted ? 'gtrans-bg-primary' : 'gtrans-bg-line'
								)}
							/>
						)}
					</li>
				);
			})}
		</ol>
	);
}
