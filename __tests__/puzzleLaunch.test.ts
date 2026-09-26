import { decidePuzzleLaunch } from "../utils/puzzleLaunch";

describe("decidePuzzleLaunch", () => {
  it("starts fresh when there is no active puzzle", () => {
    expect(decidePuzzleLaunch(null, "puzzle-a")).toBe("start");
  });

  it("starts fresh when the active puzzle is already complete", () => {
    expect(
      decidePuzzleLaunch({ id: "puzzle-a", isComplete: true }, "puzzle-a"),
    ).toBe("start");
    expect(
      decidePuzzleLaunch({ id: "puzzle-a", isComplete: true }, "puzzle-b"),
    ).toBe("start");
  });

  it("resumes when the tapped puzzle is the incomplete active one", () => {
    expect(
      decidePuzzleLaunch({ id: "puzzle-a", isComplete: false }, "puzzle-a"),
    ).toBe("resume");
  });

  it("flags a conflict when a different puzzle is still incomplete", () => {
    expect(
      decidePuzzleLaunch({ id: "puzzle-a", isComplete: false }, "puzzle-b"),
    ).toBe("conflict");
  });
});
