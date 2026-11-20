import { describe, expect, it } from "vitest";
import {
  ID_SCHEME_COWRITER_V1,
  chapterKind,
  isChapterCode,
  suggestNextCode,
} from "@/shared/id-scheme";

describe("book-structure: Chapter codes follow the scheme", () => {
  it.each(["00", "01", "42", "98", "99", "INT", "INT1", "INT9"])("accepts %s", (code) => {
    expect(isChapterCode(code)).toBe(true);
  });

  it.each(["1", "100", "INT10", "INT0", "int", "A1", "", " 01", "01 ", "0１"])(
    "rejects %j",
    (code) => {
      expect(isChapterCode(code)).toBe(false);
    },
  );

  it("names the kind of each code", () => {
    expect(chapterKind("00")).toBe("prologue");
    expect(chapterKind("99")).toBe("epilogue");
    expect(chapterKind("INT2")).toBe("interlude");
    expect(chapterKind("07")).toBe("chapter");
  });

  it("Suggested code: lowest unused regular code", () => {
    expect(suggestNextCode(["01", "02", "04"])).toBe("03");
    expect(suggestNextCode([])).toBe("01");
    expect(suggestNextCode(["00", "99", "INT", "01"])).toBe("02");
    const all = Array.from({ length: 98 }, (_, i) => String(i + 1).padStart(2, "0"));
    expect(suggestNextCode(all)).toBeNull();
  });
});

describe("book-profile: Scheme shown", () => {
  it("has the cowriter examples", () => {
    expect(ID_SCHEME_COWRITER_V1.examples).toEqual(["03.014", "00.001", "INT.002", "03.014a"]);
  });
});
