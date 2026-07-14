# ERR_001 — Division Returns NaN Instead of Throwing

## Summary
When dividing by zero without proper guard, JavaScript returns `Infinity` or `NaN` instead of throwing an error, causing silent data corruption downstream.

## Symptoms
- Calculations produce `NaN` or `Infinity` values
- No error is thrown, so the bug propagates silently
- Display shows "NaN" to end users

## Root Cause
JavaScript's `/` operator does not throw on division by zero. It returns `Infinity` for non-zero numerators and `NaN` for `0/0`.

## Solution
Add an explicit guard in the `divide` function:
```js
function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
```

## Prevention
- Always include a TASK-layer diagnostic that tests division by zero edge cases
- Use `task-002-division-zero.clinic.js` as a reference

## Related
- TASK-002: Division by Zero Handling
- `task-002-division-zero.clinic.js`
