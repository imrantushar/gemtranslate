export function formatErrorMessage(error) {
	if (!error) return 'Unknown error.';
	const response = error.response?.data;
	if (response) {
		if (response.message) return response.message;
		if (response.errors && response.errors[0]?.message) return response.errors[0].message;
	}
	return error.message || 'Unknown error.';
}

export function pluralize(count, singular, plural) {
	return count === 1 ? `${count} ${singular}` : `${count} ${plural || singular + 's'}`;
}

export function truncate(text, length = 80) {
	const trimmed = (text || '').toString();
	if (trimmed.length <= length) return trimmed;
	return trimmed.slice(0, length).trim() + '…';
}
