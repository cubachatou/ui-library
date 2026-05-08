/**
 * main.js — UI library entry point.
 *
 * Imports the SCSS (Vite processes it alongside the JS bundle) and
 * auto-initializes all components found in the document.
 */

import "../scss/main.scss";
import { initAccordions } from "./accordion.js";
import { initCarousels } from "./carousel.js";
import { initSelects } from "./select.js";

document.addEventListener("DOMContentLoaded", () => {
	initAccordions();
	initCarousels();
	initSelects();
});
