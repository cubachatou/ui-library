/**
 * select.js — Select widget module.
 *
 * Implements a custom listbox dropdown following the ARIA combobox pattern
 * (role="combobox" on the trigger, role="listbox" on the popup, role="option"
 * on each item). Keyboard navigation follows APG 1.2 §3.8 "Combobox".
 *
 * Queries elements via data-* attributes only — never CSS class names.
 * Strategy hooks (onSelect) allow callers to inject custom behaviour without
 * modifying this file.
 *
 * Required HTML attributes:
 *   data-kui-select           — root element
 *   data-kui-select-trigger   — <button role="combobox"> that opens the popup
 *   data-kui-select-value     — <span> inside trigger displaying current value
 *   data-kui-select-content   — listbox popup (role="listbox")
 *   data-kui-select-item      — each option (role="option")
 *
 * Optional HTML attributes:
 *   data-kui-select-group     — group wrapper (role="group")
 *   data-kui-select-label     — visual group heading
 *   data-kui-select-separator — visual separator between groups
 */

/**
 * @typedef {Object} SelectConfig
 * @property {string}   [triggerSelector='[data-kui-select-trigger]']
 * @property {string}   [contentSelector='[data-kui-select-content]']
 * @property {string}   [itemSelector='[data-kui-select-item]']
 * @property {string}   [valueSelector='[data-kui-select-value]']
 * @property {Function} [onSelect]  Called after an item is selected.
 *                                  Signature: (value: string, label: string, item: HTMLElement) => void
 */

export class Select {
	/**
	 * @param {HTMLElement} root
	 * @param {SelectConfig} [config]
	 */
	constructor(root, config = {}) {
		this.root = root;

		/** @type {Required<SelectConfig>} */
		this.config = {
			triggerSelector: "[data-kui-select-trigger]",
			contentSelector: "[data-kui-select-content]",
			itemSelector: "[data-kui-select-item]",
			valueSelector: "[data-kui-select-value]",
			onSelect: null,
			...config,
		};

		this._trigger = root.querySelector(this.config.triggerSelector);
		this._content = root.querySelector(this.config.contentSelector);
		this._valueEl = root.querySelector(this.config.valueSelector);

		// Bind handlers once so they can be removed on destroy().
		this._boundHandleTriggerClick = this._handleTriggerClick.bind(this);
		this._boundHandleTriggerKeydown = this._handleTriggerKeydown.bind(this);
		this._boundHandleItemClick = this._handleItemClick.bind(this);
		this._boundHandleItemKeydown = this._handleItemKeydown.bind(this);
		this._boundHandleOutsideClick = this._handleOutsideClick.bind(this);

		// Tracks the pending animationend listener set during _close(), so it can
		// be cancelled if _open() is called before the exit animation finishes.
		this._closeAnimEndHandler = null;
	}

	/**
	 * Attach event listeners. Returns `this` for chaining.
	 * @returns {Select}
	 */
	init() {
		if (!this._trigger || !this._content) return this;

		this._trigger.addEventListener("click", this._boundHandleTriggerClick);
		this._trigger.addEventListener("keydown", this._boundHandleTriggerKeydown);

		this._getItems().forEach((item) => {
			item.addEventListener("click", this._boundHandleItemClick);
			item.addEventListener("keydown", this._boundHandleItemKeydown);
		});

		return this;
	}

	/**
	 * Remove all listeners added by init(). Safe to call multiple times.
	 */
	destroy() {
		if (!this._trigger || !this._content) return;

		this._trigger.removeEventListener("click", this._boundHandleTriggerClick);
		this._trigger.removeEventListener("keydown", this._boundHandleTriggerKeydown);

		this._getItems().forEach((item) => {
			item.removeEventListener("click", this._boundHandleItemClick);
			item.removeEventListener("keydown", this._boundHandleItemKeydown);
		});

		this._removeOutsideClickListener();
		this._cancelCloseAnimation();
	}

	// ── Public API ─────────────────────────────────────────────────────────────

	/** @returns {boolean} */
	get isOpen() {
		return this.root.dataset.state === "open";
	}

	// ── Private ────────────────────────────────────────────────────────────────

	/** @returns {HTMLElement[]} Enabled (non-disabled) option items. */
	_getItems() {
		return Array.from(this.root.querySelectorAll(this.config.itemSelector)).filter((item) => item.getAttribute("aria-disabled") !== "true");
	}

	/** @returns {HTMLElement[]} ALL option items, including disabled ones. */
	_getAllItems() {
		return Array.from(this.root.querySelectorAll(this.config.itemSelector));
	}

	_open() {
		// If a close animation is still in progress, cancel it so the content
		// element stays visible and the hidden attribute is never applied.
		this._cancelCloseAnimation();

		this._trigger.setAttribute("aria-expanded", "true");
		this.root.dataset.state = "open";
		this._content.dataset.state = "open";
		this._content.removeAttribute("hidden");

		// Focus the selected item (or the first enabled item) after opening.
		const selected = this._getAllItems().find((i) => i.getAttribute("aria-selected") === "true");
		const toFocus = selected || this._getItems()[0];
		if (toFocus) this._focusItem(toFocus);

		document.addEventListener("pointerdown", this._boundHandleOutsideClick);
	}

	_close() {
		this._trigger.setAttribute("aria-expanded", "false");
		// Flip root state immediately (chevron rotates back, isOpen becomes false).
		this.root.dataset.state = "closed";
		this._clearFocusedItem();
		this._trigger.removeAttribute("aria-activedescendant");
		this._removeOutsideClickListener();

		// Cancel any previous close listener before starting a new one.
		this._cancelCloseAnimation();

		// Trigger the exit animation; apply `hidden` only after it finishes so
		// the content element stays in the render tree during the transition.
		this._content.dataset.state = "closing";
		this._closeAnimEndHandler = () => {
			this._content.removeEventListener("animationend", this._closeAnimEndHandler);
			this._content.dataset.state = "closed";
			this._content.setAttribute("hidden", "");
			this._closeAnimEndHandler = null;
		};
		this._content.addEventListener("animationend", this._closeAnimEndHandler);
	}

	/** Cancel a pending close animation and its deferred hidden-attribute setter. */
	_cancelCloseAnimation() {
		if (this._closeAnimEndHandler) {
			this._content.removeEventListener("animationend", this._closeAnimEndHandler);
			this._closeAnimEndHandler = null;
		}
	}

	_removeOutsideClickListener() {
		document.removeEventListener("pointerdown", this._boundHandleOutsideClick);
	}

	/**
	 * Mark an item as the keyboard-focus target.
	 * Sets aria-activedescendant on the trigger so screen readers announce the
	 * item without moving DOM focus out of the trigger.
	 * @param {HTMLElement} item
	 */
	_focusItem(item) {
		this._clearFocusedItem();
		item.dataset.focused = "";
		if (item.id) {
			this._trigger.setAttribute("aria-activedescendant", item.id);
		}
		// Scroll into view without disrupting page scroll.
		item.scrollIntoView({ block: "nearest" });
	}

	_clearFocusedItem() {
		this._getAllItems().forEach((item) => delete item.dataset.focused);
	}

	/** @returns {HTMLElement | null} The item currently marked as focused. */
	_getFocusedItem() {
		return this.root.querySelector(`${this.config.itemSelector}[data-focused]`) || null;
	}

	/**
	 * Select an item — update display value, aria state, fire callback, close.
	 * @param {HTMLElement} item
	 */
	_selectItem(item) {
		const value = item.dataset.value ?? "";
		const label = item.textContent.trim();

		// Update aria-selected on all items.
		this._getAllItems().forEach((i) => i.setAttribute("aria-selected", "false"));
		item.setAttribute("aria-selected", "true");

		// Update the trigger display value.
		if (this._valueEl) {
			this._valueEl.textContent = label;
		}

		// Signal that a real value has been chosen (changes placeholder colour).
		this.root.dataset.hasValue = "";

		// Store the current value on the root for external reading.
		this.root.dataset.value = value;

		if (typeof this.config.onSelect === "function") {
			this.config.onSelect(value, label, item);
		}

		this._close();
		this._trigger.focus();
	}

	// ── Event handlers ─────────────────────────────────────────────────────────

	/** @param {MouseEvent} event */
	_handleTriggerClick(event) {
		if (this._trigger.disabled) return;
		this.isOpen ? this._close() : this._open();
	}

	/** @param {KeyboardEvent} event */
	_handleTriggerKeydown(event) {
		const items = this._getItems();
		if (!items.length) return;

		switch (event.key) {
			case "ArrowDown":
			case "ArrowUp": {
				event.preventDefault();
				if (!this.isOpen) {
					this._open();
					return;
				}
				const focused = this._getFocusedItem();
				const current = focused ? items.indexOf(focused) : -1;
				const next = event.key === "ArrowDown" ? Math.min(current + 1, items.length - 1) : Math.max(current - 1, 0);
				this._focusItem(items[next]);
				break;
			}
			case "Home":
				event.preventDefault();
				if (this.isOpen) this._focusItem(items[0]);
				break;
			case "End":
				event.preventDefault();
				if (this.isOpen) this._focusItem(items[items.length - 1]);
				break;
			case "Enter":
			case " ": {
				event.preventDefault();
				if (!this.isOpen) {
					this._open();
					return;
				}
				const focused = this._getFocusedItem();
				if (focused) this._selectItem(focused);
				break;
			}
			case "Escape":
				if (this.isOpen) {
					event.preventDefault();
					this._close();
					this._trigger.focus();
				}
				break;
			case "Tab":
				if (this.isOpen) this._close();
				break;
		}
	}

	/** @param {MouseEvent} event */
	_handleItemClick(event) {
		const item = /** @type {HTMLElement} */ (event.currentTarget);
		if (item.getAttribute("aria-disabled") === "true") return;
		this._selectItem(item);
	}

	/** @param {KeyboardEvent} event */
	_handleItemKeydown(event) {
		// Items are not in the tab order; all keyboard handling is on the trigger.
		// This handler exists as a safety net for assistive technology that may
		// move focus directly onto an option element.
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			const item = /** @type {HTMLElement} */ (event.currentTarget);
			if (item.getAttribute("aria-disabled") !== "true") {
				this._selectItem(item);
			}
		} else if (event.key === "Escape") {
			event.preventDefault();
			this._close();
			this._trigger.focus();
		}
	}

	/** @param {PointerEvent} event */
	_handleOutsideClick(event) {
		if (!this.root.contains(/** @type {Node} */ (event.target))) {
			this._close();
		}
	}
}

/**
 * Initialize all [data-kui-select] roots on the page.
 * @param {SelectConfig} [config]  Shared config forwarded to every instance.
 * @returns {Select[]}             Array of initialized Select instances.
 */
export function initSelects(config = {}) {
	return Array.from(document.querySelectorAll("[data-kui-select]")).map((root) => new Select(root, config).init());
}
