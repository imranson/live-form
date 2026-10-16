import { REQUIRED_TOPICS, TOPIC_IDS, type TopicId } from '../../shared/profile.js';

const WARM_UP: readonly TopicId[] = ['interests', 'environment', 'values', 'strengths'];
const REPEATABLE: readonly TopicId[] = ['interests', 'environment', 'strengths', 'values'];

/**
 * Which topics the agent may pick for the next question. The agent chooses the order,
 * but the planner guarantees the topics signposting depends on are always covered.
 */
export function allowedTopics(asked: readonly TopicId[], target: number): TopicId[] {
  if (asked.length === 0) return [...WARM_UP];
  const remainingSlots = target - asked.length;
  const requiredLeft = REQUIRED_TOPICS.filter((t) => !asked.includes(t));
  if (requiredLeft.length > 0 && requiredLeft.length >= remainingSlots) return requiredLeft;
  const unasked = TOPIC_IDS.filter((t) => !asked.includes(t));
  return unasked.length > 0 ? unasked : [...REPEATABLE];
}
