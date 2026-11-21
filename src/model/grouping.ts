import type { Rule, TimedViolation } from "./rules";

/** More groups than this are shown as a collapsed summary instead of a full list. */
export const COLLAPSE_ABOVE = 3;

/** Violations of one rule on one module with the same message, merged over the transition. */
export interface ViolationGroup {
    readonly key: string;
    readonly rule: Rule;
    readonly moduleId: string;
    readonly message: string;
    readonly start: number;
    readonly end: number;
    readonly count: number;
    readonly partKeys: readonly string[];
    readonly zoneKeys: readonly string[];
}

/** Merges violations with the same rule, module and message into one group spanning their progress range, ordered by start. */
export function groupViolations(list: readonly TimedViolation[]): ViolationGroup[] {
    const groups = new Map<string, ViolationGroup>();
    for (const v of list) {
        const key = `${v.rule}|${v.moduleId}|${v.message}`;
        const g = groups.get(key);
        groups.set(
            key,
            g
                ? {
                      ...g,
                      start: Math.min(g.start, v.t),
                      end: Math.max(g.end, v.end),
                      count: g.count + 1,
                      partKeys: [...new Set([...g.partKeys, ...v.partKeys])],
                      zoneKeys: [...new Set([...g.zoneKeys, ...v.zoneKeys])],
                  }
                : { key, rule: v.rule, moduleId: v.moduleId, message: v.message, start: v.t, end: v.end, count: 1, partKeys: v.partKeys, zoneKeys: v.zoneKeys },
        );
    }
    return [...groups.values()].sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));
}

/** Whether a list of this many groups is too long to show in full by default. */
export const isLong = (groups: readonly ViolationGroup[]): boolean => groups.length > COLLAPSE_ABOVE;

/** How many groups break each rule, most frequent first. */
export function countByRule(groups: readonly ViolationGroup[]): { rule: Rule; count: number }[] {
    const counts = new Map<Rule, number>();
    for (const g of groups) counts.set(g.rule, (counts.get(g.rule) ?? 0) + 1);
    return [...counts].map(([rule, count]) => ({ rule, count })).sort((a, b) => b.count - a.count || a.rule.localeCompare(b.rule));
}

/** How many groups concern each module id, most frequent first. */
export function countByModule(groups: readonly ViolationGroup[]): { moduleId: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const g of groups) counts.set(g.moduleId, (counts.get(g.moduleId) ?? 0) + 1);
    return [...counts].map(([moduleId, count]) => ({ moduleId, count })).sort((a, b) => b.count - a.count || a.moduleId.localeCompare(b.moduleId));
}
