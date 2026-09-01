import { Router } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { generateStrategy } from "../services/adaptiveEngine.js";

export const ascoraRouter = Router();

ascoraRouter.get(
  "/student/:id/context",
  async (req, res) => {
    try {
      const studentId = req.params.id;

      if (!supabaseAdmin) {
        const profile = {
          weak_topics: ["Linear Equations"],
          mastery: 0.43,
          pace: "slow",
          visual_support: true,
          misconceptions: [
            "incorrect_inverse_operation",
          ],
        };

        return res.json({
          student_id: studentId,
          topic: "Linear Equations",
          mastery: profile.mastery,
          strategy: generateStrategy(profile),
        });
      }

      const response = await fetch(
        `http://localhost:${process.env.PORT || 3001}/api/student/${studentId}/profile`
      );

      const data = await response.json();

      const weakTopic =
        data.profile?.weak_topics?.[0] ||
        "Current Topic";

      res.json({
        student_id: studentId,
        topic: weakTopic,
        mastery:
          data.profile?.mastery?.[weakTopic]
            ?.mastery || 0,

        strategy: data.strategy,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error:
          "Unable to load ASCORA context",
      });
    }
  }
);

ascoraRouter.post("/event", async (req, res) => {
  try {
    const {
      student_id,
      event,
    } = req.body;

    if (
      supabaseAdmin &&
      student_id
    ) {
      await supabaseAdmin
        .from("learning_events")
        .insert({
          student_id,
          event_type:
            String(event || "ASCORA_EVENT")
              .toUpperCase(),
          metadata: {
            source: "ascora",
          },
        });
    }

    res.json({
      ok: true,
      event,
      event_time:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to record ASCORA event",
    });
  }
});