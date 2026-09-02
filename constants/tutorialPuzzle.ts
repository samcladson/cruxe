/**
 * tutorialPuzzle.ts — GENERATED FILE. Do not edit by hand.
 *
 * Produced by scripts/generate-tutorial-puzzle.ts using the real crossword
 * engine, then frozen. The layout must stay fixed: the tutorial's coaching
 * refers to it, and buildPuzzle is non-deterministic, so rebuilding at
 * runtime would give every player a different grid.
 *
 * This puzzle has no row in daily_puzzles. It is never submitted, never
 * scored, and earns nothing — it is a warm-up, not a puzzle. That is what
 * keeps the tutorial free of any server surface.
 *
 * Layout:
 * C R U X . .
 * L . . . . .
 * U . . D . .
 * E V L O S .
 * . . . W . .
 * . M I N D .
 *
 * Regenerate with: npx tsx scripts/generate-tutorial-puzzle.ts
 */
import { Puzzle } from "../types/puzzle.types";

// Cast: Difficulty and Direction are string enums, so the serialised
// literals are correct at runtime but need widening for the compiler.
export const TUTORIAL_PUZZLE = {
  "id": "tutorial",
  "category": "general",
  "difficulty": "easy",
  "gridSize": 6,
  "grid": [
    [
      {
        "row": 0,
        "col": 0,
        "letter": "C",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [
          1
        ],
        "clueIds": [
          "1-across",
          "1-down"
        ],
        "state": "empty"
      },
      {
        "row": 0,
        "col": 1,
        "letter": "R",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "1-across"
        ],
        "state": "empty"
      },
      {
        "row": 0,
        "col": 2,
        "letter": "U",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "1-across"
        ],
        "state": "empty"
      },
      {
        "row": 0,
        "col": 3,
        "letter": "X",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "1-across"
        ],
        "state": "empty"
      },
      {
        "row": 0,
        "col": 4,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 0,
        "col": 5,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      }
    ],
    [
      {
        "row": 1,
        "col": 0,
        "letter": "L",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "1-down"
        ],
        "state": "empty"
      },
      {
        "row": 1,
        "col": 1,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 1,
        "col": 2,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 1,
        "col": 3,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 1,
        "col": 4,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 1,
        "col": 5,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      }
    ],
    [
      {
        "row": 2,
        "col": 0,
        "letter": "U",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "1-down"
        ],
        "state": "empty"
      },
      {
        "row": 2,
        "col": 1,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 2,
        "col": 2,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 2,
        "col": 3,
        "letter": "D",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [
          2
        ],
        "clueIds": [
          "2-down"
        ],
        "state": "empty"
      },
      {
        "row": 2,
        "col": 4,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 2,
        "col": 5,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      }
    ],
    [
      {
        "row": 3,
        "col": 0,
        "letter": "E",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "1-down",
          "3-reverse_across"
        ],
        "state": "empty"
      },
      {
        "row": 3,
        "col": 1,
        "letter": "V",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "3-reverse_across"
        ],
        "state": "empty"
      },
      {
        "row": 3,
        "col": 2,
        "letter": "L",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "3-reverse_across"
        ],
        "state": "empty"
      },
      {
        "row": 3,
        "col": 3,
        "letter": "O",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "2-down",
          "3-reverse_across"
        ],
        "state": "empty"
      },
      {
        "row": 3,
        "col": 4,
        "letter": "S",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [
          3
        ],
        "clueIds": [
          "3-reverse_across"
        ],
        "state": "empty"
      },
      {
        "row": 3,
        "col": 5,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      }
    ],
    [
      {
        "row": 4,
        "col": 0,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 4,
        "col": 1,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 4,
        "col": 2,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 4,
        "col": 3,
        "letter": "W",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "2-down"
        ],
        "state": "empty"
      },
      {
        "row": 4,
        "col": 4,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 4,
        "col": 5,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      }
    ],
    [
      {
        "row": 5,
        "col": 0,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      },
      {
        "row": 5,
        "col": 1,
        "letter": "M",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [
          4
        ],
        "clueIds": [
          "4-across"
        ],
        "state": "empty"
      },
      {
        "row": 5,
        "col": 2,
        "letter": "I",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "4-across"
        ],
        "state": "empty"
      },
      {
        "row": 5,
        "col": 3,
        "letter": "N",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "2-down",
          "4-across"
        ],
        "state": "empty"
      },
      {
        "row": 5,
        "col": 4,
        "letter": "D",
        "isBlocked": false,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [
          "4-across"
        ],
        "state": "empty"
      },
      {
        "row": 5,
        "col": 5,
        "letter": null,
        "isBlocked": true,
        "isPreFilled": false,
        "userInput": "",
        "clueNumbers": [],
        "clueIds": [],
        "state": "empty"
      }
    ]
  ],
  "clues": [
    {
      "id": "1-across",
      "number": 1,
      "direction": "across",
      "clue": "The essential point — and this app's name",
      "answer": "CRUX",
      "startRow": 0,
      "startCol": 0,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    },
    {
      "id": "1-down",
      "number": 1,
      "direction": "down",
      "clue": "A hint toward the answer",
      "answer": "CLUE",
      "startRow": 0,
      "startCol": 0,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    },
    {
      "id": "2-down",
      "number": 2,
      "direction": "down",
      "clue": "Top-to-bottom direction",
      "answer": "DOWN",
      "startRow": 2,
      "startCol": 3,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    },
    {
      "id": "3-reverse_across",
      "number": 3,
      "direction": "reverse_across",
      "clue": "What you are here to do",
      "answer": "SOLVE",
      "startRow": 3,
      "startCol": 4,
      "length": 5,
      "isPreFilled": false,
      "preFilledIndices": []
    },
    {
      "id": "4-across",
      "number": 4,
      "direction": "across",
      "clue": "What a puzzle sharpens",
      "answer": "MIND",
      "startRow": 5,
      "startCol": 1,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    }
  ],
  "acrossClues": [
    {
      "id": "1-across",
      "number": 1,
      "direction": "across",
      "clue": "The essential point — and this app's name",
      "answer": "CRUX",
      "startRow": 0,
      "startCol": 0,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    },
    {
      "id": "4-across",
      "number": 4,
      "direction": "across",
      "clue": "What a puzzle sharpens",
      "answer": "MIND",
      "startRow": 5,
      "startCol": 1,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    }
  ],
  "downClues": [
    {
      "id": "1-down",
      "number": 1,
      "direction": "down",
      "clue": "A hint toward the answer",
      "answer": "CLUE",
      "startRow": 0,
      "startCol": 0,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    },
    {
      "id": "2-down",
      "number": 2,
      "direction": "down",
      "clue": "Top-to-bottom direction",
      "answer": "DOWN",
      "startRow": 2,
      "startCol": 3,
      "length": 4,
      "isPreFilled": false,
      "preFilledIndices": []
    }
  ],
  "reverseAcrossClues": [
    {
      "id": "3-reverse_across",
      "number": 3,
      "direction": "reverse_across",
      "clue": "What you are here to do",
      "answer": "SOLVE",
      "startRow": 3,
      "startCol": 4,
      "length": 5,
      "isPreFilled": false,
      "preFilledIndices": []
    }
  ],
  "reverseDownClues": [],
  "date": "tutorial",
  "estimatedTime": 150,
  "totalWords": 5,
  "solvedWords": 0,
  "isComplete": false,
  "startedAt": null,
  "completedAt": null,
  "score": 0,
  "hintsUsed": 0
} as unknown as Puzzle;

/** Clue ids that read backwards — used to trigger the reverse-clue tooltip. */
export const TUTORIAL_REVERSE_CLUE_IDS = ["3-reverse_across"];
