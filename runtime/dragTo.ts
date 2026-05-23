import type { Page, Locator } from 'playwright';

/**
 * V2 dragTo - drag an element to a target using locator.dragTo().
 * NEVER use mouse.move(x,y) — coordinates break under virtual scroll / rerender.
 */
export async function dragTo(
  page: Page,
  sourceSelectors: string[],
  targetSelectors: string[]
): Promise<void> {
  const { smartLocate } = await import('./smartLocate');

  const source = await smartLocate(page, sourceSelectors);
  const target = await smartLocate(page, targetSelectors);

  console.log('[DRAG] dragging element...');
  await source.dragTo(target);
  console.log('[DRAG] drag complete');
}

/**
 * Alternative: dispatch native drag events for React DnD backends.
 */
export async function dragByDispatch(
  source: Locator,
  target: Locator
): Promise<void> {
  await source.dispatchEvent('dragstart');
  await target.dispatchEvent('dragover');
  await target.dispatchEvent('drop');
  await source.dispatchEvent('dragend');
  console.log('[DRAG] dispatch drag complete');
}
