import test from 'node:test';
import assert from 'node:assert/strict';
import { compareDailyComboTasks } from '../../src/domain/chores/daily-combo';

test('daily combo task order is independent of Firestore collection order', () => {
  const tasks = [
    { id: 'task_c', title: 'C', gems: 3 },
    { id: 'task_a', title: 'A', gems: 1 },
    { id: 'task_d', title: 'D', gems: 4 },
    { id: 'task_b', title: 'B', gems: 2 },
  ];
  const first = [...tasks].sort(compareDailyComboTasks).map(task => task.id);
  const second = [...tasks].reverse().sort(compareDailyComboTasks).map(task => task.id);
  assert.deepEqual(second, first);
});
