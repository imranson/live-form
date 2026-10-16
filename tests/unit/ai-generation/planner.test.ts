import { describe, expect, it } from 'vitest';
import { allowedTopics } from '../../../server/agent/planner.js';
import { REQUIRED_TOPICS, TOPIC_IDS, type TopicId } from '../../../shared/profile.js';

describe('topic planner', () => {
  it('opens with a fun, low-stakes discovery question', () => {
    expect(allowedTopics([], 8)).toEqual(['interests', 'environment', 'values', 'strengths']);
  });

  it('lets the agent choose any unasked topic while there is room', () => {
    const allowed = allowedTopics(['interests'], 8);
    expect(allowed).not.toContain('interests');
    expect(allowed).toEqual(expect.arrayContaining([...REQUIRED_TOPICS, 'environment']));
  });

  it('forces the required topics once the remaining slots run out', () => {
    expect(allowedTopics(['interests', 'environment', 'strengths', 'values'], 8)).toEqual([...REQUIRED_TOPICS]);
    expect(allowedTopics(['interests', 'environment', 'strengths', 'values', 'situation', 'age', 'practicalities'], 8)).toEqual(['learning', 'support']);
  });

  it('always covers every required topic, whatever order the agent picks', () => {
    for (const target of [5, 8, 12]) {
      const asked: TopicId[] = [];
      for (let i = 0; i < target; i++) {
        const allowed = allowedTopics(asked, target);
        // A "worst-case" agent that avoids required topics whenever it can.
        asked.push(allowed.find((t) => !REQUIRED_TOPICS.includes(t)) ?? allowed[0]);
      }
      expect(asked).toEqual(expect.arrayContaining([...REQUIRED_TOPICS]));
    }
  });

  it('allows discovery topics to repeat in long questionnaires', () => {
    expect(allowedTopics([...TOPIC_IDS], 12)).toEqual(['interests', 'environment', 'strengths', 'values']);
  });
});
