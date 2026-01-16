#!/usr/bin/env tsx
/**
 * Test the Claude CLI client
 */
import "dotenv/config";
import { client } from "../utils/anthropic-client.js";

async function test() {
  console.log("Testing Claude CLI client...\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      system: "You are a helpful assistant. Respond briefly.",
      messages: [
        {
          role: "user",
          content: "What is 2 + 2? Answer with just the number.",
        },
      ],
    });

    console.log("Response:", JSON.stringify(response, null, 2));
    console.log("\nText:", response.content[0]?.text);
    console.log("Success!");
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
