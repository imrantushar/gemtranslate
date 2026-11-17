import { createApi } from '@reduxjs/toolkit/query/react';
import { api, getMeta, unwrap } from './api';

// RTK Query base query on top of the shared axios instance (keeps the nonce/root).
// Errors are flattened to a plain object so they stay serializable in the store but
// still work with formatErrorMessage().
const axiosBaseQuery = () => async ({ url, method = 'get', params, data }) => {
	try {
		const res = await api.request({ url, method, params, data });
		return { data: { rows: unwrap(res) || [], meta: getMeta(res) } };
	} catch (err) {
		return {
			error: {
				status: err.response?.status,
				message: err.message,
				response: { data: err.response?.data },
			},
		};
	}
};

export const gtransApi = createApi({
	reducerPath: 'gtransApi',
	baseQuery: axiosBaseQuery(),
	tagTypes: ['Packages', 'MenuItems'],
	endpoints: (build) => ({
		// { page, per_page, search, type, slug } -> { rows, meta: { total, total_pages, counts, languages } }
		getPackages: build.query({
			query: (params) => ({ url: 'strings/packages', params }),
			providesTags: ['Packages'],
		}),
		// { menuId, page, per_page } -> { rows, meta: { total, total_pages, default_lang } }
		getMenuItems: build.query({
			query: ({ menuId, ...params }) => ({ url: `menus/${menuId}/items`, params }),
			providesTags: ['MenuItems'],
		}),
		saveMenuItem: build.mutation({
			query: ({ itemId, lang, payload }) => ({
				url: `menus/items/${itemId}/translations/${lang}`,
				method: 'put',
				data: payload,
			}),
			invalidatesTags: ['MenuItems'],
		}),
	}),
});

export const { useGetPackagesQuery, useGetMenuItemsQuery, useSaveMenuItemMutation } = gtransApi;
