/**
 * tabs.js — Tabs widget module.
 *
 * Bound exclusively to data-* attributes — never to CSS class names.
 * Any visual variant (default, line, vertical) works without JS changes
 * as long as the base template keeps:
 *   data-kui-tabs          on the root element
 *   data-kui-tabs-list     on the tablist container
 *   data-kui-tabs-trigger  on each <button role="tab">
 *   data-kui-tabs-panel    on each <div role="tabpanel">
 *   aria-controls / aria-selected / tabindex wired correctly
 *
 * Implements the ARIA Tabs pattern with roving tabindex and automatic
 * activation: arrow keys both move focus AND activate the tab.
 *
 * Per-instance configuration is read from a JSON attribute on the root:
 *   data-kui-tabs-options='{"orientation":"vertical"}'
 */

/**
 * @typedef {Object} TabsConfig
 * @property {string}   [triggerSelector='[data-kui-tabs-trigger]']
 * @property {string}   [panelSelector='[data-kui-tabs-panel]']
 * @property {string}   [orientation='horizontal']  'horizontal' or 'vertical'.
 * @property {Function} [onActivate]  Called after a tab activates.
 *                                    Signature: (trigger: HTMLElement, panel: HTMLElement) => void
 */

export class Tabs {
	/**
	 * @param {HTMLElement} root    The [data-kui-tabs] root element.
	 * @param {TabsConfig}  [config]
	 */
	constructor(root, config = {}) {
		this.root = root;

		/** @type {Required<TabsConfig>} */
		this.config = {
			triggerSelector: "[data-kui-tabs-trigger]",
			panelSelector: "[data-kui-tabs-panel]",
			orientation: "horizontal",
			onActivate: null,
			...config,
		};

		// Bind once so the same reference can remove the listener.
		this._boundHandleKeydown = this._handleKeydown.bind(this);
		this._boundHandleClick = this._handleClick.bind(this);
	}

	/**
	 * Attach event listeners and convert server-rendered state to data-state
	 * so CSS animation can take over visibility control.
	 * Returns `this` for chaining.
	 * @returns {Tabs}
	 */
	init() {
		// Convert hidden / visible panels to data-state.
		// The `hidden` attribute is removed so `data-state` owns visibility.
		this._getPanels().forEach((panel) => {
			if (panel.hasAttribute("hidden")) {
				panel.removeAttribute("hidden");
				panel.dataset.state = "inactive";
			} else {
				panel.dataset.state = "active";
			}
		});

		const list = this._getList();
		if (list) {
			list.addEventListener("keydown", this._boundHandleKeydown);
		}

		this._getTriggers().forEach((trigger) => {
			trigger.addEventListener("click", this._boundHandleClick);
		});

		return this;
	}

	/**
	 * Remove all event listeners added by init(). Safe to call multiple times.
	 */
	destroy() {
		const list = this._getList();
		if (list) {
			list.removeEventListener("keydown", this._boundHandleKeydown);
		}
		this._getTriggers().forEach((trigger) => {
			trigger.removeEventListener("click", this._boundHandleClick);
		});
	}

	// ── Private ────────────────────────────────────────────────────────────────

	/** @returns {HTMLElement|null} */
	_getList() {
		return this.root.querySelector("[data-kui-tabs-list]");
	}

	/** @returns {HTMLElement[]} All triggers (including disabled). */
	_getTriggers() {
		return Array.from(this.root.querySelectorAll(this.config.triggerSelector));
	}

	/** @returns {HTMLElement[]} Enabled (non-disabled) triggers only. */
	_getEnabledTriggers() {
		return this._getTriggers().filter((t) => t.getAttribute("aria-disabled") !== "true");
	}

	/** @returns {HTMLElement[]} All panels. */
	_getPanels() {
		return Array.from(this.root.querySelectorAll(this.config.panelSelector));
	}

	/**
	 * Activate a trigger and show its corresponding panel.
	 * Deactivates all other triggers and panels.
	 * @param {HTMLElement} trigger
	 */
	_activate(trigger) {
		if (trigger.getAttribute("aria-disabled") === "true") return;

		const panelId = trigger.getAttribute("aria-controls");
		if (!panelId) return;

		const panel = this.root.querySelector(`#${CSS.escape(panelId)}`);
		if (!panel) return;

		// Deactivate all triggers and panels.
		this._getTriggers().forEach((t) => {
			t.setAttribute("aria-selected", "false");
			t.setAttribute("tabindex", "-1");
		});
		this._getPanels().forEach((p) => {
			p.dataset.state = "inactive";
		});

		// Activate the selected trigger and its panel.
		trigger.setAttribute("aria-selected", "true");
		trigger.setAttribute("tabindex", "0");
		panel.dataset.state = "active";

		if (typeof this.config.onActivate === "function") {
			this.config.onActivate(trigger, panel);
		}
	}

	/** @param {MouseEvent} event */
	_handleClick(event) {
		const trigger = /** @type {HTMLElement} */ (event.currentTarget);
		this._activate(trigger);
		trigger.focus();
	}

	/** @param {KeyboardEvent} event */
	_handleKeydown(event) {
		const enabled = this._getEnabledTriggers();
		const current = /** @type {HTMLElement} */ (document.activeElement);
		const currentIndex = enabled.indexOf(current);

		if (currentIndex === -1) return;

		const isVertical = this.config.orientation === "vertical";
		const prevKey = isVertical ? "ArrowUp" : "ArrowLeft";
		const nextKey = isVertical ? "ArrowDown" : "ArrowRight";

		let newIndex = currentIndex;

		switch (event.key) {
			case prevKey:
				newIndex = (currentIndex - 1 + enabled.length) % enabled.length;
				break;
			case nextKey:
				newIndex = (currentIndex + 1) % enabled.length;
				break;
			case "Home":
				newIndex = 0;
				break;
			case "End":
				newIndex = enabled.length - 1;
				break;
			default:
				return; // Don't call preventDefault for unhandled keys.
		}

		event.preventDefault();
		const newTrigger = enabled[newIndex];
		this._activate(newTrigger);
		newTrigger.focus();
	}
}

/**
 * Auto-initialize all [data-kui-tabs] roots in the document.
 *
 * Per-instance options stored in `data-kui-tabs-options` (JSON) override
 * the shared `globalConfig`. This lets the Panel blueprint drive JS behaviour
 * (e.g. orientation) without any consumer JavaScript.
 *
 * @param {TabsConfig} [globalConfig]  Shared config forwarded to every instance.
 * @returns {Tabs[]}                   Array of initialized Tabs instances.
 */
export function initTabs(globalConfig = {}) {
	return Array.from(document.querySelectorAll("[data-kui-tabs]")).map((root) => {
		const instanceConfig = JSON.parse(root.dataset.kuiTabsOptions ?? "{}");
		return new Tabs(root, { ...globalConfig, ...instanceConfig }).init();
	});
}
