export function detectMisconception({
  question = "",
  answer = "",
  correct = false,
  concept = "",
}) {
  if (correct) {
    return null;
  }

  const q = question.toLowerCase().trim();
  const a = answer.toLowerCase().trim();

  /*
   * Linear equation example:
   *
   * x + 5 = 12
   * Student: 17
   *
   * Likely misconception:
   * adding instead of applying inverse operation.
   */

  if (
    concept === "inverse_operations" &&
    q.includes("x + 5") &&
    a === "17"
  ) {
    return {
      type: "incorrect_inverse_operation",
      severity: "medium",
      recommended_intervention: "balance_model",
      explanation:
        "Student appears to add 5 instead of subtracting 5 from both sides.",
    };
  }

  /*
   * Fraction example.
   */

  if (
    concept === "equivalent_fractions" &&
    a === "1/4"
  ) {
    return {
      type: "fraction_equivalence_error",
      severity: "medium",
      recommended_intervention: "visual_fraction_model",
      explanation:
        "Student may be confusing numerator/denominator scaling.",
    };
  }

  /*
   * Generic fallback.
   */

  return {
    type: "conceptual_error",
    severity: "low",
    recommended_intervention: "worked_example",
    explanation:
      "The response was incorrect and requires additional concept-level analysis.",
  };
}