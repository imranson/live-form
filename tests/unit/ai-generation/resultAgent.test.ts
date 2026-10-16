import { describe, expect, it } from 'vitest';
import { ResultAgent, fallbackNarrative, parseNarrative } from '../../../server/agent/resultAgent.js';
import { NARRATIVE_SYSTEM_PROMPT, buildNarrativeMessages } from '../../../server/agent/prompts.js';
import { buildProgress } from '../../../shared/game.js';
import { AI_NARRATIVE, FakeLlm, bankAnswer, silentLogger } from '../../helpers.js';

const answers = [bankAnswer('environment', 1), bankAnswer('strengths', [0, 3], 2), bankAnswer('situation', 0, 3), bankAnswer('support', [0], 4)];
const progress = buildProgress(answers, 4, true);

describe('result narrative', () => {
  it('rejects narratives that contain links (links only come from the curated catalogue)', () => {
    expect(() => parseNarrative({ ...AI_NARRATIVE, nextSteps: ['Visit www.example.com'] })).toThrow(/links/);
    expect(() => parseNarrative({ ...AI_NARRATIVE, summary: 'See https://x.y' })).toThrow(/links/);
    expect(parseNarrative(AI_NARRATIVE).headline).toBe(AI_NARRATIVE.headline);
  });

  it('briefs the model with answers, top sectors and the exact signpost titles', () => {
    const agent = new ResultAgent(null, silentLogger);
    return agent.build(answers, progress).then((result) => {
      const [system, user] = buildNarrativeMessages(answers, result.topSectors, result.tags, result.signposts);
      expect(system.content).toBe(NARRATIVE_SYSTEM_PROMPT);
      expect(user.content).toContain('Health & Social Care');
      expect(user.content).toContain('Supported Employment Service');
      expect(user.content).toContain('Out of work and looking');
    });
  });

  it('builds a template narrative from the person’s own strengths and top signposts', async () => {
    const result = await new ResultAgent(null, silentLogger).build(answers, progress);
    const n = fallbackNarrative(answers, result.topSectors, result.signposts);
    expect(n.headline).toContain('Health & Social Care');
    expect(n.strengths).toEqual(['Being patient and a good listener', 'Staying calm under pressure']);
    expect(n.nextSteps).toHaveLength(3);
  });
});

describe('ResultAgent', () => {
  it('combines deterministic matches and signposts with an AI-written narrative', async () => {
    const llm = new FakeLlm(() => AI_NARRATIVE);
    const result = await new ResultAgent(llm, silentLogger).build(answers, progress);
    expect(result.narrativeSource).toBe('ai');
    expect(result.narrative).toEqual(AI_NARRATIVE);
    expect(result.topSectors).toHaveLength(3);
    expect(result.topSectors[0].sector.id).toBe('health-social-care');
    expect(result.signposts.map((s) => s.resource.id)).toEqual(expect.arrayContaining(['careToJoinUs', 'supportedEmployment', 'jobHelp', 'councilJobsHub']));
    expect(result.tags.sort()).toEqual(['need:health', 'status:unemployed']);
  });

  it('uses the template narrative when the AI fails', async () => {
    const llm = new FakeLlm(() => ({ headline: 'Missing the rest' }));
    const result = await new ResultAgent(llm, silentLogger).build(answers, progress);
    expect(result.narrativeSource).toBe('fallback');
    expect(result.narrative.summary).toMatch(/hardest to fill/);
  });
});
