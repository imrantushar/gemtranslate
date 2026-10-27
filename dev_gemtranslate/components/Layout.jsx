import Sidebar from './Sidebar';

export default function Layout({ children }) {
	return (
		<div className="gtrans-app">
			<Sidebar />
			<main className="gtrans-flex-1 gtrans-overflow-x-auto gtrans-bg-gtrans-bg gtrans-p-8">
				{children}
			</main>
		</div>
	);
}
