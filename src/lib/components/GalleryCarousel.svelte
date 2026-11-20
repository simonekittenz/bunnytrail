<script lang="ts">
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';

	// Behaviour for ```gallery carousel blocks (markup in markdown.ts,
	// styles in global.css). The blocks scroll on their own; this adds the
	// arrow buttons, arrow keys, click-a-neighbour-to-centre, and tells the
	// CSS which slide is centred. Everything is delegated from the document,
	// so it covers prose swapped in by client-side navigation too.

	const TRACK = '.bt-carousel__track';

	function slidesOf(track: HTMLElement): HTMLElement[] {
		return [...track.querySelectorAll<HTMLElement>(':scope > figure')];
	}

	/** Index of the slide whose centre is nearest the track's centre. */
	function activeIndex(track: HTMLElement): number {
		const middle = track.scrollLeft + track.clientWidth / 2;
		let best = 0;
		let bestDistance = Infinity;
		slidesOf(track).forEach((slide, i) => {
			const distance = Math.abs(slide.offsetLeft + slide.offsetWidth / 2 - middle);
			if (distance < bestDistance) {
				best = i;
				bestDistance = distance;
			}
		});
		return best;
	}

	function goTo(track: HTMLElement, index: number) {
		const slides = slidesOf(track);
		const slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
		if (!slide) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		track.scrollTo({
			left: slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2,
			behavior: reduce ? 'auto' : 'smooth'
		});
	}

	/** Mark the centred slide and which end (if any) the carousel is at. */
	function refresh(root: HTMLElement) {
		const track = root.querySelector<HTMLElement>(TRACK);
		if (!track) return;
		const slides = slidesOf(track);
		const active = activeIndex(track);
		slides.forEach((slide, i) => slide.toggleAttribute('data-active', i === active));
		root.dataset.pos = active === 0 ? 'start' : active === slides.length - 1 ? 'end' : 'mid';
		root.setAttribute('data-bt-carousel-ready', '');
	}

	function refreshAll() {
		for (const root of document.querySelectorAll<HTMLElement>('[data-bt-carousel]')) refresh(root);
	}

	let frame = 0;
	function scheduleRefresh(root: HTMLElement) {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => refresh(root));
	}

	onMount(() => {
		refreshAll();

		function onClick(event: MouseEvent) {
			const target = event.target as HTMLElement | null;
			if (!target?.closest) return;

			const button = target.closest<HTMLElement>(
				'[data-bt-carousel-prev], [data-bt-carousel-next]'
			);
			const root = target.closest<HTMLElement>('[data-bt-carousel]');
			const track = root?.querySelector<HTMLElement>(TRACK);
			if (!root || !track) return;

			if (button) {
				event.preventDefault();
				const step = button.hasAttribute('data-bt-carousel-next') ? 1 : -1;
				goTo(track, activeIndex(track) + step);
				return;
			}

			// A neighbouring slide is brought to the centre first; only the
			// centred one opens the lightbox. (The explicit expand button
			// always opens it.) Runs in the capture phase, ahead of the lightbox.
			if (target.closest('[data-bt-img-expand]')) return;
			const slide = target.closest<HTMLElement>(`${TRACK} > figure`);
			if (!slide) return;
			const index = slidesOf(track).indexOf(slide);
			if (index !== -1 && index !== activeIndex(track)) {
				event.preventDefault();
				event.stopPropagation();
				goTo(track, index);
			}
		}

		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
			const track = (event.target as HTMLElement | null)?.closest<HTMLElement>(TRACK);
			if (!track) return;
			event.preventDefault();
			goTo(track, activeIndex(track) + (event.key === 'ArrowRight' ? 1 : -1));
		}

		// `scroll` doesn't bubble; capture it from the document.
		function onScroll(event: Event) {
			const track = event.target as HTMLElement | null;
			if (!track?.matches?.(TRACK)) return;
			const root = track.closest<HTMLElement>('[data-bt-carousel]');
			if (root) scheduleRefresh(root);
		}

		document.addEventListener('click', onClick, true);
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('scroll', onScroll, true);
		window.addEventListener('resize', refreshAll);
		return () => {
			document.removeEventListener('click', onClick, true);
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', refreshAll);
			cancelAnimationFrame(frame);
		};
	});

	// Prose arrives with each navigation; give new carousels their state.
	afterNavigate(() => requestAnimationFrame(refreshAll));
</script>
