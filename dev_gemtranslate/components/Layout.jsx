import Sidebar from './Sidebar';

export default function Layout({ children }) {
	return (
		<div className="gtrans-app">
			<Sidebar />
			<main className="gtrans-flex-1 gtrans-overflow-x-auto gtrans-bg-body gtrans-p-8">
				{children}
			</main>
		</div>
	);
}
