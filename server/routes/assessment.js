import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { detectMisconception } from "../services/misconceptionEngine.js";

export const assessmentRouter = Router();

assessmentRouter.post("/attempt", async (req, res) => {
  try {
    const {
      student_id,
      question_id,
      topic,
      concept,
      difficulty,
      answer,
      correct,
      time_taken,
      attempts,
      hints_used,
      answer_changed,
      question,
    } = req.body;

    if (!student_id) {
      return res.status(400).json({
        error: "student_id is required",
      });
    }

    const misconception = detectMisconception({
      question: question || "",
      answer: answer || "",
      correct,
      concept: concept || "",
    });

    const record = {
      student_id,
      question_id: question_id || null,
      topic: topic || null,
      concept: concept || null,
      difficulty: difficulty || 1,
      answer: answer || "",
      correct: Boolean(correct),
      time_taken_seconds: Number(time_taken || 0),
      attempts: Number(attempts || 1),
      hints_used: Number(hints_used || 0),
      answer_changed: Boolean(answer_changed),
      error_type: misconception?.type || null,
    };

    // Prototype fallback if Supabase isn't configured.
    if (!supabaseAdmin) {
      return res.json({
        ok: true,
        mode: "prototype",
        attempt: record,
        misconception,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("question_attempts")
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error("Supabase attempt error:", error);

      return res.status(500).json({
        error: error.message,
      });
    }

    // Save misconception when one is detected.
    if (misconception) {
      const { error: misconceptionError } =
        await supabaseAdmin
          .from("student_misconceptions")
          .insert({
            student_id,
            topic,
            concept,
            misconception_type: misconception.type,
            severity: misconception.severity,
            evidence: {
              question,
              answer,
            },
          });

      if (misconceptionError) {
        console.error(
          "Misconception save error:",
          misconceptionError
        );
      }
    }

    // Record the learning event.
    await supabaseAdmin
      .from("learning_events")
      .insert({
        student_id,
        event_type: correct
          ? "ANSWER_CORRECT"
          : "ANSWER_INCORRECT",
        topic,
        metadata: {
          question_id,
          concept,
          difficulty,
          time_taken,
          attempts,
          hints_used,
          misconception,
        },
      });

    return res.json({
      ok: true,
      mode: "supabase",
      attempt: data,
      misconception,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to save assessment attempt",
    });
  }
});