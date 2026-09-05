import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useVoice } from "../lib/useVoice";

export default function Ascora({ student = null }) {
  // ==================================================
  // ASCORA STATE
  // ==================================================

  const [connected, setConnected] = useState(true);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle");
  const [loading, setLoading] = useState(true);

  // ==================================================
  // VOICE STATE
  // ==================================================

  const {
    supported: voiceSupported,
    listening,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    speak,
    clearTranscript,
  } = useVoice();

  const [answer, setAnswer] = useState("");

  // ==================================================
  // DOUBT QUEUE STATE
  // ==================================================

  const [queue, setQueue] = useState([]);
  const [resolvedQueue, setResolvedQueue] = useState([]);
  const [myRequest, setMyRequest] = useState(null);

  const [queueLoading, setQueueLoading] = useState(true);
  const [raisingHand, setRaisingHand] = useState(false);
  const [resolving, setResolving] = useState(false);

  // BUG FIX: myRequest goes back to null as soon as loadQueue()
  // refreshes after a resolve (the resolved row is no longer in
  // the active waiting/serving set), which used to make the
  // "Doubt Resolved" UI disappear instantly. lastResolved tracks
  // that moment independently of myRequest so the confirmation
  // stays visible for a short delay before returning to idle.
  const [lastResolved, setLastResolved] = useState(false);

  const classroomId = "main-classroom";
  const studentId = student?.id;

  // ==================================================
  // BUG FIX: stable refs so effects don't need to
  // depend on possibly-unstable function identities
  // from useVoice, and so we always call the LATEST
  // version of these functions without re-running
  // effects every time they change identity.
  // ==================================================

  const speakRef = useRef(speak);
  const stopListeningRef = useRef(stopListening);
  const clearTranscriptRef = useRef(clearTranscript);

  useEffect(() => {
    speakRef.current = speak;
    stopListeningRef.current = stopListening;
    clearTranscriptRef.current = clearTranscript;
  });

  // ==================================================
  // BUG FIX: track whether the component is still
  // mounted so async Supabase calls (loadQueue,
  // raiseHand, lowerHand, resolveCurrentDoubt) never
  // call setState after unmount / studentId change.
  // ==================================================

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ==================================================
  // BUG FIX: track the transcript we've already
  // generated an answer for, so the doubt-processing
  // effect can't regenerate/re-speak the same answer
  // twice (which restarted the whole answering/resolve
  // flow) just because an unrelated dependency changed.
  // ==================================================

  const processedTranscriptRef = useRef("");

  // ==================================================
  // STUDENT NAME
  // ==================================================

  const studentName =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  // ==================================================
  // LOAD ASCORA STUDENT CONTEXT
  // ==================================================

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      if (!studentId) {
        setData({
          topic: "Linear Equations",
          mastery: 0.43,
          strategy: {
            pace: "slow",
            visual: true,
            guided_questions: true,
          },
        });

        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await apiFetch(
          `/api/ascora/student/${studentId}/context`
        );

        if (mounted) {
          setData(response);
          setConnected(true);
        }
      } catch (error) {
        console.error("ASCORA context error:", error);

        if (mounted) {
          setConnected(false);

          setData({
            topic: "Linear Equations",
            mastery: 0.43,
            strategy: {
              pace: "slow",
              visual: true,
              guided_questions: true,
            },
          });
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, [studentId]);

  // ==================================================
  // ASCORA ROBOT EVENTS
  // ==================================================

  async function handleEvent(type) {
    setState(type);

    if (!studentId) return;

    try {
      await apiFetch("/api/ascora/event", {
        method: "POST",
        body: JSON.stringify({
          student_id: studentId,
          event: type,
        }),
      });
    } catch (error) {
      console.error("ASCORA event error:", error);
    }
  }

  // ==================================================
  // LOAD DOUBT QUEUE
  // ==================================================

  async function loadQueue() {
    if (!studentId) {
      setQueue([]);
      setResolvedQueue([]);
      setMyRequest(null);
      setQueueLoading(false);
      return;
    }

    setQueueLoading(true);

    try {
      // ----------------------------------------------
      // ACTIVE QUEUE
      // ----------------------------------------------

      const {
        data: activeData,
        error: activeError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("classroom_id", classroomId)
        .in("status", ["waiting", "serving"])
        .order("raised_at", {
          ascending: true,
        });

      if (activeError) {
        throw activeError;
      }

      // BUG FIX: bail out if the component unmounted or
      // studentId changed while this request was in flight.
      if (!isMountedRef.current) return;

      const activeQueue = activeData || [];

      setQueue(activeQueue);

      // ----------------------------------------------
      // CURRENT STUDENT REQUEST
      // ----------------------------------------------

      const mine = activeQueue.find(
        (item) => item.student_id === studentId
      );

      setMyRequest(mine || null);

      // ----------------------------------------------
      // RESOLVED DOUBTS
      // ----------------------------------------------

      const {
        data: resolvedData,
        error: resolvedError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("classroom_id", classroomId)
        .eq("status", "resolved")
        .order("resolved_at", {
          ascending: false,
        })
        .limit(10);

      if (!isMountedRef.current) return;

      if (resolvedError) {
        console.error(
          "Resolved queue error:",
          resolvedError
        );
      } else {
        setResolvedQueue(resolvedData || []);
      }
    } catch (error) {
      console.error(
        "Queue loading error:",
        error
      );
    } finally {
      if (isMountedRef.current) {
        setQueueLoading(false);
      }
    }
  }

  // ==================================================
  // INITIAL QUEUE LOAD
  // ==================================================

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // ==================================================
  // REAL-TIME QUEUE UPDATES
  // ==================================================

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(`ascora-doubt-queue-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doubt_queue",
          filter: `classroom_id=eq.${classroomId}`,
        },
        () => {
          loadQueue();
        }
      )
      .subscribe((status) => {
        console.log(
          "ASCORA queue realtime:",
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // ==================================================
  // SERVING STUDENT DETECTION
  // ==================================================

  useEffect(() => {
    if (myRequest?.status === "serving") {
      setState("serving");
      setAnswer("");
      setLastResolved(false);
      clearTranscriptRef.current();

      // BUG FIX: reset the "already answered" tracker
      // whenever a NEW serving session starts, so a
      // repeated doubt in a later turn isn't ignored.
      processedTranscriptRef.current = "";
    } else {
      stopListeningRef.current();
    }
  }, [myRequest?.status]);

  // ==================================================
  // START MICROPHONE
  // ==================================================

  function handleStartSpeaking() {
    if (!voiceSupported) {
      setState("error");
      return;
    }

    setAnswer("");
    clearTranscript();

    // BUG FIX: reset the processed-transcript tracker so
    // a fresh recording (even with identical wording) is
    // still processed instead of being skipped as a dup.
    processedTranscriptRef.current = "";

    setState("listening");

    startListening();
  }

  // ==================================================
  // PROCESS STUDENT DOUBT
  // ==================================================

  useEffect(() => {
    const doubt = transcript.trim();

    if (!doubt) return;

    if (myRequest?.status !== "serving") {
      return;
    }

    if (listening) {
      return;
    }

    // BUG FIX: don't regenerate/re-speak an answer for a
    // transcript we've already processed. Previously this
    // effect had no such guard, so any change to `speak`'s
    // identity (or other deps) while the transcript was
    // still in state would silently restart the whole
    // thinking -> answering -> auto-resolve flow.
    if (doubt === processedTranscriptRef.current) {
      return;
    }

    processedTranscriptRef.current = doubt;

    console.log(
      "ASCORA received doubt:",
      doubt
    );

    setState("thinking");

    // BUG FIX: the adaptive answer now comes from the backend
    // (which adapts to mastery/pace/etc via the AI provider
    // abstraction) instead of a hardcoded template, and ASCORA
    // no longer resolves on a fixed timer - it waits for the
    // actual answer, then the actual end of TTS playback.
    let cancelled = false;

    async function thinkSpeakAndResolve() {
      let generatedAnswer = null;

      try {
        const response = await apiFetch(
          "/api/ascora/answer",
          {
            method: "POST",
            body: JSON.stringify({
              doubt,
              student_context: {
                topic: data?.topic,
                mastery: data?.mastery,
                pace: data?.strategy?.pace,
                visual: data?.strategy?.visual,
                guided_questions:
                  data?.strategy?.guided_questions,
              },
            }),
          }
        );

        generatedAnswer = response?.answer;
      } catch (error) {
        console.error(
          "ASCORA answer error:",
          error
        );
      }

      if (cancelled || !isMountedRef.current) return;

      if (!generatedAnswer) {
        // BUG FIX: if the AI backend is unreachable, don't
        // silently lose the student's request - fall back to
        // a short, honest message and still complete the loop.
        generatedAnswer =
          "I'm having trouble reaching my thinking engine " +
          "right now, but I've noted your doubt. Please ask " +
          "your teacher, or try again in a moment.";
      }

      setAnswer(generatedAnswer);
      setState("answering");

      try {
        await speakRef.current(generatedAnswer);
      } catch (error) {
        // BUG FIX: speak() itself is designed not to throw
        // (see useVoice.js), but guard anyway so a resolve
        // still happens even if TTS misbehaves.
        console.error(
          "ASCORA speak error:",
          error
        );
      }

      if (cancelled || !isMountedRef.current) return;

      resolveCurrentDoubtRef.current();
    }

    thinkSpeakAndResolve();

    return () => {
      cancelled = true;
    };
  }, [
    transcript,
    listening,
    myRequest?.status,
    data?.topic,
    data?.mastery,
    data?.strategy?.pace,
    data?.strategy?.visual,
    data?.strategy?.guided_questions,
  ]);

  // ==================================================
  // RESOLVE CURRENT DOUBT
  // ==================================================

  async function resolveCurrentDoubt() {
    if (!myRequest?.id) {
      return;
    }

    if (resolving) {
      return;
    }

    setResolving(true);

    try {
      stopListeningRef.current();

      /*
       * Mark the currently served request
       * as RESOLVED.
       */

      const {
        data: resolvedRequest,
        error,
      } = await supabase.rpc(
        "resolve_doubt",
        {
          p_request_id: myRequest.id,
        }
      );

      if (error) {
        throw error;
      }

      // BUG FIX: bail if unmounted/stale before touching state.
      if (!isMountedRef.current) return;

      console.log(
        "ASCORA resolved request:",
        resolvedRequest
      );

      setState("resolved");

      // BUG FIX: set this BEFORE loadQueue() runs, so the
      // "Doubt Resolved" confirmation keeps rendering even once
      // loadQueue() clears myRequest to null.
      setLastResolved(true);

      /*
       * Clear the current student's local
       * voice state.
       */

      setAnswer("");
      clearTranscriptRef.current();
      processedTranscriptRef.current = "";

      /*
       * Refresh queue immediately.
       */

      await loadQueue();

      if (!isMountedRef.current) return;

      /*
       * Small delay so the RESOLVED state
       * stays visible before returning to idle.
       */

      setTimeout(() => {
        if (isMountedRef.current) {
          setState("idle");
          setLastResolved(false);
        }
      }, 1500);
    } catch (error) {
      console.error(
        "Resolve doubt error:",
        error
      );

      if (isMountedRef.current) {
        alert(
          "Unable to resolve this doubt. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setResolving(false);
      }
    }
  }

  // ==================================================
  // BUG FIX: ref to always call the latest
  // resolveCurrentDoubt from the timer below without
  // needing to add it (an unmemoized function that's
  // recreated every render) to the effect's deps.
  // ==================================================

  const resolveCurrentDoubtRef = useRef(resolveCurrentDoubt);
  resolveCurrentDoubtRef.current = resolveCurrentDoubt;

  // ==================================================
  // RAISE HAND
  // ==================================================

  async function raiseHand() {
    if (!studentId) {
      alert(
        "Please log in before raising your hand."
      );
      return;
    }

    if (myRequest) {
      return;
    }

    setRaisingHand(true);

    try {
      // ----------------------------------------------
      // CHECK EXISTING ACTIVE REQUEST
      // ----------------------------------------------

      const {
        data: existingRequest,
        error: existingError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("student_id", studentId)
        .eq("classroom_id", classroomId)
        .in("status", ["waiting", "serving"])
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (!isMountedRef.current) return;

      if (existingRequest) {
        setMyRequest(existingRequest);
        await loadQueue();
        return;
      }

      // ----------------------------------------------
      // CREATE NEW REQUEST
      // ----------------------------------------------

      const {
        data: newRequest,
        error,
      } = await supabase
        .from("doubt_queue")
        .insert({
          student_id: studentId,
          classroom_id: classroomId,
          status: "waiting",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) return;

      console.log(
        "Doubt raised:",
        newRequest
      );

      setMyRequest(newRequest);
      setLastResolved(false);

      await loadQueue();
    } catch (error) {
      console.error(
        "Raise hand error:",
        error
      );

      // BUG FIX: a duplicate active request (partial unique
      // index on doubt_queue) means someone/something already
      // raised this student's hand - recover gracefully by
      // reloading the queue instead of leaving them stuck.
      const isDuplicate =
        error?.code === "23505" ||
        /duplicate|already/i.test(
          error?.message || ""
        );

      if (isDuplicate) {
        await loadQueue();
      } else if (isMountedRef.current) {
        alert(
          "Unable to raise your hand. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setRaisingHand(false);
      }
    }
  }

  // ==================================================
  // LOWER HAND
  // ==================================================

  async function lowerHand() {
    if (!myRequest?.id) {
      return;
    }

    try {
      stopListeningRef.current();

      const { error } = await supabase
        .from("doubt_queue")
        .update({
          status: "cancelled",
        })
        .eq("id", myRequest.id)
        .eq("student_id", studentId);

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) return;

      setMyRequest(null);
      setAnswer("");
      setLastResolved(false);
      clearTranscriptRef.current();
      processedTranscriptRef.current = "";
      setState("idle");

      await loadQueue();
    } catch (error) {
      console.error(
        "Lower hand error:",
        error
      );

      if (isMountedRef.current) {
        alert(
          "Unable to lower your hand. Please try again."
        );
      }
    }
  }

  // ==================================================
  // QUEUE POSITION
  // ==================================================

  // BUG FIX: fall back to null instead of showing "#0"
  // when the request isn't found in the current queue
  // snapshot yet (e.g. right after raising a hand, before
  // the realtime refresh lands).
  const myRequestIndex =
    myRequest?.status === "waiting"
      ? queue.findIndex(
          (item) => item.id === myRequest.id
        )
      : -1;

  const myPosition =
    myRequestIndex >= 0 ? myRequestIndex + 1 : null;

  // ==================================================
  // CURRENT SERVING STUDENT
  // ==================================================

  const servingStudent = queue.find(
    (item) =>
      item.status === "serving"
  );

  // ==================================================
  // IS CURRENT STUDENT BEING SERVED?
  // ==================================================

  const isMyTurn =
    myRequest?.status === "serving";

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="grid grid-2">

      {/* =================================================
          ASCORA ROBOT CARD
      ================================================== */}

      <div
        className="card"
        style={{
          textAlign: "center",
        }}
      >
        <div className="avatar">
          {connected ? "✦" : "!"}
        </div>

        <h1>ASCORA</h1>

        <span className="pill">
          {connected
            ? "● Connected"
            : "○ Offline Mode"}
        </span>

        <p
          className="muted"
          style={{
            marginTop: 12,
          }}
        >
          Robot state:{" "}
          <strong>
            {state}
          </strong>
        </p>

        <p className="muted">
          Student: {studentName}
        </p>

        {/* MICROPHONE INDICATOR */}

        {isMyTurn && (
          <div
            className="item"
            style={{
              marginTop: 16,
            }}
          >
            <strong>
              🎤 Your turn
            </strong>

            <p className="muted">
              ASCORA is currently serving you.
            </p>
          </div>
        )}

        <div
          className="row"
          style={{
            justifyContent: "center",
            marginTop: 20,
          }}
        >
          <button
            className="btn"
            onClick={() =>
              handleEvent("listening")
            }
          >
            🎤 Listen
          </button>

          <button
            className="btn secondary"
            onClick={() =>
              handleEvent("thinking")
            }
          >
            🧠 Think
          </button>

          <button
            className="btn success"
            onClick={() =>
              handleEvent("explaining")
            }
          >
            ✦ Teach
          </button>
        </div>
      </div>

      {/* =================================================
          CURRENT STUDENT CONTEXT
      ================================================== */}

      <div className="card">
        <h2>
          Current student context
        </h2>

        {loading ? (
          <p className="muted">
            ASCORA is loading the student's
            learning context...
          </p>
        ) : data ? (
          <div className="list">

            <div className="item">
              <strong>Topic:</strong>{" "}
              {data.topic ||
                "Linear Equations"}
            </div>

            <div className="item">
              <strong>Mastery:</strong>{" "}
              {Math.round(
                Number(
                  data.mastery || 0
                ) * 100
              )}
              %
            </div>

            <div className="item">
              <strong>Pace:</strong>{" "}
              {data.strategy?.pace ||
                "Adaptive"}
            </div>

            <div className="item">
              <strong>
                Visual support:
              </strong>{" "}
              {data.strategy?.visual
                ? "High"
                : "Standard"}
            </div>

            <div className="item">
              <strong>
                Guided questions:
              </strong>{" "}
              {data.strategy
                ?.guided_questions
                ? "Enabled"
                : "Off"}
            </div>

          </div>
        ) : (
          <p className="muted">
            No learning context available yet.
          </p>
        )}
      </div>

      {/* =================================================
          NEED HELP / DOUBT QUEUE
      ================================================== */}

      <div className="card">

        <div
          className="row"
          style={{
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              style={{
                marginBottom: 4,
              }}
            >
              🙋 Need Help?
            </h2>

            <p className="muted">
              Raise your hand and ASCORA
              will serve students in queue order.
            </p>
          </div>
        </div>

        {/* ---------------------------------------------
            NO ACTIVE REQUEST
        ---------------------------------------------- */}

        {/* BUG FIX: this no longer depends on myRequest staying
            truthy - lastResolved keeps the confirmation visible
            for a short delay even after loadQueue() has already
            cleared myRequest to null. */}

        {!myRequest && lastResolved && (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >
            <strong>
              ✅ Doubt Resolved
            </strong>

            <p className="muted">
              ASCORA has answered your doubt.
              The next student can now be served.
            </p>
          </div>
        )}

        {!myRequest && !lastResolved && (
          <div
            style={{
              marginTop: 20,
            }}
          >
            <button
              className="btn"
              onClick={raiseHand}
              disabled={raisingHand}
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "16px",
              }}
            >
              {raisingHand
                ? "Raising Hand..."
                : "🙋 Raise Hand"}
            </button>
          </div>
        )}

        {/* ---------------------------------------------
            CURRENT STUDENT REQUEST
        ---------------------------------------------- */}

        {myRequest && (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >

            {/* =========================================
                MY TURN
            ========================================== */}

            {myRequest.status ===
              "serving" && (
              <>
                <h3>
                  🎤 ASCORA is serving you
                </h3>

                <p className="muted">
                  You are the current student.
                  Tell ASCORA your doubt.
                </p>

                {/* MICROPHONE */}

                {voiceSupported ? (
                  <button
                    className="btn"
                    onClick={
                      listening
                        ? stopListening
                        : handleStartSpeaking
                    }
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "14px",
                      fontSize: "16px",
                    }}
                  >
                    {listening
                      ? "⏹ Stop Listening"
                      : "🎤 Start Speaking"}
                  </button>
                ) : (
                  <p className="muted">
                    Voice input is not supported
                    in this browser.
                  </p>
                )}

                {/* LISTENING STATUS */}

                {listening && (
                  <p
                    style={{
                      marginTop: 12,
                      fontWeight: "bold",
                    }}
                  >
                    🔴 ASCORA is listening...
                  </p>
                )}

                {/* VOICE ERROR */}

                {voiceError && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                      textAlign: "left",
                    }}
                  >
                    <strong>
                      ⚠️ Voice error
                    </strong>

                    <p className="muted">
                      {voiceError}
                    </p>
                  </div>
                )}

                {/* TRANSCRIPT */}

                {transcript && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                      textAlign: "left",
                    }}
                  >
                    <strong>
                      📝 Your doubt
                    </strong>

                    <p
                      style={{
                        marginTop: 8,
                      }}
                    >
                      {transcript}
                    </p>
                  </div>
                )}

                {/* THINKING */}

                {state === "thinking" && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    🧠 ASCORA is thinking...
                  </p>
                )}

                {/* ANSWER */}

                {answer && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                      textAlign: "left",
                    }}
                  >
                    <strong>
                      🤖 ASCORA
                    </strong>

                    <p
                      style={{
                        marginTop: 8,
                      }}
                    >
                      {answer}
                    </p>
                  </div>
                )}

                {/* ANSWERING */}

                {state === "answering" && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    🔊 ASCORA is answering...
                  </p>
                )}

                {/* RESOLVED */}

                {state === "resolved" && (
                  <div
                    className="item"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    <strong>
                      ✅ Doubt Resolved
                    </strong>

                    <p className="muted">
                      ASCORA has answered your doubt.
                      The next student can now be served.
                    </p>
                  </div>
                )}

                {/* MANUAL RESOLVE FALLBACK */}

                {answer &&
                  state === "answering" && (
                    <button
                      className="btn success"
                      onClick={
                        resolveCurrentDoubt
                      }
                      disabled={resolving}
                      style={{
                        width: "100%",
                        marginTop: 12,
                      }}
                    >
                      {resolving
                        ? "Resolving..."
                        : "✅ Mark Doubt Resolved"}
                    </button>
                  )}
              </>
            )}

            {/* =========================================
                WAITING
            ========================================== */}

            {myRequest.status ===
              "waiting" && (
              <>
                <h3>
                  🙋 Hand Raised
                </h3>

                <p
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    margin: "10px 0",
                  }}
                >
                  {myPosition
                    ? `#${myPosition}`
                    : "—"}
                </p>

                <p className="muted">
                  You are in the queue.
                  ASCORA will serve students
                  in the order they raised their hands.
                </p>
              </>
            )}

            {/* LOWER HAND */}

            {myRequest.status !==
              "resolved" && (
              <button
                className="btn secondary"
                onClick={lowerHand}
                style={{
                  marginTop: 12,
                }}
                disabled={resolving}
              >
                Lower Hand
              </button>
            )}

          </div>
        )}
      </div>

      {/* =================================================
          LIVE CLASSROOM QUEUE
      ================================================== */}

      <div className="card">

        <div
          className="row"
          style={{
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2>
              Live Doubt Queue
            </h2>

            <p className="muted">
              Students are served first-come,
              first-served.
            </p>
          </div>

          <span className="pill">
            {queue.length}{" "}
            {queue.length === 1
              ? "student"
              : "students"}
          </span>
        </div>

        {/* LOADING */}

        {queueLoading ? (
          <p
            className="muted"
            style={{
              marginTop: 20,
            }}
          >
            Loading classroom queue...
          </p>
        ) : queue.length === 0 ? (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "30px",
              }}
            >
              🙌
            </p>

            <strong>
              No students waiting
            </strong>

            <p className="muted">
              ASCORA is available for doubts.
            </p>
          </div>
        ) : (
          <div
            className="list"
            style={{
              marginTop: 20,
            }}
          >
            {queue.map(
              (item, index) => {

                const isMe =
                  item.student_id ===
                  studentId;

                const isServing =
                  item.status ===
                  "serving";

                return (
                  <div
                    className="item"
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {isMe
                          ? "You"
                          : `Student ${
                              index + 1
                            }`}
                      </strong>

                      <p
                        className="muted"
                        style={{
                          margin:
                            "4px 0 0",
                        }}
                      >
                        {isServing
                          ? "ASCORA is serving"
                          : `Queue position #${
                              index + 1
                            }`}
                      </p>
                    </div>

                    <span className="pill">
                      {isServing
                        ? "🎤 Serving"
                        : `#${index + 1}`}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* CURRENT SERVING */}

        {servingStudent && (
          <div
            className="item"
            style={{
              marginTop: 16,
              textAlign: "center",
            }}
          >
            <strong>
              🎤 ASCORA is currently helping
              one student
            </strong>

            <p className="muted">
              The microphone is available only
              to the student currently being served.
            </p>

            {servingStudent.student_id ===
              studentId && (
              <p
                style={{
                  marginTop: 8,
                  fontWeight: "bold",
                }}
              >
                🎤 It is your turn!
              </p>
            )}
          </div>
        )}
      </div>

      {/* =================================================
          RESOLVED DOUBTS
      ================================================== */}

      <div className="card">

        <div
          className="row"
          style={{
            justifyContent:
              "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2>
              Resolved Doubts
            </h2>

            <p className="muted">
              Recently completed ASCORA sessions.
            </p>
          </div>

          <span className="pill">
            {resolvedQueue.length} resolved
          </span>
        </div>

        {resolvedQueue.length === 0 ? (
          <div
            className="item"
            style={{
              marginTop: 20,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: "28px",
              }}
            >
              📚
            </p>

            <strong>
              No resolved doubts yet
            </strong>

            <p className="muted">
              Completed sessions will appear here.
            </p>
          </div>
        ) : (
          <div
            className="list"
            style={{
              marginTop: 20,
            }}
          >
            {resolvedQueue.map(
              (item) => {

                const isMe =
                  item.student_id ===
                  studentId;

                return (
                  <div
                    className="item"
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div>
                      <strong>
                        {isMe
                          ? "You"
                          : "Student"}
                      </strong>

                      <p
                        className="muted"
                        style={{
                          marginTop: 4,
                        }}
                      >
                        Doubt successfully answered
                      </p>
                    </div>

                    <span className="pill">
                      ✅ Resolved
                    </span>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* =================================================
          ASCORA ADAPTIVE LOOP
      ================================================== */}

      <div className="card">

        <h2>
          ASCORA adaptive loop
        </h2>

        <div className="grid grid-3">

          <div className="item">
            <strong>
              01 · Observe
            </strong>

            <p className="muted">
              ASCORA receives assessment and
              interaction signals from the student.
            </p>
          </div>

          <div className="item">
            <strong>
              02 · Adapt
            </strong>

            <p className="muted">
              The learning strategy changes based
              on mastery, errors and learning
              behaviour.
            </p>
          </div>

          <div className="item">
            <strong>
              03 · Teach
            </strong>

            <p className="muted">
              The robot delivers the next explanation
              using the selected teaching strategy.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}