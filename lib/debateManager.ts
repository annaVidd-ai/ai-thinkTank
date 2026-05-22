import { prisma } from './prisma';
import { callLLM } from './llmClient';
import { ANALYST_CONFIG, SKEPTIC_CONFIG } from './llmConfig';
import {
  DebateTurnSchema,
  DebateFinalSchema,
  ANALYST_SYSTEM_PROMPT,
  SKEPTIC_SYSTEM_PROMPT,
  buildTranscript,
  buildAnalystUser,
  buildSkepticUser,
} from './prompts';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a new Debate row (storing narrativeContext for later scoring),
 * and queues the first DEBATE_ANALYST task.
 * Returns the new debate's id.
 */
export async function startDebate(
  clusterId:        string,
  narrativeContext: string = '',
): Promise<string> {
  const debate = await prisma.debate.create({
    data: { clusterId, status: 'IN_PROGRESS', currentRound: 1, narrativeContext },
  });

  await prisma.agentTask.create({
    data: {
      type:    'DEBATE_ANALYST',
      status:  'PENDING',
      payload: JSON.stringify({ debateId: debate.id, narrativeContext }),
    },
  });

  console.log(
    `[Debate] Started debate ${debate.id} for cluster "${clusterId}" (round 1)`,
  );
  return debate.id;
}

/**
 * Handles a DEBATE_ANALYST task turn.
 * Fetches the full prior transcript, calls DeepSeek-R1 for a bullish argument,
 * saves a DebateMessage, and queues DEBATE_SKEPTIC.
 */
export async function processAnalystTurn(debateId: string): Promise<void> {
  const debate = await prisma.debate.findUniqueOrThrow({
    where:   { id: debateId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  const round = debate.currentRound;

  // Build transcript from all messages prior to this round
  const priorMessages = debate.messages.filter((m) => m.round < round);
  const transcript    = buildTranscript(priorMessages);

  const user   = buildAnalystUser(round, transcript, debate.narrativeContext ?? '');
  const result = await callLLM(ANALYST_CONFIG, ANALYST_SYSTEM_PROMPT, user, DebateTurnSchema);

  await prisma.debateMessage.create({
    data: { debateId, role: 'ANALYST', content: JSON.stringify(result), round },
  });

  await prisma.agentTask.create({
    data: {
      type:    'DEBATE_SKEPTIC',
      status:  'PENDING',
      payload: JSON.stringify({ debateId }),
    },
  });

  console.log(`[Debate R${round}] ANALYST  → ${result.argument}`);
}

/**
 * Handles a DEBATE_SKEPTIC task turn.
 *
 * Rounds 1-2: calls DeepSeek-R1 with DebateTurnSchema, increments round, queues DEBATE_ANALYST.
 * Round 3   : calls DeepSeek-R1 with DebateFinalSchema, resolves the debate.
 *             If verdict === 'agreed' → status COMPLETED + injects SCORE task.
 *             Otherwise              → status ESCALATED.
 */
export async function processSkepticTurn(debateId: string): Promise<void> {
  const debate = await prisma.debate.findUniqueOrThrow({
    where:   { id: debateId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  const round = debate.currentRound;

  // Build transcript including the current round's analyst message
  const transcript = buildTranscript(debate.messages);

  const isFinal = round === 3;
  const user    = buildSkepticUser(round, transcript, debate.narrativeContext ?? '', isFinal);

  if (!isFinal) {
    // ── Rounds 1 & 2 ──────────────────────────────────────────────────────
    const result = await callLLM(SKEPTIC_CONFIG, SKEPTIC_SYSTEM_PROMPT, user, DebateTurnSchema);

    await prisma.debateMessage.create({
      data: { debateId, role: 'SKEPTIC', content: JSON.stringify(result), round },
    });

    await prisma.debate.update({
      where: { id: debateId },
      data:  { currentRound: { increment: 1 } },
    });

    await prisma.agentTask.create({
      data: {
        type:    'DEBATE_ANALYST',
        status:  'PENDING',
        payload: JSON.stringify({ debateId }),
      },
    });

    console.log(
      `[Debate R${round}] SKEPTIC  → ${result.argument}\n` +
      `[Debate] Advancing to round ${round + 1}…`,
    );
  } else {
    // ── Round 3 — structured final verdict ────────────────────────────────
    const finalSystemPrompt =
      SKEPTIC_SYSTEM_PROMPT +
      '\n\nThis is the FINAL round. Your JSON MUST include ' +
      '"verdict" ("agreed" or "deadlocked") and "finalThesis" (a short thesis string).';

    const result = await callLLM(SKEPTIC_CONFIG, finalSystemPrompt, user, DebateFinalSchema);

    await prisma.debateMessage.create({
      data: { debateId, role: 'SKEPTIC', content: JSON.stringify(result), round },
    });

    const isAgreed  = result.verdict === 'agreed';
    const newStatus = isAgreed ? 'COMPLETED' : 'ESCALATED';
    const verdict   = result.finalThesis;

    await prisma.debate.update({
      where: { id: debateId },
      data:  { status: newStatus, verdict },
    });

    // Always score — both COMPLETED and ESCALATED debates carry signal.
    // The thesis and verdict distinguish the confidence level downstream.
    await prisma.agentTask.create({
      data: {
        type:    'SCORE',
        status:  'PENDING',
        payload: JSON.stringify({ clusterId: debate.clusterId }),
      },
    });
    console.log(`[Debate] Injected SCORE task for cluster ${debate.clusterId}`);

    console.log(
      `[Debate R${round}] SKEPTIC  → ${result.argument}\n` +
      `[Debate] *** Debate ${newStatus}: verdict = "${verdict}" ***`,
    );
  }
}
