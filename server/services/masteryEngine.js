export function calculateMastery(attempts=[]) {
  if (!attempts.length) return 0;
  let weighted=0,total=0;
  for (const a of attempts) {
    const difficulty=Math.max(1,Number(a.difficulty)||1);
    const recency=Math.max(0.5, Math.min(1.5, Number(a.recency_weight)||1));
    const attemptPenalty=Math.max(0.65, 1 - Math.max(0,(Number(a.attempts)||1)-1)*0.08);
    const score=(a.correct?1:0)*difficulty*recency*attemptPenalty;
    weighted+=score; total+=difficulty*recency;
  }
  return total ? Math.max(0,Math.min(1,weighted/total)) : 0;
}