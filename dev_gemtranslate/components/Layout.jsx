import Sidebar from './Sidebar';

export default function Layout({ children }) {
	return (
		<div className="ztrans-app">
			<Sidebar />
			<main className="ztrans-flex-1 ztrans-overflow-x-auto ztrans-bg-ztrans-bg ztrans-p-8">
				{children}
			</main>
		</div>
	);
}
