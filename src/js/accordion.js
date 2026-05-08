/**
 * accordion.js — Accordion widget module.
 *
 * Bound exclusively to data-* attributes — never to CSS class names.
 * Any visual variant works without JS changes as long as the base template keeps:
 *   data-kui-accordion          on the root element
 *   data-kui-accordion-trigger  on each <button>
 *   data-kui-accordion-panel    on each collapsible region
 *   aria-controls / aria-expanded wired up correctly
 *
 * Per-instance configuration is read from a JSON attribute on the root element:
 *   data-kui-accordion-options='{"allowMultipleOpen":true}'
 * Values in this attribute override the globalConfig passed to initAccordions().
 */

/**
 * @typedef {Object} AccordionConfig
 * @property {string}   [triggerSelector='[data-kui-accordion-trigger]']
 * @property {string}   [panelSelector='[data-kui-accordion-panel]']
 * @property {boolean}  [allowMultipleOpen=false]  Allow several items open at once.
 * @property {Function} [onOpen]   Strategy hook — called after an item opens.
 *                                 Signature: (trigger: HTMLElement, panel: HTMLElement) => void
 * @property {Function} [onClose]  Strategy hook — called after an item closes.
 *                                 Signature: (trigger: HTMLElement, panel: HTMLElement) => void
 */

export class Accordion {
	/**
	 * @param {HTMLElement}    root    The [data-kui-accordion] root element.
	 * @param {AccordionConfig} [config]
	 */
	constructor(root, config = {}) {
		this.root = root;

		/** @type {Required<AccordionConfig>} */
		this.config = {
			triggerSelector: "[data-kui-accordion-trigger]",
			panelSelector: "[data-kui-accordion-panel]",
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
		// Convert server-rendered hidden/visible panels to data-state so CSS
		// can drive animation. The hidden attribute is removed here so the
		// grid-template-rows transition can take over visibility control.
		this.root.querySelectorAll(this.config.panelSelector).forEach((panel) => {
			if (panel.hasAttribute("hidden")) {
				panel.removeAttribute("hidden");
				panel.dataset.state = "closed";
			} else {
				panel.dataset.state = "open";
			}
		});

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

		// Honour aria-disabled — the trigger is focusable for AT but must not toggle.
		if (trigger.getAttribute("aria-disabled") === "true") return;

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
		panel.dataset.state = "open";
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
		panel.dataset.state = "closed";

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
 * Auto-initialize all [data-kui-accordion] roots in the document.
 *
 * Per-instance options stored in `data-kui-accordion-options` (JSON) override
 * the shared `globalConfig`. This allows Panel blueprint fields to drive JS
 * behaviour without any consumer JavaScript.
 *
 * @param {AccordionConfig} [globalConfig]  Shared config forwarded to every instance.
 * @returns {Accordion[]}                   Array of initialized Accordion instances.
 */
export function initAccordions(globalConfig = {}) {
	return Array.from(document.querySelectorAll("[data-kui-accordion]")).map((root) => {
		const instanceConfig = JSON.parse(root.dataset.kuiAccordionOptions ?? "{}");
		return new Accordion(root, { ...globalConfig, ...instanceConfig }).init();
	});
}
