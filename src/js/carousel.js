/**
 * carousel.js — Carousel widget module, powered by Swiper.js v12.
 *
 * Queries the Swiper container via data-* attributes only — never CSS class
 * names. Strategy hooks (onInit / onDestroy) allow callers to inject custom
 * behaviour without modifying this file.
 *
 * Required HTML attributes:
 *   data-kui-carousel                — Root element; config data-attrs live here.
 *   data-kui-carousel-swiper         — The .swiper element passed to Swiper().
 *   data-kui-carousel-navigation     — "true"|"false" — enable Navigation module.
 *   data-kui-carousel-pagination     — "true"|"false" — enable Pagination module.
 *   data-kui-carousel-autoplay       — "true"|"false" — enable Autoplay module.
 *   data-kui-carousel-loop           — "true"|"false" — enable infinite loop.
 *   data-kui-carousel-prev           — Previous button element (Navigation).
 *   data-kui-carousel-next           — Next button element (Navigation).
 *   data-kui-carousel-pagination-el  — Pagination container element.
 */

import Swiper from "swiper";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

/**
 * @typedef {Object} CarouselConfig
 * @property {Function} [onInit]    Called after Swiper initialises. (swiper) => void
 * @property {Function} [onDestroy] Called before Swiper is destroyed. (swiper) => void
 */

export class Carousel {
	/**
	 * @param {HTMLElement}   root
	 * @param {CarouselConfig} [config]
	 */
	constructor(root, config = {}) {
		this.root = root;
		this.config = {
			onInit: null,
			onDestroy: null,
			...config,
		};
		this.swiper = null;
	}

	/** Initialise Swiper on this root. Returns `this` for chaining. */
	init() {
		const swiperEl = this.root.querySelector("[data-kui-carousel-swiper]");
		if (!swiperEl) return this;

		const useNavigation = this.root.dataset.kuiCarouselNavigation === "true";
		const usePagination = this.root.dataset.kuiCarouselPagination === "true";
		const useAutoplay = this.root.dataset.kuiCarouselAutoplay === "true";
		const useLoop = this.root.dataset.kuiCarouselLoop === "true";

		const modules = [];
		if (useNavigation) modules.push(Navigation);
		if (usePagination) modules.push(Pagination);
		if (useAutoplay) modules.push(Autoplay);

		/** @type {import('swiper').SwiperOptions} */
		const options = {
			modules,
			loop: useLoop,
		};

		if (useNavigation) {
			const prevEl = this.root.querySelector("[data-kui-carousel-prev]");
			const nextEl = this.root.querySelector("[data-kui-carousel-next]");
			options.navigation = { prevEl, nextEl };
		}

		if (usePagination) {
			const paginationEl = this.root.querySelector("[data-kui-carousel-pagination-el]");
			options.pagination = { el: paginationEl, clickable: true };
		}

		if (useAutoplay) {
			options.autoplay = { delay: 3000, disableOnInteraction: false };
		}

		this.swiper = new Swiper(swiperEl, options);

		if (typeof this.config.onInit === "function") {
			this.config.onInit(this.swiper);
		}

		return this;
	}

	/** Destroy the Swiper instance and release all event listeners. */
	destroy() {
		if (typeof this.config.onDestroy === "function" && this.swiper) {
			this.config.onDestroy(this.swiper);
		}
		this.swiper?.destroy(true, true);
		this.swiper = null;
	}
}

/**
 * Initialise all [data-kui-carousel] roots found in the document.
 *
 * @param {CarouselConfig} [config]
 * @returns {Carousel[]}
 */
export function initCarousels(config = {}) {
	return Array.from(document.querySelectorAll("[data-kui-carousel]")).map((root) => new Carousel(root, config).init());
}
