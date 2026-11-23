window.__ModuleLoader__.load({
	id: "dsh-loomy-connect",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		react_dom = __toESM(react_dom, 1);
		//#region src/status-paths.ts
		/** Node-free constants and types shared by the Host and browser halves. */
		/**
		* The provider id this plugin registers with the host LLM registry, and the
		* `provider` value the session projection / model-picker DOM attributes carry
		* for Loomy models. Shared so the composer pill matches against the same
		* literal the adapter registers — one source of truth on both sides.
		*/
		const LOOMY_PROVIDER = "loomy";
		/** Plugin-owned status endpoint consumed by its browser half. */
		const LOOMY_STATUS_PATH = "/plugins/dsh-loomy-connect/status";
		//#endregion
		//#region src/client/card-css.ts
		/**
		* Card chrome for the Plugin configuration contribution.
		*
		* DSH ships the official card shell (`PluginCard`) inside
		* `@deepseek-ai/dsh-client-ui-settings-plugins`, but that package exports only
		* `apply`/`inject` at runtime — the component itself is package-private. The
		* class names below are a deliberate, literal copy of that shell's CSS module
		* (`PluginCard.module.css`, MIT) so a third-party card is indistinguishable
		* from a first-party one: same 16px radius, same hairline border, same
		* hover/open background swap, same `.16s` chevron rotation.
		*
		* The owner of the stylesheet is this plugin, and its tag id is namespaced to
		* this plugin, so a DSH release that restyles the official shell cannot leave
		* this card half-styled: the two simply drift.
		*/
		/** Stable tag id; mirrors how the official bundles tag their own stylesheets. */
		const STYLE_TAG_ID$1 = "dsh-loomy-connect/LoomyCard.module.css";
		/** Prefix keeping every rule out of the official (hashed) class namespace. */
		const CSS$1 = {
			card: "dlc_card",
			cardOpen: "dlc_cardOpen",
			header: "dlc_header",
			headText: "dlc_headText",
			name: "dlc_name",
			description: "dlc_description",
			chevron: "dlc_chevron",
			chevronOpen: "dlc_chevronOpen",
			body: "dlc_body",
			section: "dlc_section",
			heading: "dlc_heading",
			row: "dlc_row",
			status: "dlc_status",
			accountRow: "dlc_accountRow",
			accountLabel: "dlc_accountLabel",
			accountSelect: "dlc_accountSelect",
			tiles: "dlc_tiles",
			total: "dlc_total",
			totalLabel: "dlc_totalLabel",
			totalValue: "dlc_totalValue",
			totalHint: "dlc_totalHint",
			tile: "dlc_tile",
			tileLabel: "dlc_tileLabel",
			tileValue: "dlc_tileValue",
			tileHint: "dlc_tileHint",
			tileHintAccent: "dlc_tileHintAccent",
			text: "dlc_text",
			hint: "dlc_hint",
			error: "dlc_error",
			list: "dlc_list",
			listItem: "dlc_listItem",
			listMain: "dlc_listMain",
			listName: "dlc_listName",
			listNote: "dlc_listNote",
			listMeta: "dlc_listMeta",
			pill: "dlc_pill",
			refreshInner: "dlc_refreshInner",
			refreshSpin: "dlc_refreshSpin",
			tabs: "dlc_tabs",
			tab: "dlc_tab",
			tabActive: "dlc_tabActive",
			ctx: "dlc_ctx",
			table: "dlc_table",
			tableHeader: "dlc_tableHeader",
			tableRow: "dlc_tableRow",
			tableCell: "dlc_tableCell",
			dash: "dlc_dash"
		};
		const STYLESHEET$1 = `
.dlc_card{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;list-style:none;transition:border-color .16s,background .16s}
.dlc_card:hover{border-color:var(--dsw-alias-label-dimmed)}
.dlc_cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.dlc_header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}
.dlc_header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.dlc_headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}
.dlc_name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}
.dlc_description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}
.dlc_chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s}
.dlc_chevronOpen{transform:rotate(180deg)}
.dlc_body{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}
.dlc_section{flex-direction:column;gap:6px;padding:12px 0;display:flex}
.dlc_section+.dlc_section{border-top:.5px solid var(--dsw-alias-border-l2)}
.dlc_heading{color:var(--dsw-alias-label-primary);margin:0;font-size:13px;font-weight:500;line-height:1.5}
.dlc_row{align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between;display:flex}
.dlc_status{align-items:center;gap:8px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:1.5;display:flex}
/* Account picker: which signed-in Loomy account chat requests run as. */
.dlc_accountRow{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.dlc_accountLabel{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;white-space:nowrap}
.dlc_accountSelect{appearance:none;font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;
  padding:5px 12px;min-width:180px;cursor:pointer;outline:none}
.dlc_accountSelect:hover{border-color:var(--dsw-alias-label-dimmed)}
.dlc_accountSelect:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dlc_tiles{flex-wrap:wrap;gap:12px;display:flex}
/* The headline figure: the same "permanent + daily" total the composer pill
   shows, so the two surfaces can never read as different numbers. The split
   tiles below remain the detail breakdown. */
.dlc_total{box-sizing:border-box;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3)}
.dlc_totalLabel{align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;display:flex}
.dlc_totalValue{margin-top:6px;color:var(--dsw-alias-label-primary);font-size:28px;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums}
.dlc_totalHint{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.dlc_tile{box-sizing:border-box;flex:1 1 180px;min-width:0;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l4);border-radius:8px;background:var(--dsw-alias-bg-layer-3)}
.dlc_tileLabel{align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;display:flex}
.dlc_tileValue{margin-top:6px;color:var(--dsw-alias-label-primary);font-size:24px;font-weight:600;line-height:1.25}
.dlc_tileHint{margin-top:2px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
.dlc_tileHintAccent{color:var(--dsw-alias-warning,#e8a33d)}
.dlc_text{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:1.5}
.dlc_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}
/* The official shell's equivalent rule names --dsw-alias-label-error, which no
   shipped theme defines (the text silently inherits). Use a token that exists. */
.dlc_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:1.5}
.dlc_list{margin:8px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.dlc_listItem{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.dlc_listMain{display:flex;align-items:baseline;gap:6px;min-width:0}
.dlc_listName{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlc_listNote{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;flex:none}
.dlc_listMeta{display:inline-flex;align-items:center;gap:6px;flex:none}
/* Rate and promotion read as the same kind of thing — what a call costs — so
   they share one chip. Tabular figures stop the digits from drifting. */
.dlc_pill{padding:1px 8px;border-radius:999px;font-size:11px;line-height:18px;white-space:nowrap;font-variant-numeric:tabular-nums;background:var(--dsw-alias-state-success-subtle,rgba(34,160,107,.12));color:var(--dsw-alias-state-success-primary,#22a06b)}
.dlc_refreshInner{display:inline-flex;align-items:center;gap:6px}
.dlc_refreshSpin{animation:dlc_spin .7s linear infinite}
@keyframes dlc_spin{to{transform:rotate(360deg)}}
/* Two-tab switch (账户 / 模型). Plain buttons styled to the shell tokens — the
   official settings shell ships no public tab primitive, and the card already
   copies the shell chrome rather than importing it, so this stays consistent. */
.dlc_tabs{display:flex;gap:4px;padding:10px 0 2px;border-top:.5px solid var(--dsw-alias-border-l2);margin-top:2px}
.dlc_tab{appearance:none;font:inherit;cursor:pointer;background:0 0;border:0;color:var(--dsw-alias-label-tertiary);font-size:13px;font-weight:500;line-height:1.5;padding:6px 12px;border-radius:8px}
.dlc_tab:hover{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary)}
.dlc_tabActive{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary)}
.dlc_ctx{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;white-space:nowrap;font-variant-numeric:tabular-nums}
/* Models tab as a grid table: name / context / billing land in their own
   columns; image generators simply sort last instead of carrying a type
   chip, so the name column keeps the full width. The table is a vertical
   stack of per-row grids — the row grids share the same three-column track,
   which is what keeps header and rows aligned. */
.dlc_table{--dlc-cols:minmax(0,1fr) 84px 96px;margin:8px 0 0;display:flex;flex-direction:column}
.dlc_tableHeader{align-items:center;display:grid;color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:500;line-height:1.5;padding:8px;text-align:left;column-gap:12px;grid-template-columns:var(--dlc-cols)}
.dlc_tableRow{align-items:center;display:grid;border-bottom:.5px solid var(--dsw-alias-border-l2);padding:5px 8px;column-gap:12px;grid-template-columns:var(--dlc-cols)}
.dlc_tableRow:last-child{border-bottom:0}
.dlc_tableCell{align-items:center;display:flex;gap:6px;min-width:0;text-align:left;justify-content:flex-start}
.dlc_tableCell>.dlc_listName{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;white-space:normal}
/* Context and billing are numbers, so their cells — and the header cells above
   them — hug the right edge. The header spans need the flex context too, or
   justify-content would have no effect on them. */
.dlc_tableHeader>span{align-items:center;display:flex;min-width:0}
.dlc_tableHeader>span+span{align-items:center;display:flex;min-width:0;justify-content:flex-end}
.dlc_tableRow>.dlc_tableCell+span,.dlc_tableRow>.dlc_tableCell+.dlc_tableCell{justify-content:flex-end}
.dlc_dash{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}
`;
		/**
		* Install the card stylesheet once per document.
		*
		* Called at module scope, so it runs while the module loader materializes this
		* bundle — the same moment the official bundles inject theirs, which is what
		* lets the loader inventory and dispose the tag with the module.
		*/
		function ensureLoomyCardStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID$1)}]`) !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-loomy-connect";
			tag.dataset.pluginCss = STYLE_TAG_ID$1;
			tag.textContent = STYLESHEET$1;
			document.head.appendChild(tag);
		}
		ensureLoomyCardStyles();
		//#endregion
		//#region src/client/format.ts
		/** Locale-aware thousands grouping: 12345 → `12,345`. */
		function formatNumber(value) {
			return new Intl.NumberFormat(void 0).format(value);
		}
		/** Localized timestamp for an epoch-milliseconds value. */
		function formatTime(ms) {
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(new Date(ms));
		}
		/**
		* The rate or promo Loomy appends to a model name — `…（x3.0）`, `…（限时免费）`.
		*
		* Mirrors the tags `catalog.ts` parses, anchored to the end so a name that
		* legitimately contains parentheses keeps them.
		*/
		const NAME_TAG = /[（(]\s*(?:x\s*[0-9]+(?:\.[0-9]+)?|[^（）()]*免费[^（）()]*)\s*[）)]\s*$/u;
		/** The model name without the rate tag, which the surfaces show in their own column. */
		function modelName(name) {
			return name.replace(NAME_TAG, "").trim();
		}
		/** Loomy's own spelling, one decimal: 3 → `x3.0`, 3.3 → `x3.3`. */
		function formatRate(rate) {
			return `x${Number.isInteger(rate) ? rate.toFixed(1) : rate}`;
		}
		/**
		* Localize the promotional label Loomy prints, falling back to its own wording
		* for anything this plugin has no translation for yet.
		*/
		function promoLabel(promo, t) {
			return /免费/u.test(promo) ? t("badgeLimitedFree") : promo;
		}
		/**
		* Derive the daily gift's expiry from the points snapshot's `updatedAt`.
		*
		* Loomy refills the 5000 daily points on each sign-in and stamps that refresh
		* into `updatedAt`; it is the closest public proxy for "when they were
		* granted". The gift is valid for three days from that instant — the user's
		* stated rule ("每天送的5000积分3日内到期"). `now` is injected so tests can
		* pin the clock; callers leave it at the wall clock.
		*/
		function dailyPointsExpiry(updatedAt, now = Date.now()) {
			if (updatedAt === void 0) return void 0;
			const grantedMs = Date.parse(updatedAt);
			if (Number.isNaN(grantedMs)) return void 0;
			const expiresAt = grantedMs + 2592e5;
			const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / 864e5));
			const dateLabel = new Intl.DateTimeFormat(void 0, {
				month: "numeric",
				day: "numeric"
			}).format(new Date(expiresAt));
			return {
				expiresAt,
				daysLeft,
				expired: now >= expiresAt,
				dateLabel
			};
		}
		/** Localize the daily-gift expiry into one short line shared by card and pill. */
		function dailyExpiryText(expiry, t) {
			if (expiry === void 0) return void 0;
			if (expiry.expired) return t("dailyExpiryExpired", { date: expiry.dateLabel });
			if (expiry.daysLeft <= 0) return t("dailyExpiryToday", { date: expiry.dateLabel });
			return t("dailyExpiry", {
				date: expiry.dateLabel,
				days: expiry.daysLeft
			});
		}
		//#endregion
		//#region src/client/LoomyPluginCard.tsx
		/**
		* Loomy account + points card contributed to Harness Plugin configuration.
		*
		* The chrome mirrors the official card shell byte for byte — see
		* `./card-css.ts` for why it is copied rather than imported — and every
		* interactive part is an official primitive: `IconChevronDownOutline14` for the
		* header chevron, `StateDot` for sign-in state, `Button` for the refresh
		* action, `Tag` for the model count. Those come from
		* `@deepseek-ai/dsh-client-ui-primitives`, which the web shell publishes in its
		* static module table, so they cost this bundle nothing.
		*/
		const POLL_INTERVAL_MS$1 = 6e4;
		/** Shortest time the refresh button stays visibly busy. */
		const MIN_BUSY_MS$1 = 600;
		/** Join the base class with its modifier, the way the official shell does. */
		function withModifier(base, modifier, on) {
			return on ? `${base} ${modifier}` : base;
		}
		/** Map our transport outcome onto the primitive's state vocabulary. */
		function dotState(status) {
			switch (status) {
				case "signed-in": return "done";
				case "error": return "error";
				default: return "idle";
			}
		}
		/** Compact token count: 262144 → `262K`, 1_048_576 → `1M`. */
		function formatContext(value) {
			if (value >= 1e6) {
				const millions = value / 1e6;
				return `${Math.round(millions * 10) / 10}M`;
			}
			if (value >= 1e3) return `${Math.round(value / 1e3)}K`;
			return String(value);
		}
		/**
		* One model-table row: name / context / billing. The type column is gone —
		* image generators simply sort to the bottom of the list, so rows stay
		* name-first and nothing squeezes the model column.
		*/
		function renderModelRow(model, t) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CSS$1.tableRow,
				role: "row",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS$1.tableCell,
						role: "gridcell",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS$1.listName,
							children: modelName(model.name)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS$1.tableCell,
						role: "gridcell",
						children: model.contextWindow === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS$1.ctx,
							children: t("modelsContextNone")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS$1.ctx,
							children: formatContext(model.contextWindow)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS$1.tableCell,
						role: "gridcell",
						children: model.rate === void 0 && model.promo === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS$1.dash,
							children: "—"
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: CSS$1.listMeta,
							children: [model.rate === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: CSS$1.pill,
								children: formatRate(model.rate)
							}), model.promo === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: CSS$1.pill,
								children: promoLabel(model.promo, t)
							})]
						})
					})
				]
			}, model.id);
		}
		/** One labelled number: the permanent or the daily-gift balance. */
		function PointsTile({ label, value, hint, accent }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CSS$1.tile,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS$1.tileLabel,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS$1.tileValue,
						children: formatNumber(value)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: accent === true ? `${CSS$1.tileHint} ${CSS$1.tileHintAccent}` : CSS$1.tileHint,
						children: hint
					})
				]
			});
		}
		/**
		* The headline balance: permanent + daily, the exact figure the composer pill
		* shows. Reporting one number in two surfaces under two rules is what made the
		* card and the pill look like they disagreed, so the card leads with the same
		* sum and keeps the split tiles underneath as its detail.
		*/
		function PointsTotal({ label, value, hint }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CSS$1.total,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS$1.totalLabel,
						children: label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS$1.totalValue,
						children: formatNumber(value)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS$1.totalHint,
						children: hint
					})
				]
			});
		}
		/** Render Loomy sign-in state and points as one expandable card. */
		function LoomyPluginCard({ t, activeAccount, setActiveAccount }) {
			if (t === void 0) throw new Error("Loomy plugin card requires its translation function");
			const [open, setOpen] = (0, react.useState)(false);
			const [status, setStatus] = (0, react.useState)({ status: "signed-out" });
			const [busy, setBusy] = (0, react.useState)(false);
			/** Which of the two tabs (积分 / 模型) is showing. */
			const [tab, setTab] = (0, react.useState)("account");
			const mounted = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const refresh = (0, react.useCallback)(async (signal, force = false) => {
				try {
					const response = await fetch(force ? `${LOOMY_STATUS_PATH}?refresh=1` : LOOMY_STATUS_PATH, {
						headers: { accept: "application/json" },
						credentials: "same-origin",
						...signal === void 0 ? {} : { signal }
					});
					const value = await response.json().catch(() => void 0);
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					if (mounted.current && signal?.aborted !== true && value !== void 0) setStatus(value);
				} catch (error) {
					if (mounted.current && signal?.aborted !== true) setStatus({
						status: "error",
						message: error instanceof Error ? error.message : t("requestFailed")
					});
				}
			}, [t]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const controller = new AbortController();
				refresh(controller.signal);
				return () => {
					controller.abort();
				};
			}, [open, refresh]);
			(0, react.useEffect)(() => {
				if (!open || status.status !== "signed-in") return;
				const controller = new AbortController();
				const timer = window.setInterval(() => {
					refresh(controller.signal);
				}, POLL_INTERVAL_MS$1);
				return () => {
					window.clearInterval(timer);
					controller.abort();
				};
			}, [
				open,
				refresh,
				status.status
			]);
			const manualRefresh = async () => {
				setBusy(true);
				const started = Date.now();
				try {
					await refresh(void 0, true);
				} finally {
					const elapsed = Date.now() - started;
					if (elapsed < MIN_BUSY_MS$1) await new Promise((resolve) => window.setTimeout(resolve, MIN_BUSY_MS$1 - elapsed));
					if (mounted.current) setBusy(false);
				}
			};
			const title = t("title");
			const label = status.status === "signed-in" ? status.account === void 0 ? t("signedIn") : t("signedInAs", { account: status.account }) : status.status === "error" ? t("requestFailed") : t("signedOut");
			const rawUpdatedAt = status.status === "signed-in" ? status.points?.updatedAt : void 0;
			const updatedMs = rawUpdatedAt === void 0 ? void 0 : Date.parse(rawUpdatedAt);
			const dailyExpiryHint = dailyExpiryText(dailyPointsExpiry(rawUpdatedAt), t);
			const models = status.status === "signed-in" ? status.models : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: withModifier(CSS$1.card, CSS$1.cardOpen, open),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: CSS$1.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${title}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: CSS$1.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS$1.name,
							children: title
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS$1.description,
							children: t("intro")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: withModifier(CSS$1.chevron, CSS$1.chevronOpen, open) })]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CSS$1.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: CSS$1.section,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CSS$1.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CSS$1.status,
									role: "status",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: dotState(status.status) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: busy,
									onClick: () => void manualRefresh(),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: CSS$1.refreshInner,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutline14, { className: busy ? CSS$1.refreshSpin : void 0 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: busy ? t("refreshing") : t("refresh") })]
									})
								})]
							})
						}),
						status.status === "signed-in" && (status.accounts?.length ?? 0) > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS$1.section,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CSS$1.accountRow,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: CSS$1.accountLabel,
									htmlFor: "dlc-active-account",
									children: t("activeAccountLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									id: "dlc-active-account",
									className: CSS$1.accountSelect,
									value: activeAccount?.() ?? status.activeUserId ?? status.accounts?.[0]?.userId ?? "",
									onChange: (event) => {
										const userId = event.target.value;
										setActiveAccount?.(userId);
										window.setTimeout(() => {
											refresh(void 0, true);
										}, 50);
									},
									children: status.accounts?.map((account) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: account.userId,
										children: account.maskedPhone ?? account.userId
									}, account.userId))
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: CSS$1.hint,
								children: t("activeAccountHint")
							})]
						}) : null,
						status.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS$1.tabs,
							role: "tablist",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								"aria-selected": tab === "account",
								className: withModifier(CSS$1.tab, CSS$1.tabActive, tab === "account"),
								onClick: () => setTab("account"),
								children: t("tabPoints")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								role: "tab",
								"aria-selected": tab === "models",
								className: withModifier(CSS$1.tab, CSS$1.tabActive, tab === "models"),
								onClick: () => setTab("models"),
								children: t("tabModels")
							})]
						}), tab === "account" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS$1.section,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: CSS$1.heading,
									children: t("pointsHeading")
								}),
								status.points === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: CSS$1.text,
									children: t("pointsUnavailable")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PointsTotal, {
										label: t("pointsTotal"),
										value: status.points.permanent + status.points.daily,
										hint: t("pointsTotalHint")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CSS$1.tiles,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PointsTile, {
											label: t("permanentPoints"),
											value: status.points.permanent,
											hint: t("permanentPointsHint")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PointsTile, {
											label: t("dailyPoints"),
											value: status.points.daily,
											hint: dailyExpiryHint ?? t("dailyPointsHint"),
											accent: dailyExpiryHint !== void 0
										})]
									}),
									updatedMs === void 0 || Number.isNaN(updatedMs) ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: CSS$1.hint,
										children: t("updatedAt", { time: formatTime(updatedMs) })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: CSS$1.hint,
										children: t("pointsSourceHint")
									})
								] }),
								status.pointsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: CSS$1.error,
									children: t("pointsError", { message: status.pointsError })
								})
							]
						}) }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: CSS$1.section,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CSS$1.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: CSS$1.heading,
									children: t("modelsHeading")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
									tone: "neutral",
									children: t("modelsTag", { count: status.modelCount })
								})]
							}), models === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: CSS$1.table,
								role: "grid",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CSS$1.tableHeader,
										role: "row",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												role: "columnheader",
												children: t("modelsColModel")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												role: "columnheader",
												children: t("modelsColContext")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												role: "columnheader",
												children: t("modelsColBill")
											})
										]
									}),
									models.filter((model) => model.image !== true).map((model) => renderModelRow(model, t)),
									models.filter((model) => model.image === true).map((model) => renderModelRow(model, t))
								]
							}) })]
						})] }) : null,
						status.status === "signed-out" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: CSS$1.text,
							children: t("signedOutHint")
						}) : null,
						status.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: CSS$1.error,
							children: status.message
						}) : null
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/composer-css.ts
		/**
		* Stylesheet for the composer status pill and its popover.
		*
		* Visual parity target is the Doubao plugin's rate control (`dbq-rate-*`):
		* same 28px pill, same fixed-position popover anchored above-right of the
		* trigger, same row/active/current-chip anatomy. Every color comes from the
		* host's `--dsw-alias-*` tokens with a literal fallback, so the surface
		* follows the active theme the same way the Doubao control does.
		*
		* The `dlc_` prefix is the plugin's existing namespace (see `card-css.ts`);
		* the dedicated tag id keeps this sheet independent of the card's, so either
		* surface can change without disturbing the other.
		*/
		/** Stable tag id; mirrors how the official bundles tag their own stylesheets. */
		const STYLE_TAG_ID = "dsh-loomy-connect/LoomyComposer.module.css";
		/** Class names used by `LoomyComposerControl`. */
		const CSS = {
			control: "dlc_composerControl",
			trigger: "dlc_composerTrigger",
			triggerOpen: "dlc_composerTriggerOpen",
			triggerText: "dlc_composerTriggerText",
			triggerCaret: "dlc_composerTriggerCaret",
			popover: "dlc_composerPopover",
			head: "dlc_composerHead",
			title: "dlc_composerTitle",
			refresh: "dlc_composerRefresh",
			pointsRow: "dlc_composerPointsRow",
			pointsTile: "dlc_composerPointsTile",
			pointsLabel: "dlc_composerPointsLabel",
			pointsValue: "dlc_composerPointsValue",
			pointsMeta: "dlc_composerPointsMeta",
			list: "dlc_composerList",
			row: "dlc_composerRow",
			rowActive: "dlc_composerRowActive",
			model: "dlc_composerModel",
			name: "dlc_composerName",
			currentTag: "dlc_composerCurrentTag",
			billing: "dlc_composerBilling",
			rateChip: "dlc_composerRateChip",
			rateChipPromo: "dlc_composerRateChipPromo",
			missing: "dlc_composerMissing",
			note: "dlc_composerNote",
			placeholder: "dlc_composerPlaceholder"
		};
		const STYLESHEET = `
/* ---- trigger pill (counterpart of the Doubao rate trigger) ---- */
.dlc_composerControl{position:relative;display:inline-flex;align-items:center;flex:none}
.dlc_composerTrigger{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.25));background:transparent;color:var(--dsw-alias-label-secondary,#9aa0a6);font:inherit;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer;outline:none;transition:background-color 120ms ease,border-color 120ms ease,color 120ms ease}
@media (hover:hover){.dlc_composerTrigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));color:var(--dsw-alias-label-primary,#e6e8eb)}}
.dlc_composerTriggerOpen{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-primary,#e6e8eb)}
.dlc_composerTriggerText{min-width:0;overflow:hidden;text-overflow:ellipsis}
.dlc_composerTriggerCaret{font-size:10px;opacity:.75}

/* ---- popover (portal to document.body, opens above-right of the pill) ----
   Deliberately wider/taller than the Doubao popover's 340x380: this one also
   carries the two-tile points split above the model table, which needs the
   extra width to keep both tile values on one line. */
.dlc_composerPopover{position:fixed;z-index:9999;width:min(360px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 96px));display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:var(--dsw-radius-md,10px);background:var(--dsw-alias-bg-layer-3,#1e2127);color:var(--dsw-alias-label-primary,#e6e8eb);border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.3));box-shadow:0 8px 28px rgba(0,0,0,.28);font-size:12px}
.dlc_composerHead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dlc_composerTitle{font-weight:600;font-size:13px}
.dlc_composerRefresh{padding:2px 8px;border-radius:var(--dsw-radius-sm,6px);border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.3));background:transparent;color:var(--dsw-alias-label-secondary,#9aa0a6);font:inherit;font-size:11px;cursor:pointer}
.dlc_composerRefresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-primary,#e6e8eb)}
.dlc_composerRefresh:disabled{opacity:.6;cursor:default}

/* ---- points split (永久积分 / 每日赠送积分) ---- */
.dlc_composerPointsRow{display:flex;gap:8px}
.dlc_composerPointsTile{flex:1 1 0;min-width:0;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.25));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(128,128,128,.06))}
.dlc_composerPointsLabel{display:block;color:var(--dsw-alias-label-secondary,#9aa0a6);font-size:11px;line-height:1.4}
.dlc_composerPointsValue{display:block;margin-top:2px;font-size:16px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}
.dlc_composerPointsMeta{color:var(--dsw-alias-label-tertiary,#9aa0a6);font-size:11px;line-height:1.4}

/* ---- model rate rows ---- */
.dlc_composerList{display:flex;flex-direction:column;gap:4px;overflow-y:auto;max-height:250px}
.dlc_composerRow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:5px 8px;border-radius:var(--dsw-radius-sm,6px)}
.dlc_composerRowActive{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
.dlc_composerModel{display:inline-flex;align-items:center;gap:6px;min-width:0}
.dlc_composerName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlc_composerCurrentTag{flex:none;font-size:10px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4a9eff) 14%,transparent);color:var(--dsw-alias-state-business-primary,#4a9eff)}
.dlc_composerBilling{display:inline-flex;align-items:center;gap:6px;flex:none}
/* Rate chips mirror the Doubao control's color semantics: the multiplier is a
   caution-toned figure, the giveaway is a dashed accent. */
.dlc_composerRateChip{display:inline-flex;align-items:center;border-radius:999px;padding:0 6px;font-size:11px;line-height:16px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-state-warn-primary,#e0a838);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e0a838) 12%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary,#e0a838) 32%,transparent)}
.dlc_composerRateChipPromo{color:var(--dsw-alias-state-error-primary,#ff7b72);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff7b72) 10%,transparent);border-style:dashed;border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#ff7b72) 45%,transparent)}
.dlc_composerMissing{color:var(--dsw-alias-label-tertiary,#9aa0a6)}

/* ---- footer note and placeholders ---- */
.dlc_composerNote{font-size:11px;line-height:1.4;color:var(--dsw-alias-label-tertiary,#9aa0a6);border-top:.5px solid var(--dsw-alias-border-l4,rgba(128,128,128,.2));padding-top:6px}
.dlc_composerPlaceholder{color:var(--dsw-alias-label-tertiary,#9aa0a6);font-size:12px;line-height:1.5}
`;
		/**
		* Install the composer stylesheet once per document.
		*
		* Idempotent like `card-css.ts`: the `data-plugin-css` probe keeps the tag
		* unique, so calling this from the control's mount effect is safe no matter
		* how many Loomy pills mount across sessions.
		*/
		function ensureLoomyComposerStyles() {
			if (typeof document === "undefined") return;
			if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`) !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-loomy-connect";
			tag.dataset.pluginCss = STYLE_TAG_ID;
			tag.textContent = STYLESHEET;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/LoomyComposerControl.tsx
		/**
		* Composer status pill for Loomy models — the Loomy counterpart of the Doubao
		* plugin's rate control.
		*
		* Registered into `conversation.input.right` (a list slot, so the Doubao
		* control's cell and this one coexist; each renders only while its own
		* provider is the active model, so the two never appear together). The pill
		* shows the Loomy identifier plus the remaining-points total and opens a
		* portal popover with the points split and every model's billing rate.
		*
		* Data comes from the plugin's own read-only status route
		* (`/plugins/dsh-loomy-connect/status`) through a module-level store shared
		* by pill and popover; nothing is written back.
		*
		* @module dsh-loomy-connect/loomy-composer-control
		*/
		/**
		* Doubao-parity id defense. The Doubao control deliberately normalizes before
		* matching (`/doubao/i` on the provider, a stripped prefix on the model) —
		* evidence that host-side selections can arrive with a `provider/` prefix or
		* stray whitespace. Mirror that here instead of trusting bare equality:
		* `selection.provider` may be `loomy` or `loomy/<model>`, and the model id the
		* same way, while the catalog ids are bare.
		*/
		const LOOMY_PROVIDER_TAG = new RegExp(`^${LOOMY_PROVIDER}(?:/|$)`, "i");
		const LOOMY_MODEL_PREFIX = new RegExp(`^${LOOMY_PROVIDER}/`, "i");
		/** True for `loomy` and `loomy/…` shaped provider ids. */
		function isLoomyProviderId(providerId) {
			return providerId !== void 0 && LOOMY_PROVIDER_TAG.test(providerId.trim());
		}
		/** The model id without a possible `loomy/` prefix. */
		function normalizeLoomyModelId(modelId) {
			return modelId.trim().replace(LOOMY_MODEL_PREFIX, "");
		}
		const POLL_INTERVAL_MS = 6e4;
		/** Shortest time the refresh button stays visibly busy (card parity). */
		const MIN_BUSY_MS = 600;
		/** DOM fallback probe cadence while the projection has no answer yet. */
		const PROBE_INTERVAL_MS = 1e3;
		/** Ancestors that mark a `data-provider-id` span as a menu row, not the trigger. */
		const MENU_CONTAINER_SELECTOR = "[role=\"menu\"], [role=\"listbox\"], [role=\"tooltip\"]";
		let statusSnapshot;
		let statusInflight;
		let statusFetchedAt = 0;
		/**
		* True after the most recent completed read failed. Only visible when no
		* snapshot exists at all (first load never succeeded): with an old snapshot
		* the surfaces keep showing the last known numbers plus their updated-at.
		*/
		let statusFetchFailed = false;
		const statusListeners = /* @__PURE__ */ new Set();
		function notifyStatusListeners() {
			for (const listener of statusListeners) listener();
		}
		function subscribeStatus(listener) {
			statusListeners.add(listener);
			return () => {
				statusListeners.delete(listener);
			};
		}
		async function fetchStatus(force) {
			try {
				const response = await fetch(force ? `${LOOMY_STATUS_PATH}?refresh=1` : LOOMY_STATUS_PATH, {
					headers: { accept: "application/json" },
					credentials: "same-origin"
				});
				const value = await response.json().catch(() => void 0);
				if (response.ok && value !== void 0) {
					statusSnapshot = value;
					statusFetchedAt = Date.now();
					statusFetchFailed = false;
				} else statusFetchFailed = true;
				notifyStatusListeners();
			} catch {
				statusFetchFailed = true;
				notifyStatusListeners();
			}
		}
		/**
		* One status read, coalesced: an in-flight request serves every caller, a
		* fresh-enough snapshot short-circuits, and `force` (the popover button)
		* bypasses the age check and makes the host re-pull Loomy's own caches. A
		* forced read REPLACES any in-flight background read — the polite fetch still
		* completes and updates the snapshot, but the forced one owns the slot, so a
		* refresh click can never be swallowed by a concurrent poll.
		*/
		function ensureStatus(maxAgeMs, force = false) {
			if (force) {
				const promise = fetchStatus(true).finally(() => {
					if (statusInflight === promise) statusInflight = void 0;
				});
				statusInflight = promise;
				return promise;
			}
			if (statusInflight !== void 0) return statusInflight;
			if (Date.now() - statusFetchedAt < maxAgeMs) return Promise.resolve();
			const promise = fetchStatus(false).finally(() => {
				if (statusInflight === promise) statusInflight = void 0;
			});
			statusInflight = promise;
			return statusInflight;
		}
		/** React binding: snapshot, plus — while the pill is visible — a mount read and a 60s poll. */
		function useLoomyStatus(active) {
			const snapshot = (0, react.useSyncExternalStore)(subscribeStatus, () => statusSnapshot);
			(0, react.useEffect)(() => {
				if (!active) return void 0;
				ensureStatus(0);
				const timer = window.setInterval(() => {
					ensureStatus(POLL_INTERVAL_MS);
				}, POLL_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
				};
			}, [active]);
			return snapshot;
		}
		/**
		* Read the trigger model off the DOM.
		*
		* The host stamps `data-provider-id` / `data-model-id` on the label wrapper
		* span of the picker trigger AND of every menu row, so menu containers are
		* excluded first; among the rest, the span inside a `button[aria-expanded]`
		* (the dropdown trigger) wins, and plain document order is the last resort.
		* Reads only — nothing here touches the host's DOM.
		*/
		function probeTriggerSelection() {
			if (typeof document === "undefined") return null;
			let first = null;
			let fromTrigger = null;
			for (const span of document.querySelectorAll("span[data-provider-id]")) {
				if (span.closest(MENU_CONTAINER_SELECTOR) !== null) continue;
				const provider = span.getAttribute("data-provider-id") ?? "";
				const model = span.getAttribute("data-model-id") ?? "";
				if (provider === "" || model === "") continue;
				const found = {
					provider,
					model
				};
				if (first === null) first = found;
				if (fromTrigger === null && span.closest("button[aria-expanded]") !== null) {
					fromTrigger = found;
					break;
				}
			}
			return fromTrigger ?? first;
		}
		/**
		* The effective active model: the session projection first (`next` = the
		* pending pick or, after a request, the last-used selection), then a DOM probe
		* of the trigger for the gap the projection cannot cover — a fresh session
		* still sitting on the default model, where no selection event and no request
		* header exist yet.
		*/
		function useActiveSelection(useProjection) {
			const projected = useProjection?.("modelSelection");
			const projectedSelection = projected?.next ?? projected?.lastUsed ?? null;
			const [observed, setObserved] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (projectedSelection !== null) return void 0;
				const probe = () => {
					const found = probeTriggerSelection();
					setObserved((previous) => previous !== null && found !== null && previous.provider === found.provider && previous.model === found.model ? previous : found);
				};
				probe();
				const timer = window.setInterval(probe, PROBE_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
				};
			}, [projectedSelection]);
			return projectedSelection ?? observed;
		}
		/** Popover anchor above-right of the trigger; same geometry as the Doubao control. */
		function computePopoverCoords(anchor) {
			if (anchor === null || typeof window === "undefined") return {
				bottom: 64,
				right: 16
			};
			const rect = anchor.getBoundingClientRect();
			return {
				bottom: Math.max(12, Math.round(window.innerHeight - rect.top + 8)),
				right: Math.max(12, Math.round(window.innerWidth - rect.right))
			};
		}
		/** One model-rate row of the popover; the active model is highlighted and tagged. */
		function ModelRow({ model, active, t }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: active ? `${CSS.row} ${CSS.rowActive}` : CSS.row,
				"data-active": active === true || void 0,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: CSS.model,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.name,
						title: modelName(model.name),
						children: modelName(model.name)
					}), active ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.currentTag,
						children: t("currentBadge")
					}) : null]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: CSS.billing,
					children: model.rate === void 0 && model.promo === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.missing,
						children: t("rateUnavailable")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [model.rate === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.rateChip,
						children: formatRate(model.rate)
					}), model.promo === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.rateChipPromo,
						children: promoLabel(model.promo, t)
					})] })
				})]
			});
		}
		/** Points split shown under the popover header (card tile semantics, compact). */
		function PointsSplit({ status, t }) {
			const rawUpdatedAt = status.points?.updatedAt;
			const updatedMs = rawUpdatedAt === void 0 ? void 0 : Date.parse(rawUpdatedAt);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: CSS.pointsRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CSS.pointsTile,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS.pointsLabel,
							children: t("permanentPoints")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS.pointsValue,
							children: status.points === void 0 ? "--" : formatNumber(status.points.permanent)
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CSS.pointsTile,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS.pointsLabel,
							children: t("dailyPoints")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS.pointsValue,
							children: status.points === void 0 ? "--" : formatNumber(status.points.daily)
						})]
					})]
				}),
				status.points === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CSS.pointsMeta,
					children: t("pointsUnavailable")
				}) : null,
				updatedMs === void 0 || Number.isNaN(updatedMs) || status.points === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CSS.pointsMeta,
					children: t("updatedAt", { time: formatTime(updatedMs) })
				}),
				status.pointsError === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CSS.pointsMeta,
					children: t("pointsError", { message: status.pointsError })
				}),
				status.points === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: CSS.pointsMeta,
					children: t("pointsSourceHint")
				}),
				(() => {
					const expiry = dailyExpiryText(dailyPointsExpiry(rawUpdatedAt), t);
					return expiry === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS.pointsMeta,
						children: expiry
					});
				})()
			] });
		}
		/** Render the Loomy composer pill, or nothing while another provider is active. */
		function LoomyComposerControl(props) {
			const { t, useProjection } = props;
			const selection = useActiveSelection(useProjection);
			const pillVisible = isLoomyProviderId(selection?.provider);
			const status = useLoomyStatus(pillVisible);
			const [open, setOpen] = (0, react.useState)(false);
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const [coords, setCoords] = (0, react.useState)({
				bottom: 64,
				right: 16
			});
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				ensureLoomyComposerStyles();
			}, []);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				ensureStatus(0);
			}, [open]);
			(0, react.useEffect)(() => {
				if (!pillVisible) setOpen(false);
			}, [pillVisible]);
			(0, react.useLayoutEffect)(() => {
				if (!open) return void 0;
				const reposition = () => {
					setCoords(computePopoverCoords(rootRef.current));
				};
				reposition();
				window.addEventListener("resize", reposition);
				return () => {
					window.removeEventListener("resize", reposition);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return void 0;
				const onPointerDown = (event) => {
					const target = event.target;
					if (target === null) return;
					if (rootRef.current?.contains(target) === true || panelRef.current?.contains(target) === true) return;
					setOpen(false);
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			if (!pillVisible || selection === null) return null;
			const points = status?.status === "signed-in" ? status.points : void 0;
			const total = points === void 0 ? null : points.permanent + points.daily;
			const pillText = t("pillLabel", { total: total === null ? "--" : formatNumber(total) });
			const models = status?.status === "signed-in" ? status.models ?? [] : [];
			const rawModelId = selection.model;
			const normalizedModelId = normalizeLoomyModelId(rawModelId);
			const isCurrentRow = (model) => model.id === rawModelId || model.id === normalizedModelId;
			const manualRefresh = async () => {
				setRefreshing(true);
				const started = Date.now();
				try {
					await ensureStatus(0, true);
				} finally {
					const elapsed = Date.now() - started;
					if (elapsed < MIN_BUSY_MS) await new Promise((resolve) => {
						window.setTimeout(resolve, MIN_BUSY_MS - elapsed);
					});
					setRefreshing(false);
				}
			};
			const popover = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: panelRef,
				className: CSS.popover,
				role: "dialog",
				"aria-label": t("popoverTitle"),
				style: {
					bottom: `${coords.bottom}px`,
					right: `${coords.right}px`
				},
				onMouseDown: (event) => {
					if (event.target instanceof Element && event.target.closest("button") !== null) event.preventDefault();
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CSS.head,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CSS.title,
							children: t("popoverTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: CSS.refresh,
							disabled: refreshing,
							onClick: () => {
								manualRefresh();
							},
							children: refreshing ? t("refreshing") : t("refresh")
						})]
					}),
					status === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS.placeholder,
						children: statusFetchFailed ? t("statusUnavailable") : t("refreshing")
					}) : status.status === "signed-out" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS.placeholder,
						children: t("signedOutHint")
					}) : status.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS.placeholder,
						children: status.message
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PointsSplit, {
						status,
						t
					}), models.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS.placeholder,
						children: t("popoverEmpty")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CSS.list,
						children: [models.filter((model) => model.image !== true).map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelRow, {
							model,
							active: isCurrentRow(model),
							t
						}, model.id)), models.filter((model) => model.image === true).map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelRow, {
							model,
							active: isCurrentRow(model),
							t
						}, model.id))]
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: CSS.note,
						children: t("rateNote")
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: CSS.control,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: open ? `${CSS.trigger} ${CSS.triggerOpen}` : CSS.trigger,
					"aria-expanded": open,
					"aria-haspopup": "dialog",
					"aria-label": t("controlAria"),
					title: t("controlAria"),
					onMouseDown: (event) => {
						event.preventDefault();
					},
					onClick: () => {
						setOpen((was) => !was);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.triggerText,
						children: pillText
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: CSS.triggerCaret,
						"aria-hidden": "true",
						children: "▾"
					})]
				}), open && typeof document !== "undefined" && document.body !== null ? react_dom.createPortal(popover, document.body) : null]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Plugin-card copy registered under the settings.loomy locale namespace. */
		const en = {
			title: "DSH Loomy Connect",
			intro: "Use the models included in the Loomy desktop app directly in DSH — zero configuration, ready out of the box.",
			expand: "Expand",
			collapse: "Collapse",
			loading: "Loading account…",
			signedOut: "Not signed in",
			signedOutHint: "Sign in once in the Loomy desktop app; this plugin follows that sign-in automatically.",
			signedInAs: "Signed in as {account}",
			signedIn: "Signed in",
			pointsHeading: "Points",
			permanentPoints: "Permanent points",
			permanentPointsHint: "Long-lived balance",
			dailyPoints: "Daily gift points",
			dailyPointsHint: "Refilled to 5000 on each daily sign-in",
			dailyExpiry: "Expires {date} · {days} days left",
			dailyExpiryToday: "Expires {date} · last day",
			dailyExpiryExpired: "Expired on {date}",
			updatedAt: "Updated {time}",
			pointsSourceHint: "Read from Loomy’s own cache; the numbers move when Loomy refreshes it.",
			pointsTotal: "Total points",
			pointsTotalHint: "Permanent balance plus the daily gift",
			pointsUnavailable: "No points snapshot yet — open Loomy once and it will appear here.",
			pointsError: "Points unavailable: {message}",
			tabPoints: "Points",
			tabModels: "Models",
			modelsHeading: "Models",
			modelsTag: "{count} chat models",
			modelsContext: "Context {size}",
			modelsContextUnknown: "Context not provided",
			modelsColModel: "Model",
			modelsColContext: "Context",
			modelsColBill: "Billing",
			modelsContextNone: "Not provided",
			badgeLimitedFree: "Limited-time free",
			refresh: "Refresh",
			refreshing: "Refreshing…",
			requestFailed: "Request failed",
			activeAccountLabel: "Chat account",
			activeAccountHint: "Chat requests run as the selected account. Points still show Loomy’s currently displayed balance.",
			pillLabel: "Loomy · Points {total}",
			controlAria: "View Loomy points and model rates",
			popoverTitle: "Loomy points & rates",
			currentBadge: "Current",
			rateUnavailable: "--",
			popoverEmpty: "No model rate data",
			rateNote: "Points are read from Loomy’s local cache; rates come from the Loomy model list and are display-only. This plugin does not bill and cannot verify the actual charge.",
			statusUnavailable: "Could not reach the Loomy status route — press Refresh to retry."
		};
		const zh = {
			title: "DSH Loomy Connect",
			intro: "在 DSH 中直接使用 Loomy 桌面 App 包含的模型，开箱即用，无需额外配置。",
			expand: "展开",
			collapse: "收起",
			loading: "正在读取账号…",
			signedOut: "未登录",
			signedOutHint: "在 Loomy 桌面 App 里登录一次即可，插件会自动跟随当前登录的账号。",
			signedInAs: "已登录：{account}",
			signedIn: "已登录",
			pointsHeading: "积分余额",
			permanentPoints: "永久积分",
			permanentPointsHint: "长期有效的积分",
			dailyPoints: "每日赠送积分",
			dailyPointsHint: "每日登录后刷新为 5000",
			dailyExpiry: "{date} 到期 · 剩余 {days} 天",
			dailyExpiryToday: "{date} 到期 · 今天最后一天",
			dailyExpiryExpired: "{date} 已到期",
			updatedAt: "更新于 {time}",
			pointsSourceHint: "积分读自 Loomy 本地缓存，Loomy 刷新后这里才会变化。",
			pointsTotal: "剩余积分",
			pointsTotalHint: "永久积分与每日赠送合计",
			pointsUnavailable: "还没有积分快照 —— 打开一次 Loomy 后这里就会显示。",
			pointsError: "积分查询失败：{message}",
			tabPoints: "积分",
			tabModels: "模型",
			modelsHeading: "模型",
			modelsTag: "{count} 个可对话",
			modelsContext: "上下文 {size}",
			modelsContextUnknown: "上下文未提供",
			modelsColModel: "模型",
			modelsColContext: "上下文",
			modelsColBill: "计费",
			modelsContextNone: "—",
			badgeLimitedFree: "限时免费",
			refresh: "刷新",
			refreshing: "正在刷新…",
			requestFailed: "请求失败",
			activeAccountLabel: "聊天账号",
			activeAccountHint: "聊天请求使用所选账号；积分仍显示 Loomy 客户端当前展示的余额。",
			pillLabel: "Loomy · 剩余积分 {total}",
			controlAria: "查看 Loomy 积分与模型倍率",
			popoverTitle: "Loomy 积分与倍率",
			currentBadge: "当前",
			rateUnavailable: "--",
			popoverEmpty: "暂无模型倍率信息",
			rateNote: "积分读自 Loomy 本地缓存；倍率来自 Loomy 模型清单，仅作展示。本插件不参与计费，也无法核实实际扣费。",
			statusUnavailable: "暂时无法获取 Loomy 状态，请点右上角「刷新」重试。"
		};
		//#endregion
		//#region src/client/index.tsx
		/** Stable browser-plugin name. */
		const name = "dsh-loomy-connect-client";
		/**
		* Client services required by the Plugin configuration contribution. The
		* `slots` registry lives in `@deepseek-ai/dsh-client-ui-renderer`, `locale` in
		* `@deepseek-ai/dsh-client-locale`, and the `settings.plugin.item` slot is
		* declared by `@deepseek-ai/dsh-client-ui-settings-plugins`. All three are
		* named in the package's `dsh.client.inject` list, so cordis has activated
		* them before this plugin's fiber starts.
		*/
		const inject = [
			"slots",
			"locale",
			"configForms"
		];
		/**
		* Register card copy and the Loomy card under Plugin configuration.
		*
		* The body is wrapped so a DSH slot-API breaking change degrades to a
		* `console.error` instead of throwing into the DSH loader and raising the red
		* "Failed to load plugins" banner. The host provider keeps working regardless:
		* the `loomy` model channel is unaffected by a card that cannot mount.
		*/
		function apply(ctx) {
			try {
				const namespace = "settings.loomy";
				ctx.effect(() => ctx.locale.register(namespace, {
					zh,
					en
				}), "dsh-loomy-connect: settings copy");
				const t = ctx.locale.bind(namespace);
				let activeAccount = () => void 0;
				let setActiveAccount = () => void 0;
				try {
					const configForms = ctx.configForms;
					if (configForms === void 0) throw new Error("configForms service not present");
					const form = configForms.get("loomy");
					const read = () => {
						const value = form.getSnapshot().value || {};
						activeAccount = () => value.activeUserId;
					};
					read();
					ctx.effect(() => form.subscribe(read), "dsh-loomy-connect: active account subscribe");
					setActiveAccount = (userId) => {
						form.mutate([{
							op: "set",
							path: ["activeUserId"],
							value: userId
						}]);
					};
				} catch (error) {
					console.error("[dsh-loomy-connect] configForms unavailable; account picker is read-only:", error);
				}
				ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
					name: "settings.plugin.item",
					key: "loomy",
					priority: 30,
					inject: () => ({
						t,
						activeAccount,
						setActiveAccount
					})
				}, LoomyPluginCard));
				try {
					ctx.slots.inject("conversation.input.right", () => ctx.slots.register({
						name: "conversation.input.right",
						id: "loomy-status",
						order: 90,
						inject: () => ({ t })
					}, LoomyComposerControl));
				} catch (error) {
					console.error("[dsh-loomy-connect] conversation.input.right failed to register (host provider unaffected):", error);
				}
			} catch (error) {
				console.error("[dsh-loomy-connect] client card failed to load (host provider unaffected):", error);
			}
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
