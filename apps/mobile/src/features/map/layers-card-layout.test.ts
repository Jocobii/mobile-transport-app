import { describe, expect, it } from "vitest";
import { layersCardMaxHeight } from "./layers-card-layout";

describe("layersCardMaxHeight", () => {
  it("leaves the space between the card's bottom and the search bar", () => {
    expect(
      layersCardMaxHeight({ screenHeight: 800, cardBottom: 500, searchBarBottom: 100, gap: 8 }),
    ).toBe(192);
  });

  it("never returns a negative height", () => {
    expect(
      layersCardMaxHeight({ screenHeight: 500, cardBottom: 450, searchBarBottom: 100, gap: 8 }),
    ).toBe(0);
  });
});
