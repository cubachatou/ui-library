/**
 * dialog.js — Modal dialog widget module.
 *
 * Bound exclusively to data-* attributes — never to CSS class names.
 * Any visual variant works without JS changes as long as the base template keeps:
 *   data-kui-dialog           on the root wrapper element
 *   data-kui-dialog-trigger   on the <button> that opens the dialog
 *   data-kui-dialog-panel     on the <dialog> element itself
 *   data-kui-dialog-close     on any element that should close the dialog
 *   data-kui-dialog-options   JSON config on the root wrapper
 *
 * The native <dialog> element provides:
 *   - showModal() for top-layer + focus trap
 *   - Escape key handling (fires a 'cancel' event before closing)
 *   - ::backdrop rendering
 *   - aria-modal semantics (implicit on modal dialogs)
 *
 * Exit animation: JS sets data-state="closed" → waits for CSS transition to
 * finish → calls panel.close(). This allows a smooth scale/fade out before
 * the element leaves the top layer.
 *
 * Per-instance configuration is read from a JSON attribute on the root element:
 *   data-kui-dialog-options='{"closeOnBackdrop":true}'
 * Values in this attribute override the globalConfig passed to initDialogs().
 */

/**
 * @typedef {Object} DialogConfig
 * @property {boolean}  [closeOnBackdrop=true]  Close when the user clicks the backdrop.
 * @property {Function} [onOpen]   Called after the dialog opens.
 *                                 Signature: (panel: HTMLDialogElement) => void
 * @property {Function} [onClose]  Called after the dialog closes.
 *                                 Signature: (panel: HTMLDialogElement) => void
 */

export class Dialog {
	/**
	 * @param {HTMLElement}  root    The [data-kui-dialog] root wrapper element.
	 * @param {DialogConfig} [config]
	 */
	constructor(root, config = {}) {
		this.root = root;

		/** @type {Required<DialogConfig>} */
		this.config = {
			closeOnBackdrop: true,
			onOpen: null,
			onClose: null,
			...config,
		};

		/** @type {HTMLDialogElement|null} */
		this.panel = root.querySelector("[data-kui-dialog-panel]");

		// Bind handlers once so the same reference can remove them.
		this._boundHandleTriggerClick = this._handleTriggerClick.bind(this);
		this._boundHandleBackdropClick = this._handleBackdropClick.bind(this);
		this._boundHandleCancel = this._handleCancel.bind(this);
	}

	/**
	 * Attach event listeners. Returns `this` for chaining.
	 * @returns {Dialog}
	 */
	init() {
		if (!this.panel) return this;

		// Trigger button(s) — there may be more than one in custom layouts.
		this.root.querySelectorAll("[data-kui-dialog-trigger]").forEach((trigger) => {
			trigger.addEventListener("click", this._boundHandleTriggerClick);
		});

		// Explicit close controls inside the dialog (× button, footer buttons, etc.)
		this.panel.querySelectorAll("[data-kui-dialog-close]").forEach((el) => {
			el.addEventListener("click", () => this._close());
		});

		// Backdrop click: the click fires on the <dialog> element itself when the
		// user clicks outside the inner content (the dialog element fills the viewport).
		if (this.config.closeOnBackdrop) {
			this.panel.addEventListener("click", this._boundHandleBackdropClick);
		}

		// Intercept the native Escape-triggered cancel so we can animate the exit.
		this.panel.addEventListener("cancel", this._boundHandleCancel);

		return this;
	}

	/**
	 * Remove all event listeners added by init(). Safe to call multiple times.
	 */
	destroy() {
		this.root.querySelectorAll("[data-kui-dialog-trigger]").forEach((trigger) => {
			trigger.removeEventListener("click", this._boundHandleTriggerClick);
		});

		if (!this.panel) return;

		this.panel.querySelectorAll("[data-kui-dialog-close]").forEach((el) => {
			el.removeEventListener("click", () => this._close());
		});

		this.panel.removeEventListener("click", this._boundHandleBackdropClick);
		this.panel.removeEventListener("cancel", this._boundHandleCancel);
	}

	// ── Public API ─────────────────────────────────────────────────────────────

	/**
	 * Open the dialog programmatically.
	 */
	open() {
		this._open();
	}

	/**
	 * Close the dialog programmatically.
	 */
	close() {
		this._close();
	}

	// ── Private ────────────────────────────────────────────────────────────────

	/** @param {MouseEvent} _event */
	_handleTriggerClick(_event) {
		this._open();
	}

	/**
	 * Detect a click on the backdrop: the event target is the <dialog> itself
	 * (not any child), because the dialog element fills the entire viewport and
	 * the inner content is a separate child element.
	 * @param {MouseEvent} event
	 */
	_handleBackdropClick(event) {
		if (event.target === this.panel) {
			this._close();
		}
	}

	/**
	 * Intercept the native 'cancel' event (triggered by Escape key).
	 * Prevent the default instant close so we can animate the exit first.
	 * @param {Event} event
	 */
	_handleCancel(event) {
		event.preventDefault();
		this._close();
	}

	_open() {
		if (!this.panel) return;

		document.body.style.overflow = "hidden";

		this.panel.dataset.state = "open";
		this.panel.showModal();

		if (typeof this.config.onOpen === "function") {
			this.config.onOpen(this.panel);
		}
	}

	_close() {
		if (!this.panel) return;
		if (this.panel.dataset.state === "closed") return;

		this.panel.dataset.state = "closed";

		const onTransitionEnd = () => {
			this.panel.removeEventListener("transitionend", onTransitionEnd);
			this.panel.close();
			document.body.style.overflow = "";

			if (typeof this.config.onClose === "function") {
				this.config.onClose(this.panel);
			}
		};

		// If transitions are disabled (prefers-reduced-motion or test env),
		// close immediately without waiting.
		const duration = parseFloat(getComputedStyle(this.panel).transitionDuration) * 1000;
		if (!duration) {
			this.panel.close();
			document.body.style.overflow = "";
			if (typeof this.config.onClose === "function") {
				this.config.onClose(this.panel);
			}
			return;
		}

		this.panel.addEventListener("transitionend", onTransitionEnd, { once: true });
	}
}

/**
 * Auto-initialize all [data-kui-dialog] roots in the document.
 *
 * Per-instance options stored in `data-kui-dialog-options` (JSON) override
 * the shared `globalConfig`. This allows Panel blueprint fields to drive JS
 * behaviour without any consumer JavaScript.
 *
 * @param {DialogConfig} [globalConfig]  Shared config forwarded to every instance.
 * @returns {Dialog[]}                   Array of initialized Dialog instances.
 */
export function initDialogs(globalConfig = {}) {
	return Array.from(document.querySelectorAll("[data-kui-dialog]")).map((root) => {
		const instanceConfig = JSON.parse(root.dataset.kuiDialogOptions ?? "{}");
		return new Dialog(root, { ...globalConfig, ...instanceConfig }).init();
	});
}
