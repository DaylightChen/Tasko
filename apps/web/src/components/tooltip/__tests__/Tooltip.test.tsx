import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip } from '../index';

describe('Tooltip', () => {
  it('does not show tooltip initially', () => {
    render(
      <Tooltip content="Settings">
        <button type="button">⚙</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on focus', async () => {
    render(
      <Tooltip content="Settings tooltip" delay={0}>
        <button type="button">⚙</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    act(() => {
      trigger.focus();
      fireEvent.focus(trigger);
    });
    // tooltip should appear after focus (delay=0)
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Settings tooltip');
  });

  it('hides tooltip on blur', async () => {
    render(
      <Tooltip content="Settings tooltip" delay={0}>
        <button type="button">⚙</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    act(() => {
      trigger.focus();
      fireEvent.focus(trigger);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => {
      trigger.blur();
      fireEvent.blur(trigger);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('sets aria-describedby on trigger when tooltip is visible', () => {
    render(
      <Tooltip content="Tooltip text" delay={0}>
        <button type="button">Trigger</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    act(() => {
      fireEvent.focus(trigger);
    });
    const tooltip = screen.getByRole('tooltip');
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBe(tooltip.id);
  });

  it('renders with custom content', () => {
    render(
      <Tooltip content="My custom tooltip" delay={0}>
        <button type="button">hover me</button>
      </Tooltip>,
    );
    act(() => {
      fireEvent.focus(screen.getByRole('button'));
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('My custom tooltip');
  });
});
