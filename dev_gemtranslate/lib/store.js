import { configureStore, createSlice } from '@reduxjs/toolkit';
import { gtransApi } from './gtransApi';

// UI state for the Strings > plugins & themes list (page, search, type tab).
const packagesList = createSlice({
	name: 'packagesList',
	initialState: { page: 1, perPage: 20, search: '', type: 'all' },
	reducers: {
		setPage: (state, { payload }) => {
			state.page = payload;
		},
		setPerPage: (state, { payload }) => {
			state.perPage = payload;
			state.page = 1;
		},
		setSearch: (state, { payload }) => {
			state.search = payload;
			state.page = 1;
		},
		setType: (state, { payload }) => {
			state.type = payload;
			state.page = 1;
		},
	},
});

export const { setPage, setPerPage, setSearch, setType } = packagesList.actions;

// UI state for the Menus items table.
const menuItemsList = createSlice({
	name: 'menuItemsList',
	initialState: { page: 1, perPage: 50 },
	reducers: {
		setMenuPage: (state, { payload }) => {
			state.page = payload;
		},
		setMenuPerPage: (state, { payload }) => {
			state.perPage = payload;
			state.page = 1;
		},
	},
});

export const { setMenuPage, setMenuPerPage } = menuItemsList.actions;

export const store = configureStore({
	reducer: {
		[gtransApi.reducerPath]: gtransApi.reducer,
		packagesList: packagesList.reducer,
		menuItemsList: menuItemsList.reducer,
	},
	middleware: (getDefault) => getDefault().concat(gtransApi.middleware),
});
