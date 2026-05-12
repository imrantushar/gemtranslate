import axios from 'axios';

const config = window.ztrans || {};

export const api = axios.create({
	baseURL: config.root || '',
	headers: { 'X-WP-Nonce': config.nonce || '' },
});

export function unwrap(response) {
	const payload = response?.data;
	if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
		return payload.data;
	}
	return payload;
}

export function getMeta(response) {
	return response?.data?.meta || {};
}
