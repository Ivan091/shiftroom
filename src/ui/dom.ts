/** Anything `h` accepts as a child: nodes, text, or nothing. */
export type Child = Node | string | number | null | undefined | false;

type Props = Record<string, unknown>;

/**
 * Creates an element. Props starting with `on` become event listeners (`onClick` → `click`),
 * `class` sets the class name, and anything else is set as a property when the element has one,
 * otherwise as an attribute.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false) continue;
        if (key.startsWith("on") && typeof value === "function") {
            el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
        } else if (key === "class") {
            el.className = String(value);
        } else if (key in el) {
            (el as unknown as Record<string, unknown>)[key] = value;
        } else {
            el.setAttribute(key, value === true ? "" : String(value));
        }
    }
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : String(child));
    }
    return el;
}

/** A labelled metric number input that reports a parsed, finite value on change. */
export function numberField(label: string, value: number, step: number, onChange: (v: number) => void, unit = "m"): { row: HTMLElement; input: HTMLInputElement } {
    const input = h("input", {
        type: "number",
        step: String(step),
        value: String(Math.round(value * 1000) / 1000),
        onChange: () => {
            const v = Number(input.value);
            if (Number.isFinite(v)) onChange(v);
        },
    });
    return { row: h("label", { class: "field" }, h("span", {}, label), h("span", { class: "input-unit" }, input, h("em", {}, unit))), input };
}

/** Starts a browser download of the given text. */
export function download(filename: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = h("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
