/**
 * drawer.js — Bottom-sheet / side-panel drawer widget module.
 *
 * Uses the Popover API (<div popover="manual">) for top-layer placement without
 * the modal constraints of <dialog>. Bound exclusively to data-* attributes.
 *
 * JS hook attributes expected on the HTML (never rename):
 *   data-kui-drawer              Root wrapper element.
 *   data-kui-drawer-trigger      <button> that opens the drawer.
 *   data-kui-drawer-panel        The [popover] element itself.
 *   data-kui-drawer-close        Any element that closes on click.
 *   data-kui-drawer-handle       Drag handle element for swipe-to-dismiss.
 *   data-kui-drawer-options      JSON config on the root wrapper.
 *
 * Per-instance JSON config (data-kui-drawer-options):
 *   closeOnBackdrop {boolean}  Close when clicking the backdrop. Default: true.
 *   dragToDismiss   {boolean}  Enable swipe-to-dismiss gesture. Default: true.
 *
 * Drag-to-dismiss:
 *   Pointer events on the handle (and optionally the panel body) track the
 *   drag delta in the dismiss direction. The CSS custom property
 *   `--kui-drawer-drag-offset` is updated live so SCSS can translate in real
 *   time. Release at > threshold (50 px or 40% panel size) or with velocity
 *   > 0.3 px/ms triggers a close. Otherwise the panel snaps back.
 *
 * Responsive mode:
 *   When `.kui-drawer--responsive` is present, a matchMedia listener at 768 px
 *   adds/removes the `kui-drawer--is-desktop` class, which swaps the CSS
 *   positioning and disables drag-to-dismiss gestures at desktop widths.
 *
 * Exit animation (same pattern as dialog.js):
 *   JS sets data-state="closed" → transition plays → panel.close() called on
 *   transitionend.
 */

/**
 * @typedef {Object} DrawerConfig
 * @property {boolean}  [closeOnBackdrop=true]
 * @property {boolean}  [dragToDismiss=true]
 * @property {Function} [onOpen]   (panel: HTMLDialogElement) => void
 * @property {Function} [onClose]  (panel: HTMLDialogElement) => void
 */

// Breakpoint that matches the SCSS responsive modifier.
const RESPONSIVE_BREAKPOINT = "(min-width: 768px)";

// Drag threshold in px. Below this, velocity decides.
const DISMISS_THRESHOLD_PX = 50;

// Velocity threshold in px/ms.
const DISMISS_VELOCITY = 0.3;

export class Drawer {
	/**
	 * @param {HTMLElement}  root
	 * @param {DrawerConfig} [config]
	 */
	constructor(root, config = {}) {
		this.root = root;

		/** @type {Required<DrawerConfig>} */
		this.config = {
			closeOnBackdrop: true,
			dragToDismiss: true,
			onOpen: null,
			onClose: null,
			...config,
		};

		/** @type {HTMLDialogElement|null} */
		this.panel = root.querySelector("[data-kui-drawer-panel]");

		/** @type {HTMLElement|null} */
		this.handle = root.querySelector("[data-kui-drawer-handle]");

		/** @type {MediaQueryList|null} */
		this._mql = null;

		// Drag state.
		this._dragActive = false;
		this._dragStart = 0;
		this._dragTime = 0;
		this._overlay = null;

		// Bound handlers.
		this._onTriggerClick = () => this._open();
		this._onCloseClick = () => this._close();
		this._onBackdropClick = (e) => {
			if (e.target === this.panel) this._close();
		};
		this._onKeyDown = (e) => {
			if (e.key === "Escape" && this.panel?.matches(":popover-open")) this._close();
		};
		this._onPointerDown = this._handlePointerDown.bind(this);
		this._onPointerMove = this._handlePointerMove.bind(this);
		this._onPointerUp = this._handlePointerUp.bind(this);
		this._onMQL = this._handleMQL.bind(this);
	}

	/**
	 * Attach listeners. Returns `this` for chaining.
	 * @returns {Drawer}
	 */
	init() {
		if (!this.panel) return this;

		// Trigger(s).
		this.root.querySelectorAll("[data-kui-drawer-trigger]").forEach((el) => {
			el.addEventListener("click", this._onTriggerClick);
		});

		// Explicit close controls.
		this.panel.querySelectorAll("[data-kui-drawer-close]").forEach((el) => {
			el.addEventListener("click", this._onCloseClick);
		});

		// Backdrop click.
		// Handled by the overlay element created in _open().

		// Intercept Escape so we can animate the exit.
		document.addEventListener("keydown", this._onKeyDown);

		// Drag-to-dismiss.
		if (this.config.dragToDismiss && this.handle) {
			this.handle.addEventListener("pointerdown", this._onPointerDown);
		}

		// Responsive mode: watch the breakpoint.
		if (this.panel.classList.contains("kui-drawer--responsive")) {
			this._mql = window.matchMedia(RESPONSIVE_BREAKPOINT);
			this._mql.addEventListener("change", this._onMQL);
			// Apply immediately.
			this._applyResponsiveClass(this._mql.matches);
		}

		return this;
	}

	destroy() {
		this.root.querySelectorAll("[data-kui-drawer-trigger]").forEach((el) => {
			el.removeEventListener("click", this._onTriggerClick);
		});

		if (!this.panel) return;

		this.panel.querySelectorAll("[data-kui-drawer-close]").forEach((el) => {
			el.removeEventListener("click", this._onCloseClick);
		});

		document.removeEventListener("keydown", this._onKeyDown);

		this._cleanupOverlay();

		if (this.handle) {
			this.handle.removeEventListener("pointerdown", this._onPointerDown);
		}

		document.removeEventListener("pointermove", this._onPointerMove);
		document.removeEventListener("pointerup", this._onPointerUp);

		if (this._mql) {
			this._mql.removeEventListener("change", this._onMQL);
		}
	}

	// ── Public API ─────────────────────────────────────────────────────────────

	open() {
		this._open();
	}
	close() {
		this._close();
	}

	// ── Responsive ─────────────────────────────────────────────────────────────

	/** @param {boolean} isDesktop */
	_applyResponsiveClass(isDesktop) {
		this.panel.classList.toggle("kui-drawer--is-desktop", isDesktop);
	}

	/** @param {MediaQueryListEvent} e */
	_handleMQL(e) {
		this._applyResponsiveClass(e.matches);

		// If the drawer is already open during a breakpoint change, re-open
		// it so positioning semantics stay correct.
		if (this.panel.matches(":popover-open")) {
			this.panel.hidePopover();
			this.panel.showPopover();
		}
	}

	// ── Overlay ─────────────────────────────────────────────────────────────────

	/** Remove the blocking overlay and restore body scroll. */
	_cleanupOverlay() {
		this._overlay?.remove();
		this._overlay = null;
		document.body.style.overflow = "";
	}

	// ── Open / close ───────────────────────────────────────────────────────────

	_open() {
		if (!this.panel) return;

		// Inject a blocking overlay — the Popover API ::backdrop has
		// pointer-events: none by default, so page content stays interactive
		// without this DOM element. The overlay sits below the top layer
		// (where the popover lives) but above all regular page content.
		this._overlay?.remove();
		const overlay = document.createElement("div");
		overlay.setAttribute("data-kui-drawer-overlay", "");
		overlay.style.cssText = "position:fixed;inset:0;z-index:40;";
		if (this.config.closeOnBackdrop) {
			overlay.addEventListener("click", () => this._close());
		}
		document.body.appendChild(overlay);
		this._overlay = overlay;

		// Lock body scroll.
		document.body.style.overflow = "hidden";

		this.panel.dataset.state = "open";
		this.panel.showPopover();

		if (typeof this.config.onOpen === "function") {
			this.config.onOpen(this.panel);
		}
	}

	_close() {
		if (!this.panel) return;
		if (this.panel.dataset.state === "closed") return;

		this.panel.dataset.state = "closed";
		// Reset any drag offset so the close transition starts from position 0.
		this.panel.style.setProperty("--kui-drawer-drag-offset", "0px");

		const duration = parseFloat(getComputedStyle(this.panel).transitionDuration) * 1000;
		if (!duration) {
			this.panel.hidePopover();
			this._cleanupOverlay();
			typeof this.config.onClose === "function" && this.config.onClose(this.panel);
			return;
		}

		this.panel.addEventListener(
			"transitionend",
			() => {
				this.panel.hidePopover();
				this._cleanupOverlay();
				typeof this.config.onClose === "function" && this.config.onClose(this.panel);
			},
			{ once: true },
		);
	}

	// ── Drag-to-dismiss ────────────────────────────────────────────────────────

	/** @param {PointerEvent} e */
	_handlePointerDown(e) {
		// Ignore gestures on desktop responsive variant.
		if (this._mql?.matches) return;
		// Only primary pointer (left mouse / first touch).
		if (e.button !== 0 && e.pointerType !== "touch") return;

		this._dragActive = true;
		this._dragStart = this._primaryAxis(e);
		this._dragTime = e.timeStamp;
		this.handle.setPointerCapture(e.pointerId);

		document.addEventListener("pointermove", this._onPointerMove);
		document.addEventListener("pointerup", this._onPointerUp);
	}

	/** @param {PointerEvent} e */
	_handlePointerMove(e) {
		if (!this._dragActive) return;

		const delta = this._primaryAxis(e) - this._dragStart;
		// Only allow dragging in the dismiss direction.
		const clamped = this._clampDelta(delta);

		this.panel.style.setProperty("--kui-drawer-drag-offset", `${clamped}px`);
	}

	/** @param {PointerEvent} e */
	_handlePointerUp(e) {
		if (!this._dragActive) return;

		document.removeEventListener("pointermove", this._onPointerMove);
		document.removeEventListener("pointerup", this._onPointerUp);
		this._dragActive = false;

		const delta = this._clampDelta(this._primaryAxis(e) - this._dragStart);
		const elapsed = e.timeStamp - this._dragTime;
		const velocity = Math.abs(delta) / elapsed;
		const panelSize = this._panelSize();

		const shouldDismiss = Math.abs(delta) > DISMISS_THRESHOLD_PX || Math.abs(delta) > panelSize * 0.4 || velocity > DISMISS_VELOCITY;

		if (shouldDismiss) {
			this._close();
		} else {
			// Snap back.
			this.panel.style.setProperty("--kui-drawer-drag-offset", "0px");
		}
	}

	// ── Helpers ────────────────────────────────────────────────────────────────

	/**
	 * Return the axis value relevant to the current slide direction.
	 * Bottom/top drawers use Y; left/right drawers use X.
	 * @param {PointerEvent} e
	 * @returns {number}
	 */
	_primaryAxis(e) {
		const p = this.panel;
		if (p.classList.contains("kui-drawer--side-left") || p.classList.contains("kui-drawer--side-right")) {
			return e.clientX;
		}
		return e.clientY;
	}

	/**
	 * Clamp the drag delta so it only moves in the dismiss direction.
	 * @param {number} delta
	 * @returns {number}
	 */
	_clampDelta(delta) {
		const p = this.panel;
		if (p.classList.contains("kui-drawer--side-bottom") || p.classList.contains("kui-drawer--side-bottom kui-drawer--responsive")) {
			// Bottom drawer: only allow dragging down (positive delta).
			return Math.max(0, delta);
		}
		if (p.classList.contains("kui-drawer--side-top")) {
			// Top drawer: only allow dragging up (negative delta).
			return Math.min(0, delta);
		}
		if (p.classList.contains("kui-drawer--side-left")) {
			// Left drawer: only allow dragging left (negative delta).
			return Math.min(0, delta);
		}
		if (p.classList.contains("kui-drawer--side-right")) {
			// Right drawer: only allow dragging right (positive delta).
			return Math.max(0, delta);
		}
		return delta;
	}

	/**
	 * Return the relevant dimension of the panel (height or width).
	 * @returns {number}
	 */
	_panelSize() {
		const rect = this.panel.getBoundingClientRect();
		const p = this.panel;
		if (p.classList.contains("kui-drawer--side-left") || p.classList.contains("kui-drawer--side-right")) {
			return rect.width;
		}
		return rect.height;
	}
}

/**
 * Auto-initialize all [data-kui-drawer] roots in the document.
 *
 * @param {DrawerConfig} [globalConfig]
 * @returns {Drawer[]}
 */
export function initDrawers(globalConfig = {}) {
	return Array.from(document.querySelectorAll("[data-kui-drawer]")).map((root) => {
		const instanceConfig = JSON.parse(root.dataset.kuiDrawerOptions ?? "{}");
		return new Drawer(root, { ...globalConfig, ...instanceConfig }).init();
	});
}
