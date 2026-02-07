import { describe, test, expect } from "vitest";
import {
  classifyCommunicationStyle,
} from "../../agents/ideation/communication-classifier.js";

// ============================================================================
// TESTS
// ============================================================================

describe("CommunicationStyleClassifier", () => {
  describe("classifyCommunicationStyle", () => {
    test("PASS: Identifies verbose style from long messages", () => {
      const messages = [
        {
          role: "user",
          content: `I have been thinking about this problem for quite some time now,
            and I believe there are multiple aspects we need to consider. First,
            let me explain my background in this area and then we can discuss
            the various approaches that might work for our specific situation.`,
        },
        {
          role: "user",
          content: `Building on what I mentioned earlier, I think we should also
            take into account the feedback I received from several colleagues
            who have extensive experience in this domain. They suggested that
            we explore alternative methodologies that could yield better results.`,
        },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("verbose");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test("PASS: Identifies terse style from short messages", () => {
      const messages = [
        { role: "user", content: "Yes." },
        { role: "user", content: "Healthcare apps." },
        { role: "user", content: "Small clinics." },
        { role: "user", content: "B2B." },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("terse");
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    test("PASS: Identifies analytical style from data-heavy messages", () => {
      const messages = [
        {
          role: "user",
          content: `Based on the data I analyzed, the market shows 15% YoY growth.
            Specifically, the TAM is approximately $4.2B with a CAC of $150
            and LTV of $2,400. Therefore, the LTV:CAC ratio of 16:1 is promising.`,
        },
        {
          role: "user",
          content: `The metrics indicate that conversion rates are 3.2% on average,
            consequently we should focus on optimizing the funnel. Precisely 67%
            of users drop off at step 2.`,
        },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("analytical");
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    test("PASS: Identifies emotional style from expressive messages", () => {
      const messages = [
        {
          role: "user",
          content: `I absolutely LOVE this idea!! It makes me so excited to think
            about the possibilities! Honestly, I feel like this could truly
            change everything!`,
        },
        {
          role: "user",
          content: `I hate how frustrating the current solutions are! It feels
            like no one cares about the user experience. Personally, I'm
            passionate about fixing this!`,
        },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("emotional");
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    test("PASS: Returns low confidence for mixed styles", () => {
      const messages = [
        { role: "user", content: "I think healthcare is interesting." },
        {
          role: "user",
          content: "The data shows 20% growth which is exciting!",
        },
        { role: "user", content: "Yes, B2B." },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.confidence).toBeLessThan(0.5);
    });

    test("PASS: Ignores assistant messages", () => {
      const messages = [
        {
          role: "assistant",
          content:
            "This is a long assistant message with many words that should not affect the classification at all because it contains over fifty words and would normally trigger verbose scoring.",
        },
        { role: "user", content: "Yes." },
        {
          role: "assistant",
          content:
            "Another verbose response from the agent with many many more words to try to influence the scoring algorithm incorrectly.",
        },
        { role: "user", content: "Ok." },
      ];

      const result = classifyCommunicationStyle(messages);

      expect(result.primary).toBe("terse");
    });

    test("PASS: Returns default for empty messages", () => {
      const result = classifyCommunicationStyle([]);

      expect(result.confidence).toBe(0);
      expect(result.scores.verbose).toBe(0.25);
      expect(result.scores.terse).toBe(0.25);
      expect(result.scores.analytical).toBe(0.25);
      expect(result.scores.emotional).toBe(0.25);
    });

    test("PASS: Scores always sum to 1", () => {
      const messages = [
        { role: "user", content: "Any random message content here." },
      ];

      const result = classifyCommunicationStyle(messages);

      const total = Object.values(result.scores).reduce((s, v) => s + v, 0);
      expect(total).toBeCloseTo(1, 5);
    });

    test("PASS: Evidence array is populated", () => {
      const messages = [{ role: "user", content: "A short message." }];

      const result = classifyCommunicationStyle(messages);

      expect(result.evidence).toBeDefined();
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    test("PASS: Handles system messages correctly", () => {
      const messages = [
        { role: "system", content: "System instructions here..." },
        { role: "user", content: "Yes." },
        { role: "user", content: "No." },
      ];

      const result = classifyCommunicationStyle(messages);

      // Should only analyze user messages
      expect(result.primary).toBe("terse");
    });
  });
});
