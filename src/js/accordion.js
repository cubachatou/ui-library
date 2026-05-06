/**
 * accordion.js — Accordion widget module.
 *
 * Architecture: class-based with a Strategy pattern hook so callers can inject
 * custom open/close logic (e.g. smooth animation, analytics events) without
 * modifying this file.
 *
 * JS is bound exclusively to data-* attributes — never to CSS class names.
 * This means any visual variant (simple, rich, or future ones) works without
 * any JS changes, as long as the base template keeps:
 *   data-accordion          on the root element
 *   data-accordion-trigger  on each <button>
 *   data-accordion-panel    on each collapsible region
 *   aria-controls / aria-expanded wired up correctly
 */

/**
 * @typedef {Object} AccordionConfig
 * @property {string}   [triggerSelector='[data-accordion-trigger]']
 * @property {string}   [panelSelector='[data-accordion-panel]']
 * @property {boolean}  [allowMultipleOpen=false]  Allow several items open at once.
 * @property {Function} [onOpen]   Strategy hook — called after an item opens.
 *                                 Signature: (trigger: HTMLElement, panel: HTMLElement) => void
 * @property {Function} [onClose]  Strategy hook — called after an item closes.
 *                                 Signature: (trigger: HTMLElement, panel: HTMLElement) => void
 */

export class Accordion {
	/**
	 * @param {HTMLElement}    root    The [data-accordion] root element.
	 * @param {AccordionConfig} [config]
	 */
	constructor(root, config = {}) {
		this.root = root;

		/** @type {Required<AccordionConfig>} */
		this.config = {
			triggerSelector: "[data-accordion-trigger]",
			panelSelector: "[data-accordion-panel]",
			allowMultipleOpen: false,
			onOpen: null,
			onClose: null,
			...config,
		};

		// Bind once so the same reference can be used to remove the listener.
		this._boundHandleClick = this._handleClick.bind(this);
	}

	/**
	 * Attach event listeners. Returns `this` for chaining.
	 * @returns {Accordion}
	 */
	init() {
		this._getTriggers().forEach((trigger) => {
			trigger.addEventListener("click", this._boundHandleClick);
		});
		return this;
	}

	/**
	 * Remove all event listeners added by init(). Safe to call multiple times.
	 */
	destroy() {
		this._getTriggers().forEach((trigger) => {
			trigger.removeEventListener("click", this._boundHandleClick);
		});
	}

	// ── Private ────────────────────────────────────────────────────────────────

	/** @returns {NodeListOf<HTMLElement>} */
	_getTriggers() {
		return this.root.querySelectorAll(this.config.triggerSelector);
	}

	/** @param {MouseEvent} event */
	_handleClick(event) {
		const trigger = /** @type {HTMLElement} */ (event.currentTarget);
		const panelId = trigger.getAttribute("aria-controls");

		if (!panelId) return;

		const panel = this.root.querySelector(`#${CSS.escape(panelId)}`);

		if (!panel) return;

		const isExpanded = trigger.getAttribute("aria-expanded") === "true";

		if (isExpanded) {
			this._close(trigger, panel);
		} else {
			if (!this.config.allowMultipleOpen) {
				this._closeAll(trigger);
			}
			this._open(trigger, panel);
		}
	}

	/**
	 * Open one panel.
	 * @param {HTMLElement} trigger
	 * @param {HTMLElement} panel
	 */
	_open(trigger, panel) {
		trigger.setAttribute("aria-expanded", "true");
		panel.removeAttribute("hidden");

		if (typeof this.config.onOpen === "function") {
			this.config.onOpen(trigger, panel);
		}
	}

	/**
	 * Close one panel.
	 * @param {HTMLElement} trigger
	 * @param {HTMLElement} panel
	 */
	_close(trigger, panel) {
		trigger.setAttribute("aria-expanded", "false");
		panel.setAttribute("hidden", "");

		if (typeof this.config.onClose === "function") {
			this.config.onClose(trigger, panel);
		}
	}

	/**
	 * Close every open panel except the one belonging to `skipTrigger`.
	 * @param {HTMLElement} [skipTrigger]
	 */
	_closeAll(skipTrigger) {
		this._getTriggers().forEach((trigger) => {
			if (trigger === skipTrigger) return;

			const panelId = trigger.getAttribute("aria-controls");
			if (!panelId) return;

			const panel = this.root.querySelector(`#${CSS.escape(panelId)}`);
			if (panel) {
				this._close(trigger, panel);
			}
		});
	}
}

/**
 * Auto-initialize all [data-accordion] roots in the document.
 *
 * @param {AccordionConfig} [config]  Shared config forwarded to every instance.
 * @returns {Accordion[]}             Array of initialized Accordion instances.
 */
export function initAccordions(config = {}) {
	return Array.from(document.querySelectorAll("[data-accordion]")).map((root) => new Accordion(root, config).init());
}
