import { describe, it, expect } from "bun:test";
import { extractVideoId } from "./youtube.js";

describe("extractVideoId", () => {
  const expectedId = "P4QodeA_lQ0";

  it("extracts v param from youtube.com/watch", () => {
    const url = new URL(`https://www.youtube.com/watch?v=${expectedId}`);
    expect(extractVideoId(url)).toBe(expectedId);
  });

  it("extracts from youtu.be", () => {
    const url = new URL(`https://youtu.be/${expectedId}`);
    expect(extractVideoId(url)).toBe(expectedId);
  });

  it("extracts from youtube.com/embed/", () => {
    const url = new URL(`https://www.youtube.com/embed/${expectedId}`);
    expect(extractVideoId(url)).toBe(expectedId);
  });

  it("extracts from youtube.com/v/", () => {
    const url = new URL(`https://www.youtube.com/v/${expectedId}`);
    expect(extractVideoId(url)).toBe(expectedId);
  });

  it("extracts from youtube.com/shorts/", () => {
    const url = new URL(`https://www.youtube.com/shorts/${expectedId}`);
    expect(extractVideoId(url)).toBe(expectedId);
  });

  it("extracts from m.youtube.com", () => {
    const url = new URL(`https://m.youtube.com/watch?v=${expectedId}`);
    expect(extractVideoId(url)).toBe(expectedId);
  });

  it("returns null for non-youtube URLs", () => {
    const url = new URL("https://vimeo.com/12345");
    expect(extractVideoId(url)).toBeNull();
  });

  it("returns null for youtube without video id", () => {
    const url = new URL("https://www.youtube.com/");
    expect(extractVideoId(url)).toBeNull();
  });

  it("returns null for youtube channel pages", () => {
    const url = new URL("https://www.youtube.com/channel/UC12345");
    expect(extractVideoId(url)).toBeNull();
  });

  it("returns null for youtube playlist pages", () => {
    const url = new URL("https://www.youtube.com/playlist?list=PL12345");
    expect(extractVideoId(url)).toBeNull();
  });
});
