import { HOOK_BASE_LENGTH, PIVOT, STAGE, SWING } from './config.js';

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y);
  return length > 0
    ? { x: vector.x / length, y: vector.y / length }
    : { x: 0, y: 1 };
}

export function angleToDirection(angle) {
  return { x: Math.sin(angle), y: Math.cos(angle) };
}

export function directionToAngle(direction) {
  return Math.atan2(direction.x, direction.y);
}

export function directionToTarget(target, pivot = PIVOT) {
  return normalize({ x: target.x - pivot.x, y: target.y - pivot.y });
}

export function distanceToStageEdge(direction, pivot = PIVOT, stage = STAGE, margin = 6) {
  const candidates = [];
  if (direction.x > 0) candidates.push((stage.width - margin - pivot.x) / direction.x);
  if (direction.x < 0) candidates.push((margin - pivot.x) / direction.x);
  if (direction.y > 0) candidates.push((stage.height - margin - pivot.y) / direction.y);
  return Math.min(...candidates.filter(value => value > 0));
}

export function projectAim(target, pivot = PIVOT, amplitude = SWING.amplitude, stage = STAGE) {
  const rawDirection = directionToTarget(target, pivot);
  const rawAngle = directionToAngle(rawDirection);
  const angle = clamp(rawAngle, -amplitude, amplitude);
  const direction = angleToDirection(angle);
  const requestedDistance = Math.hypot(target.x - pivot.x, target.y - pivot.y);
  const edgeDistance = distanceToStageEdge(direction, pivot, stage, 8);
  const distance = clamp(requestedDistance, HOOK_BASE_LENGTH + 10, edgeDistance);
  return {
    x: pivot.x + direction.x * distance,
    y: pivot.y + direction.y * distance,
    angle,
    direction,
    distance,
    projected: Math.abs(rawAngle - angle) > 1e-9 || requestedDistance > edgeDistance,
    blink: 0,
  };
}

export function crossedAngle(current, next, target, tolerance = 0.01) {
  return Math.abs(current - target) <= tolerance
    || (current - target) * (next - target) <= 0;
}

export function pointOnRay(pivot, direction, distance) {
  return { x: pivot.x + direction.x * distance, y: pivot.y + direction.y * distance };
}

export function hookTip(hook, pivot = PIVOT) {
  const direction = hook.phase === 'swing'
    ? angleToDirection(hook.swingAngle)
    : hook.flightDir;
  return pointOnRay(pivot, direction, HOOK_BASE_LENGTH + hook.extension);
}

export function clawRotation(direction) {
  return Math.atan2(-direction.x, direction.y);
}

export function pointInHitbox(point, item, hitbox) {
  return Math.abs(point.x - item.x) <= hitbox.halfW
    && Math.abs(point.y - item.y) <= hitbox.halfH;
}
