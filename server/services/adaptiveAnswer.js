// Turns {doubt, student_context} into a mastery-adapted spoken answer.
//
// This intentionally sits on top of the existing provider-agnostic
// chat() adapter in aiProvider.js rather than replacing it, so once a
// real AI provider is wired into aiProvider.js, this file needs no
// changes - it only shapes HOW the reply is delivered based on the
// student's mastery, not WHERE the reply comes from.

import { chat } from "./aiProvider.js";

// --------------------------------------------------
// Mastery tiers
// --------------------------------------------------

function masteryTier(mastery) {
  const value = Number(mastery);

  if (Number.isNaN(value)) {
    return "medium";
  }

  if (value < 0.4) {
    return "low";
  }

  if (value < 0.75) {
    return "medium";
  }

  return "high";
}

// --------------------------------------------------
// Delivery shaping per tier
//
// The underlying explanation always comes from chat();
// tier only controls framing/pacing/follow-up so low-mastery
// students get smaller steps and guidance, and high-mastery
// students get a concise nudge toward independent solving.
// --------------------------------------------------

const OPENING = {
  low: "",
  medium: "",
  high: "",
};

function closingFor(tier, studentContext) {
  const guided = Boolean(studentContext.guided_questions);

  if (tier === "low") {
    return guided
      ? " What do you think the very first step should be?"
      : " Take your time - we'll go through this slowly.";
  }

  if (tier === "medium") {
    return guided ? " Does that make sense so far?" : "";
  }

  // high mastery
  return " Now try extending that reasoning a bit further on your own.";
}

// --------------------------------------------------
// Generate the adaptive answer
// --------------------------------------------------

export async function generateAdaptiveAnswer({
  doubt,
  student_context: studentContext = {},
}) {
  const tier = masteryTier(studentContext.mastery);

  const reply = await chat({
    message: doubt,
    context: {
      topic: studentContext.topic,
      misconceptions: studentContext.errors || studentContext.misconceptions,
      pace: studentContext.pace,
      visual: studentContext.visual,
      tier,
    },
  });

  const opening = OPENING[tier] || "";
  const closing = closingFor(tier, studentContext);

  return `${opening}${reply}${closing}`.trim();
}