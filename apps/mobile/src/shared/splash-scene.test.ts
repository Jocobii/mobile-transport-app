import { describe, expect, it } from "vitest";
import { buildSplashScene, PIN_ART, starPath } from "./splash-scene";

function points(path: string): Array<{ x: number; y: number }> {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
  }));
}

describe("buildSplashScene", () => {
  const phone = { width: 411, height: 891, pinHeight: 200 };

  it("stands the pin tip half a pin below the screen center", () => {
    const scene = buildSplashScene(phone);
    expect(scene.tip).toEqual({ x: 205.5, y: 545.5 });
  });

  it("centers the pin artwork on screen at the requested height", () => {
    const { pinTransform } = buildSplashScene(phone);
    const scale = Math.round((200 / PIN_ART.height) * 1e5) / 1e5;
    expect(pinTransform).toBe(`translate(205.5 445.5) scale(${scale}) translate(-512 -489)`);
  });

  it.each([
    { width: 360, height: 640 },
    { width: 411, height: 891 },
    { width: 820, height: 1180 },
  ])("covers the screen width and bottom with both river bands ($width×$height)", (size) => {
    const scene = buildSplashScene({ ...size, pinHeight: 200 });
    for (const band of [scene.riverNear, scene.riverFar]) {
      const xs = points(band).map((p) => p.x);
      const ys = points(band).map((p) => p.y);
      expect(Math.min(...xs)).toBeLessThan(0);
      expect(Math.max(...xs)).toBeGreaterThan(size.width);
      expect(Math.max(...ys)).toBeGreaterThan(size.height);
    }
  });

  it("puts the star up and to the left of the pin", () => {
    const scene = buildSplashScene(phone);
    const star = points(scene.star);
    const centerX = star.reduce((sum, p) => sum + p.x, 0) / star.length;
    const centerY = star.reduce((sum, p) => sum + p.y, 0) / star.length;
    expect(centerX).toBeLessThan(scene.tip.x);
    expect(centerY).toBeLessThan(scene.tip.y - phone.pinHeight);
  });
});

describe("starPath", () => {
  it("draws 16 vertices starting straight up", () => {
    const vertices = points(starPath(100, 100, 50, 20));
    expect(vertices).toHaveLength(16);
    expect(vertices[0]).toEqual({ x: 100, y: 50 });
  });
});
