export function showView(viewId: string): void {
	const views = document.querySelectorAll('main section');

	views.forEach((view) => {
		view.classList.add('hidden');
	});

	const activeView = document.getElementById(viewId);
	activeView?.classList.remove('hidden');
}