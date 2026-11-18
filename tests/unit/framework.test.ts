import { describe, expect, it } from "vitest";
import {
  DIMENSIONS,
  GROUPS,
  LANGUAGE_SENSITIVE,
  SCENE_LEVEL,
  TAGS,
  dimension,
} from "@/shared/framework";

describe("style framework", () => {
  it("has 31 dimensions numbered 1-31 without gaps", () => {
    expect(DIMENSIONS).toHaveLength(31);
    expect(DIMENSIONS.map((d) => d.number)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("assigns dimensions to groups A-G as in cowriter", () => {
    const byGroup = (g: string) => DIMENSIONS.filter((d) => d.group === g).map((d) => d.number);
    expect(byGroup("A")).toEqual([1, 2, 3, 4]);
    expect(byGroup("B")).toEqual([5, 6, 7, 8]);
    expect(byGroup("C")).toEqual([9, 10, 11, 12]);
    expect(byGroup("D")).toEqual([13, 14, 15]);
    expect(byGroup("E")).toEqual([16, 17, 18]);
    expect(byGroup("F")).toEqual([19, 20, 21, 22, 23, 24, 25, 26]);
    expect(byGroup("G")).toEqual([27, 28, 29, 30, 31]);
    expect(Object.keys(GROUPS)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("names both poles of every dimension", () => {
    for (const d of DIMENSIONS) {
      expect(d.name.length).toBeGreaterThan(2);
      expect(d.low.length).toBeGreaterThan(2);
      expect(d.high.length).toBeGreaterThan(2);
    }
  });

  it("marks the language-sensitive and scene-level dimensions", () => {
    expect(LANGUAGE_SENSITIVE).toEqual([4, 5, 6, 7, 11]);
    expect(SCENE_LEVEL).toEqual([19, 20, 27, 28, 29, 30]);
    expect(dimension(23).name).toBe("Feeling rendering");
    expect(() => dimension(32)).toThrow(RangeError);
  });

  it("lists the five fixed tags", () => {
    expect(TAGS.map((t) => t.key)).toEqual([
      "narrativePerson",
      "addressedTo",
      "form",
      "literacy",
      "language",
    ]);
  });

  it("cannot be modified at runtime", () => {
    expect(Object.isFrozen(DIMENSIONS)).toBe(true);
    expect(Object.isFrozen(DIMENSIONS[0])).toBe(true);
  });
});
