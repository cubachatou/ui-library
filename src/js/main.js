/**
 * main.js — UI library entry point.
 *
 * Imports the SCSS (Vite processes it alongside the JS bundle) and
 * auto-initializes all components found in the document.
 */

import "../scss/main.scss";
import { initAccordions } from "./accordion.js";
import { initCarousels } from "./carousel.js";
import { initDialogs } from "./dialog.js";
import { initDrawers } from "./drawer.js";
import { initSelects } from "./select.js";
import { initTabs } from "./tabs.js";

document.addEventListener("DOMContentLoaded", () => {
	initAccordions();
	initCarousels();
	initDialogs();
	initDrawers();
	initSelects();
	initTabs();
});
