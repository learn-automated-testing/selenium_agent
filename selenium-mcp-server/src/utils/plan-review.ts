/**
 * Test plan review: the generator only works from a plan a person has approved.
 *
 * planner_save_plan marks every plan it saves as a draft. After the user has read it, planner_approve_plan
 * (or the user, by editing the line) marks it approved. generator_setup_page, generator_read_spec and
 * generator_write_test refuse a draft plan: tests generated from an unreviewed plan test the wrong things.
 * Plans without a status line (written by hand) are accepted, with a note.
 */

export type PlanStatus = 'draft' | 'approved' | 'changes requested';

/** `**Status:** draft`, `Status: approved — ...`, with or without bold or a leading "> ". */
const STATUS_LINE = /^[ \t]*(?:>[ \t]*)?\*{0,2}Status:?\*{0,2}[ \t]*:?[ \t]*\*{0,2}(draft|approved|changes requested)\b.*$/im;

/**
 * The review is on by default. SELENIUM_MCP_PLAN_REVIEW=off (or the --no-plan-review flag) turns the check off,
 * for teams that want speed: plans are still saved as drafts and can still be reviewed, but the generator no
 * longer waits for an approval.
 */
export function planReviewRequired(): boolean {
  const v = (process.env.SELENIUM_MCP_PLAN_REVIEW ?? '').trim().toLowerCase();
  return !['off', 'false', '0', 'no', 'skip'].includes(v);
}

export const DRAFT_NOTE =
  'review this plan, then change "draft" to "approved" here (or tell the agent you approve it). ' +
  'Tests are only generated from an approved plan.';

/**
 * Is this Markdown a test plan? A folder named specs/ often holds other documents too (API specs, design notes,
 * unit test specs). Only files with a review status line or the plan layout ("## Test Scenarios") count as plans.
 */
export function isPlanMarkdown(content: string): boolean {
  return STATUS_LINE.test(content) || /^#{2,3}[ \t]+Test Scenarios\b/im.test(content);
}

export function planStatus(content: string): PlanStatus | null {
  const m = STATUS_LINE.exec(content);
  return m ? (m[1].toLowerCase().replace(/\s+/g, ' ') as PlanStatus) : null;
}

function statusLine(status: PlanStatus, note: string): string {
  return `**Status:** ${status} — ${note}`;
}

/** Set the status line: replace an existing one, else put it under the first heading (or at the top). */
export function withPlanStatus(content: string, status: PlanStatus, note = status === 'draft' ? DRAFT_NOTE : ''): string {
  const line = statusLine(status, note).replace(/ — $/, '');
  if (STATUS_LINE.test(content)) return content.replace(STATUS_LINE, line);
  const lines = content.split('\n');
  const h1 = lines.findIndex(l => /^#\s/.test(l));
  if (h1 === -1) return `${line}\n\n${content}`;
  lines.splice(h1 + 1, 0, '', line);
  return lines.join('\n');
}

export interface PlanCheck {
  ok: boolean;
  status: PlanStatus | null;
  /** Why the plan was refused, or a note for a plan without a status. */
  message?: string;
}

/**
 * May tests be generated from this plan? A draft is refused unless the user explicitly skipped the review.
 */
export function checkPlanApproved(content: string, where: string, skipPlanReview = false): PlanCheck {
  const status = planStatus(content);
  if (status === 'approved') return { ok: true, status };
  if ((status === 'draft' || status === 'changes requested') && !planReviewRequired()) {
    return { ok: true, status, message: `The plan ${where} is not approved, but the plan review is turned off (SELENIUM_MCP_PLAN_REVIEW=off).` };
  }
  if (status === 'changes requested') {
    return {
      ok: false,
      status,
      message:
        `The user asked for changes to the test plan ${where} (see its "Review comments"): no tests are generated from it.\n` +
        'Change the plan as the comments ask, save it with planner_save_plan and let the user review it again ' +
        '(planner_review_plan opens the review page).',
    };
  }
  if (status === 'draft') {
    if (skipPlanReview) {
      return { ok: true, status, message: `The plan ${where} is still a draft; the review was skipped because the user asked for it.` };
    }
    return {
      ok: false,
      status,
      message:
        `The test plan ${where} is a draft: nobody has approved it yet, so no tests are generated from it.\n` +
        'Show the plan to the user and ask them to review it: planner_review_plan opens it as a page in their browser with ' +
        'Approve and Request changes buttons. When they approve it in the chat instead, call planner_approve_plan with their ' +
        'words (or they change "Status: draft" to "Status: approved" in the file), then try again.\n' +
        'Only if the user explicitly says to skip the review, pass skipPlanReview: true.',
    };
  }
  return { ok: true, status, message: `The plan ${where} has no review status (written by hand?): make sure the user has reviewed it.` };
}

/** True when the text looks like a path to a Markdown plan rather than the plan itself. */
export function looksLikePlanPath(text: string): boolean {
  const t = text.trim();
  return !t.includes('\n') && t.length < 400 && /\.(md|markdown|txt)$/i.test(t);
}

export interface ReviewComment {
  /** The test it is about, e.g. "1.2 Wrong password"; empty for a comment on the whole plan. */
  test?: string;
  text: string;
}

const COMMENTS_HEADING = '## Review comments';

/**
 * Record a "request changes" review: the status becomes "changes requested" and the comments go into a
 * "Review comments" section at the end (replacing the previous review's comments).
 */
export function withReviewComments(content: string, comments: ReviewComment[], when: string): string {
  const kept = content.includes(COMMENTS_HEADING) ? content.slice(0, content.indexOf(COMMENTS_HEADING)).trimEnd() : content.trimEnd();
  const lines = comments
    .filter(c => c.text.trim())
    .map(c => `- ${c.test ? `**${c.test.replace(/\s+/g, ' ').trim()}:** ` : ''}${c.text.replace(/\s+/g, ' ').trim()}`);
  const body = `${kept}\n\n${COMMENTS_HEADING}\n\nRequested on ${when} UTC:\n\n${lines.join('\n')}\n`;
  return withPlanStatus(body, 'changes requested', `the user asked for changes on ${when} UTC: see "Review comments" below`);
}
