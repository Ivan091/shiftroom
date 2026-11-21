import { describe, expect, it } from "vitest";
import { addMode, addModule, nextId, removeMode, removeModule, renameMode, setModeParam, setRoom, updateModule } from "../src/model/edit";
import { PRESETS } from "../src/model/presets";
import { parseSetup, parseSetupText, serializeSetup } from "../src/model/setup";
import type { Setup } from "../src/model/types";

const preset: Setup = PRESETS[0]!;

describe("parseSetup", () => {
    it("reads back every preset unchanged", () => {
        for (const p of PRESETS) {
            expect(parseSetupText(serializeSetup(p))).toEqual({ ok: true, setup: p });
        }
    });

    it("rejects broken input with a readable reason", () => {
        expect(parseSetupText("{nope")).toEqual({ ok: false, error: "the file is not valid JSON" });
        expect(parseSetup({ ...preset, version: 2 })).toMatchObject({ ok: false, error: expect.stringContaining("version") });
        expect(parseSetup({ ...preset, modules: [{ ...preset.modules[0], type: "sofa" }] })).toMatchObject({
            ok: false,
            error: expect.stringContaining('"sofa"'),
        });
        expect(parseSetup({ ...preset, modules: [{ ...preset.modules[0], rotation: 45 }] })).toMatchObject({ ok: false });
        expect(parseSetup({ ...preset, room: { width: 0.5, depth: 4 } })).toMatchObject({ ok: false });
        expect(parseSetup({ ...preset, modes: [] })).toMatchObject({ ok: false });
        expect(parseSetup({ ...preset, modules: [preset.modules[0], preset.modules[0]] })).toMatchObject({
            ok: false,
            error: expect.stringContaining("duplicate"),
        });
    });

    it("drops mode states of modules that are not in the setup", () => {
        const input = { ...preset, modes: [{ id: "m", name: "M", states: { ghost: { slide: 1 }, "wall-1": { slide: 0.3 } } }] };
        const result = parseSetup(input);
        expect(result.ok && result.setup.modes[0]!.states).toEqual({ "wall-1": { slide: 0.3 } });
    });
});

describe("editing", () => {
    it("hands out the lowest free id", () => {
        expect(nextId("mode", ["mode-1", "mode-3"])).toBe("mode-2");
    });

    it("adds a sliding module whose rail spans the room width", () => {
        const { setup, id } = addModule(preset, "sliding-wall");
        expect(id).toBe("sliding-wall-1");
        const added = setup.modules.find((m) => m.id === id)!;
        expect(added.config.travel).toBeCloseTo(3.1);
        expect(added.name).toBe("Sliding wall module 2");
    });

    it("removes a module together with its state in every mode", () => {
        const setup = removeModule(preset, "wall-1");
        expect(setup.modules.map((m) => m.id)).not.toContain("wall-1");
        expect(setup.modes.every((m) => !("wall-1" in m.states))).toBe(true);
    });

    it("adds, renames and removes modes but always keeps one", () => {
        const { setup, id } = addMode(preset, "Guests", "mode-2");
        expect(setup.modes.find((m) => m.id === id)!.states).toEqual(preset.modes[1]!.states);
        expect(renameMode(setup, id, "  Party ").modes.at(-1)!.name).toBe("Party");
        expect(renameMode(setup, id, "   ").modes.at(-1)!.name).toBe("Guests");
        const single = removeMode(removeMode(removeMode(setup, "mode-1"), "mode-2"), id);
        expect(single.modes).toHaveLength(1);
    });

    it("sets one mode's state without touching the others", () => {
        const setup = setModeParam(preset, "mode-1", "wall-1", "slide", 1.5);
        expect(setup.modes[0]!.states["wall-1"]).toEqual({ slide: 1, bed: 1, desk: 0 });
        expect(setup.modes[1]).toBe(preset.modes[1]);
    });

    it("merges configuration patches and clamps the room size", () => {
        const setup = updateModule(preset, "wall-1", { config: { length: 5.3 } });
        expect(setup.modules[0]!.config).toEqual({ length: 5.3, travel: 3.1 });
        expect(setRoom(preset, { width: 0.2, depth: 40 }).room).toEqual({ width: 1.5, depth: 12 });
    });
});
