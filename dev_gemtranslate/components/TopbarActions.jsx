import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const TOPBAR_ACTIONS_ID = 'gtrans-topbar-actions';

/**
 * Renders its children into the global header, to the left of the version
 * badge — for a page's primary actions (e.g. Export / Save all) so they stay
 * in reach however far the page is scrolled.
 */
export default function TopbarActions({ children }) {
	const [slot, setSlot] = useState(null);

	useEffect(() => {
		setSlot(document.getElementById(TOPBAR_ACTIONS_ID));
	}, []);

	return slot ? createPortal(children, slot) : null;
}
