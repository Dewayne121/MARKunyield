export const COMPETITIVE_LIFTS = [
  {
    id: 'bench_press',
    label: 'Bench Press',
    aliases: ['bench_press', 'bench press'],
  },
  {
    id: 'deadlift',
    label: 'Deadlift',
    aliases: ['deadlift'],
  },
  {
    id: 'squat',
    label: 'Squat',
    aliases: ['squat'],
  },
];

const normalize = (value) => String(value || '').trim().toLowerCase();

export const resolveCompetitiveLiftId = (value) => {
  const normalized = normalize(value);
  if (!normalized) return null;

  for (const lift of COMPETITIVE_LIFTS) {
    if (lift.aliases.some((alias) => normalize(alias) === normalized)) {
      return lift.id;
    }
  }

  return null;
};

export const getCompetitiveLiftLabel = (value) => {
  const id = resolveCompetitiveLiftId(value);
  if (!id) return null;
  const lift = COMPETITIVE_LIFTS.find((item) => item.id === id);
  return lift?.label || null;
};
