/**
 * Targeted test for Dropdown trigger ARIA role per brief step 4:
 * "role='combobox' on trigger if typeahead, else role='button'"
 *
 * The Dropdown component implements first-letter typeahead (useTypeahead from
 * @floating-ui/react), so the trigger SHOULD expose role="combobox".
 * The implementer used a native <button> element instead (implicit role="button")
 * and removed useRole to avoid floating-ui assigning combobox.
 *
 * This test DOCUMENTS the current behavior and explicitly verifies whether it
 * matches the brief's spec. If it fails, the implementer must fix the role.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dropdown } from '../index';

const options = [
  { value: 'apple' as const, label: 'Apple' },
  { value: 'banana' as const, label: 'Banana' },
  { value: 'cherry' as const, label: 'Cherry' },
];

type Fruit = 'apple' | 'banana' | 'cherry';

describe('Dropdown trigger role — brief spec compliance', () => {
  /**
   * Per brief step 4: "role='combobox' on trigger if typeahead, else role='button'".
   * Typeahead IS implemented (useTypeahead). Trigger MUST be role="combobox".
   *
   * This test will FAIL if the trigger remains a plain <button> (role="button").
   * That is the intent — to surface the spec deviation for the implementer to fix.
   */
  it('trigger has role="combobox" because typeahead is implemented', () => {
    render(
      <Dropdown options={options} value={'apple' as Fruit} onChange={() => {}} ariaLabel="Pick a fruit" />,
    );
    // The trigger should expose role="combobox" per the brief spec
    // Currently this is a plain <button> (role="button"), which is a spec deviation
    expect(screen.getByRole('combobox', { name: 'Pick a fruit' })).toBeInTheDocument();
  });

  it('trigger has aria-haspopup="listbox"', () => {
    render(
      <Dropdown options={options} value={'apple' as Fruit} onChange={() => {}} ariaLabel="Pick a fruit" />,
    );
    const trigger = screen.getByRole('combobox', { name: 'Pick a fruit' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('first-letter typeahead: pressing "B" while menu is open navigates to Banana', () => {
    render(
      <Dropdown options={options} value={'apple' as Fruit} onChange={() => {}} ariaLabel="Pick a fruit" />,
    );

    // Open the dropdown
    const trigger = screen.getByRole('combobox', { name: 'Pick a fruit' });
    fireEvent.click(trigger);

    const listbox = screen.queryByRole('listbox');
    if (!listbox) return; // If menu didn't open, skip

    // Typeahead 'B' should navigate to 'Banana'
    fireEvent.keyDown(listbox, { key: 'b' });
    const bananaOption = screen.getByRole('option', { name: 'Banana' });
    // After typeahead, Banana should be the active item (data-active attribute)
    expect(bananaOption).toHaveAttribute('data-active', '');
  });
});
