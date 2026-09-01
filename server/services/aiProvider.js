// Provider-agnostic AI adapter.
// Add your chosen provider here. Keep API keys server-side only.

export async function chat({message, context}) {
  // Safe local fallback for prototype development.
  const misconception = context?.misconceptions?.[0];
  if (/don't understand|dont understand|explain|again|wrong/i.test(message || "")) {
    return `Let's slow down and use a worked example. ${misconception ? `I noticed we should revisit ${misconception.replaceAll("_"," ")}. ` : ""}For x + 5 = 12, imagine a balanced scale: remove 5 from both sides, so x = 7. Now try a similar one yourself.`;
  }
  return `Good question. Let's connect it to ${context?.topic || "the current topic"} and work through it step by step.`;
}