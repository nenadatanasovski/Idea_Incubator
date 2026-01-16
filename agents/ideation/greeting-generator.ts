import { ButtonOption } from "../../types/ideation.js";

/**
 * GREETING GENERATOR
 *
 * Creates a personalized opening message based on user profile.
 */

export interface UserProfile {
  name?: string;
  skills?: string[];
  interests?: string[];
  experience?: {
    industries?: string[];
    years?: number;
  };
  location?: {
    city?: string;
    country?: string;
  };
  [key: string]: unknown;
}

export interface GreetingWithButtons {
  text: string;
  buttons: ButtonOption[];
}

/**
 * Generate personalized greeting based on user profile.
 */
export function generateGreeting(profile: UserProfile): string {
  const parts: string[] = [];

  // Opening
  parts.push(
    "Welcome! I'm here to help you discover a business idea that's genuinely right for you.",
  );

  // Process explanation
  parts.push(`
Here's how this works: We'll have a conversation where I ask questions, you answer, and together we'll explore what excites you and what the market needs. As we go, I'll be looking for where those two things overlap.

When I spot a promising idea, it'll appear in the panel on the right. I'll also let you know if I see significant challenges — better to know early than waste time on something that won't work.

Feel free to suggest any ideas you've been thinking about — I'll help you explore and validate them.`);

  // Profile-based personalization
  const personalizations: string[] = [];

  // Technical skills
  const technicalSkills =
    profile.skills?.filter((s) =>
      [
        "programming",
        "software",
        "development",
        "engineering",
        "data",
        "design",
      ].some((t) => s.toLowerCase().includes(t)),
    ) || [];

  if (technicalSkills.length > 0) {
    personalizations.push(
      `technical background in ${technicalSkills.slice(0, 2).join(" and ")}`,
    );
  }

  // Domain experience
  if (
    profile.experience?.industries &&
    profile.experience.industries.length > 0
  ) {
    personalizations.push(
      `experience in ${profile.experience.industries.slice(0, 2).join(" and ")}`,
    );
  }

  // Interests from profile
  if (profile.interests && profile.interests.length > 0) {
    personalizations.push(
      `interest in ${profile.interests.slice(0, 2).join(" and ")}`,
    );
  }

  // Location
  if (profile.location?.city) {
    personalizations.push(`based in ${profile.location.city}`);
  }

  if (personalizations.length > 0) {
    parts.push(
      `\nI've loaded your profile, so I know you have ${personalizations.join(", ")}. Let's use that as our starting point.`,
    );
  } else {
    parts.push(
      `\nI've loaded your profile. Let's use what I know about you as our starting point.`,
    );
  }

  // Opening question
  parts.push(`
What's been occupying your mind lately? Any problems you've noticed, frustrations you've had, or opportunities you've wondered about?`);

  return parts.join("\n");
}

/**
 * Generate greeting with buttons for common starting points.
 */
export function generateGreetingWithButtons(
  profile: UserProfile,
): GreetingWithButtons {
  return {
    text: generateGreeting(profile),
    buttons: [
      {
        id: "btn_frustration",
        label: "Something frustrates me",
        value:
          "There's something that frustrates me that I think could be better",
        style: "secondary",
      },
      {
        id: "btn_idea",
        label: "I have a rough idea",
        value: "I have a rough idea I've been thinking about",
        style: "secondary",
      },
      {
        id: "btn_explore",
        label: "Help me explore",
        value: "I don't have anything specific, help me explore",
        style: "secondary",
      },
    ],
  };
}

/**
 * Generate a greeting for a returning user.
 */
export function generateReturningGreeting(
  profile: UserProfile,
  lastSessionSummary?: string,
): string {
  let greeting = `Welcome back${profile.name ? `, ${profile.name}` : ""}! `;

  if (lastSessionSummary) {
    greeting += `Last time, ${lastSessionSummary}\n\n`;
    greeting += `Would you like to continue where we left off, or start fresh with something new?`;
  } else {
    greeting += `Ready to explore some ideas?\n\n`;
    greeting += generateGreeting(profile).split("\n\n").slice(-1)[0];
  }

  return greeting;
}
