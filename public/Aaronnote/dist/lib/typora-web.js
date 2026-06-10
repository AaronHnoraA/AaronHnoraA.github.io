import { EditorState as e, Plugin as t, PluginKey as n, Selection as r, TextSelection as i } from "prosemirror-state";
import { Decoration as a, DecorationSet as o, EditorView as s } from "prosemirror-view";
import { history as c, redo as l, undo as u } from "prosemirror-history";
import { DOMSerializer as d, Mark as f, Schema as p } from "prosemirror-model";
import { keymap as m } from "prosemirror-keymap";
import { baseKeymap as h, chainCommands as g } from "prosemirror-commands";
import { InputRule as _, inputRules as v, wrappingInputRule as y } from "prosemirror-inputrules";
import ee from "markdown-it-emoji/lib/data/full.mjs";
import { liftListItem as te, sinkListItem as ne, splitListItem as re } from "prosemirror-schema-list";
import ie from "markdown-it";
//#region src/cursor-render.ts
function ae() {
	return new t({ props: { decorations(e) {
		let t = e.selection;
		if (!t.empty) {
			let n = oe("selection-marker", "["), r = oe("selection-marker", "]");
			return o.create(e.doc, [a.widget(t.from, n, { side: -1 }), a.widget(t.to, r, { side: 1 })]);
		}
		let n = oe("play-caret", "");
		return o.create(e.doc, [a.widget(t.from, n, { side: 0 })]);
	} } });
}
function oe(e, t) {
	return () => {
		let n = document.createElement("span");
		return n.className = e, t && (n.textContent = t), n;
	};
}
//#endregion
//#region node_modules/temml/dist/temml.mjs
var b = class e {
	constructor(t, n) {
		let r = " " + t, i, a = n && n.loc;
		if (a && a.start <= a.end) {
			let e = a.lexer.input;
			i = a.start;
			let t = a.end;
			i === e.length ? r += " at end of input: " : r += " at position " + (i + 1) + ": \n";
			let n = e.slice(i, t).replace(/[^]/g, "$&̲"), o;
			o = i > 15 ? "…" + e.slice(i - 15, i) : e.slice(0, i);
			let s;
			s = t + 15 < e.length ? e.slice(t, t + 15) + "…" : e.slice(t), r += o + n + s;
		}
		let o = Error(r);
		return o.name = "ParseError", o.__proto__ = e.prototype, o.position = i, o;
	}
};
b.prototype.__proto__ = Error.prototype;
var x = function(e, t) {
	return e === void 0 ? t : e;
}, se = /([A-Z])/g, ce = function(e) {
	return e.replace(se, "-$1").toLowerCase();
}, le = {
	"&": "&amp;",
	">": "&gt;",
	"<": "&lt;",
	"\"": "&quot;",
	"'": "&#x27;"
}, ue = /[&><"']/g;
function de(e) {
	return String(e).replace(ue, (e) => le[e]);
}
var fe = function(e) {
	return e.type === "ordgroup" || e.type === "color" ? e.body.length === 1 ? fe(e.body[0]) : e : e.type === "font" ? fe(e.body) : e;
}, pe = function(e) {
	let t = fe(e);
	return t.type === "mathord" || t.type === "textord" || t.type === "atom";
}, me = function(e) {
	if (!e) throw Error("Expected non-null, but got " + String(e));
	return e;
}, he = function(e) {
	let t = /^[\x00-\x20]*([^\\/#?]*?)(:|&#0*58|&#x0*3a|&colon)/i.exec(e);
	return t ? t[2] !== ":" || !/^[a-zA-Z][a-zA-Z0-9+\-.]*$/.test(t[1]) ? null : t[1].toLowerCase() : "_relative";
}, ge = function(e) {
	return +e.toFixed(4);
}, _e = "acegıȷmnopqrsuvwxyzαγεηικμνοπρςστυχωϕ𝐚𝐜𝐞𝐠𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐮𝐯𝐰𝐱𝐲𝐳", ve = class {
	constructor(e) {
		e ||= {}, this.displayMode = x(e.displayMode, !1), this.annotate = x(e.annotate, !1), this.leqno = x(e.leqno, !1), this.throwOnError = x(e.throwOnError, !1), this.errorColor = x(e.errorColor, "#b22222"), this.macros = e.macros || {}, this.wrap = x(e.wrap, "none"), this.xml = x(e.xml, !1), this.colorIsTextColor = x(e.colorIsTextColor, !1), this.strict = x(e.strict, !1), this.trust = x(e.trust, !1), this.maxSize = e.maxSize === void 0 ? [Infinity, Infinity] : Array.isArray(e.maxSize) ? e.maxSize : [Infinity, Infinity], this.maxExpand = Math.max(0, x(e.maxExpand, 1e3)), this.wrapDelimiterPairs = !0;
	}
	isTrusted(e) {
		if (e.url && !e.protocol) {
			let t = he(e.url);
			if (t == null) return !1;
			e.protocol = t;
		}
		return !!(typeof this.trust == "function" ? this.trust(e) : this.trust);
	}
}, ye = {}, be = {};
function S({ type: e, names: t, props: n, handler: r, mathmlBuilder: i }) {
	let a = {
		type: e,
		numArgs: n.numArgs,
		argTypes: n.argTypes,
		allowedInArgument: !!n.allowedInArgument,
		allowedInText: !!n.allowedInText,
		allowedInMath: n.allowedInMath === void 0 ? !0 : n.allowedInMath,
		numOptionalArgs: n.numOptionalArgs || 0,
		infix: !!n.infix,
		primitive: !!n.primitive,
		handler: r
	};
	for (let e = 0; e < t.length; ++e) ye[t[e]] = a;
	e && i && (be[e] = i);
}
function xe({ type: e, mathmlBuilder: t }) {
	S({
		type: e,
		names: [],
		props: { numArgs: 0 },
		handler() {
			throw Error("Should never be called.");
		},
		mathmlBuilder: t
	});
}
var Se = function(e) {
	return e.type === "ordgroup" && e.body.length === 1 ? e.body[0] : e;
}, C = function(e) {
	return e.type === "ordgroup" ? e.body : [e];
}, Ce = class {
	constructor(e) {
		this.children = e, this.classes = [], this.style = {};
	}
	hasClass(e) {
		return this.classes.includes(e);
	}
	toNode() {
		let e = document.createDocumentFragment();
		for (let t = 0; t < this.children.length; t++) e.appendChild(this.children[t].toNode());
		return e;
	}
	toMarkup() {
		let e = "";
		for (let t = 0; t < this.children.length; t++) e += this.children[t].toMarkup();
		return e;
	}
	toText() {
		return this.children.map((e) => e.toText()).join("");
	}
}, we = function(e) {
	return e.filter((e) => e).join(" ");
}, Te = function(e, t) {
	this.classes = e || [], this.attributes = {}, this.style = t || {};
}, Ee = function(e) {
	let t = document.createElement(e);
	t.className = we(this.classes);
	for (let e in this.style) Object.prototype.hasOwnProperty.call(this.style, e) && (t.style[e] = this.style[e]);
	for (let e in this.attributes) Object.prototype.hasOwnProperty.call(this.attributes, e) && t.setAttribute(e, this.attributes[e]);
	for (let e = 0; e < this.children.length; e++) t.appendChild(this.children[e].toNode());
	return t;
}, De = function(e) {
	let t = `<${e}`;
	this.classes.length && (t += ` class="${de(we(this.classes))}"`);
	let n = "";
	for (let e in this.style) Object.prototype.hasOwnProperty.call(this.style, e) && (n += `${ce(e)}:${this.style[e]};`);
	n && (t += ` style="${n}"`);
	for (let e in this.attributes) Object.prototype.hasOwnProperty.call(this.attributes, e) && (t += ` ${e}="${de(this.attributes[e])}"`);
	t += ">";
	for (let e = 0; e < this.children.length; e++) t += this.children[e].toMarkup();
	return t += `</${e}>`, t;
}, Oe = class {
	constructor(e, t, n) {
		Te.call(this, e, n), this.children = t || [];
	}
	setAttribute(e, t) {
		this.attributes[e] = t;
	}
	toNode() {
		return Ee.call(this, "span");
	}
	toMarkup() {
		return De.call(this, "span");
	}
}, ke = class {
	constructor(e) {
		this.text = e;
	}
	toNode() {
		return document.createTextNode(this.text);
	}
	toMarkup() {
		return de(this.text);
	}
}, Ae = class {
	constructor(e, t, n) {
		this.href = e, this.classes = t, this.children = n || [];
	}
	toNode() {
		let e = document.createElement("a");
		e.setAttribute("href", this.href), this.classes.length > 0 && (e.className = we(this.classes));
		for (let t = 0; t < this.children.length; t++) e.appendChild(this.children[t].toNode());
		return e;
	}
	toMarkup() {
		let e = `<a href='${de(this.href)}'`;
		this.classes.length > 0 && (e += ` class="${de(we(this.classes))}"`), e += ">";
		for (let t = 0; t < this.children.length; t++) e += this.children[t].toMarkup();
		return e += "</a>", e;
	}
}, je = class {
	constructor(e, t, n) {
		this.alt = t, this.src = e, this.classes = ["mord"], this.style = n;
	}
	hasClass(e) {
		return this.classes.includes(e);
	}
	toNode() {
		let e = document.createElement("img");
		e.src = this.src, e.alt = this.alt, e.className = "mord";
		for (let t in this.style) Object.prototype.hasOwnProperty.call(this.style, t) && (e.style[t] = this.style[t]);
		return e;
	}
	toMarkup() {
		let e = `<img src='${this.src}' alt='${this.alt}'`, t = "";
		for (let e in this.style) Object.prototype.hasOwnProperty.call(this.style, e) && (t += `${ce(e)}:${this.style[e]};`);
		return t && (e += ` style="${de(t)}"`), e += ">", e;
	}
};
function Me(e) {
	return new Ce(e);
}
var w = class {
	constructor(e, t, n, r) {
		this.type = e, this.attributes = {}, this.children = t || [], this.classes = n || [], this.style = r || {}, this.label = "";
	}
	setAttribute(e, t) {
		this.attributes[e] = t;
	}
	getAttribute(e) {
		return this.attributes[e];
	}
	setLabel(e) {
		this.label = e;
	}
	toNode() {
		let e = document.createElementNS("http://www.w3.org/1998/Math/MathML", this.type);
		for (let t in this.attributes) Object.prototype.hasOwnProperty.call(this.attributes, t) && e.setAttribute(t, this.attributes[t]);
		this.classes.length > 0 && (e.className = we(this.classes));
		for (let t in this.style) Object.prototype.hasOwnProperty.call(this.style, t) && (e.style[t] = this.style[t]);
		for (let t = 0; t < this.children.length; t++) e.appendChild(this.children[t].toNode());
		return e;
	}
	toMarkup() {
		let e = "<" + this.type;
		for (let t in this.attributes) Object.prototype.hasOwnProperty.call(this.attributes, t) && (e += " " + t + "=\"", e += de(this.attributes[t]), e += "\"");
		this.classes.length > 0 && (e += ` class="${de(we(this.classes))}"`);
		let t = "";
		for (let e in this.style) Object.prototype.hasOwnProperty.call(this.style, e) && (t += `${ce(e)}:${this.style[e]};`);
		t && (e += ` style="${t}"`), e += ">";
		for (let t = 0; t < this.children.length; t++) e += this.children[t].toMarkup();
		return e += "</" + this.type + ">", e;
	}
	toText() {
		return this.children.map((e) => e.toText()).join("");
	}
}, T = class {
	constructor(e) {
		this.text = e;
	}
	toNode() {
		return document.createTextNode(this.text);
	}
	toMarkup() {
		return de(this.toText());
	}
	toText() {
		return this.text;
	}
}, Ne = (e) => {
	let t;
	return e.length === 1 && e[0].type === "mrow" ? (t = e.pop(), t.type = "mstyle") : t = new w("mstyle", e), t;
}, Pe = (e) => {
	let t = 0;
	if (e.body && Array.isArray(e.body)) for (let n of e.body) t += Pe(n);
	else if (e.body) t += Pe(e.body);
	else if (e.type === "supsub") t += Pe(e.base), e.sub && (t += .7 * Pe(e.sub)), e.sup && (t += .7 * Pe(e.sup));
	else if (e.type === "mathord" || e.type === "textord") for (let n of e.text.split("")) {
		let e = n.codePointAt(0);
		96 < e && e < 123 || 944 < e && e < 970 ? t += .56 : 47 < e && e < 58 ? t += .5 : t += .92;
	}
	else t += 1;
	return t;
}, Fe = {
	widehat: "^",
	widecheck: "ˇ",
	widetilde: "~",
	wideparen: "⏜",
	utilde: "~",
	overleftarrow: "←",
	underleftarrow: "←",
	xleftarrow: "←",
	overrightarrow: "→",
	underrightarrow: "→",
	xrightarrow: "→",
	underbrace: "⏟",
	overbrace: "⏞",
	overbracket: "⎴",
	underbracket: "⎵",
	overgroup: "⏠",
	overparen: "⏜",
	undergroup: "⏡",
	underparen: "⏝",
	overleftrightarrow: "↔",
	underleftrightarrow: "↔",
	xleftrightarrow: "↔",
	Overrightarrow: "⇒",
	xRightarrow: "⇒",
	overleftharpoon: "↼",
	xleftharpoonup: "↼",
	overrightharpoon: "⇀",
	xrightharpoonup: "⇀",
	xLeftarrow: "⇐",
	xLeftrightarrow: "⇔",
	xhookleftarrow: "↩",
	xhookrightarrow: "↪",
	xmapsto: "↦",
	xrightharpoondown: "⇁",
	xleftharpoondown: "↽",
	xtwoheadleftarrow: "↞",
	xtwoheadrightarrow: "↠",
	xlongequal: "=",
	xrightleftarrows: "⇄",
	xtofrom: "⇄",
	xleftrightharpoons: "⇋",
	xrightleftharpoons: "⇌",
	yields: "→",
	yieldsLeft: "←",
	mesomerism: "↔",
	longrightharpoonup: "⇀",
	longleftharpoondown: "↽",
	eqrightharpoonup: "⇀",
	eqleftharpoondown: "↽",
	"\\cdrightarrow": "→",
	"\\cdleftarrow": "←",
	"\\cdlongequal": "=",
	yieldsLeftRight: "⇄",
	chemequilibrium: "⇌"
}, Ie = function(e) {
	let t = new w("mo", [new T(Fe[e.slice(1)])]);
	return t.setAttribute("stretchy", "true"), t;
}, Le = [
	"\\widetilde",
	"\\widehat",
	"\\widecheck",
	"\\utilde"
], Re = (e) => {
	let t = Ie(e.label);
	if (Le.includes(e.label)) {
		let n = Pe(e.base);
		1 < n && n < 1.6 ? t.classes.push("tml-crooked-2") : 1.6 <= n && n < 2.5 ? t.classes.push("tml-crooked-3") : 2.5 <= n && t.classes.push("tml-crooked-4");
	}
	return t;
}, ze = {
	bin: 1,
	close: 1,
	inner: 1,
	open: 1,
	punct: 1,
	rel: 1
}, Be = {
	"accent-token": 1,
	mathord: 1,
	"op-token": 1,
	spacing: 1,
	textord: 1
}, E = {
	math: {},
	text: {}
};
function D(e, t, n, r, i) {
	E[e][r] = {
		group: t,
		replace: n
	}, i && n && (E[e][n] = E[e][r]);
}
var O = "math", k = "text", A = "accent-token", j = "bin", M = "close", Ve = "inner", N = "mathord", P = "op-token", F = "open", He = "punct", I = "rel", Ue = "spacing", L = "textord";
D(O, I, "≡", "\\equiv", !0), D(O, I, "≺", "\\prec", !0), D(O, I, "≻", "\\succ", !0), D(O, I, "∼", "\\sim", !0), D(O, I, "⟂", "\\perp", !0), D(O, I, "⪯", "\\preceq", !0), D(O, I, "⪰", "\\succeq", !0), D(O, I, "≃", "\\simeq", !0), D(O, I, "≌", "\\backcong", !0), D(O, I, "|", "\\mid", !0), D(O, I, "≪", "\\ll", !0), D(O, I, "≫", "\\gg", !0), D(O, I, "≍", "\\asymp", !0), D(O, I, "∥", "\\parallel"), D(O, I, "⌣", "\\smile", !0), D(O, I, "⊑", "\\sqsubseteq", !0), D(O, I, "⊒", "\\sqsupseteq", !0), D(O, I, "≐", "\\doteq", !0), D(O, I, "⌢", "\\frown", !0), D(O, I, "∋", "\\ni", !0), D(O, I, "∌", "\\notni", !0), D(O, I, "∝", "\\propto", !0), D(O, I, "⊢", "\\vdash", !0), D(O, I, "⊣", "\\dashv", !0), D(O, I, "∋", "\\owns"), D(O, I, "≘", "\\arceq", !0), D(O, I, "≙", "\\wedgeq", !0), D(O, I, "≚", "\\veeeq", !0), D(O, I, "≛", "\\stareq", !0), D(O, I, "≝", "\\eqdef", !0), D(O, I, "≞", "\\measeq", !0), D(O, I, "≟", "\\questeq", !0), D(O, I, "≠", "\\ne", !0), D(O, I, "≠", "\\neq"), D(O, I, "⩵", "\\eqeq", !0), D(O, I, "⩶", "\\eqeqeq", !0), D(O, I, "∷", "\\dblcolon", !0), D(O, I, "≔", "\\coloneqq", !0), D(O, I, "≕", "\\eqqcolon", !0), D(O, I, "∹", "\\eqcolon", !0), D(O, I, "⩴", "\\Coloneqq", !0), D(O, He, ".", "\\ldotp"), D(O, He, "·", "\\cdotp"), D(O, L, "#", "\\#"), D(k, L, "#", "\\#"), D(O, L, "&", "\\&"), D(k, L, "&", "\\&"), D(O, L, "ℵ", "\\aleph", !0), D(O, L, "∀", "\\forall", !0), D(O, L, "ℏ", "\\hbar", !0), D(O, L, "∃", "\\exists", !0), D(O, F, "∇", "\\nabla", !0), D(O, L, "♭", "\\flat", !0), D(O, L, "ℓ", "\\ell", !0), D(O, L, "♮", "\\natural", !0), D(O, L, "Å", "\\Angstrom", !0), D(k, L, "Å", "\\Angstrom", !0), D(O, L, "♣", "\\clubsuit", !0), D(O, L, "♧", "\\varclubsuit", !0), D(O, L, "℘", "\\wp", !0), D(O, L, "♯", "\\sharp", !0), D(O, L, "♢", "\\diamondsuit", !0), D(O, L, "♦", "\\vardiamondsuit", !0), D(O, L, "ℜ", "\\Re", !0), D(O, L, "♡", "\\heartsuit", !0), D(O, L, "♥", "\\varheartsuit", !0), D(O, L, "ℑ", "\\Im", !0), D(O, L, "♠", "\\spadesuit", !0), D(O, L, "♤", "\\varspadesuit", !0), D(O, L, "♀", "\\female", !0), D(O, L, "♂", "\\male", !0), D(O, L, "§", "\\S", !0), D(k, L, "§", "\\S"), D(O, L, "¶", "\\P", !0), D(k, L, "¶", "\\P"), D(k, L, "☺", "\\smiley", !0), D(O, L, "☺", "\\smiley", !0), D(O, L, "†", "\\dag"), D(k, L, "†", "\\dag"), D(k, L, "†", "\\textdagger"), D(O, L, "‡", "\\ddag"), D(k, L, "‡", "\\ddag"), D(k, L, "‡", "\\textdaggerdbl"), D(O, M, "⎱", "\\rmoustache", !0), D(O, F, "⎰", "\\lmoustache", !0), D(O, M, "⟯", "\\rgroup", !0), D(O, F, "⟮", "\\lgroup", !0), D(O, j, "∓", "\\mp", !0), D(O, j, "⊖", "\\ominus", !0), D(O, j, "⊎", "\\uplus", !0), D(O, j, "⊓", "\\sqcap", !0), D(O, j, "∗", "\\ast"), D(O, j, "⊔", "\\sqcup", !0), D(O, j, "◯", "\\bigcirc", !0), D(O, j, "∙", "\\bullet", !0), D(O, j, "‡", "\\ddagger"), D(O, j, "≀", "\\wr", !0), D(O, j, "⨿", "\\amalg"), D(O, j, "&", "\\And"), D(O, j, "⫽", "\\sslash", !0), D(O, I, "⟵", "\\longleftarrow", !0), D(O, I, "⇐", "\\Leftarrow", !0), D(O, I, "⟸", "\\Longleftarrow", !0), D(O, I, "⟶", "\\longrightarrow", !0), D(O, I, "⇒", "\\Rightarrow", !0), D(O, I, "⟹", "\\Longrightarrow", !0), D(O, I, "↔", "\\leftrightarrow", !0), D(O, I, "⟷", "\\longleftrightarrow", !0), D(O, I, "⇔", "\\Leftrightarrow", !0), D(O, I, "⟺", "\\Longleftrightarrow", !0), D(O, I, "↤", "\\mapsfrom", !0), D(O, I, "↦", "\\mapsto", !0), D(O, I, "⟼", "\\longmapsto", !0), D(O, I, "↗", "\\nearrow", !0), D(O, I, "↩", "\\hookleftarrow", !0), D(O, I, "↪", "\\hookrightarrow", !0), D(O, I, "↘", "\\searrow", !0), D(O, I, "↼", "\\leftharpoonup", !0), D(O, I, "⇀", "\\rightharpoonup", !0), D(O, I, "↙", "\\swarrow", !0), D(O, I, "↽", "\\leftharpoondown", !0), D(O, I, "⇁", "\\rightharpoondown", !0), D(O, I, "↖", "\\nwarrow", !0), D(O, I, "⇌", "\\rightleftharpoons", !0), D(O, N, "↯", "\\lightning", !0), D(O, N, "∎", "\\QED", !0), D(O, N, "‰", "\\permil", !0), D(k, L, "‰", "\\permil"), D(O, N, "☉", "\\astrosun", !0), D(O, N, "☼", "\\sun", !0), D(O, N, "☾", "\\leftmoon", !0), D(O, N, "☽", "\\rightmoon", !0), D(O, N, "⊕", "\\Earth"), D(O, I, "≮", "\\nless", !0), D(O, I, "⪇", "\\lneq", !0), D(O, I, "≨", "\\lneqq", !0), D(O, I, "≨︀", "\\lvertneqq"), D(O, I, "⋦", "\\lnsim", !0), D(O, I, "⪉", "\\lnapprox", !0), D(O, I, "⊀", "\\nprec", !0), D(O, I, "⋠", "\\npreceq", !0), D(O, I, "⋨", "\\precnsim", !0), D(O, I, "⪹", "\\precnapprox", !0), D(O, I, "≁", "\\nsim", !0), D(O, I, "∤", "\\nmid", !0), D(O, I, "∤", "\\nshortmid"), D(O, I, "⊬", "\\nvdash", !0), D(O, I, "⊭", "\\nvDash", !0), D(O, I, "⋪", "\\ntriangleleft"), D(O, I, "⋬", "\\ntrianglelefteq", !0), D(O, I, "⊄", "\\nsubset", !0), D(O, I, "⊅", "\\nsupset", !0), D(O, I, "⊊", "\\subsetneq", !0), D(O, I, "⊊︀", "\\varsubsetneq"), D(O, I, "⫋", "\\subsetneqq", !0), D(O, I, "⫋︀", "\\varsubsetneqq"), D(O, I, "≯", "\\ngtr", !0), D(O, I, "⪈", "\\gneq", !0), D(O, I, "≩", "\\gneqq", !0), D(O, I, "≩︀", "\\gvertneqq"), D(O, I, "⋧", "\\gnsim", !0), D(O, I, "⪊", "\\gnapprox", !0), D(O, I, "⊁", "\\nsucc", !0), D(O, I, "⋡", "\\nsucceq", !0), D(O, I, "⋩", "\\succnsim", !0), D(O, I, "⪺", "\\succnapprox", !0), D(O, I, "≆", "\\ncong", !0), D(O, I, "∦", "\\nparallel", !0), D(O, I, "∦", "\\nshortparallel"), D(O, I, "⊯", "\\nVDash", !0), D(O, I, "⋫", "\\ntriangleright"), D(O, I, "⋭", "\\ntrianglerighteq", !0), D(O, I, "⊋", "\\supsetneq", !0), D(O, I, "⊋", "\\varsupsetneq"), D(O, I, "⫌", "\\supsetneqq", !0), D(O, I, "⫌︀", "\\varsupsetneqq"), D(O, I, "⊮", "\\nVdash", !0), D(O, I, "⪵", "\\precneqq", !0), D(O, I, "⪶", "\\succneqq", !0), D(O, j, "⊴", "\\unlhd"), D(O, j, "⊵", "\\unrhd"), D(O, I, "↚", "\\nleftarrow", !0), D(O, I, "↛", "\\nrightarrow", !0), D(O, I, "⇍", "\\nLeftarrow", !0), D(O, I, "⇏", "\\nRightarrow", !0), D(O, I, "↮", "\\nleftrightarrow", !0), D(O, I, "⇎", "\\nLeftrightarrow", !0), D(O, I, "△", "\\vartriangle"), D(O, L, "ℏ", "\\hslash"), D(O, L, "▽", "\\triangledown"), D(O, L, "◊", "\\lozenge"), D(O, L, "Ⓢ", "\\circledS"), D(O, L, "®", "\\circledR", !0), D(k, L, "®", "\\circledR"), D(k, L, "®", "\\textregistered"), D(O, L, "∡", "\\measuredangle", !0), D(O, L, "∄", "\\nexists"), D(O, L, "℧", "\\mho"), D(O, L, "Ⅎ", "\\Finv", !0), D(O, L, "⅁", "\\Game", !0), D(O, L, "‵", "\\backprime"), D(O, L, "‶", "\\backdprime"), D(O, L, "‷", "\\backtrprime"), D(O, L, "▲", "\\blacktriangle"), D(O, L, "▼", "\\blacktriangledown"), D(O, L, "■", "\\blacksquare"), D(O, L, "⧫", "\\blacklozenge"), D(O, L, "★", "\\bigstar"), D(O, L, "∢", "\\sphericalangle", !0), D(O, L, "∁", "\\complement", !0), D(O, L, "╱", "\\diagup"), D(O, L, "╲", "\\diagdown"), D(O, L, "□", "\\square"), D(O, L, "□", "\\Box"), D(O, L, "◊", "\\Diamond"), D(O, L, "¥", "\\yen", !0), D(k, L, "¥", "\\yen", !0), D(O, L, "✓", "\\checkmark", !0), D(k, L, "✓", "\\checkmark"), D(O, L, "✗", "\\ballotx", !0), D(k, L, "✗", "\\ballotx"), D(k, L, "•", "\\textbullet"), D(O, L, "ℶ", "\\beth", !0), D(O, L, "ℸ", "\\daleth", !0), D(O, L, "ℷ", "\\gimel", !0), D(O, L, "ϝ", "\\digamma", !0), D(O, L, "ϰ", "\\varkappa"), D(O, F, "⌜", "\\ulcorner", !0), D(O, M, "⌝", "\\urcorner", !0), D(O, F, "⌞", "\\llcorner", !0), D(O, M, "⌟", "\\lrcorner", !0), D(O, I, "≦", "\\leqq", !0), D(O, I, "⩽", "\\leqslant", !0), D(O, I, "⪕", "\\eqslantless", !0), D(O, I, "≲", "\\lesssim", !0), D(O, I, "⪅", "\\lessapprox", !0), D(O, I, "≊", "\\approxeq", !0), D(O, j, "⋖", "\\lessdot"), D(O, I, "⋘", "\\lll", !0), D(O, I, "≶", "\\lessgtr", !0), D(O, I, "⋚", "\\lesseqgtr", !0), D(O, I, "⪋", "\\lesseqqgtr", !0), D(O, I, "≑", "\\doteqdot"), D(O, I, "≓", "\\risingdotseq", !0), D(O, I, "≒", "\\fallingdotseq", !0), D(O, I, "∽", "\\backsim", !0), D(O, I, "⋍", "\\backsimeq", !0), D(O, I, "⫅", "\\subseteqq", !0), D(O, I, "⋐", "\\Subset", !0), D(O, I, "⊏", "\\sqsubset", !0), D(O, I, "≼", "\\preccurlyeq", !0), D(O, I, "⋞", "\\curlyeqprec", !0), D(O, I, "≾", "\\precsim", !0), D(O, I, "⪷", "\\precapprox", !0), D(O, I, "⊲", "\\vartriangleleft"), D(O, I, "⊴", "\\trianglelefteq"), D(O, I, "⊨", "\\vDash", !0), D(O, I, "⊫", "\\VDash", !0), D(O, I, "⊪", "\\Vvdash", !0), D(O, I, "⌣", "\\smallsmile"), D(O, I, "⌢", "\\smallfrown"), D(O, I, "≏", "\\bumpeq", !0), D(O, I, "≎", "\\Bumpeq", !0), D(O, I, "≧", "\\geqq", !0), D(O, I, "⩾", "\\geqslant", !0), D(O, I, "⪖", "\\eqslantgtr", !0), D(O, I, "≳", "\\gtrsim", !0), D(O, I, "⪆", "\\gtrapprox", !0), D(O, j, "⋗", "\\gtrdot"), D(O, I, "⋙", "\\ggg", !0), D(O, I, "≷", "\\gtrless", !0), D(O, I, "⋛", "\\gtreqless", !0), D(O, I, "⪌", "\\gtreqqless", !0), D(O, I, "≖", "\\eqcirc", !0), D(O, I, "≗", "\\circeq", !0), D(O, I, "≜", "\\triangleq", !0), D(O, I, "∼", "\\thicksim"), D(O, I, "≈", "\\thickapprox"), D(O, I, "⫆", "\\supseteqq", !0), D(O, I, "⋑", "\\Supset", !0), D(O, I, "⊐", "\\sqsupset", !0), D(O, I, "≽", "\\succcurlyeq", !0), D(O, I, "⋟", "\\curlyeqsucc", !0), D(O, I, "≿", "\\succsim", !0), D(O, I, "⪸", "\\succapprox", !0), D(O, I, "⊳", "\\vartriangleright"), D(O, I, "⊵", "\\trianglerighteq"), D(O, I, "⊩", "\\Vdash", !0), D(O, I, "∣", "\\shortmid"), D(O, I, "∥", "\\shortparallel"), D(O, I, "≬", "\\between", !0), D(O, I, "⋔", "\\pitchfork", !0), D(O, I, "∝", "\\varpropto"), D(O, I, "◀", "\\blacktriangleleft"), D(O, I, "∴", "\\therefore", !0), D(O, I, "∍", "\\backepsilon"), D(O, I, "▶", "\\blacktriangleright"), D(O, I, "∵", "\\because", !0), D(O, I, "⋘", "\\llless"), D(O, I, "⋙", "\\gggtr"), D(O, j, "⊲", "\\lhd"), D(O, j, "⊳", "\\rhd"), D(O, I, "≂", "\\eqsim", !0), D(O, I, "≑", "\\Doteq", !0), D(O, I, "⥽", "\\strictif", !0), D(O, I, "⥼", "\\strictfi", !0), D(O, j, "∔", "\\dotplus", !0), D(O, j, "∖", "\\smallsetminus"), D(O, j, "⋒", "\\Cap", !0), D(O, j, "⋓", "\\Cup", !0), D(O, j, "⩞", "\\doublebarwedge", !0), D(O, j, "⊟", "\\boxminus", !0), D(O, j, "⊞", "\\boxplus", !0), D(O, j, "⧄", "\\boxslash", !0), D(O, j, "⋇", "\\divideontimes", !0), D(O, j, "⋉", "\\ltimes", !0), D(O, j, "⋊", "\\rtimes", !0), D(O, j, "⋋", "\\leftthreetimes", !0), D(O, j, "⋌", "\\rightthreetimes", !0), D(O, j, "⋏", "\\curlywedge", !0), D(O, j, "⋎", "\\curlyvee", !0), D(O, j, "⊝", "\\circleddash", !0), D(O, j, "⊛", "\\circledast", !0), D(O, j, "⊺", "\\intercal", !0), D(O, j, "⋒", "\\doublecap"), D(O, j, "⋓", "\\doublecup"), D(O, j, "⊠", "\\boxtimes", !0), D(O, j, "⋈", "\\bowtie", !0), D(O, j, "⋈", "\\Join"), D(O, j, "⟕", "\\leftouterjoin", !0), D(O, j, "⟖", "\\rightouterjoin", !0), D(O, j, "⟗", "\\fullouterjoin", !0), D(O, j, "∸", "\\dotminus", !0), D(O, j, "⟑", "\\wedgedot", !0), D(O, j, "⟇", "\\veedot", !0), D(O, j, "⩢", "\\doublebarvee", !0), D(O, j, "⩣", "\\veedoublebar", !0), D(O, j, "⩟", "\\wedgebar", !0), D(O, j, "⩠", "\\wedgedoublebar", !0), D(O, j, "⩔", "\\Vee", !0), D(O, j, "⩓", "\\Wedge", !0), D(O, j, "⩃", "\\barcap", !0), D(O, j, "⩂", "\\barcup", !0), D(O, j, "⩈", "\\capbarcup", !0), D(O, j, "⩀", "\\capdot", !0), D(O, j, "⩇", "\\capovercup", !0), D(O, j, "⩆", "\\cupovercap", !0), D(O, j, "⩍", "\\closedvarcap", !0), D(O, j, "⩌", "\\closedvarcup", !0), D(O, j, "⨪", "\\minusdot", !0), D(O, j, "⨫", "\\minusfdots", !0), D(O, j, "⨬", "\\minusrdots", !0), D(O, j, "⊻", "\\Xor", !0), D(O, j, "⊼", "\\Nand", !0), D(O, j, "⊽", "\\Nor", !0), D(O, j, "⊽", "\\barvee"), D(O, j, "⫴", "\\interleave", !0), D(O, j, "⧢", "\\shuffle", !0), D(O, j, "⫶", "\\threedotcolon", !0), D(O, j, "⦂", "\\typecolon", !0), D(O, j, "∾", "\\invlazys", !0), D(O, j, "⩋", "\\twocaps", !0), D(O, j, "⩊", "\\twocups", !0), D(O, j, "⩎", "\\Sqcap", !0), D(O, j, "⩏", "\\Sqcup", !0), D(O, j, "⩖", "\\veeonvee", !0), D(O, j, "⩕", "\\wedgeonwedge", !0), D(O, j, "⧗", "\\blackhourglass", !0), D(O, j, "⧆", "\\boxast", !0), D(O, j, "⧈", "\\boxbox", !0), D(O, j, "⧇", "\\boxcircle", !0), D(O, j, "⊜", "\\circledequal", !0), D(O, j, "⦷", "\\circledparallel", !0), D(O, j, "⦶", "\\circledvert", !0), D(O, j, "⦵", "\\circlehbar", !0), D(O, j, "⟡", "\\concavediamond", !0), D(O, j, "⟢", "\\concavediamondtickleft", !0), D(O, j, "⟣", "\\concavediamondtickright", !0), D(O, j, "⋄", "\\diamond", !0), D(O, j, "⧖", "\\hourglass", !0), D(O, j, "⟠", "\\lozengeminus", !0), D(O, j, "⌽", "\\obar", !0), D(O, j, "⦸", "\\obslash", !0), D(O, j, "⨸", "\\odiv", !0), D(O, j, "⧁", "\\ogreaterthan", !0), D(O, j, "⧀", "\\olessthan", !0), D(O, j, "⦹", "\\operp", !0), D(O, j, "⨷", "\\Otimes", !0), D(O, j, "⨶", "\\otimeshat", !0), D(O, j, "⋆", "\\star", !0), D(O, j, "△", "\\triangle", !0), D(O, j, "⨺", "\\triangleminus", !0), D(O, j, "⨹", "\\triangleplus", !0), D(O, j, "⨻", "\\triangletimes", !0), D(O, j, "⟤", "\\whitesquaretickleft", !0), D(O, j, "⟥", "\\whitesquaretickright", !0), D(O, j, "⨳", "\\smashtimes", !0), D(O, I, "⇢", "\\dashrightarrow", !0), D(O, I, "⇠", "\\dashleftarrow", !0), D(O, I, "⇇", "\\leftleftarrows", !0), D(O, I, "⇆", "\\leftrightarrows", !0), D(O, I, "⇚", "\\Lleftarrow", !0), D(O, I, "↞", "\\twoheadleftarrow", !0), D(O, I, "↢", "\\leftarrowtail", !0), D(O, I, "↫", "\\looparrowleft", !0), D(O, I, "⇋", "\\leftrightharpoons", !0), D(O, I, "↶", "\\curvearrowleft", !0), D(O, I, "↺", "\\circlearrowleft", !0), D(O, I, "↰", "\\Lsh", !0), D(O, I, "⇈", "\\upuparrows", !0), D(O, I, "↿", "\\upharpoonleft", !0), D(O, I, "⇃", "\\downharpoonleft", !0), D(O, I, "⊶", "\\origof", !0), D(O, I, "⊷", "\\imageof", !0), D(O, I, "⊸", "\\multimap", !0), D(O, I, "↭", "\\leftrightsquigarrow", !0), D(O, I, "⇉", "\\rightrightarrows", !0), D(O, I, "⇄", "\\rightleftarrows", !0), D(O, I, "↠", "\\twoheadrightarrow", !0), D(O, I, "↣", "\\rightarrowtail", !0), D(O, I, "↬", "\\looparrowright", !0), D(O, I, "↷", "\\curvearrowright", !0), D(O, I, "↻", "\\circlearrowright", !0), D(O, I, "↱", "\\Rsh", !0), D(O, I, "⇊", "\\downdownarrows", !0), D(O, I, "↾", "\\upharpoonright", !0), D(O, I, "⇂", "\\downharpoonright", !0), D(O, I, "⇝", "\\rightsquigarrow", !0), D(O, I, "⇝", "\\leadsto"), D(O, I, "⇛", "\\Rrightarrow", !0), D(O, I, "↾", "\\restriction"), D(O, L, "‘", "`"), D(O, L, "$", "\\$"), D(k, L, "$", "\\$"), D(k, L, "$", "\\textdollar"), D(O, L, "¢", "\\cent"), D(k, L, "¢", "\\cent"), D(O, L, "%", "\\%"), D(k, L, "%", "\\%"), D(O, L, "_", "\\_"), D(k, L, "_", "\\_"), D(k, L, "_", "\\textunderscore"), D(k, L, "␣", "\\textvisiblespace", !0), D(O, L, "∠", "\\angle", !0), D(O, L, "∞", "\\infty", !0), D(O, L, "′", "\\prime"), D(O, L, "″", "\\dprime"), D(O, L, "‴", "\\trprime"), D(O, L, "⁗", "\\qprime"), D(O, L, "△", "\\triangle"), D(k, L, "Α", "\\Alpha", !0), D(k, L, "Β", "\\Beta", !0), D(k, L, "Γ", "\\Gamma", !0), D(k, L, "Δ", "\\Delta", !0), D(k, L, "Ε", "\\Epsilon", !0), D(k, L, "Ζ", "\\Zeta", !0), D(k, L, "Η", "\\Eta", !0), D(k, L, "Θ", "\\Theta", !0), D(k, L, "Ι", "\\Iota", !0), D(k, L, "Κ", "\\Kappa", !0), D(k, L, "Λ", "\\Lambda", !0), D(k, L, "Μ", "\\Mu", !0), D(k, L, "Ν", "\\Nu", !0), D(k, L, "Ξ", "\\Xi", !0), D(k, L, "Ο", "\\Omicron", !0), D(k, L, "Π", "\\Pi", !0), D(k, L, "Ρ", "\\Rho", !0), D(k, L, "Σ", "\\Sigma", !0), D(k, L, "Τ", "\\Tau", !0), D(k, L, "Υ", "\\Upsilon", !0), D(k, L, "Φ", "\\Phi", !0), D(k, L, "Χ", "\\Chi", !0), D(k, L, "Ψ", "\\Psi", !0), D(k, L, "Ω", "\\Omega", !0), D(O, N, "Α", "\\Alpha", !0), D(O, N, "Β", "\\Beta", !0), D(O, N, "Γ", "\\Gamma", !0), D(O, N, "Δ", "\\Delta", !0), D(O, N, "Ε", "\\Epsilon", !0), D(O, N, "Ζ", "\\Zeta", !0), D(O, N, "Η", "\\Eta", !0), D(O, N, "Θ", "\\Theta", !0), D(O, N, "Ι", "\\Iota", !0), D(O, N, "Κ", "\\Kappa", !0), D(O, N, "Λ", "\\Lambda", !0), D(O, N, "Μ", "\\Mu", !0), D(O, N, "Ν", "\\Nu", !0), D(O, N, "Ξ", "\\Xi", !0), D(O, N, "Ο", "\\Omicron", !0), D(O, N, "Π", "\\Pi", !0), D(O, N, "Ρ", "\\Rho", !0), D(O, N, "Σ", "\\Sigma", !0), D(O, N, "Τ", "\\Tau", !0), D(O, N, "Υ", "\\Upsilon", !0), D(O, N, "Φ", "\\Phi", !0), D(O, N, "Χ", "\\Chi", !0), D(O, N, "Ψ", "\\Psi", !0), D(O, N, "Ω", "\\Omega", !0), D(O, F, "¬", "\\neg", !0), D(O, F, "¬", "\\lnot"), D(O, L, "⊤", "\\top"), D(O, L, "⊥", "\\bot"), D(O, L, "∅", "\\emptyset"), D(O, L, "⌀", "\\varnothing"), D(O, N, "α", "\\alpha", !0), D(O, N, "β", "\\beta", !0), D(O, N, "γ", "\\gamma", !0), D(O, N, "δ", "\\delta", !0), D(O, N, "ϵ", "\\epsilon", !0), D(O, N, "ζ", "\\zeta", !0), D(O, N, "η", "\\eta", !0), D(O, N, "θ", "\\theta", !0), D(O, N, "ι", "\\iota", !0), D(O, N, "κ", "\\kappa", !0), D(O, N, "λ", "\\lambda", !0), D(O, N, "μ", "\\mu", !0), D(O, N, "ν", "\\nu", !0), D(O, N, "ξ", "\\xi", !0), D(O, N, "ο", "\\omicron", !0), D(O, N, "π", "\\pi", !0), D(O, N, "ρ", "\\rho", !0), D(O, N, "σ", "\\sigma", !0), D(O, N, "τ", "\\tau", !0), D(O, N, "υ", "\\upsilon", !0), D(O, N, "ϕ", "\\phi", !0), D(O, N, "χ", "\\chi", !0), D(O, N, "ψ", "\\psi", !0), D(O, N, "ω", "\\omega", !0), D(O, N, "ε", "\\varepsilon", !0), D(O, N, "ϑ", "\\vartheta", !0), D(O, N, "ϖ", "\\varpi", !0), D(O, N, "ϱ", "\\varrho", !0), D(O, N, "ς", "\\varsigma", !0), D(O, N, "φ", "\\varphi", !0), D(O, N, "Ϙ", "\\Coppa", !0), D(O, N, "ϙ", "\\coppa", !0), D(O, N, "ϙ", "\\varcoppa", !0), D(O, N, "Ϟ", "\\Koppa", !0), D(O, N, "ϟ", "\\koppa", !0), D(O, N, "Ϡ", "\\Sampi", !0), D(O, N, "ϡ", "\\sampi", !0), D(O, N, "Ϛ", "\\Stigma", !0), D(O, N, "ϛ", "\\stigma", !0), D(O, N, "⫫", "\\Bot"), D(O, L, "ð", "\\eth", !0), D(k, L, "ð", "ð"), D(O, L, "Å", "\\AA"), D(k, L, "Å", "\\AA", !0), D(O, L, "Æ", "\\AE", !0), D(k, L, "Æ", "\\AE", !0), D(O, L, "Ð", "\\DH", !0), D(k, L, "Ð", "\\DH", !0), D(O, L, "Þ", "\\TH", !0), D(k, L, "Þ", "\\TH", !0), D(O, L, "ß", "\\ss", !0), D(k, L, "ß", "\\ss", !0), D(O, L, "å", "\\aa"), D(k, L, "å", "\\aa", !0), D(O, L, "æ", "\\ae", !0), D(k, L, "æ", "\\ae", !0), D(O, L, "ð", "\\dh"), D(k, L, "ð", "\\dh", !0), D(O, L, "þ", "\\th", !0), D(k, L, "þ", "\\th", !0), D(O, L, "Đ", "\\DJ", !0), D(k, L, "Đ", "\\DJ", !0), D(O, L, "đ", "\\dj", !0), D(k, L, "đ", "\\dj", !0), D(O, L, "Ł", "\\L", !0), D(k, L, "Ł", "\\L", !0), D(O, L, "Ł", "\\l", !0), D(k, L, "Ł", "\\l", !0), D(O, L, "Ŋ", "\\NG", !0), D(k, L, "Ŋ", "\\NG", !0), D(O, L, "ŋ", "\\ng", !0), D(k, L, "ŋ", "\\ng", !0), D(O, L, "Œ", "\\OE", !0), D(k, L, "Œ", "\\OE", !0), D(O, L, "œ", "\\oe", !0), D(k, L, "œ", "\\oe", !0), D(O, j, "∗", "∗", !0), D(O, j, "+", "+"), D(O, j, "∗", "*"), D(O, j, "⁄", "/", !0), D(O, j, "⁄", "⁄"), D(O, j, "−", "-", !0), D(O, j, "⋅", "\\cdot", !0), D(O, j, "∘", "\\circ", !0), D(O, j, "÷", "\\div", !0), D(O, j, "±", "\\pm", !0), D(O, j, "×", "\\times", !0), D(O, j, "∩", "\\cap", !0), D(O, j, "∪", "\\cup", !0), D(O, j, "∖", "\\setminus", !0), D(O, j, "∧", "\\land"), D(O, j, "∨", "\\lor"), D(O, j, "∧", "\\wedge", !0), D(O, j, "∨", "\\vee", !0), D(O, F, "⟦", "\\llbracket", !0), D(O, M, "⟧", "\\rrbracket", !0), D(O, F, "⟨", "\\langle", !0), D(O, F, "⟪", "\\lAngle", !0), D(O, F, "⦉", "\\llangle", !0), D(O, F, "|", "\\lvert"), D(O, F, "‖", "\\lVert", !0), D(O, L, "!", "\\oc"), D(O, L, "?", "\\wn"), D(O, L, "↓", "\\shpos"), D(O, L, "↕", "\\shift"), D(O, L, "↑", "\\shneg"), D(O, M, "?", "?"), D(O, M, "!", "!"), D(O, M, "‼", "‼"), D(O, M, "⟩", "\\rangle", !0), D(O, M, "⟫", "\\rAngle", !0), D(O, M, "⦊", "\\rrangle", !0), D(O, M, "|", "\\rvert"), D(O, M, "‖", "\\rVert"), D(O, F, "⦃", "\\lBrace", !0), D(O, M, "⦄", "\\rBrace", !0), D(O, I, "=", "\\equal", !0), D(O, I, ":", ":"), D(O, I, "≈", "\\approx", !0), D(O, I, "≅", "\\cong", !0), D(O, I, "≥", "\\ge"), D(O, I, "≥", "\\geq", !0), D(O, I, "←", "\\gets"), D(O, I, ">", "\\gt", !0), D(O, I, "∈", "\\in", !0), D(O, I, "∉", "\\notin", !0), D(O, I, "", "\\@not"), D(O, I, "⊂", "\\subset", !0), D(O, I, "⊃", "\\supset", !0), D(O, I, "⊆", "\\subseteq", !0), D(O, I, "⊇", "\\supseteq", !0), D(O, I, "⊈", "\\nsubseteq", !0), D(O, I, "⊈", "\\nsubseteqq"), D(O, I, "⊉", "\\nsupseteq", !0), D(O, I, "⊉", "\\nsupseteqq"), D(O, I, "⊨", "\\models"), D(O, I, "←", "\\leftarrow", !0), D(O, I, "≤", "\\le"), D(O, I, "≤", "\\leq", !0), D(O, I, "<", "\\lt", !0), D(O, I, "→", "\\rightarrow", !0), D(O, I, "→", "\\to"), D(O, I, "≱", "\\ngeq", !0), D(O, I, "≱", "\\ngeqq"), D(O, I, "≱", "\\ngeqslant"), D(O, I, "≰", "\\nleq", !0), D(O, I, "≰", "\\nleqq"), D(O, I, "≰", "\\nleqslant"), D(O, I, "⫫", "\\Perp", !0), D(O, Ue, "\xA0", "\\ "), D(O, Ue, "\xA0", "\\space"), D(O, Ue, "\xA0", "\\nobreakspace"), D(k, Ue, "\xA0", "\\ "), D(k, Ue, "\xA0", " "), D(k, Ue, "\xA0", "\\space"), D(k, Ue, "\xA0", "\\nobreakspace"), D(O, Ue, null, "\\nobreak"), D(O, Ue, null, "\\allowbreak"), D(O, He, ",", ","), D(k, He, ":", ":"), D(O, He, ";", ";"), D(O, j, "⊼", "\\barwedge"), D(O, j, "⊻", "\\veebar"), D(O, j, "⊙", "\\odot", !0), D(O, j, "⊕︎", "\\oplus"), D(O, j, "⊗", "\\otimes", !0), D(O, L, "∂", "\\partial", !0), D(O, j, "⊘", "\\oslash", !0), D(O, j, "⊚", "\\circledcirc", !0), D(O, j, "⊡", "\\boxdot", !0), D(O, j, "△", "\\bigtriangleup"), D(O, j, "▽", "\\bigtriangledown"), D(O, j, "†", "\\dagger"), D(O, j, "⋄", "\\diamond"), D(O, j, "◃", "\\triangleleft"), D(O, j, "▹", "\\triangleright"), D(O, F, "{", "\\{"), D(k, L, "{", "\\{"), D(k, L, "{", "\\textbraceleft"), D(O, M, "}", "\\}"), D(k, L, "}", "\\}"), D(k, L, "}", "\\textbraceright"), D(O, F, "{", "\\lbrace"), D(O, M, "}", "\\rbrace"), D(O, F, "[", "\\lbrack", !0), D(k, L, "[", "\\lbrack", !0), D(O, M, "]", "\\rbrack", !0), D(k, L, "]", "\\rbrack", !0), D(O, F, "(", "\\lparen", !0), D(O, M, ")", "\\rparen", !0), D(O, F, "⦇", "\\llparenthesis", !0), D(O, M, "⦈", "\\rrparenthesis", !0), D(k, L, "<", "\\textless", !0), D(k, L, ">", "\\textgreater", !0), D(O, F, "⌊", "\\lfloor", !0), D(O, M, "⌋", "\\rfloor", !0), D(O, F, "⌈", "\\lceil", !0), D(O, M, "⌉", "\\rceil", !0), D(O, L, "\\", "\\backslash"), D(O, L, "|", "|"), D(O, L, "|", "\\vert"), D(k, L, "|", "\\textbar", !0), D(O, L, "‖", "\\|"), D(O, L, "‖", "\\Vert"), D(k, L, "‖", "\\textbardbl"), D(k, L, "~", "\\textasciitilde"), D(k, L, "\\", "\\textbackslash"), D(k, L, "^", "\\textasciicircum"), D(O, I, "↑", "\\uparrow", !0), D(O, I, "⇑", "\\Uparrow", !0), D(O, I, "↓", "\\downarrow", !0), D(O, I, "⇓", "\\Downarrow", !0), D(O, I, "↕", "\\updownarrow", !0), D(O, I, "⇕", "\\Updownarrow", !0), D(O, P, "∐", "\\coprod"), D(O, P, "⋁", "\\bigvee"), D(O, P, "⋀", "\\bigwedge"), D(O, P, "⨄", "\\biguplus"), D(O, P, "⨄", "\\bigcupplus"), D(O, P, "⨃", "\\bigcupdot"), D(O, P, "⨇", "\\bigdoublevee"), D(O, P, "⨈", "\\bigdoublewedge"), D(O, P, "⋂", "\\bigcap"), D(O, P, "⋃", "\\bigcup"), D(O, P, "∫", "\\int"), D(O, P, "∫", "\\intop"), D(O, P, "∬", "\\iint"), D(O, P, "∭", "\\iiint"), D(O, P, "∏", "\\prod"), D(O, P, "∑", "\\sum"), D(O, P, "⨂", "\\bigotimes"), D(O, P, "⨁", "\\bigoplus"), D(O, P, "⨀", "\\bigodot"), D(O, P, "⨉", "\\bigtimes"), D(O, P, "∮", "\\oint"), D(O, P, "∯", "\\oiint"), D(O, P, "∰", "\\oiiint"), D(O, P, "∱", "\\intclockwise"), D(O, P, "∲", "\\varointclockwise"), D(O, P, "⨌", "\\iiiint"), D(O, P, "⨍", "\\intbar"), D(O, P, "⨎", "\\intBar"), D(O, P, "⨏", "\\fint"), D(O, P, "⨒", "\\rppolint"), D(O, P, "⨓", "\\scpolint"), D(O, P, "⨕", "\\pointint"), D(O, P, "⨖", "\\sqint"), D(O, P, "⨗", "\\intlarhk"), D(O, P, "⨘", "\\intx"), D(O, P, "⨙", "\\intcap"), D(O, P, "⨚", "\\intcup"), D(O, P, "⨅", "\\bigsqcap"), D(O, P, "⨆", "\\bigsqcup"), D(O, P, "∫", "\\smallint"), D(k, Ve, "…", "\\textellipsis"), D(O, Ve, "…", "\\mathellipsis"), D(k, Ve, "…", "\\ldots", !0), D(O, Ve, "…", "\\ldots", !0), D(O, Ve, "⋰", "\\iddots", !0), D(O, Ve, "⋯", "\\@cdots", !0), D(O, Ve, "⋱", "\\ddots", !0), D(O, L, "⋮", "\\varvdots"), D(k, L, "⋮", "\\varvdots"), D(O, A, "´", "\\acute"), D(O, A, "`", "\\grave"), D(O, A, "¨", "\\ddot"), D(O, A, "…", "\\dddot"), D(O, A, "….", "\\ddddot"), D(O, A, "~", "\\tilde"), D(O, A, "‾", "\\bar"), D(O, A, "˘", "\\breve"), D(O, A, "ˇ", "\\check"), D(O, A, "^", "\\hat"), D(O, A, "→", "\\vec"), D(O, A, "˙", "\\dot"), D(O, A, "˚", "\\mathring"), D(O, N, "ı", "\\imath", !0), D(O, N, "ȷ", "\\jmath", !0), D(O, L, "ı", "ı"), D(O, L, "ȷ", "ȷ"), D(k, L, "ı", "\\i", !0), D(k, L, "ȷ", "\\j", !0), D(k, L, "ø", "\\o", !0), D(O, N, "ø", "\\o", !0), D(k, L, "Ø", "\\O", !0), D(O, N, "Ø", "\\O", !0), D(k, A, "ˊ", "\\'"), D(k, A, "ˋ", "\\`"), D(k, A, "ˆ", "\\^"), D(k, A, "~", "\\~"), D(k, A, "ˉ", "\\="), D(k, A, "˘", "\\u"), D(k, A, "˙", "\\."), D(k, A, "¸", "\\c"), D(k, A, "˚", "\\r"), D(k, A, "ˇ", "\\v"), D(k, A, "¨", "\\\""), D(k, A, "˝", "\\H"), D(O, A, "ˊ", "\\'"), D(O, A, "ˋ", "\\`"), D(O, A, "ˆ", "\\^"), D(O, A, "~", "\\~"), D(O, A, "ˉ", "\\="), D(O, A, "˘", "\\u"), D(O, A, "˙", "\\."), D(O, A, "¸", "\\c"), D(O, A, "˚", "\\r"), D(O, A, "ˇ", "\\v"), D(O, A, "¨", "\\\""), D(O, A, "˝", "\\H");
var We = {
	"--": !0,
	"---": !0,
	"``": !0,
	"''": !0
};
D(k, L, "–", "--", !0), D(k, L, "–", "\\textendash"), D(k, L, "—", "---", !0), D(k, L, "—", "\\textemdash"), D(k, L, "‘", "`", !0), D(k, L, "‘", "\\textquoteleft"), D(k, L, "’", "'", !0), D(k, L, "’", "\\textquoteright"), D(k, L, "“", "``", !0), D(k, L, "“", "\\textquotedblleft"), D(k, L, "”", "''", !0), D(k, L, "”", "\\textquotedblright"), D(O, L, "°", "\\degree", !0), D(k, L, "°", "\\degree"), D(k, L, "°", "\\textdegree", !0), D(O, L, "£", "\\pounds"), D(O, L, "£", "\\mathsterling", !0), D(k, L, "£", "\\pounds"), D(k, L, "£", "\\textsterling", !0), D(O, L, "✠", "\\maltese"), D(k, L, "✠", "\\maltese"), D(O, L, "€", "\\euro", !0), D(k, L, "€", "\\euro", !0), D(k, L, "€", "\\texteuro"), D(O, L, "©", "\\copyright", !0), D(k, L, "©", "\\textcopyright"), D(O, L, "⌀", "\\diameter", !0), D(k, L, "⌀", "\\diameter"), D(O, L, "𝛤", "\\varGamma"), D(O, L, "𝛥", "\\varDelta"), D(O, L, "𝛩", "\\varTheta"), D(O, L, "𝛬", "\\varLambda"), D(O, L, "𝛯", "\\varXi"), D(O, L, "𝛱", "\\varPi"), D(O, L, "𝛴", "\\varSigma"), D(O, L, "𝛶", "\\varUpsilon"), D(O, L, "𝛷", "\\varPhi"), D(O, L, "𝛹", "\\varPsi"), D(O, L, "𝛺", "\\varOmega"), D(k, L, "𝛤", "\\varGamma"), D(k, L, "𝛥", "\\varDelta"), D(k, L, "𝛩", "\\varTheta"), D(k, L, "𝛬", "\\varLambda"), D(k, L, "𝛯", "\\varXi"), D(k, L, "𝛱", "\\varPi"), D(k, L, "𝛴", "\\varSigma"), D(k, L, "𝛶", "\\varUpsilon"), D(k, L, "𝛷", "\\varPhi"), D(k, L, "𝛹", "\\varPsi"), D(k, L, "𝛺", "\\varOmega");
var Ge = "0123456789/@.\"";
for (let e = 0; e < 14; e++) {
	let t = Ge.charAt(e);
	D(O, L, t, t);
}
var Ke = "0123456789!@*()-=+\";:?/.,";
for (let e = 0; e < 25; e++) {
	let t = Ke.charAt(e);
	D(k, L, t, t);
}
var qe = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
for (let e = 0; e < 52; e++) {
	let t = qe.charAt(e);
	D(O, N, t, t), D(k, L, t, t);
}
var Je = "ÇÐÞçþℂℍℕℙℚℝℤℎℏℊℋℌℐℑℒℓ℘ℛℜℬℰℱℳℭℨ";
for (let e = 0; e < 30; e++) {
	let t = Je.charAt(e);
	D(O, N, t, t), D(k, L, t, t);
}
var R = "";
for (let e = 0; e < 52; e++) {
	R = String.fromCharCode(55349, 56320 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56372 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56424 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56580 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56736 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56788 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56840 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56944 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 56632 + e), D(O, N, R, R), D(k, L, R, R);
	let t = qe.charAt(e);
	R = String.fromCharCode(55349, 56476 + e), D(O, N, t, R), D(k, L, t, R);
}
for (let e = 0; e < 10; e++) R = String.fromCharCode(55349, 57294 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 57314 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 57324 + e), D(O, N, R, R), D(k, L, R, R), R = String.fromCharCode(55349, 57334 + e), D(O, N, R, R), D(k, L, R, R);
function Ye(e, t, n) {
	let r = [], i = [], a = [], o = 0, s = 0;
	for (; s < e.length;) {
		for (; e[s] instanceof Ce;) e.splice(s, 1, ...e[s].children);
		let n = e[s];
		if (n.attributes && n.attributes.linebreak && n.attributes.linebreak === "newline") {
			a.length > 0 && i.push(new w("mrow", a)), i.push(n), a = [];
			let e = new w("mtd", i);
			e.style.textAlign = "left", r.push(new w("mtr", [e])), i = [], s += 1;
			continue;
		}
		if (a.push(n), n.type && n.type === "mo" && n.children.length === 1 && !(n.attributes.form && n.attributes.form === "prefix") && !Object.prototype.hasOwnProperty.call(n.attributes, "movablelimits")) {
			let r = n.children[0].text;
			if (t === "=" && r === "=") {
				if (o += 1, o > 1) {
					a.pop();
					let e = new w("mrow", a);
					i.push(e), a = [n];
				}
			} else if (t === "tex") {
				let t = s < e.length - 1 ? e[s + 1] : null, n = !0;
				if (!(t && t.type === "mtext" && t.attributes.linebreak && t.attributes.linebreak === "nobreak")) for (let t = s + 1; t < e.length; t++) {
					let r = e[t];
					if (r.type && r.type === "mspace" && !(r.attributes.linebreak && r.attributes.linebreak === "newline")) a.push(r), s += 1, r.attributes && r.attributes.linebreak && r.attributes.linebreak === "nobreak" && (n = !1);
					else break;
				}
				if (n) {
					let e = new w("mrow", a);
					i.push(e), a = [];
				}
			}
		}
		s += 1;
	}
	if (a.length > 0) {
		let e = new w("mrow", a);
		i.push(e);
	}
	if (r.length > 0) {
		let e = new w("mtd", i);
		e.style.textAlign = "left";
		let t = new w("mtr", [e]);
		r.push(t);
		let a = new w("mtable", r);
		return n || (a.setAttribute("columnalign", "left"), a.setAttribute("rowspacing", "0em")), a;
	}
	return Me(i);
}
var z = function(e, t, n) {
	return E[t][e] && E[t][e].replace && e.charCodeAt(0) !== 55349 && !(Object.prototype.hasOwnProperty.call(We, e) && n && (n.fontFamily && n.fontFamily.slice(4, 6) === "tt" || n.font && n.font.slice(4, 6) === "tt")) && (e = E[t][e].replace), new T(e);
}, Xe = (e, t) => {
	if (e.children.length === 0 || e.children[e.children.length - 1].type !== "mtext") {
		let n = new w("mtext", [new T(t.children[0].text)]);
		e.children.push(n);
	} else e.children[e.children.length - 1].children[0].text += t.children[0].text;
}, Ze = (e) => {
	if (e.type !== "mrow" && e.type !== "mstyle" || e.children.length === 0) return e;
	let t = new w("mrow");
	for (let n = 0; n < e.children.length; n++) {
		let r = e.children[n];
		if (r.type === "mtext" && Object.keys(r.attributes).length === 0) Xe(t, r);
		else if (r.type === "mrow") {
			let e = !0;
			for (let t = 0; t < r.children.length; t++) if (r.children[t].type !== "mtext" || Object.keys(r.attributes).length !== 0) {
				e = !1;
				break;
			}
			if (e) for (let e = 0; e < r.children.length; e++) {
				let n = r.children[e];
				Xe(t, n);
			}
			else t.children.push(r);
		} else t.children.push(r);
	}
	for (let n = 0; n < t.children.length; n++) if (t.children[n].type === "mtext") {
		let r = t.children[n];
		r.children[0].text.charAt(0) === " " && (r.children[0].text = "\xA0" + r.children[0].text.slice(1));
		let i = r.children[0].text.length;
		i > 0 && r.children[0].text.charAt(i - 1) === " " && (r.children[0].text = r.children[0].text.slice(0, -1) + "\xA0");
		for (let [t, n] of Object.entries(e.attributes)) r.attributes[t] = n;
	}
	return t.children.length === 1 && t.children[0].type === "mtext" ? t.children[0] : t;
}, Qe = function(e, t = !1) {
	if (e.length === 1 && !(e[0] instanceof Ce)) return e[0];
	if (!t) {
		e[0] instanceof w && e[0].type === "mo" && !e[0].attributes.fence && (e[0].attributes.lspace = "0em", e[0].attributes.rspace = "0em");
		let t = e.length - 1;
		e[t] instanceof w && e[t].type === "mo" && !e[t].attributes.fence && (e[t].attributes.lspace = "0em", e[t].attributes.rspace = "0em");
	}
	return new w("mrow", e);
};
function $e(e) {
	if (!e) return !1;
	if (e.type === "mi" && e.children.length === 1) {
		let t = e.children[0];
		return t instanceof T && t.text === ".";
	} else if (e.type === "mtext" && e.children.length === 1) {
		let t = e.children[0];
		return t instanceof T && t.text === " ";
	} else if (e.type === "mo" && e.children.length === 1 && e.getAttribute("separator") === "true" && e.getAttribute("lspace") === "0em" && e.getAttribute("rspace") === "0em") {
		let t = e.children[0];
		return t instanceof T && t.text === ",";
	} else return !1;
}
var et = (e, t) => {
	let n = e[t], r = e[t + 1];
	return n.type === "atom" && n.text === "," && n.loc && r.loc && n.loc.end === r.loc.start;
}, tt = (e) => e.type === "atom" && e.family === "rel" || e.type === "mclass" && e.mclass === "mrel", B = function(e, t, n = !1) {
	if (!n && e.length === 1) {
		let n = V(e[0], t);
		return n instanceof w && n.type === "mo" && (n.setAttribute("lspace", "0em"), n.setAttribute("rspace", "0em")), [n];
	}
	let r = [], i = [], a;
	for (let n = 0; n < e.length; n++) i.push(V(e[n], t));
	for (let t = 0; t < i.length; t++) {
		let n = i[t];
		if (t < e.length - 1 && tt(e[t]) && tt(e[t + 1]) && n.setAttribute("rspace", "0em"), t > 0 && tt(e[t]) && tt(e[t - 1]) && n.setAttribute("lspace", "0em"), n.type === "mn" && a && a.type === "mn") {
			a.children.push(...n.children);
			continue;
		} else if ($e(n) && a && a.type === "mn") {
			a.children.push(...n.children);
			continue;
		} else if (a && a.type === "mn" && t < i.length - 1 && i[t + 1].type === "mn" && et(e, t)) {
			a.children.push(...n.children);
			continue;
		} else if (n.type === "mn" && $e(a)) n.children = [...a.children, ...n.children], r.pop();
		else if ((n.type === "msup" || n.type === "msub") && n.children.length >= 1 && a && (a.type === "mn" || $e(a))) {
			let e = n.children[0];
			e instanceof w && e.type === "mn" && a && (e.children = [...a.children, ...e.children], r.pop());
		}
		r.push(n), a = n;
	}
	return r;
}, nt = function(e, t, n = !1) {
	return Qe(B(e, t, n), n);
}, V = function(e, t) {
	if (!e) return new w("mrow");
	if (be[e.type]) return be[e.type](e, t);
	throw new b("Got group of unknown type: '" + e.type + "'");
}, rt = (e) => new w("mtd", [], [], {
	padding: "0",
	width: "50%"
}), it = [
	"mrow",
	"mtd",
	"mtable",
	"mtr"
], at = (e) => {
	for (let t of e.children) if (t.type && it.includes(t.type)) {
		if (t.classes && t.classes[0] === "tml-label") return t.label;
		{
			let e = at(t);
			if (e) return e;
		}
	} else if (!t.type) {
		let e = at(t);
		if (e) return e;
	}
}, ot = (e, t, n, r) => {
	t = nt(t[0].body, n), t = Ze(t), t.classes.push("tml-tag");
	let i = at(e);
	e = new w("mtd", [e]);
	let a = [
		rt(),
		e,
		rt()
	];
	a[r ? 0 : 2].children.push(t);
	let o = new w("mtr", a, ["tml-tageqn"]);
	i && o.setAttribute("id", i);
	let s = new w("mtable", [o]);
	return s.style.width = "100%", s.setAttribute("displaystyle", "true"), s;
};
function st(e, t, n, r) {
	let i = null;
	e.length === 1 && e[0].type === "tag" && (i = e[0].tag, e = e[0].body);
	let a = B(e, n);
	if (a.length === 1 && a[0] instanceof Ae) return a[0];
	let o = r.displayMode || r.annotate ? "none" : r.wrap, s = a.length === 0 ? null : a[0], c = a.length === 1 && i === null && s instanceof w ? a[0] : Ye(a, o, r.displayMode);
	if (i && (c = ot(c, i, n, r.leqno)), r.annotate) {
		let e = new w("annotation", [new T(t)]);
		e.setAttribute("encoding", "application/x-tex"), c = new w("semantics", [c, e]);
	}
	let l = new w("math", [c]);
	return r.xml && l.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML"), r.displayMode && (l.setAttribute("display", "block"), l.style.display = "block math", l.classes = ["tml-display"]), l;
}
var ct = "DHKLUcegorsuvxyzΠΥΨαδηιμνοτυχϵ", lt = "BCEGIMNOPQRSTXZlpqtwΓΘΞΣΦΩβεζθξρςφψϑϕϱ", ut = "AFJdfΔΛ", dt = (e, t) => {
	let n = e.isStretchy ? Re(e) : new w("mo", [z(e.label, e.mode)]);
	e.isStretchy || n.setAttribute("stretchy", "false"), e.label !== "\\vec" && (n.style.mathDepth = "0");
	let r = e.label === "\\c" ? "munder" : "mover", i = pt.has(e.label);
	if (r === "mover" && e.mode === "math" && !e.isStretchy && e.base.text && e.base.text.length === 1) {
		let t = e.base.text, r = e.label === "\\vec", a = r === "\\vec" ? "-vec" : "";
		r && n.classes.push("tml-vec");
		let o = r ? "-vec" : i ? "-acc" : "";
		ct.indexOf(t) > -1 ? (n.classes.push(`chr-sml${a}`), n.classes.push(`wbk-sml${o}`)) : lt.indexOf(t) > -1 ? (n.classes.push(`chr-med${a}`), n.classes.push(`wbk-med${o}`)) : ut.indexOf(t) > -1 ? (n.classes.push(`chr-lrg${a}`), n.classes.push(`wbk-lrg${o}`)) : r ? n.classes.push("wbk-vec") : i && n.classes.push("wbk-acc");
	} else i && n.classes.push("wbk-acc");
	return new w(r, [V(e.base, t), n]);
}, ft = new Set([
	"\\acute",
	"\\check",
	"\\grave",
	"\\ddot",
	"\\dddot",
	"\\ddddot",
	"\\tilde",
	"\\bar",
	"\\breve",
	"\\check",
	"\\hat",
	"\\vec",
	"\\dot",
	"\\mathring"
]), pt = new Set([
	"\\acute",
	"\\bar",
	"\\breve",
	"\\check",
	"\\dot",
	"\\ddot",
	"\\grave",
	"\\hat",
	"\\mathring",
	"\\`",
	"\\'",
	"\\^",
	"\\=",
	"\\u",
	"\\.",
	"\\\"",
	"\\r",
	"\\H",
	"\\v"
]), mt = {
	"\\`": "̀",
	"\\'": "́",
	"\\^": "̂",
	"\\~": "̃",
	"\\=": "̄",
	"\\u": "̆",
	"\\.": "̇",
	"\\\"": "̈",
	"\\r": "̊",
	"\\H": "̋",
	"\\v": "̌",
	"\\c": "̧"
};
S({
	type: "accent",
	names: [
		"\\acute",
		"\\grave",
		"\\ddot",
		"\\dddot",
		"\\ddddot",
		"\\tilde",
		"\\bar",
		"\\breve",
		"\\check",
		"\\hat",
		"\\vec",
		"\\dot",
		"\\mathring",
		"\\overparen",
		"\\widecheck",
		"\\widehat",
		"\\wideparen",
		"\\widetilde",
		"\\overrightarrow",
		"\\overleftarrow",
		"\\Overrightarrow",
		"\\overleftrightarrow",
		"\\overgroup",
		"\\overleftharpoon",
		"\\overrightharpoon"
	],
	props: { numArgs: 1 },
	handler: (e, t) => {
		let n = Se(t[0]), r = !ft.has(e.funcName);
		return {
			type: "accent",
			mode: e.parser.mode,
			label: e.funcName,
			isStretchy: r,
			base: n
		};
	},
	mathmlBuilder: dt
}), S({
	type: "accent",
	names: [
		"\\'",
		"\\`",
		"\\^",
		"\\~",
		"\\=",
		"\\c",
		"\\u",
		"\\.",
		"\\\"",
		"\\r",
		"\\H",
		"\\v"
	],
	props: {
		numArgs: 1,
		allowedInText: !0,
		allowedInMath: !0,
		argTypes: ["primitive"]
	},
	handler: (e, t) => {
		let n = Se(t[0]), r = e.parser.mode;
		return r === "math" && e.parser.settings.strict && console.log(`Temml parse error: Command ${e.funcName} is invalid in math mode.`), r === "text" && n.text && n.text.length === 1 && e.funcName in mt && _e.indexOf(n.text) > -1 ? {
			type: "textord",
			mode: "text",
			text: n.text + mt[e.funcName]
		} : e.funcName === "\\c" && r === "text" && n.text && n.text.length === 1 ? {
			type: "textord",
			mode: "text",
			text: n.text + "̧"
		} : {
			type: "accent",
			mode: r,
			label: e.funcName,
			isStretchy: !1,
			base: n
		};
	},
	mathmlBuilder: dt
}), S({
	type: "accentUnder",
	names: [
		"\\underleftarrow",
		"\\underrightarrow",
		"\\underleftrightarrow",
		"\\undergroup",
		"\\underparen",
		"\\utilde"
	],
	props: { numArgs: 1 },
	handler: ({ parser: e, funcName: t }, n) => {
		let r = n[0];
		return {
			type: "accentUnder",
			mode: e.mode,
			label: t,
			base: r
		};
	},
	mathmlBuilder: (e, t) => {
		let n = Re(e);
		return n.style["math-depth"] = 0, new w("munder", [V(e.base, t), n]);
	}
});
var ht = {
	pt: 800 / 803,
	pc: 12 * 800 / 803,
	dd: 1238 / 1157 * 800 / 803,
	cc: 14856 / 1157 * 800 / 803,
	nd: 685 / 642 * 800 / 803,
	nc: 1370 / 107 * 800 / 803,
	sp: 1 / 65536 * 800 / 803,
	mm: 25.4 / 72,
	cm: 2.54 / 72,
	in: 1 / 72,
	px: 96 / 72
}, gt = [
	"em",
	"ex",
	"mu",
	"pt",
	"mm",
	"cm",
	"in",
	"px",
	"bp",
	"pc",
	"dd",
	"cc",
	"nd",
	"nc",
	"sp"
], _t = function(e) {
	return typeof e != "string" && (e = e.unit), gt.indexOf(e) > -1;
}, vt = (e) => [
	1,
	.7,
	.5
][Math.max(e - 1, 0)], yt = function(e, t) {
	let n = e.number;
	if (t.maxSize[0] < 0 && n > 0) return {
		number: 0,
		unit: "em"
	};
	let r = e.unit;
	switch (r) {
		case "mm":
		case "cm":
		case "in":
		case "px": return n * ht[r] > t.maxSize[1] ? {
			number: t.maxSize[1],
			unit: "pt"
		} : {
			number: n,
			unit: r
		};
		case "em":
		case "ex": return r === "ex" && (n *= .431), n = Math.min(n / vt(t.level), t.maxSize[0]), {
			number: ge(n),
			unit: "em"
		};
		case "bp": return n > t.maxSize[1] && (n = t.maxSize[1]), {
			number: n,
			unit: "pt"
		};
		case "pt":
		case "pc":
		case "dd":
		case "cc":
		case "nd":
		case "nc":
		case "sp": return n = Math.min(n * ht[r], t.maxSize[1]), {
			number: ge(n),
			unit: "pt"
		};
		case "mu": return n = Math.min(n / 18, t.maxSize[0]), {
			number: ge(n),
			unit: "em"
		};
		default: throw new b("Invalid unit: '" + r + "'");
	}
}, H = (e) => {
	let t = new w("mspace");
	return t.setAttribute("width", e + "em"), t;
}, bt = (e, t = .3, n = 0, r = !1) => {
	if (e == null && n === 0) return H(t);
	let i = e ? [e] : [];
	if (t !== 0 && i.unshift(H(t)), n > 0 && i.push(H(n)), r) {
		let e = new w("mpadded", i);
		return e.setAttribute("height", "0.1px"), e;
	} else return new w("mrow", i);
}, xt = (e, t) => Number(e) / vt(t), St = (e, t, n, r) => {
	let i = Ie(e), a = e.slice(1, 3) === "eq", o = e.charAt(1) === "x" ? "1.75" : e.slice(2, 4) === "cd" ? "3.0" : a ? "1.0" : "2.0";
	i.setAttribute("lspace", "0"), i.setAttribute("rspace", a ? "0.5em" : "0");
	let s = r.withLevel(r.level < 2 ? 2 : 3), c = xt(o, s.level), l = xt(o, 3), u = bt(null, c.toFixed(4), 0), d = bt(null, l.toFixed(4), 0), f = xt(a ? 0 : .3, s.level).toFixed(4), p, m, h = t && t.body && (t.body.body || t.body.length > 0);
	if (h) {
		let n = V(t, s);
		n = bt(n, f, f, e === "\\\\cdrightarrow" || e === "\\\\cdleftarrow"), p = new w("mover", [n, d]);
	}
	let g = n && n.body && (n.body.body || n.body.length > 0);
	if (g) {
		let e = V(n, s);
		e = bt(e, f, f), m = new w("munder", [e, d]);
	}
	let _;
	return _ = !h && !g ? new w("mover", [i, u]) : h && g ? new w("munderover", [
		i,
		m,
		p
	]) : h ? new w("mover", [i, p]) : new w("munder", [i, m]), o === "3.0" && (_.style.height = "1em"), _.setAttribute("accent", "false"), _;
};
S({
	type: "xArrow",
	names: /* @__PURE__ */ "\\xleftarrow.\\xrightarrow.\\xLeftarrow.\\xRightarrow.\\xleftrightarrow.\\xLeftrightarrow.\\xhookleftarrow.\\xhookrightarrow.\\xmapsto.\\xrightharpoondown.\\xrightharpoonup.\\xleftharpoondown.\\xleftharpoonup.\\xlongequal.\\xtwoheadrightarrow.\\xtwoheadleftarrow.\\xtofrom.\\xleftrightharpoons.\\xrightleftharpoons.\\yields.\\yieldsLeft.\\mesomerism.\\longrightharpoonup.\\longleftharpoondown.\\yieldsLeftRight.\\chemequilibrium.\\\\cdrightarrow.\\\\cdleftarrow.\\\\cdlongequal".split("."),
	props: {
		numArgs: 1,
		numOptionalArgs: 1
	},
	handler({ parser: e, funcName: t }, n, r) {
		return {
			type: "xArrow",
			mode: e.mode,
			name: t,
			body: n[0],
			below: r[0]
		};
	},
	mathmlBuilder(e, t) {
		let n = [St(e.name, e.body, e.below, t)];
		return n.unshift(H(.2778)), n.push(H(.2778)), new w("mrow", n);
	}
});
var Ct = {
	"\\equilibriumRight": ["\\longrightharpoonup", "\\eqleftharpoondown"],
	"\\equilibriumLeft": ["\\eqrightharpoonup", "\\longleftharpoondown"]
};
S({
	type: "stackedArrow",
	names: ["\\equilibriumRight", "\\equilibriumLeft"],
	props: {
		numArgs: 1,
		numOptionalArgs: 1
	},
	handler({ parser: e, funcName: t }, n, r) {
		let i = n[0] ? {
			type: "hphantom",
			mode: e.mode,
			body: n[0]
		} : null, a = r[0] ? {
			type: "hphantom",
			mode: e.mode,
			body: r[0]
		} : null;
		return {
			type: "stackedArrow",
			mode: e.mode,
			name: t,
			body: n[0],
			upperArrowBelow: a,
			lowerArrowBody: i,
			below: r[0]
		};
	},
	mathmlBuilder(e, t) {
		let n = Ct[e.name][0], r = Ct[e.name][1], i = St(n, e.body, e.upperArrowBelow, t), a = St(r, e.lowerArrowBody, e.below, t), o, s = new w("mpadded", [i]);
		if (s.setAttribute("voffset", "0.3em"), s.setAttribute("height", "+0.3em"), s.setAttribute("depth", "-0.3em"), e.name === "\\equilibriumLeft") {
			let e = new w("mpadded", [a]);
			e.setAttribute("width", "0.5em"), o = new w("mpadded", [
				H(.2778),
				e,
				s,
				H(.2778)
			]);
		} else s.setAttribute("width", e.name === "\\equilibriumRight" ? "0.5em" : "0"), o = new w("mpadded", [
			H(.2778),
			s,
			a,
			H(.2778)
		]);
		return o.setAttribute("voffset", "-0.18em"), o.setAttribute("height", "-0.18em"), o.setAttribute("depth", "+0.18em"), o;
	}
});
var wt = {};
function U({ type: e, names: t, props: n, handler: r, mathmlBuilder: i }) {
	let a = {
		type: e,
		numArgs: n.numArgs || 0,
		allowedInText: !1,
		numOptionalArgs: 0,
		handler: r
	};
	for (let e = 0; e < t.length; ++e) wt[t[e]] = a;
	i && (be[e] = i);
}
function W(e, t) {
	if (!e || e.type !== t) throw Error(`Expected node of type ${t}, but got ` + (e ? `node of type ${e.type}` : String(e)));
	return e;
}
function Tt(e) {
	let t = Et(e);
	if (!t) throw Error("Expected node of symbol group type, but got " + (e ? `node of type ${e.type}` : String(e)));
	return t;
}
function Et(e) {
	return e && (e.type === "atom" || e.type === "delimiter" || Object.prototype.hasOwnProperty.call(Be, e.type)) ? e : null;
}
var Dt = {
	">": "\\\\cdrightarrow",
	"<": "\\\\cdleftarrow",
	"=": "\\\\cdlongequal",
	A: "\\uparrow",
	V: "\\downarrow",
	"|": "\\Vert",
	".": "no arrow"
}, Ot = () => ({
	type: "styling",
	body: [],
	mode: "math",
	scriptLevel: "display"
}), kt = (e) => e.type === "textord" && e.text === "@", At = (e, t) => (e.type === "mathord" || e.type === "atom") && e.text === t;
function jt(e, t, n) {
	let r = Dt[e];
	switch (r) {
		case "\\\\cdrightarrow":
		case "\\\\cdleftarrow": return n.callFunction(r, [t[0]], [t[1]]);
		case "\\uparrow":
		case "\\downarrow": {
			let e = n.callFunction("\\\\cdleft", [t[0]], []), i = {
				type: "atom",
				text: r,
				mode: "math",
				family: "rel"
			}, a = {
				type: "ordgroup",
				mode: "math",
				body: [
					e,
					n.callFunction("\\Big", [i], []),
					n.callFunction("\\\\cdright", [t[1]], [])
				],
				semisimple: !0
			};
			return n.callFunction("\\\\cdparent", [a], []);
		}
		case "\\\\cdlongequal": return n.callFunction("\\\\cdlongequal", [], []);
		case "\\Vert": return n.callFunction("\\Big", [{
			type: "textord",
			text: "\\Vert",
			mode: "math"
		}], []);
		default: return {
			type: "textord",
			text: " ",
			mode: "math"
		};
	}
}
function Mt(e) {
	let t = [];
	for (e.gullet.beginGroup(), e.gullet.macros.set("\\cr", "\\\\\\relax"), e.gullet.beginGroup();;) {
		t.push(e.parseExpression(!1, "\\\\")), e.gullet.endGroup(), e.gullet.beginGroup();
		let n = e.fetch().text;
		if (n === "&" || n === "\\\\") e.consume();
		else if (n === "\\end") {
			t[t.length - 1].length === 0 && t.pop();
			break;
		} else throw new b("Expected \\\\ or \\cr or \\end", e.nextToken);
	}
	let n = [], r = [n];
	for (let i = 0; i < t.length; i++) {
		let a = t[i], o = Ot();
		for (let t = 0; t < a.length; t++) if (!kt(a[t])) o.body.push(a[t]);
		else {
			n.push(o), t += 1;
			let r = Tt(a[t]).text, i = [, ,];
			if (i[0] = {
				type: "ordgroup",
				mode: "math",
				body: []
			}, i[1] = {
				type: "ordgroup",
				mode: "math",
				body: []
			}, !("=|.".indexOf(r) > -1)) if ("<>AV".indexOf(r) > -1) for (let e = 0; e < 2; e++) {
				let n = !0;
				for (let o = t + 1; o < a.length; o++) {
					if (At(a[o], r)) {
						n = !1, t = o;
						break;
					}
					if (kt(a[o])) throw new b("Missing a " + r + " character to complete a CD arrow.", a[o]);
					i[e].body.push(a[o]);
				}
				if (n) throw new b("Missing a " + r + " character to complete a CD arrow.", a[t]);
			}
			else throw new b("Expected one of \"<>AV=|.\" after @.");
			let s = jt(r, i, e);
			n.push(s), o = Ot();
		}
		i % 2 == 0 ? n.push(o) : n.shift(), n = [], r.push(n);
	}
	return r.pop(), e.gullet.endGroup(), e.gullet.endGroup(), {
		type: "array",
		mode: "math",
		body: r,
		tags: null,
		labels: Array(r.length + 1).fill(""),
		envClasses: ["jot", "cd"],
		cols: [],
		hLinesBeforeRow: Array(r.length + 1).fill([])
	};
}
S({
	type: "cdlabel",
	names: ["\\\\cdleft", "\\\\cdright"],
	props: { numArgs: 1 },
	handler({ parser: e, funcName: t }, n) {
		return {
			type: "cdlabel",
			mode: e.mode,
			side: t.slice(4),
			label: n[0]
		};
	},
	mathmlBuilder(e, t) {
		if (e.label.body.length === 0) return new w("mrow", t);
		let n = V(e.label, t);
		e.side === "left" && n.classes.push("tml-shift-left");
		let r = new w("mtd", [n]);
		r.style.padding = "0";
		let i = new w("mpadded", [new w("mtable", [new w("mtr", [r])])]);
		return i.setAttribute("width", "0.1px"), i.setAttribute("displaystyle", "false"), i.setAttribute("scriptlevel", "1"), i;
	}
}), S({
	type: "cdlabelparent",
	names: ["\\\\cdparent"],
	props: { numArgs: 1 },
	handler({ parser: e }, t) {
		return {
			type: "cdlabelparent",
			mode: e.mode,
			fragment: t[0]
		};
	},
	mathmlBuilder(e, t) {
		return new w("mrow", [V(e.fragment, t)]);
	}
});
var Nt = (e) => ({
	type: "ordgroup",
	mode: "math",
	body: e,
	semisimple: !0
}), Pt = (e, t) => ({
	type: t,
	mode: "math",
	body: Nt(e)
}), Ft = (e, t) => {
	let n = e.body;
	n[0].shift();
	let r = Array(n.length - 1).fill().map(() => []);
	for (let e = 1; e < n.length; e++) {
		r[e - 1].push(n[e].shift());
		let t = [];
		for (let r = 0; r < n[e].length; r++) t.push(n[e][r]);
		r[e - 1].push(Pt(t, "vphantom"));
	}
	let i = Array(n.length).fill().map(() => []);
	for (let e = 0; e < n[0].length; e++) i[0].push(n[0][e]);
	for (let e = 1; e < n.length; e++) for (let t = 0; t < n[0].length; t++) i[e].push(Pt(n[e][t].body, "hphantom"));
	for (let e = 0; e < n[0].length; e++) n[0][e] = Pt(n[0][e].body, "hphantom");
	let a = {
		type: "array",
		mode: "math",
		body: r,
		cols: [{
			type: "align",
			align: "c"
		}],
		rowGaps: Array(r.length - 1).fill(null),
		hLinesBeforeRow: Array(r.length + 1).fill().map(() => []),
		envClasses: [],
		scriptLevel: "text",
		arraystretch: 1,
		labels: Array(r.length).fill(""),
		arraycolsep: {
			number: .04,
			unit: "em"
		}
	}, o = {
		type: "styling",
		mode: "math",
		scriptLevel: "text",
		body: [{
			type: "array",
			mode: "math",
			body: i,
			cols: Array(i.length).fill({
				type: "align",
				align: "c"
			}),
			rowGaps: Array(i.length - 1).fill(null),
			hLinesBeforeRow: Array(i.length + 1).fill().map(() => []),
			envClasses: [],
			scriptLevel: "text",
			arraystretch: 1,
			labels: Array(i.length).fill(""),
			arraycolsep: null
		}]
	};
	return Nt([a, {
		type: "supsub",
		mode: "math",
		stack: !0,
		base: {
			type: "op",
			mode: "math",
			limits: !0,
			alwaysHandleSupSub: !0,
			parentIsSupSub: !0,
			symbol: !1,
			suppressBaseShift: !0,
			body: [{
				type: "leftright",
				mode: "math",
				body: [e],
				left: t ? t[0] : "(",
				right: t ? t[1] : ")",
				rightColor: void 0
			}]
		},
		sup: o,
		sub: null
	}]);
}, G = class e {
	constructor(e, t, n) {
		this.lexer = e, this.start = t, this.end = n;
	}
	static range(t, n) {
		return n ? !t || !t.loc || !n.loc || t.loc.lexer !== n.loc.lexer ? null : new e(t.loc.lexer, t.loc.start, n.loc.end) : t && t.loc;
	}
}, It = class e {
	constructor(e, t) {
		this.text = e, this.loc = t;
	}
	range(t, n) {
		return new e(n, G.range(this, t));
	}
}, K = {
	DISPLAY: 0,
	TEXT: 1,
	SCRIPT: 2,
	SCRIPTSCRIPT: 3
}, Lt = {};
function q(e, t) {
	Lt[e] = t;
}
var Rt = Lt;
q("\\noexpand", function(e) {
	let t = e.popToken();
	return e.isExpandable(t.text) && (t.noexpand = !0, t.treatAsRelax = !0), {
		tokens: [t],
		numArgs: 0
	};
}), q("\\expandafter", function(e) {
	let t = e.popToken();
	return e.expandOnce(!0), {
		tokens: [t],
		numArgs: 0
	};
}), q("\\@firstoftwo", function(e) {
	return {
		tokens: e.consumeArgs(2)[0],
		numArgs: 0
	};
}), q("\\@secondoftwo", function(e) {
	return {
		tokens: e.consumeArgs(2)[1],
		numArgs: 0
	};
}), q("\\@ifnextchar", function(e) {
	let t = e.consumeArgs(3);
	e.consumeSpaces();
	let n = e.future();
	return t[0].length === 1 && t[0][0].text === n.text ? {
		tokens: t[1],
		numArgs: 0
	} : {
		tokens: t[2],
		numArgs: 0
	};
}), q("\\@ifstar", "\\@ifnextchar *{\\@firstoftwo{#1}}"), q("\\TextOrMath", function(e) {
	let t = e.consumeArgs(2);
	return e.mode === "text" ? {
		tokens: t[0],
		numArgs: 0
	} : {
		tokens: t[1],
		numArgs: 0
	};
});
var zt = (e) => {
	let t = "";
	for (let n = e.length - 1; n > -1; n--) t += e[n].text;
	return t;
}, Bt = {
	0: 0,
	1: 1,
	2: 2,
	3: 3,
	4: 4,
	5: 5,
	6: 6,
	7: 7,
	8: 8,
	9: 9,
	a: 10,
	A: 10,
	b: 11,
	B: 11,
	c: 12,
	C: 12,
	d: 13,
	D: 13,
	e: 14,
	E: 14,
	f: 15,
	F: 15
}, Vt = (e) => {
	let t = e.future().text;
	return t === "EOF" ? [null, ""] : [Bt[t.charAt(0)], t];
}, Ht = (e, t, n) => {
	for (let r = 1; r < t.length; r++) {
		let i = Bt[t.charAt(r)];
		e *= n, e += i;
	}
	return e;
};
q("\\char", function(e) {
	let t = e.popToken(), n, r = "";
	if (t.text === "'") n = 8, t = e.popToken();
	else if (t.text === "\"") n = 16, t = e.popToken();
	else if (t.text === "`") if (t = e.popToken(), t.text[0] === "\\") r = t.text.charCodeAt(1);
	else if (t.text === "EOF") throw new b("\\char` missing argument");
	else r = t.text.charCodeAt(0);
	else n = 10;
	if (n) {
		let i = t.text;
		if (r = Bt[i.charAt(0)], r == null || r >= n) throw new b(`Invalid base-${n} digit ${t.text}`);
		r = Ht(r, i, n);
		let a;
		for ([a, i] = Vt(e); a != null && a < n;) r *= n, r += a, r = Ht(r, i, n), e.popToken(), [a, i] = Vt(e);
	}
	return `\\@char{${r}}`;
});
function Ut(e) {
	let t = e.consumeArgs(1)[0], n = "", r = t[t.length - 1].loc.start;
	for (let e = t.length - 1; e >= 0; e--) {
		let i = t[e].loc.start;
		i > r && (n += " ", r = i), n += t[e].text, r += t[e].text.length;
	}
	return n;
}
q("\\surd", "\\sqrt{\\vphantom{|}}"), q("⊕", "\\oplus"), q("\\long", ""), q("\\bgroup", "{"), q("\\egroup", "}"), q("~", "\\nobreakspace"), q("\\lq", "`"), q("\\rq", "'"), q("\\aa", "\\r a"), q("\\Bbbk", "\\Bbb{k}"), q("\\mathstrut", "\\vphantom{(}"), q("\\underbar", "\\underline{\\text{#1}}"), q("\\vdots", "{\\varvdots\\rule{0pt}{15pt}}"), q("⋮", "\\vdots"), q("\\arraystretch", "1"), q("\\arraycolsep", "6pt"), q("\\substack", "\\begin{subarray}{c}#1\\end{subarray}"), q("\\iff", "\\DOTSB\\;\\Longleftrightarrow\\;"), q("\\implies", "\\DOTSB\\;\\Longrightarrow\\;"), q("\\impliedby", "\\DOTSB\\;\\Longleftarrow\\;");
var Wt = {
	",": "\\dotsc",
	"\\not": "\\dotsb",
	"+": "\\dotsb",
	"=": "\\dotsb",
	"<": "\\dotsb",
	">": "\\dotsb",
	"-": "\\dotsb",
	"*": "\\dotsb",
	":": "\\dotsb",
	"\\DOTSB": "\\dotsb",
	"\\coprod": "\\dotsb",
	"\\bigvee": "\\dotsb",
	"\\bigwedge": "\\dotsb",
	"\\biguplus": "\\dotsb",
	"\\bigcap": "\\dotsb",
	"\\bigcup": "\\dotsb",
	"\\prod": "\\dotsb",
	"\\sum": "\\dotsb",
	"\\bigotimes": "\\dotsb",
	"\\bigoplus": "\\dotsb",
	"\\bigodot": "\\dotsb",
	"\\bigsqcap": "\\dotsb",
	"\\bigsqcup": "\\dotsb",
	"\\bigtimes": "\\dotsb",
	"\\And": "\\dotsb",
	"\\longrightarrow": "\\dotsb",
	"\\Longrightarrow": "\\dotsb",
	"\\longleftarrow": "\\dotsb",
	"\\Longleftarrow": "\\dotsb",
	"\\longleftrightarrow": "\\dotsb",
	"\\Longleftrightarrow": "\\dotsb",
	"\\mapsto": "\\dotsb",
	"\\longmapsto": "\\dotsb",
	"\\hookrightarrow": "\\dotsb",
	"\\doteq": "\\dotsb",
	"\\mathbin": "\\dotsb",
	"\\mathrel": "\\dotsb",
	"\\relbar": "\\dotsb",
	"\\Relbar": "\\dotsb",
	"\\xrightarrow": "\\dotsb",
	"\\xleftarrow": "\\dotsb",
	"\\DOTSI": "\\dotsi",
	"\\int": "\\dotsi",
	"\\oint": "\\dotsi",
	"\\iint": "\\dotsi",
	"\\iiint": "\\dotsi",
	"\\iiiint": "\\dotsi",
	"\\DOTSX": "\\dotsx"
};
q("\\dots", function(e) {
	let t = "\\dotso", n = e.expandAfterFuture().text;
	return n in Wt ? t = Wt[n] : (n.slice(0, 4) === "\\not" || n in E.math && ["bin", "rel"].includes(E.math[n].group)) && (t = "\\dotsb"), t;
});
var Gt = {
	")": !0,
	"]": !0,
	"\\rbrack": !0,
	"\\}": !0,
	"\\rbrace": !0,
	"\\rangle": !0,
	"\\rceil": !0,
	"\\rfloor": !0,
	"\\rgroup": !0,
	"\\rmoustache": !0,
	"\\right": !0,
	"\\bigr": !0,
	"\\biggr": !0,
	"\\Bigr": !0,
	"\\Biggr": !0,
	$: !0,
	";": !0,
	".": !0,
	",": !0
};
q("\\dotso", function(e) {
	return e.future().text in Gt ? "\\ldots\\," : "\\ldots";
}), q("\\dotsc", function(e) {
	let t = e.future().text;
	return t in Gt && t !== "," ? "\\ldots\\," : "\\ldots";
}), q("\\cdots", function(e) {
	return e.future().text in Gt ? "\\@cdots\\," : "\\@cdots";
}), q("\\dotsb", "\\cdots"), q("\\dotsm", "\\cdots"), q("\\dotsi", "\\!\\cdots"), q("\\idotsint", "\\int\\!\\cdots\\!\\int"), q("\\dotsx", "\\ldots\\,"), q("\\DOTSI", "\\relax"), q("\\DOTSB", "\\relax"), q("\\DOTSX", "\\relax"), q("\\tmspace", "\\TextOrMath{\\kern#1#3}{\\mskip#1#2}\\relax"), q("\\,", "{\\tmspace+{3mu}{.1667em}}"), q("\\thinspace", "\\,"), q("\\>", "\\mskip{4mu}"), q("\\:", "{\\tmspace+{4mu}{.2222em}}"), q("\\medspace", "\\:"), q("\\;", "{\\tmspace+{5mu}{.2777em}}"), q("\\thickspace", "\\;"), q("\\!", "{\\tmspace-{3mu}{.1667em}}"), q("\\negthinspace", "\\!"), q("\\negmedspace", "{\\tmspace-{4mu}{.2222em}}"), q("\\negthickspace", "{\\tmspace-{5mu}{.277em}}"), q("\\enspace", "\\kern.5em "), q("\\enskip", "\\hskip.5em\\relax"), q("\\quad", "\\hskip1em\\relax"), q("\\qquad", "\\hskip2em\\relax"), q("\\AA", "\\TextOrMath{\\Angstrom}{\\mathring{A}}\\relax"), q("\\tag", "\\@ifstar\\tag@literal\\tag@paren"), q("\\tag@paren", "\\tag@literal{({#1})}"), q("\\tag@literal", (e) => {
	if (e.macros.get("\\df@tag")) throw new b("Multiple \\tag");
	return "\\gdef\\df@tag{\\text{#1}}";
}), q("\\notag", "\\nonumber"), q("\\nonumber", "\\gdef\\@eqnsw{0}"), q("\\bmod", "\\mathbin{\\text{mod}}"), q("\\pod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)"), q("\\pmod", "\\pod{{\\rm mod}\\mkern6mu#1}"), q("\\mod", "\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1"), q("\\newline", "\\\\\\relax"), q("\\TeX", "\\textrm{T}\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125em\\textrm{X}"), q("\\LaTeX", "\\textrm{L}\\kern-.35em\\raisebox{0.2em}{\\scriptstyle A}\\kern-.15em\\TeX"), q("\\Temml", "\\textrm{T}\\kern-0.2em\\lower{0.2em}{\\textrm{E}}\\kern-0.08em{\\textrm{M}\\kern-0.08em\\raise{0.2em}\\textrm{M}\\kern-0.08em\\textrm{L}}"), q("\\hspace", "\\@ifstar\\@hspacer\\@hspace"), q("\\@hspace", "\\hskip #1\\relax"), q("\\@hspacer", "\\rule{0pt}{0pt}\\hskip #1\\relax"), q("\\colon", "\\mathpunct{\\char\"3a}"), q("\\prescript", "\\pres@cript{_{#1}^{#2}}{}{#3}"), q("\\ordinarycolon", "\\char\"3a"), q("\\vcentcolon", "\\mathrel{\\raisebox{0.035em}{\\ordinarycolon}}"), q("\\coloneq", "\\mathrel{\\raisebox{0.035em}{\\ordinarycolon}\\char\"2212}"), q("\\Coloneq", "\\mathrel{\\char\"2237\\char\"2212}"), q("\\Eqqcolon", "\\mathrel{\\char\"3d\\char\"2237}"), q("\\Eqcolon", "\\mathrel{\\char\"2212\\char\"2237}"), q("\\colonapprox", "\\mathrel{\\raisebox{0.035em}{\\ordinarycolon}\\char\"2248}"), q("\\Colonapprox", "\\mathrel{\\char\"2237\\char\"2248}"), q("\\colonsim", "\\mathrel{\\raisebox{0.035em}{\\ordinarycolon}\\char\"223c}"), q("\\Colonsim", "\\mathrel{\\raisebox{0.035em}{\\ordinarycolon}\\char\"223c}"), q("\\ratio", "\\vcentcolon"), q("\\coloncolon", "\\dblcolon"), q("\\colonequals", "\\coloneqq"), q("\\coloncolonequals", "\\Coloneqq"), q("\\equalscolon", "\\eqqcolon"), q("\\equalscoloncolon", "\\Eqqcolon"), q("\\colonminus", "\\coloneq"), q("\\coloncolonminus", "\\Coloneq"), q("\\minuscolon", "\\eqcolon"), q("\\minuscoloncolon", "\\Eqcolon"), q("\\coloncolonapprox", "\\Colonapprox"), q("\\coloncolonsim", "\\Colonsim"), q("\\notni", "\\mathrel{\\char`∌}"), q("\\limsup", "\\DOTSB\\operatorname*{lim\\,sup}"), q("\\liminf", "\\DOTSB\\operatorname*{lim\\,inf}"), q("\\injlim", "\\DOTSB\\operatorname*{inj\\,lim}"), q("\\projlim", "\\DOTSB\\operatorname*{proj\\,lim}"), q("\\varlimsup", "\\DOTSB\\operatorname*{\\overline{\\text{lim}}}"), q("\\varliminf", "\\DOTSB\\operatorname*{\\underline{\\text{lim}}}"), q("\\varinjlim", "\\DOTSB\\operatorname*{\\underrightarrow{\\text{lim}}}"), q("\\varprojlim", "\\DOTSB\\operatorname*{\\underleftarrow{\\text{lim}}}"), q("\\centerdot", "{\\medspace\\rule{0.167em}{0.189em}\\medspace}"), q("\\argmin", "\\DOTSB\\operatorname*{arg\\,min}"), q("\\argmax", "\\DOTSB\\operatorname*{arg\\,max}"), q("\\plim", "\\DOTSB\\operatorname*{plim}"), q("\\leftmodels", "\\mathop{\\reflectbox{$\\models$}}"), q("\\bra", "\\mathinner{\\langle{#1}|}"), q("\\ket", "\\mathinner{|{#1}\\rangle}"), q("\\braket", "\\mathinner{\\langle{#1}\\rangle}"), q("\\Bra", "\\left\\langle#1\\right|"), q("\\Ket", "\\left|#1\\right\\rangle");
var Kt = (e, t) => {
	let n = `}\\,\\middle${t[0] === "|" ? "\\vert" : "\\Vert"}\\,{`;
	return e.slice(0, t.index) + n + e.slice(t.index + t[0].length);
};
q("\\Braket", function(e) {
	let t = Ut(e), n = /\|\||\||\\\|/g, r;
	for (; (r = n.exec(t)) !== null;) t = Kt(t, r);
	return "\\left\\langle{" + t + "}\\right\\rangle";
}), q("\\Set", function(e) {
	let t = Ut(e), n = /\|\||\||\\\|/.exec(t);
	return n && (t = Kt(t, n)), "\\left\\{\\:{" + t + "}\\:\\right\\}";
}), q("\\set", function(e) {
	return "\\{{" + Ut(e).replace(/\|/, "}\\mid{") + "}\\}";
}), q("\\angln", "{\\angl n}"), q("\\odv", "\\@ifstar\\odv@next\\odv@numerator"), q("\\odv@numerator", "\\frac{\\mathrm{d}#1}{\\mathrm{d}#2}"), q("\\odv@next", "\\frac{\\mathrm{d}}{\\mathrm{d}#2}#1"), q("\\pdv", "\\@ifstar\\pdv@next\\pdv@numerator");
var qt = (e) => {
	let t = e[0][0].text, n = zt(e[1]).split(","), r = String(n.length), i = r === "1" ? "\\partial" : `\\partial^${r}`, a = "";
	return n.map((e) => {
		a += "\\partial " + e.trim() + "\\,";
	}), [
		t,
		i,
		a.replace(/\\,$/, "")
	];
};
q("\\pdv@numerator", function(e) {
	let [t, n, r] = qt(e.consumeArgs(2));
	return `\\frac{${n} ${t}}{${r}}`;
}), q("\\pdv@next", function(e) {
	let [t, n, r] = qt(e.consumeArgs(2));
	return `\\frac{${n}}{${r}} ${t}`;
}), q("\\upalpha", "\\up@greek{\\alpha}"), q("\\upbeta", "\\up@greek{\\beta}"), q("\\upgamma", "\\up@greek{\\gamma}"), q("\\updelta", "\\up@greek{\\delta}"), q("\\upepsilon", "\\up@greek{\\epsilon}"), q("\\upzeta", "\\up@greek{\\zeta}"), q("\\upeta", "\\up@greek{\\eta}"), q("\\uptheta", "\\up@greek{\\theta}"), q("\\upiota", "\\up@greek{\\iota}"), q("\\upkappa", "\\up@greek{\\kappa}"), q("\\uplambda", "\\up@greek{\\lambda}"), q("\\upmu", "\\up@greek{\\mu}"), q("\\upnu", "\\up@greek{\\nu}"), q("\\upxi", "\\up@greek{\\xi}"), q("\\upomicron", "\\up@greek{\\omicron}"), q("\\uppi", "\\up@greek{\\pi}"), q("\\upalpha", "\\up@greek{\\alpha}"), q("\\uprho", "\\up@greek{\\rho}"), q("\\upsigma", "\\up@greek{\\sigma}"), q("\\uptau", "\\up@greek{\\tau}"), q("\\upupsilon", "\\up@greek{\\upsilon}"), q("\\upphi", "\\up@greek{\\phi}"), q("\\upchi", "\\up@greek{\\chi}"), q("\\uppsi", "\\up@greek{\\psi}"), q("\\upomega", "\\up@greek{\\omega}"), q("\\invamp", "\\mathbin{\\char\"214b}"), q("\\parr", "\\mathbin{\\char\"214b}"), q("\\upand", "\\mathbin{\\char\"214b}"), q("\\with", "\\mathbin{\\char\"26}"), q("\\multimapinv", "\\mathrel{\\char\"27dc}"), q("\\multimapboth", "\\mathrel{\\char\"29df}"), q("\\scoh", "{\\mkern5mu\\char\"2322\\mkern5mu}"), q("\\sincoh", "{\\mkern5mu\\char\"2323\\mkern5mu}"), q("\\coh", "{\\mkern5mu\\rule{}{0.7em}\\mathrlap{\\smash{\\raise2mu{\\char\"2322}}}\n{\\smash{\\lower4mu{\\char\"2323}}}\\mkern5mu}"), q("\\incoh", "{\\mkern5mu\\rule{}{0.7em}\\mathrlap{\\smash{\\raise2mu{\\char\"2323}}}\n{\\smash{\\lower4mu{\\char\"2322}}}\\mkern5mu}"), q("\\standardstate", "\\text{\\tiny\\char`⦵}"), q("\\ce", function(e) {
	return Jt(e.consumeArgs(1)[0], "ce");
}), q("\\pu", function(e) {
	return Jt(e.consumeArgs(1)[0], "pu");
}), q("\\uniDash", "{\\rule{0.672em}{0.06em}}"), q("\\triDash", "{\\rule{0.15em}{0.06em}\\kern2mu\\rule{0.15em}{0.06em}\\kern2mu\\rule{0.15em}{0.06em}}"), q("\\tripleDash", "\\kern0.075em\\raise0.25em{\\triDash}\\kern0.075em"), q("\\tripleDashOverLine", "\\kern0.075em\\mathrlap{\\raise0.125em{\\uniDash}}\\raise0.34em{\\triDash}\\kern0.075em"), q("\\tripleDashOverDoubleLine", "\\kern0.075em\\mathrlap{\\mathrlap{\\raise0.48em{\\triDash}}\\raise0.27em{\\uniDash}}{\\raise0.05em{\\uniDash}}\\kern0.075em"), q("\\tripleDashBetweenDoubleLine", "\\kern0.075em\\mathrlap{\\mathrlap{\\raise0.48em{\\uniDash}}\\raise0.27em{\\triDash}}{\\raise0.05em{\\uniDash}}\\kern0.075em");
var Jt = function(e, t) {
	for (var n = "", r = e.length && e[e.length - 1].loc.start, i = e.length - 1; i >= 0; i--) e[i].loc.start > r && (n += " ", r = e[i].loc.start), n += e[i].text, r += e[i].text.length;
	return Y.go(J.go(n, t));
}, J = {
	go: function(e, t) {
		if (!e) return [];
		t === void 0 && (t = "ce");
		var n = "0", r = {};
		r.parenthesisLevel = 0, e = e.replace(/\n/g, " "), e = e.replace(/[\u2212\u2013\u2014\u2010]/g, "-"), e = e.replace(/[\u2026]/g, "...");
		for (var i, a = 10, o = [];;) {
			i === e ? a-- : (a = 10, i = e);
			var s = J.stateMachines[t], c = s.transitions[n] || s.transitions["*"];
			iterateTransitions: for (var l = 0; l < c.length; l++) {
				var u = J.patterns.match_(c[l].pattern, e);
				if (u) {
					for (var d = c[l].task, f = 0; f < d.action_.length; f++) {
						var p;
						if (s.actions[d.action_[f].type_]) p = s.actions[d.action_[f].type_](r, u.match_, d.action_[f].option);
						else if (J.actions[d.action_[f].type_]) p = J.actions[d.action_[f].type_](r, u.match_, d.action_[f].option);
						else throw ["MhchemBugA", "mhchem bug A. Please report. (" + d.action_[f].type_ + ")"];
						J.concatArray(o, p);
					}
					if (n = d.nextState || n, e.length > 0) {
						if (d.revisit || (e = u.remainder), !d.toContinue) break iterateTransitions;
					} else return o;
				}
			}
			if (a <= 0) throw ["MhchemBugU", "mhchem bug U. Please report."];
		}
	},
	concatArray: function(e, t) {
		if (t) if (Array.isArray(t)) for (var n = 0; n < t.length; n++) e.push(t[n]);
		else e.push(t);
	},
	patterns: {
		patterns: {
			empty: /^$/,
			else: /^./,
			else2: /^./,
			space: /^\s/,
			"space A": /^\s(?=[A-Z\\$])/,
			space$: /^\s$/,
			"a-z": /^[a-z]/,
			x: /^x/,
			x$: /^x$/,
			i$: /^i$/,
			letters: /^(?:[a-zA-Z\u03B1-\u03C9\u0391-\u03A9?@]|(?:\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)(?:\s+|\{\}|(?![a-zA-Z]))))+/,
			"\\greek": /^\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)(?:\s+|\{\}|(?![a-zA-Z]))/,
			"one lowercase latin letter $": /^(?:([a-z])(?:$|[^a-zA-Z]))$/,
			"$one lowercase latin letter$ $": /^\$(?:([a-z])(?:$|[^a-zA-Z]))\$$/,
			"one lowercase greek letter $": /^(?:\$?[\u03B1-\u03C9]\$?|\$?\\(?:alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\s*\$?)(?:\s+|\{\}|(?![a-zA-Z]))$/,
			digits: /^[0-9]+/,
			"-9.,9": /^[+\-]?(?:[0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+))/,
			"-9.,9 no missing 0": /^[+\-]?[0-9]+(?:[.,][0-9]+)?/,
			"(-)(9.,9)(e)(99)": function(e) {
				var t = e.match(/^(\+\-|\+\/\-|\+|\-|\\pm\s?)?([0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+))?(\((?:[0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+))\))?(?:([eE]|\s*(\*|x|\\times|\u00D7)\s*10\^)([+\-]?[0-9]+|\{[+\-]?[0-9]+\}))?/);
				return t && t[0] ? {
					match_: t.splice(1),
					remainder: e.substr(t[0].length)
				} : null;
			},
			"(-)(9)^(-9)": function(e) {
				var t = e.match(/^(\+\-|\+\/\-|\+|\-|\\pm\s?)?([0-9]+(?:[,.][0-9]+)?|[0-9]*(?:\.[0-9]+)?)\^([+\-]?[0-9]+|\{[+\-]?[0-9]+\})/);
				return t && t[0] ? {
					match_: t.splice(1),
					remainder: e.substr(t[0].length)
				} : null;
			},
			"state of aggregation $": function(e) {
				var t = J.patterns.findObserveGroups(e, "", /^\([a-z]{1,3}(?=[\),])/, ")", "");
				if (t && t.remainder.match(/^($|[\s,;\)\]\}])/)) return t;
				var n = e.match(/^(?:\((?:\\ca\s?)?\$[amothc]\$\))/);
				return n ? {
					match_: n[0],
					remainder: e.substr(n[0].length)
				} : null;
			},
			"_{(state of aggregation)}$": /^_\{(\([a-z]{1,3}\))\}/,
			"{[(": /^(?:\\\{|\[|\()/,
			")]}": /^(?:\)|\]|\\\})/,
			", ": /^[,;]\s*/,
			",": /^[,;]/,
			".": /^[.]/,
			". ": /^([.\u22C5\u00B7\u2022])\s*/,
			"...": /^\.\.\.(?=$|[^.])/,
			"* ": /^([*])\s*/,
			"^{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "^{", "", "", "}");
			},
			"^($...$)": function(e) {
				return J.patterns.findObserveGroups(e, "^", "$", "$", "");
			},
			"^a": /^\^([0-9]+|[^\\_])/,
			"^\\x{}{}": function(e) {
				return J.patterns.findObserveGroups(e, "^", /^\\[a-zA-Z]+\{/, "}", "", "", "{", "}", "", !0);
			},
			"^\\x{}": function(e) {
				return J.patterns.findObserveGroups(e, "^", /^\\[a-zA-Z]+\{/, "}", "");
			},
			"^\\x": /^\^(\\[a-zA-Z]+)\s*/,
			"^(-1)": /^\^(-?\d+)/,
			"'": /^'/,
			"_{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "_{", "", "", "}");
			},
			"_($...$)": function(e) {
				return J.patterns.findObserveGroups(e, "_", "$", "$", "");
			},
			_9: /^_([+\-]?[0-9]+|[^\\])/,
			"_\\x{}{}": function(e) {
				return J.patterns.findObserveGroups(e, "_", /^\\[a-zA-Z]+\{/, "}", "", "", "{", "}", "", !0);
			},
			"_\\x{}": function(e) {
				return J.patterns.findObserveGroups(e, "_", /^\\[a-zA-Z]+\{/, "}", "");
			},
			"_\\x": /^_(\\[a-zA-Z]+)\s*/,
			"^_": /^(?:\^(?=_)|\_(?=\^)|[\^_]$)/,
			"{}": /^\{\}/,
			"{...}": function(e) {
				return J.patterns.findObserveGroups(e, "", "{", "}", "");
			},
			"{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "{", "", "", "}");
			},
			"$...$": function(e) {
				return J.patterns.findObserveGroups(e, "", "$", "$", "");
			},
			"${(...)}$": function(e) {
				return J.patterns.findObserveGroups(e, "${", "", "", "}$");
			},
			"$(...)$": function(e) {
				return J.patterns.findObserveGroups(e, "$", "", "", "$");
			},
			"=<>": /^[=<>]/,
			"#": /^[#\u2261]/,
			"+": /^\+/,
			"-$": /^-(?=[\s_},;\]/]|$|\([a-z]+\))/,
			"-9": /^-(?=[0-9])/,
			"- orbital overlap": /^-(?=(?:[spd]|sp)(?:$|[\s,;\)\]\}]))/,
			"-": /^-/,
			"pm-operator": /^(?:\\pm|\$\\pm\$|\+-|\+\/-)/,
			operator: /^(?:\+|(?:[\-=<>]|<<|>>|\\approx|\$\\approx\$)(?=\s|$|-?[0-9]))/,
			arrowUpDown: /^(?:v|\(v\)|\^|\(\^\))(?=$|[\s,;\)\]\}])/,
			"\\bond{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "\\bond{", "", "", "}");
			},
			"->": /^(?:<->|<-->|->|<-|<=>>|<<=>|<=>|[\u2192\u27F6\u21CC])/,
			CMT: /^[CMT](?=\[)/,
			"[(...)]": function(e) {
				return J.patterns.findObserveGroups(e, "[", "", "", "]");
			},
			"1st-level escape": /^(&|\\\\|\\hline)\s*/,
			"\\,": /^(?:\\[,\ ;:])/,
			"\\x{}{}": function(e) {
				return J.patterns.findObserveGroups(e, "", /^\\[a-zA-Z]+\{/, "}", "", "", "{", "}", "", !0);
			},
			"\\x{}": function(e) {
				return J.patterns.findObserveGroups(e, "", /^\\[a-zA-Z]+\{/, "}", "");
			},
			"\\ca": /^\\ca(?:\s+|(?![a-zA-Z]))/,
			"\\x": /^(?:\\[a-zA-Z]+\s*|\\[_&{}%])/,
			orbital: /^(?:[0-9]{1,2}[spdfgh]|[0-9]{0,2}sp)(?=$|[^a-zA-Z])/,
			others: /^[\/~|]/,
			"\\frac{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "\\frac{", "", "", "}", "{", "", "", "}");
			},
			"\\overset{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "\\overset{", "", "", "}", "{", "", "", "}");
			},
			"\\underset{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "\\underset{", "", "", "}", "{", "", "", "}");
			},
			"\\underbrace{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "\\underbrace{", "", "", "}_", "{", "", "", "}");
			},
			"\\color{(...)}0": function(e) {
				return J.patterns.findObserveGroups(e, "\\color{", "", "", "}");
			},
			"\\color{(...)}{(...)}1": function(e) {
				return J.patterns.findObserveGroups(e, "\\color{", "", "", "}", "{", "", "", "}");
			},
			"\\color(...){(...)}2": function(e) {
				return J.patterns.findObserveGroups(e, "\\color", "\\", "", /^(?=\{)/, "{", "", "", "}");
			},
			"\\ce{(...)}": function(e) {
				return J.patterns.findObserveGroups(e, "\\ce{", "", "", "}");
			},
			oxidation$: /^(?:[+-][IVX]+|\\pm\s*0|\$\\pm\$\s*0)$/,
			"d-oxidation$": /^(?:[+-]?\s?[IVX]+|\\pm\s*0|\$\\pm\$\s*0)$/,
			"roman numeral": /^[IVX]+/,
			"1/2$": /^[+\-]?(?:[0-9]+|\$[a-z]\$|[a-z])\/[0-9]+(?:\$[a-z]\$|[a-z])?$/,
			amount: function(e) {
				var t = e.match(/^(?:(?:(?:\([+\-]?[0-9]+\/[0-9]+\)|[+\-]?(?:[0-9]+|\$[a-z]\$|[a-z])\/[0-9]+|[+\-]?[0-9]+[.,][0-9]+|[+\-]?\.[0-9]+|[+\-]?[0-9]+)(?:[a-z](?=\s*[A-Z]))?)|[+\-]?[a-z](?=\s*[A-Z])|\+(?!\s))/);
				if (t) return {
					match_: t[0],
					remainder: e.substr(t[0].length)
				};
				var n = J.patterns.findObserveGroups(e, "", "$", "$", "");
				return n && (t = n.match_.match(/^\$(?:\(?[+\-]?(?:[0-9]*[a-z]?[+\-])?[0-9]*[a-z](?:[+\-][0-9]*[a-z]?)?\)?|\+|-)\$$/), t) ? {
					match_: t[0],
					remainder: e.substr(t[0].length)
				} : null;
			},
			amount2: function(e) {
				return this.amount(e);
			},
			"(KV letters),": /^(?:[A-Z][a-z]{0,2}|i)(?=,)/,
			formula$: function(e) {
				if (e.match(/^\([a-z]+\)$/)) return null;
				var t = e.match(/^(?:[a-z]|(?:[0-9\ \+\-\,\.\(\)]+[a-z])+[0-9\ \+\-\,\.\(\)]*|(?:[a-z][0-9\ \+\-\,\.\(\)]+)+[a-z]?)$/);
				return t ? {
					match_: t[0],
					remainder: e.substr(t[0].length)
				} : null;
			},
			uprightEntities: /^(?:pH|pOH|pC|pK|iPr|iBu)(?=$|[^a-zA-Z])/,
			"/": /^\s*(\/)\s*/,
			"//": /^\s*(\/\/)\s*/,
			"*": /^\s*[*.]\s*/
		},
		findObserveGroups: function(e, t, n, r, i, a, o, s, c, l) {
			var u = function(e, t) {
				if (typeof t == "string") return e.indexOf(t) === 0 ? t : null;
				var n = e.match(t);
				return n ? n[0] : null;
			}, d = function(e, t, n) {
				for (var r = 0; t < e.length;) {
					var i = e.charAt(t), a = u(e.substr(t), n);
					if (a !== null && r === 0) return {
						endMatchBegin: t,
						endMatchEnd: t + a.length
					};
					if (i === "{") r++;
					else if (i === "}") {
						if (r === 0) throw ["ExtraCloseMissingOpen", "Extra close brace or missing open brace"];
						r--;
					}
					t++;
				}
				return null;
			}, f = u(e, t);
			if (f === null || (e = e.substr(f.length), f = u(e, n), f === null)) return null;
			var p = d(e, f.length, r || i);
			if (p === null) return null;
			var m = e.substring(0, r ? p.endMatchEnd : p.endMatchBegin);
			if (a || o) {
				var h = this.findObserveGroups(e.substr(p.endMatchEnd), a, o, s, c);
				if (h === null) return null;
				var g = [m, h.match_];
				return {
					match_: l ? g.join("") : g,
					remainder: h.remainder
				};
			} else return {
				match_: m,
				remainder: e.substr(p.endMatchEnd)
			};
		},
		match_: function(e, t) {
			var n = J.patterns.patterns[e];
			if (n === void 0) throw ["MhchemBugP", "mhchem bug P. Please report. (" + e + ")"];
			if (typeof n == "function") return J.patterns.patterns[e](t);
			var r = t.match(n);
			return r ? {
				match_: r[2] ? [r[1], r[2]] : r[1] ? r[1] : r[0],
				remainder: t.substr(r[0].length)
			} : null;
		}
	},
	actions: {
		"a=": function(e, t) {
			e.a = (e.a || "") + t;
		},
		"b=": function(e, t) {
			e.b = (e.b || "") + t;
		},
		"p=": function(e, t) {
			e.p = (e.p || "") + t;
		},
		"o=": function(e, t) {
			e.o = (e.o || "") + t;
		},
		"q=": function(e, t) {
			e.q = (e.q || "") + t;
		},
		"d=": function(e, t) {
			e.d = (e.d || "") + t;
		},
		"rm=": function(e, t) {
			e.rm = (e.rm || "") + t;
		},
		"text=": function(e, t) {
			e.text_ = (e.text_ || "") + t;
		},
		insert: function(e, t, n) {
			return { type_: n };
		},
		"insert+p1": function(e, t, n) {
			return {
				type_: n,
				p1: t
			};
		},
		"insert+p1+p2": function(e, t, n) {
			return {
				type_: n,
				p1: t[0],
				p2: t[1]
			};
		},
		copy: function(e, t) {
			return t;
		},
		rm: function(e, t) {
			return {
				type_: "rm",
				p1: t || ""
			};
		},
		text: function(e, t) {
			return J.go(t, "text");
		},
		"{text}": function(e, t) {
			var n = ["{"];
			return J.concatArray(n, J.go(t, "text")), n.push("}"), n;
		},
		"tex-math": function(e, t) {
			return J.go(t, "tex-math");
		},
		"tex-math tight": function(e, t) {
			return J.go(t, "tex-math tight");
		},
		bond: function(e, t, n) {
			return {
				type_: "bond",
				kind_: n || t
			};
		},
		"color0-output": function(e, t) {
			return {
				type_: "color0",
				color: t[0]
			};
		},
		ce: function(e, t) {
			return J.go(t);
		},
		"1/2": function(e, t) {
			var n = [];
			t.match(/^[+\-]/) && (n.push(t.substr(0, 1)), t = t.substr(1));
			var r = t.match(/^([0-9]+|\$[a-z]\$|[a-z])\/([0-9]+)(\$[a-z]\$|[a-z])?$/);
			return r[1] = r[1].replace(/\$/g, ""), n.push({
				type_: "frac",
				p1: r[1],
				p2: r[2]
			}), r[3] && (r[3] = r[3].replace(/\$/g, ""), n.push({
				type_: "tex-math",
				p1: r[3]
			})), n;
		},
		"9,9": function(e, t) {
			return J.go(t, "9,9");
		}
	},
	createTransitions: function(e) {
		var t, n, r, i, a = {};
		for (t in e) for (n in e[t]) for (r = n.split("|"), e[t][n].stateArray = r, i = 0; i < r.length; i++) a[r[i]] = [];
		for (t in e) for (n in e[t]) for (r = e[t][n].stateArray || [], i = 0; i < r.length; i++) {
			var o = e[t][n];
			if (o.action_) {
				o.action_ = [].concat(o.action_);
				for (var s = 0; s < o.action_.length; s++) typeof o.action_[s] == "string" && (o.action_[s] = { type_: o.action_[s] });
			} else o.action_ = [];
			for (var c = t.split("|"), l = 0; l < c.length; l++) if (r[i] === "*") for (var u in a) a[u].push({
				pattern: c[l],
				task: o
			});
			else a[r[i]].push({
				pattern: c[l],
				task: o
			});
		}
		return a;
	},
	stateMachines: {}
};
J.stateMachines = {
	ce: {
		transitions: J.createTransitions({
			empty: { "*": { action_: "output" } },
			else: { "0|1|2": {
				action_: "beginsWithBond=false",
				revisit: !0,
				toContinue: !0
			} },
			oxidation$: { 0: { action_: "oxidation-output" } },
			CMT: {
				r: {
					action_: "rdt=",
					nextState: "rt"
				},
				rd: {
					action_: "rqt=",
					nextState: "rdt"
				}
			},
			arrowUpDown: { "0|1|2|as": {
				action_: [
					"sb=false",
					"output",
					"operator"
				],
				nextState: "1"
			} },
			uprightEntities: { "0|1|2": {
				action_: ["o=", "output"],
				nextState: "1"
			} },
			orbital: { "0|1|2|3": {
				action_: "o=",
				nextState: "o"
			} },
			"->": {
				"0|1|2|3": {
					action_: "r=",
					nextState: "r"
				},
				"a|as": {
					action_: ["output", "r="],
					nextState: "r"
				},
				"*": {
					action_: ["output", "r="],
					nextState: "r"
				}
			},
			"+": {
				o: {
					action_: "d= kv",
					nextState: "d"
				},
				"d|D": {
					action_: "d=",
					nextState: "d"
				},
				q: {
					action_: "d=",
					nextState: "qd"
				},
				"qd|qD": {
					action_: "d=",
					nextState: "qd"
				},
				dq: {
					action_: ["output", "d="],
					nextState: "d"
				},
				3: {
					action_: [
						"sb=false",
						"output",
						"operator"
					],
					nextState: "0"
				}
			},
			amount: { "0|2": {
				action_: "a=",
				nextState: "a"
			} },
			"pm-operator": { "0|1|2|a|as": {
				action_: [
					"sb=false",
					"output",
					{
						type_: "operator",
						option: "\\pm"
					}
				],
				nextState: "0"
			} },
			operator: { "0|1|2|a|as": {
				action_: [
					"sb=false",
					"output",
					"operator"
				],
				nextState: "0"
			} },
			"-$": {
				"o|q": {
					action_: ["charge or bond", "output"],
					nextState: "qd"
				},
				d: {
					action_: "d=",
					nextState: "d"
				},
				D: {
					action_: ["output", {
						type_: "bond",
						option: "-"
					}],
					nextState: "3"
				},
				q: {
					action_: "d=",
					nextState: "qd"
				},
				qd: {
					action_: "d=",
					nextState: "qd"
				},
				"qD|dq": {
					action_: ["output", {
						type_: "bond",
						option: "-"
					}],
					nextState: "3"
				}
			},
			"-9": { "3|o": {
				action_: ["output", {
					type_: "insert",
					option: "hyphen"
				}],
				nextState: "3"
			} },
			"- orbital overlap": {
				o: {
					action_: ["output", {
						type_: "insert",
						option: "hyphen"
					}],
					nextState: "2"
				},
				d: {
					action_: ["output", {
						type_: "insert",
						option: "hyphen"
					}],
					nextState: "2"
				}
			},
			"-": {
				"0|1|2": {
					action_: [
						{
							type_: "output",
							option: 1
						},
						"beginsWithBond=true",
						{
							type_: "bond",
							option: "-"
						}
					],
					nextState: "3"
				},
				3: { action_: {
					type_: "bond",
					option: "-"
				} },
				a: {
					action_: ["output", {
						type_: "insert",
						option: "hyphen"
					}],
					nextState: "2"
				},
				as: {
					action_: [{
						type_: "output",
						option: 2
					}, {
						type_: "bond",
						option: "-"
					}],
					nextState: "3"
				},
				b: { action_: "b=" },
				o: {
					action_: {
						type_: "- after o/d",
						option: !1
					},
					nextState: "2"
				},
				q: {
					action_: {
						type_: "- after o/d",
						option: !1
					},
					nextState: "2"
				},
				"d|qd|dq": {
					action_: {
						type_: "- after o/d",
						option: !0
					},
					nextState: "2"
				},
				"D|qD|p": {
					action_: ["output", {
						type_: "bond",
						option: "-"
					}],
					nextState: "3"
				}
			},
			amount2: { "1|3": {
				action_: "a=",
				nextState: "a"
			} },
			letters: {
				"0|1|2|3|a|as|b|p|bp|o": {
					action_: "o=",
					nextState: "o"
				},
				"q|dq": {
					action_: ["output", "o="],
					nextState: "o"
				},
				"d|D|qd|qD": {
					action_: "o after d",
					nextState: "o"
				}
			},
			digits: {
				o: {
					action_: "q=",
					nextState: "q"
				},
				"d|D": {
					action_: "q=",
					nextState: "dq"
				},
				q: {
					action_: ["output", "o="],
					nextState: "o"
				},
				a: {
					action_: "o=",
					nextState: "o"
				}
			},
			"space A": { "b|p|bp": {} },
			space: {
				a: { nextState: "as" },
				0: { action_: "sb=false" },
				"1|2": { action_: "sb=true" },
				"r|rt|rd|rdt|rdq": {
					action_: "output",
					nextState: "0"
				},
				"*": {
					action_: ["output", "sb=true"],
					nextState: "1"
				}
			},
			"1st-level escape": {
				"1|2": { action_: ["output", {
					type_: "insert+p1",
					option: "1st-level escape"
				}] },
				"*": {
					action_: ["output", {
						type_: "insert+p1",
						option: "1st-level escape"
					}],
					nextState: "0"
				}
			},
			"[(...)]": {
				"r|rt": {
					action_: "rd=",
					nextState: "rd"
				},
				"rd|rdt": {
					action_: "rq=",
					nextState: "rdq"
				}
			},
			"...": {
				"o|d|D|dq|qd|qD": {
					action_: ["output", {
						type_: "bond",
						option: "..."
					}],
					nextState: "3"
				},
				"*": {
					action_: [{
						type_: "output",
						option: 1
					}, {
						type_: "insert",
						option: "ellipsis"
					}],
					nextState: "1"
				}
			},
			". |* ": { "*": {
				action_: ["output", {
					type_: "insert",
					option: "addition compound"
				}],
				nextState: "1"
			} },
			"state of aggregation $": { "*": {
				action_: ["output", "state of aggregation"],
				nextState: "1"
			} },
			"{[(": {
				"a|as|o": {
					action_: [
						"o=",
						"output",
						"parenthesisLevel++"
					],
					nextState: "2"
				},
				"0|1|2|3": {
					action_: [
						"o=",
						"output",
						"parenthesisLevel++"
					],
					nextState: "2"
				},
				"*": {
					action_: [
						"output",
						"o=",
						"output",
						"parenthesisLevel++"
					],
					nextState: "2"
				}
			},
			")]}": {
				"0|1|2|3|b|p|bp|o": {
					action_: ["o=", "parenthesisLevel--"],
					nextState: "o"
				},
				"a|as|d|D|q|qd|qD|dq": {
					action_: [
						"output",
						"o=",
						"parenthesisLevel--"
					],
					nextState: "o"
				}
			},
			", ": { "*": {
				action_: ["output", "comma"],
				nextState: "0"
			} },
			"^_": { "*": {} },
			"^{(...)}|^($...$)": {
				"0|1|2|as": {
					action_: "b=",
					nextState: "b"
				},
				p: {
					action_: "b=",
					nextState: "bp"
				},
				"3|o": {
					action_: "d= kv",
					nextState: "D"
				},
				q: {
					action_: "d=",
					nextState: "qD"
				},
				"d|D|qd|qD|dq": {
					action_: ["output", "d="],
					nextState: "D"
				}
			},
			"^a|^\\x{}{}|^\\x{}|^\\x|'": {
				"0|1|2|as": {
					action_: "b=",
					nextState: "b"
				},
				p: {
					action_: "b=",
					nextState: "bp"
				},
				"3|o": {
					action_: "d= kv",
					nextState: "d"
				},
				q: {
					action_: "d=",
					nextState: "qd"
				},
				"d|qd|D|qD": { action_: "d=" },
				dq: {
					action_: ["output", "d="],
					nextState: "d"
				}
			},
			"_{(state of aggregation)}$": { "d|D|q|qd|qD|dq": {
				action_: ["output", "q="],
				nextState: "q"
			} },
			"_{(...)}|_($...$)|_9|_\\x{}{}|_\\x{}|_\\x": {
				"0|1|2|as": {
					action_: "p=",
					nextState: "p"
				},
				b: {
					action_: "p=",
					nextState: "bp"
				},
				"3|o": {
					action_: "q=",
					nextState: "q"
				},
				"d|D": {
					action_: "q=",
					nextState: "dq"
				},
				"q|qd|qD|dq": {
					action_: ["output", "q="],
					nextState: "q"
				}
			},
			"=<>": { "0|1|2|3|a|as|o|q|d|D|qd|qD|dq": {
				action_: [{
					type_: "output",
					option: 2
				}, "bond"],
				nextState: "3"
			} },
			"#": { "0|1|2|3|a|as|o": {
				action_: [{
					type_: "output",
					option: 2
				}, {
					type_: "bond",
					option: "#"
				}],
				nextState: "3"
			} },
			"{}": { "*": {
				action_: {
					type_: "output",
					option: 1
				},
				nextState: "1"
			} },
			"{...}": {
				"0|1|2|3|a|as|b|p|bp": {
					action_: "o=",
					nextState: "o"
				},
				"o|d|D|q|qd|qD|dq": {
					action_: ["output", "o="],
					nextState: "o"
				}
			},
			"$...$": {
				a: { action_: "a=" },
				"0|1|2|3|as|b|p|bp|o": {
					action_: "o=",
					nextState: "o"
				},
				"as|o": { action_: "o=" },
				"q|d|D|qd|qD|dq": {
					action_: ["output", "o="],
					nextState: "o"
				}
			},
			"\\bond{(...)}": { "*": {
				action_: [{
					type_: "output",
					option: 2
				}, "bond"],
				nextState: "3"
			} },
			"\\frac{(...)}": { "*": {
				action_: [{
					type_: "output",
					option: 1
				}, "frac-output"],
				nextState: "3"
			} },
			"\\overset{(...)}": { "*": {
				action_: [{
					type_: "output",
					option: 2
				}, "overset-output"],
				nextState: "3"
			} },
			"\\underset{(...)}": { "*": {
				action_: [{
					type_: "output",
					option: 2
				}, "underset-output"],
				nextState: "3"
			} },
			"\\underbrace{(...)}": { "*": {
				action_: [{
					type_: "output",
					option: 2
				}, "underbrace-output"],
				nextState: "3"
			} },
			"\\color{(...)}{(...)}1|\\color(...){(...)}2": { "*": {
				action_: [{
					type_: "output",
					option: 2
				}, "color-output"],
				nextState: "3"
			} },
			"\\color{(...)}0": { "*": { action_: [{
				type_: "output",
				option: 2
			}, "color0-output"] } },
			"\\ce{(...)}": { "*": {
				action_: [{
					type_: "output",
					option: 2
				}, "ce"],
				nextState: "3"
			} },
			"\\,": { "*": {
				action_: [{
					type_: "output",
					option: 1
				}, "copy"],
				nextState: "1"
			} },
			"\\x{}{}|\\x{}|\\x": {
				"0|1|2|3|a|as|b|p|bp|o|c0": {
					action_: ["o=", "output"],
					nextState: "3"
				},
				"*": {
					action_: [
						"output",
						"o=",
						"output"
					],
					nextState: "3"
				}
			},
			others: { "*": {
				action_: [{
					type_: "output",
					option: 1
				}, "copy"],
				nextState: "3"
			} },
			else2: {
				a: {
					action_: "a to o",
					nextState: "o",
					revisit: !0
				},
				as: {
					action_: ["output", "sb=true"],
					nextState: "1",
					revisit: !0
				},
				"r|rt|rd|rdt|rdq": {
					action_: ["output"],
					nextState: "0",
					revisit: !0
				},
				"*": {
					action_: ["output", "copy"],
					nextState: "3"
				}
			}
		}),
		actions: {
			"o after d": function(e, t) {
				var n;
				if ((e.d || "").match(/^[0-9]+$/)) {
					var r = e.d;
					e.d = void 0, n = this.output(e), e.b = r;
				} else n = this.output(e);
				return J.actions["o="](e, t), n;
			},
			"d= kv": function(e, t) {
				e.d = t, e.dType = "kv";
			},
			"charge or bond": function(e, t) {
				if (e.beginsWithBond) {
					var n = [];
					return J.concatArray(n, this.output(e)), J.concatArray(n, J.actions.bond(e, t, "-")), n;
				} else e.d = t;
			},
			"- after o/d": function(e, t, n) {
				var r = J.patterns.match_("orbital", e.o || ""), i = J.patterns.match_("one lowercase greek letter $", e.o || ""), a = J.patterns.match_("one lowercase latin letter $", e.o || ""), o = J.patterns.match_("$one lowercase latin letter$ $", e.o || ""), s = t === "-" && (r && r.remainder === "" || i || a || o);
				s && !e.a && !e.b && !e.p && !e.d && !e.q && !r && a && (e.o = "$" + e.o + "$");
				var c = [];
				return s ? (J.concatArray(c, this.output(e)), c.push({ type_: "hyphen" })) : (r = J.patterns.match_("digits", e.d || ""), n && r && r.remainder === "" ? (J.concatArray(c, J.actions["d="](e, t)), J.concatArray(c, this.output(e))) : (J.concatArray(c, this.output(e)), J.concatArray(c, J.actions.bond(e, t, "-")))), c;
			},
			"a to o": function(e) {
				e.o = e.a, e.a = void 0;
			},
			"sb=true": function(e) {
				e.sb = !0;
			},
			"sb=false": function(e) {
				e.sb = !1;
			},
			"beginsWithBond=true": function(e) {
				e.beginsWithBond = !0;
			},
			"beginsWithBond=false": function(e) {
				e.beginsWithBond = !1;
			},
			"parenthesisLevel++": function(e) {
				e.parenthesisLevel++;
			},
			"parenthesisLevel--": function(e) {
				e.parenthesisLevel--;
			},
			"state of aggregation": function(e, t) {
				return {
					type_: "state of aggregation",
					p1: J.go(t, "o")
				};
			},
			comma: function(e, t) {
				var n = t.replace(/\s*$/, "");
				return n !== t && e.parenthesisLevel === 0 ? {
					type_: "comma enumeration L",
					p1: n
				} : {
					type_: "comma enumeration M",
					p1: n
				};
			},
			output: function(e, t, n) {
				var r;
				if (!e.r) r = [], !e.a && !e.b && !e.p && !e.o && !e.q && !e.d && !n || (e.sb && r.push({ type_: "entitySkip" }), !e.o && !e.q && !e.d && !e.b && !e.p && n !== 2 ? (e.o = e.a, e.a = void 0) : !e.o && !e.q && !e.d && (e.b || e.p) ? (e.o = e.a, e.d = e.b, e.q = e.p, e.a = e.b = e.p = void 0) : e.o && e.dType === "kv" && J.patterns.match_("d-oxidation$", e.d || "") ? e.dType = "oxidation" : e.o && e.dType === "kv" && !e.q && (e.dType = void 0), r.push({
					type_: "chemfive",
					a: J.go(e.a, "a"),
					b: J.go(e.b, "bd"),
					p: J.go(e.p, "pq"),
					o: J.go(e.o, "o"),
					q: J.go(e.q, "pq"),
					d: J.go(e.d, e.dType === "oxidation" ? "oxidation" : "bd"),
					dType: e.dType
				}));
				else {
					var i = e.rdt === "M" ? J.go(e.rd, "tex-math") : e.rdt === "T" ? [{
						type_: "text",
						p1: e.rd || ""
					}] : J.go(e.rd), a = e.rqt === "M" ? J.go(e.rq, "tex-math") : e.rqt === "T" ? [{
						type_: "text",
						p1: e.rq || ""
					}] : J.go(e.rq);
					r = {
						type_: "arrow",
						r: e.r,
						rd: i,
						rq: a
					};
				}
				for (var o in e) o !== "parenthesisLevel" && o !== "beginsWithBond" && delete e[o];
				return r;
			},
			"oxidation-output": function(e, t) {
				var n = ["{"];
				return J.concatArray(n, J.go(t, "oxidation")), n.push("}"), n;
			},
			"frac-output": function(e, t) {
				return {
					type_: "frac-ce",
					p1: J.go(t[0]),
					p2: J.go(t[1])
				};
			},
			"overset-output": function(e, t) {
				return {
					type_: "overset",
					p1: J.go(t[0]),
					p2: J.go(t[1])
				};
			},
			"underset-output": function(e, t) {
				return {
					type_: "underset",
					p1: J.go(t[0]),
					p2: J.go(t[1])
				};
			},
			"underbrace-output": function(e, t) {
				return {
					type_: "underbrace",
					p1: J.go(t[0]),
					p2: J.go(t[1])
				};
			},
			"color-output": function(e, t) {
				return {
					type_: "color",
					color1: t[0],
					color2: J.go(t[1])
				};
			},
			"r=": function(e, t) {
				e.r = t;
			},
			"rdt=": function(e, t) {
				e.rdt = t;
			},
			"rd=": function(e, t) {
				e.rd = t;
			},
			"rqt=": function(e, t) {
				e.rqt = t;
			},
			"rq=": function(e, t) {
				e.rq = t;
			},
			operator: function(e, t, n) {
				return {
					type_: "operator",
					kind_: n || t
				};
			}
		}
	},
	a: {
		transitions: J.createTransitions({
			empty: { "*": {} },
			"1/2$": { 0: { action_: "1/2" } },
			else: { 0: {
				nextState: "1",
				revisit: !0
			} },
			"$(...)$": { "*": {
				action_: "tex-math tight",
				nextState: "1"
			} },
			",": { "*": { action_: {
				type_: "insert",
				option: "commaDecimal"
			} } },
			else2: { "*": { action_: "copy" } }
		}),
		actions: {}
	},
	o: {
		transitions: J.createTransitions({
			empty: { "*": {} },
			"1/2$": { 0: { action_: "1/2" } },
			else: { 0: {
				nextState: "1",
				revisit: !0
			} },
			letters: { "*": { action_: "rm" } },
			"\\ca": { "*": { action_: {
				type_: "insert",
				option: "circa"
			} } },
			"\\x{}{}|\\x{}|\\x": { "*": { action_: "copy" } },
			"${(...)}$|$(...)$": { "*": { action_: "tex-math" } },
			"{(...)}": { "*": { action_: "{text}" } },
			else2: { "*": { action_: "copy" } }
		}),
		actions: {}
	},
	text: {
		transitions: J.createTransitions({
			empty: { "*": { action_: "output" } },
			"{...}": { "*": { action_: "text=" } },
			"${(...)}$|$(...)$": { "*": { action_: "tex-math" } },
			"\\greek": { "*": { action_: ["output", "rm"] } },
			"\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: ["output", "copy"] } },
			else: { "*": { action_: "text=" } }
		}),
		actions: { output: function(e) {
			if (e.text_) {
				var t = {
					type_: "text",
					p1: e.text_
				};
				for (var n in e) delete e[n];
				return t;
			}
		} }
	},
	pq: {
		transitions: J.createTransitions({
			empty: { "*": {} },
			"state of aggregation $": { "*": { action_: "state of aggregation" } },
			i$: { 0: {
				nextState: "!f",
				revisit: !0
			} },
			"(KV letters),": { 0: {
				action_: "rm",
				nextState: "0"
			} },
			formula$: { 0: {
				nextState: "f",
				revisit: !0
			} },
			"1/2$": { 0: { action_: "1/2" } },
			else: { 0: {
				nextState: "!f",
				revisit: !0
			} },
			"${(...)}$|$(...)$": { "*": { action_: "tex-math" } },
			"{(...)}": { "*": { action_: "text" } },
			"a-z": { f: { action_: "tex-math" } },
			letters: { "*": { action_: "rm" } },
			"-9.,9": { "*": { action_: "9,9" } },
			",": { "*": { action_: {
				type_: "insert+p1",
				option: "comma enumeration S"
			} } },
			"\\color{(...)}{(...)}1|\\color(...){(...)}2": { "*": { action_: "color-output" } },
			"\\color{(...)}0": { "*": { action_: "color0-output" } },
			"\\ce{(...)}": { "*": { action_: "ce" } },
			"\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "copy" } },
			else2: { "*": { action_: "copy" } }
		}),
		actions: {
			"state of aggregation": function(e, t) {
				return {
					type_: "state of aggregation subscript",
					p1: J.go(t, "o")
				};
			},
			"color-output": function(e, t) {
				return {
					type_: "color",
					color1: t[0],
					color2: J.go(t[1], "pq")
				};
			}
		}
	},
	bd: {
		transitions: J.createTransitions({
			empty: { "*": {} },
			x$: { 0: {
				nextState: "!f",
				revisit: !0
			} },
			formula$: { 0: {
				nextState: "f",
				revisit: !0
			} },
			else: { 0: {
				nextState: "!f",
				revisit: !0
			} },
			"-9.,9 no missing 0": { "*": { action_: "9,9" } },
			".": { "*": { action_: {
				type_: "insert",
				option: "electron dot"
			} } },
			"a-z": { f: { action_: "tex-math" } },
			x: { "*": { action_: {
				type_: "insert",
				option: "KV x"
			} } },
			letters: { "*": { action_: "rm" } },
			"'": { "*": { action_: {
				type_: "insert",
				option: "prime"
			} } },
			"${(...)}$|$(...)$": { "*": { action_: "tex-math" } },
			"{(...)}": { "*": { action_: "text" } },
			"\\color{(...)}{(...)}1|\\color(...){(...)}2": { "*": { action_: "color-output" } },
			"\\color{(...)}0": { "*": { action_: "color0-output" } },
			"\\ce{(...)}": { "*": { action_: "ce" } },
			"\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "copy" } },
			else2: { "*": { action_: "copy" } }
		}),
		actions: { "color-output": function(e, t) {
			return {
				type_: "color",
				color1: t[0],
				color2: J.go(t[1], "bd")
			};
		} }
	},
	oxidation: {
		transitions: J.createTransitions({
			empty: { "*": {} },
			"roman numeral": { "*": { action_: "roman-numeral" } },
			"${(...)}$|$(...)$": { "*": { action_: "tex-math" } },
			else: { "*": { action_: "copy" } }
		}),
		actions: { "roman-numeral": function(e, t) {
			return {
				type_: "roman numeral",
				p1: t || ""
			};
		} }
	},
	"tex-math": {
		transitions: J.createTransitions({
			empty: { "*": { action_: "output" } },
			"\\ce{(...)}": { "*": { action_: ["output", "ce"] } },
			"{...}|\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "o=" } },
			else: { "*": { action_: "o=" } }
		}),
		actions: { output: function(e) {
			if (e.o) {
				var t = {
					type_: "tex-math",
					p1: e.o
				};
				for (var n in e) delete e[n];
				return t;
			}
		} }
	},
	"tex-math tight": {
		transitions: J.createTransitions({
			empty: { "*": { action_: "output" } },
			"\\ce{(...)}": { "*": { action_: ["output", "ce"] } },
			"{...}|\\,|\\x{}{}|\\x{}|\\x": { "*": { action_: "o=" } },
			"-|+": { "*": { action_: "tight operator" } },
			else: { "*": { action_: "o=" } }
		}),
		actions: {
			"tight operator": function(e, t) {
				e.o = (e.o || "") + "{" + t + "}";
			},
			output: function(e) {
				if (e.o) {
					var t = {
						type_: "tex-math",
						p1: e.o
					};
					for (var n in e) delete e[n];
					return t;
				}
			}
		}
	},
	"9,9": {
		transitions: J.createTransitions({
			empty: { "*": {} },
			",": { "*": { action_: "comma" } },
			else: { "*": { action_: "copy" } }
		}),
		actions: { comma: function() {
			return { type_: "commaDecimal" };
		} }
	},
	pu: {
		transitions: J.createTransitions({
			empty: { "*": { action_: "output" } },
			space$: { "*": { action_: ["output", "space"] } },
			"{[(|)]}": { "0|a": { action_: "copy" } },
			"(-)(9)^(-9)": { 0: {
				action_: "number^",
				nextState: "a"
			} },
			"(-)(9.,9)(e)(99)": { 0: {
				action_: "enumber",
				nextState: "a"
			} },
			space: { "0|a": {} },
			"pm-operator": { "0|a": {
				action_: {
					type_: "operator",
					option: "\\pm"
				},
				nextState: "0"
			} },
			operator: { "0|a": {
				action_: "copy",
				nextState: "0"
			} },
			"//": { d: {
				action_: "o=",
				nextState: "/"
			} },
			"/": { d: {
				action_: "o=",
				nextState: "/"
			} },
			"{...}|else": {
				"0|d": {
					action_: "d=",
					nextState: "d"
				},
				a: {
					action_: ["space", "d="],
					nextState: "d"
				},
				"/|q": {
					action_: "q=",
					nextState: "q"
				}
			}
		}),
		actions: {
			enumber: function(e, t) {
				var n = [];
				return t[0] === "+-" || t[0] === "+/-" ? n.push("\\pm ") : t[0] && n.push(t[0]), t[1] && (J.concatArray(n, J.go(t[1], "pu-9,9")), t[2] && (t[2].match(/[,.]/) ? J.concatArray(n, J.go(t[2], "pu-9,9")) : n.push(t[2])), t[3] = t[4] || t[3], t[3] && (t[3] = t[3].trim(), t[3] === "e" || t[3].substr(0, 1) === "*" ? n.push({ type_: "cdot" }) : n.push({ type_: "times" }))), t[3] && n.push("10^{" + t[5] + "}"), n;
			},
			"number^": function(e, t) {
				var n = [];
				return t[0] === "+-" || t[0] === "+/-" ? n.push("\\pm ") : t[0] && n.push(t[0]), J.concatArray(n, J.go(t[1], "pu-9,9")), n.push("^{" + t[2] + "}"), n;
			},
			operator: function(e, t, n) {
				return {
					type_: "operator",
					kind_: n || t
				};
			},
			space: function() {
				return { type_: "pu-space-1" };
			},
			output: function(e) {
				var t, n = J.patterns.match_("{(...)}", e.d || "");
				n && n.remainder === "" && (e.d = n.match_);
				var r = J.patterns.match_("{(...)}", e.q || "");
				if (r && r.remainder === "" && (e.q = r.match_), e.d &&= (e.d = e.d.replace(/\u00B0C|\^oC|\^{o}C/g, "{}^{\\circ}C"), e.d.replace(/\u00B0F|\^oF|\^{o}F/g, "{}^{\\circ}F")), e.q) {
					e.q = e.q.replace(/\u00B0C|\^oC|\^{o}C/g, "{}^{\\circ}C"), e.q = e.q.replace(/\u00B0F|\^oF|\^{o}F/g, "{}^{\\circ}F");
					var i = {
						d: J.go(e.d, "pu"),
						q: J.go(e.q, "pu")
					};
					e.o === "//" ? t = {
						type_: "pu-frac",
						p1: i.d,
						p2: i.q
					} : (t = i.d, i.d.length > 1 || i.q.length > 1 ? t.push({ type_: " / " }) : t.push({ type_: "/" }), J.concatArray(t, i.q));
				} else t = J.go(e.d, "pu-2");
				for (var a in e) delete e[a];
				return t;
			}
		}
	},
	"pu-2": {
		transitions: J.createTransitions({
			empty: { "*": { action_: "output" } },
			"*": { "*": {
				action_: ["output", "cdot"],
				nextState: "0"
			} },
			"\\x": { "*": { action_: "rm=" } },
			space: { "*": {
				action_: ["output", "space"],
				nextState: "0"
			} },
			"^{(...)}|^(-1)": { 1: { action_: "^(-1)" } },
			"-9.,9": {
				0: {
					action_: "rm=",
					nextState: "0"
				},
				1: {
					action_: "^(-1)",
					nextState: "0"
				}
			},
			"{...}|else": { "*": {
				action_: "rm=",
				nextState: "1"
			} }
		}),
		actions: {
			cdot: function() {
				return { type_: "tight cdot" };
			},
			"^(-1)": function(e, t) {
				e.rm += "^{" + t + "}";
			},
			space: function() {
				return { type_: "pu-space-2" };
			},
			output: function(e) {
				var t = [];
				if (e.rm) {
					var n = J.patterns.match_("{(...)}", e.rm || "");
					t = n && n.remainder === "" ? J.go(n.match_, "pu") : {
						type_: "rm",
						p1: e.rm
					};
				}
				for (var r in e) delete e[r];
				return t;
			}
		}
	},
	"pu-9,9": {
		transitions: J.createTransitions({
			empty: {
				0: { action_: "output-0" },
				o: { action_: "output-o" }
			},
			",": { 0: {
				action_: ["output-0", "comma"],
				nextState: "o"
			} },
			".": { 0: {
				action_: ["output-0", "copy"],
				nextState: "o"
			} },
			else: { "*": { action_: "text=" } }
		}),
		actions: {
			comma: function() {
				return { type_: "commaDecimal" };
			},
			"output-0": function(e) {
				var t = [];
				if (e.text_ = e.text_ || "", e.text_.length > 4) {
					var n = e.text_.length % 3;
					n === 0 && (n = 3);
					for (var r = e.text_.length - 3; r > 0; r -= 3) t.push(e.text_.substr(r, 3)), t.push({ type_: "1000 separator" });
					t.push(e.text_.substr(0, n)), t.reverse();
				} else t.push(e.text_);
				for (var i in e) delete e[i];
				return t;
			},
			"output-o": function(e) {
				var t = [];
				if (e.text_ = e.text_ || "", e.text_.length > 4) {
					for (var n = e.text_.length - 3, r = 0; r < n; r += 3) t.push(e.text_.substr(r, 3)), t.push({ type_: "1000 separator" });
					t.push(e.text_.substr(r));
				} else t.push(e.text_);
				for (var i in e) delete e[i];
				return t;
			}
		}
	}
};
var Y = {
	go: function(e, t) {
		if (!e) return "";
		for (var n = "", r = !1, i = 0; i < e.length; i++) {
			var a = e[i];
			typeof a == "string" ? n += a : (n += Y._go2(a), a.type_ === "1st-level escape" && (r = !0));
		}
		return !t && !r && n && (n = "{" + n + "}"), n;
	},
	_goInner: function(e) {
		return e && Y.go(e, !0);
	},
	_go2: function(e) {
		var t;
		switch (e.type_) {
			case "chemfive":
				t = "";
				var n = {
					a: Y._goInner(e.a),
					b: Y._goInner(e.b),
					p: Y._goInner(e.p),
					o: Y._goInner(e.o),
					q: Y._goInner(e.q),
					d: Y._goInner(e.d)
				};
				n.a && (n.a.match(/^[+\-]/) && (n.a = "{" + n.a + "}"), t += n.a + "\\,"), (n.b || n.p) && (t += "{\\vphantom{X}}", t += "^{\\hphantom{" + (n.b || "") + "}}_{\\hphantom{" + (n.p || "") + "}}", t += "{\\vphantom{X}}", t += "^{\\vphantom{2}\\mathllap{" + (n.b || "") + "}}", t += "_{\\vphantom{2}\\mathllap{" + (n.p || "") + "}}"), n.o && (n.o.match(/^[+\-]/) && (n.o = "{" + n.o + "}"), t += n.o), e.dType === "kv" ? ((n.d || n.q) && (t += "{\\vphantom{X}}"), n.d && (t += "^{" + n.d + "}"), n.q && (t += "_{" + n.q + "}")) : e.dType === "oxidation" ? (n.d && (t += "{\\vphantom{X}}", t += "^{" + n.d + "}"), n.q && (t += "{{}}", t += "_{" + n.q + "}")) : (n.q && (t += "{{}}", t += "_{" + n.q + "}"), n.d && (t += "{{}}", t += "^{" + n.d + "}"));
				break;
			case "rm":
				t = "\\mathrm{" + e.p1 + "}";
				break;
			case "text":
				e.p1.match(/[\^_]/) ? (e.p1 = e.p1.replace(" ", "~").replace("-", "\\text{-}"), t = "\\mathrm{" + e.p1 + "}") : t = "\\text{" + e.p1 + "}";
				break;
			case "roman numeral":
				t = "\\mathrm{" + e.p1 + "}";
				break;
			case "state of aggregation":
				t = "\\mskip2mu " + Y._goInner(e.p1);
				break;
			case "state of aggregation subscript":
				t = "\\mskip1mu " + Y._goInner(e.p1);
				break;
			case "bond":
				if (t = Y._getBond(e.kind_), !t) throw ["MhchemErrorBond", "mhchem Error. Unknown bond type (" + e.kind_ + ")"];
				break;
			case "frac":
				var r = "\\frac{" + e.p1 + "}{" + e.p2 + "}";
				t = "\\mathchoice{\\textstyle" + r + "}{" + r + "}{" + r + "}{" + r + "}";
				break;
			case "pu-frac":
				var i = "\\frac{" + Y._goInner(e.p1) + "}{" + Y._goInner(e.p2) + "}";
				t = "\\mathchoice{\\textstyle" + i + "}{" + i + "}{" + i + "}{" + i + "}";
				break;
			case "tex-math":
				t = e.p1 + " ";
				break;
			case "frac-ce":
				t = "\\frac{" + Y._goInner(e.p1) + "}{" + Y._goInner(e.p2) + "}";
				break;
			case "overset":
				t = "\\overset{" + Y._goInner(e.p1) + "}{" + Y._goInner(e.p2) + "}";
				break;
			case "underset":
				t = "\\underset{" + Y._goInner(e.p1) + "}{" + Y._goInner(e.p2) + "}";
				break;
			case "underbrace":
				t = "\\underbrace{" + Y._goInner(e.p1) + "}_{" + Y._goInner(e.p2) + "}";
				break;
			case "color":
				t = "{\\color{" + e.color1 + "}{" + Y._goInner(e.color2) + "}}";
				break;
			case "color0":
				t = "\\color{" + e.color + "}";
				break;
			case "arrow":
				var a = {
					rd: Y._goInner(e.rd),
					rq: Y._goInner(e.rq)
				}, o = Y._getArrow(e.r);
				a.rq && (o += "[{\\rm " + a.rq + "}]"), a.rd ? o += "{\\rm " + a.rd + "}" : o += "{}", t = o;
				break;
			case "operator":
				t = Y._getOperator(e.kind_);
				break;
			case "1st-level escape":
				t = e.p1 + " ";
				break;
			case "space":
				t = " ";
				break;
			case "entitySkip":
				t = "~";
				break;
			case "pu-space-1":
				t = "~";
				break;
			case "pu-space-2":
				t = "\\mkern3mu ";
				break;
			case "1000 separator":
				t = "\\mkern2mu ";
				break;
			case "commaDecimal":
				t = "{,}";
				break;
			case "comma enumeration L":
				t = "{" + e.p1 + "}\\mkern6mu ";
				break;
			case "comma enumeration M":
				t = "{" + e.p1 + "}\\mkern3mu ";
				break;
			case "comma enumeration S":
				t = "{" + e.p1 + "}\\mkern1mu ";
				break;
			case "hyphen":
				t = "\\text{-}";
				break;
			case "addition compound":
				t = "\\,{\\cdot}\\,";
				break;
			case "electron dot":
				t = "\\mkern1mu \\text{\\textbullet}\\mkern1mu ";
				break;
			case "KV x":
				t = "{\\times}";
				break;
			case "prime":
				t = "\\prime ";
				break;
			case "cdot":
				t = "\\cdot ";
				break;
			case "tight cdot":
				t = "\\mkern1mu{\\cdot}\\mkern1mu ";
				break;
			case "times":
				t = "\\times ";
				break;
			case "circa":
				t = "{\\sim}";
				break;
			case "^":
				t = "uparrow";
				break;
			case "v":
				t = "downarrow";
				break;
			case "ellipsis":
				t = "\\ldots ";
				break;
			case "/":
				t = "/";
				break;
			case " / ":
				t = "\\,/\\,";
				break;
			default: throw ["MhchemBugT", "mhchem bug T. Please report."];
		}
		return t;
	},
	_getArrow: function(e) {
		switch (e) {
			case "->": return "\\yields";
			case "→": return "\\yields";
			case "⟶": return "\\yields";
			case "<-": return "\\yieldsLeft";
			case "<->": return "\\mesomerism";
			case "<-->": return "\\yieldsLeftRight";
			case "<=>": return "\\chemequilibrium";
			case "⇌": return "\\chemequilibrium";
			case "<=>>": return "\\equilibriumRight";
			case "<<=>": return "\\equilibriumLeft";
			default: throw ["MhchemBugT", "mhchem bug T. Please report."];
		}
	},
	_getBond: function(e) {
		switch (e) {
			case "-": return "{-}";
			case "1": return "{-}";
			case "=": return "{=}";
			case "2": return "{=}";
			case "#": return "{\\equiv}";
			case "3": return "{\\equiv}";
			case "~": return "{\\tripleDash}";
			case "~-": return "{\\tripleDashOverLine}";
			case "~=": return "{\\tripleDashOverDoubleLine}";
			case "~--": return "{\\tripleDashOverDoubleLine}";
			case "-~-": return "{\\tripleDashBetweenDoubleLine}";
			case "...": return "{{\\cdot}{\\cdot}{\\cdot}}";
			case "....": return "{{\\cdot}{\\cdot}{\\cdot}{\\cdot}}";
			case "->": return "{\\rightarrow}";
			case "<-": return "{\\leftarrow}";
			case "<": return "{<}";
			case ">": return "{>}";
			default: throw ["MhchemBugT", "mhchem bug T. Please report."];
		}
	},
	_getOperator: function(e) {
		switch (e) {
			case "+": return " {}+{} ";
			case "-": return " {}-{} ";
			case "=": return " {}={} ";
			case "<": return " {}<{} ";
			case ">": return " {}>{} ";
			case "<<": return " {}\\ll{} ";
			case ">>": return " {}\\gg{} ";
			case "\\pm": return " {}\\pm{} ";
			case "\\approx": return " {}\\approx{} ";
			case "$\\approx$": return " {}\\approx{} ";
			case "v": return " \\downarrow{} ";
			case "(v)": return " \\downarrow{} ";
			case "^": return " \\uparrow{} ";
			case "(^)": return " \\uparrow{} ";
			default: throw ["MhchemBugT", "mhchem bug T. Please report."];
		}
	}
};
q("\\darr", "\\downarrow"), q("\\dArr", "\\Downarrow"), q("\\Darr", "\\Downarrow"), q("\\lang", "\\langle"), q("\\rang", "\\rangle"), q("\\uarr", "\\uparrow"), q("\\uArr", "\\Uparrow"), q("\\Uarr", "\\Uparrow"), q("\\N", "\\mathbb{N}"), q("\\R", "\\mathbb{R}"), q("\\Z", "\\mathbb{Z}"), q("\\alef", "\\aleph"), q("\\alefsym", "\\aleph"), q("\\bull", "\\bullet"), q("\\clubs", "\\clubsuit"), q("\\cnums", "\\mathbb{C}"), q("\\Complex", "\\mathbb{C}"), q("\\Dagger", "\\ddagger"), q("\\diamonds", "\\diamondsuit"), q("\\empty", "\\emptyset"), q("\\exist", "\\exists"), q("\\harr", "\\leftrightarrow"), q("\\hArr", "\\Leftrightarrow"), q("\\Harr", "\\Leftrightarrow"), q("\\hearts", "\\heartsuit"), q("\\image", "\\Im"), q("\\infin", "\\infty"), q("\\isin", "\\in"), q("\\larr", "\\leftarrow"), q("\\lArr", "\\Leftarrow"), q("\\Larr", "\\Leftarrow"), q("\\lrarr", "\\leftrightarrow"), q("\\lrArr", "\\Leftrightarrow"), q("\\Lrarr", "\\Leftrightarrow"), q("\\natnums", "\\mathbb{N}"), q("\\plusmn", "\\pm"), q("\\rarr", "\\rightarrow"), q("\\rArr", "\\Rightarrow"), q("\\Rarr", "\\Rightarrow"), q("\\real", "\\Re"), q("\\reals", "\\mathbb{R}"), q("\\Reals", "\\mathbb{R}"), q("\\sdot", "\\cdot"), q("\\sect", "\\S"), q("\\spades", "\\spadesuit"), q("\\sub", "\\subset"), q("\\sube", "\\subseteq"), q("\\supe", "\\supseteq"), q("\\thetasym", "\\vartheta"), q("\\weierp", "\\wp"), q("\\quantity", "{\\left\\{ #1 \\right\\}}"), q("\\qty", "{\\left\\{ #1 \\right\\}}"), q("\\pqty", "{\\left( #1 \\right)}"), q("\\bqty", "{\\left[ #1 \\right]}"), q("\\vqty", "{\\left\\vert #1 \\right\\vert}"), q("\\Bqty", "{\\left\\{ #1 \\right\\}}"), q("\\absolutevalue", "{\\left\\vert #1 \\right\\vert}"), q("\\abs", "{\\left\\vert #1 \\right\\vert}"), q("\\norm", "{\\left\\Vert #1 \\right\\Vert}"), q("\\evaluated", "{\\left.#1 \\right\\vert}"), q("\\eval", "{\\left.#1 \\right\\vert}"), q("\\order", "{\\mathcal{O} \\left( #1 \\right)}"), q("\\commutator", "{\\left[ #1 , #2 \\right]}"), q("\\comm", "{\\left[ #1 , #2 \\right]}"), q("\\anticommutator", "{\\left\\{ #1 , #2 \\right\\}}"), q("\\acomm", "{\\left\\{ #1 , #2 \\right\\}}"), q("\\poissonbracket", "{\\left\\{ #1 , #2 \\right\\}}"), q("\\pb", "{\\left\\{ #1 , #2 \\right\\}}"), q("\\vectorbold", "{\\boldsymbol{ #1 }}"), q("\\vb", "{\\boldsymbol{ #1 }}"), q("\\vectorarrow", "{\\vec{\\boldsymbol{ #1 }}}"), q("\\va", "{\\vec{\\boldsymbol{ #1 }}}"), q("\\vectorunit", "{{\\boldsymbol{\\hat{ #1 }}}}"), q("\\vu", "{{\\boldsymbol{\\hat{ #1 }}}}"), q("\\dotproduct", "\\mathbin{\\boldsymbol\\cdot}"), q("\\vdot", "{\\boldsymbol\\cdot}"), q("\\crossproduct", "\\mathbin{\\boldsymbol\\times}"), q("\\cross", "\\mathbin{\\boldsymbol\\times}"), q("\\cp", "\\mathbin{\\boldsymbol\\times}"), q("\\gradient", "{\\boldsymbol\\nabla}"), q("\\grad", "{\\boldsymbol\\nabla}"), q("\\divergence", "{\\grad\\vdot}"), q("\\curl", "{\\grad\\cross}"), q("\\laplacian", "\\nabla^2"), q("\\tr", "{\\operatorname{tr}}"), q("\\Tr", "{\\operatorname{Tr}}"), q("\\rank", "{\\operatorname{rank}}"), q("\\erf", "{\\operatorname{erf}}"), q("\\Res", "{\\operatorname{Res}}"), q("\\principalvalue", "{\\mathcal{P}}"), q("\\pv", "{\\mathcal{P}}"), q("\\PV", "{\\operatorname{P.V.}}"), q("\\qqtext", "{\\quad\\text{ #1 }\\quad}"), q("\\qq", "{\\quad\\text{ #1 }\\quad}"), q("\\qcomma", "{\\text{,}\\quad}"), q("\\qc", "{\\text{,}\\quad}"), q("\\qcc", "{\\quad\\text{c.c.}\\quad}"), q("\\qif", "{\\quad\\text{if}\\quad}"), q("\\qthen", "{\\quad\\text{then}\\quad}"), q("\\qelse", "{\\quad\\text{else}\\quad}"), q("\\qotherwise", "{\\quad\\text{otherwise}\\quad}"), q("\\qunless", "{\\quad\\text{unless}\\quad}"), q("\\qgiven", "{\\quad\\text{given}\\quad}"), q("\\qusing", "{\\quad\\text{using}\\quad}"), q("\\qassume", "{\\quad\\text{assume}\\quad}"), q("\\qsince", "{\\quad\\text{since}\\quad}"), q("\\qlet", "{\\quad\\text{let}\\quad}"), q("\\qfor", "{\\quad\\text{for}\\quad}"), q("\\qall", "{\\quad\\text{all}\\quad}"), q("\\qeven", "{\\quad\\text{even}\\quad}"), q("\\qodd", "{\\quad\\text{odd}\\quad}"), q("\\qinteger", "{\\quad\\text{integer}\\quad}"), q("\\qand", "{\\quad\\text{and}\\quad}"), q("\\qor", "{\\quad\\text{or}\\quad}"), q("\\qas", "{\\quad\\text{as}\\quad}"), q("\\qin", "{\\quad\\text{in}\\quad}"), q("\\differential", "{\\text{d}}"), q("\\dd", "{\\text{d}}"), q("\\derivative", "{\\frac{\\text{d}{ #1 }}{\\text{d}{ #2 }}}"), q("\\dv", "{\\frac{\\text{d}{ #1 }}{\\text{d}{ #2 }}}"), q("\\partialderivative", "{\\frac{\\partial{ #1 }}{\\partial{ #2 }}}"), q("\\variation", "{\\delta}"), q("\\var", "{\\delta}"), q("\\functionalderivative", "{\\frac{\\delta{ #1 }}{\\delta{ #2 }}}"), q("\\fdv", "{\\frac{\\delta{ #1 }}{\\delta{ #2 }}}"), q("\\innerproduct", "{\\left\\langle {#1} \\mid { #2} \\right\\rangle}"), q("\\outerproduct", "{\\left\\vert { #1 } \\right\\rangle\\left\\langle { #2} \\right\\vert}"), q("\\dyad", "{\\left\\vert { #1 } \\right\\rangle\\left\\langle { #2} \\right\\vert}"), q("\\ketbra", "{\\left\\vert { #1 } \\right\\rangle\\left\\langle { #2} \\right\\vert}"), q("\\op", "{\\left\\vert { #1 } \\right\\rangle\\left\\langle { #2} \\right\\vert}"), q("\\expectationvalue", "{\\left\\langle {#1 } \\right\\rangle}"), q("\\expval", "{\\left\\langle {#1 } \\right\\rangle}"), q("\\ev", "{\\left\\langle {#1 } \\right\\rangle}"), q("\\matrixelement", "{\\left\\langle{ #1 }\\right\\vert{ #2 }\\left\\vert{#3}\\right\\rangle}"), q("\\matrixel", "{\\left\\langle{ #1 }\\right\\vert{ #2 }\\left\\vert{#3}\\right\\rangle}"), q("\\mel", "{\\left\\langle{ #1 }\\right\\vert{ #2 }\\left\\vert{#3}\\right\\rangle}");
function Yt(e) {
	let t = [];
	e.consumeSpaces();
	let n = e.fetch().text;
	for (n === "\\relax" && (e.consume(), e.consumeSpaces(), n = e.fetch().text); n === "\\hline" || n === "\\hdashline";) e.consume(), t.push(n === "\\hdashline"), e.consumeSpaces(), n = e.fetch().text;
	return t;
}
var Xt = (e) => {
	if (!e.parser.settings.displayMode) throw new b(`{${e.envName}} can be used only in display mode.`);
}, Zt = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/, Qt = (e) => {
	let t = e.get("\\arraystretch");
	typeof t != "string" && (t = zt(t.tokens)), t = isNaN(t) ? null : Number(t);
	let n = e.get("\\arraycolsep");
	typeof n != "string" && (n = zt(n.tokens));
	let r = Zt.exec(n), i = r ? {
		number: +(r[1] + r[2]),
		unit: r[3]
	} : null;
	return [t, i];
}, $t = (e) => {
	let t = "";
	for (let n = 0; n < e.length; n++) if (e[n].type === "label") {
		if (t) throw new b("Multiple \\labels in one row");
		t = e[n].string;
	}
	return t;
};
function en(e) {
	if (e.indexOf("ed") === -1) return e.indexOf("*") === -1;
}
function tn(e, { cols: t, envClasses: n, autoTag: r, singleRow: i, emptySingleRow: a, maxNumCols: o, leqno: s, arraystretch: c, arraycolsep: l }, u) {
	let d = n && n.includes("bordermatrix") ? "}" : "\\end";
	e.gullet.beginGroup(), i || e.gullet.macros.set("\\cr", "\\\\\\relax"), e.gullet.beginGroup();
	let f = [], p = [f], m = [], h = [], g = [], _ = r == null ? void 0 : [];
	function v() {
		r && e.gullet.macros.set("\\@eqnsw", "1", !0);
	}
	function y() {
		_ && (e.gullet.macros.get("\\df@tag") ? (_.push(e.subparse([new It("\\df@tag")])), e.gullet.macros.set("\\df@tag", void 0, !0)) : _.push(!!r && e.gullet.macros.get("\\@eqnsw") === "1"));
	}
	for (v(), g.push(Yt(e));;) {
		let t = e.parseExpression(!1, i ? "\\end" : "\\\\");
		e.gullet.endGroup(), e.gullet.beginGroup(), t = {
			type: "ordgroup",
			mode: e.mode,
			body: t,
			semisimple: !0
		}, f.push(t);
		let r = e.fetch().text;
		if (r === "&") {
			if (o && f.length === o) if (n.includes("array")) {
				if (e.settings.strict) throw new b("Too few columns specified in the {array} column argument.", e.nextToken);
			} else if (o === 2) throw new b("The split environment accepts no more than two columns", e.nextToken);
			else throw new b("The equation environment accepts only one column", e.nextToken);
			e.consume();
		} else if (r === d) {
			y(), f.length === 1 && t.body.length === 0 && (p.length > 1 || !a) && p.pop(), h.push($t(t.body)), g.length < p.length + 1 && g.push([]);
			break;
		} else if (r === "\\\\") {
			e.consume();
			let n;
			e.gullet.future().text !== " " && (n = e.parseSizeGroup(!0)), m.push(n ? n.value : null), y(), h.push($t(t.body)), g.push(Yt(e)), f = [], p.push(f), v();
		} else throw new b("Expected & or \\\\ or \\cr or " + d, e.nextToken);
	}
	return e.gullet.endGroup(), e.gullet.endGroup(), {
		type: "array",
		mode: e.mode,
		body: p,
		cols: t,
		rowGaps: m,
		hLinesBeforeRow: g,
		envClasses: n,
		autoTag: r,
		scriptLevel: u,
		tags: _,
		labels: h,
		leqno: s,
		arraystretch: c,
		arraycolsep: l
	};
}
function nn(e) {
	return e.slice(0, 1) === "d" ? "display" : "text";
}
var rn = {
	c: "center ",
	l: "left ",
	r: "right "
}, an = (e) => {
	let t = new w("mtd", []);
	return t.style = {
		padding: "0",
		width: "50%"
	}, e.envClasses.includes("multline") && (t.style.width = "7.5%"), t;
}, X = function(e, t) {
	let n = [], r = e.body.length, i = e.hLinesBeforeRow, a = e.tags && e.tags.some((e) => e);
	for (let o = 0; o < r; o++) {
		let s = e.body[o], c = [], l = e.scriptLevel === "text" ? K.TEXT : e.scriptLevel === "script" ? K.SCRIPT : K.DISPLAY;
		for (let n = 0; n < s.length; n++) {
			let i = new w("mtd", [V(s[n], t.withLevel(l))]);
			if (e.envClasses.includes("multline")) {
				let e = o === 0 ? "left" : o === r - 1 ? "right" : "center";
				e !== "center" && i.classes.push("tml-" + e);
			}
			c.push(i);
		}
		let u = e.body[0].length;
		for (let e = 0; e < u - s.length; e++) c.push(new w("mtd", [], [], t));
		if (a) {
			let n = e.tags[o], r;
			n === !0 ? r = new w("mtext", [new Oe(["tml-eqn"])]) : n === !1 ? r = new w("mtext", [], []) : (r = nt(n[0].body, t.withLevel(l), !0), r = Ze(r), r.classes = ["tml-tag"]), r && (c.unshift(an(e)), c.push(an(e)), e.leqno ? c[0].children.push(r) : c[c.length - 1].children.push(r));
		}
		let d = new w("mtr", c, []), f = e.labels.shift();
		f && e.tags && e.tags[o] && (d.setAttribute("id", f), Array.isArray(e.tags[o]) && d.classes.push("tml-tageqn")), o === 0 && i[0].length > 0 && (i[0].length === 2 ? d.children.forEach((e) => {
			e.style.borderTop = "0.15em double";
		}) : d.children.forEach((e) => {
			e.style.borderTop = i[0][0] ? "0.06em dashed" : "0.06em solid";
		})), i[o + 1].length > 0 && (i[o + 1].length === 2 ? d.children.forEach((e) => {
			e.style.borderBottom = "0.15em double";
		}) : d.children.forEach((e) => {
			e.style.borderBottom = i[o + 1][0] ? "0.06em dashed" : "0.06em solid";
		}));
		let p = !0;
		for (let e = 0; e < d.children.length; e++) {
			let t = d.children[e].children[0];
			if (!(t && t.type === "mpadded" && t.attributes.height === "0px")) {
				p = !1;
				break;
			}
		}
		if (p) {
			d.classes.push("ff-squash");
			for (let e = 0; e < d.children.length; e++) d.children[e].style.paddingTop = "0", d.children[e].style.paddingBottom = "0";
		}
		n.push(d);
	}
	if (e.arraystretch && e.arraystretch !== 1) {
		let t = String(1.4 * e.arraystretch - .8) + "ex";
		for (let e = 0; e < n.length; e++) for (let r = 0; r < n[e].children.length; r++) n[e].children[r].style.paddingTop = t, n[e].children[r].style.paddingBottom = t;
	}
	let o, s;
	if (e.envClasses.length > 0 && (o = e.envClasses.includes("abut") || e.envClasses.includes("cases") ? "0" : e.envClasses.includes("small") ? "0.1389" : e.envClasses.includes("cd") ? "0.25" : "0.4", s = "em"), e.arraycolsep) {
		let n = yt(e.arraycolsep, t);
		o = n.number.toFixed(4), s = n.unit;
	}
	if (o) {
		let t = n.length === 0 ? 0 : n[0].children.length, r = (n, r) => n === 0 && r === 0 || n === t - 1 && r === 1 ? "0" : e.envClasses[0] === "align" ? r === 1 ? "0" : a ? n % 2 ? "1" : "0" : n % 2 ? "0" : "1" : o;
		for (let e = 0; e < n.length; e++) for (let t = 0; t < n[e].children.length; t++) n[e].children[t].style.paddingLeft = `${r(t, 0)}${s}`, n[e].children[t].style.paddingRight = `${r(t, 1)}${s}`;
	}
	if (e.envClasses.length === 0) for (let e = 0; e < n.length; e++) n[e].children[0].style.paddingLeft = "0em", n[e].children.length === n[0].children.length && (n[e].children[n[e].children.length - 1].style.paddingRight = "0em");
	if (e.envClasses.length > 0) {
		let t = e.envClasses.includes("align") || e.envClasses.includes("alignat");
		for (let r = 0; r < n.length; r++) {
			let i = n[r];
			if (t) {
				for (let e = 0; e < i.children.length; e++) i.children[e].classes = ["tml-" + (e % 2 ? "left" : "right")];
				if (a) {
					let t = e.leqno ? 0 : i.children.length - 1;
					i.children[t].classes = [];
				}
			}
			if (i.children.length > 1 && e.envClasses.includes("cases") && (i.children[1].style.paddingLeft = "1em"), e.envClasses.includes("cases") || e.envClasses.includes("subarray")) for (let e of i.children) e.classes.push("tml-left");
		}
	}
	let c = new w("mtable", n);
	if (e.envClasses.length > 0 && (e.envClasses.includes("jot") ? c.classes.push("tml-jot") : e.envClasses.includes("small") && c.classes.push("tml-small")), e.scriptLevel === "display" && c.setAttribute("displaystyle", "true"), (e.autoTag || e.envClasses.includes("multline")) && (c.style.width = "100%"), e.cols && e.cols.length > 0) {
		let t = e.cols, n = !1, r = 0, i = t.length;
		for (; t[r].type === "separator";) r += 1;
		for (; t[i - 1].type === "separator";) --i;
		if (t[0].type === "separator") {
			let e = t[1].type === "separator" ? "0.15em double" : t[0].separator === "|" ? "0.06em solid " : "0.06em dashed ";
			for (let t of c.children) t.children[0].style.borderLeft = e;
		}
		let o = a ? 0 : -1;
		for (let e = r; e < i; e++) if (t[e].type === "align") {
			let r = rn[t[e].align];
			o += 1;
			for (let e of c.children) r.trim() !== "center" && o < e.children.length && (e.children[o].classes = ["tml-" + r.trim()]);
			n = !0;
		} else if (t[e].type === "separator") {
			if (n) {
				let n = t[e + 1].type === "separator" ? "0.15em double" : t[e].separator === "|" ? "0.06em solid" : "0.06em dashed";
				for (let e of c.children) o < e.children.length && (e.children[o].style.borderRight = n);
			}
			n = !1;
		}
		if (t[t.length - 1].type === "separator") {
			let e = t[t.length - 2].type === "separator" ? "0.15em double" : t[t.length - 1].separator === "|" ? "0.06em solid" : "0.06em dashed";
			for (let t of c.children) t.children[t.children.length - 1].style.borderRight = e, t.children[t.children.length - 1].style.paddingRight = "0.4em";
		}
	}
	return e.envClasses.includes("small") && (c = new w("mstyle", [c]), c.setAttribute("scriptlevel", "1")), c;
}, on = function(e, t) {
	e.envName.indexOf("ed") === -1 && Xt(e);
	let n = e.envName === "split", r = [], i = tn(e.parser, {
		cols: r,
		emptySingleRow: !0,
		autoTag: n ? void 0 : en(e.envName),
		envClasses: ["abut", "jot"],
		maxNumCols: e.envName === "split" ? 2 : void 0,
		leqno: e.parser.settings.leqno
	}, "display"), a, o = 0, s = e.envName.indexOf("at") > -1;
	if (t[0] && s) {
		let e = "";
		for (let n = 0; n < t[0].body.length; n++) {
			let r = W(t[0].body[n], "textord");
			e += r.text;
		}
		if (isNaN(e)) throw new b("The alignat enviroment requires a numeric first argument.");
		a = Number(e), o = a * 2;
	}
	i.body.forEach(function(e) {
		if (s) {
			let t = e.length / 2;
			if (a < t) throw new b(`Too many math in a row: expected ${a}, but got ${t}`, e[0]);
		} else o < e.length && (o = e.length);
	});
	for (let e = 0; e < o; ++e) {
		let t = "r";
		e % 2 == 1 && (t = "l"), r[e] = {
			type: "align",
			align: t
		};
	}
	return e.envName === "split" || (s ? i.envClasses.push("alignat") : i.envClasses[0] = "align"), i;
};
U({
	type: "array",
	names: ["array", "darray"],
	props: { numArgs: 1 },
	handler(e, t) {
		let n = (Et(t[0]) ? [t[0]] : W(t[0], "ordgroup").body).map(function(e) {
			let t = Tt(e).text;
			if ("lcr".indexOf(t) !== -1) return {
				type: "align",
				align: t
			};
			if (t === "|") return {
				type: "separator",
				separator: "|"
			};
			if (t === ":") return {
				type: "separator",
				separator: ":"
			};
			throw new b("Unknown column alignment: " + t, e);
		}), [r, i] = Qt(e.parser.gullet.macros), a = {
			cols: n,
			envClasses: ["array"],
			maxNumCols: n.length,
			arraystretch: r,
			arraycolsep: i
		};
		return tn(e.parser, a, nn(e.envName));
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: [
		"matrix",
		"pmatrix",
		"bmatrix",
		"Bmatrix",
		"vmatrix",
		"Vmatrix",
		"matrix*",
		"pmatrix*",
		"bmatrix*",
		"Bmatrix*",
		"vmatrix*",
		"Vmatrix*"
	],
	props: { numArgs: 0 },
	handler(e) {
		let t = {
			matrix: null,
			pmatrix: ["(", ")"],
			bmatrix: ["[", "]"],
			Bmatrix: ["\\{", "\\}"],
			vmatrix: ["|", "|"],
			Vmatrix: ["\\Vert", "\\Vert"]
		}[e.envName.replace("*", "")], n = "c", r = {
			envClasses: [],
			cols: []
		};
		if (e.envName.charAt(e.envName.length - 1) === "*") {
			let t = e.parser;
			if (t.consumeSpaces(), t.fetch().text === "[") {
				if (t.consume(), t.consumeSpaces(), n = t.fetch().text, "lcr".indexOf(n) === -1) throw new b("Expected l or c or r", t.nextToken);
				t.consume(), t.consumeSpaces(), t.expect("]"), t.consume(), r.cols = [];
			}
		}
		let i = tn(e.parser, r, "text");
		i.cols = i.body.length > 0 ? Array(i.body[0].length).fill({
			type: "align",
			align: n
		}) : [];
		let [a, o] = Qt(e.parser.gullet.macros);
		return i.arraystretch = a, o && !(o === 6 && o === "pt") && (i.arraycolsep = o), t ? {
			type: "leftright",
			mode: e.mode,
			body: [i],
			left: t[0],
			right: t[1],
			rightColor: void 0
		} : i;
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: ["bordermatrix"],
	props: { numArgs: 0 },
	handler(e) {
		let t = tn(e.parser, {
			cols: [],
			envClasses: ["bordermatrix"]
		}, "text");
		return t.cols = t.body.length > 0 ? Array(t.body[0].length).fill({
			type: "align",
			align: "c"
		}) : [], t.envClasses = [], t.arraystretch = 1, e.envName === "matrix" ? t : Ft(t, e.delimiters);
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: ["smallmatrix"],
	props: { numArgs: 0 },
	handler(e) {
		return tn(e.parser, { envClasses: ["small"] }, "script");
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: ["subarray"],
	props: { numArgs: 1 },
	handler(e, t) {
		let n = (Et(t[0]) ? [t[0]] : W(t[0], "ordgroup").body).map(function(e) {
			let t = Tt(e).text;
			if ("lc".indexOf(t) !== -1) return {
				type: "align",
				align: t
			};
			throw new b("Unknown column alignment: " + t, e);
		});
		if (n.length > 1) throw new b("{subarray} can contain only one column");
		let r = {
			cols: n,
			envClasses: ["small"]
		};
		if (r = tn(e.parser, r, "script"), r.body.length > 0 && r.body[0].length > 1) throw new b("{subarray} can contain only one column");
		return r;
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: [
		"cases",
		"dcases",
		"rcases",
		"drcases"
	],
	props: { numArgs: 0 },
	handler(e) {
		let t = tn(e.parser, {
			cols: [],
			envClasses: ["cases"]
		}, nn(e.envName));
		return {
			type: "leftright",
			mode: e.mode,
			body: [t],
			left: e.envName.indexOf("r") > -1 ? "." : "\\{",
			right: e.envName.indexOf("r") > -1 ? "\\}" : ".",
			rightColor: void 0
		};
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: [
		"align",
		"align*",
		"aligned",
		"split"
	],
	props: { numArgs: 0 },
	handler: on,
	mathmlBuilder: X
}), U({
	type: "array",
	names: [
		"alignat",
		"alignat*",
		"alignedat"
	],
	props: { numArgs: 1 },
	handler: on,
	mathmlBuilder: X
}), U({
	type: "array",
	names: [
		"gathered",
		"gather",
		"gather*"
	],
	props: { numArgs: 0 },
	handler(e) {
		e.envName !== "gathered" && Xt(e);
		let t = {
			cols: [],
			envClasses: ["abut", "jot"],
			autoTag: en(e.envName),
			emptySingleRow: !0,
			leqno: e.parser.settings.leqno
		};
		return tn(e.parser, t, "display");
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: ["equation", "equation*"],
	props: { numArgs: 0 },
	handler(e) {
		Xt(e);
		let t = {
			autoTag: en(e.envName),
			emptySingleRow: !0,
			singleRow: !0,
			maxNumCols: 1,
			envClasses: ["align"],
			leqno: e.parser.settings.leqno
		};
		return tn(e.parser, t, "display");
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: ["multline", "multline*"],
	props: { numArgs: 0 },
	handler(e) {
		Xt(e);
		let t = {
			autoTag: e.envName === "multline",
			maxNumCols: 1,
			envClasses: ["jot", "multline"],
			leqno: e.parser.settings.leqno
		};
		return tn(e.parser, t, "display");
	},
	mathmlBuilder: X
}), U({
	type: "array",
	names: ["CD"],
	props: { numArgs: 0 },
	handler(e) {
		return Xt(e), Mt(e.parser);
	},
	mathmlBuilder: X
}), S({
	type: "text",
	names: ["\\hline", "\\hdashline"],
	props: {
		numArgs: 0,
		allowedInText: !0,
		allowedInMath: !0
	},
	handler(e, t) {
		throw new b(`${e.funcName} valid only within array environment`);
	}
});
var sn = wt;
S({
	type: "bordermatrix",
	names: ["\\bordermatrix", "\\matrix"],
	props: {
		numArgs: 0,
		numOptionalArgs: 1
	},
	handler: ({ parser: e, funcName: t }, n, r) => {
		let i = ["(", ")"];
		if (t === "\\bordermatrix" && r[0] && r[0].body) {
			let e = r[0].body;
			e.length === 1 && e[0].type === "delimiter" && (i = [e[0].left, e[0].right]);
		}
		e.consumeSpaces(), e.consume();
		let a = sn.bordermatrix, o = {
			mode: e.mode,
			envName: t.slice(1),
			delimiters: i,
			parser: e
		}, s = a.handler(o);
		return e.expect("}", !0), s;
	}
}), S({
	type: "cancelto",
	names: ["\\cancelto"],
	props: { numArgs: 2 },
	handler({ parser: e }, t) {
		let n = t[0], r = t[1];
		return {
			type: "cancelto",
			mode: e.mode,
			body: r,
			to: n,
			isCharacterBox: pe(r)
		};
	},
	mathmlBuilder(e, t) {
		let n = new w("mrow", [V(e.body, t)], ["ff-narrow"]), r = new w("mphantom", [V(e.body, t)]), i = new w("mrow", [r], ["tml-cancelto"]);
		i.style.color = t.color, e.isCharacterBox && _e.indexOf(e.body.body[0].text) > -1 && (i.style.left = "0.1em", i.style.width = "90%");
		let a = new w("mrow", [n, i], ["menclose"]);
		if (!e.isCharacterBox || /[f∫∑]/.test(e.body.body[0].text)) r.style.paddingRight = "0.2em";
		else {
			r.style.padding = "0.5ex 0.1em 0 0";
			let e = new w("mspace", []);
			e.setAttribute("height", "0.85em"), n.children.push(e);
		}
		let o;
		if (e.isCharacterBox) o = new w("mspace", []), o.setAttribute("height", "1em");
		else {
			let n = new w("mpadded", [V(e.body, t)]);
			n.setAttribute("width", "0.1px"), o = new w("mphantom", [n]);
		}
		let s = V(e.to, t);
		s.style.color = t.color;
		let c = new w("mpadded", [s]);
		if (!e.isCharacterBox || /[f∫∑]/.test(e.body.body[0].text)) {
			let e = new w("mspace", []);
			e.setAttribute("width", "0.2em"), c.children.unshift(e);
		}
		c.setAttribute("width", "0.1px");
		let l = new w("mover", [o, c]), u = new w("mrow", [], ["ff-nudge-left"]);
		return Me([Qe([a, l]), u]);
	}
}), S({
	type: "textord",
	names: ["\\@char"],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler({ parser: e, token: t }, n) {
		let r = W(n[0], "ordgroup").body, i = "";
		for (let e = 0; e < r.length; e++) {
			let t = W(r[e], "textord");
			i += t.text;
		}
		let a = parseInt(i);
		if (isNaN(a)) throw new b(`\\@char has non-numeric argument ${i}`, t);
		return {
			type: "textord",
			mode: e.mode,
			text: String.fromCodePoint(a)
		};
	}
});
var cn = /^(#[a-f0-9]{3}|#?[a-f0-9]{6})$/i, ln = /^(#[a-f0-9]{3}|#?[a-f0-9]{6}|[a-z]+)$/i, un = /^ *\d{1,3} *(?:, *\d{1,3} *){2}$/, dn = /^ *[10](?:\.\d*)? *(?:, *[10](?:\.\d*)? *){2}$/, fn = /^[a-f0-9]{6}$/i, pn = (e) => {
	let t = e.toString(16);
	return t.length === 1 && (t = "0" + t), t;
}, mn = JSON.parse("{\n  \"Apricot\": \"#ffb484\",\n  \"Aquamarine\": \"#08b4bc\",\n  \"Bittersweet\": \"#c84c14\",\n  \"blue\": \"#0000FF\",\n  \"Blue\": \"#303494\",\n  \"BlueGreen\": \"#08b4bc\",\n  \"BlueViolet\": \"#503c94\",\n  \"BrickRed\": \"#b8341c\",\n  \"brown\": \"#BF8040\",\n  \"Brown\": \"#802404\",\n  \"BurntOrange\": \"#f8941c\",\n  \"CadetBlue\": \"#78749c\",\n  \"CarnationPink\": \"#f884b4\",\n  \"Cerulean\": \"#08a4e4\",\n  \"CornflowerBlue\": \"#40ace4\",\n  \"cyan\": \"#00FFFF\",\n  \"Cyan\": \"#08acec\",\n  \"Dandelion\": \"#ffbc44\",\n  \"darkgray\": \"#404040\",\n  \"DarkOrchid\": \"#a8548c\",\n  \"Emerald\": \"#08ac9c\",\n  \"ForestGreen\": \"#089c54\",\n  \"Fuchsia\": \"#90348c\",\n  \"Goldenrod\": \"#ffdc44\",\n  \"gray\": \"#808080\",\n  \"Gray\": \"#98949c\",\n  \"green\": \"#00FF00\",\n  \"Green\": \"#08a44c\",\n  \"GreenYellow\": \"#e0e474\",\n  \"JungleGreen\": \"#08ac9c\",\n  \"Lavender\": \"#f89cc4\",\n  \"lightgray\": \"#c0c0c0\",\n  \"lime\": \"#BFFF00\",\n  \"LimeGreen\": \"#90c43c\",\n  \"magenta\": \"#FF00FF\",\n  \"Magenta\": \"#f0048c\",\n  \"Mahogany\": \"#b0341c\",\n  \"Maroon\": \"#b03434\",\n  \"Melon\": \"#f89c7c\",\n  \"MidnightBlue\": \"#086494\",\n  \"Mulberry\": \"#b03c94\",\n  \"NavyBlue\": \"#086cbc\",\n  \"olive\": \"#7F7F00\",\n  \"OliveGreen\": \"#407c34\",\n  \"orange\": \"#FF8000\",\n  \"Orange\": \"#f8843c\",\n  \"OrangeRed\": \"#f0145c\",\n  \"Orchid\": \"#b074ac\",\n  \"Peach\": \"#f8945c\",\n  \"Periwinkle\": \"#8074bc\",\n  \"PineGreen\": \"#088c74\",\n  \"pink\": \"#ff7f7f\",\n  \"Plum\": \"#98248c\",\n  \"ProcessBlue\": \"#08b4ec\",\n  \"purple\": \"#BF0040\",\n  \"Purple\": \"#a0449c\",\n  \"RawSienna\": \"#983c04\",\n  \"red\": \"#ff0000\",\n  \"Red\": \"#f01c24\",\n  \"RedOrange\": \"#f86434\",\n  \"RedViolet\": \"#a0246c\",\n  \"Rhodamine\": \"#f0549c\",\n  \"Royallue\": \"#0874bc\",\n  \"RoyalPurple\": \"#683c9c\",\n  \"RubineRed\": \"#f0047c\",\n  \"Salmon\": \"#f8948c\",\n  \"SeaGreen\": \"#30bc9c\",\n  \"Sepia\": \"#701404\",\n  \"SkyBlue\": \"#48c4dc\",\n  \"SpringGreen\": \"#c8dc64\",\n  \"Tan\": \"#e09c74\",\n  \"teal\": \"#007F7F\",\n  \"TealBlue\": \"#08acb4\",\n  \"Thistle\": \"#d884b4\",\n  \"Turquoise\": \"#08b4cc\",\n  \"violet\": \"#800080\",\n  \"Violet\": \"#60449c\",\n  \"VioletRed\": \"#f054a4\",\n  \"WildStrawberry\": \"#f0246c\",\n  \"yellow\": \"#FFFF00\",\n  \"Yellow\": \"#fff404\",\n  \"YellowGreen\": \"#98cc6c\",\n  \"YellowOrange\": \"#ffa41c\"\n}"), hn = (e, t) => {
	let n = "";
	if (e === "HTML") {
		if (!cn.test(t)) throw new b("Invalid HTML input.");
		n = t;
	} else if (e === "RGB") {
		if (!un.test(t)) throw new b("Invalid RGB input.");
		t.split(",").map((e) => {
			n += pn(Number(e.trim()));
		});
	} else {
		if (!dn.test(t)) throw new b("Invalid rbg input.");
		t.split(",").map((e) => {
			let t = Number(e.trim());
			if (t > 1) throw new b("Color rgb input must be < 1.");
			n += pn(Number((t * 255).toFixed(0)));
		});
	}
	return n.charAt(0) !== "#" && (n = "#" + n), n;
}, gn = (e, t, n) => {
	let r = `\\\\color@${e}`;
	if (!ln.exec(e)) throw new b("Invalid color: '" + e + "'", n);
	return fn.test(e) ? "#" + e : (e.charAt(0) === "#" || (t.has(r) ? e = t.get(r).tokens[0].text : mn[e] && (e = mn[e])), e);
}, _n = (e, t) => {
	let n = B(e.body, t.withColor(e.color));
	return n.length === 0 && n.push(new w("mrow")), n = n.map((t) => (t.style.color = e.color, t)), Me(n);
};
S({
	type: "color",
	names: ["\\textcolor"],
	props: {
		numArgs: 2,
		numOptionalArgs: 1,
		allowedInText: !0,
		argTypes: [
			"raw",
			"raw",
			"original"
		]
	},
	handler({ parser: e, token: t }, n, r) {
		let i = r[0] && W(r[0], "raw").string, a = "";
		if (i) {
			let e = W(n[0], "raw").string;
			a = hn(i, e);
		} else a = gn(W(n[0], "raw").string, e.gullet.macros, t);
		let o = n[1];
		return {
			type: "color",
			mode: e.mode,
			color: a,
			isTextColor: !0,
			body: C(o)
		};
	},
	mathmlBuilder: _n
}), S({
	type: "color",
	names: ["\\color"],
	props: {
		numArgs: 1,
		numOptionalArgs: 1,
		allowedInText: !0,
		argTypes: ["raw", "raw"]
	},
	handler({ parser: e, breakOnTokenText: t, token: n }, r, i) {
		let a = i[0] && W(i[0], "raw").string, o = "";
		if (a) {
			let e = W(r[0], "raw").string;
			o = hn(a, e);
		} else o = gn(W(r[0], "raw").string, e.gullet.macros, n);
		let s = e.parseExpression(!0, t, !0);
		return {
			type: "color",
			mode: e.mode,
			color: o,
			isTextColor: !1,
			body: s
		};
	},
	mathmlBuilder: _n
}), S({
	type: "color",
	names: ["\\definecolor"],
	props: {
		numArgs: 3,
		allowedInText: !0,
		argTypes: [
			"raw",
			"raw",
			"raw"
		]
	},
	handler({ parser: e, funcName: t, token: n }, r) {
		let i = W(r[0], "raw").string;
		if (!/^[A-Za-z]+$/.test(i)) throw new b("Color name must be latin letters.", n);
		let a = W(r[1], "raw").string;
		if (![
			"HTML",
			"RGB",
			"rgb"
		].includes(a)) throw new b("Color model must be HTML, RGB, or rgb.", n);
		let o = W(r[2], "raw").string, s = hn(a, o);
		return e.gullet.macros.set(`\\\\color@${i}`, {
			tokens: [{ text: s }],
			numArgs: 0
		}), {
			type: "internal",
			mode: e.mode
		};
	}
}), S({
	type: "cr",
	names: ["\\\\"],
	props: {
		numArgs: 0,
		numOptionalArgs: 0,
		allowedInText: !0
	},
	handler({ parser: e }, t, n) {
		let r = e.gullet.future().text === "[" ? e.parseSizeGroup(!0) : null, i = !e.settings.displayMode;
		return {
			type: "cr",
			mode: e.mode,
			newLine: i,
			size: r && W(r, "size").value
		};
	},
	mathmlBuilder(e, t) {
		let n = new w("mo");
		if (e.newLine && (n.setAttribute("linebreak", "newline"), e.size)) {
			let r = yt(e.size, t);
			n.setAttribute("height", r.number + r.unit);
		}
		return n;
	}
});
var vn = {
	"\\global": "\\global",
	"\\long": "\\\\globallong",
	"\\\\globallong": "\\\\globallong",
	"\\def": "\\gdef",
	"\\gdef": "\\gdef",
	"\\edef": "\\xdef",
	"\\xdef": "\\xdef",
	"\\let": "\\\\globallet",
	"\\futurelet": "\\\\globalfuture"
}, yn = (e) => {
	let t = e.text;
	if (/^(?:[\\{}$&#^_]|EOF)$/.test(t)) throw new b("Expected a control sequence", e);
	return t;
}, bn = (e) => {
	let t = e.gullet.popToken();
	return t.text === "=" && (t = e.gullet.popToken(), t.text === " " && (t = e.gullet.popToken())), t;
}, xn = (e, t, n, r) => {
	let i = e.gullet.macros.get(n.text);
	i ??= (n.noexpand = !0, {
		tokens: [n],
		numArgs: 0,
		unexpandable: !e.gullet.isExpandable(n.text)
	}), e.gullet.macros.set(t, i, r);
};
S({
	type: "internal",
	names: [
		"\\global",
		"\\long",
		"\\\\globallong"
	],
	props: {
		numArgs: 0,
		allowedInText: !0
	},
	handler({ parser: e, funcName: t }) {
		e.consumeSpaces();
		let n = e.fetch();
		if (vn[n.text]) return (t === "\\global" || t === "\\\\globallong") && (n.text = vn[n.text]), W(e.parseFunction(), "internal");
		throw new b("Invalid token after macro prefix", n);
	}
}), S({
	type: "internal",
	names: [
		"\\def",
		"\\gdef",
		"\\edef",
		"\\xdef"
	],
	props: {
		numArgs: 0,
		allowedInText: !0,
		primitive: !0
	},
	handler({ parser: e, funcName: t }) {
		let n = e.gullet.popToken(), r = n.text;
		if (/^(?:[\\{}$&#^_]|EOF)$/.test(r)) throw new b("Expected a control sequence", n);
		let i = 0, a, o = [[]];
		for (; e.gullet.future().text !== "{";) if (n = e.gullet.popToken(), n.text === "#") {
			if (e.gullet.future().text === "{") {
				a = e.gullet.future(), o[i].push("{");
				break;
			}
			if (n = e.gullet.popToken(), !/^[1-9]$/.test(n.text)) throw new b(`Invalid argument number "${n.text}"`);
			if (parseInt(n.text) !== i + 1) throw new b(`Argument number "${n.text}" out of order`);
			i++, o.push([]);
		} else if (n.text === "EOF") throw new b("Expected a macro definition");
		else o[i].push(n.text);
		let { tokens: s } = e.gullet.consumeArg();
		if (a && s.unshift(a), t === "\\edef" || t === "\\xdef") {
			if (s = e.gullet.expandTokens(s), s.length > e.gullet.settings.maxExpand) throw new b("Too many expansions in an " + t);
			s.reverse();
		}
		return e.gullet.macros.set(r, {
			tokens: s,
			numArgs: i,
			delimiters: o
		}, t === vn[t]), {
			type: "internal",
			mode: e.mode
		};
	}
}), S({
	type: "internal",
	names: ["\\let", "\\\\globallet"],
	props: {
		numArgs: 0,
		allowedInText: !0,
		primitive: !0
	},
	handler({ parser: e, funcName: t }) {
		let n = yn(e.gullet.popToken());
		return e.gullet.consumeSpaces(), xn(e, n, bn(e), t === "\\\\globallet"), {
			type: "internal",
			mode: e.mode
		};
	}
}), S({
	type: "internal",
	names: ["\\futurelet", "\\\\globalfuture"],
	props: {
		numArgs: 0,
		allowedInText: !0,
		primitive: !0
	},
	handler({ parser: e, funcName: t }) {
		let n = yn(e.gullet.popToken()), r = e.gullet.popToken(), i = e.gullet.popToken();
		return xn(e, n, i, t === "\\\\globalfuture"), e.gullet.pushToken(i), e.gullet.pushToken(r), {
			type: "internal",
			mode: e.mode
		};
	}
}), S({
	type: "internal",
	names: [
		"\\newcommand",
		"\\renewcommand",
		"\\providecommand"
	],
	props: {
		numArgs: 0,
		allowedInText: !0,
		primitive: !0
	},
	handler({ parser: e, funcName: t }) {
		let n = "", r = e.gullet.popToken();
		r.text === "{" ? (n = yn(e.gullet.popToken()), e.gullet.popToken()) : n = yn(r);
		let i = e.gullet.isDefined(n);
		if (i && t === "\\newcommand") throw new b(`\\newcommand{${n}} attempting to redefine ${n}; use \\renewcommand`);
		if (!i && t === "\\renewcommand") throw new b(`\\renewcommand{${n}} when command ${n} does not yet exist; use \\newcommand`);
		let a = 0;
		if (e.gullet.future().text === "[") {
			let t = e.gullet.popToken();
			if (t = e.gullet.popToken(), !/^[0-9]$/.test(t.text)) throw new b(`Invalid number of arguments: "${t.text}"`);
			if (a = parseInt(t.text), t = e.gullet.popToken(), t.text !== "]") throw new b(`Invalid argument "${t.text}"`);
		}
		let { tokens: o } = e.gullet.consumeArg();
		return t === "\\providecommand" && e.gullet.macros.has(n) || e.gullet.macros.set(n, {
			tokens: o,
			numArgs: a
		}), {
			type: "internal",
			mode: e.mode
		};
	}
});
var Sn = {
	"\\bigl": {
		mclass: "mopen",
		size: 1
	},
	"\\Bigl": {
		mclass: "mopen",
		size: 2
	},
	"\\biggl": {
		mclass: "mopen",
		size: 3
	},
	"\\Biggl": {
		mclass: "mopen",
		size: 4
	},
	"\\bigr": {
		mclass: "mclose",
		size: 1
	},
	"\\Bigr": {
		mclass: "mclose",
		size: 2
	},
	"\\biggr": {
		mclass: "mclose",
		size: 3
	},
	"\\Biggr": {
		mclass: "mclose",
		size: 4
	},
	"\\bigm": {
		mclass: "mrel",
		size: 1
	},
	"\\Bigm": {
		mclass: "mrel",
		size: 2
	},
	"\\biggm": {
		mclass: "mrel",
		size: 3
	},
	"\\Biggm": {
		mclass: "mrel",
		size: 4
	},
	"\\big": {
		mclass: "mord",
		size: 1
	},
	"\\Big": {
		mclass: "mord",
		size: 2
	},
	"\\bigg": {
		mclass: "mord",
		size: 3
	},
	"\\Bigg": {
		mclass: "mord",
		size: 4
	}
}, Cn = {
	"(": ")",
	"\\lparen": "\\rparen",
	"[": "]",
	"\\lbrack": "\\rbrack",
	"\\{": "\\}",
	"\\lbrace": "\\rbrace",
	"⦇": "⦈",
	"\\llparenthesis": "\\rrparenthesis",
	"\\lfloor": "\\rfloor",
	"⌊": "⌋",
	"\\lceil": "\\rceil",
	"⌈": "⌉",
	"\\langle": "\\rangle",
	"⟨": "⟩",
	"\\lAngle": "\\rAngle",
	"⟪": "⟫",
	"\\llangle": "\\rrangle",
	"⦉": "⦊",
	"\\lvert": "\\rvert",
	"\\lVert": "\\rVert",
	"\\lgroup": "\\rgroup",
	"⟮": "⟯",
	"\\lmoustache": "\\rmoustache",
	"⎰": "⎱",
	"\\llbracket": "\\rrbracket",
	"⟦": "⟧",
	"\\lBrace": "\\rBrace",
	"⦃": "⦄"
}, wn = new Set(Object.keys(Cn));
new Set(Object.values(Cn));
var Tn = new Set(/* @__PURE__ */ "(,\\lparen,),\\rparen,[,\\lbrack,],\\rbrack,\\{,\\lbrace,\\},\\rbrace,⦇,\\llparenthesis,⦈,\\rrparenthesis,\\lfloor,\\rfloor,⌊,⌋,\\lceil,\\rceil,⌈,⌉,<,>,\\langle,⟨,\\rangle,⟩,\\lAngle,⟪,\\rAngle,⟫,\\llangle,⦉,\\rrangle,⦊,\\lt,\\gt,\\lvert,\\rvert,\\lVert,\\rVert,\\lgroup,\\rgroup,⟮,⟯,\\lmoustache,\\rmoustache,⎰,⎱,\\llbracket,\\rrbracket,⟦,⟧,\\lBrace,\\rBrace,⦃,⦄,/,\\backslash,|,\\vert,\\|,\\Vert,‖,\\uparrow,\\Uparrow,\\downarrow,\\Downarrow,\\updownarrow,\\Updownarrow,.".split(",")), En = new Set([
	"}",
	"\\left",
	"\\middle",
	"\\right"
]), Dn = (e) => e.length > 0 && (Tn.has(e) || Sn[e] || En.has(e)), On = [
	0,
	1.2,
	1.8,
	2.4,
	3
];
function kn(e, t) {
	e.type === "ordgroup" && e.body.length === 1 && (e = e.body[0]);
	let n = Et(e);
	if (n && Tn.has(n.text)) return (n.text === "<" || n.text === "\\lt") && (n.text = "⟨"), (n.text === ">" || n.text === "\\gt") && (n.text = "⟩"), n;
	throw n ? new b(`Invalid delimiter '${n.text}' after '${t.funcName}'`, e) : new b(`Invalid delimiter type '${e.type}'`, e);
}
var An = new Set([
	"/",
	"\\",
	"\\backslash",
	"∖",
	"\\vert",
	"|"
]), jn = (e, t, n, r) => {
	let i = new w("mo", [z(e === "." ? "" : e, t)]);
	return i.setAttribute("fence", "true"), i.setAttribute("form", n), i.setAttribute("stretchy", r ? "true" : "false"), i;
};
S({
	type: "delimsizing",
	names: [
		"\\bigl",
		"\\Bigl",
		"\\biggl",
		"\\Biggl",
		"\\bigr",
		"\\Bigr",
		"\\biggr",
		"\\Biggr",
		"\\bigm",
		"\\Bigm",
		"\\biggm",
		"\\Biggm",
		"\\big",
		"\\Big",
		"\\bigg",
		"\\Bigg"
	],
	props: {
		numArgs: 1,
		argTypes: ["primitive"]
	},
	handler: (e, t) => {
		let n = kn(t[0], e), r = {
			type: "delimsizing",
			mode: e.parser.mode,
			size: Sn[e.funcName].size,
			mclass: Sn[e.funcName].mclass,
			delim: n.text
		}, i = e.parser.fetch().text;
		return i !== "^" && i !== "_" ? r : {
			type: "ordgroup",
			mode: "math",
			body: [r, {
				type: "ordgroup",
				mode: "math",
				body: []
			}]
		};
	},
	mathmlBuilder: (e) => {
		let t = [], n = e.delim === "." ? "" : e.delim;
		t.push(z(n, e.mode));
		let r = new w("mo", t);
		return e.mclass === "mopen" || e.mclass === "mclose" ? r.setAttribute("fence", "true") : r.setAttribute("fence", "false"), (An.has(n) || n.indexOf("arrow") > -1) && r.setAttribute("stretchy", "true"), r.setAttribute("symmetric", "true"), r.setAttribute("minsize", On[e.size] + "em"), r.setAttribute("maxsize", On[e.size] + "em"), r;
	}
});
function Mn(e) {
	if (!e.body) throw Error("Bug: The delim ParseNode wasn't fully parsed.");
}
S({
	type: "leftright-right",
	names: ["\\right"],
	props: {
		numArgs: 1,
		argTypes: ["primitive"]
	},
	handler: (e, t) => ({
		type: "leftright-right",
		mode: e.parser.mode,
		delim: kn(t[0], e).text
	})
}), S({
	type: "leftright",
	names: ["\\left"],
	props: {
		numArgs: 1,
		argTypes: ["primitive"]
	},
	handler: (e, t) => {
		let n = kn(t[0], e), r = e.parser;
		++r.leftrightDepth;
		let i = r.parseExpression(!1, "\\right", !0), a = r.fetch();
		for (; a.text === "\\middle";) {
			r.consume();
			let e = r.fetch().text;
			if (!E.math[e]) throw new b(`Invalid delimiter '${e}' after '\\middle'`);
			kn({
				type: "atom",
				mode: "math",
				text: e
			}, { funcName: "\\middle" }), i.push({
				type: "middle",
				mode: "math",
				delim: e
			}), r.consume(), i = i.concat(r.parseExpression(!1, "\\right", !0)), a = r.fetch();
		}
		--r.leftrightDepth, r.expect("\\right", !1);
		let o = W(r.parseFunction(), "leftright-right");
		return {
			type: "leftright",
			mode: r.mode,
			body: i,
			left: n.text,
			right: o.delim,
			isStretchy: !0
		};
	},
	mathmlBuilder: (e, t) => {
		Mn(e);
		let n = B(e.body, t), r = jn(e.left, e.mode, "prefix", !0);
		n.unshift(r);
		let i = jn(e.right, e.mode, "postfix", !0);
		if (e.body.length > 0) {
			let t = e.body[e.body.length - 1];
			t.type === "color" && !t.isTextColor && i.setAttribute("mathcolor", t.color);
		}
		return n.push(i), Qe(n);
	}
}), S({
	type: "delimiter",
	names: Array.from(wn),
	props: {
		numArgs: 0,
		allowedInText: !0,
		allowedInMath: !0,
		allowedInArgument: !0
	},
	handler: ({ parser: e, funcName: t, token: n }) => {
		if (e.mode === "text") return {
			type: "textord",
			mode: "text",
			text: t,
			loc: n.loc
		};
		if (!e.settings.wrapDelimiterPairs) return {
			type: "atom",
			mode: "math",
			family: "open",
			loc: n.loc,
			text: t
		};
		let r = Cn[t], i = e.parseExpression(!1, r, !1);
		if (e.fetch().text !== r) throw new b("Unmatched delimiter");
		return e.consume(), {
			type: "delimiter",
			mode: e.mode,
			body: i,
			left: t,
			right: r
		};
	},
	mathmlBuilder: (e, t) => {
		Mn(e);
		let n = B(e.body, t), r = jn(e.left, e.mode, "prefix", !1);
		n.unshift(r);
		let i = jn(e.right, e.mode, "postfix", !1);
		if (e.body.length > 0) {
			let t = e.body[e.body.length - 1];
			t.type === "color" && !t.isTextColor && i.setAttribute("mathcolor", t.color);
		}
		return n.push(i), Qe(n);
	}
}), S({
	type: "middle",
	names: ["\\middle"],
	props: {
		numArgs: 1,
		argTypes: ["primitive"]
	},
	handler: (e, t) => {
		let n = kn(t[0], e);
		if (!e.parser.leftrightDepth) throw new b("\\middle without preceding \\left", n);
		return {
			type: "middle",
			mode: e.parser.mode,
			delim: n.text
		};
	},
	mathmlBuilder: (e) => {
		let t = z(e.delim, e.mode), n = new w("mo", [t]);
		return n.setAttribute("stretchy", "true"), n.setAttribute("form", "infix"), t.text !== "/" && (n.setAttribute("lspace", "0.05em"), n.setAttribute("rspace", "0.05em")), n;
	}
});
var Nn = [
	"\\boxed",
	"\\fcolorbox",
	"\\colorbox"
], Pn = (e, t) => {
	let n = new w(Nn.includes(e.label) ? "mrow" : "menclose", [V(e.body, t)]);
	switch (e.label) {
		case "\\overline":
			n.setAttribute("notation", "top"), n.classes.push("tml-overline");
			break;
		case "\\underline":
			n.setAttribute("notation", "bottom"), n.classes.push("tml-underline");
			break;
		case "\\cancel":
			n.setAttribute("notation", "updiagonalstrike"), n.children.push(new w("mrow", [], ["tml-cancel", "upstrike"]));
			break;
		case "\\bcancel":
			n.setAttribute("notation", "downdiagonalstrike"), n.children.push(new w("mrow", [], ["tml-cancel", "downstrike"]));
			break;
		case "\\sout":
			n.setAttribute("notation", "horizontalstrike"), n.children.push(new w("mrow", [], ["tml-cancel", "sout"]));
			break;
		case "\\xcancel":
			n.setAttribute("notation", "updiagonalstrike downdiagonalstrike"), n.children.push(new w("mrow", [], ["tml-cancel", "tml-xcancel"]));
			break;
		case "\\longdiv":
			n.setAttribute("notation", "longdiv"), n.classes.push("longdiv-top"), n.children.push(new w("mrow", [], ["longdiv-arc"]));
			break;
		case "\\phase":
			n.setAttribute("notation", "phasorangle"), n.classes.push("phasor-bottom"), n.children.push(new w("mrow", [], ["phasor-angle"]));
			break;
		case "\\textcircled":
			n.setAttribute("notation", "circle"), n.classes.push("circle-pad"), n.children.push(new w("mrow", [], ["textcircle"]));
			break;
		case "\\angl":
			n.setAttribute("notation", "actuarial"), n.classes.push("actuarial");
			break;
		case "\\boxed":
			n.style.padding = "3pt", n.style.border = "1px solid", n.setAttribute("scriptlevel", "0"), n.setAttribute("displaystyle", "true");
			break;
		case "\\fbox":
			n.setAttribute("notation", "box"), n.classes.push("tml-fbox");
			break;
		case "\\fcolorbox":
		case "\\colorbox":
			n.style.padding = "0.3em", e.label === "\\fcolorbox" && (n.style.border = "0.0667em solid " + String(e.borderColor));
			break;
	}
	return e.backgroundColor && n.setAttribute("mathbackground", e.backgroundColor), n;
};
S({
	type: "enclose",
	names: ["\\colorbox"],
	props: {
		numArgs: 2,
		numOptionalArgs: 1,
		allowedInText: !0,
		argTypes: [
			"raw",
			"raw",
			"text"
		]
	},
	handler({ parser: e, funcName: t }, n, r) {
		let i = r[0] && W(r[0], "raw").string, a = "";
		if (i) {
			let e = W(n[0], "raw").string;
			a = hn(i, e);
		} else a = gn(W(n[0], "raw").string, e.gullet.macros);
		let o = n[1];
		return {
			type: "enclose",
			mode: e.mode,
			label: t,
			backgroundColor: a,
			body: o
		};
	},
	mathmlBuilder: Pn
}), S({
	type: "enclose",
	names: ["\\fcolorbox"],
	props: {
		numArgs: 3,
		numOptionalArgs: 1,
		allowedInText: !0,
		argTypes: [
			"raw",
			"raw",
			"raw",
			"text"
		]
	},
	handler({ parser: e, funcName: t }, n, r) {
		let i = r[0] && W(r[0], "raw").string, a = "", o;
		if (i) {
			let e = W(n[0], "raw").string, t = W(n[0], "raw").string;
			a = hn(i, e), o = hn(i, t);
		} else a = gn(W(n[0], "raw").string, e.gullet.macros), o = gn(W(n[1], "raw").string, e.gullet.macros);
		let s = n[2];
		return {
			type: "enclose",
			mode: e.mode,
			label: t,
			backgroundColor: o,
			borderColor: a,
			body: s
		};
	},
	mathmlBuilder: Pn
}), S({
	type: "enclose",
	names: ["\\fbox"],
	props: {
		numArgs: 1,
		argTypes: ["hbox"],
		allowedInText: !0
	},
	handler({ parser: e }, t) {
		return {
			type: "enclose",
			mode: e.mode,
			label: "\\fbox",
			body: t[0]
		};
	}
}), S({
	type: "enclose",
	names: [
		"\\angl",
		"\\cancel",
		"\\bcancel",
		"\\xcancel",
		"\\overline",
		"\\boxed",
		"\\longdiv",
		"\\phase"
	],
	props: { numArgs: 1 },
	handler({ parser: e, funcName: t }, n) {
		let r = n[0];
		return {
			type: "enclose",
			mode: e.mode,
			label: t,
			body: r
		};
	},
	mathmlBuilder: Pn
}), S({
	type: "enclose",
	names: ["\\sout"],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler({ parser: e, funcName: t }, n) {
		let r = n[0];
		return {
			type: "enclose",
			mode: e.mode,
			label: t,
			body: r
		};
	},
	mathmlBuilder: Pn
}), S({
	type: "enclose",
	names: ["\\underline"],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler({ parser: e, funcName: t }, n) {
		let r = n[0];
		return {
			type: "enclose",
			mode: e.mode,
			label: t,
			body: r
		};
	},
	mathmlBuilder: Pn
}), S({
	type: "enclose",
	names: ["\\textcircled"],
	props: {
		numArgs: 1,
		argTypes: ["text"],
		allowedInArgument: !0,
		allowedInText: !0
	},
	handler({ parser: e, funcName: t }, n) {
		let r = n[0];
		return {
			type: "enclose",
			mode: e.mode,
			label: t,
			body: r
		};
	},
	mathmlBuilder: Pn
}), S({
	type: "environment",
	names: ["\\begin", "\\end"],
	props: {
		numArgs: 1,
		argTypes: ["text"]
	},
	handler({ parser: e, funcName: t }, n) {
		let r = n[0];
		if (r.type !== "ordgroup") throw new b("Invalid environment name", r);
		let i = "";
		for (let e = 0; e < r.body.length; ++e) i += W(r.body[e], "textord").text;
		if (t === "\\begin") {
			if (!Object.prototype.hasOwnProperty.call(sn, i)) throw new b("No such environment: " + i, r);
			let t = sn[i], { args: n, optArgs: a } = e.parseArguments("\\begin{" + i + "}", t), o = {
				mode: e.mode,
				envName: i,
				parser: e
			}, s = t.handler(o, n, a);
			e.expect("\\end", !1);
			let c = e.nextToken, l = W(e.parseFunction(), "environment");
			if (l.name !== i) throw new b(`Mismatch: \\begin{${i}} matched by \\end{${l.name}}`, c);
			return s;
		}
		return {
			type: "environment",
			mode: e.mode,
			name: i,
			nameGroup: r
		};
	}
}), S({
	type: "envTag",
	names: ["\\env@tag"],
	props: {
		numArgs: 1,
		argTypes: ["math"]
	},
	handler({ parser: e }, t) {
		return {
			type: "envTag",
			mode: e.mode,
			body: t[0]
		};
	},
	mathmlBuilder(e, t) {
		return new w("mrow");
	}
}), S({
	type: "noTag",
	names: ["\\env@notag"],
	props: { numArgs: 0 },
	handler({ parser: e }) {
		return {
			type: "noTag",
			mode: e.mode
		};
	},
	mathmlBuilder(e, t) {
		return new w("mrow");
	}
});
var Fn = Object.freeze({
	B: 8426,
	E: 8427,
	F: 8427,
	H: 8387,
	I: 8391,
	L: 8390,
	M: 8422,
	R: 8393,
	e: 8394,
	g: 8355,
	o: 8389
}), In = Object.freeze({
	C: 8426,
	H: 8388,
	I: 8392,
	R: 8394,
	Z: 8398
}), Ln = Object.freeze({
	C: 8383,
	H: 8389,
	N: 8391,
	P: 8393,
	Q: 8393,
	R: 8395,
	Z: 8394
}), Rn = Object.freeze({
	ϵ: 119527,
	ϑ: 119564,
	ϰ: 119534,
	φ: 119577,
	ϱ: 119535,
	ϖ: 119563
}), zn = Object.freeze({
	ϵ: 119643,
	ϑ: 119680,
	ϰ: 119650,
	φ: 119693,
	ϱ: 119651,
	ϖ: 119679
}), Bn = Object.freeze({
	ϵ: 119701,
	ϑ: 119738,
	ϰ: 119708,
	φ: 119751,
	ϱ: 119709,
	ϖ: 119737
}), Vn = Object.freeze({
	ϵ: 119759,
	ϑ: 119796,
	ϰ: 119766,
	φ: 119809,
	ϱ: 119767,
	ϖ: 119795
}), Hn = Object.freeze({
	upperCaseLatin: {
		normal: (e) => 0,
		bold: (e) => 119743,
		italic: (e) => 119795,
		"bold-italic": (e) => 119847,
		script: (e) => Fn[e] || 119899,
		"script-bold": (e) => 119951,
		fraktur: (e) => In[e] || 120003,
		"fraktur-bold": (e) => 120107,
		"double-struck": (e) => Ln[e] || 120055,
		"sans-serif": (e) => 120159,
		"sans-serif-bold": (e) => 120211,
		"sans-serif-italic": (e) => 120263,
		"sans-serif-bold-italic": (e) => 120380,
		monospace: (e) => 120367
	},
	lowerCaseLatin: {
		normal: (e) => 0,
		bold: (e) => 119737,
		italic: (e) => e === "h" ? 8358 : 119789,
		"bold-italic": (e) => 119841,
		script: (e) => Fn[e] || 119893,
		"script-bold": (e) => 119945,
		fraktur: (e) => 119997,
		"fraktur-bold": (e) => 120101,
		"double-struck": (e) => 120049,
		"sans-serif": (e) => 120153,
		"sans-serif-bold": (e) => 120205,
		"sans-serif-italic": (e) => 120257,
		"sans-serif-bold-italic": (e) => 120309,
		monospace: (e) => 120361
	},
	upperCaseGreek: {
		normal: (e) => 0,
		bold: (e) => 119575,
		italic: (e) => 119633,
		"bold-italic": (e) => 119575,
		script: (e) => 0,
		"script-bold": (e) => 0,
		fraktur: (e) => 0,
		"fraktur-bold": (e) => 0,
		"double-struck": (e) => 0,
		"sans-serif": (e) => 119749,
		"sans-serif-bold": (e) => 119749,
		"sans-serif-italic": (e) => 0,
		"sans-serif-bold-italic": (e) => 119807,
		monospace: (e) => 0
	},
	lowerCaseGreek: {
		normal: (e) => 0,
		bold: (e) => 119569,
		italic: (e) => 119627,
		"bold-italic": (e) => e === "ϕ" ? 119678 : 119685,
		script: (e) => 0,
		"script-bold": (e) => 0,
		fraktur: (e) => 0,
		"fraktur-bold": (e) => 0,
		"double-struck": (e) => 0,
		"sans-serif": (e) => 119743,
		"sans-serif-bold": (e) => 119743,
		"sans-serif-italic": (e) => 0,
		"sans-serif-bold-italic": (e) => 119801,
		monospace: (e) => 0
	},
	varGreek: {
		normal: (e) => 0,
		bold: (e) => Rn[e] || -51,
		italic: (e) => 0,
		"bold-italic": (e) => zn[e] || 58,
		script: (e) => 0,
		"script-bold": (e) => 0,
		fraktur: (e) => 0,
		"fraktur-bold": (e) => 0,
		"double-struck": (e) => 0,
		"sans-serif": (e) => Bn[e] || 116,
		"sans-serif-bold": (e) => Bn[e] || 116,
		"sans-serif-italic": (e) => 0,
		"sans-serif-bold-italic": (e) => Vn[e] || 174,
		monospace: (e) => 0
	},
	numeral: {
		normal: (e) => 0,
		bold: (e) => 120734,
		italic: (e) => 0,
		"bold-italic": (e) => 0,
		script: (e) => 0,
		"script-bold": (e) => 0,
		fraktur: (e) => 0,
		"fraktur-bold": (e) => 0,
		"double-struck": (e) => 120744,
		"sans-serif": (e) => 120754,
		"sans-serif-bold": (e) => 120764,
		"sans-serif-italic": (e) => 0,
		"sans-serif-bold-italic": (e) => 0,
		monospace: (e) => 120774
	}
}), Un = (e, t) => {
	let n = e.codePointAt(0), r = 64 < n && n < 91 ? "upperCaseLatin" : 96 < n && n < 123 ? "lowerCaseLatin" : 912 < n && n < 938 ? "upperCaseGreek" : 944 < n && n < 970 || e === "ϕ" ? "lowerCaseGreek" : 120545 < n && n < 120572 || Rn[e] ? "varGreek" : 47 < n && n < 58 ? "numeral" : "other";
	return r === "other" ? e : String.fromCodePoint(n + Hn[r][t](e));
}, Wn = Object.freeze({
	a: "ᴀ",
	b: "ʙ",
	c: "ᴄ",
	d: "ᴅ",
	e: "ᴇ",
	f: "ꜰ",
	g: "ɢ",
	h: "ʜ",
	i: "ɪ",
	j: "ᴊ",
	k: "ᴋ",
	l: "ʟ",
	m: "ᴍ",
	n: "ɴ",
	o: "ᴏ",
	p: "ᴘ",
	q: "ǫ",
	r: "ʀ",
	s: "s",
	t: "ᴛ",
	u: "ᴜ",
	v: "ᴠ",
	w: "ᴡ",
	x: "x",
	y: "ʏ",
	z: "ᴢ"
}), Gn = ["mathrm", "mathit"], Kn = (e, t) => {
	if (!Gn.includes(t) || !e.body || e.body.type !== "ordgroup" || e.body.body.length === 1 || e.body.body[0].type !== "mathord") return !1;
	for (let t = 1; t < e.body.body.length; t++) {
		let n = e.body.body[t].type;
		if (!(n === "mathord" || n === "textord" && !isNaN(e.body.body[t].text))) return !1;
	}
	return !0;
}, qn = (e, t) => {
	let n = e.font, r = t.withFont(n), i = V(e.body, r);
	if (i.children.length === 0) return i;
	if (n === "boldsymbol" && [
		"mo",
		"mpadded",
		"mrow"
	].includes(i.type)) return i.style.fontWeight = "bold", i;
	if (Kn(e, n)) {
		let e = i.children[0].children[0].children ? i.children[0].children[0] : i.children[0];
		delete e.attributes.mathvariant;
		for (let t = 1; t < i.children.length; t++) e.children[0].text += i.children[t].children[0].children ? i.children[t].children[0].children[0].text : i.children[t].children[0].text;
		if (n === "mathit") return e.children[0].text = e.children[0].text.split("").map((e) => Un(e, "italic")).join(""), e;
		let t = new w("mpadded", [e]);
		return t.setAttribute("lspace", "0"), t;
	}
	let a = i.children[0].type === "mo";
	for (let e = 1; e < i.children.length; e++) i.children[e].type === "mo" && n === "boldsymbol" && (i.children[e].style.fontWeight = "bold"), i.children[e].type !== "mi" && (a = !1), (i.children[e].attributes && i.children[e].attributes.mathvariant || "") !== "normal" && (a = !1);
	if (!a) return i;
	let o = i.children[0];
	for (let e = 1; e < i.children.length; e++) o.children.push(i.children[e].children[0]);
	return o.attributes.mathvariant && o.attributes.mathvariant === "normal" ? new w("mrow", [new w("mtext", new T("​")), o]) : o;
}, Jn = {
	"\\Bbb": "\\mathbb",
	"\\bold": "\\mathbf",
	"\\frak": "\\mathfrak",
	"\\bm": "\\boldsymbol"
};
S({
	type: "font",
	names: [
		"\\mathrm",
		"\\mathit",
		"\\mathbf",
		"\\mathnormal",
		"\\up@greek",
		"\\boldsymbol",
		"\\mathbb",
		"\\mathcal",
		"\\mathfrak",
		"\\mathscr",
		"\\mathsf",
		"\\mathsfit",
		"\\mathtt",
		"\\Bbb",
		"\\bm",
		"\\bold",
		"\\frak"
	],
	props: {
		numArgs: 1,
		allowedInArgument: !0
	},
	handler: ({ parser: e, funcName: t }, n) => {
		let r = Se(n[0]), i = t;
		return i in Jn && (i = Jn[i]), {
			type: "font",
			mode: e.mode,
			font: i.slice(1),
			body: r
		};
	},
	mathmlBuilder: qn
}), S({
	type: "font",
	names: [
		"\\rm",
		"\\sf",
		"\\tt",
		"\\bf",
		"\\it",
		"\\cal"
	],
	props: {
		numArgs: 0,
		allowedInText: !0
	},
	handler: ({ parser: e, funcName: t, breakOnTokenText: n }, r) => {
		let { mode: i } = e, a = e.parseExpression(!0, n, !0);
		return {
			type: "font",
			mode: i,
			font: `math${t.slice(1)}`,
			body: {
				type: "ordgroup",
				mode: e.mode,
				body: a
			}
		};
	},
	mathmlBuilder: qn
});
var Yn = [
	"display",
	"text",
	"script",
	"scriptscript"
], Xn = {
	auto: -1,
	display: 0,
	text: 0,
	script: 1,
	scriptscript: 2
}, Zn = (e, t) => {
	let n = t;
	if (e === "display") {
		let e = n.level >= K.SCRIPT ? K.TEXT : K.DISPLAY;
		n = n.withLevel(e);
	} else e === "text" && n.level === K.DISPLAY ? n = n.withLevel(K.TEXT) : e === "auto" ? n = n.incrementLevel() : e === "script" ? n = n.withLevel(K.SCRIPT) : e === "scriptscript" && (n = n.withLevel(K.SCRIPTSCRIPT));
	return n;
}, Qn = (e, t) => {
	t = Zn(e.scriptLevel, t);
	let n = V(e.numer, t), r = V(e.denom, t);
	t.level === 3 && (n.style.mathDepth = "2", n.setAttribute("scriptlevel", "2"), r.style.mathDepth = "2", r.setAttribute("scriptlevel", "2"));
	let i = new w("mfrac", [n, r]);
	if (!e.hasBarLine) i.setAttribute("linethickness", "0px");
	else if (e.barSize) {
		let n = yt(e.barSize, t);
		i.setAttribute("linethickness", n.number + n.unit);
	}
	if (e.leftDelim != null || e.rightDelim != null) {
		let t = [];
		if (e.leftDelim != null) {
			let n = new w("mo", [new T(e.leftDelim.replace("\\", ""))]);
			n.setAttribute("fence", "true"), t.push(n);
		}
		if (t.push(i), e.rightDelim != null) {
			let n = new w("mo", [new T(e.rightDelim.replace("\\", ""))]);
			n.setAttribute("fence", "true"), t.push(n);
		}
		i = Qe(t);
	}
	return e.scriptLevel !== "auto" && (i = new w("mstyle", [i]), i.setAttribute("displaystyle", String(e.scriptLevel === "display")), i.setAttribute("scriptlevel", Xn[e.scriptLevel])), i;
};
S({
	type: "genfrac",
	names: [
		"\\cfrac",
		"\\dfrac",
		"\\frac",
		"\\tfrac",
		"\\dbinom",
		"\\binom",
		"\\tbinom",
		"\\\\atopfrac",
		"\\\\bracefrac",
		"\\\\brackfrac"
	],
	props: {
		numArgs: 2,
		allowedInArgument: !0
	},
	handler: ({ parser: e, funcName: t }, n) => {
		let r = n[0], i = n[1], a = !1, o = null, s = null, c = "auto";
		switch (t) {
			case "\\cfrac":
			case "\\dfrac":
			case "\\frac":
			case "\\tfrac":
				a = !0;
				break;
			case "\\\\atopfrac":
				a = !1;
				break;
			case "\\dbinom":
			case "\\binom":
			case "\\tbinom":
				o = "(", s = ")";
				break;
			case "\\\\bracefrac":
				o = "\\{", s = "\\}";
				break;
			case "\\\\brackfrac":
				o = "[", s = "]";
				break;
			default: throw Error("Unrecognized genfrac command");
		}
		return t === "\\cfrac" || t.startsWith("\\d") ? c = "display" : t.startsWith("\\t") && (c = "text"), {
			type: "genfrac",
			mode: e.mode,
			continued: !1,
			numer: r,
			denom: i,
			hasBarLine: a,
			leftDelim: o,
			rightDelim: s,
			scriptLevel: c,
			barSize: null
		};
	},
	mathmlBuilder: Qn
}), S({
	type: "infix",
	names: [
		"\\over",
		"\\choose",
		"\\atop",
		"\\brace",
		"\\brack"
	],
	props: {
		numArgs: 0,
		infix: !0
	},
	handler({ parser: e, funcName: t, token: n }) {
		let r;
		switch (t) {
			case "\\over":
				r = "\\frac";
				break;
			case "\\choose":
				r = "\\binom";
				break;
			case "\\atop":
				r = "\\\\atopfrac";
				break;
			case "\\brace":
				r = "\\\\bracefrac";
				break;
			case "\\brack":
				r = "\\\\brackfrac";
				break;
			default: throw Error("Unrecognized infix genfrac command");
		}
		return {
			type: "infix",
			mode: e.mode,
			replaceWith: r,
			token: n
		};
	}
});
var $n = function(e) {
	let t = null;
	return e.length > 0 && (t = e, t = t === "." ? null : t), t;
};
S({
	type: "genfrac",
	names: ["\\genfrac"],
	props: {
		numArgs: 6,
		allowedInArgument: !0,
		argTypes: [
			"math",
			"math",
			"size",
			"text",
			"math",
			"math"
		]
	},
	handler({ parser: e }, t) {
		let n = t[4], r = t[5], i = Se(t[0]), a = i.type === "atom" && i.family === "open" ? $n(i.text) : null, o = Se(t[1]), s = o.type === "atom" && o.family === "close" ? $n(o.text) : null, c = W(t[2], "size"), l, u = null;
		c.isBlank ? l = !0 : (u = c.value, l = u.number > 0);
		let d = "auto", f = t[3];
		if (f.type === "ordgroup") {
			if (f.body.length > 0) {
				let e = W(f.body[0], "textord");
				d = Yn[Number(e.text)];
			}
		} else f = W(f, "textord"), d = Yn[Number(f.text)];
		return {
			type: "genfrac",
			mode: e.mode,
			numer: n,
			denom: r,
			continued: !1,
			hasBarLine: l,
			barSize: u,
			leftDelim: a,
			rightDelim: s,
			scriptLevel: d
		};
	},
	mathmlBuilder: Qn
}), S({
	type: "infix",
	names: ["\\above"],
	props: {
		numArgs: 1,
		argTypes: ["size"],
		infix: !0
	},
	handler({ parser: e, funcName: t, token: n }, r) {
		return {
			type: "infix",
			mode: e.mode,
			replaceWith: "\\\\abovefrac",
			barSize: W(r[0], "size").value,
			token: n
		};
	}
}), S({
	type: "genfrac",
	names: ["\\\\abovefrac"],
	props: {
		numArgs: 3,
		argTypes: [
			"math",
			"size",
			"math"
		]
	},
	handler: ({ parser: e, funcName: t }, n) => {
		let r = n[0], i = me(W(n[1], "infix").barSize), a = n[2], o = i.number > 0;
		return {
			type: "genfrac",
			mode: e.mode,
			numer: r,
			denom: a,
			continued: !1,
			hasBarLine: o,
			barSize: i,
			leftDelim: null,
			rightDelim: null,
			scriptLevel: "auto"
		};
	},
	mathmlBuilder: Qn
}), S({
	type: "hbox",
	names: ["\\hbox"],
	props: {
		numArgs: 1,
		argTypes: ["hbox"],
		allowedInArgument: !0,
		allowedInText: !1
	},
	handler({ parser: e }, t) {
		return {
			type: "hbox",
			mode: e.mode,
			body: C(t[0])
		};
	},
	mathmlBuilder(e, t) {
		let n = t.withLevel(K.TEXT);
		return Ze(nt(e.body, n));
	}
}), S({
	type: "horizBracket",
	names: [
		"\\overbrace",
		"\\underbrace",
		"\\overbracket",
		"\\underbracket"
	],
	props: { numArgs: 1 },
	handler({ parser: e, funcName: t }, n) {
		return {
			type: "horizBracket",
			mode: e.mode,
			label: t,
			isOver: /^\\over/.test(t),
			base: n[0]
		};
	},
	mathmlBuilder: (e, t) => {
		let n = Ie(e.label);
		return n.style["math-depth"] = 0, new w(e.isOver ? "mover" : "munder", [V(e.base, t), n]);
	}
}), S({
	type: "html",
	names: [
		"\\class",
		"\\id",
		"\\style",
		"\\data"
	],
	props: {
		numArgs: 2,
		argTypes: ["raw", "original"],
		allowedInText: !0
	},
	handler: ({ parser: e, funcName: t, token: n }, r) => {
		let i = W(r[0], "raw").string, a = r[1];
		if (e.settings.strict) throw new b(`Function "${t}" is disabled in strict mode`, n);
		let o, s = {};
		switch (t) {
			case "\\class":
				s.class = i, o = {
					command: "\\class",
					class: i
				};
				break;
			case "\\id":
				s.id = i, o = {
					command: "\\id",
					id: i
				};
				break;
			case "\\style":
				s.style = i, o = {
					command: "\\style",
					style: i
				};
				break;
			case "\\data": {
				let e = i.split(",");
				for (let t = 0; t < e.length; t++) {
					let n = e[t].split("=");
					if (n.length !== 2) throw new b("Error parsing key-value for \\data");
					s["data-" + n[0].trim()] = n[1].trim();
				}
				o = {
					command: "\\data",
					attributes: s
				};
				break;
			}
			default: throw Error("Unrecognized html command");
		}
		if (!e.settings.isTrusted(o)) throw new b(`Function "${t}" is not trusted`, n);
		return {
			type: "html",
			mode: e.mode,
			attributes: s,
			body: C(a)
		};
	},
	mathmlBuilder: (e, t) => {
		let n = nt(e.body, t), r = [];
		e.attributes.class && r.push(...e.attributes.class.trim().split(/\s+/)), n.classes = r;
		for (let t in e.attributes) t !== "class" && Object.prototype.hasOwnProperty.call(e.attributes, t) && n.setAttribute(t, e.attributes[t]);
		return n;
	}
});
var er = function(e) {
	if (/^[-+]? *(\d+(\.\d*)?|\.\d+)$/.test(e)) return {
		number: +e,
		unit: "bp"
	};
	{
		let t = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/.exec(e);
		if (!t) throw new b("Invalid size: '" + e + "' in \\includegraphics");
		let n = {
			number: +(t[1] + t[2]),
			unit: t[3]
		};
		if (!_t(n)) throw new b("Invalid unit: '" + n.unit + "' in \\includegraphics.");
		return n;
	}
};
S({
	type: "includegraphics",
	names: ["\\includegraphics"],
	props: {
		numArgs: 1,
		numOptionalArgs: 1,
		argTypes: ["raw", "url"],
		allowedInText: !1
	},
	handler: ({ parser: e, token: t }, n, r) => {
		let i = {
			number: 0,
			unit: "em"
		}, a = {
			number: .9,
			unit: "em"
		}, o = {
			number: 0,
			unit: "em"
		}, s = "";
		if (r[0]) {
			let e = W(r[0], "raw").string.split(",");
			for (let t = 0; t < e.length; t++) {
				let n = e[t].split("=");
				if (n.length === 2) {
					let e = n[1].trim();
					switch (n[0].trim()) {
						case "alt":
							s = e;
							break;
						case "width":
							i = er(e);
							break;
						case "height":
							a = er(e);
							break;
						case "totalheight":
							o = er(e);
							break;
						default: throw new b("Invalid key: '" + n[0] + "' in \\includegraphics.");
					}
				}
			}
		}
		let c = W(n[0], "url").url;
		if (s === "" && (s = c, s = s.replace(/^.*[\\/]/, ""), s = s.substring(0, s.lastIndexOf("."))), !e.settings.isTrusted({
			command: "\\includegraphics",
			url: c
		})) throw new b("Function \"\\includegraphics\" is not trusted", t);
		return {
			type: "includegraphics",
			mode: e.mode,
			alt: s,
			width: i,
			height: a,
			totalheight: o,
			src: c
		};
	},
	mathmlBuilder: (e, t) => {
		let n = yt(e.height, t), r = {
			number: 0,
			unit: "em"
		};
		e.totalheight.number > 0 && e.totalheight.unit === n.unit && e.totalheight.number > n.number && (r.number = e.totalheight.number - n.number, r.unit = n.unit);
		let i = 0;
		e.width.number > 0 && (i = yt(e.width, t));
		let a = { height: n.number + r.number + "em" };
		i.number > 0 && (a.width = i.number + i.unit), r.number > 0 && (a.verticalAlign = -r.number + r.unit);
		let o = new je(e.src, e.alt, a);
		return o.height = n, o.depth = r, new w("mtext", [o]);
	}
}), S({
	type: "kern",
	names: [
		"\\kern",
		"\\mkern",
		"\\hskip",
		"\\mskip"
	],
	props: {
		numArgs: 1,
		argTypes: ["size"],
		primitive: !0,
		allowedInText: !0
	},
	handler({ parser: e, funcName: t, token: n }, r) {
		let i = W(r[0], "size");
		if (e.settings.strict) {
			let r = t[1] === "m", a = i.value.unit === "mu";
			if (r) {
				if (!a) throw new b(`LaTeX's ${t} supports only mu units, not ${i.value.unit} units`, n);
				if (e.mode !== "math") throw new b(`LaTeX's ${t} works only in math mode`, n);
			} else if (a) throw new b(`LaTeX's ${t} doesn't support mu units`, n);
		}
		return {
			type: "kern",
			mode: e.mode,
			dimension: i.value
		};
	},
	mathmlBuilder(e, t) {
		let n = yt(e.dimension, t), r = n.number > 0 && n.unit === "em" ? tr(n.number) : "";
		if (e.mode === "text" && r.length > 0) return new w("mtext", [new T(r)]);
		if (n.number >= 0) {
			let e = new w("mspace");
			return e.setAttribute("width", n.number + n.unit), e;
		} else {
			let e = new w("mrow");
			return e.style.marginLeft = n.number + n.unit, e;
		}
	}
});
var tr = function(e) {
	return e >= .05555 && e <= .05556 ? " " : e >= .1666 && e <= .1667 ? " " : e >= .2222 && e <= .2223 ? " " : e >= .2777 && e <= .2778 ? "  " : "";
}, nr = /[^A-Za-z_0-9-]/g;
S({
	type: "label",
	names: ["\\label"],
	props: {
		numArgs: 1,
		argTypes: ["raw"]
	},
	handler({ parser: e }, t) {
		return {
			type: "label",
			mode: e.mode,
			string: t[0].string.replace(nr, "")
		};
	},
	mathmlBuilder(e, t) {
		let n = new w("mrow", [], ["tml-label"]);
		return e.string.length > 0 && n.setLabel(e.string), n;
	}
});
var rr = [
	"\\clap",
	"\\llap",
	"\\rlap"
];
S({
	type: "lap",
	names: [
		"\\mathllap",
		"\\mathrlap",
		"\\mathclap",
		"\\clap",
		"\\llap",
		"\\rlap"
	],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler: ({ parser: e, funcName: t, token: n }, r) => {
		if (rr.includes(t)) {
			if (e.settings.strict && e.mode !== "text") throw new b(`{${t}} can be used only in text mode.
 Try \\math${t.slice(1)}`, n);
			t = t.slice(1);
		} else t = t.slice(5);
		let i = r[0];
		return {
			type: "lap",
			mode: e.mode,
			alignment: t,
			body: i
		};
	},
	mathmlBuilder: (e, t) => {
		let n;
		e.alignment === "llap" && (n = new w("mpadded", [new w("mphantom", B(C(e.body), t))]), n.setAttribute("width", "0.1px"));
		let r = V(e.body, t), i;
		if (e.alignment === "llap" ? (r.style.position = "absolute", r.style.right = "0", r.style.bottom = "0", i = new w("mpadded", [n, r])) : i = new w("mpadded", [r]), e.alignment === "rlap") e.body.body.length > 0 && e.body.body[0].type === "genfrac" && i.setAttribute("lspace", "0.16667em");
		else {
			let t = e.alignment === "llap" ? "-1" : "-0.5";
			i.setAttribute("lspace", t + "width"), e.alignment === "llap" ? i.style.position = "relative" : (i.style.display = "flex", i.style.justifyContent = "center");
		}
		return i.setAttribute("width", "0.1px"), i;
	}
}), S({
	type: "ordgroup",
	names: ["\\(", "$"],
	props: {
		numArgs: 0,
		allowedInText: !0,
		allowedInMath: !1
	},
	handler({ funcName: e, parser: t }, n) {
		let r = t.mode;
		t.switchMode("math");
		let i = e === "\\(" ? "\\)" : "$", a = t.parseExpression(!1, i);
		return t.expect(i), t.switchMode(r), {
			type: "ordgroup",
			mode: t.mode,
			body: a
		};
	}
}), S({
	type: "text",
	names: ["\\)", "\\]"],
	props: {
		numArgs: 0,
		allowedInText: !0,
		allowedInMath: !1
	},
	handler(e, t) {
		throw new b(`Mismatched ${e.funcName}`, t);
	}
});
var ir = (e, t) => {
	switch (t.level) {
		case K.DISPLAY: return e.display;
		case K.TEXT: return e.text;
		case K.SCRIPT: return e.script;
		case K.SCRIPTSCRIPT: return e.scriptscript;
		default: return e.text;
	}
};
S({
	type: "mathchoice",
	names: ["\\mathchoice"],
	props: {
		numArgs: 4,
		primitive: !0
	},
	handler: ({ parser: e }, t) => ({
		type: "mathchoice",
		mode: e.mode,
		display: C(t[0]),
		text: C(t[1]),
		script: C(t[2]),
		scriptscript: C(t[3])
	}),
	mathmlBuilder: (e, t) => nt(ir(e, t), t)
});
var ar = [
	"text",
	"textord",
	"mathord",
	"atom"
];
function or(e, t) {
	let n, r = B(e.body, t);
	if (e.mclass === "minner") n = new w("mpadded", r);
	else if (e.mclass === "mord") e.isCharacterBox || r[0].type === "mathord" ? (n = r[0], n.type = "mi", n.children.length === 1 && n.children[0].text && n.children[0].text === "∇" && n.setAttribute("mathvariant", "normal")) : n = new w("mi", r);
	else {
		n = new w("mrow", r), e.mustPromote ? (n = r[0], n.type = "mo", e.isCharacterBox && e.body[0].text && /[A-Za-z]/.test(e.body[0].text) && n.setAttribute("mathvariant", "italic")) : n = new w("mrow", r);
		let i = t.level < 2;
		n.type === "mrow" ? i && (e.mclass === "mbin" ? (n.children.unshift(H(.2222)), n.children.push(H(.2222))) : e.mclass === "mrel" ? (n.children.unshift(H(.2778)), n.children.push(H(.2778))) : e.mclass === "mpunct" ? n.children.push(H(.1667)) : e.mclass === "minner" && (n.children.unshift(H(.0556)), n.children.push(H(.0556)))) : e.mclass === "mbin" ? (n.attributes.lspace = i ? "0.2222em" : "0", n.attributes.rspace = i ? "0.2222em" : "0") : e.mclass === "mrel" ? (n.attributes.lspace = i ? "0.2778em" : "0", n.attributes.rspace = i ? "0.2778em" : "0") : e.mclass === "mpunct" ? (n.attributes.lspace = "0em", n.attributes.rspace = i ? "0.1667em" : "0") : e.mclass === "mopen" || e.mclass === "mclose" ? (n.attributes.lspace = "0em", n.attributes.rspace = "0em") : e.mclass === "minner" && i && (n.attributes.lspace = "0.0556em", n.attributes.width = "+0.1111em"), e.mclass === "mopen" || e.mclass === "mclose" || (delete n.attributes.stretchy, delete n.attributes.form);
	}
	return n;
}
S({
	type: "mclass",
	names: [
		"\\mathord",
		"\\mathbin",
		"\\mathrel",
		"\\mathopen",
		"\\mathclose",
		"\\mathpunct",
		"\\mathinner"
	],
	props: {
		numArgs: 1,
		primitive: !0
	},
	handler({ parser: e, funcName: t }, n) {
		let r = n[0], i = pe(r), a = !0, o = {
			type: "mathord",
			text: "",
			mode: e.mode
		}, s = r.body ? r.body : [r];
		for (let t of s) if (ar.includes(t.type)) E[e.mode][t.text] ? o.text += E[e.mode][t.text].replace : t.text ? o.text += t.text : t.body && t.body.map((e) => {
			o.text += e.text;
		});
		else {
			a = !1;
			break;
		}
		return a && t === "\\mathord" && o.type === "mathord" && o.text.length > 1 ? o : {
			type: "mclass",
			mode: e.mode,
			mclass: "m" + t.slice(5),
			body: C(a ? o : r),
			isCharacterBox: i,
			mustPromote: a
		};
	},
	mathmlBuilder: or
});
var sr = (e) => {
	let t = e.type === "ordgroup" && e.body.length && e.body.length === 1 ? e.body[0] : e;
	if (t.type === "atom") {
		let n = e.body.length > 0 && e.body[0].text && E.math[e.body[0].text] ? E.math[e.body[0].text].group : t.family;
		return n === "bin" || n === "rel" ? "m" + n : "mord";
	} else return "mord";
};
S({
	type: "mclass",
	names: ["\\@binrel"],
	props: { numArgs: 2 },
	handler({ parser: e }, t) {
		return {
			type: "mclass",
			mode: e.mode,
			mclass: sr(t[0]),
			body: C(t[1]),
			isCharacterBox: pe(t[1])
		};
	}
}), S({
	type: "mclass",
	names: [
		"\\stackrel",
		"\\overset",
		"\\underset"
	],
	props: { numArgs: 2 },
	handler({ parser: e, funcName: t }, n) {
		let r = n[1], i = n[0], a;
		a = t === "\\stackrel" ? "mrel" : sr(r);
		let o = {
			type: a === "mrel" || a === "mbin" ? "op" : "ordgroup",
			mode: r.mode,
			limits: !0,
			alwaysHandleSupSub: !0,
			parentIsSupSub: !1,
			symbol: !1,
			suppressBaseShift: t !== "\\stackrel",
			body: C(r)
		};
		return {
			type: "supsub",
			mode: i.mode,
			stack: !0,
			base: o,
			sup: t === "\\underset" ? null : i,
			sub: t === "\\underset" ? i : null
		};
	},
	mathmlBuilder: or
});
var cr = (e, t, n) => {
	if (!e) return n;
	let r = V(e, t);
	return r.type === "mrow" && r.children.length === 0 ? n : r;
};
S({
	type: "multiscript",
	names: ["\\sideset", "\\pres@cript"],
	props: { numArgs: 3 },
	handler({ parser: e, funcName: t, token: n }, r) {
		if (r[2].body.length === 0) throw new b(t + "cannot parse an empty base.");
		let i = r[2].body[0];
		if (e.settings.strict && t === "\\sideset" && !i.symbol) throw new b("The base of \\sideset must be a big operator. Try \\prescript.");
		if (r[0].body.length > 0 && r[0].body[0].type !== "supsub" || r[1].body.length > 0 && r[1].body[0].type !== "supsub") throw new b("\\sideset can parse only subscripts and superscripts in its first two arguments", n);
		let a = r[0].body.length > 0 ? r[0].body[0] : null, o = r[1].body.length > 0 ? r[1].body[0] : null;
		return !a && !o ? i : a ? {
			type: "multiscript",
			mode: e.mode,
			isSideset: t === "\\sideset",
			prescripts: a,
			postscripts: o,
			base: i
		} : {
			type: "styling",
			mode: e.mode,
			scriptLevel: "text",
			body: [{
				type: "supsub",
				mode: e.mode,
				base: i,
				sup: o.sup,
				sub: o.sub
			}]
		};
	},
	mathmlBuilder(e, t) {
		let n = V(e.base, t), r = new w("mprescripts"), i = new w("none"), a = [], o = cr(e.prescripts.sub, t, i), s = cr(e.prescripts.sup, t, i);
		return e.isSideset && (o.setAttribute("style", "text-align: left;"), s.setAttribute("style", "text-align: left;")), a = e.postscripts ? [
			n,
			cr(e.postscripts.sub, t, i),
			cr(e.postscripts.sup, t, i),
			r,
			o,
			s
		] : [
			n,
			r,
			o,
			s
		], new w("mmultiscripts", a);
	}
}), S({
	type: "not",
	names: ["\\not"],
	props: {
		numArgs: 1,
		primitive: !0,
		allowedInText: !1
	},
	handler({ parser: e }, t) {
		let n = pe(t[0]), r;
		return n ? (r = C(t[0]), r[0].text.charAt(0) === "\\" && (r[0].text = E.math[r[0].text].replace), r[0].text = r[0].text.slice(0, 1) + "̸" + r[0].text.slice(1)) : r = [
			{
				type: "textord",
				mode: "math",
				text: "̸"
			},
			{
				type: "kern",
				mode: "math",
				dimension: {
					number: -.6,
					unit: "em"
				}
			},
			t[0]
		], {
			type: "not",
			mode: e.mode,
			body: r,
			isCharacterBox: n
		};
	},
	mathmlBuilder(e, t) {
		return e.isCharacterBox ? B(e.body, t, !0)[0] : nt(e.body, t);
	}
});
var lr = [
	"textord",
	"mathord",
	"atom"
], ur = ["\\smallint"], dr = [
	"textord",
	"mathord",
	"ordgroup",
	"close",
	"leftright",
	"font"
], fr = (e) => {
	e.attributes.lspace = "0.1667em", e.attributes.rspace = "0.1667em";
}, pr = (e, t) => {
	let n;
	if (e.symbol) n = new w("mo", [z(e.name, e.mode)]), ur.includes(e.name) ? n.setAttribute("largeop", "false") : n.setAttribute("movablelimits", "false"), e.fromMathOp && fr(n);
	else if (e.body) n = new w("mo", B(e.body, t)), e.fromMathOp && fr(n);
	else if (n = new w("mi", [new T(e.name.slice(1))]), !e.parentIsSupSub) {
		let t = new w("mo", [z("⁡", "text")]), r = [n, t];
		if (e.needsLeadingSpace) {
			let e = new w("mspace");
			e.setAttribute("width", "0.1667em"), r.unshift(e);
		}
		if (!e.isFollowedByDelimiter) {
			let e = new w("mspace");
			e.setAttribute("width", "0.1667em"), r.push(e);
		}
		n = new w("mrow", r);
	}
	return n;
}, mr = {
	"∏": "\\prod",
	"∐": "\\coprod",
	"∑": "\\sum",
	"⋀": "\\bigwedge",
	"⋁": "\\bigvee",
	"⋂": "\\bigcap",
	"⋃": "\\bigcup",
	"⨀": "\\bigodot",
	"⨁": "\\bigoplus",
	"⨂": "\\bigotimes",
	"⨄": "\\biguplus",
	"⨅": "\\bigsqcap",
	"⨆": "\\bigsqcup",
	"⨃": "\\bigcupdot",
	"⨇": "\\bigdoublevee",
	"⨈": "\\bigdoublewedge",
	"⨉": "\\bigtimes"
};
S({
	type: "op",
	names: /* @__PURE__ */ "\\coprod.\\bigvee.\\bigwedge.\\biguplus.\\bigcupplus.\\bigcupdot.\\bigcap.\\bigcup.\\bigdoublevee.\\bigdoublewedge.\\intop.\\prod.\\sum.\\bigotimes.\\bigoplus.\\bigodot.\\bigsqcap.\\bigsqcup.\\bigtimes.\\smallint.∏.∐.∑.⋀.⋁.⋂.⋃.⨀.⨁.⨂.⨃.⨄.⨅.⨆.⨇.⨈.⨉".split("."),
	props: { numArgs: 0 },
	handler: ({ parser: e, funcName: t }, n) => {
		let r = t;
		return r.length === 1 && (r = mr[r]), {
			type: "op",
			mode: e.mode,
			limits: !0,
			parentIsSupSub: !1,
			symbol: !0,
			stack: !1,
			name: r
		};
	},
	mathmlBuilder: pr
}), S({
	type: "op",
	names: ["\\mathop"],
	props: {
		numArgs: 1,
		primitive: !0
	},
	handler: ({ parser: e }, t) => {
		let n = t[0], r = n.body ? n.body : [n], i = r.length === 1 && lr.includes(r[0].type);
		return {
			type: "op",
			mode: e.mode,
			limits: !0,
			parentIsSupSub: !1,
			symbol: i,
			fromMathOp: !0,
			stack: !1,
			name: i ? r[0].text : null,
			body: i ? null : C(n)
		};
	},
	mathmlBuilder: pr
});
var hr = {
	"∫": "\\int",
	"∬": "\\iint",
	"∭": "\\iiint",
	"∮": "\\oint",
	"∯": "\\oiint",
	"∰": "\\oiiint",
	"∱": "\\intclockwise",
	"∲": "\\varointclockwise",
	"⨌": "\\iiiint",
	"⨍": "\\intbar",
	"⨎": "\\intBar",
	"⨏": "\\fint",
	"⨒": "\\rppolint",
	"⨓": "\\scpolint",
	"⨕": "\\pointint",
	"⨖": "\\sqint",
	"⨗": "\\intlarhk",
	"⨘": "\\intx",
	"⨙": "\\intcap",
	"⨚": "\\intcup"
};
S({
	type: "op",
	names: /* @__PURE__ */ "\\arcsin.\\arccos.\\arctan.\\arctg.\\arcctg.\\arg.\\ch.\\cos.\\cosec.\\cosh.\\cot.\\cotg.\\coth.\\csc.\\ctg.\\cth.\\deg.\\dim.\\exp.\\hom.\\ker.\\lg.\\ln.\\log.\\sec.\\sin.\\sinh.\\sh.\\sgn.\\tan.\\tanh.\\tg.\\th".split("."),
	props: { numArgs: 0 },
	handler({ parser: e, funcName: t }) {
		let n = e.prevAtomType, r = e.gullet.future().text;
		return {
			type: "op",
			mode: e.mode,
			limits: !1,
			parentIsSupSub: !1,
			symbol: !1,
			stack: !1,
			isFollowedByDelimiter: Dn(r),
			needsLeadingSpace: n.length > 0 && dr.includes(n),
			name: t
		};
	},
	mathmlBuilder: pr
}), S({
	type: "op",
	names: [
		"\\det",
		"\\gcd",
		"\\inf",
		"\\lim",
		"\\max",
		"\\min",
		"\\Pr",
		"\\sup"
	],
	props: { numArgs: 0 },
	handler({ parser: e, funcName: t }) {
		let n = e.prevAtomType, r = e.gullet.future().text;
		return {
			type: "op",
			mode: e.mode,
			limits: !0,
			parentIsSupSub: !1,
			symbol: !1,
			stack: !1,
			isFollowedByDelimiter: Dn(r),
			needsLeadingSpace: n.length > 0 && dr.includes(n),
			name: t
		};
	},
	mathmlBuilder: pr
}), S({
	type: "op",
	names: /* @__PURE__ */ "\\int.\\iint.\\iiint.\\iiiint.\\oint.\\oiint.\\oiiint.\\intclockwise.\\varointclockwise.\\intbar.\\intBar.\\fint.\\rppolint.\\scpolint.\\pointint.\\sqint.\\intlarhk.\\intx.\\intcap.\\intcup.∫.∬.∭.∮.∯.∰.∱.∲.⨌.⨍.⨎.⨏.⨒.⨓.⨕.⨖.⨗.⨘.⨙.⨚".split("."),
	props: {
		numArgs: 0,
		allowedInArgument: !0
	},
	handler({ parser: e, funcName: t }) {
		let n = t;
		return n.length === 1 && (n = hr[n]), {
			type: "op",
			mode: e.mode,
			limits: !1,
			parentIsSupSub: !1,
			symbol: !0,
			stack: !1,
			name: n
		};
	},
	mathmlBuilder: pr
}), S({
	type: "operatorname",
	names: ["\\operatorname@", "\\operatornamewithlimits"],
	props: {
		numArgs: 1,
		allowedInArgument: !0
	},
	handler: ({ parser: e, funcName: t }, n) => {
		let r = n[0], i = e.prevAtomType, a = e.gullet.future().text;
		return {
			type: "operatorname",
			mode: e.mode,
			body: C(r),
			alwaysHandleSupSub: t === "\\operatornamewithlimits",
			limits: !1,
			parentIsSupSub: !1,
			isFollowedByDelimiter: Dn(a),
			needsLeadingSpace: i.length > 0 && dr.includes(i)
		};
	},
	mathmlBuilder: (e, t) => {
		let n = B(e.body, t.withFont("mathrm")), r = !0;
		for (let e = 0; e < n.length; e++) {
			let t = n[e];
			if (t instanceof w) switch (((t.type === "mrow" || t.type === "mpadded") && t.children.length === 1 && t.children[0] instanceof w || t.type === "mrow" && t.children.length === 2 && t.children[0] instanceof w && t.children[1] instanceof w && t.children[1].type === "mspace" && !t.children[1].attributes.width && t.children[1].children.length === 0) && (t = t.children[0]), t.type) {
				case "mi":
				case "mn":
				case "ms":
				case "mtext": break;
				case "mspace":
					if (t.attributes.width) {
						let i = t.attributes.width.replace("em", ""), a = tr(Number(i));
						a === "" ? r = !1 : n[e] = new w("mtext", [new T(a)]);
					}
					break;
				case "mo": {
					let e = t.children[0];
					t.children.length === 1 && e instanceof T ? e.text = e.text.replace(/\u2212/, "-").replace(/\u2217/, "*") : r = !1;
					break;
				}
				default: r = !1;
			}
			else r = !1;
		}
		if (r) n = [new T(n.map((e) => e.toText()).join(""))];
		else if (n.length === 1 && ["mover", "munder"].includes(n[0].type) && (n[0].children[0].type === "mi" || n[0].children[0].type === "mtext")) {
			if (n[0].children[0].type = "mi", e.parentIsSupSub) return new w("mrow", n);
			{
				let e = new w("mo", [z("⁡", "text")]);
				return Me([n[0], e]);
			}
		}
		let i;
		if (r ? (i = new w("mi", n), n[0].text.length === 1 && i.setAttribute("mathvariant", "normal")) : i = new w("mrow", n), !e.parentIsSupSub) {
			let t = new w("mo", [z("⁡", "text")]), n = [i, t];
			if (e.needsLeadingSpace) {
				let e = new w("mspace");
				e.setAttribute("width", "0.1667em"), n.unshift(e);
			}
			if (!e.isFollowedByDelimiter) {
				let e = new w("mspace");
				e.setAttribute("width", "0.1667em"), n.push(e);
			}
			return Me(n);
		}
		return i;
	}
}), q("\\operatorname", "\\@ifstar\\operatornamewithlimits\\operatorname@"), xe({
	type: "ordgroup",
	mathmlBuilder(e, t) {
		return nt(e.body, t, e.semisimple);
	}
}), S({
	type: "phantom",
	names: ["\\phantom"],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler: ({ parser: e }, t) => {
		let n = t[0];
		return {
			type: "phantom",
			mode: e.mode,
			body: C(n)
		};
	},
	mathmlBuilder: (e, t) => new w("mphantom", B(e.body, t))
}), S({
	type: "hphantom",
	names: ["\\hphantom"],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler: ({ parser: e }, t) => {
		let n = t[0];
		return {
			type: "hphantom",
			mode: e.mode,
			body: n
		};
	},
	mathmlBuilder: (e, t) => {
		let n = new w("mpadded", [new w("mphantom", B(C(e.body), t))]);
		return n.setAttribute("height", "0px"), n.setAttribute("depth", "0px"), n;
	}
}), S({
	type: "vphantom",
	names: ["\\vphantom"],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler: ({ parser: e }, t) => {
		let n = t[0];
		return {
			type: "vphantom",
			mode: e.mode,
			body: n
		};
	},
	mathmlBuilder: (e, t) => {
		let n = new w("mpadded", [new w("mphantom", B(C(e.body), t))]);
		return n.setAttribute("width", "0.1px"), n;
	}
}), S({
	type: "pmb",
	names: ["\\pmb"],
	props: {
		numArgs: 1,
		allowedInText: !0
	},
	handler({ parser: e }, t) {
		return {
			type: "pmb",
			mode: e.mode,
			body: C(t[0])
		};
	},
	mathmlBuilder(e, t) {
		let n = Ne(B(e.body, t));
		return n.setAttribute("style", "font-weight:bold"), n;
	}
});
var gr = (e, t) => {
	let n = t.withLevel(K.TEXT), r = new w("mpadded", [V(e.body, n)]), i = yt(e.dy, t);
	return r.setAttribute("voffset", i.number + i.unit), i.number > 0 ? r.style.padding = i.number + i.unit + " 0 0 0" : r.style.padding = "0 0 " + Math.abs(i.number) + i.unit + " 0", r;
};
S({
	type: "raise",
	names: ["\\raise", "\\lower"],
	props: {
		numArgs: 2,
		argTypes: ["size", "primitive"],
		primitive: !0
	},
	handler({ parser: e, funcName: t }, n) {
		let r = W(n[0], "size").value;
		t === "\\lower" && (r.number *= -1);
		let i = n[1];
		return {
			type: "raise",
			mode: e.mode,
			dy: r,
			body: i
		};
	},
	mathmlBuilder: gr
}), S({
	type: "raise",
	names: ["\\raisebox"],
	props: {
		numArgs: 2,
		argTypes: ["size", "hbox"],
		allowedInText: !0
	},
	handler({ parser: e, funcName: t }, n) {
		let r = W(n[0], "size").value, i = n[1];
		return {
			type: "raise",
			mode: e.mode,
			dy: r,
			body: i
		};
	},
	mathmlBuilder: gr
}), S({
	type: "ref",
	names: ["\\ref", "\\eqref"],
	props: {
		numArgs: 1,
		argTypes: ["raw"]
	},
	handler({ parser: e, funcName: t }, n) {
		return {
			type: "ref",
			mode: e.mode,
			funcName: t,
			string: n[0].string.replace(nr, "")
		};
	},
	mathmlBuilder(e, t) {
		let n = e.funcName === "\\ref" ? ["tml-ref"] : ["tml-ref", "tml-eqref"];
		return new Ae("#" + e.string, n, null);
	}
}), S({
	type: "reflect",
	names: ["\\reflectbox"],
	props: {
		numArgs: 1,
		argTypes: ["hbox"],
		allowedInText: !0
	},
	handler({ parser: e }, t) {
		return {
			type: "reflect",
			mode: e.mode,
			body: t[0]
		};
	},
	mathmlBuilder(e, t) {
		let n = V(e.body, t);
		return n.style.transform = "scaleX(-1)", n;
	}
}), S({
	type: "internal",
	names: ["\\relax"],
	props: {
		numArgs: 0,
		allowedInText: !0,
		allowedInArgument: !0
	},
	handler({ parser: e }) {
		return {
			type: "internal",
			mode: e.mode
		};
	}
}), S({
	type: "rule",
	names: ["\\rule"],
	props: {
		numArgs: 2,
		numOptionalArgs: 1,
		allowedInText: !0,
		allowedInMath: !0,
		argTypes: [
			"size",
			"size",
			"size"
		]
	},
	handler({ parser: e }, t, n) {
		let r = n[0], i = W(t[0], "size"), a = W(t[1], "size");
		return {
			type: "rule",
			mode: e.mode,
			shift: r && W(r, "size").value,
			width: i.value,
			height: a.value
		};
	},
	mathmlBuilder(e, t) {
		let n = yt(e.width, t), r = yt(e.height, t), i = e.shift ? yt(e.shift, t) : {
			number: 0,
			unit: "em"
		}, a = t.color && t.getColor() || "black", o = new w("mspace");
		if (n.number > 0 && r.number > 0 && o.setAttribute("mathbackground", a), o.setAttribute("width", n.number + n.unit), o.setAttribute("height", r.number + r.unit), i.number === 0) return o;
		let s = new w("mpadded", [o]);
		return i.number >= 0 ? s.setAttribute("height", "+" + i.number + i.unit) : (s.setAttribute("height", i.number + i.unit), s.setAttribute("depth", "+" + -i.number + i.unit)), s.setAttribute("voffset", i.number + i.unit), s;
	}
});
var _r = /^[0-9]$/, vr = {
	0: "₀",
	1: "₁",
	2: "₂",
	3: "₃",
	4: "₄",
	5: "₅",
	6: "₆",
	7: "₇",
	8: "₈",
	9: "₉"
}, yr = {
	0: "⁰",
	1: "¹",
	2: "²",
	3: "³",
	4: "⁴",
	5: "⁵",
	6: "⁶",
	7: "⁷",
	8: "⁸",
	9: "⁹"
};
S({
	type: "sfrac",
	names: ["\\sfrac"],
	props: {
		numArgs: 2,
		allowedInText: !0,
		allowedInMath: !0
	},
	handler({ parser: e }, t) {
		let n = "";
		for (let e of t[0].body) {
			if (e.type !== "textord" || !_r.test(e.text)) throw new b("Numerator must be an integer.", e);
			n += e.text;
		}
		let r = "";
		for (let e of t[1].body) {
			if (e.type !== "textord" || !_r.test(e.text)) throw new b("Denominator must be an integer.", e);
			r += e.text;
		}
		return {
			type: "sfrac",
			mode: e.mode,
			numerator: n,
			denominator: r
		};
	},
	mathmlBuilder(e, t) {
		let n = e.numerator.split("").map((e) => yr[e]).join(""), r = e.denominator.split("").map((e) => vr[e]).join("");
		return new w("mn", [new T(n + "⁄" + r, e.mode, t)], ["special-fraction"]);
	}
});
var br = {
	"\\tiny": .5,
	"\\sixptsize": .6,
	"\\Tiny": .6,
	"\\scriptsize": .7,
	"\\footnotesize": .8,
	"\\small": .9,
	"\\normalsize": 1,
	"\\large": 1.2,
	"\\Large": 1.44,
	"\\LARGE": 1.728,
	"\\huge": 2.074,
	"\\Huge": 2.488
};
S({
	type: "sizing",
	names: [
		"\\tiny",
		"\\sixptsize",
		"\\Tiny",
		"\\scriptsize",
		"\\footnotesize",
		"\\small",
		"\\normalsize",
		"\\large",
		"\\Large",
		"\\LARGE",
		"\\huge",
		"\\Huge"
	],
	props: {
		numArgs: 0,
		allowedInText: !0
	},
	handler: ({ breakOnTokenText: e, funcName: t, parser: n }, r) => {
		n.settings.strict && n.mode === "math" && console.log(`Temml strict-mode warning: Command ${t} is invalid in math mode.`);
		let i = n.parseExpression(!1, e, !0);
		return {
			type: "sizing",
			mode: n.mode,
			funcName: t,
			body: i
		};
	},
	mathmlBuilder: (e, t) => {
		let n = t.withFontSize(br[e.funcName]), r = Ne(B(e.body, n)), i = (br[e.funcName] / t.fontSize).toFixed(4);
		return r.setAttribute("mathsize", i + "em"), r;
	}
}), S({
	type: "smash",
	names: ["\\smash"],
	props: {
		numArgs: 1,
		numOptionalArgs: 1,
		allowedInText: !0
	},
	handler: ({ parser: e }, t, n) => {
		let r = !1, i = !1, a = n[0] && W(n[0], "ordgroup");
		if (a) {
			let e = "";
			for (let t = 0; t < a.body.length; ++t) if (e = a.body[t].text, e === "t") r = !0;
			else if (e === "b") i = !0;
			else {
				r = !1, i = !1;
				break;
			}
		} else r = !0, i = !0;
		let o = t[0];
		return {
			type: "smash",
			mode: e.mode,
			body: o,
			smashHeight: r,
			smashDepth: i
		};
	},
	mathmlBuilder: (e, t) => {
		let n = new w("mpadded", [V(e.body, t)]);
		return e.smashHeight && n.setAttribute("height", "0px"), e.smashDepth && n.setAttribute("depth", "0px"), n;
	}
});
var xr = /* @__PURE__ */ "a.c.e.ı.m.n.o.r.s.u.v.w.x.z.α.ε.ι.κ.ν.ο.π.σ.τ.υ.ω.\\alpha.\\epsilon.\\iota.\\kappa.\\nu.\\omega.\\pi.\\tau.\\omega".split(".");
S({
	type: "sqrt",
	names: ["\\sqrt"],
	props: {
		numArgs: 1,
		numOptionalArgs: 1
	},
	handler({ parser: e }, t, n) {
		let r = n[0], i = t[0];
		return i.body && i.body.length === 1 && i.body[0].text && xr.includes(i.body[0].text) && i.body.push({
			type: "rule",
			mode: "math",
			shift: null,
			width: {
				number: 0,
				unit: "pt"
			},
			height: {
				number: .5,
				unit: "em"
			}
		}), {
			type: "sqrt",
			mode: e.mode,
			body: i,
			index: r
		};
	},
	mathmlBuilder(e, t) {
		let { body: n, index: r } = e;
		return r ? new w("mroot", [V(n, t), V(r, t.incrementLevel())]) : new w("msqrt", [V(n, t)]);
	}
});
var Sr = {
	display: 0,
	text: 1,
	script: 2,
	scriptscript: 3
}, Cr = {
	display: ["0", "true"],
	text: ["0", "false"],
	script: ["1", "false"],
	scriptscript: ["2", "false"]
};
S({
	type: "styling",
	names: [
		"\\displaystyle",
		"\\textstyle",
		"\\scriptstyle",
		"\\scriptscriptstyle"
	],
	props: {
		numArgs: 0,
		allowedInText: !0,
		primitive: !0
	},
	handler({ breakOnTokenText: e, funcName: t, parser: n }, r) {
		let i = n.parseExpression(!0, e, !0), a = t.slice(1, t.length - 5);
		return {
			type: "styling",
			mode: n.mode,
			scriptLevel: a,
			body: i
		};
	},
	mathmlBuilder(e, t) {
		let n = t.withLevel(Sr[e.scriptLevel]), r = Ne(B(e.body, n)), i = Cr[e.scriptLevel];
		return r.setAttribute("scriptlevel", i[0]), r.setAttribute("displaystyle", i[1]), r;
	}
});
var wr = /^m(over|under|underover)$/, Tr = "DHKLUcegorsuvxyzΠΥΨαδηιμνοτυχϵ", Er = "BCEFGIMNOPQRSTXZlpqtwΓΘΞΣΦΩβεζθξρςφψϑϕϱ", Dr = "AJdfΔΛ";
xe({
	type: "supsub",
	mathmlBuilder(e, t) {
		let n = !1, r, i, a = !1, o = !1, s = !1;
		e.base && e.base.type === "horizBracket" && (i = !!e.sup, i === e.base.isOver && (n = !0, r = e.base.isOver)), e.base && !e.stack && (e.base.type === "op" || e.base.type === "operatorname") && (e.base.parentIsSupSub = !0, a = !e.base.symbol, o = a && !e.isFollowedByDelimiter, s = e.base.needsLeadingSpace);
		let c = e.stack && e.base.body.length === 1 ? [V(e.base.body[0], t)] : [V(e.base, t)], l = t.inSubOrSup();
		if (e.sub) {
			let n = V(e.sub, l);
			t.level === 3 && n.setAttribute("scriptlevel", "2"), c.push(n);
		}
		if (e.sup) {
			let n = V(e.sup, l);
			if (t.level === 3 && n.setAttribute("scriptlevel", "2"), e.base && e.base.text && e.base.text.length === 1) {
				let t = e.base.text;
				Tr.indexOf(t) > -1 ? n.classes.push("tml-sml-pad") : Er.indexOf(t) > -1 ? n.classes.push("tml-med-pad") : Dr.indexOf(t) > -1 && n.classes.push("tml-lrg-pad");
			}
			c.push(n);
		}
		let u;
		if (n) u = r ? "mover" : "munder";
		else if (!e.sub) {
			let n = e.base;
			u = n && n.type === "op" && n.limits && (t.level === K.DISPLAY || n.alwaysHandleSupSub) || n && n.type === "operatorname" && n.alwaysHandleSupSub && (n.limits || t.level === K.DISPLAY) ? "mover" : "msup";
		} else if (e.sup) {
			let n = e.base;
			u = n && (n.type === "op" && n.limits || n.type === "multiscript") && (t.level === K.DISPLAY || n.alwaysHandleSupSub) || n && n.type === "operatorname" && n.alwaysHandleSupSub && (t.level === K.DISPLAY || n.limits) ? "munderover" : "msubsup";
		} else {
			let n = e.base;
			u = e.stack || n && n.type === "op" && n.limits && (t.level === K.DISPLAY || n.alwaysHandleSupSub) || n && n.type === "operatorname" && n.alwaysHandleSupSub && (n.limits || t.level === K.DISPLAY) ? "munder" : "msub";
		}
		let d = new w(u, c);
		if (a) {
			let e = new w("mo", [z("⁡", "text")]);
			if (s) {
				let t = new w("mspace");
				t.setAttribute("width", "0.1667em"), d = Me([
					t,
					d,
					e
				]);
			} else d = Me([d, e]);
			if (o) {
				let e = new w("mspace");
				e.setAttribute("width", "0.1667em"), d.children.push(e);
			}
		} else wr.test(u) && (d = new w("mrow", [d]));
		return d;
	}
});
var Or = [
	"\\shortmid",
	"\\nshortmid",
	"\\shortparallel",
	"\\nshortparallel",
	"\\smallsetminus"
], kr = [
	"\\Rsh",
	"\\Lsh",
	"\\restriction"
], Ar = (e) => {
	if (e.length === 1) {
		let t = e.codePointAt(0);
		return 8591 < t && t < 8704;
	}
	return e.indexOf("arrow") > -1 || e.indexOf("harpoon") > -1 || kr.includes(e);
};
xe({
	type: "atom",
	mathmlBuilder(e, t) {
		let n = new w("mo", [z(e.text, e.mode)]);
		if (e.family === "punct") n.setAttribute("separator", "true");
		else if (e.family === "open" || e.family === "close") e.family === "open" ? (n.setAttribute("form", "prefix"), n.setAttribute("stretchy", "false")) : e.family === "close" && (n.setAttribute("form", "postfix"), n.setAttribute("stretchy", "false"));
		else if (e.text === "\\mid") n.setAttribute("lspace", "0.22em"), n.setAttribute("rspace", "0.22em"), n.setAttribute("stretchy", "false");
		else if (e.family === "rel" && Ar(e.text)) n.setAttribute("stretchy", "false");
		else if (Or.includes(e.text)) n.setAttribute("mathsize", "70%");
		else if (e.text === ":") n.attributes.lspace = "0.2222em", n.attributes.rspace = "0.2222em";
		else if (e.needsSpacing) return e.family === "bin" ? new w("mrow", [
			H(.222),
			n,
			H(.222)
		]) : new w("mrow", [
			H(.2778),
			n,
			H(.2778)
		]);
		return n;
	}
});
var jr = {
	mathbf: "bold",
	mathrm: "normal",
	textit: "italic",
	mathit: "italic",
	mathnormal: "italic",
	mathbb: "double-struck",
	mathcal: "script",
	mathfrak: "fraktur",
	mathscr: "script",
	mathsf: "sans-serif",
	mathtt: "monospace"
}, Mr = function(e, t) {
	if (t.fontFamily === "texttt") return "monospace";
	if (t.fontFamily === "textsc") return "normal";
	if (t.fontFamily === "textsf") return t.fontShape === "textit" && t.fontWeight === "textbf" ? "sans-serif-bold-italic" : t.fontShape === "textit" ? "sans-serif-italic" : t.fontWeight === "textbf" ? "sans-serif-bold" : "sans-serif";
	if (t.fontShape === "textit" && t.fontWeight === "textbf") return "bold-italic";
	if (t.fontShape === "textit") return "italic";
	if (t.fontWeight === "textbf") return "bold";
	let n = t.font;
	if (!n || n === "mathnormal") return null;
	let r = e.mode;
	switch (n) {
		case "mathit": return "italic";
		case "mathrm": {
			let t = e.text.codePointAt(0);
			return 939 < t && t < 975 ? "italic" : "normal";
		}
		case "greekItalic": return "italic";
		case "up@greek": return "normal";
		case "boldsymbol":
		case "mathboldsymbol": return "bold-italic";
		case "mathbf": return "bold";
		case "mathbb": return "double-struck";
		case "mathfrak": return "fraktur";
		case "mathscr":
		case "mathcal": return "script";
		case "mathsf": return "sans-serif";
		case "mathsfit": return "sans-serif-italic";
		case "mathtt": return "monospace";
	}
	let i = e.text;
	return E[r][i] && E[r][i].replace && (i = E[r][i].replace), Object.prototype.hasOwnProperty.call(jr, n) ? jr[n] : null;
}, Nr = /^\d(?:[\d,.]*\d)?$/, Pr = /[A-Ba-z]/, Fr = new Set([
	"\\prime",
	"\\dprime",
	"\\trprime",
	"\\qprime",
	"\\backprime",
	"\\backdprime",
	"\\backtrprime"
]), Ir = (e, t, n) => {
	let r = new w("mstyle", [new w(n, [e])]);
	return r.style["font-style"] = "italic", r.style["font-family"] = "Cambria, 'Times New Roman', serif", t === "bold-italic" && (r.style["font-weight"] = "bold"), r;
};
xe({
	type: "mathord",
	mathmlBuilder(e, t) {
		let n = z(e.text, e.mode, t), r = n.text.codePointAt(0), i = 912 < r && r < 938 ? "normal" : "italic", a = Mr(e, t) || i;
		if (a === "script") return n.text = Un(n.text, a), new w("mi", [n], [t.font]);
		a !== "italic" && (n.text = Un(n.text, a));
		let o = new w("mi", [n]);
		if (a === "normal" && (o.setAttribute("mathvariant", "normal"), n.text.length === 1)) {
			let e = new w("mspace", []);
			o = new w("mrow", [o, e]);
		}
		return o;
	}
}), xe({
	type: "textord",
	mathmlBuilder(e, t) {
		let n = e.text, r = n.codePointAt(0);
		t.fontFamily === "textsc" && 96 < r && r < 123 && (n = Wn[n]);
		let i = z(n, e.mode, t), a = Mr(e, t) || "normal", o;
		if (Nr.test(e.text)) {
			let t = e.mode === "text" ? "mtext" : "mn";
			if (a === "italic" || a === "bold-italic") return Ir(i, a, t);
			a !== "normal" && (i.text = i.text.split("").map((e) => Un(e, a)).join("")), o = new w(t, [i]);
		} else if (e.mode === "text") a !== "normal" && (i.text = Un(i.text, a)), o = new w("mtext", [i]);
		else if (Fr.has(e.text)) o = new w("mo", [i]), o.classes.push("tml-prime");
		else {
			let e = i.text;
			a !== "italic" && (i.text = Un(i.text, a)), o = new w("mi", [i]), i.text === e && Pr.test(e) && o.setAttribute("mathvariant", "italic");
		}
		return o;
	}
});
var Lr = {
	"\\nobreak": "nobreak",
	"\\allowbreak": "allowbreak"
}, Rr = {
	" ": {},
	"\\ ": {},
	"~": { className: "nobreak" },
	"\\space": {},
	"\\nobreakspace": { className: "nobreak" }
};
xe({
	type: "spacing",
	mathmlBuilder(e, t) {
		let n;
		if (Object.prototype.hasOwnProperty.call(Rr, e.text)) n = new w("mtext", [new T("\xA0")]);
		else if (Object.prototype.hasOwnProperty.call(Lr, e.text)) n = new w("mo"), e.text === "\\nobreak" && n.setAttribute("linebreak", "nobreak");
		else throw new b(`Unknown type of space "${e.text}"`);
		return n;
	}
}), xe({ type: "tag" });
var zr = {
	"\\text": void 0,
	"\\textrm": "textrm",
	"\\textsf": "textsf",
	"\\texttt": "texttt",
	"\\textnormal": "textrm",
	"\\textsc": "textsc"
}, Br = {
	"\\textbf": "textbf",
	"\\textmd": "textmd"
}, Vr = {
	"\\textit": "textit",
	"\\textup": "textup"
}, Hr = (e, t) => {
	let n = e.font;
	return n ? zr[n] ? t.withTextFontFamily(zr[n]) : Br[n] ? t.withTextFontWeight(Br[n]) : n === "\\emph" ? t.fontShape === "textit" ? t.withTextFontShape("textup") : t.withTextFontShape("textit") : t.withTextFontShape(Vr[n]) : t;
};
S({
	type: "text",
	names: [
		"\\text",
		"\\textrm",
		"\\textsf",
		"\\texttt",
		"\\textnormal",
		"\\textsc",
		"\\textbf",
		"\\textmd",
		"\\textit",
		"\\textup",
		"\\emph"
	],
	props: {
		numArgs: 1,
		argTypes: ["text"],
		allowedInArgument: !0,
		allowedInText: !0
	},
	handler({ parser: e, funcName: t }, n) {
		let r = n[0];
		return {
			type: "text",
			mode: e.mode,
			body: C(r),
			font: t
		};
	},
	mathmlBuilder(e, t) {
		let n = Hr(e, t);
		return Ze(nt(e.body, n));
	}
}), S({
	type: "vcenter",
	names: ["\\vcenter"],
	props: {
		numArgs: 1,
		argTypes: ["original"],
		allowedInText: !1
	},
	handler({ parser: e }, t) {
		return {
			type: "vcenter",
			mode: e.mode,
			body: t[0]
		};
	},
	mathmlBuilder(e, t) {
		let n = new w("mtd", [V(e.body, t)]);
		return n.style.padding = "0", new w("mtable", [new w("mtr", [n])]);
	}
}), S({
	type: "verb",
	names: ["\\verb"],
	props: {
		numArgs: 0,
		allowedInText: !0
	},
	handler(e, t, n) {
		throw new b("\\verb ended by end of line instead of matching delimiter");
	},
	mathmlBuilder(e, t) {
		let n = new w("mtext", [new T(Ur(e))]);
		return n.setAttribute("mathvariant", "monospace"), n;
	}
});
var Ur = (e) => e.body.replace(/ /g, e.star ? "␣" : "\xA0"), Wr = ye, Gr = "[ \r\n	]", Kr = "\\\\[a-zA-Z@]+", qr = "\\\\[^\ud800-\udfff]", Jr = `(${Kr})${Gr}*`, Yr = "\\\\(\n|[ \r	]+\n?)[ \r	]*", Xr = "[̀-ͯ]", Zr = RegExp(`${Xr}+$`), Qr = `(${Gr}+)|${Yr}|([!-\\[\\]-‧‪-퟿豈-￿]${Xr}*|[�d800-�dbff][�dc00-�dfff]${Xr}*|\\\\verb\\*([^]).*?\\4|\\\\verb([^*a-zA-Z]).*?\\5|${Jr}|${qr})`, $r = class {
	constructor(e, t) {
		this.input = e, this.settings = t, this.tokenRegex = new RegExp(Qr, "g"), this.catcodes = {
			"%": 14,
			"~": 13
		};
	}
	setCatcode(e, t) {
		this.catcodes[e] = t;
	}
	lex() {
		let e = this.input, t = this.tokenRegex.lastIndex;
		if (t === e.length) return new It("EOF", new G(this, t, t));
		let n = this.tokenRegex.exec(e);
		if (n === null || n.index !== t) throw new b(`Unexpected character: '${e[t]}'`, new It(e[t], new G(this, t, t + 1)));
		let r = n[6] || n[3] || (n[2] ? "\\ " : " ");
		if (this.catcodes[r] === 14) {
			let t = e.indexOf("\n", this.tokenRegex.lastIndex);
			if (t === -1) {
				if (this.tokenRegex.lastIndex = e.length, this.settings.strict) throw new b("% comment has no terminating newline; LaTeX would fail because of commenting the end of math mode");
			} else this.tokenRegex.lastIndex = t + 1;
			return this.lex();
		}
		return new It(r, new G(this, t, this.tokenRegex.lastIndex));
	}
}, ei = class {
	constructor(e = {}, t = {}) {
		this.current = t, this.builtins = e, this.undefStack = [];
	}
	beginGroup() {
		this.undefStack.push({});
	}
	endGroup() {
		if (this.undefStack.length === 0) throw new b("Unbalanced namespace destruction: attempt to pop global namespace; please report this as a bug");
		let e = this.undefStack.pop();
		for (let t in e) Object.prototype.hasOwnProperty.call(e, t) && (e[t] === void 0 ? delete this.current[t] : this.current[t] = e[t]);
	}
	has(e) {
		return Object.prototype.hasOwnProperty.call(this.current, e) || Object.prototype.hasOwnProperty.call(this.builtins, e);
	}
	get(e) {
		return Object.prototype.hasOwnProperty.call(this.current, e) ? this.current[e] : this.builtins[e];
	}
	set(e, t, n = !1) {
		if (n) {
			for (let t = 0; t < this.undefStack.length; t++) delete this.undefStack[t][e];
			this.undefStack.length > 0 && (this.undefStack[this.undefStack.length - 1][e] = t);
		} else {
			let t = this.undefStack[this.undefStack.length - 1];
			t && !Object.prototype.hasOwnProperty.call(t, e) && (t[e] = this.current[e]);
		}
		this.current[e] = t;
	}
}, ti = {
	"^": !0,
	_: !0,
	"\\limits": !0,
	"\\nolimits": !0
}, ni = class {
	constructor(e, t, n) {
		this.settings = t, this.expansionCount = 0, this.feed(e), this.macros = new ei(Rt, t.macros), this.mode = n, this.stack = [];
	}
	feed(e) {
		this.lexer = new $r(e, this.settings);
	}
	switchMode(e) {
		this.mode = e;
	}
	beginGroup() {
		this.macros.beginGroup();
	}
	endGroup() {
		this.macros.endGroup();
	}
	future() {
		return this.stack.length === 0 && this.pushToken(this.lexer.lex()), this.stack[this.stack.length - 1];
	}
	popToken() {
		return this.future(), this.stack.pop();
	}
	pushToken(e) {
		this.stack.push(e);
	}
	pushTokens(e) {
		this.stack.push(...e);
	}
	scanArgument(e) {
		let t, n, r;
		if (e) {
			if (this.consumeSpaces(), this.future().text !== "[") return null;
			t = this.popToken(), {tokens: r, end: n} = this.consumeArg(["]"]);
		} else ({tokens: r, start: t, end: n} = this.consumeArg());
		return this.pushToken(new It("EOF", n.loc)), this.pushTokens(r), new It("", G.range(t, n));
	}
	consumeSpaces() {
		for (; this.future().text === " ";) this.stack.pop();
	}
	consumeArg(e) {
		let t = [], n = e && e.length > 0;
		n || this.consumeSpaces();
		let r = this.future(), i, a = 0, o = 0;
		do {
			if (i = this.popToken(), t.push(i), i.text === "{") ++a;
			else if (i.text === "}") {
				if (--a, a === -1) throw new b("Extra }", i);
			} else if (i.text === "EOF") throw new b("Unexpected end of input in a macro argument, expected '" + (e && n ? e[o] : "}") + "'", i);
			if (e && n) if ((a === 0 || a === 1 && e[o] === "{") && i.text === e[o]) {
				if (++o, o === e.length) {
					t.splice(-o, o);
					break;
				}
			} else o = 0;
		} while (a !== 0 || n);
		return r.text === "{" && t[t.length - 1].text === "}" && (t.pop(), t.shift()), t.reverse(), {
			tokens: t,
			start: r,
			end: i
		};
	}
	consumeArgs(e, t) {
		if (t) {
			if (t.length !== e + 1) throw new b("The length of delimiters doesn't match the number of args!");
			let n = t[0];
			for (let e = 0; e < n.length; e++) {
				let t = this.popToken();
				if (n[e] !== t.text) throw new b("Use of the macro doesn't match its definition", t);
			}
		}
		let n = [];
		for (let r = 0; r < e; r++) n.push(this.consumeArg(t && t[r + 1]).tokens);
		return n;
	}
	expandOnce(e) {
		let t = this.popToken(), n = t.text, r = t.noexpand ? null : this._getExpansion(n);
		if (r == null || e && r.unexpandable) {
			if (e && r == null && n[0] === "\\" && !this.isDefined(n)) throw new b("Undefined control sequence: " + n);
			return this.pushToken(t), !1;
		}
		if (this.expansionCount++, this.expansionCount > this.settings.maxExpand) throw new b("Too many expansions: infinite loop or need to increase maxExpand setting");
		let i = r.tokens, a = this.consumeArgs(r.numArgs, r.delimiters);
		if (r.numArgs) {
			i = i.slice();
			for (let e = i.length - 1; e >= 0; --e) {
				let t = i[e];
				if (t.text === "#") {
					if (e === 0) throw new b("Incomplete placeholder at end of macro body", t);
					if (t = i[--e], t.text === "#") i.splice(e + 1, 1);
					else if (/^[1-9]$/.test(t.text)) i.splice(e, 2, ...a[t.text - 1]);
					else throw new b("Not a valid argument number", t);
				}
			}
		}
		return this.pushTokens(i), i.length;
	}
	expandAfterFuture() {
		return this.expandOnce(), this.future();
	}
	expandNextToken() {
		for (;;) if (this.expandOnce() === !1) {
			let e = this.stack.pop();
			return e.treatAsRelax && (e.text = "\\relax"), e;
		}
		throw Error();
	}
	expandMacro(e) {
		return this.macros.has(e) ? this.expandTokens([new It(e)]) : void 0;
	}
	expandTokens(e) {
		let t = [], n = this.stack.length;
		for (this.pushTokens(e); this.stack.length > n;) if (this.expandOnce(!0) === !1) {
			let e = this.stack.pop();
			e.treatAsRelax &&= (e.noexpand = !1, !1), t.push(e);
		}
		return t;
	}
	expandMacroAsText(e) {
		let t = this.expandMacro(e);
		return t && t.map((e) => e.text).join("");
	}
	_getExpansion(e) {
		let t = this.macros.get(e);
		if (t == null) return t;
		if (e.length === 1) {
			let t = this.lexer.catcodes[e];
			if (t != null && t !== 13) return;
		}
		let n = typeof t == "function" ? t(this) : t;
		if (typeof n == "string") {
			let e = 0;
			if (n.indexOf("#") !== -1) {
				let t = n.replace(/##/g, "");
				for (; t.indexOf("#" + (e + 1)) !== -1;) ++e;
			}
			let t = new $r(n, this.settings), r = [], i = t.lex();
			for (; i.text !== "EOF";) r.push(i), i = t.lex();
			return r.reverse(), {
				tokens: r,
				numArgs: e
			};
		}
		return n;
	}
	isDefined(e) {
		return this.macros.has(e) || Object.prototype.hasOwnProperty.call(Wr, e) || Object.prototype.hasOwnProperty.call(E.math, e) || Object.prototype.hasOwnProperty.call(E.text, e) || Object.prototype.hasOwnProperty.call(ti, e);
	}
	isExpandable(e) {
		let t = this.macros.get(e);
		return t == null ? Object.prototype.hasOwnProperty.call(Wr, e) && !Wr[e].primitive : typeof t == "string" || typeof t == "function" || !t.unexpandable;
	}
}, ri = /^[₊₋₌₍₎₀₁₂₃₄₅₆₇₈₉ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦᵧᵨᵩᵪ]/, ii = Object.freeze({
	"₊": "+",
	"₋": "-",
	"₌": "=",
	"₍": "(",
	"₎": ")",
	"₀": "0",
	"₁": "1",
	"₂": "2",
	"₃": "3",
	"₄": "4",
	"₅": "5",
	"₆": "6",
	"₇": "7",
	"₈": "8",
	"₉": "9",
	ₐ: "a",
	ₑ: "e",
	ₕ: "h",
	ᵢ: "i",
	ⱼ: "j",
	ₖ: "k",
	ₗ: "l",
	ₘ: "m",
	ₙ: "n",
	ₒ: "o",
	ₚ: "p",
	ᵣ: "r",
	ₛ: "s",
	ₜ: "t",
	ᵤ: "u",
	ᵥ: "v",
	ₓ: "x",
	ᵦ: "β",
	ᵧ: "γ",
	ᵨ: "ρ",
	ᵩ: "ϕ",
	ᵪ: "χ",
	"⁺": "+",
	"⁻": "-",
	"⁼": "=",
	"⁽": "(",
	"⁾": ")",
	"⁰": "0",
	"¹": "1",
	"²": "2",
	"³": "3",
	"⁴": "4",
	"⁵": "5",
	"⁶": "6",
	"⁷": "7",
	"⁸": "8",
	"⁹": "9",
	ᴬ: "A",
	ᴮ: "B",
	ᴰ: "D",
	ᴱ: "E",
	ᴳ: "G",
	ᴴ: "H",
	ᴵ: "I",
	ᴶ: "J",
	ᴷ: "K",
	ᴸ: "L",
	ᴹ: "M",
	ᴺ: "N",
	ᴼ: "O",
	ᴾ: "P",
	ᴿ: "R",
	ᵀ: "T",
	ᵁ: "U",
	ⱽ: "V",
	ᵂ: "W",
	ᵃ: "a",
	ᵇ: "b",
	ᶜ: "c",
	ᵈ: "d",
	ᵉ: "e",
	ᶠ: "f",
	ᵍ: "g",
	ʰ: "h",
	ⁱ: "i",
	ʲ: "j",
	ᵏ: "k",
	ˡ: "l",
	ᵐ: "m",
	ⁿ: "n",
	ᵒ: "o",
	ᵖ: "p",
	ʳ: "r",
	ˢ: "s",
	ᵗ: "t",
	ᵘ: "u",
	ᵛ: "v",
	ʷ: "w",
	ˣ: "x",
	ʸ: "y",
	ᶻ: "z",
	ᵝ: "β",
	ᵞ: "γ",
	ᵟ: "δ",
	ᵠ: "ϕ",
	ᵡ: "χ",
	ᶿ: "θ"
}), ai = Object.freeze({
	𝒜: "A",
	ℬ: "B",
	𝒞: "C",
	𝒟: "D",
	ℰ: "E",
	ℱ: "F",
	𝒢: "G",
	ℋ: "H",
	ℐ: "I",
	𝒥: "J",
	𝒦: "K",
	ℒ: "L",
	ℳ: "M",
	𝒩: "N",
	𝒪: "O",
	𝒫: "P",
	𝒬: "Q",
	ℛ: "R",
	𝒮: "S",
	𝒯: "T",
	𝒰: "U",
	𝒱: "V",
	𝒲: "W",
	𝒳: "X",
	𝒴: "Y",
	𝒵: "Z"
}), oi = {
	"́": {
		text: "\\'",
		math: "\\acute"
	},
	"̀": {
		text: "\\`",
		math: "\\grave"
	},
	"̈": {
		text: "\\\"",
		math: "\\ddot"
	},
	"̃": {
		text: "\\~",
		math: "\\tilde"
	},
	"̄": {
		text: "\\=",
		math: "\\bar"
	},
	"̆": {
		text: "\\u",
		math: "\\breve"
	},
	"̌": {
		text: "\\v",
		math: "\\check"
	},
	"̂": {
		text: "\\^",
		math: "\\hat"
	},
	"̇": {
		text: "\\.",
		math: "\\dot"
	},
	"̊": {
		text: "\\r",
		math: "\\mathring"
	},
	"̋": { text: "\\H" },
	"̧": { text: "\\c" }
}, si = {
	á: "á",
	à: "à",
	ä: "ä",
	ǟ: "ǟ",
	ã: "ã",
	ā: "ā",
	ă: "ă",
	ắ: "ắ",
	ằ: "ằ",
	ẵ: "ẵ",
	ǎ: "ǎ",
	â: "â",
	ấ: "ấ",
	ầ: "ầ",
	ẫ: "ẫ",
	ȧ: "ȧ",
	ǡ: "ǡ",
	å: "å",
	ǻ: "ǻ",
	ḃ: "ḃ",
	ć: "ć",
	č: "č",
	ĉ: "ĉ",
	ċ: "ċ",
	ď: "ď",
	ḋ: "ḋ",
	é: "é",
	è: "è",
	ë: "ë",
	ẽ: "ẽ",
	ē: "ē",
	ḗ: "ḗ",
	ḕ: "ḕ",
	ĕ: "ĕ",
	ě: "ě",
	ê: "ê",
	ế: "ế",
	ề: "ề",
	ễ: "ễ",
	ė: "ė",
	ḟ: "ḟ",
	ǵ: "ǵ",
	ḡ: "ḡ",
	ğ: "ğ",
	ǧ: "ǧ",
	ĝ: "ĝ",
	ġ: "ġ",
	ḧ: "ḧ",
	ȟ: "ȟ",
	ĥ: "ĥ",
	ḣ: "ḣ",
	í: "í",
	ì: "ì",
	ï: "ï",
	ḯ: "ḯ",
	ĩ: "ĩ",
	ī: "ī",
	ĭ: "ĭ",
	ǐ: "ǐ",
	î: "î",
	ǰ: "ǰ",
	ĵ: "ĵ",
	ḱ: "ḱ",
	ǩ: "ǩ",
	ĺ: "ĺ",
	ľ: "ľ",
	ḿ: "ḿ",
	ṁ: "ṁ",
	ń: "ń",
	ǹ: "ǹ",
	ñ: "ñ",
	ň: "ň",
	ṅ: "ṅ",
	ó: "ó",
	ò: "ò",
	ö: "ö",
	ȫ: "ȫ",
	õ: "õ",
	ṍ: "ṍ",
	ṏ: "ṏ",
	ȭ: "ȭ",
	ō: "ō",
	ṓ: "ṓ",
	ṑ: "ṑ",
	ŏ: "ŏ",
	ǒ: "ǒ",
	ô: "ô",
	ố: "ố",
	ồ: "ồ",
	ỗ: "ỗ",
	ȯ: "ȯ",
	ȱ: "ȱ",
	ő: "ő",
	ṕ: "ṕ",
	ṗ: "ṗ",
	ŕ: "ŕ",
	ř: "ř",
	ṙ: "ṙ",
	ś: "ś",
	ṥ: "ṥ",
	š: "š",
	ṧ: "ṧ",
	ŝ: "ŝ",
	ṡ: "ṡ",
	ẗ: "ẗ",
	ť: "ť",
	ṫ: "ṫ",
	ú: "ú",
	ù: "ù",
	ü: "ü",
	ǘ: "ǘ",
	ǜ: "ǜ",
	ǖ: "ǖ",
	ǚ: "ǚ",
	ũ: "ũ",
	ṹ: "ṹ",
	ū: "ū",
	ṻ: "ṻ",
	ŭ: "ŭ",
	ǔ: "ǔ",
	û: "û",
	ů: "ů",
	ű: "ű",
	ṽ: "ṽ",
	ẃ: "ẃ",
	ẁ: "ẁ",
	ẅ: "ẅ",
	ŵ: "ŵ",
	ẇ: "ẇ",
	ẘ: "ẘ",
	ẍ: "ẍ",
	ẋ: "ẋ",
	ý: "ý",
	ỳ: "ỳ",
	ÿ: "ÿ",
	ỹ: "ỹ",
	ȳ: "ȳ",
	ŷ: "ŷ",
	ẏ: "ẏ",
	ẙ: "ẙ",
	ź: "ź",
	ž: "ž",
	ẑ: "ẑ",
	ż: "ż",
	Á: "Á",
	À: "À",
	Ä: "Ä",
	Ǟ: "Ǟ",
	Ã: "Ã",
	Ā: "Ā",
	Ă: "Ă",
	Ắ: "Ắ",
	Ằ: "Ằ",
	Ẵ: "Ẵ",
	Ǎ: "Ǎ",
	Â: "Â",
	Ấ: "Ấ",
	Ầ: "Ầ",
	Ẫ: "Ẫ",
	Ȧ: "Ȧ",
	Ǡ: "Ǡ",
	Å: "Å",
	Ǻ: "Ǻ",
	Ḃ: "Ḃ",
	Ć: "Ć",
	Č: "Č",
	Ĉ: "Ĉ",
	Ċ: "Ċ",
	Ď: "Ď",
	Ḋ: "Ḋ",
	É: "É",
	È: "È",
	Ë: "Ë",
	Ẽ: "Ẽ",
	Ē: "Ē",
	Ḗ: "Ḗ",
	Ḕ: "Ḕ",
	Ĕ: "Ĕ",
	Ě: "Ě",
	Ê: "Ê",
	Ế: "Ế",
	Ề: "Ề",
	Ễ: "Ễ",
	Ė: "Ė",
	Ḟ: "Ḟ",
	Ǵ: "Ǵ",
	Ḡ: "Ḡ",
	Ğ: "Ğ",
	Ǧ: "Ǧ",
	Ĝ: "Ĝ",
	Ġ: "Ġ",
	Ḧ: "Ḧ",
	Ȟ: "Ȟ",
	Ĥ: "Ĥ",
	Ḣ: "Ḣ",
	Í: "Í",
	Ì: "Ì",
	Ï: "Ï",
	Ḯ: "Ḯ",
	Ĩ: "Ĩ",
	Ī: "Ī",
	Ĭ: "Ĭ",
	Ǐ: "Ǐ",
	Î: "Î",
	İ: "İ",
	Ĵ: "Ĵ",
	Ḱ: "Ḱ",
	Ǩ: "Ǩ",
	Ĺ: "Ĺ",
	Ľ: "Ľ",
	Ḿ: "Ḿ",
	Ṁ: "Ṁ",
	Ń: "Ń",
	Ǹ: "Ǹ",
	Ñ: "Ñ",
	Ň: "Ň",
	Ṅ: "Ṅ",
	Ó: "Ó",
	Ò: "Ò",
	Ö: "Ö",
	Ȫ: "Ȫ",
	Õ: "Õ",
	Ṍ: "Ṍ",
	Ṏ: "Ṏ",
	Ȭ: "Ȭ",
	Ō: "Ō",
	Ṓ: "Ṓ",
	Ṑ: "Ṑ",
	Ŏ: "Ŏ",
	Ǒ: "Ǒ",
	Ô: "Ô",
	Ố: "Ố",
	Ồ: "Ồ",
	Ỗ: "Ỗ",
	Ȯ: "Ȯ",
	Ȱ: "Ȱ",
	Ő: "Ő",
	Ṕ: "Ṕ",
	Ṗ: "Ṗ",
	Ŕ: "Ŕ",
	Ř: "Ř",
	Ṙ: "Ṙ",
	Ś: "Ś",
	Ṥ: "Ṥ",
	Š: "Š",
	Ṧ: "Ṧ",
	Ŝ: "Ŝ",
	Ṡ: "Ṡ",
	Ť: "Ť",
	Ṫ: "Ṫ",
	Ú: "Ú",
	Ù: "Ù",
	Ü: "Ü",
	Ǘ: "Ǘ",
	Ǜ: "Ǜ",
	Ǖ: "Ǖ",
	Ǚ: "Ǚ",
	Ũ: "Ũ",
	Ṹ: "Ṹ",
	Ū: "Ū",
	Ṻ: "Ṻ",
	Ŭ: "Ŭ",
	Ǔ: "Ǔ",
	Û: "Û",
	Ů: "Ů",
	Ű: "Ű",
	Ṽ: "Ṽ",
	Ẃ: "Ẃ",
	Ẁ: "Ẁ",
	Ẅ: "Ẅ",
	Ŵ: "Ŵ",
	Ẇ: "Ẇ",
	Ẍ: "Ẍ",
	Ẋ: "Ẋ",
	Ý: "Ý",
	Ỳ: "Ỳ",
	Ÿ: "Ÿ",
	Ỹ: "Ỹ",
	Ȳ: "Ȳ",
	Ŷ: "Ŷ",
	Ẏ: "Ẏ",
	Ź: "Ź",
	Ž: "Ž",
	Ẑ: "Ẑ",
	Ż: "Ż",
	ά: "ά",
	ὰ: "ὰ",
	ᾱ: "ᾱ",
	ᾰ: "ᾰ",
	έ: "έ",
	ὲ: "ὲ",
	ή: "ή",
	ὴ: "ὴ",
	ί: "ί",
	ὶ: "ὶ",
	ϊ: "ϊ",
	ΐ: "ΐ",
	ῒ: "ῒ",
	ῑ: "ῑ",
	ῐ: "ῐ",
	ό: "ό",
	ὸ: "ὸ",
	ύ: "ύ",
	ὺ: "ὺ",
	ϋ: "ϋ",
	ΰ: "ΰ",
	ῢ: "ῢ",
	ῡ: "ῡ",
	ῠ: "ῠ",
	ώ: "ώ",
	ὼ: "ὼ",
	Ύ: "Ύ",
	Ὺ: "Ὺ",
	Ϋ: "Ϋ",
	Ῡ: "Ῡ",
	Ῠ: "Ῠ",
	Ώ: "Ώ",
	Ὼ: "Ὼ"
}, ci = [
	"bin",
	"op",
	"open",
	"punct",
	"rel"
], li = /([-+]?) *(\d+(?:\.\d*)?|\.\d+) *([a-z]{2})/, ui = /^ *\\text/, di = class e {
	constructor(e, t, n = !1) {
		this.mode = "math", this.gullet = new ni(e, t, this.mode), this.settings = t, this.isPreamble = n, this.leftrightDepth = 0, this.prevAtomType = "";
	}
	expect(e, t = !0) {
		if (this.fetch().text !== e) throw new b(`Expected '${e}', got '${this.fetch().text}'`, this.fetch());
		t && this.consume();
	}
	consume() {
		this.nextToken = null;
	}
	fetch() {
		return this.nextToken ??= this.gullet.expandNextToken(), this.nextToken;
	}
	switchMode(e) {
		this.mode = e, this.gullet.switchMode(e);
	}
	parse() {
		this.gullet.beginGroup(), this.settings.colorIsTextColor && this.gullet.macros.set("\\color", "\\textcolor");
		let e = this.parseExpression(!1);
		if (this.expect("EOF"), this.isPreamble) {
			let e = Object.create(null);
			return Object.entries(this.gullet.macros.current).forEach(([t, n]) => {
				e[t] = n;
			}), this.gullet.endGroup(), e;
		}
		let t = this.gullet.macros.get("\\df@tag");
		return this.gullet.endGroup(), t && (this.gullet.macros.current["\\df@tag"] = t), e;
	}
	static get endOfExpression() {
		return [
			"}",
			"\\endgroup",
			"\\end",
			"\\right",
			"\\endtoggle",
			"&"
		];
	}
	subparse(e) {
		let t = this.nextToken;
		this.consume(), this.gullet.pushToken(new It("}")), this.gullet.pushTokens(e);
		let n = this.parseExpression(!1);
		return this.expect("}"), this.nextToken = t, n;
	}
	parseExpression(t, n, r) {
		let i = [];
		for (this.prevAtomType = "";;) {
			this.mode === "math" && this.consumeSpaces();
			let a = this.fetch();
			if (e.endOfExpression.indexOf(a.text) !== -1 || n && a.text === n || r && a.text === "\\middle" || t && Wr[a.text] && Wr[a.text].infix) break;
			let o = this.parseAtom(n);
			if (!o) break;
			o.type !== "internal" && (i.push(o), this.prevAtomType = o.type === "atom" ? o.family : o.type);
		}
		return this.mode === "text" && this.formLigatures(i), this.handleInfixNodes(i);
	}
	handleInfixNodes(e) {
		let t = -1, n;
		for (let r = 0; r < e.length; r++) if (e[r].type === "infix") {
			if (t !== -1) throw new b("only one infix operator per group", e[r].token);
			t = r, n = e[r].replaceWith;
		}
		if (t !== -1 && n) {
			let r, i, a = e.slice(0, t), o = e.slice(t + 1);
			r = a.length === 1 && a[0].type === "ordgroup" ? a[0] : {
				type: "ordgroup",
				mode: this.mode,
				body: a
			}, i = o.length === 1 && o[0].type === "ordgroup" ? o[0] : {
				type: "ordgroup",
				mode: this.mode,
				body: o
			};
			let s;
			return s = n === "\\\\abovefrac" ? this.callFunction(n, [
				r,
				e[t],
				i
			], []) : this.callFunction(n, [r, i], []), [s];
		} else return e;
	}
	handleSupSubscript(e) {
		let t = this.fetch(), n = t.text;
		this.consume(), this.consumeSpaces();
		let r;
		do
			r = this.parseGroup(e);
		while (r.type && r.type === "internal");
		if (!r) throw new b("Expected group after '" + n + "'", t);
		return r;
	}
	formatUnsupportedCmd(e) {
		let t = [];
		for (let n = 0; n < e.length; n++) t.push({
			type: "textord",
			mode: "text",
			text: e[n]
		});
		let n = {
			type: "text",
			mode: this.mode,
			body: t
		};
		return {
			type: "color",
			mode: this.mode,
			color: this.settings.errorColor,
			body: [n]
		};
	}
	parseAtom(e) {
		let t = this.parseGroup("atom", e);
		if (t && t.type === "internal" || this.mode === "text") return t;
		let n, r;
		for (;;) {
			this.consumeSpaces();
			let e = this.fetch();
			if (e.text === "\\limits" || e.text === "\\nolimits") {
				if (t && t.type === "op") t.limits = e.text === "\\limits", t.alwaysHandleSupSub = !0;
				else if (t && t.type === "operatorname") t.alwaysHandleSupSub && (t.limits = e.text === "\\limits");
				else throw new b("Limit controls must follow a math operator", e);
				this.consume();
			} else if (e.text === "^") {
				if (n) throw new b("Double superscript", e);
				n = this.handleSupSubscript("superscript");
			} else if (e.text === "_") {
				if (r) throw new b("Double subscript", e);
				r = this.handleSupSubscript("subscript");
			} else if (e.text === "'") {
				if (n) throw new b("Double superscript", e);
				let t = {
					type: "textord",
					mode: this.mode,
					text: "\\prime"
				}, r = [t];
				for (this.consume(); this.fetch().text === "'";) r.push(t), this.consume();
				this.fetch().text === "^" && r.push(this.handleSupSubscript("superscript")), n = {
					type: "ordgroup",
					mode: this.mode,
					body: r
				};
			} else if (ii[e.text]) {
				let t = ri.test(e.text), i = [];
				for (i.push(new It(ii[e.text])), this.consume();;) {
					let e = this.fetch().text;
					if (!ii[e] || ri.test(e) !== t) break;
					i.unshift(new It(ii[e])), this.consume();
				}
				let a = this.subparse(i);
				t ? r = {
					type: "ordgroup",
					mode: "math",
					body: a
				} : n = {
					type: "ordgroup",
					mode: "math",
					body: a
				};
			} else break;
		}
		if (n || r) {
			if (t && t.type === "multiscript" && !t.postscripts) return t.postscripts = {
				sup: n,
				sub: r
			}, t;
			{
				let e = !t || t.type !== "op" && t.type !== "operatorname" ? void 0 : Dn(this.nextToken.text);
				return {
					type: "supsub",
					mode: this.mode,
					base: t,
					sup: n,
					sub: r,
					isFollowedByDelimiter: e
				};
			}
		} else return t;
	}
	parseFunction(e, t) {
		let n = this.fetch(), r = n.text, i = Wr[r];
		if (!i) return null;
		if (this.consume(), t && t !== "atom" && !i.allowedInArgument) throw new b("Got function '" + r + "' with no arguments" + (t ? " as " + t : ""), n);
		if (this.mode === "text" && !i.allowedInText) throw new b("Can't use function '" + r + "' in text mode", n);
		if (this.mode === "math" && i.allowedInMath === !1) throw new b("Can't use function '" + r + "' in math mode", n);
		let a = this.prevAtomType, { args: o, optArgs: s } = this.parseArguments(r, i);
		return this.prevAtomType = a, this.callFunction(r, o, s, n, e);
	}
	callFunction(e, t, n, r, i) {
		let a = {
			funcName: e,
			parser: this,
			token: r,
			breakOnTokenText: i
		}, o = Wr[e];
		if (o && o.handler) return o.handler(a, t, n);
		throw new b(`No function handler for ${e}`);
	}
	parseArguments(e, t) {
		let n = t.numArgs + t.numOptionalArgs;
		if (n === 0) return {
			args: [],
			optArgs: []
		};
		let r = [], i = [];
		for (let a = 0; a < n; a++) {
			let n = t.argTypes && t.argTypes[a], o = a < t.numOptionalArgs;
			(t.primitive && n == null || t.type === "sqrt" && a === 1 && i[0] == null) && (n = "primitive");
			let s = this.parseGroupOfType(`argument to '${e}'`, n, o);
			if (o) i.push(s);
			else if (s != null) r.push(s);
			else throw new b("Null argument, please report this as a bug");
		}
		return {
			args: r,
			optArgs: i
		};
	}
	parseGroupOfType(e, t, n) {
		switch (t) {
			case "size": return this.parseSizeGroup(n);
			case "url": return this.parseUrlGroup(n);
			case "math":
			case "text": return this.parseArgumentGroup(n, t);
			case "hbox": {
				let e = this.parseArgumentGroup(n, "text");
				return e == null ? null : {
					type: "styling",
					mode: e.mode,
					body: [e],
					scriptLevel: "text"
				};
			}
			case "raw": {
				let e = this.parseStringGroup("raw", n);
				return e == null ? null : {
					type: "raw",
					mode: "text",
					string: e.text
				};
			}
			case "primitive": {
				if (n) throw new b("A primitive argument cannot be optional");
				let t = this.parseGroup(e);
				if (t == null) throw new b("Expected group as " + e, this.fetch());
				return t;
			}
			case "original":
			case null:
			case void 0: return this.parseArgumentGroup(n);
			default: throw new b("Unknown group type as " + e, this.fetch());
		}
	}
	consumeSpaces() {
		for (;;) {
			let e = this.fetch().text;
			if (e === " " || e === "\xA0" || e === "︎") this.consume();
			else break;
		}
	}
	parseStringGroup(e, t) {
		let n = this.gullet.scanArgument(t);
		if (n == null) return null;
		let r = "", i;
		for (; (i = this.fetch()).text !== "EOF";) r += i.text, this.consume();
		return this.consume(), n.text = r, n;
	}
	parseRegexGroup(e, t) {
		let n = this.fetch(), r = n, i = "", a;
		for (; (a = this.fetch()).text !== "EOF" && e.test(i + a.text);) r = a, i += r.text, this.consume();
		if (i === "") throw new b("Invalid " + t + ": '" + n.text + "'", n);
		return n.range(r, i);
	}
	parseSizeGroup(e) {
		let t, n = !1;
		if (this.gullet.consumeSpaces(), t = !e && this.gullet.future().text !== "{" ? this.parseRegexGroup(/^[-+]? *(?:$|\d+|\d+\.\d*|\.\d*) *[a-z]{0,2} *$/, "size") : this.parseStringGroup("size", e), !t) return null;
		!e && t.text.length === 0 && (t.text = "0pt", n = !0);
		let r = li.exec(t.text);
		if (!r) throw new b("Invalid size: '" + t.text + "'", t);
		let i = {
			number: +(r[1] + r[2]),
			unit: r[3]
		};
		if (!_t(i)) throw new b("Invalid unit: '" + i.unit + "'", t);
		return {
			type: "size",
			mode: this.mode,
			value: i,
			isBlank: n
		};
	}
	parseUrlGroup(e) {
		this.gullet.lexer.setCatcode("%", 13), this.gullet.lexer.setCatcode("~", 12);
		let t = this.parseStringGroup("url", e);
		if (this.gullet.lexer.setCatcode("%", 14), this.gullet.lexer.setCatcode("~", 13), t == null) return null;
		let n = t.text.replace(/\\([#$%&~_^{}])/g, "$1");
		return n = t.text.replace(/{\u2044}/g, "/"), {
			type: "url",
			mode: this.mode,
			url: n
		};
	}
	parseArgumentGroup(e, t) {
		let n = this.gullet.scanArgument(e);
		if (n == null) return null;
		let r = this.mode;
		t && this.switchMode(t), this.gullet.beginGroup();
		let i = this.parseExpression(!1, "EOF");
		this.expect("EOF"), this.gullet.endGroup();
		let a = {
			type: "ordgroup",
			mode: this.mode,
			loc: n.loc,
			body: i
		};
		return t && this.switchMode(r), a;
	}
	parseGroup(e, t) {
		let n = this.fetch(), r = n.text;
		if (e === "argument to '\\left'") return this.parseSymbol();
		let i;
		if (r === "{" || r === "\\begingroup" || r === "\\toggle") {
			this.consume();
			let e = r === "{" ? "}" : r === "\\begingroup" ? "\\endgroup" : "\\endtoggle";
			this.gullet.beginGroup();
			let t = this.parseExpression(!1, e), a = this.fetch();
			this.expect(e), this.gullet.endGroup(), i = {
				type: a.text === "\\endtoggle" ? "toggle" : "ordgroup",
				mode: this.mode,
				loc: G.range(n, a),
				body: t,
				semisimple: r === "\\begingroup" || void 0
			};
		} else if (i = this.parseFunction(t, e) || this.parseSymbol(), i == null && r[0] === "\\" && !Object.prototype.hasOwnProperty.call(ti, r)) {
			if (this.settings.throwOnError) throw new b("Unsupported function name: " + r, n);
			i = this.formatUnsupportedCmd(r), this.consume();
		}
		return i;
	}
	formLigatures(e) {
		let t = e.length - 1;
		for (let n = 0; n < t; ++n) {
			let r = e[n], i = r.text;
			i === "-" && e[n + 1].text === "-" && (n + 1 < t && e[n + 2].text === "-" ? (e.splice(n, 3, {
				type: "textord",
				mode: "text",
				loc: G.range(r, e[n + 2]),
				text: "---"
			}), t -= 2) : (e.splice(n, 2, {
				type: "textord",
				mode: "text",
				loc: G.range(r, e[n + 1]),
				text: "--"
			}), --t)), (i === "'" || i === "`") && e[n + 1].text === i && (e.splice(n, 2, {
				type: "textord",
				mode: "text",
				loc: G.range(r, e[n + 1]),
				text: i + i
			}), --t);
		}
	}
	parseSymbol() {
		let e = this.fetch(), t = e.text;
		if (/^\\verb[^a-zA-Z]/.test(t)) {
			this.consume();
			let e = t.slice(5), n = e.charAt(0) === "*";
			if (n && (e = e.slice(1)), e.length < 2 || e.charAt(0) !== e.slice(-1)) throw new b("\\verb assertion failed --\n                    please report what input caused this bug");
			return e = e.slice(1, -1), {
				type: "verb",
				mode: "text",
				body: e,
				star: n
			};
		}
		if (Object.prototype.hasOwnProperty.call(si, t[0]) && this.mode === "math" && !E[this.mode][t[0]]) {
			if (this.settings.strict && this.mode === "math") throw new b(`Accented Unicode text character "${t[0]}" used in math mode`, e);
			t = si[t[0]] + t.slice(1);
		}
		let n = this.mode === "math" ? Zr.exec(t) : null;
		n && (t = t.substring(0, n.index), t === "i" ? t = "ı" : t === "j" && (t = "ȷ"));
		let r;
		if (E[this.mode][t]) {
			let n = E[this.mode][t].group;
			n === "bin" && (ci.includes(this.prevAtomType) || this.prevAtomType === "") && (n = "open");
			let i = G.range(e), a;
			if (Object.prototype.hasOwnProperty.call(ze, n)) {
				let e = n;
				a = {
					type: "atom",
					mode: this.mode,
					family: e,
					loc: i,
					text: t
				}, (e === "rel" || e === "bin") && this.prevAtomType === "text" && ui.test(i.lexer.input.slice(i.end)) && (a.needsSpacing = !0);
			} else {
				if (ai[t]) {
					this.consume();
					let e = this.fetch().text.charCodeAt(0), n = e === 65025 ? "mathscr" : "mathcal";
					return (e === 65024 || e === 65025) && this.consume(), {
						type: "font",
						mode: "math",
						font: n,
						body: {
							type: "mathord",
							mode: "math",
							loc: i,
							text: ai[t]
						}
					};
				}
				a = {
					type: n,
					mode: this.mode,
					loc: i,
					text: t
				};
			}
			r = a;
		} else if (t.charCodeAt(0) >= 128 || Zr.exec(t)) {
			if (this.settings.strict && this.mode === "math") throw new b(`Unicode text character "${t[0]}" used in math mode`, e);
			r = {
				type: "textord",
				mode: "text",
				loc: G.range(e),
				text: t
			};
		} else return null;
		if (this.consume(), n) for (let t = 0; t < n[0].length; t++) {
			let i = n[0][t];
			if (!oi[i]) throw new b(`Unknown accent ' ${i}'`, e);
			let a = oi[i][this.mode] || oi[i].text;
			if (!a) throw new b(`Accent ${i} unsupported in ${this.mode} mode`, e);
			r = {
				type: "accent",
				mode: this.mode,
				loc: G.range(e),
				label: a,
				isStretchy: !1,
				base: r
			};
		}
		return r;
	}
}, fi = function(e, t) {
	if (!(typeof e == "string" || e instanceof String)) throw TypeError("Temml can only parse string typed expression");
	let n, r;
	try {
		r = new di(e, t), delete r.gullet.macros.current["\\df@tag"], n = r.parse();
	} catch (i) {
		if (i.toString() === "ParseError:  Unmatched delimiter") t.wrapDelimiterPairs = !1, r = new di(e, t), delete r.gullet.macros.current["\\df@tag"], n = r.parse();
		else throw i;
	}
	if (!(n.length > 0 && n[0].type && n[0].type === "array" && n[0].addEqnNum) && r.gullet.macros.get("\\df@tag")) {
		if (!t.displayMode) throw new b("\\tag works only in display mode");
		r.gullet.feed("\\df@tag"), n = [{
			type: "tag",
			mode: "text",
			body: n,
			tag: r.parse()
		}];
	}
	return n;
}, pi = [
	2,
	2,
	3,
	3
], mi = class e {
	constructor(e) {
		this.level = e.level, this.color = e.color, this.font = e.font || "", this.fontFamily = e.fontFamily || "", this.fontSize = e.fontSize || 1, this.fontWeight = e.fontWeight || "", this.fontShape = e.fontShape || "", this.maxSize = e.maxSize;
	}
	extend(t) {
		let n = {
			level: this.level,
			color: this.color,
			font: this.font,
			fontFamily: this.fontFamily,
			fontSize: this.fontSize,
			fontWeight: this.fontWeight,
			fontShape: this.fontShape,
			maxSize: this.maxSize
		};
		for (let e in t) Object.prototype.hasOwnProperty.call(t, e) && (n[e] = t[e]);
		return new e(n);
	}
	withLevel(e) {
		return this.extend({ level: e });
	}
	incrementLevel() {
		return this.extend({ level: Math.min(this.level + 1, 3) });
	}
	inSubOrSup() {
		return this.extend({ level: pi[this.level] });
	}
	withColor(e) {
		return this.extend({ color: e });
	}
	withFont(e) {
		return this.extend({ font: e });
	}
	withTextFontFamily(e) {
		return this.extend({
			fontFamily: e,
			font: ""
		});
	}
	withFontSize(e) {
		return this.extend({ fontSize: e });
	}
	withTextFontWeight(e) {
		return this.extend({
			fontWeight: e,
			font: ""
		});
	}
	withTextFontShape(e) {
		return this.extend({
			fontShape: e,
			font: ""
		});
	}
	getColor() {
		return this.color;
	}
}, hi = "0.13.3";
function gi(e) {
	let t = {}, n = 0, r = document.getElementsByClassName("tml-eqn");
	for (let e of r) for (n += 1, e.setAttribute("id", "tml-eqn-" + String(n)); e.tagName !== "mtable";) if (e.getElementsByClassName("tml-label").length > 0) {
		let r = e.attributes.id.value;
		t[r] = String(n);
		break;
	} else e = e.parentElement;
	let i = document.getElementsByClassName("tml-tageqn");
	for (let e of i) if (e.getElementsByClassName("tml-label").length > 0) {
		let n = e.getElementsByClassName("tml-tag");
		if (n.length > 0) {
			let r = e.attributes.id.value;
			t[r] = n[0].textContent;
		}
	}
	[...e.getElementsByClassName("tml-ref")].forEach((e) => {
		let n = t[e.getAttribute("href").slice(1)];
		e.className.indexOf("tml-eqref") === -1 ? (n = n.replace(/^\(/, ""), n = n.replace(/\)$/, "")) : (n.charAt(0) !== "(" && (n = "(" + n), n.slice(-1) !== ")" && (n += ")"));
		let r = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mtext");
		r.appendChild(document.createTextNode(n));
		let i = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
		i.appendChild(r), e.textContent = "", e.appendChild(i);
	});
}
var _i = function(e, t, n) {
	let r = n, i = 0, a = e.length;
	for (; r < t.length;) {
		let n = t[r];
		if (i <= 0 && t.slice(r, r + a) === e) return r;
		n === "\\" ? r++ : n === "{" ? i++ : n === "}" && i--, r++;
	}
	return -1;
}, vi = function(e) {
	return e.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}, yi = /^\\(?:begin|(?:eq)?ref){/, bi = function(e, t) {
	let n, r = [], i = RegExp("(" + t.map((e) => vi(e.left)).join("|") + ")");
	for (; n = e.search(i), n !== -1;) {
		n > 0 && (r.push({
			type: "text",
			data: e.slice(0, n)
		}), e = e.slice(n));
		let i = t.findIndex((t) => e.startsWith(t.left));
		if (n = _i(t[i].right, e, t[i].left.length), n === -1) break;
		let a = e.slice(0, n + t[i].right.length), o = yi.test(a) ? a : e.slice(t[i].left.length, n);
		r.push({
			type: "math",
			data: o,
			rawData: a,
			display: t[i].display
		}), e = e.slice(n + t[i].right.length);
	}
	return e !== "" && r.push({
		type: "text",
		data: e
	}), r;
}, xi = [
	{
		left: "$$",
		right: "$$",
		display: !0
	},
	{
		left: "\\(",
		right: "\\)",
		display: !1
	},
	{
		left: "\\begin{equation}",
		right: "\\end{equation}",
		display: !0
	},
	{
		left: "\\begin{equation*}",
		right: "\\end{equation*}",
		display: !0
	},
	{
		left: "\\begin{align}",
		right: "\\end{align}",
		display: !0
	},
	{
		left: "\\begin{align*}",
		right: "\\end{align*}",
		display: !0
	},
	{
		left: "\\begin{alignat}",
		right: "\\end{alignat}",
		display: !0
	},
	{
		left: "\\begin{alignat*}",
		right: "\\end{alignat*}",
		display: !0
	},
	{
		left: "\\begin{gather}",
		right: "\\end{gather}",
		display: !0
	},
	{
		left: "\\begin{gather*}",
		right: "\\end{gather*}",
		display: !0
	},
	{
		left: "\\begin{CD}",
		right: "\\end{CD}",
		display: !0
	},
	{
		left: "\\ref{",
		right: "}",
		display: !1
	},
	{
		left: "\\eqref{",
		right: "}",
		display: !1
	},
	{
		left: "\\[",
		right: "\\]",
		display: !0
	}
], Si = {
	$: [
		{
			left: "$$",
			right: "$$",
			display: !0
		},
		{
			left: "$`",
			right: "`$",
			display: !1
		},
		{
			left: "$",
			right: "$",
			display: !1
		}
	],
	"(": [{
		left: "\\[",
		right: "\\]",
		display: !0
	}, {
		left: "\\(",
		right: "\\)",
		display: !1
	}]
}, Ci = [
	{
		left: "\\begin{equation}",
		right: "\\end{equation}",
		display: !0
	},
	{
		left: "\\begin{equation*}",
		right: "\\end{equation*}",
		display: !0
	},
	{
		left: "\\begin{align}",
		right: "\\end{align}",
		display: !0
	},
	{
		left: "\\begin{align*}",
		right: "\\end{align*}",
		display: !0
	},
	{
		left: "\\begin{alignat}",
		right: "\\end{alignat}",
		display: !0
	},
	{
		left: "\\begin{alignat*}",
		right: "\\end{alignat*}",
		display: !0
	},
	{
		left: "\\begin{gather}",
		right: "\\end{gather}",
		display: !0
	},
	{
		left: "\\begin{gather*}",
		right: "\\end{gather*}",
		display: !0
	},
	{
		left: "\\begin{CD}",
		right: "\\end{CD}",
		display: !0
	},
	{
		left: "\\ref{",
		right: "}",
		display: !1
	},
	{
		left: "\\eqref{",
		right: "}",
		display: !1
	}
], wi = (e) => e === "$" || e === "(" ? Si[e] : e === "$+" || e === "(+" ? Si[e.slice(0, 1)].concat(Ci) : e === "ams" ? Ci : e === "all" ? Si["("].concat(Si.$).concat(Ci) : xi, Ti = function(e, t) {
	let n = bi(e, t.delimiters);
	if (n.length === 1 && n[0].type === "text") return null;
	let r = document.createDocumentFragment();
	for (let e = 0; e < n.length; e++) if (n[e].type === "text") r.appendChild(document.createTextNode(n[e].data));
	else {
		let i = document.createElement("span"), a = n[e].data;
		t.displayMode = n[e].display;
		try {
			t.preProcess && (a = t.preProcess(a)), temml.render(a, i, t);
		} catch (i) {
			if (!(i instanceof b)) throw i;
			t.errorCallback("Temml auto-render: Failed to parse `" + n[e].data + "` with ", i), r.appendChild(document.createTextNode(n[e].rawData));
			continue;
		}
		r.appendChild(i);
	}
	return r;
}, Ei = function(e, t) {
	for (let n = 0; n < e.childNodes.length; n++) {
		let r = e.childNodes[n];
		if (r.nodeType === 3) {
			let i = Ti(r.textContent, t);
			i && (n += i.childNodes.length - 1, e.replaceChild(i, r));
		} else if (r.nodeType === 1) {
			let e = " " + r.className + " ";
			t.ignoredTags.indexOf(r.nodeName.toLowerCase()) === -1 && t.ignoredClasses.every((t) => e.indexOf(" " + t + " ") === -1) && Ei(r, t);
		}
	}
}, Di = function(e, t) {
	if (!e) throw Error("No element provided to render");
	let n = {};
	for (let e in t) Object.prototype.hasOwnProperty.call(t, e) && (n[e] = t[e]);
	n.fences ? n.delimiters = wi(n.fences) : n.delimiters = n.delimiters || xi, n.ignoredTags = n.ignoredTags || [
		"script",
		"noscript",
		"style",
		"textarea",
		"pre",
		"code",
		"option"
	], n.ignoredClasses = n.ignoredClasses || [], n.errorCallback = n.errorCallback || console.error, n.macros = n.macros || {}, Ei(e, n), gi(e);
}, Oi = function(e, t, n = {}) {
	t.textContent = "";
	let r = t.tagName.toLowerCase() === "math";
	r && (n.wrap = "none");
	let i = Ni(e, n);
	r || i.children.length > 1 ? (t.textContent = "", i.children.forEach((e) => {
		t.appendChild(e.toNode());
	})) : t.appendChild(i.toNode());
};
typeof document < "u" && document.compatMode !== "CSS1Compat" && (typeof console < "u" && console.warn("Warning: Temml doesn't work in quirks mode. Make sure your website has a suitable doctype."), Oi = function() {
	throw new b("Temml doesn't work in quirks mode.");
});
var ki = function(e, t) {
	return Ni(e, t).toMarkup();
}, Ai = function(e, t) {
	return fi(e, new ve(t));
}, ji = function(e, t) {
	let n = new ve(t);
	if (n.macros = {}, !(typeof e == "string" || e instanceof String)) throw TypeError("Temml can only parse string typed expression");
	let r = new di(e, n, !0);
	return delete r.gullet.macros.current["\\df@tag"], r.parse();
}, Mi = function(e, t, n) {
	if (n.throwOnError || !(e instanceof b)) throw e;
	let r = new Oe(["temml-error"], [new ke(t + "\n\n" + e.toString())]);
	return r.style.color = n.errorColor, r.style.whiteSpace = "pre-line", r;
}, Ni = function(e, t) {
	let n = new ve(t);
	try {
		return st(fi(e, n), e, new mi({
			level: n.displayMode ? K.DISPLAY : K.TEXT,
			maxSize: n.maxSize
		}), n);
	} catch (t) {
		return Mi(t, e, n);
	}
}, Pi = {
	version: hi,
	render: Oi,
	renderToString: ki,
	renderMathInElement: Di,
	postProcess: gi,
	ParseError: b,
	definePreamble: ji,
	__parse: Ai,
	__renderToMathMLTree: Ni,
	__defineSymbol: D,
	__defineMacro: q
}, Fi = /* @__PURE__ */ new Map();
function Ii(e, t, n, r) {
	let i = `${n.displayMode ? "display" : "inline"}\n${e}`;
	t.setAttribute("data-math-render-key", i);
	let a = Fi.get(i);
	if (a) {
		t.innerHTML = a.html, a.error && t.setAttribute("data-temml-error", a.error);
		return;
	}
	try {
		Pi.render(e, t, Li(n)), Fi.set(i, { html: t.innerHTML });
	} catch (a) {
		if (t.getAttribute("data-math-render-key") !== i) return;
		Ri(e, t, n, i, r, a);
	}
}
function Li(e) {
	return {
		displayMode: e.displayMode,
		throwOnError: !0,
		strict: e.strict === !0 || e.strict === "error",
		trust: e.trust
	};
}
async function Ri(e, t, n, r, i, a) {
	try {
		let [{ default: i }, { default: a }] = await Promise.all([import("./katex-BdSA-FE_.js"), import("./katex.min-CUlRx5ub.js")]);
		if (t.getAttribute("data-math-render-key") !== r) return;
		zi(a), i.render(e, t, {
			...n,
			throwOnError: !0
		}), Fi.set(r, { html: t.innerHTML });
	} catch {
		if (t.getAttribute("data-math-render-key") !== r) return;
		a instanceof Error && t.setAttribute("data-temml-error", a.message), i(), Fi.set(r, {
			html: t.innerHTML,
			error: a instanceof Error ? a.message : String(a)
		});
	}
}
function zi(e) {
	if (Array.from(document.querySelectorAll("link[data-aaronnote-katex-css]")).some((t) => t.getAttribute("data-aaronnote-katex-css") === e)) return;
	let t = document.createElement("link");
	t.rel = "stylesheet", t.href = e, t.dataset.aaronnoteKatexCss = e, document.head.appendChild(t);
}
//#endregion
//#region src/features/auto-pair.ts
var Bi = {
	"[": "]",
	"(": ")",
	"{": "}"
}, Vi = new Set(Object.values(Bi));
function Hi(e) {
	return e.length === 0 || /^\s/.test(e);
}
function Ui() {
	return new t({ props: { handleTextInput(e, t, n, r) {
		if (t !== n) return !1;
		let a = e.state.doc.resolve(t);
		if (!a.parent.isTextblock) return !1;
		let o = a.parentOffset, s = a.parent.content.size, c = o < s ? a.parent.textBetween(o, o + 1) : "";
		if (Vi.has(r) && c === r) {
			let n = e.state.tr.setSelection(i.create(e.state.doc, t + 1));
			return e.dispatch(n), !0;
		}
		let l = Bi[r];
		if (!l || !Hi(a.parent.textBetween(o, s))) return !1;
		let u = e.state.tr.insertText(r + l, t, n);
		return u.setSelection(i.create(u.doc, t + 1)), e.dispatch(u), !0;
	} } });
}
var Wi = (e, t) => {
	let n = e.selection;
	if (!n.empty) return !1;
	let r = e.doc.resolve(n.from);
	if (!r.parent.isTextblock) return !1;
	let i = r.parentOffset, a = r.parent.content.size;
	if (i === 0 || i === a) return !1;
	let o = r.parent.textBetween(i - 1, i), s = r.parent.textBetween(i, i + 1);
	return Bi[o] === s ? (t && t(e.tr.delete(n.from - 1, n.from + 1)), !0) : !1;
}, Gi = {
	name: "auto_pair",
	plugins: () => [Ui()],
	keymap: (e) => ({ Backspace: Wi })
};
//#endregion
//#region src/inline-parse.ts
function Ki(e, t, n) {
	let r = [];
	for (let i = 0; i < e.length;) {
		if (e[i] !== t || n[i]) {
			i++;
			continue;
		}
		let a = i;
		for (; a < e.length && e[a] === t && !n[a];) a++;
		let o = i > 0 ? e[i - 1] : " ", s = a < e.length ? e[a] : " ";
		r.push({
			pos: i,
			len: a - i,
			canOpen: !/\s/.test(s),
			canClose: !/\s/.test(o)
		}), i = a;
	}
	return r;
}
function qi(e, t, n) {
	for (let r = t; r < n; r++) e[r] = 1;
}
function Ji(e, t, n, r, i) {
	let a = [], o = Ki(e, t, i).filter((e) => e.len >= n), s = /* @__PURE__ */ new Set();
	for (let c = 0; c < o.length; c++) {
		if (s.has(c)) continue;
		let l = o[c];
		if (!l.canOpen) continue;
		let u = -1;
		for (let e = o.length - 1; e > c; e--) if (!s.has(e) && o[e].canClose) {
			u = e;
			break;
		}
		if (u === -1) continue;
		let d = o[u], f = l.pos, p = f + n, m = d.pos + d.len, h = m - n, g = p, _ = h;
		if (g >= _ || /\s/.test(e[g]) || /\s/.test(e[_ - 1])) continue;
		let v = !1;
		for (let n = g; n < _; n++) if (e[n] === t) {
			v = !0;
			break;
		}
		v || (qi(i, f, m), s.add(c), s.add(u), a.push({
			type: r,
			from: g,
			to: _,
			openFrom: f,
			openTo: p,
			closeFrom: h,
			closeTo: m
		}));
	}
	return a;
}
function Yi(e, t, n, r = n) {
	let i = [], a = e.type.schema.marks[t];
	if (!a) return i;
	let o = -1, s = 0;
	return e.forEach((e) => {
		if (e.isText) {
			let t = e.marks.some((e) => e.type === a);
			t && o < 0 && (o = s), !t && o >= 0 && (i.push([o - n, s + r]), o = -1);
		}
		s += e.nodeSize;
	}), o >= 0 && i.push([o - n, s + r]), i;
}
function Xi(e, t = null) {
	let n = [], r = new Uint8Array(e.length);
	for (let i of Es()) for (let a of i.scan(e, r, t)) n.push(a);
	return n;
}
//#endregion
//#region src/features/autolink.ts
var Zi = RegExp("<((?:[a-zA-Z][a-zA-Z0-9+.-]*:[^\\s<>]+)|(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}))>", "g"), Qi = {
	name: "autolink",
	marks: { autolink: {
		attrs: { href: {} },
		inclusive: !1,
		parseDOM: [{
			tag: "a[data-autolink]",
			getAttrs: (e) => ({ href: e.getAttribute("href") ?? "" })
		}],
		toDOM: (e) => [
			"a",
			{
				href: e.attrs.href,
				"data-autolink": ""
			},
			0
		]
	} },
	mdItPlugins: [(e) => e.disable("autolink")],
	markDelims: { autolink: {
		open: "",
		close: ""
	} },
	inline: {
		priority: 2.5,
		scan: (e, t) => {
			let n = [];
			Zi.lastIndex = 0;
			let r;
			for (; r = Zi.exec(e);) {
				let e = r.index, i = e + r[0].length, a = !1;
				for (let n = e; n < i; n++) if (t[n]) {
					a = !0;
					break;
				}
				if (a) continue;
				let o = r[1], s = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(o) ? o : `mailto:${o}`;
				qi(t, e, i), n.push({
					type: "autolink",
					from: e + 1,
					to: i - 1,
					openFrom: e,
					openTo: e + 1,
					closeFrom: i - 1,
					closeTo: i,
					attrs: { href: s }
				});
			}
			return n;
		},
		markNames: ["autolink"],
		extRanges: (e) => {
			let t = [], n = e.type.schema.marks.autolink;
			if (!n) return t;
			let r = -1, i = 0, a = (e) => {
				r < 0 || (t.push([r - 1, e + 1]), r = -1);
			};
			return e.forEach((e) => {
				e.isText && (e.marks.some((e) => e.type === n) ? r < 0 && (r = i) : a(i)), i += e.nodeSize;
			}), a(i), t;
		}
	}
}, $i = {
	name: "blockquote",
	inputRules: (e) => [y(/^> $/, e.nodes.blockquote)]
};
//#endregion
//#region src/features/code.ts
function ea(e, t) {
	let n = [], r = [];
	for (let n = 0; n < e.length;) {
		if (e[n] !== "`" || t[n]) {
			n++;
			continue;
		}
		let i = n;
		for (; i < e.length && e[i] === "`" && !t[i];) i++;
		r.push({
			pos: n,
			len: i - n
		}), n = i;
	}
	let i = /* @__PURE__ */ new Set();
	for (let a = 0; a < r.length; a++) {
		if (i.has(a)) continue;
		let o = r[a];
		if (t[o.pos]) {
			i.add(a);
			continue;
		}
		let s = -1;
		for (let e = a + 1; e < r.length; e++) if (!(i.has(e) || t[r[e].pos]) && r[e].len === o.len) {
			s = e;
			break;
		}
		if (s === -1) {
			for (let e = a + 1; e < r.length; e++) if (!(i.has(e) || t[r[e].pos])) {
				s = e;
				break;
			}
		}
		if (s === -1) continue;
		let c = r[s], l = Math.min(o.len, c.len), u = o.pos, d = u + l, f = c.pos + c.len, p = f - l;
		if (d >= p) continue;
		let m = d, h = p;
		if (!/\S/.test(e.slice(m, h))) continue;
		let g = m, _ = h;
		for (; g < _ && /\s/.test(e[g]);) g += 1;
		for (; _ > g && /\s/.test(e[_ - 1]);) --_;
		let v = g > m || _ < h, y;
		v && (y = [{
			from: u,
			to: d
		}], g > m && y.push({
			from: m,
			to: g,
			softInside: !0
		}), _ < h && y.push({
			from: _,
			to: h,
			softInside: !0
		}), y.push({
			from: p,
			to: f
		})), qi(t, u, f), i.add(a), i.add(s);
		let ee = {
			type: "code",
			from: g,
			to: _,
			openFrom: u,
			openTo: d,
			closeFrom: p,
			closeTo: f
		};
		y && (ee.delimRanges = y), n.push(ee);
	}
	return n;
}
var ta = {
	name: "code",
	marks: { code: {
		parseDOM: [{ tag: "code" }],
		toDOM: () => ["code", 0]
	} },
	parserTokens: { code_inline: (e, t, n) => {
		let r = t.markup, i = t.content;
		r.length > 1 && i.includes(r[0]) && (i = ` ${i} `), e.addText(r), e.openMark(n.marks.code.create()), e.addText(i), e.closeMarkType(n.marks.code), e.addText(r);
	} },
	markDelims: { code: {
		open: "",
		close: ""
	} },
	inline: {
		priority: 0,
		scan: ea,
		markNames: ["code"],
		extRanges: (e) => {
			let t = [];
			if (!e.type.schema.marks.code) return t;
			let n = e.textContent, r = Yi(e, "code", 0);
			for (let [e, i] of r) {
				let r = e;
				for (r > 0 && n[r - 1] === " " && --r; r > 0 && n[r - 1] === "`";) --r;
				let a = i;
				for (a < n.length && n[a] === " " && (a += 1); a < n.length && n[a] === "`";) a += 1;
				t.push([r, a]);
			}
			return t;
		}
	}
}, na = ee, ra = Object.keys(na).sort(), ia = /:([a-z0-9_+\-]+):/g, aa = (e, t) => {
	let n = [];
	ia.lastIndex = 0;
	let r;
	for (; r = ia.exec(e);) {
		let e = na[r[1]];
		if (!e) continue;
		let i = r.index, a = i + r[0].length, o = !1;
		for (let e = i; e < a; e++) if (t[e]) {
			o = !0;
			break;
		}
		o || (qi(t, i, a), n.push({
			type: "emoji",
			from: i,
			to: a,
			openFrom: i,
			openTo: i,
			closeFrom: a,
			closeTo: a,
			delimRanges: [{
				from: i,
				to: a
			}],
			widgetDecorations: [{
				pos: i,
				when: "always",
				kind: "emoji",
				attrs: {
					glyph: e,
					len: String(a - i)
				},
				side: -1
			}]
		}));
	}
	return n;
}, oa = /\B:([a-z0-9_+\-]+)$/, sa = 8, ca = {
	open: !1,
	partial: "",
	matches: [],
	selected: 0,
	dismissedFor: "",
	from: 0,
	to: 0
}, la = new n("emoji-autocomplete");
function ua(e) {
	let t = [];
	for (let n of ra) if (n.startsWith(e) && t.push(n), t.length >= sa) return t;
	if (t.length < sa) {
		for (let n of ra) if (!t.includes(n) && (n.includes(e) && t.push(n), t.length >= sa)) break;
	}
	return t;
}
function da(e, t) {
	let n = e.selection;
	if (!n.empty) return ca;
	let r = n.$from;
	if (!r.parent.isTextblock) return ca;
	let i = r.parent.textBetween(0, r.parentOffset, "\n", "\n"), a = oa.exec(i);
	if (!a) return ca;
	let o = a[1];
	if (t.dismissedFor === o) return {
		...ca,
		dismissedFor: o
	};
	let s = ua(o);
	if (s.length === 0) return ca;
	let c = r.pos;
	return {
		open: !0,
		partial: o,
		matches: s,
		selected: t.open && t.partial === o && t.matches.length === s.length ? Math.min(t.selected, s.length - 1) : 0,
		dismissedFor: "",
		from: c - o.length - 1,
		to: c
	};
}
function fa(e, t, n) {
	let r = `:${t}: `, a = e.state.tr.insertText(r, n.from, n.to), o = n.from + r.length;
	a.setSelection(i.create(a.doc, o)), e.dispatch(a);
}
function pa() {
	return new t({
		key: la,
		state: {
			init: (e, t) => da(t, ca),
			apply(e, t, n, r) {
				let i = e.getMeta(la);
				if (i?.type === "select") {
					if (!t.open) return t;
					let e = t.matches.length - 1, n = Math.max(0, Math.min(e, i.index));
					return {
						...t,
						selected: n
					};
				}
				return i?.type === "dismiss" ? {
					...ca,
					dismissedFor: t.partial
				} : da(r, t);
			}
		},
		props: {
			decorations(e) {
				let t = la.getState(e);
				if (!t?.open) return o.empty;
				let n = ma(t);
				return o.create(e.doc, [a.widget(t.to, n, {
					side: 1,
					key: `emoji-auto@${t.partial}@${t.selected}`,
					ignoreSelection: !0,
					stopEvent: () => !0
				})]);
			},
			handleKeyDown(e, t) {
				let n = la.getState(e.state);
				if (!n?.open) return !1;
				if (t.key === "ArrowDown") return e.dispatch(e.state.tr.setMeta(la, {
					type: "select",
					index: n.selected + 1
				})), t.preventDefault(), !0;
				if (t.key === "ArrowUp") return e.dispatch(e.state.tr.setMeta(la, {
					type: "select",
					index: n.selected - 1
				})), t.preventDefault(), !0;
				if (t.key === "Enter" || t.key === "Tab") {
					let r = n.matches[n.selected];
					return r ? (fa(e, r, n), t.preventDefault(), !0) : !1;
				}
				return t.key === "Escape" ? (e.dispatch(e.state.tr.setMeta(la, { type: "dismiss" })), t.preventDefault(), !0) : !1;
			}
		},
		view(e) {
			let t = () => {
				let t = la.getState(e.state);
				if (!t?.open) return;
				let n = e.dom.querySelector(".emoji-completion");
				if (!n) return;
				let r = e.coordsAtPos(t.to, -1);
				n.style.top = `${r.bottom + 2}px`, n.style.left = `${r.left}px`;
				let i = n.querySelector(".emoji-completion-row.selected");
				if (i) {
					let e = n.getBoundingClientRect(), t = i.getBoundingClientRect();
					t.top < e.top ? n.scrollTop -= e.top - t.top : t.bottom > e.bottom && (n.scrollTop += t.bottom - e.bottom);
				}
			};
			return t(), { update() {
				t();
			} };
		}
	});
}
function ma(e) {
	let t = document.createElement("div");
	t.className = "emoji-completion", t.setAttribute("contenteditable", "false"), t.addEventListener("mousedown", (e) => e.preventDefault());
	for (let n = 0; n < e.matches.length; n++) {
		let r = e.matches[n], i = document.createElement("div");
		i.className = "emoji-completion-row", n === e.selected && i.classList.add("selected"), i.dataset.name = r;
		let a = document.createElement("span");
		a.className = "emoji-completion-glyph", a.textContent = na[r] ?? "";
		let o = document.createElement("span");
		o.className = "emoji-completion-name", o.textContent = `:${r}:`, i.appendChild(a), i.appendChild(o), i.addEventListener("click", () => {
			t.dispatchEvent(new CustomEvent("emoji-autocomplete-pick", {
				bubbles: !0,
				detail: { name: r }
			}));
		}), t.appendChild(i);
	}
	return t;
}
var ha = {
	name: "emoji",
	plugins: () => [
		pa(),
		new t({ view(e) {
			let t = (t) => {
				let n = t, r = la.getState(e.state);
				r?.open && fa(e, n.detail.name, r);
			};
			return e.dom.addEventListener("emoji-autocomplete-pick", t), { destroy() {
				e.dom.removeEventListener("emoji-autocomplete-pick", t);
			} };
		} }),
		new t({ props: { handleClick(e, t, n) {
			let r = n.target?.closest(".emoji-glyph");
			if (!r) return !1;
			let a = Number(r.getAttribute("data-len") ?? "0");
			if (!a) return !1;
			let o = e.posAtDOM(r, 0);
			if (o < 0) return !1;
			let s = o + a;
			return s > e.state.doc.content.size ? !1 : (n.preventDefault(), e.dispatch(e.state.tr.setSelection(i.create(e.state.doc, s))), e.focus(), !0);
		} } })
	],
	inline: {
		priority: .7,
		scan: aa,
		markNames: [],
		extRanges: () => []
	}
}, ga = (e) => /[A-Za-z0-9]/.test(e);
function _a(e, t, n, r) {
	let i = Ki(e, t, n);
	if (t === "_") for (let t of i) {
		let n = t.pos > 0 ? e[t.pos - 1] : " ", r = t.pos + t.len < e.length ? e[t.pos + t.len] : " ";
		ga(n) && (t.canOpen = !1), ga(r) && (t.canClose = !1);
	}
	let a = [];
	for (let t = 0; t < i.length; t++) {
		let o = i[t];
		if (o.canClose && a.length > 0) {
			let t = i[a.pop()], s = o;
			if (t.len >= 3 && s.len >= 3) {
				let i = t.pos, a = i + 1, o = s.pos + s.len, c = o - 1, l = a, u = l + 2, d = c, f = d - 2, p = u, m = f;
				if (p >= m || /\s/.test(e[p]) || /\s/.test(e[m - 1])) continue;
				qi(n, i, o), r.push({
					type: "em",
					from: a,
					to: c,
					openFrom: i,
					openTo: a,
					closeFrom: c,
					closeTo: o
				}), r.push({
					type: "strong",
					from: p,
					to: m,
					openFrom: l,
					openTo: u,
					closeFrom: f,
					closeTo: d
				});
				continue;
			}
			let c = Math.min(t.len, s.len) >= 2 ? 2 : 1, l = t.pos, u = l + c, d = s.pos + s.len, f = d - c, p = u, m = f;
			if (p >= m || /\s/.test(e[p]) || /\s/.test(e[m - 1])) continue;
			qi(n, l, d), r.push({
				type: c === 2 ? "strong" : "em",
				from: p,
				to: m,
				openFrom: l,
				openTo: u,
				closeFrom: f,
				closeTo: d
			});
			continue;
		}
		o.canOpen && a.push(t);
	}
}
var va = {
	name: "emphasis",
	marks: {
		em: {
			parseDOM: [{ tag: "em" }, { tag: "i" }],
			toDOM: () => ["em", 0]
		},
		strong: {
			parseDOM: [{ tag: "strong" }, { tag: "b" }],
			toDOM: () => ["strong", 0]
		}
	},
	parserTokens: {
		em_open: (e, t, n) => {
			e.addText(t.markup), e.openMark(n.marks.em.create());
		},
		em_close: (e, t, n) => {
			e.closeMarkType(n.marks.em), e.addText(t.markup);
		},
		strong_open: (e, t, n) => {
			e.addText(t.markup), e.openMark(n.marks.strong.create());
		},
		strong_close: (e, t, n) => {
			e.closeMarkType(n.marks.strong), e.addText(t.markup);
		}
	},
	markDelims: {
		em: {
			open: "",
			close: ""
		},
		strong: {
			open: "",
			close: ""
		}
	},
	inline: {
		priority: 2,
		scan: (e, t) => {
			let n = [];
			return _a(e, "*", t, n), _a(e, "_", t, n), n;
		},
		markNames: ["em", "strong"],
		extRanges: (e) => [...Yi(e, "em", 1), ...Yi(e, "strong", 2)]
	}
};
//#endregion
//#region src/block-draft.ts
function ya(e) {
	let r = new n("leaveLineDraft");
	function i(t) {
		let n = t.selection;
		if (!n.empty) return null;
		let r = n.$from, i = r.parent;
		if (i.type.name !== "paragraph") return null;
		let a = e.match(i.textContent);
		return a ? {
			paragraph: i,
			paragraphPos: r.before(),
			paragraphStart: r.start(),
			data: a.data,
			prefixLen: a.prefixLen
		} : null;
	}
	function s(t) {
		let n = i(t);
		if (!n) return o.empty;
		let { paragraph: r, paragraphPos: s, paragraphStart: c, data: l, prefixLen: u } = n, d = [a.node(s, s + r.nodeSize, { class: e.draftClass(l) })];
		return u > 0 && d.push(a.inline(c, c + u, { class: "syntax-hint" })), o.create(t.doc, d);
	}
	return {
		plugin: new t({
			key: r,
			state: {
				init: (e, t) => s(t),
				apply: (e, t, n, r) => s(r)
			},
			props: { decorations(e) {
				return r.getState(e);
			} },
			appendTransaction(t, n, r) {
				let i = n.selection;
				if (!i.empty) return null;
				let a = i.$from.parent;
				if (a.type.name !== "paragraph" || !e.match(a.textContent)) return null;
				let o = i.$from.before();
				for (let e of t) o = e.mapping.map(o);
				let s = r.selection;
				if (s.empty && s.$from.before() === o) return null;
				let c = r.doc.nodeAt(o);
				if (!c || c.type.name !== "paragraph") return null;
				let l = e.match(c.textContent);
				if (!l) return null;
				let u = r.tr;
				return e.commit(u, o, c, l.data), u.docChanged ? u : null;
			}
		}),
		commit: (t) => {
			let n = i(t.state);
			if (!n) return !1;
			let r = t.state.tr;
			return e.commit(r, n.paragraphPos, n.paragraph, n.data), r.docChanged ? (t.dispatch(r), !0) : !1;
		}
	};
}
//#endregion
//#region src/features/fenced-code.ts
var ba = /^```(\w*)$/, Z = new n("fencedCodeLangFocus");
function xa(e, t) {
	let n = e.doc.resolve(t);
	for (let e = n.depth; e >= 0; e--) if (n.node(e).type.name === "code_block") return n.before(e);
	return null;
}
var Sa = class {
	dom;
	contentDOM;
	chromeEl;
	inputEl;
	view;
	getPos;
	constructor(e, t, n, r = []) {
		this.view = t, this.getPos = n;
		let i = document.createElement("pre"), a = e.attrs.lang ?? "";
		a && i.setAttribute("data-lang", a);
		let o = document.createElement("code");
		i.appendChild(o);
		let s = document.createElement("div");
		s.className = "cb-chrome", s.setAttribute("contenteditable", "false");
		let c = document.createElement("input");
		c.className = "cb-lang-input", c.placeholder = "lang", c.value = a, c.spellcheck = !1, s.appendChild(c), i.appendChild(s), this.dom = i, this.contentDOM = o, this.chromeEl = s, this.inputEl = c, c.addEventListener("input", this.onInput), c.addEventListener("keydown", this.onInputKeyDown), c.addEventListener("mousedown", (e) => e.stopPropagation()), this.applyDecorations(r);
	}
	applyDecorations(e) {
		let t = !1, n = !1;
		for (let r of e) {
			let e = r.spec;
			e?.cbActive && (t = !0), e?.cbLangFocus && (n = !0);
		}
		if (this.dom.classList.toggle("cb-active", t || n), this.dom.classList.toggle("cb-lang-focus", n), n ? this.dom.setAttribute("data-lang-focus", "1") : this.dom.removeAttribute("data-lang-focus"), n && typeof this.inputEl.focus == "function") try {
			this.inputEl.focus();
		} catch {}
	}
	onInput = () => {
		let e = this.getPos();
		if (e == null) return;
		let t = this.inputEl.value, n = this.view.state.tr.setNodeAttribute(e, "lang", t);
		n.setMeta(Z, { pos: e }), this.view.dispatch(n);
	};
	onInputKeyDown = (e) => {
		if (e.key === "ArrowUp" || e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			let t = this.getPos();
			if (t == null) return;
			let n = this.view.state.doc.nodeAt(t);
			if (!n) return;
			let r = t + n.nodeSize - 1, a = this.view.state.tr.setSelection(i.create(this.view.state.doc, r));
			a.setMeta(Z, null), this.view.dispatch(a), this.view.focus();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			let t = this.getPos();
			if (t == null) return;
			let n = this.view.state.doc.nodeAt(t);
			if (!n) return;
			let r = t + n.nodeSize, a = this.view.state.tr;
			if (a.setMeta(Z, null), r < this.view.state.doc.content.size) a.setSelection(i.create(a.doc, r + 1));
			else {
				let e = this.view.state.schema.nodes.paragraph?.createAndFill();
				e && (a.insert(r, e), a.setSelection(i.create(a.doc, r + 1)));
			}
			this.view.dispatch(a), this.view.focus();
		}
	};
	update(e, t) {
		if (e.type.name !== "code_block") return !1;
		let n = e.attrs.lang ?? "";
		return n ? this.dom.setAttribute("data-lang", n) : this.dom.removeAttribute("data-lang"), this.inputEl.value !== n && (this.inputEl.value = n), this.applyDecorations(t), !0;
	}
	stopEvent(e) {
		return this.chromeEl.contains(e.target);
	}
	ignoreMutation(e) {
		return this.chromeEl.contains(e.target);
	}
	destroy() {
		this.inputEl.removeEventListener("input", this.onInput), this.inputEl.removeEventListener("keydown", this.onInputKeyDown);
	}
};
function Ca() {
	return new t({
		key: Z,
		state: {
			init: () => null,
			apply: (e, t) => {
				let n = e.getMeta(Z);
				if (n === null) return null;
				if (n !== void 0) return n;
				if (!t) return null;
				let r = e.mapping.map(t.pos), i = e.doc.nodeAt(r);
				return !i || i.type.name !== "code_block" ? null : { pos: r };
			}
		},
		props: {
			nodeViews: { code_block: (e, t, n, r) => new Sa(e, t, n, r) },
			decorations(e) {
				let t = [], n = e.selection;
				if (n.empty) {
					let r = xa(e, n.from);
					if (r !== null) {
						let n = e.doc.nodeAt(r);
						n && t.push(a.node(r, r + n.nodeSize, { class: "cb-active" }, { cbActive: !0 }));
					}
				}
				let r = Z.getState(e);
				if (r) {
					let n = e.doc.nodeAt(r.pos);
					n && n.type.name === "code_block" && t.push(a.node(r.pos, r.pos + n.nodeSize, { class: "cb-active cb-lang-focus" }, {
						cbActive: !0,
						cbLangFocus: !0
					}));
				}
				return t.length > 0 ? o.create(e.doc, t) : null;
			},
			handleKeyDown(e, t) {
				if (t.key !== "ArrowDown" && t.key !== "ArrowUp" || t.shiftKey || t.metaKey || t.ctrlKey || t.altKey) return !1;
				let n = e.state, r = Z.getState(n);
				if (r) {
					let a = n.doc.nodeAt(r.pos);
					if (!a || a.type.name !== "code_block") return e.dispatch(n.tr.setMeta(Z, null)), !0;
					if (t.key === "ArrowUp") {
						let t = r.pos + a.nodeSize - 1, o = n.tr.setSelection(i.create(n.doc, t)).setMeta(Z, null);
						return e.dispatch(o), !0;
					}
					let o = r.pos + a.nodeSize, s = n.tr.setMeta(Z, null);
					if (o < n.doc.content.size) s.setSelection(i.create(s.doc, o + 1));
					else {
						let e = n.schema.nodes.paragraph?.createAndFill();
						e && (s.insert(o, e), s.setSelection(i.create(s.doc, o + 1)));
					}
					return e.dispatch(s), !0;
				}
				let a = n.selection;
				if (!a.empty) return !1;
				let o = a.$from;
				if (t.key === "ArrowDown" && o.parent.type.name === "code_block" && o.parentOffset === o.parent.content.size) {
					let t = o.before();
					return e.dispatch(n.tr.setMeta(Z, { pos: t })), !0;
				}
				if (t.key === "ArrowUp" && o.depth >= 1 && o.parentOffset === 0) {
					let t = o.before();
					if (t > 0) {
						let r = n.doc.resolve(t), a = r.index();
						if (a > 0) {
							let o = r.parent.child(a - 1);
							if (o.type.name === "code_block") {
								let r = t - o.nodeSize, a = r + o.nodeSize - 1, s = n.tr.setSelection(i.create(n.doc, a)).setMeta(Z, { pos: r });
								return e.dispatch(s), !0;
							}
						}
					}
				}
				return !1;
			}
		}
	});
}
function wa(e) {
	return ya({
		match: (e) => {
			let t = ba.exec(e);
			return t ? {
				data: { lang: t[1] ?? "" },
				prefixLen: 3
			} : null;
		},
		draftClass: () => "fenced-code-draft",
		commit: (t, n, r, i) => {
			let a = e.nodes.code_block.create({ lang: i.lang }, null);
			t.replaceWith(n, n + r.nodeSize, a);
		}
	});
}
var Ta = {
	name: "code_block",
	plugins: (e) => [wa(e).plugin, Ca()],
	keymap: (e) => ({
		Enter: (t, n) => {
			let r = t.selection;
			if (!r.empty) return !1;
			let a = r.$from, o = a.parent;
			if (o.type.name !== "paragraph") return !1;
			let s = ba.exec(o.textContent);
			if (!s) return !1;
			if (n) {
				let r = s[1] ?? "", c = a.before(), l = e.nodes.code_block.create({ lang: r }, null), u = t.tr.replaceWith(c, c + o.nodeSize, l);
				u.setSelection(i.create(u.doc, c + 1)), n(u);
			}
			return !0;
		},
		Backspace: (t, n) => {
			let r = t.selection;
			if (!r.empty) return !1;
			let i = r.$from;
			if (i.parent.type.name !== "code_block" || i.parent.content.size > 0) return !1;
			if (n) {
				let r = i.before(), a = i.parent.nodeSize, o = t.tr.delete(r, r + a);
				if (o.doc.content.size === 0) {
					let t = e.nodes.paragraph.createAndFill();
					t && o.insert(0, t);
				}
				n(o);
			}
			return !0;
		}
	})
}, Ea = (e, t, n, r) => {
	if (t !== 0 || e.tShift[t] !== 0) return !1;
	let i = e.bMarks[t];
	if (e.eMarks[t] - i !== 3 || e.src.slice(i, i + 3) !== "---") return !1;
	let a = -1;
	for (let r = t + 1; r <= n; r++) {
		let t = e.bMarks[r], n = e.eMarks[r];
		if (e.tShift[r] === 0 && n - t === 3 && e.src.slice(t, n) === "---") {
			a = r;
			break;
		}
	}
	if (a === -1) return !1;
	if (r) return !0;
	let o = e.src.slice(e.bMarks[t + 1], e.bMarks[a]).replace(/\n$/, ""), s = e.push("front_matter", "div", 0);
	return s.content = o, s.markup = "---", s.block = !0, s.map = [t, a + 1], e.line = a + 1, !0;
}, Da = {
	name: "front-matter",
	nodes: { front_matter: {
		group: "block",
		content: "text*",
		code: !0,
		marks: "",
		defining: !0,
		parseDOM: [{
			tag: "yaml-block",
			preserveWhitespace: "full"
		}],
		toDOM: () => ["yaml-block", 0]
	} },
	mdItPlugins: [(e) => {
		e.block.ruler.before("hr", "front_matter", Ea, { alt: [
			"paragraph",
			"reference",
			"blockquote",
			"list"
		] });
	}],
	parserTokens: { front_matter: (e, t, n) => {
		let r = t.content, i = r ? [n.text(r)] : [];
		e.push(n.nodes.front_matter.createChecked({}, i));
	} },
	blockHandlers: { front_matter: (e, t) => {
		e.write("---\n"), e.tick("inner");
		for (let n of t.textContent) e.tick("inner"), n === "\n" ? (e.out += "\n", e.delim && (e.out += e.delim)) : e.out += n, e.advance(1);
		e.tick("inner"), e.write("\n---"), e.closeBlock(t);
	} },
	keymap: (e) => ({
		Enter: (t, n) => {
			let r = t.selection;
			if (!r.empty) return !1;
			let a = r.$from, o = e.nodes.front_matter;
			if (a.parent.type.name === "paragraph" && a.depth === 1 && a.index(0) === 0 && a.parent.textContent === "---") {
				if (n) {
					let e = o.create(), r = a.before(), s = a.after(), c = t.tr;
					c.replaceWith(r, s, e);
					let l = r + 1;
					c.setSelection(i.create(c.doc, l)), n(c);
				}
				return !0;
			}
			if (a.parent.type === o) {
				let r = a.parent.textContent;
				if (a.parentOffset === r.length && r.endsWith("\n")) {
					if (n) {
						let r = t.tr, o = a.after();
						r.delete(o - 2, o - 1);
						let s = o - 1;
						if (s >= r.doc.content.size) {
							let t = e.nodes.paragraph.create();
							r.insert(s, t);
						}
						r.setSelection(i.create(r.doc, s + 1)), n(r);
					}
					return !0;
				}
				return !1;
			}
			return !1;
		},
		ArrowDown: (e, t) => {
			let n = e.selection;
			if (!n.empty) return !1;
			let r = n.$from, a = e.schema.nodes.front_matter;
			if (r.parent.type !== a || r.parent.textContent.slice(r.parentOffset).includes("\n")) return !1;
			if (t) {
				let n = e.tr, a = r.after();
				if (a >= n.doc.content.size) {
					let t = e.schema.nodes.paragraph.create();
					n.insert(a, t);
				}
				n.setSelection(i.create(n.doc, a + 1)), t(n);
			}
			return !0;
		}
	})
}, Oa = /^(#{1,6}) (.+)$/;
function ka() {
	return new t({ props: { handleKeyDown(e, t) {
		if (t.key !== "ArrowDown" || t.shiftKey || t.metaKey || t.ctrlKey || t.altKey) return !1;
		let { state: n } = e, a = n.selection;
		if (!a.empty) return !1;
		let o = a.$from.parent;
		if (o.type.name !== "paragraph" || !Oa.test(o.textContent)) return !1;
		let s = r.atEnd(n.doc);
		if (a.from !== s.from) return !1;
		let c = n.schema.nodes.paragraph;
		if (!c) return !1;
		let l = c.createAndFill();
		if (!l) return !1;
		let u = n.doc.content.size, d = n.tr.insert(u, l);
		return d.setSelection(i.create(d.doc, u + 1)), e.dispatch(d), !0;
	} } });
}
function Aa(e) {
	return ya({
		match: (e) => {
			let t = Oa.exec(e);
			if (!t) return null;
			let n = t[1].length;
			return {
				data: { level: n },
				prefixLen: n + 1
			};
		},
		draftClass: (e) => `heading-draft-${e.level}`,
		commit: (t, n, r, i) => {
			let a = i.level + 1, o = r.content.cut(a), s = e.nodes.heading.create({ level: i.level }, o);
			t.replaceWith(n, n + r.nodeSize, s);
		}
	});
}
var ja = {
	name: "heading",
	plugins: (e) => [Aa(e).plugin, ka()],
	keymap: (e) => ({ Backspace: (t, n) => {
		let r = t.selection;
		if (!r.empty) return !1;
		let i = r.$from;
		if (i.parent.type.name !== "heading" || i.parentOffset !== 0 || i.parent.content.size > 0) return !1;
		if (n) {
			let r = t.tr, a = i.before();
			r.setBlockType(a, a + i.parent.nodeSize, e.nodes.paragraph), n(r);
		}
		return !0;
	} })
}, Ma = {
	name: "highlight",
	marks: { highlight: {
		parseDOM: [{ tag: "mark" }],
		toDOM: () => ["mark", 0]
	} },
	markDelims: { highlight: {
		open: "",
		close: ""
	} },
	inline: {
		priority: 1.5,
		scan: (e, t) => Ji(e, "=", 2, "highlight", t),
		markNames: ["highlight"],
		extRanges: (e) => Yi(e, "highlight", 2)
	}
}, Na = /^(-{3,}|\*{3,}|_{3,})$/;
function Pa(e) {
	return ya({
		match: (e) => {
			let t = Na.exec(e);
			return t ? {
				data: { variant: t[1][0] },
				prefixLen: t[1].length
			} : null;
		},
		draftClass: () => "hr-draft",
		commit: (t, n, r) => {
			let i = e.nodes.horizontal_rule.create(), a = t.doc.resolve(n).parent;
			if (t.doc.resolve(n).index() === a.childCount - 1) {
				let a = e.nodes.paragraph.create();
				t.replaceWith(n, n + r.nodeSize, [i, a]);
			} else t.replaceWith(n, n + r.nodeSize, i);
		}
	});
}
var Fa = {
	name: "horizontal_rule",
	plugins: (e) => [Pa(e).plugin]
}, Ia = /<!--([\s\S]*?)-->/g, La = {
	name: "html-comment",
	marks: { html_comment: {
		inclusive: !1,
		parseDOM: [{ tag: "mark-comment" }],
		toDOM: () => ["mark-comment", 0]
	} },
	markDelims: { html_comment: {
		open: "",
		close: ""
	} },
	inline: {
		priority: .5,
		scan: (e, t) => {
			let n = [];
			Ia.lastIndex = 0;
			let r;
			for (; r = Ia.exec(e);) {
				let e = r.index, i = e + r[0].length, a = !1;
				for (let n = e; n < i; n++) if (t[n]) {
					a = !0;
					break;
				}
				a || (qi(t, e, i), n.push({
					type: "html_comment",
					from: e,
					to: i,
					openFrom: e,
					openTo: e,
					closeFrom: i,
					closeTo: i
				}));
			}
			return n;
		},
		markNames: ["html_comment"],
		extRanges: (e) => {
			let t = [], n = e.type.schema.marks.html_comment;
			if (!n) return t;
			let r = -1, i = 0, a = (e) => {
				r >= 0 && t.push([r, e]), r = -1;
			};
			return e.forEach((e) => {
				e.isText && (e.marks.some((e) => e.type === n) ? r < 0 && (r = i) : a(i)), i += e.nodeSize;
			}), a(i), t;
		}
	}
};
//#endregion
//#region src/features/image.ts
function Ra(e) {
	return window.AaronnoteResolveAssetUrl?.(e) ?? e;
}
var za = /!\[([^\]]*?)\]\(([^\s)]*)(?:\s+"([^"]*)")?\)/g, Ba = /* @__PURE__ */ new Map(), Va = "image-load-status-changed", Ha = (e, t) => {
	let n = [];
	za.lastIndex = 0;
	let r;
	for (; r = za.exec(e);) {
		let e = r.index, i = e + r[0].length, a = !1;
		for (let n = e; n < i; n++) if (t[n]) {
			a = !0;
			break;
		}
		if (a) continue;
		let o = e, s = e + 2, c = s, l = s + r[1].length, u = l, d = i;
		qi(t, e, i);
		let f = r[2], p = r[3] ?? null, m = r[1], h = {
			type: "image",
			from: c,
			to: l,
			openFrom: o,
			openTo: s,
			closeFrom: u,
			closeTo: d,
			attrs: {
				src: f,
				title: p
			},
			widgetDecorations: []
		}, g = f === "" ? null : Ba.get(f) ?? null, _ = f === "" || g === "error", v = {
			pos: o,
			kind: "image-icon",
			side: 1,
			attrs: g === "error" ? { broken: "1" } : void 0
		};
		_ ? (h.delimRanges = [], h.widgetDecorations.push({
			...v,
			when: "always"
		}, {
			pos: u + 2,
			when: "always",
			kind: "file-input"
		})) : (h.delimRanges = [{
			from: o,
			to: d,
			softInside: !0
		}], h.widgetDecorations.push({
			...v,
			when: "inside"
		}, {
			pos: d,
			when: "always",
			kind: "image-render",
			attrs: {
				src: f,
				alt: m,
				...p ? { title: p } : {}
			}
		})), n.push(h);
	}
	return n;
};
function Ua() {
	return new t({ view(e) {
		let t = (t) => {
			if (Ba.has(t)) return;
			Ba.set(t, "loading");
			let n = new Image(), r = (n) => {
				Ba.set(t, n), e.dispatch(e.state.tr.setMeta(Va, n));
			};
			n.onload = () => r("ok"), n.onerror = () => r("error"), n.src = Ra(t);
		}, n = () => {
			e.state.doc.descendants((e) => {
				if (!e.isTextblock) return !0;
				let n = e.textContent;
				za.lastIndex = 0;
				let r;
				for (; r = za.exec(n);) {
					let e = r[2];
					e && t(e);
				}
				return !1;
			});
		};
		return n(), {
			update: () => n(),
			destroy: () => {}
		};
	} });
}
function Wa() {
	return new t({ view(e) {
		let t = (t) => {
			let n = t, r = n.target;
			if (!r?.classList?.contains("file-input")) return;
			let i = n.detail?.files?.[0];
			if (!i) return;
			let a = r.getAttribute("data-pos");
			if (!a) return;
			let o = Number(a);
			if (!Number.isFinite(o) || !e.dom.dispatchEvent(new CustomEvent("aaronnote:insert-files", {
				bubbles: !0,
				cancelable: !0,
				detail: {
					files: [i],
					pos: o,
					mode: "image-src"
				}
			}))) return;
			let s = URL.createObjectURL(i);
			e.dispatch(e.state.tr.insertText(s, o));
		};
		return e.dom.addEventListener("file-input-pick", t), { destroy() {
			e.dom.removeEventListener("file-input-pick", t);
		} };
	} });
}
function Ga(e) {
	let t = String(e.attrs.src ?? ""), n = e.attrs.title;
	return n ? `](${t} "${n.replace(/"/g, "\\\"")}")` : `](${t})`;
}
var Ka = {
	name: "image",
	marks: { image: {
		attrs: {
			src: { default: "" },
			title: { default: null }
		},
		inclusive: !1,
		parseDOM: [{
			tag: "span[data-image-mark]",
			getAttrs: (e) => ({
				src: e.getAttribute("data-src") ?? "",
				title: e.getAttribute("data-title")
			})
		}],
		toDOM: (e) => {
			let { src: t, title: n } = e.attrs, r = { "data-image-mark": "" };
			return t && (r["data-src"] = t), n && (r["data-title"] = n), [
				"span",
				r,
				0
			];
		}
	} },
	parserTokens: { image: (e, t, n) => {
		let r = t.attrGet("src") ?? "", i = t.attrGet("title"), a = t.content;
		e.addText("!["), e.openMark(n.marks.image.create({
			src: r,
			title: i || null
		})), e.addText(a), e.closeMarkType(n.marks.image), e.addText(i ? `](${r} "${i}")` : `](${r})`);
	} },
	markDelims: { image: {
		open: "",
		close: ""
	} },
	plugins: () => [Wa(), Ua()],
	inline: {
		priority: 2.5,
		scan: Ha,
		markNames: ["image"],
		extRanges: (e) => {
			let t = [], n = e.type.schema.marks.image;
			if (!n) return t;
			let r = -1, i = null, a = 0, o = (e) => {
				r < 0 || !i || (t.push([r - 2, e + Ga(i).length]), r = -1, i = null);
			};
			return e.forEach((e) => {
				if (e.isText) {
					let t = e.marks.find((e) => e.type === n) ?? null;
					t ? r < 0 ? (r = a, i = t) : i && !t.eq(i) && (o(a), r = a, i = t) : o(a);
				}
				a += e.nodeSize;
			}), o(a), t;
		}
	}
}, qa = /\[([^\]]*?)\]\(([^\s)]*)(?:\s+"([^"]*)")?\)/g, Ja = (e, t) => {
	let n = [];
	qa.lastIndex = 0;
	let r;
	for (; r = qa.exec(e);) {
		let e = r.index, i = e + r[0].length, a = e, o = e + 1, s = o, c = o + r[1].length, l = c, u = i, d = !1;
		for (let e = a; e < o; e++) if (t[e]) {
			d = !0;
			break;
		}
		if (!d) {
			for (let e = l; e < u; e++) if (t[e]) {
				d = !0;
				break;
			}
		}
		if (d) continue;
		qi(t, a, o), qi(t, l, u);
		let f = r[2], p = r[3] ?? null, m = {
			type: "link",
			from: s,
			to: c,
			openFrom: a,
			openTo: o,
			closeFrom: l,
			closeTo: u,
			attrs: {
				href: f,
				title: p
			}
		};
		if (r[1] === "") if (f === "" || p !== null) m.delimRanges = [{
			from: a,
			to: o,
			forceVisible: !0
		}, {
			from: l,
			to: u,
			forceVisible: !0
		}];
		else {
			let e = l + 2, t = u - 1;
			m.delimRanges = [
				{
					from: a,
					to: o,
					forceVisible: !0
				},
				{
					from: l,
					to: e,
					forceVisible: !0
				},
				{
					from: t,
					to: u,
					forceVisible: !0
				}
			], m.extraDecorations = [{
				from: e,
				to: t,
				nodeName: "a",
				attrs: { href: f }
			}];
		}
		n.push(m);
	}
	return n;
};
function Ya(e) {
	let t = String(e.attrs.href ?? ""), n = e.attrs.title;
	return n ? `](${t} "${n.replace(/"/g, "\\\"")}")` : `](${t})`;
}
var Xa = {
	name: "link",
	marks: { link: {
		attrs: {
			href: {},
			title: { default: null }
		},
		inclusive: !1,
		parseDOM: [{
			tag: "a[href]",
			getAttrs: (e) => ({
				href: e.getAttribute("href"),
				title: e.getAttribute("title")
			})
		}],
		toDOM: (e) => {
			let { href: t, title: n } = e.attrs;
			return [
				"a",
				n ? {
					href: t,
					title: n
				} : { href: t },
				0
			];
		}
	} },
	parserTokens: {
		link_open: (e, t, n) => {
			let r = t.attrGet("href") ?? "", i = t.attrGet("title");
			e.addText("["), e.openMark(n.marks.link.create({
				href: r,
				title: i || null
			}));
		},
		link_close: (e, t, n) => {
			let r = e.topMark(n.marks.link);
			e.closeMarkType(n.marks.link), r && e.addText(Ya(r));
		}
	},
	markDelims: { link: {
		open: "",
		close: ""
	} },
	inline: {
		priority: 3,
		scan: Ja,
		markNames: ["link"],
		extRanges: (e) => {
			let t = [], n = e.type.schema.marks.link;
			if (!n) return t;
			let r = -1, i = null, a = 0, o = (e) => {
				r < 0 || !i || (t.push([r - 1, e + Ya(i).length]), r = -1, i = null);
			};
			return e.forEach((e) => {
				if (e.isText) {
					let t = e.marks.find((e) => e.type === n) ?? null;
					t ? r < 0 ? (r = a, i = t) : i && !t.eq(i) && (o(a), r = a, i = t) : o(a);
				}
				a += e.nodeSize;
			}), o(a), t;
		}
	}
}, Za = /^\[([^\]]+)\]:/, Qa = /^\[([^\]]+)\]:\s+(\S+)(?:\s+"([^"]*)")?\s*$/;
function $a() {
	return new t({ props: { decorations(e) {
		let t = [], n = e.selection.empty ? e.selection.from : -1;
		return e.doc.descendants((e, r) => {
			if (e.type.name === "paragraph") {
				let n = e.textContent, i = Za.exec(n);
				if (!i) return !1;
				let o = r + 1, s = i[1].length, c = o, l = o + 1 + s, u = l + 2;
				return t.push(a.inline(c, c + 1, { class: "syntax-hint-italic" })), t.push(a.inline(l, u, { class: "syntax-hint-italic" })), !1;
			}
			if (e.type.name !== "link_def") return !0;
			let i = r, o = r + e.nodeSize, s = n > i && n < o, c = r + 1;
			return e.forEach((e) => {
				let n = c, r = n + e.nodeSize, i = e.content.size === 0;
				i && e.type.name === "ref_url" && t.push(a.node(n, r, { "data-placeholder": "input link url here" })), i && e.type.name === "ref_title" && s && t.push(a.node(n, r, { "data-placeholder": "title (optional)" })), c = r;
			}), !1;
		}), t.length > 0 ? o.create(e.doc, t) : o.empty;
	} } });
}
function eo(e, t, n, r) {
	return e.nodes.link_def.createChecked(null, [
		e.nodes.ref_label.create(null, t ? [e.text(t)] : []),
		e.nodes.ref_url.create(null, n ? [e.text(n)] : []),
		e.nodes.ref_title.create(null, r ? [e.text(r)] : [])
	]);
}
var to = {
	name: "ref-def",
	nodes: {
		link_def: {
			group: "block",
			content: "ref_label ref_url ref_title",
			defining: !0,
			isolating: !0,
			parseDOM: [{ tag: "ref-def" }],
			toDOM: () => ["ref-def", 0]
		},
		ref_label: {
			content: "text*",
			defining: !0,
			parseDOM: [{ tag: "ref-label" }],
			toDOM: () => ["ref-label", 0]
		},
		ref_url: {
			content: "text*",
			defining: !0,
			parseDOM: [{ tag: "ref-url" }],
			toDOM: () => ["ref-url", 0]
		},
		ref_title: {
			content: "text*",
			defining: !0,
			parseDOM: [{ tag: "ref-title" }],
			toDOM: () => ["ref-title", 0]
		}
	},
	plugins: () => [$a()],
	keymap: (e) => ({ Enter: (t, n) => {
		let r = t.selection;
		if (!r.empty) return !1;
		let a = r.$from;
		if (a.parent.type.name === "paragraph") {
			let r = a.parent.textContent, o = Qa.exec(r);
			if (!o) return !1;
			if (n) {
				let [, r, s, c] = o, l = eo(e, r, s, c || ""), u = a.before(), d = a.after(), f = t.tr;
				f.replaceWith(u, d, [l, e.nodes.paragraph.create()]);
				let p = u + 2;
				f.setSelection(i.create(f.doc, p)), n(f);
			}
			return !0;
		}
		for (let r = a.depth; r >= 0; r--) {
			let o = a.node(r);
			if (o.type.name !== "link_def") continue;
			let s = o.child(0).content.size === 0, c = o.child(1).content.size === 0, l = o.child(2).content.size === 0;
			if (s && c && l) {
				if (n) {
					let o = t.tr, s = a.before(r), c = a.after(r);
					o.replaceWith(s, c, e.nodes.paragraph.create()), o.setSelection(i.create(o.doc, s + 1)), n(o);
				}
				return !0;
			}
			if (c) return !1;
			if (n) {
				let o = a.after(r), s = eo(e, "", "", ""), c = t.tr;
				c.insert(o, s);
				let l = o + 2;
				c.setSelection(i.create(c.doc, l)), n(c);
			}
			return !0;
		}
		return !1;
	} }),
	blockHandlers: { link_def: (e, t) => {
		let n = t.child(0).textContent, r = t.child(1).textContent, i = t.child(2).textContent;
		e.write(`[${n}]: ${r}`), i && (e.out += ` "${i}"`), e.closeBlock(t);
	} }
};
//#endregion
//#region src/features/list.ts
function no(e, t) {
	return (n, r) => {
		let { $from: a, empty: o } = n.selection;
		if (!o) return !1;
		let s = a.parent;
		if (s.type !== t || s.content.size !== 0) return !1;
		let c = a.depth - 1;
		if (c < 1) return !1;
		let l = a.node(c);
		if (l.type !== e || l.childCount !== 1) return !1;
		let u = c - 1;
		if (u < 1) return !1;
		let d = a.node(u);
		if (d.type.name !== "bullet_list" && d.type.name !== "ordered_list") return !1;
		let f = u - 1;
		if (f < 1 || a.node(f).type !== e) return !1;
		let p = a.before(c), m = a.after(c), h = a.after(f);
		if (r) {
			let e = n.tr;
			d.childCount === 1 ? e.delete(a.before(u), a.after(u)) : e.delete(p, m);
			let o = e.mapping.map(h) - 1, s = t.createAndFill();
			if (!s) return !1;
			e.insert(o, s), e.setSelection(i.create(e.doc, o + 1)), e.scrollIntoView(), r(e);
		}
		return !0;
	};
}
function ro(e) {
	return (t, n) => {
		let { $from: r, empty: a } = t.selection;
		if (!a) return !1;
		let o = r.parent;
		if (o.type.name !== "paragraph" || o.content.size !== 0) return !1;
		let s = r.depth, c = s - 1;
		if (c < 1 || r.node(c).type !== e || r.index(c) === 0) return !1;
		let l = c - 1;
		if (l < 1) return !1;
		let u = r.node(l);
		if (u.type.name !== "bullet_list" && u.type.name !== "ordered_list") return !1;
		let d = r.before(s), f = r.after(s), p = r.after(c);
		if (n) {
			let r = t.tr;
			r.delete(d, f);
			let a = e.createAndFill();
			if (!a) return !1;
			let o = r.mapping.map(p);
			r.insert(o, a), r.setSelection(i.create(r.doc, o + 2)), r.scrollIntoView(), n(r);
		}
		return !0;
	};
}
function io(e) {
	return (t, n) => {
		let { $from: r, empty: a } = t.selection;
		if (!a || !r.parent.isTextblock || r.parent.content.size !== 0) return !1;
		let o = -1;
		for (let t = r.depth; t > 0; t--) if (r.node(t).type === e) {
			o = t;
			break;
		}
		if (o === -1) return !1;
		let s = o - 1;
		if (s !== 1 || r.index(s) !== 0) return !1;
		if (n) {
			let a = r.after(o), s = e.createAndFill();
			if (!s) return !1;
			let c = t.tr.insert(a, s);
			c.setSelection(i.create(c.doc, a + 2)), n(c);
		}
		return !0;
	};
}
function ao() {
	return (e, t) => {
		let { $from: n, empty: i } = e.selection;
		if (!i || n.depth !== 1) return !1;
		let a = n.parent;
		if (!a.isTextblock || a.content.size !== 0) return !1;
		let o = n.index(0);
		if (o === 0) return !1;
		let s = e.doc.child(o - 1);
		if (s.type.name !== "bullet_list" && s.type.name !== "ordered_list") return !1;
		if (t) {
			let i = n.before(), a = n.after(), o = e.tr.delete(i, a), s = o.doc.resolve(i - 1), c = r.findFrom(s, -1, !0);
			c && o.setSelection(c), t(o);
		}
		return !0;
	};
}
var oo = {
	name: "bullet_list",
	inputRules: (e) => [y(/^-\s$/, e.nodes.bullet_list), y(/^(\d+)\.\s$/, e.nodes.ordered_list, (e) => ({ start: Number(e[1]) }), (e, t) => t.childCount + t.attrs.start === Number(e[1]))],
	keymap: (e) => {
		let t = e.nodes.list_item, n = e.nodes.paragraph;
		return {
			Enter: g(no(t, n), ro(t), io(t), re(t), te(t)),
			Tab: ne(t),
			Backspace: ao()
		};
	}
};
//#endregion
//#region src/features/math.ts
function so(e, t) {
	let n = 0;
	for (let r = t - 1; r >= 0 && e.charCodeAt(r) === 92; r--) n++;
	return n;
}
function co(e, t) {
	return so(e, t) % 2 == 1;
}
function lo(e, t) {
	return e[t - 1] === "$" || e[t + 1] === "$";
}
function uo(e, t) {
	let n = [];
	for (let r = 0; r < e.length; r++) {
		if (t[r] || e[r] !== "$" || co(e, r) || e[r + 1] === "$" || lo(e, r)) continue;
		let i = r, a = i + 1, o = -1;
		for (let n = a; n < e.length && e[n] !== "\n"; n++) if (!t[n] && !(e[n] !== "$" || co(e, n) || lo(e, n))) {
			o = n;
			break;
		}
		if (o < 0) continue;
		let s = o + 1, c = !1;
		for (let e = i; e < s; e++) if (t[e]) {
			c = !0;
			break;
		}
		if (c) continue;
		let l = e.slice(a, o);
		if (l.trim().length === 0) continue;
		let u = l.trim();
		qi(t, i, s), n.push({
			type: "math",
			from: a,
			to: o,
			openFrom: i,
			openTo: a,
			closeFrom: o,
			closeTo: s,
			attrs: {
				tex: u,
				delimiter: "$",
				display: !1
			},
			delimRanges: [{
				from: i,
				to: s,
				softInside: !0
			}],
			widgetDecorations: [{
				pos: i,
				when: "outside",
				kind: "math-render",
				attrs: {
					tex: u,
					display: "0"
				},
				side: -1
			}]
		}), r = s - 1;
	}
	return n;
}
function fo(e) {
	let t = e.indexOf("\n");
	if (t < 0) return null;
	let n = e.lastIndexOf("\n") + 1;
	if (n <= t) return null;
	let r = e.slice(0, t), i = e.slice(n);
	if (!/^[ \t]*\$\$[ \t]*$/.test(r) || !/^[ \t]*\$\$[ \t]*$/.test(i)) return null;
	let a = t + 1, o = n === a ? a : n - 1;
	return {
		content: e.slice(a, o),
		bodyFrom: a,
		bodyTo: o,
		closeTo: e.length
	};
}
var po = (e, t, n, r) => {
	if (e.tShift[t] > 3) return !1;
	let i = e.bMarks[t] + e.tShift[t], a = e.eMarks[t];
	if (!/^\$\$\s*$/.test(e.src.slice(i, a))) return !1;
	let o = -1;
	for (let r = t + 1; r < n; r++) {
		if (e.tShift[r] > 3) continue;
		let t = e.bMarks[r] + e.tShift[r], n = e.eMarks[r];
		if (/^\$\$\s*$/.test(e.src.slice(t, n))) {
			o = r;
			break;
		}
	}
	if (o < 0) return !1;
	if (r) return !0;
	let s = e.src.slice(e.bMarks[t + 1], e.bMarks[o]).replace(/\n$/, ""), c = e.push("math_block", "math-block", 0);
	return c.block = !0, c.content = s, c.map = [t, o + 1], e.line = o + 1, !0;
};
function mo(e, t) {
	return t ? [e.text(t)] : null;
}
var ho = class {
	dom;
	contentDOM;
	node;
	view;
	getPos;
	previewDOM;
	renderKey = "";
	constructor(e, t, n, r) {
		this.node = e, this.view = t, this.getPos = n, this.dom = document.createElement("math-block"), this.dom.setAttribute("data-aaronnote-math-block", "");
		let i = this.fence("open"), a = this.fence("close");
		this.contentDOM = document.createElement("div"), this.contentDOM.className = "math-block-source", this.contentDOM.spellcheck = !1, this.previewDOM = document.createElement("div"), this.previewDOM.className = "aaronnote-math-block math-block-render", this.previewDOM.setAttribute("contenteditable", "false"), this.previewDOM.addEventListener("mousedown", (e) => {
			e.preventDefault(), e.stopPropagation(), this.selectInside("open");
		}), this.previewDOM.addEventListener("click", (e) => {
			e.preventDefault(), e.stopPropagation();
		}), this.dom.append(i, this.contentDOM, a, this.previewDOM), this.applyDecorations(r);
	}
	update(e, t) {
		return e.type.name === "math_block" ? (this.node = e, this.applyDecorations(t), !0) : !1;
	}
	stopEvent(e) {
		return e.target instanceof Node && this.previewDOM.contains(e.target);
	}
	ignoreMutation(e) {
		return e.type === "selection" ? !1 : e.target instanceof Node && this.previewDOM.contains(e.target);
	}
	fence(e) {
		let t = document.createElement("div");
		return t.className = "math-block-fence", t.textContent = "$$", t.setAttribute("contenteditable", "false"), t.addEventListener("mousedown", (t) => {
			t.preventDefault(), t.stopPropagation(), this.selectInside(e);
		}), t;
	}
	selectInside(e) {
		let t = this.getPos();
		if (typeof t != "number") return;
		let n = e === "open" ? t + 1 : t + this.node.nodeSize - 1;
		this.view.dispatch(this.view.state.tr.setSelection(i.create(this.view.state.doc, n)).scrollIntoView()), this.view.focus();
	}
	applyDecorations(e) {
		let t = e.some((e) => e.spec.mathBlockActive === !0) || this.node.textContent.trim().length === 0;
		this.dom.classList.toggle("math-block-active", t), this.dom.classList.toggle("math-block-rendered", !t), !t && this.renderPreview();
	}
	renderPreview() {
		let e = this.node.textContent.trim(), t = `display\n${e}`;
		this.renderKey !== t && (this.renderKey = t, this.previewDOM.classList.remove("aaronnote-math-error"), this.previewDOM.textContent = e, Ii(e, this.previewDOM, {
			displayMode: !0,
			throwOnError: !1,
			strict: !1,
			trust: !1,
			output: "html"
		}, () => {
			this.previewDOM.classList.add("aaronnote-math-error"), this.previewDOM.textContent = `$$ ${e} $$`;
		}));
	}
};
function go(e) {
	let t = _o(e.selection.$from) ?? _o(e.selection.$to);
	return t ? o.create(e.doc, [a.node(t.pos, t.pos + t.node.nodeSize, {}, { mathBlockActive: !0 })]) : o.empty;
}
function _o(e) {
	for (let t = e.depth; t > 0; t--) {
		let n = e.node(t);
		if (n.type.name === "math_block") return {
			pos: e.before(t),
			node: n
		};
	}
	return null;
}
function vo() {
	return new t({ props: {
		decorations: go,
		nodeViews: { math_block: (e, t, n, r) => new ho(e, t, n, r) }
	} });
}
function yo(e) {
	return new t({ appendTransaction(t, n, r) {
		if (!t.some((e) => e.docChanged)) return null;
		let a = e.nodes.math_block, o = [];
		r.doc.descendants((e, t) => {
			if (o.length > 0) return !1;
			if (e.type.name !== "paragraph") return !0;
			let n = fo(e.textContent);
			return n ? (o.push({
				from: t,
				to: t + e.nodeSize,
				parsed: n
			}), !1) : !0;
		});
		let s = o[0];
		if (!s) return null;
		let c = a.createChecked(null, mo(e, s.parsed.content)), l = r.tr.replaceWith(s.from, s.to, c), u = r.selection;
		if (u.empty && u.from >= s.from + 1 && u.from <= s.to - 1) {
			let e = u.from - (s.from + 1), t = s.from + 1;
			e >= s.parsed.bodyFrom && e <= s.parsed.bodyTo ? t = s.from + 1 + Math.min(e - s.parsed.bodyFrom, c.content.size) : e >= s.parsed.closeTo && (t = s.from + c.nodeSize), t = Math.max(0, Math.min(t, l.doc.content.size)), l.setSelection(i.near(l.doc.resolve(t), e >= s.parsed.closeTo ? 1 : -1));
		}
		return l.docChanged ? l : null;
	} });
}
function bo(e) {
	let t = e.selection;
	if (!t.empty) return !1;
	let n = t.$from;
	return n.parent.type.name === "paragraph" && n.parent.textContent === "$$";
}
function xo(e) {
	return (t, n) => {
		let r = t.selection;
		if (!r.empty) return !1;
		let i = r.$from;
		if (i.parent.type !== e.nodes.math_block || i.parent.content.size > 0) return !1;
		if (n) {
			let r = i.before(), a = t.tr.delete(r, r + i.parent.nodeSize);
			if (a.doc.content.size === 0) {
				let t = e.nodes.paragraph.createAndFill();
				t && a.insert(0, t);
			}
			n(a.scrollIntoView());
		}
		return !0;
	};
}
function So(e) {
	return (t, n) => {
		let r = t.selection;
		if (!r.empty) return !1;
		let a = r.$from;
		if (a.parent.type !== e.nodes.math_block) return !1;
		if (n) {
			let r = a.after(), o = t.tr.insert(r, e.nodes.paragraph.create());
			o.setSelection(i.create(o.doc, r + 1)), n(o.scrollIntoView());
		}
		return !0;
	};
}
var Co = {
	name: "math",
	nodes: { math_block: {
		group: "block",
		content: "text*",
		marks: "",
		code: !0,
		defining: !0,
		parseDOM: [{
			tag: "math-block[data-aaronnote-math-block]",
			preserveWhitespace: "full",
			contentElement: ".math-block-source"
		}],
		toDOM: () => [
			"math-block",
			{ "data-aaronnote-math-block": "" },
			[
				"div",
				{
					class: "math-block-fence",
					contenteditable: "false"
				},
				"$$"
			],
			[
				"div",
				{ class: "math-block-source" },
				0
			],
			[
				"div",
				{
					class: "math-block-fence",
					contenteditable: "false"
				},
				"$$"
			]
		]
	} },
	marks: { math: {
		attrs: {
			tex: { default: "" },
			delimiter: { default: "$" },
			display: { default: !1 }
		},
		inclusive: !1,
		parseDOM: [{
			tag: "span[data-aaronnote-math-mark]",
			getAttrs: (e) => ({
				tex: e.getAttribute("data-tex") ?? "",
				delimiter: e.getAttribute("data-delimiter") ?? "$",
				display: e.getAttribute("data-display") === "1"
			})
		}],
		toDOM: (e) => [
			"span",
			{
				"data-aaronnote-math-mark": "",
				"data-tex": e.attrs.tex,
				"data-delimiter": e.attrs.delimiter,
				"data-display": e.attrs.display ? "1" : "0"
			},
			0
		]
	} },
	mdItPlugins: [(e) => {
		e.block.ruler.before("paragraph", "math_block", po, { alt: [
			"paragraph",
			"reference",
			"blockquote",
			"list"
		] });
	}],
	parserTokens: { math_block: (e, t, n) => {
		e.push(n.nodes.math_block.createChecked(null, mo(n, t.content)));
	} },
	markDelims: { math: {
		open: "",
		close: ""
	} },
	blockHandlers: { math_block: (e, t) => {
		e.write("$$\n"), e.tick("inner"), t.textContent.length > 0 && e.delim && e.atBlankLine() && (e.out += e.delim);
		for (let n of t.textContent) e.tick("inner"), n === "\n" ? (e.out += "\n", e.delim && (e.out += e.delim)) : e.out += n, e.advance(1);
		e.tick("inner"), e.out += "\n", e.delim && (e.out += e.delim), e.out += "$$", e.closeBlock(t);
	} },
	inline: {
		priority: .75,
		scan: uo,
		markNames: ["math"],
		extRanges: ((e) => Yi(e, "math", 1))
	},
	plugins: (e) => [vo(), yo(e)],
	keymap: (e) => ({
		Enter: (t, n) => {
			if (!bo(t)) return !1;
			if (n) {
				let r = t.selection.$from.before(), a = e.nodes.math_block.createAndFill();
				if (!a) return !1;
				let o = t.tr.replaceWith(r, r + t.selection.$from.parent.nodeSize, a);
				o.setSelection(i.create(o.doc, r + 1)), n(o.scrollIntoView());
			}
			return !0;
		},
		Backspace: xo(e),
		"Mod-Enter": So(e)
	})
}, wo = {
	proof: "Proof",
	theorem: "Theorem",
	thm: "Theorem",
	lemma: "Lemma",
	proposition: "Proposition",
	prop: "Proposition",
	corollary: "Corollary",
	cor: "Corollary",
	definition: "Definition",
	defn: "Definition",
	summary: "Summary",
	remark: "Remark",
	example: "Example",
	note: "Note",
	info: "Info",
	attention: "Attention",
	property: "Property",
	warning: "Warning",
	meta: "Meta"
};
function To(e) {
	return wo[e] ?? e;
}
function Eo(e) {
	let t = e.match(/^\s*#\+begin(?:_|\s+)([A-Za-z][\w-]*)(?:\s+([^\n]+?))?\s*\n/i);
	if (!t) return null;
	let n = t[1].toLowerCase(), r = RegExp(`\\n\\s*\\\\?#\\+end(?:_|\\s+)${n}\\s*$`, "i"), i = e.match(r);
	return !i || i.index == null ? null : {
		kind: n,
		title: t[2]?.trim() ?? "",
		content: e.slice(t[0].length, i.index).replace(/\n$/, "")
	};
}
function Do(e, t) {
	return t ? e.nodes.paragraph.createChecked(null, e.text(t)) : null;
}
function Oo() {
	return new t({ appendTransaction(e, t, n) {
		let r = n.schema.nodes.org_env_block;
		if (!r) return null;
		let i = [];
		n.doc.descendants((e, t) => {
			if (i.length > 0 || e.type.name !== "paragraph") return i.length === 0;
			let n = Eo(e.textContent);
			return n ? (i.push({
				from: t,
				to: t + e.nodeSize,
				...n
			}), !1) : !0;
		});
		let a = i[0];
		if (!a) return null;
		let o = Do(n.schema, a.content), s = r.createChecked({
			kind: a.kind,
			title: a.title
		}, o ? [o] : []);
		return n.tr.replaceWith(a.from, a.to, s);
	} });
}
function ko(e, t) {
	for (let n = e.depth; n > 0; n--) if (e.node(n).type === t) return n;
	return -1;
}
function Ao(e) {
	let t = [];
	return e.forEach((e) => t.push(e)), t;
}
var jo = class {
	dom;
	contentDOM;
	label;
	title;
	metaDOM;
	node;
	view;
	getPos;
	constructor(e, t, n) {
		this.node = e, this.view = t, this.getPos = n, this.dom = document.createElement("org-env-block"), this.label = document.createElement("span"), this.title = document.createElement("input"), this.contentDOM = document.createElement("div"), this.metaDOM = document.createElement("div"), this.label.className = "org-env-heading-label", this.label.contentEditable = "false", this.title.className = "org-env-heading-title", this.title.type = "text", this.title.spellcheck = !1, this.contentDOM.className = "org-env-content", this.metaDOM.className = "org-env-meta", this.metaDOM.contentEditable = "false", this.title.addEventListener("mousedown", (e) => {
			e.stopPropagation();
		}), this.title.addEventListener("click", () => {
			this.title.focus();
		}), this.title.addEventListener("input", () => this.writeTitle()), this.title.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault(), this.view.focus();
				let t = this.getPos();
				if (typeof t == "number") {
					let e = Math.min(t + 1, this.view.state.doc.content.size);
					this.view.dispatch(this.view.state.tr.setSelection(i.near(this.view.state.doc.resolve(e))).scrollIntoView());
				}
			}
		}), this.contentDOM.addEventListener("mousedown", (e) => this.selectContentFromMouse(e));
		let r = document.createElement("span");
		r.className = "org-env-heading", r.append(this.label, this.title), this.dom.append(r, this.contentDOM, this.metaDOM), this.renderAttrs(e);
	}
	update(e) {
		return e.type === this.node.type ? (this.node = e, this.renderAttrs(e), !0) : !1;
	}
	stopEvent(e) {
		return e.target instanceof Node && (this.title.contains(e.target) || this.metaDOM.contains(e.target));
	}
	ignoreMutation(e) {
		return e.target instanceof Node && (this.title.contains(e.target) || this.metaDOM.contains(e.target));
	}
	renderAttrs(e) {
		let t = String(e.attrs.kind || "note"), n = String(e.attrs.title || ""), r = To(t);
		this.dom.dataset.kind = t, this.dom.dataset.title = n, this.dom.dataset.label = r, this.label.textContent = r, this.title.value !== n && (this.title.value = n), this.title.dataset.empty = n ? "false" : "true", this.title.hidden = t === "meta", this.label.hidden = t === "meta", this.contentDOM.hidden = t === "meta", this.metaDOM.hidden = t !== "meta", this.title.setAttribute("aria-label", `${r} title`), t === "meta" && this.renderMeta();
	}
	writeTitle() {
		let e = this.getPos();
		if (typeof e != "number") return;
		let t = this.title.value.trim();
		t !== String(this.node.attrs.title || "") && this.view.dispatch(this.view.state.tr.setNodeMarkup(e, void 0, {
			...this.node.attrs,
			title: t
		}));
	}
	selectContentFromMouse(e) {
		if (e.button !== 0) return;
		let t = e.target;
		if (t instanceof Element && t.closest("a, button, input, textarea, select")) return;
		let n = this.getPos();
		if (typeof n != "number") return;
		let { state: r } = this.view, a = n + 1;
		if (this.node.childCount === 0) {
			e.preventDefault();
			let t = r.tr.insert(a, r.schema.nodes.paragraph.create());
			t.setSelection(i.create(t.doc, a + 1)), this.view.dispatch(t.scrollIntoView()), this.view.focus();
			return;
		}
		let o = n + this.node.nodeSize - 1, s = this.view.posAtCoords({
			left: e.clientX,
			top: e.clientY
		}), c = typeof s?.pos == "number" ? s.pos : o, l = Math.max(a, Math.min(c, o));
		e.preventDefault(), this.view.dispatch(r.tr.setSelection(i.near(r.doc.resolve(l), c >= o ? -1 : 1)).scrollIntoView()), this.view.focus();
	}
	metaEntries() {
		return this.node.textContent.split(/\r?\n/).map((e) => e.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/)).filter((e) => !!e).map((e) => ({
			key: e[1],
			value: e[2] ?? ""
		}));
	}
	renderMeta() {
		let e = document.activeElement;
		if (e && this.metaDOM.contains(e)) return;
		this.metaDOM.innerHTML = "";
		let t = this.metaEntries();
		if (t.length === 0) {
			let e = document.createElement("span");
			e.className = "org-env-meta-empty", e.textContent = "No metadata", this.metaDOM.append(e);
			return;
		}
		t.forEach((e) => {
			let t = document.createElement("span");
			t.className = "org-env-meta-pill";
			let n = document.createElement("span");
			n.className = "org-env-meta-key", n.textContent = e.key;
			let r = document.createElement("span");
			r.className = "org-env-meta-value", r.textContent = e.value, r.contentEditable = "true", r.spellcheck = !1, r.dataset.key = e.key, r.addEventListener("input", () => this.writeMeta()), r.addEventListener("keydown", (e) => {
				e.key === "Enter" && (e.preventDefault(), this.writeMeta(), this.view.focus());
			}), t.append(n, r), this.metaDOM.append(t);
		});
	}
	writeMeta() {
		let e = this.getPos();
		if (typeof e != "number") return;
		let t = Array.from(this.metaDOM.querySelectorAll(".org-env-meta-value")).map((e) => `${e.dataset.key}: ${e.textContent?.trim() ?? ""}`).join("\n");
		if (t === this.node.textContent) return;
		let n = e + 1, r = n + this.node.content.size, i = t ? this.view.state.schema.nodes.paragraph.createChecked(null, this.view.state.schema.text(t)) : null;
		this.view.dispatch(this.view.state.tr.replaceWith(n, r, i ? [i] : []));
	}
};
function Mo() {
	return new t({ props: { nodeViews: { org_env_block: (e, t, n) => new jo(e, t, n) } } });
}
var No = (e, t, n, r) => {
	if (e.tShift[t] > 3) return !1;
	let i = e.bMarks[t] + e.tShift[t], a = e.eMarks[t], o = e.src.slice(i, a).match(/^#\+begin(?:_|\s+)([A-Za-z][\w-]*)(?:\s+(.+?))?\s*$/i);
	if (!o) return !1;
	let s = o[1].toLowerCase(), c = -1, l = RegExp(`^#\\+end(?:_|\\s+)${s}\\s*$`, "i");
	for (let r = t + 1; r < n; r++) {
		let t = e.bMarks[r] + e.tShift[r], n = e.eMarks[r];
		if (e.tShift[r] <= 3 && l.test(e.src.slice(t, n).replace(/^\\(?=#\+end)/i, ""))) {
			c = r;
			break;
		}
	}
	if (c < 0) return !1;
	if (r) return !0;
	let u = e.src.slice(e.bMarks[t + 1], e.bMarks[c]).replace(/\n$/, ""), d = e.push("org_env_block", "div", 0);
	return d.block = !0, d.content = u, d.children = e.md.parse(u, e.env), d.meta = {
		kind: s,
		title: o[2]?.trim() ?? ""
	}, d.map = [t, c + 1], e.line = c + 1, !0;
}, Po = {
	name: "org-env",
	plugins: () => [Oo(), Mo()],
	nodes: { org_env_block: {
		group: "block",
		content: "block*",
		defining: !0,
		attrs: {
			kind: { default: "note" },
			title: { default: "" }
		},
		parseDOM: [{
			tag: "org-env-block",
			preserveWhitespace: "full",
			contentElement: ".org-env-content",
			getAttrs: (e) => ({
				kind: e.dataset.kind || "note",
				title: e.dataset.title || ""
			})
		}],
		toDOM: (e) => [
			"org-env-block",
			{
				"data-kind": e.attrs.kind,
				"data-title": e.attrs.title,
				"data-label": To(String(e.attrs.kind))
			},
			[
				"div",
				{ class: "org-env-content" },
				0
			]
		]
	} },
	mdItPlugins: [(e) => {
		e.block.ruler.before("heading", "org_env_block", No, { alt: [
			"paragraph",
			"reference",
			"blockquote",
			"list"
		] });
	}],
	parserTokens: { org_env_block: (e, t, n) => {
		e.openNode(n.nodes.org_env_block, {
			kind: t.meta?.kind ?? "note",
			title: t.meta?.title ?? ""
		}), e.addBlockTokens(t.children ?? []), e.closeNode();
	} },
	blockHandlers: { org_env_block: (e, t) => {
		let n = String(t.attrs.kind || "note"), r = String(t.attrs.title || "");
		e.write(`#+begin ${n}${r ? ` ${r}` : ""}\n`), t.childCount > 0 && (e.renderBlockChildren(t), e.flushClose(!0)), e.write(`#+end ${n}`), e.closeBlock(t);
	} },
	keymap: (e) => ({
		Enter: (t, n) => {
			let r = t.selection, i = r.$from, a = r.$to, o = e.nodes.org_env_block;
			return ko(i, o) < 0 || a.parent !== i.parent || i.parent.type !== o ? !1 : (n && n(t.tr.insertText("\n", r.from, r.to).scrollIntoView()), !0);
		},
		"Mod-Enter": (t, n) => {
			let r = t.selection;
			if (!r.empty) return !1;
			let a = r.$from, o = e.nodes.org_env_block, s = ko(a, o);
			if (s < 0) return !1;
			if (n) {
				let c = a.node(s), l = a.before(s), u = a.after(s), d = r.from - (l + 1), f = t.tr, p = c.textBetween(0, d, "\n", "\n"), m = c.textBetween(d, c.content.size, "\n", "\n");
				if (!p) return f.insert(l, e.nodes.paragraph.create()), f.setSelection(i.create(f.doc, l + 1)), n(f.scrollIntoView()), !0;
				if (!m) return f.insert(u, e.nodes.paragraph.create()), f.setSelection(i.create(f.doc, u + 1)), n(f.scrollIntoView()), !0;
				let h = c.content.cut(0, d), g = c.content.cut(d), _ = o.createChecked(c.attrs, h), v = Ao(g);
				f.replaceWith(l, u, [_, ...v.length > 0 ? v : [e.nodes.paragraph.create()]]);
				let y = l + _.nodeSize;
				f.setSelection(i.create(f.doc, y + 1)), n(f.scrollIntoView());
			}
			return !0;
		},
		ArrowDown: (t, n) => {
			let r = t.selection;
			if (!r.empty) return !1;
			let a = r.$from, o = e.nodes.org_env_block, s = ko(a, o);
			if (s < 0) return !1;
			let c = a.node(s), l = r.from - (a.before(s) + 1);
			if (c.textBetween(l, c.content.size, "\n", "\n")) return !1;
			if (n) {
				let r = t.tr, o = a.after(s);
				o >= r.doc.content.size && r.insert(o, e.nodes.paragraph.create()), r.setSelection(i.create(r.doc, o + 1)), n(r);
			}
			return !0;
		}
	})
}, Fo = {
	name: "strike",
	marks: { strike: {
		parseDOM: [{ tag: "s" }, { tag: "del" }],
		toDOM: () => ["s", 0]
	} },
	mdItPlugins: [(e) => e.enable("strikethrough")],
	parserTokens: {
		s_open: (e, t, n) => {
			e.addText("~~"), e.openMark(n.marks.strike.create());
		},
		s_close: (e, t, n) => {
			e.closeMarkType(n.marks.strike), e.addText("~~");
		}
	},
	markDelims: { strike: {
		open: "",
		close: ""
	} },
	inline: {
		priority: 1,
		scan: (e, t) => Ji(e, "~", 2, "strike", t),
		markNames: ["strike"],
		extRanges: (e) => Yi(e, "strike", 2)
	}
}, Io = {
	name: "sub-sup",
	marks: {
		sub: {
			parseDOM: [{ tag: "sub" }],
			toDOM: () => ["sub", 0]
		},
		sup: {
			parseDOM: [{ tag: "sup" }],
			toDOM: () => ["sup", 0]
		}
	},
	markDelims: {
		sub: {
			open: "",
			close: ""
		},
		sup: {
			open: "",
			close: ""
		}
	},
	inline: {
		priority: 1.2,
		scan: (e, t) => {
			let n = Ji(e, "~", 1, "sub", t), r = Ji(e, "^", 1, "sup", t);
			return [...n, ...r];
		},
		markNames: ["sub", "sup"],
		extRanges: (e) => [...Yi(e, "sub", 1), ...Yi(e, "sup", 1)]
	}
};
//#endregion
//#region src/features/table.ts
function Lo(e) {
	if (!e) return null;
	let t = /text-align:\s*(left|center|right)/.exec(e);
	return t ? t[1] : null;
}
function Ro(e, t) {
	let n = Math.max(3, t);
	return e === "left" ? ":" + "-".repeat(n - 1) : e === "right" ? "-".repeat(n - 1) + ":" : e === "center" ? ":" + "-".repeat(n - 2) + ":" : "-".repeat(n);
}
function zo(e) {
	let t = e.selection.$from, n = -1;
	for (let e = t.depth; e >= 0; e--) if (t.node(e).type.name === "table_cell") {
		n = e;
		break;
	}
	if (n === -1) return null;
	let r = n - 2;
	return {
		pos: t.before(r),
		node: t.node(r),
		rowIdx: t.index(r),
		cellIdx: t.index(n - 1)
	};
}
function Bo(e, t, n) {
	let r = e.state.tr, i = t.pos + 1;
	t.node.forEach((e) => {
		let a = i + 1;
		e.forEach((e, i, o) => {
			o === t.cellIdx && r.setNodeMarkup(a, null, {
				...e.attrs,
				align: n
			}), a += e.nodeSize;
		}), i += e.nodeSize;
	}), e.dispatch(r), e.focus();
}
function Vo(e, t) {
	let n = e.state.schema, r = e.state.tr, a = t.pos, o = a + t.node.nodeSize, s = n.nodes.paragraph.create();
	r.replaceWith(a, o, s), r.setSelection(i.create(r.doc, a + 1)), e.dispatch(r), e.focus();
}
function Ho(e, t, n, r) {
	if (n < 1 || r < 1) return;
	let a = e.state.schema, o = t.node, s = [];
	o.forEach((e) => s.push(e));
	let c = [];
	for (let e = 0; e < n; e++) {
		let t = s[e], n = [];
		t && t.forEach((e) => n.push(e));
		let i = [];
		for (let t = 0; t < r; t++) {
			let r = n[t], o = e === 0, c = s[0], l = c && t < c.childCount ? c.child(t).attrs.align : null, u = r ? r.content : null;
			i.push(a.nodes.table_cell.create({
				header: o,
				align: l
			}, u));
		}
		c.push(a.nodes.table_row.create(null, i));
	}
	let l = a.nodes.table.create(null, c), u = e.state.tr, d = t.pos, f = d + o.nodeSize;
	u.replaceWith(d, f, l);
	let p = d + 1 + c[0].nodeSize + (n > 1 ? 2 : -c[0].nodeSize + 2), m = Math.min(p, u.doc.content.size);
	u.setSelection(i.create(u.doc, m)), e.dispatch(u), e.focus();
}
function Uo(e, t = "0 0 24 24") {
	let n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	return n.setAttribute("viewBox", t), n.setAttribute("width", "16"), n.setAttribute("height", "16"), n.innerHTML = e, n;
}
function Wo(e, t) {
	let n = document.createElement("div");
	n.className = "table-toolbar";
	let r = document.createElement("button");
	r.type = "button", r.className = "table-tb-btn", r.title = "Resize", r.appendChild(Uo("<rect x='4' y='4' width='6' height='6' fill='currentColor'/>\n       <rect x='14' y='4' width='6' height='6' fill='currentColor'/>\n       <rect x='4' y='14' width='6' height='6' fill='currentColor'/>\n       <rect x='14' y='14' width='6' height='6' fill='currentColor'/>"));
	let i = document.createElement("span");
	i.className = "table-tb-sep";
	let a = (n, r) => {
		let i = document.createElement("button");
		return i.type = "button", i.className = "table-tb-btn", i.title = `Align ${n}`, i.dataset.align = n, i.appendChild(Uo(r)), i.addEventListener("mousedown", (e) => e.preventDefault()), i.addEventListener("click", () => {
			let r = t();
			r && Bo(e, r, n);
		}), i;
	}, o = a("left", "<line x1='4' y1='6' x2='20' y2='6' stroke='currentColor' stroke-width='2'/>\n     <line x1='4' y1='12' x2='14' y2='12' stroke='currentColor' stroke-width='2'/>\n     <line x1='4' y1='18' x2='18' y2='18' stroke='currentColor' stroke-width='2'/>"), s = a("center", "<line x1='4' y1='6' x2='20' y2='6' stroke='currentColor' stroke-width='2'/>\n     <line x1='7' y1='12' x2='17' y2='12' stroke='currentColor' stroke-width='2'/>\n     <line x1='5' y1='18' x2='19' y2='18' stroke='currentColor' stroke-width='2'/>"), c = a("right", "<line x1='4' y1='6' x2='20' y2='6' stroke='currentColor' stroke-width='2'/>\n     <line x1='10' y1='12' x2='20' y2='12' stroke='currentColor' stroke-width='2'/>\n     <line x1='6' y1='18' x2='20' y2='18' stroke='currentColor' stroke-width='2'/>"), l = document.createElement("span");
	l.className = "table-tb-spacer";
	let u = document.createElement("button");
	u.type = "button", u.className = "table-tb-btn table-tb-trash", u.title = "Delete table", u.appendChild(Uo("<path d='M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12'\n        stroke='currentColor' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/>")), u.addEventListener("mousedown", (e) => e.preventDefault()), u.addEventListener("click", () => {
		let n = t();
		n && Vo(e, n);
	}), n.append(r, i, o, s, c, l, u);
	let d = null, f = document.createElement("div");
	f.className = "table-resize-popup", f.style.display = "none", f.addEventListener("mousedown", (e) => {
		e.target.tagName !== "INPUT" && e.preventDefault();
	});
	let p = document.createElement("div");
	p.className = "table-resize-grid";
	let m = [];
	for (let e = 0; e < 10; e++) {
		let t = [];
		for (let n = 0; n < 10; n++) {
			let r = document.createElement("div");
			r.className = "table-resize-cell", r.dataset.r = String(e + 1), r.dataset.c = String(n + 1), p.appendChild(r), t.push(r);
		}
		m.push(t);
	}
	let h = document.createElement("div");
	h.className = "table-resize-inputs";
	let g = document.createElement("input");
	g.type = "number", g.min = "1", g.max = "20";
	let _ = document.createElement("span");
	_.textContent = "×";
	let v = document.createElement("input");
	v.type = "number", v.min = "1", v.max = "20", h.append(g, _, v);
	let y = (e, t) => {
		for (let n = 0; n < 10; n++) for (let r = 0; r < 10; r++) m[n][r].classList.toggle("hover", n < e && r < t);
		g.value = String(e), v.value = String(t);
	};
	p.addEventListener("mousemove", (e) => {
		let t = e.target.closest(".table-resize-cell");
		t && y(Number(t.dataset.r), Number(t.dataset.c));
	}), p.addEventListener("click", (n) => {
		let r = n.target.closest(".table-resize-cell");
		if (!r) return;
		let i = d ?? t();
		i && (Ho(e, i, Number(r.dataset.r), Number(r.dataset.c)), f.style.display = "none", d = null);
	});
	let ee = () => {
		let n = d ?? t();
		n && (Ho(e, n, Math.max(1, Math.min(20, Number(g.value) || 1)), Math.max(1, Math.min(20, Number(v.value) || 1))), f.style.display = "none", d = null);
	};
	return g.addEventListener("keydown", (e) => {
		e.key === "Enter" && (e.preventDefault(), ee());
	}), v.addEventListener("keydown", (e) => {
		e.key === "Enter" && (e.preventDefault(), ee());
	}), f.append(p, h), r.addEventListener("mousedown", (e) => e.preventDefault()), r.addEventListener("click", () => {
		let e = t();
		if (!e) return;
		if (f.style.display === "block") {
			f.style.display = "none", d = null;
			return;
		}
		d = e;
		let n = 0, i = 0;
		e.node.forEach((e) => {
			n++, i = Math.max(i, e.childCount);
		}), y(Math.min(n, 10), Math.min(i, 10));
		let a = r.getBoundingClientRect();
		f.style.top = `${a.bottom + 4}px`, f.style.left = `${a.left}px`, f.style.display = "block";
	}), {
		root: n,
		popup: f
	};
}
function Go() {
	return new t({ view(e) {
		let t = null, n = null, r = () => (n ||= Wo(e, () => t), n.root.isConnected || (document.body.appendChild(n.root), document.body.appendChild(n.popup)), n), i = () => {
			n?.root.isConnected && (n.root.remove(), n.popup.remove());
		}, a = () => {
			if (t = zo(e.state), !t || !e.hasFocus()) {
				i();
				return;
			}
			let n = e.nodeDOM(t.pos);
			if (!n) {
				i();
				return;
			}
			let a = r(), o = n.getBoundingClientRect();
			a.root.style.display = "flex", a.root.style.top = `${o.top - 32}px`, a.root.style.left = `${o.left}px`;
			let s = t.node.child(t.rowIdx).child(t.cellIdx).attrs.align;
			a.root.querySelectorAll("[data-align]").forEach((e) => {
				e.classList.toggle("active", e.dataset.align === s);
			});
		}, o = () => a();
		return window.addEventListener("scroll", o, !0), window.addEventListener("resize", o), e.dom.addEventListener("focusin", a), e.dom.addEventListener("focusout", a), {
			update() {
				a();
			},
			destroy() {
				window.removeEventListener("scroll", o, !0), window.removeEventListener("resize", o), e.dom.removeEventListener("focusin", a), e.dom.removeEventListener("focusout", a), i();
			}
		};
	} });
}
function Ko(e) {
	return (t, n) => {
		let r = t.selection.$from, a = -1;
		for (let e = r.depth; e >= 0; e--) if (r.node(e).type.name === "table_cell") {
			a = e;
			break;
		}
		if (a === -1) return !1;
		let o = a - 1, s = a - 2, c = r.index(o), l = r.index(s), u = r.node(s), d = r.node(o), f = l, p = c + e;
		if (p < 0) {
			if (f = l - 1, f < 0) return !0;
			p = u.child(f).childCount - 1;
		} else if (p >= d.childCount) {
			if (f = l + 1, f >= u.childCount) return !0;
			p = 0;
		}
		if (n) {
			let e = r.before(s) + 1;
			for (let t = 0; t < f; t++) e += u.child(t).nodeSize;
			e += 1;
			let a = u.child(f);
			for (let t = 0; t < p; t++) e += a.child(t).nodeSize;
			e += 1, n(t.tr.setSelection(i.create(t.doc, e)));
		}
		return !0;
	};
}
function qo(e) {
	let t = "";
	return e.content.forEach((e) => {
		e.isText && (t += e.text ?? "");
	}), t.replace(/\|/g, "\\|");
}
var Jo = {
	name: "table",
	nodes: {
		table: {
			group: "block",
			content: "table_row+",
			defining: !0,
			isolating: !0,
			parseDOM: [{ tag: "table" }],
			toDOM: () => ["table", ["tbody", 0]]
		},
		table_row: {
			content: "table_cell+",
			parseDOM: [{ tag: "tr" }],
			toDOM: () => ["tr", 0]
		},
		table_cell: {
			content: "inline*",
			attrs: {
				header: { default: !1 },
				align: { default: null }
			},
			isolating: !0,
			parseDOM: [{
				tag: "th",
				getAttrs: (e) => ({
					header: !0,
					align: Lo(e.getAttribute("style"))
				})
			}, {
				tag: "td",
				getAttrs: (e) => ({
					header: !1,
					align: Lo(e.getAttribute("style"))
				})
			}],
			toDOM: (e) => {
				let t = e.attrs.header ? "th" : "td", n = e.attrs.align;
				return [
					t,
					n ? { style: `text-align:${n}` } : {},
					0
				];
			}
		}
	},
	mdItPlugins: [(e) => e.enable("table")],
	plugins: () => [Go()],
	keymap: (e) => ({
		Tab: Ko(1),
		"Shift-Tab": Ko(-1),
		"Mod-Enter": (t, n) => {
			let r = t.selection.$from, a = -1;
			for (let e = r.depth; e >= 0; e--) if (r.node(e).type.name === "table_cell") {
				a = e;
				break;
			}
			if (a === -1) return !1;
			let o = a - 2, s = r.node(o), c = r.index(o), l = r.index(a - 1), u = s.child(c).childCount;
			if (n) {
				let a = s.child(0), d = [];
				for (let t = 0; t < u; t++) {
					let n = a.child(t)?.attrs.align ?? null;
					d.push(e.nodes.table_cell.create({
						header: !1,
						align: n
					}, []));
				}
				let f = e.nodes.table_row.create(null, d), p = r.before(o) + 1;
				for (let e = 0; e <= c; e++) p += s.child(e).nodeSize;
				let m = t.tr.insert(p, f), h = p + 1;
				for (let e = 0; e < l; e++) h += f.child(e).nodeSize;
				h += 1, m.setSelection(i.create(m.doc, h)), n(m);
			}
			return !0;
		},
		"Mod-Shift-Backspace": (e, t) => {
			let n = e.selection.$from, r = -1;
			for (let e = n.depth; e >= 0; e--) if (n.node(e).type.name === "table_cell") {
				r = e;
				break;
			}
			if (r === -1) return !1;
			let a = r - 2, o = n.node(a), s = n.index(a), c = n.index(r - 1);
			if (o.childCount <= 1) return !0;
			if (t) {
				let r = n.before(a), l = r + 1;
				for (let e = 0; e < s; e++) l += o.child(e).nodeSize;
				let u = o.child(s), d = e.tr.delete(l, l + u.nodeSize), f = d.doc.nodeAt(r), p = Math.min(s, f.childCount - 1), m = r + 1;
				for (let e = 0; e < p; e++) m += f.child(e).nodeSize;
				m += 1;
				let h = f.child(p), g = Math.min(c, h.childCount - 1);
				for (let e = 0; e < g; e++) m += h.child(e).nodeSize;
				m += 1, d.setSelection(i.create(d.doc, m)), t(d);
			}
			return !0;
		},
		Enter: (t, n) => {
			let r = t.selection;
			if (!r.empty) return !1;
			let a = r.$from;
			if (a.parent.type.name !== "paragraph") return !1;
			let o = a.parent.textContent;
			if (!/^\|.+\|$/.test(o)) return !1;
			let s = o.split("|").slice(1, -1).map((e) => e.trim());
			if (s.length < 2) return !1;
			if (n) {
				let r = e.nodes.table_row.create(null, s.map((t) => e.nodes.table_cell.create({
					header: !0,
					align: null
				}, t ? [e.text(t)] : []))), o = e.nodes.table_row.create(null, s.map(() => e.nodes.table_cell.create({
					header: !1,
					align: null
				}, []))), c = e.nodes.table.create(null, [r, o]), l = a.before(), u = a.after(), d = t.tr;
				d.replaceWith(l, u, c);
				let f = l + 1 + r.nodeSize + 2;
				d.setSelection(i.create(d.doc, f)), n(d);
			}
			return !0;
		}
	}),
	parserTokens: {
		table_open: (e, t, n) => {
			e.openNode(n.nodes.table);
		},
		table_close: (e) => {
			e.closeNode();
		},
		thead_open: () => {},
		thead_close: () => {},
		tbody_open: () => {},
		tbody_close: () => {},
		tr_open: (e, t, n) => {
			e.openNode(n.nodes.table_row);
		},
		tr_close: (e) => {
			e.closeNode();
		},
		th_open: (e, t, n) => {
			let r = Lo(t.attrGet("style"));
			e.openNode(n.nodes.table_cell, {
				header: !0,
				align: r
			});
		},
		th_close: (e) => {
			e.closeNode();
		},
		td_open: (e, t, n) => {
			let r = Lo(t.attrGet("style"));
			e.openNode(n.nodes.table_cell, {
				header: !1,
				align: r
			});
		},
		td_close: (e) => {
			e.closeNode();
		}
	},
	blockHandlers: { table: (e, t) => {
		let n = [], r = [];
		t.forEach((e, t, i) => {
			let a = [];
			e.forEach((e, t, n) => {
				i === 0 && (r[n] = e.attrs.align), a.push(qo(e));
			}), n.push(a);
		});
		let i = r.length, a = Array(i).fill(3);
		for (let e of n) for (let t = 0; t < i; t++) a[t] = Math.max(a[t], (e[t] ?? "").length);
		let o = (e) => "|" + e.map((e, t) => " " + e.padEnd(a[t]) + " ").join("|") + "|";
		e.write(o(n[0] ?? [])), e.out += "\n", e.delim && (e.out += e.delim), e.out += "|" + r.map((e, t) => " " + Ro(e, a[t]) + " ").join("|") + "|";
		for (let t = 1; t < n.length; t++) e.out += "\n", e.delim && (e.out += e.delim), e.out += o(n[t]);
		e.closeBlock(t);
	} }
}, Yo = /^(\[ \]|\[x\]) /, Xo = { task_marker: {
	group: "inline",
	inline: !0,
	atom: !0,
	selectable: !1,
	attrs: { checked: { default: !1 } },
	parseDOM: [{
		tag: "span.task-marker",
		getAttrs: (e) => ({ checked: e.getAttribute("data-checked") === "1" })
	}],
	toDOM: (e) => ["span", {
		class: "task-marker",
		"data-checked": e.attrs.checked ? "1" : "0"
	}]
} };
function Zo(e) {
	let t = e.firstChild, n = null;
	if (t && t.type.name === "paragraph") {
		let r = t.firstChild;
		if (r && r.isText) {
			let i = Yo.exec(r.text);
			if (i) {
				let a = i[1] === "[x]", o = e.type.schema, s = o.nodes.task_marker.create({ checked: a }), c = r.text.slice(i[0].length), l = [s];
				c && l.push(o.text(c, r.marks)), t.forEach((e, t, n) => {
					n > 0 && l.push(e);
				}), n = t.type.createAndFill(t.attrs, l);
			}
		}
	}
	let r = [], i = n !== null;
	return e.forEach((e, t, a) => {
		let o;
		a === 0 && n ? o = n : (o = Qo(e), o !== e && (i = !0)), r.push(o);
	}), i ? e.type.createAndFill(e.attrs, r) : e;
}
function Qo(e) {
	if (e.type.name === "list_item") return Zo(e);
	if (!e.isBlock || e.childCount === 0) return e;
	let t = [], n = !1;
	return e.forEach((e) => {
		let r = Qo(e);
		r !== e && (n = !0), t.push(r);
	}), n ? e.type.createAndFill(e.attrs, t) : e;
}
var $o = (e) => Qo(e), es = { task_marker: (e, t) => {
	e.write(t.attrs.checked ? "[x] " : "[ ] ");
} };
function ts() {
	return (e, t, n) => {
		let r = document.createElement("span");
		r.className = "checkbox-frame", r.setAttribute("contenteditable", "false");
		let i = document.createElement("span");
		i.className = "checkbox", i.setAttribute("data-checked", e.attrs.checked ? "1" : "0"), r.appendChild(i);
		let a = (e) => {
			e.preventDefault();
		}, o = (e) => {
			if (!i.contains(e.target) && e.target !== i) return;
			e.preventDefault(), e.stopPropagation();
			let r = n();
			if (r == null) return;
			let a = t.state.doc.nodeAt(r);
			a && t.dispatch(t.state.tr.setNodeMarkup(r, void 0, { checked: !a.attrs.checked }));
		};
		return r.addEventListener("mousedown", a), r.addEventListener("click", o), {
			dom: r,
			update(t) {
				return t.type === e.type ? (i.setAttribute("data-checked", t.attrs.checked ? "1" : "0"), !0) : !1;
			},
			destroy() {
				r.removeEventListener("mousedown", a), r.removeEventListener("click", o);
			}
		};
	};
}
function ns() {
	return new t({ props: { nodeViews: { task_marker: ts() } } });
}
var rs = new _(/^(\[ \]|\[x\]) $/, (e, t, n, r) => {
	let i = e.doc.resolve(n);
	if (i.parent.type.name !== "paragraph" || i.depth < 2 || i.node(i.depth - 1).type.name !== "list_item" || i.parentOffset !== 0) return null;
	let a = t[1] === "[x]";
	return e.tr.replaceWith(n, r, e.schema.nodes.task_marker.create({ checked: a }));
});
function is() {
	return new t({ appendTransaction(e, t, n) {
		let r = n.selection;
		if (!r.empty) return null;
		let a = n.doc.resolve(r.from);
		if (a.parent.type.name !== "paragraph" || a.parentOffset !== 0) return null;
		let o = a.parent.firstChild;
		return !o || o.type.name !== "task_marker" ? null : n.tr.setSelection(i.create(n.doc, r.from + 1));
	} });
}
function as(e) {
	let t = e.firstChild;
	if (!t || t.type.name !== "paragraph") return !1;
	let n = t.firstChild;
	return !!n && n.type.name === "task_marker";
}
function os(e, t, n) {
	let r = re(e.schema.nodes.list_item), a = null;
	return r(e, (t) => {
		let r = e.tr;
		for (let e of t.steps) r.step(e);
		let o = t.selection.from;
		r.replaceWith(o, o, e.schema.nodes.task_marker.create({ checked: n })), r.setSelection(i.create(r.doc, o + 1)), a = r;
	}), a ? (t && t(a), !0) : !1;
}
function ss(e, t, n, r, i) {
	let a = e.tr.delete(r, r + 1);
	if (!t) return i(e.apply(a), void 0);
	if (!n) return t(a), !0;
	a.setMeta(cs, !0), t(a);
	let o = n.state;
	return i(o, (e) => {
		e.setMeta(cs, !0), n.dispatch(e);
	}), !0;
}
var cs = "task-no-propagate", ls = (e, t, n) => {
	let r = e.selection;
	if (!r.empty) return !1;
	let i = r.$from, a = -1;
	for (let e = i.depth; e > 0; e--) if (i.node(e).type.name === "list_item") {
		a = e;
		break;
	}
	if (a < 0) return !1;
	let o = i.node(a);
	if (!as(o) || i.index(a) !== 0) return !1;
	let s = o.firstChild, c = s.firstChild.attrs.checked === !0;
	if (s.content.size !== 1) return os(e, t, c);
	let l = a === 2, u = i.before(a) + 2;
	return l ? i.index(a - 1) > 0 ? ss(e, t, n, u, te(e.schema.nodes.list_item)) : os(e, t, c) : ss(e, t, n, u, no(e.schema.nodes.list_item, e.schema.nodes.paragraph));
};
function us() {
	return new t({ appendTransaction(e, t, n) {
		if (!e.some((e) => e.docChanged) || e.some((e) => e.getMeta(cs))) return null;
		let r = n.tr, i = !1;
		return n.doc.descendants((e, t) => {
			if (e.type.name !== "bullet_list" && e.type.name !== "ordered_list") return !0;
			let a = t + 1, o = !1;
			for (let t = 0; t < e.childCount; t++) {
				let s = e.child(t), c = a + s.nodeSize, l = s.firstChild, u = s.childCount === 1 && l?.type.name === "paragraph" && l.content.size === 0, d = as(s);
				if (o && u && !d) {
					let e = a + 2, t = r.mapping.map(e);
					r.replaceWith(t, t, n.schema.nodes.task_marker.create({ checked: !1 })), i = !0;
				}
				o = d, a = c;
			}
			return !0;
		}), i ? r : null;
	} });
}
var ds = {
	name: "task",
	nodes: Xo,
	parserPostProcess: $o,
	inlineNodeHandlers: es,
	inputRules: () => [rs],
	keymap: () => ({ Enter: ls }),
	plugins: () => [
		ns(),
		is(),
		us()
	]
}, fs = /* @__PURE__ */ new Set(), ps = class {
	dom;
	view;
	lastDoc = null;
	lastSig = "";
	constructor(e, t) {
		this.view = t, this.dom = document.createElement("div"), this.dom.className = "toc", this.dom.setAttribute("contenteditable", "false"), this.render(), fs.add(this);
	}
	render() {
		let e = this.view.state.doc;
		if (e === this.lastDoc) return;
		let t = [];
		e.descendants((e, n) => {
			e.type.name === "heading" && t.push({
				level: e.attrs.level,
				text: e.textContent,
				pos: n
			});
		});
		let n = t.map((e) => `${e.pos}\t${e.level}\t${e.text}`).join("\n");
		if (n === this.lastSig && this.lastDoc !== null) {
			this.lastDoc = e;
			return;
		}
		if (this.lastDoc = e, this.lastSig = n, this.dom.innerHTML = "", t.length === 0) {
			let e = document.createElement("div");
			e.className = "toc-empty", e.textContent = "(no headings yet)", this.dom.appendChild(e);
			return;
		}
		let r = document.createElement("ul");
		r.className = "toc-list";
		for (let e of t) {
			let t = document.createElement("li");
			t.className = `toc-item toc-h${e.level}`, t.textContent = e.text || "(empty heading)", t.addEventListener("mousedown", (e) => {
				e.preventDefault();
			}), t.addEventListener("click", () => this.jumpTo(e.pos)), r.appendChild(t);
		}
		this.dom.appendChild(r);
	}
	jumpTo(e) {
		let t = this.view.state.tr;
		t.setSelection(i.near(t.doc.resolve(e + 1))), this.view.dispatch(t), this.view.nodeDOM(e)?.scrollIntoView({
			block: "start",
			behavior: "smooth"
		}), this.view.focus();
	}
	update() {
		return !0;
	}
	destroy() {
		fs.delete(this);
	}
	stopEvent() {
		return !1;
	}
	ignoreMutation() {
		return !0;
	}
};
function ms() {
	return new t({ view() {
		let e = () => {
			for (let e of fs) e.render();
		};
		return e(), { update() {
			e();
		} };
	} });
}
//#endregion
//#region src/features/index.ts
var Q = [
	La,
	ha,
	va,
	ta,
	Fo,
	Io,
	Ma,
	Qi,
	Xa,
	Ka,
	Co,
	Po,
	Fa,
	$i,
	ja,
	ds,
	oo,
	Ta,
	Da,
	to,
	Jo,
	{
		name: "toc",
		nodes: { toc: {
			group: "block",
			atom: !0,
			selectable: !0,
			defining: !0,
			parseDOM: [{ tag: "div.toc" }],
			toDOM: () => ["div", { class: "toc" }]
		} },
		plugins: () => [ms(), new t({ props: { nodeViews: { toc: (e, t) => new ps(e, t) } } })],
		keymap: () => ({ Enter: (e, t) => {
			let n = e.selection;
			if (!n.empty) return !1;
			let r = n.$from;
			if (r.parent.type.name !== "paragraph") return !1;
			let a = r.parent.textContent;
			if (a !== "[toc]" && a !== "[TOC]") return !1;
			if (t) {
				let n = e.schema, a = n.nodes.toc.create(), o = r.before(), s = r.after(), c = e.tr;
				c.replaceWith(o, s, [a, n.nodes.paragraph.create()]);
				let l = o + a.nodeSize + 1;
				c.setSelection(i.create(c.doc, l)), t(c);
			}
			return !0;
		} }),
		parserPostProcess: (e) => {
			let t = [], n = !1, r = e.type.schema.nodes.toc;
			return !r || (e.forEach((e) => {
				e.type.name === "paragraph" && (e.textContent === "[toc]" || e.textContent === "[TOC]") ? (t.push(r.create()), n = !0) : t.push(e);
			}), !n) ? e : e.type.create(e.attrs, t, e.marks);
		},
		blockHandlers: { toc: (e, t) => {
			e.write("[toc]"), e.closeBlock(t);
		} }
	},
	Gi
];
function hs() {
	return Object.assign({}, ...Q.map((e) => e.marks ?? {}));
}
function gs() {
	return Object.assign({}, ...Q.map((e) => e.nodes ?? {}));
}
function _s() {
	return Q.flatMap((e) => e.mdItPlugins ?? []);
}
function vs() {
	return Object.assign({}, ...Q.map((e) => e.parserTokens ?? {}));
}
function ys() {
	return Object.assign({}, ...Q.map((e) => e.markDelims ?? {}));
}
function bs(e) {
	return Q.flatMap((t) => t.inputRules?.(e) ?? []);
}
function xs() {
	return Object.assign({}, ...Q.map((e) => e.blockHandlers ?? {}));
}
function Ss() {
	return Object.assign({}, ...Q.map((e) => e.inlineNodeHandlers ?? {}));
}
function Cs() {
	return Q.flatMap((e) => e.parserPostProcess ? [e.parserPostProcess] : []);
}
function ws(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of Q) {
		let r = n.keymap?.(e);
		if (r) for (let [e, n] of Object.entries(r)) {
			let r = t.get(e) ?? [];
			r.push(n), t.set(e, r);
		}
	}
	let n = {};
	for (let [e, r] of t) n[e] = r.length === 1 ? r[0] : g(...r);
	return n;
}
function Ts(e) {
	return Q.flatMap((t) => t.plugins?.(e) ?? []);
}
function Es() {
	return Q.map((e) => e.inline).filter((e) => e !== void 0).sort((e, t) => e.priority - t.priority);
}
//#endregion
//#region src/schema.ts
var Ds = {
	doc: { content: "block+" },
	paragraph: {
		group: "block",
		content: "inline*",
		parseDOM: [{ tag: "p" }],
		toDOM: () => ["p", 0]
	},
	heading: {
		group: "block",
		content: "inline*",
		attrs: {
			level: { default: 1 },
			style: { default: "atx" }
		},
		defining: !0,
		parseDOM: [
			1,
			2,
			3,
			4,
			5,
			6
		].map((e) => ({
			tag: `h${e}`,
			attrs: { level: e }
		})),
		toDOM: (e) => [`h${e.attrs.level}`, 0]
	},
	blockquote: {
		group: "block",
		content: "block+",
		defining: !0,
		parseDOM: [{ tag: "blockquote" }],
		toDOM: () => ["blockquote", 0]
	},
	code_block: {
		group: "block",
		content: "text*",
		marks: "",
		code: !0,
		defining: !0,
		attrs: { lang: { default: "" } },
		parseDOM: [{
			tag: "pre",
			preserveWhitespace: "full",
			getAttrs: (e) => ({ lang: e.getAttribute("data-lang") ?? "" })
		}],
		toDOM: (e) => [
			"pre",
			e.attrs.lang ? { "data-lang": e.attrs.lang } : {},
			["code", 0]
		]
	},
	horizontal_rule: {
		group: "block",
		parseDOM: [{ tag: "hr" }],
		toDOM: () => ["hr"]
	},
	bullet_list: {
		group: "block",
		content: "list_item+",
		parseDOM: [{ tag: "ul" }],
		toDOM: () => ["ul", 0]
	},
	ordered_list: {
		group: "block",
		content: "list_item+",
		attrs: { start: { default: 1 } },
		parseDOM: [{
			tag: "ol",
			getAttrs: (e) => {
				let t = e.getAttribute("start");
				return { start: t ? Number(t) : 1 };
			}
		}],
		toDOM: (e) => {
			let t = e.attrs.start;
			return [
				"ol",
				t === 1 ? {} : { start: t },
				0
			];
		}
	},
	list_item: {
		content: "paragraph block*",
		defining: !0,
		parseDOM: [{ tag: "li" }],
		toDOM: () => ["li", 0]
	},
	text: { group: "inline" },
	hard_break: {
		group: "inline",
		inline: !0,
		selectable: !1,
		parseDOM: [{ tag: "br" }],
		toDOM: () => ["br"]
	}
}, Os = {}, $ = new p({
	nodes: {
		...Ds,
		...gs()
	},
	marks: {
		...Os,
		...hs()
	}
});
//#endregion
//#region src/normalize.ts
function ks(e) {
	let t = [], n = [], r = [], i = [];
	return e.descendants((e, a, o) => {
		if (!e.isTextblock) return !0;
		let s = e.textContent, c = Xi(s, o), l = a + 1;
		t.push({
			blockPos: a,
			plan: {
				blockStart: l,
				spans: c
			}
		});
		for (let e of c) {
			let t = l + e.openFrom, a = l + e.closeTo;
			if (e.delimRanges) for (let r of e.delimRanges) n.push({
				from: l + r.from,
				to: l + r.to,
				spanFrom: t,
				spanTo: a,
				forceVisible: r.forceVisible,
				softInside: r.softInside,
				forceHidden: r.forceHidden,
				className: r.className
			});
			else n.push({
				from: l + e.openFrom,
				to: l + e.openTo,
				spanFrom: t,
				spanTo: a
			}), n.push({
				from: l + e.closeFrom,
				to: l + e.closeTo,
				spanFrom: t,
				spanTo: a
			});
			if (e.extraDecorations) for (let t of e.extraDecorations) r.push({
				from: l + t.from,
				to: l + t.to,
				nodeName: t.nodeName,
				attrs: t.attrs
			});
			if (e.widgetDecorations) for (let n of e.widgetDecorations) i.push({
				pos: l + n.pos,
				spanFrom: t,
				spanTo: a,
				when: n.when,
				kind: n.kind,
				attrs: n.attrs,
				side: n.side
			});
		}
		return !1;
	}), {
		blocks: t,
		delims: n,
		extras: r,
		widgets: i
	};
}
var As = new n("normalize-inline");
function js() {
	let e = Es().flatMap((e) => e.markNames).map((e) => $.marks[e]).filter((e) => !!e), n = new Set(e);
	return new t({
		key: As,
		state: {
			init: (e, t) => ks(t.doc),
			apply: (e, t, n, r) => e.docChanged ? ks(r.doc) : t
		},
		appendTransaction(t, r, i) {
			let a = As.getState(i);
			if (!a) return null;
			let { blocks: o } = a, s = i.tr, c = !1;
			for (let { blockPos: t, plan: r } of o) {
				let a = i.doc.nodeAt(t);
				if (!a || !a.isTextblock) continue;
				let { blockStart: o, spans: l } = r, u = o + a.content.size, d = a.content.size;
				if (l.length === 0) {
					let e = !1;
					if (a.content.forEach((t) => {
						for (let r of t.marks) if (n.has(r.type)) {
							e = !0;
							return;
						}
					}), !e) continue;
				}
				for (let t of e) {
					let e = t.name, n = !1;
					for (let t of l) if (t.type === e) {
						n = !0;
						break;
					}
					let r = !1;
					if (!n && (a.content.forEach((e) => {
						r || e.marks.some((e) => e.type === t) && (r = !0);
					}), !r)) continue;
					let i = Array(d).fill(null);
					for (let n of l) {
						if (n.type !== e) continue;
						let r = t.create(n.attrs);
						for (let e = n.from; e < n.to; e++) i[e] = r;
					}
					let f = Array(d).fill(null);
					{
						let e = 0;
						a.content.forEach((n) => {
							let r = n.marks.find((e) => e.type === t) ?? null;
							for (let t = 0; t < n.nodeSize; t++) f[e + t] = r;
							e += n.nodeSize;
						});
					}
					let p = !0;
					for (let e = 0; e < d; e++) {
						let t = i[e], n = f[e];
						if (t !== n && (!t || !n || !t.eq(n))) {
							p = !1;
							break;
						}
					}
					if (!p) {
						s.removeMark(o, u, t);
						for (let n of l) n.type === e && s.addMark(o + n.from, o + n.to, t.create(n.attrs));
						c = !0;
					}
				}
			}
			return c ? s : null;
		}
	});
}
function Ms(e) {
	return As.getState(e)?.delims ?? [];
}
function Ns(e) {
	return As.getState(e)?.extras ?? [];
}
function Ps(e) {
	return As.getState(e)?.widgets ?? [];
}
//#endregion
//#region src/decorations.ts
function Fs(e) {
	return window.AaronnoteResolveAssetUrl?.(e) ?? e;
}
var Is = {
	"math-render": (e) => {
		let t = e.display === "1", n = e.tex ?? "", r = document.createElement("span");
		return r.className = t ? "aaronnote-math-block" : "aaronnote-math-inline", r.setAttribute("data-tex", n), r.setAttribute("contenteditable", "false"), r.textContent = n, Ii(n, r, {
			displayMode: t,
			throwOnError: !1,
			strict: !1,
			trust: !1,
			output: "html"
		}, () => {
			r.classList.add("aaronnote-math-error"), r.textContent = t ? `$$ ${n} $$` : `$${n}$`;
		}), r;
	},
	"image-icon": (e) => {
		let t = document.createElement("span");
		return t.className = e.broken ? "image-icon broken" : "image-icon", t;
	},
	emoji: (e) => {
		let t = document.createElement("span");
		return t.className = "emoji-glyph", t.textContent = e.glyph ?? "", e.len && t.setAttribute("data-len", e.len), t;
	},
	"image-render": (e) => {
		let t = document.createElement("img");
		return t.className = "image-render", e.src && t.setAttribute("src", Fs(e.src)), e.alt && t.setAttribute("alt", e.alt), e.title && t.setAttribute("title", e.title), t;
	},
	checkbox: (e) => {
		let t = document.createElement("span");
		return t.className = "checkbox", t.setAttribute("data-checked", e.checked === "1" ? "1" : "0"), t;
	},
	"file-input": (e) => {
		let t = document.createElement("span");
		return t.className = "file-input", t.setAttribute("contenteditable", "false"), t.textContent = "📎", t.addEventListener("mousedown", (e) => {
			e.preventDefault();
		}), t.addEventListener("click", (n) => {
			n.preventDefault(), n.stopPropagation();
			let r = document.createElement("input");
			r.type = "file", e.accept && (r.accept = e.accept), r.style.display = "none", r.addEventListener("change", () => {
				t.dispatchEvent(new CustomEvent("file-input-pick", {
					bubbles: !0,
					detail: { files: r.files }
				})), document.body.removeChild(r);
			}), document.body.appendChild(r), r.click();
		}), t;
	}
};
function Ls(e) {
	let t = Is[e.kind], n = t ? t(e.attrs ?? {}) : (() => {
		let t = document.createElement("span");
		return t.className = e.kind, t;
	})();
	return n.setAttribute("contenteditable", "false"), n.setAttribute("data-pos", String(e.pos)), n;
}
function Rs(e) {
	return (t, n) => {
		let r = Ls(e), a = n();
		return typeof a == "number" && r.setAttribute("data-pos", String(a)), e.kind === "math-render" && (r.addEventListener("mousedown", (e) => {
			e.preventDefault(), e.stopPropagation();
		}), r.addEventListener("click", (r) => {
			r.preventDefault(), r.stopPropagation();
			let a = n() ?? e.spanFrom, o = e.attrs?.display === "1" ? a + 3 : a + 1, s = Math.max(e.spanFrom + 1, Math.min(o, e.spanTo - 1));
			t.dispatch(t.state.tr.setSelection(i.near(t.state.doc.resolve(s), 1)).scrollIntoView()), t.focus();
		})), r;
	};
}
function zs(e) {
	let t = [], n = e.selection.empty ? e.selection.from : null;
	for (let r of Ms(e)) {
		let e = n !== null && n >= r.spanFrom && n <= r.spanTo, i = n !== null && n > r.spanFrom && n < r.spanTo;
		if (r.forceHidden) {
			t.push(a.inline(r.from, r.to, { class: r.className ?? "syntax-hidden" }));
			continue;
		}
		if (r.softInside) {
			(r.className === "math-source-hidden" ? i : e) || t.push(a.inline(r.from, r.to, { class: r.className ?? "syntax-hidden" }));
			continue;
		}
		let o = r.forceVisible || e ? "syntax-hint" : "syntax-hidden";
		t.push(a.inline(r.from, r.to, { class: o }));
	}
	for (let n of Ns(e)) t.push(a.inline(n.from, n.to, {
		nodeName: n.nodeName,
		...n.attrs ?? {}
	}));
	for (let r of Ps(e)) {
		let e = n !== null && n >= r.spanFrom && n <= r.spanTo, i = n !== null && n > r.spanFrom && n < r.spanTo, o = r.kind === "math-render" && r.attrs?.display === "1" ? i : e;
		r.when === "inside" && !o || r.when === "outside" && o || t.push(a.widget(r.pos, Rs(r), {
			side: r.side ?? -1,
			key: `${r.kind}@${r.pos}:${JSON.stringify(r.attrs ?? {})}`,
			ignoreSelection: !0,
			stopEvent: (e) => r.kind === "math-render" && (e.type === "mousedown" || e.type === "click") ? !0 : e.type !== "click"
		}));
	}
	return t.length > 0 ? o.create(e.doc, t) : o.empty;
}
var Bs = new n("syntaxHints");
function Vs() {
	return new t({
		key: Bs,
		state: {
			init: (e, t) => zs(t),
			apply: (e, t, n, r) => zs(r)
		},
		props: { decorations(e) {
			return Bs.getState(e);
		} }
	});
}
//#endregion
//#region src/input-rules.ts
function Hs() {
	return v({ rules: bs($) });
}
function Us() {
	return new t({ props: { handleTextInput(e, t, n, r) {
		if (r !== " ") return !1;
		let i = e.state.storedMarks;
		if (!i || i.length === 0) return !1;
		let a = e.state.schema.text(" "), o = e.state.tr.replaceWith(t, n, a).setStoredMarks(null);
		return e.dispatch(o), !0;
	} } });
}
//#endregion
//#region src/editor.ts
function Ws(e) {
	return e.match(/^([A-Za-z][\w+.-]*):/)?.[1]?.toLowerCase() ?? null;
}
function Gs(e) {
	let t = Ws(e);
	return t != null && ![
		"http",
		"https",
		"mailto"
	].includes(t);
}
function Ks(e) {
	let t = e.trim();
	if (!t || t.startsWith("#") || Ws(t)) return !1;
	let n = t.split(/[?#]/, 1)[0] ?? "";
	return /\.(?:md|markdown)$/i.test(n);
}
function qs(e) {
	let t = Ws(e);
	return /^roam:\/\//i.test(e) || t && ![
		"http",
		"https",
		"mailto"
	].includes(t) ? !0 : Ks(e);
}
function Js(e, t = {}) {
	let n = /^roam:\/\//i.test(e) || Ks(e) || Gs(e) ? e : window.AaronnoteResolveAssetUrl?.(e) ?? e, r = new CustomEvent("aaronnote:open-url", {
		bubbles: !0,
		cancelable: !0,
		detail: {
			href: n,
			newWindow: t.newWindow === !0
		}
	});
	if (document.dispatchEvent(r) && Gs(n)) {
		window.location.href = n;
		return;
	}
	r.defaultPrevented || window.open(n, "_blank", "noopener,noreferrer");
}
function Ys() {
	return new t({ props: { handleClick(e, t, n) {
		let r = n.target?.closest("a");
		if (!r) return !1;
		let i = r.getAttribute("href");
		if (!i) return !1;
		let a = /Mac|iPhone|iPad/.test(navigator.platform) ? n.metaKey : n.ctrlKey;
		return !qs(i) && !a ? !1 : (n.preventDefault(), Js(i, { newWindow: n.altKey || n.metaKey }), !0);
	} } });
}
function Xs(e = {}) {
	let { cursorWidget: t = !0 } = e, n = ws($), r = [
		c(),
		m({
			"Mod-z": u,
			"Mod-y": l,
			"Mod-Shift-z": l
		}),
		Hs(),
		Us(),
		js(),
		...Ts($),
		Vs(),
		Ys()
	];
	return t && r.push(ae()), Object.keys(n).length > 0 && r.push(m(n)), r.push(m(h)), r;
}
//#endregion
//#region src/parser.ts
var Zs = new ie("commonmark", { html: !1 });
for (let e of _s()) Zs.use(e);
Zs.block.ruler.at("paragraph", function(e, t, n) {
	let r = e.md.block.ruler.getRules("paragraph"), i = e.parentType, a = t + 1;
	for (e.parentType = "paragraph"; a < n && !e.isEmpty(a); a++) {
		if (e.sCount[a] - e.blkIndent > 3 || e.sCount[a] < 0) continue;
		let t = !1;
		for (let i = 0; i < r.length; i++) if (r[i](e, a, n, !0)) {
			t = !0;
			break;
		}
		if (t) break;
	}
	let o = e.getLines(t, a, e.blkIndent, !1);
	e.line = a, e.push("paragraph_open", "p", 1).map = [t, e.line];
	let s = e.push("inline", "", 0);
	return s.content = o, s.map = [t, e.line], s.children = [], e.push("paragraph_close", "p", -1), e.parentType = i, !0;
});
var Qs = vs(), $s = class {
	stack = [{
		type: $.nodes.doc,
		attrs: null,
		content: []
	}];
	marks = f.none;
	top() {
		return this.stack[this.stack.length - 1];
	}
	push(e) {
		this.top().content.push(e);
	}
	addText(e) {
		e && this.top().content.push($.text(e, this.marks));
	}
	openMark(e) {
		this.marks = e.addToSet(this.marks);
	}
	closeMarkType(e) {
		this.marks = this.marks.filter((t) => t.type !== e);
	}
	topMark(e) {
		return this.marks.find((t) => t.type === e);
	}
	openNode(e, t = null) {
		this.stack.push({
			type: e,
			attrs: t,
			content: []
		});
	}
	closeNode() {
		let e = this.stack.pop();
		if (!e) throw Error("closeNode: stack underflow");
		let t = e.type.createAndFill(e.attrs, e.content);
		if (!t) throw Error(`parser: cannot fill <${e.type.name}>`);
		this.top().content.push(t);
	}
	addInlineTokens(e = []) {
		for (let t of e) tc(this, t);
	}
	addBlockTokens(e = []) {
		for (let t of e) ec(this, t);
	}
	finish() {
		for (; this.stack.length > 1;) this.closeNode();
		let e = this.stack[0], t = e.type.createAndFill(null, e.content);
		if (!t) throw Error("parser: cannot build doc");
		return t;
	}
};
function ec(e, t) {
	let { nodes: n } = $;
	switch (t.type) {
		case "paragraph_open":
			e.openNode(n.paragraph);
			return;
		case "paragraph_close":
			e.closeNode();
			return;
		case "heading_open": {
			let r = t.markup, i = r === "=" || r === "-" ? "setext" : "atx";
			e.openNode(n.heading, {
				level: Number(t.tag.slice(1)),
				style: i
			});
			return;
		}
		case "heading_close":
			e.closeNode();
			return;
		case "blockquote_open":
			e.openNode(n.blockquote);
			return;
		case "blockquote_close":
			e.closeNode();
			return;
		case "bullet_list_open":
			e.openNode(n.bullet_list);
			return;
		case "bullet_list_close":
			e.closeNode();
			return;
		case "ordered_list_open": {
			let r = t.attrGet("start");
			e.openNode(n.ordered_list, { start: r ? Number(r) : 1 });
			return;
		}
		case "ordered_list_close":
			e.closeNode();
			return;
		case "list_item_open":
			e.openNode(n.list_item);
			return;
		case "list_item_close":
			e.closeNode();
			return;
		case "fence": {
			let r = t.content.replace(/\n$/, ""), i = r ? [$.text(r)] : [];
			e.push(n.code_block.createChecked({ lang: t.info.trim() }, i));
			return;
		}
		case "code_block": {
			let r = t.content.replace(/\n$/, ""), i = r ? [$.text(r)] : [];
			e.push(n.code_block.createChecked({ lang: "" }, i));
			return;
		}
		case "hr":
			e.push(n.horizontal_rule.create());
			return;
		case "inline":
			for (let n of t.children ?? []) tc(e, n);
			return;
		default: {
			let n = Qs[t.type];
			n && n(e, t, $);
			return;
		}
	}
}
function tc(e, t) {
	let { nodes: n } = $;
	switch (t.type) {
		case "text":
			e.addText(t.content);
			return;
		case "softbreak":
			e.addText("\n");
			return;
		case "hardbreak":
			e.push(n.hard_break.create());
			return;
		default: {
			let n = Qs[t.type];
			n && n(e, t, $);
			return;
		}
	}
}
function nc(e) {
	let t = Zs.parse(e, {}), n = new $s();
	for (let e of t) ec(n, e);
	let r = n.finish();
	for (let e of Cs()) r = e(r);
	return r;
}
//#endregion
//#region src/serializer.ts
var rc = (e) => /[\\`*_\[\]<>]/.test(e) ? `\\${e}` : e, ic = (e) => /[#\->+*_]/.test(e) ? `\\${e}` : rc(e), ac = {
	marks: { ...ys() },
	escapeInline: rc,
	escapeBlockStart: ic,
	codeMarkAsBacktickFence: !1
}, oc = class {
	out = "";
	delim = "";
	closed = null;
	pmPos = 0;
	markers;
	config;
	constructor(e, t = []) {
		this.config = e, this.markers = t.map((e) => ({
			...e,
			side: e.side ?? "inner",
			done: !1
		}));
	}
	tick(e) {
		for (let t of this.markers) !t.done && t.side === e && t.pos === this.pmPos && (this.out += t.char, t.done = !0);
	}
	advance(e) {
		this.pmPos += e;
	}
	atBlankLine() {
		return this.out === "" || this.out.endsWith("\n");
	}
	flushClose(e = !1) {
		if (this.closed) {
			if (this.atBlankLine() || (this.out += "\n"), !e) {
				let e = this.delim.replace(/\s+$/, "");
				this.out += e + "\n";
			}
			this.closed = null;
		}
	}
	write(e = "") {
		this.flushClose(), this.delim && this.atBlankLine() && (this.out += this.delim), e && (this.out += e);
	}
	closeBlock(e) {
		this.closed = e;
	}
	wrapBlock(e, t, n, r) {
		let i = this.delim;
		this.write(t ?? e), this.delim += e, r(), this.delim = i, this.closeBlock(n);
	}
	renderDoc(e) {
		e.forEach((e) => this.renderBlock(e));
	}
	renderBlock(e) {
		this.advance(1);
		let t = lc[e.type.name];
		if (!t) throw Error(`serializer: no handler for <${e.type.name}>`);
		t(this, e), this.advance(1);
	}
	renderBlockChildren(e) {
		this.tick("inner"), e.forEach((e) => this.renderBlock(e)), this.tick("inner");
	}
	renderInline(e) {
		this.tick("inner");
		let t = [], n = this.config.marks, r = Es().flatMap((t) => t.extRanges(e)), i = 0, a = (e) => {
			for (let [t, n] of r) if (e >= t && e < n) return !0;
			return !1;
		}, o = (e) => {
			for (; t.length > 0;) {
				let r = t[t.length - 1];
				if (e.some((e) => e.eq(r))) break;
				let i = n[r.type.name];
				i && (this.out += typeof i.close == "function" ? i.close(r) : i.close), t = t.slice(0, -1), this.tick("outer");
			}
		}, s = (e, r) => {
			for (let i of e) {
				if (t.some((e) => e.eq(i))) continue;
				this.tick("outer");
				let e = n[i.type.name];
				e && (this.out += typeof e.open == "function" ? e.open(r) : e.open), t = [...t, i];
			}
		};
		e.forEach((e) => {
			if (e.marks.find((e) => e.type === $.marks.code) && this.config.codeMarkAsBacktickFence) {
				o([]), this.write();
				let t = e.text ?? "", n = (t.match(/`+/g) ?? []).reduce((e, t) => Math.max(e, t.length), 0) + 1, r = "`".repeat(n), a = t.startsWith("`") || t.endsWith("`") ? " " : "";
				this.out += r + a, this.tick("inner");
				for (let e of t) this.tick("inner"), this.out += e, this.advance(1), i++;
				this.tick("inner"), this.out += a + r;
				return;
			}
			let n = cc[e.type.name];
			if (n) {
				o([]), this.write(), n(this, e), i += e.nodeSize;
				return;
			}
			if (e.type === $.nodes.hard_break) {
				o([]), this.write(), this.tick("inner"), this.out += "  \n", this.delim && (this.out += this.delim), this.advance(1);
				return;
			}
			if (!e.isText) return;
			o(e.marks), this.write(), s(e.marks, e);
			let r = e.text ?? "", c = this.atBlankLine() && t.length === 0, l = !1;
			for (let e of r) this.tick("inner"), e === "\n" ? (this.out += "\n", this.delim && (this.out += this.delim)) : a(i) ? (this.out += e, l = !0) : (this.out += c && !l ? this.config.escapeBlockStart(e) : this.config.escapeInline(e), l = !0), i++, this.advance(1);
		}), o([]), this.tick("inner");
	}
}, sc = {
	paragraph: (e, t) => {
		e.renderInline(t), e.closeBlock(t);
	},
	heading: (e, t) => {
		let n = t.attrs.level;
		if (t.attrs.style === "setext" && (n === 1 || n === 2)) {
			e.renderInline(t), e.write(`\n${n === 1 ? "===" : "---"}`), e.closeBlock(t);
			return;
		}
		e.write(`${"#".repeat(n)} `), e.renderInline(t), e.closeBlock(t);
	},
	blockquote: (e, t) => {
		e.wrapBlock("> ", null, t, () => e.renderBlockChildren(t));
	},
	code_block: (e, t) => {
		let n = String(t.attrs.lang ?? "");
		e.write("```" + n + "\n"), e.tick("inner");
		for (let n of t.textContent) e.tick("inner"), n === "\n" ? (e.out += "\n", e.delim && (e.out += e.delim)) : e.out += n, e.advance(1);
		e.tick("inner"), e.write("\n```"), e.closeBlock(t);
	},
	horizontal_rule: (e, t) => {
		e.write("---"), e.closeBlock(t);
	},
	bullet_list: (e, t) => {
		e.tick("inner"), t.forEach((t, n, r) => {
			r > 0 && e.flushClose(!0), e.wrapBlock("  ", "- ", t, () => e.renderBlockChildren(t));
		}), e.tick("inner");
	},
	ordered_list: (e, t) => {
		let n = t.attrs.start ?? 1, r = String(n + t.childCount - 1).length;
		e.tick("inner"), t.forEach((t, i, a) => {
			a > 0 && e.flushClose(!0);
			let o = String(n + a), s = `${o}. ${" ".repeat(Math.max(0, r - o.length))}`, c = " ".repeat(r + 2);
			e.wrapBlock(c, s, t, () => e.renderBlockChildren(t));
		}), e.tick("inner");
	},
	list_item: (e, t) => {
		e.renderBlockChildren(t);
	}
}, cc = Ss(), lc = {
	...sc,
	...xs()
};
function uc(e) {
	let t = new oc(ac);
	return t.renderDoc(e), t.out.replace(/\n+$/, "\n");
}
//#endregion
//#region src/editor-api.ts
function dc(e) {
	return e.replace(/\r\n?/g, "\n").replace(/\u0008/g, String.raw`\b`).replace(/\u000c/g, String.raw`\f`).replace(/\u000b/g, String.raw`\v`);
}
function fc(t, n = {}) {
	let r = document.createElement("div");
	r.className = "typora-web-wrap";
	let a = document.createElement("div");
	a.className = "typora-web-editor-host";
	let o = document.createElement("textarea");
	o.className = "typora-web-source", o.hidden = !0, r.append(a, o), t.append(r);
	let c, f = !1, p = "";
	function m(e) {
		if (n.onChange) {
			if (n.onChange.length === 0) {
				n.onChange();
				return;
			}
			n.onChange(typeof e == "function" ? e() : e);
		}
	}
	function h(t) {
		let r = t ? nc(t) : $.nodes.doc.createAndFill(), o = e.create({
			schema: $,
			doc: r,
			plugins: Xs({ cursorWidget: !1 })
		}), c = new s(a, {
			state: o.apply(o.tr.setSelection(i.atStart(r))),
			dispatchTransaction(e) {
				let t = c.state.apply(e);
				c.updateState(t), e.docChanged && m(() => uc(t.doc));
			},
			handleDOMEvents: {
				focus: () => (n.onFocus?.(), !1),
				blur: () => (n.onBlur?.(), !1),
				paste: (e, t) => {
					let n = t.clipboardData;
					if (!n || n.files.length > 0) return !1;
					let r = n.getData("text/plain");
					if (!r) return !1;
					t.preventDefault();
					let { from: i, to: a } = e.state.selection;
					return e.dispatch(e.state.tr.insertText(dc(r), i, a).scrollIntoView()), !0;
				}
			}
		});
		return c;
	}
	function g(e) {
		c.destroy(), a.innerHTML = "", c = h(e);
	}
	function _() {
		o.style.height = "auto", o.style.height = `${o.scrollHeight}px`;
	}
	function v(e) {
		let t = o;
		if (!t.isConnected) return null;
		let n = window.getComputedStyle(t), r = document.createElement("div");
		for (let e of [
			"fontFamily",
			"fontSize",
			"fontWeight",
			"fontStyle",
			"letterSpacing",
			"lineHeight",
			"tabSize",
			"paddingTop",
			"paddingRight",
			"paddingBottom",
			"paddingLeft",
			"borderTopWidth",
			"borderRightWidth",
			"borderBottomWidth",
			"borderLeftWidth",
			"boxSizing",
			"whiteSpace",
			"wordBreak",
			"wordWrap",
			"width"
		]) r.style[e] = n[e];
		r.style.position = "absolute", r.style.visibility = "hidden", r.style.top = "0", r.style.left = "0", r.style.height = "auto";
		let i = t.value;
		r.textContent = i.slice(0, e);
		let a = document.createElement("span");
		a.textContent = "​", r.appendChild(a), r.appendChild(document.createTextNode(i.slice(e) || " ")), document.body.appendChild(r);
		let s = a.getBoundingClientRect(), c = r.getBoundingClientRect(), l = t.getBoundingClientRect();
		document.body.removeChild(r);
		let u = l.top + (s.top - c.top), d = l.left + (s.left - c.left), f = Number.parseFloat(n.lineHeight);
		return {
			left: d,
			top: u,
			bottom: u + (Number.isFinite(f) ? f : s.height || 18)
		};
	}
	function y() {
		let e = o.selectionStart;
		if (e == null) return;
		let t = v(e);
		if (t == null) return;
		let n = t.top + window.scrollY - window.innerHeight / 3;
		window.scrollTo({
			top: n,
			behavior: "instant"
		});
	}
	function ee() {
		let e = c.state.selection;
		try {
			return uc(c.state.doc.cut(0, e.from)).length;
		} catch {
			return uc(c.state.doc).length;
		}
	}
	function te(e, t) {
		try {
			return nc(e.slice(0, Math.max(0, t))).content.size;
		} catch {
			return 0;
		}
	}
	function ne(e) {
		let t = nc(e), n = document.createElement("div");
		return n.appendChild(d.fromSchema($).serializeFragment(t.content, { document })), n.innerHTML;
	}
	function re() {
		let e = uc(c.state.doc), t = ee();
		p = e, o.value = e, a.hidden = !0, o.hidden = !1, _(), o.focus();
		let n = Math.min(t, e.length);
		o.setSelectionRange(n, n), y(), f = !0;
	}
	function ie() {
		let e = o.value, t = te(e, o.selectionStart ?? e.length);
		g(e);
		let n = Math.min(t, c.state.doc.content.size);
		try {
			let e = i.near(c.state.doc.resolve(n));
			c.dispatch(c.state.tr.setSelection(e).scrollIntoView());
		} catch {}
		o.hidden = !0, a.hidden = !1, c.focus(), f = !1, e !== p && m(() => uc(c.state.doc));
	}
	let ae = (e) => {
		if (e.key !== "/" || !(/Mac/.test(navigator.platform) ? e.metaKey : e.ctrlKey) || e.shiftKey || e.altKey) return;
		let t = e.target;
		t && (!a.contains(t) && t !== o || (e.preventDefault(), f ? ie() : re()));
	};
	return window.addEventListener("keydown", ae), n.onFocus && o.addEventListener("focus", () => n.onFocus()), n.onBlur && o.addEventListener("blur", () => n.onBlur()), o.addEventListener("input", () => {
		_(), m(o.value);
	}), c = h(n.initialContent ?? ""), {
		getMarkdown() {
			return f ? o.value : uc(c.state.doc);
		},
		getHTML() {
			return f ? ne(o.value) : c.dom.innerHTML;
		},
		setMarkdown(e) {
			f ? (o.value = e, p = e, _()) : g(e);
		},
		insertText(e, t = 0) {
			if (f) {
				let n = o.selectionStart ?? o.value.length, r = o.selectionEnd ?? n, i = Math.max(0, n - t);
				return o.setRangeText(e, i, r, "end"), _(), o.focus(), m(o.value), {
					from: i,
					to: i + e.length
				};
			} else {
				let { from: n, to: r } = c.state.selection, i = Math.max(0, n - t);
				return c.dispatch(c.state.tr.insertText(e, i, r).scrollIntoView()), c.focus(), {
					from: i,
					to: i + e.length
				};
			}
		},
		setSelection(e, t = e) {
			if (f) {
				let n = o.value.length;
				o.setSelectionRange(Math.max(0, Math.min(e, n)), Math.max(0, Math.min(t, n))), o.focus();
			} else {
				let n = c.state.doc, r = Math.max(0, Math.min(e, n.content.size)), a = Math.max(0, Math.min(t, n.content.size));
				try {
					c.dispatch(c.state.tr.setSelection(i.create(n, r, a)).scrollIntoView());
				} catch {
					c.dispatch(c.state.tr.setSelection(i.near(n.resolve(r))).scrollIntoView());
				}
				c.focus();
			}
		},
		getSelection() {
			return f ? {
				from: o.selectionStart ?? 0,
				to: o.selectionEnd ?? o.selectionStart ?? 0
			} : {
				from: c.state.selection.from,
				to: c.state.selection.to
			};
		},
		textBetween(e, t) {
			if (f) {
				let n = Math.max(0, Math.min(e, o.value.length)), r = Math.max(0, Math.min(t, o.value.length));
				return o.value.slice(n, r);
			}
			let n = c.state.doc.content.size, r = Math.max(0, Math.min(e, n)), i = Math.max(0, Math.min(t, n));
			return c.state.doc.textBetween(r, i, "\n", "\n");
		},
		replaceRange(e, t, n, r = "end") {
			if (f) {
				let i = o.value.length, a = Math.max(0, Math.min(e, i)), s = Math.max(0, Math.min(t, i));
				return o.setRangeText(n, a, s, r === "all" ? "select" : r), _(), o.focus(), m(o.value), {
					from: a,
					to: a + n.length
				};
			}
			let a = c.state.doc.content.size, s = Math.max(0, Math.min(e, a)), l = Math.max(0, Math.min(t, a));
			c.dispatch(c.state.tr.insertText(n, s, l).scrollIntoView());
			let u = {
				from: s,
				to: s + n.length
			}, d = r === "start" ? u.from : u.to, p = r === "all" ? u.from : d;
			return r === "all" ? c.dispatch(c.state.tr.setSelection(i.create(c.state.doc, u.from, u.to)).scrollIntoView()) : c.dispatch(c.state.tr.setSelection(i.near(c.state.doc.resolve(p))).scrollIntoView()), u;
		},
		undo() {
			return f ? (o.focus(), document.execCommand("undo")) : u(c.state, c.dispatch, c);
		},
		redo() {
			return f ? (o.focus(), document.execCommand("redo")) : l(c.state, c.dispatch, c);
		},
		cursorContext(e = 500) {
			if (f) {
				let t = o.selectionStart ?? o.value.length, n = v(t), r = Math.max(0, t - e);
				return {
					before: o.value.slice(r, t),
					after: o.value.slice(t, t + e),
					rect: n,
					rectAtOffset: (e) => v(r + e)
				};
			}
			let t = c.state.selection, n = (() => {
				try {
					let e = c.coordsAtPos(t.from);
					return {
						left: e.left,
						top: e.top,
						bottom: e.bottom
					};
				} catch {
					return null;
				}
			})(), r = t.$from, i = Math.max(0, r.parentOffset - e), a = t.from - r.parentOffset;
			return {
				before: r.parent.textBetween(i, r.parentOffset, "\n", "\n"),
				after: r.parent.textBetween(r.parentOffset, Math.min(r.parent.content.size, r.parentOffset + e), "\n", "\n"),
				rect: n,
				rectAtOffset: (e) => {
					try {
						let t = c.coordsAtPos(a + i + e);
						return {
							left: t.left,
							top: t.top,
							bottom: t.bottom
						};
					} catch {
						return null;
					}
				}
			};
		},
		toggleSource() {
			f ? ie() : re();
		},
		isSourceMode() {
			return f;
		},
		focus() {
			f ? o.focus() : c.focus();
		},
		destroy() {
			window.removeEventListener("keydown", ae), c.destroy(), r.remove();
		},
		get view() {
			return c;
		}
	};
}
//#endregion
export { fc as createEditor };
