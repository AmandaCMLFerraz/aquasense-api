export function approximateFlowRate(record: {
  volumeLiters: number;
  startConsumption: Date;
  endConsumption: Date;
}): number {
  const durationMinutes =
    (record.endConsumption.getTime() - record.startConsumption.getTime()) /
    60000;

  if (durationMinutes <= 0) {
    return 0;
  }

  return Number((record.volumeLiters / durationMinutes).toFixed(2));
}

const CURRENT_FLOW_MAX_AGE_MS = 60 * 1000;

export function currentFlowRate(
  record: {
    volumeLiters: number;
    startConsumption: Date;
    endConsumption: Date;
  } | null,
): number {
  if (
    !record ||
    Date.now() - record.endConsumption.getTime() > CURRENT_FLOW_MAX_AGE_MS
  ) {
    return 0;
  }

  return approximateFlowRate(record);
}
