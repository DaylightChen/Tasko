import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dropdown } from '../index';

const options = [
  { value: 'a' as const, label: 'Option A' },
  { value: 'b' as const, label: 'Option B' },
  { value: 'c' as const, label: 'Option C', disabled: true },
];

type Val = 'a' | 'b' | 'c';

describe('Dropdown', () => {
  it('renders trigger with selected label', () => {
    render(<Dropdown options={options} value={'a' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });

  it('shows placeholder when value not in options list', () => {
    render(
      <Dropdown
        options={[]}
        value={'' as Val}
        onChange={() => {}}
        ariaLabel="Pick option"
        placeholder="Choose…"
      />,
    );
    expect(screen.getByText('Choose…')).toBeInTheDocument();
  });

  it('opens menu on trigger click', () => {
    render(<Dropdown options={options} value={'a' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    const trigger = screen.getByRole('combobox', { name: 'Pick option' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('calls onChange when option is selected', () => {
    const onChange = vi.fn();
    render(<Dropdown options={options} value={'a' as Val} onChange={onChange} ariaLabel="Pick option" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Pick option' }));
    fireEvent.click(screen.getByRole('option', { name: /Option B/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('closes menu after selection', () => {
    render(<Dropdown options={options} value={'a' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Pick option' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Option B/ }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks selected option with aria-selected', () => {
    render(<Dropdown options={options} value={'b' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    fireEvent.click(screen.getByRole('combobox'));
    const selectedOption = screen.getByRole('option', { name: /Option B/ });
    expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    const otherOption = screen.getByRole('option', { name: /Option A/ });
    expect(otherOption).toHaveAttribute('aria-selected', 'false');
  });

  it('marks disabled option with aria-disabled', () => {
    render(<Dropdown options={options} value={'a' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: /Option C/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not call onChange for disabled option', () => {
    const onChange = vi.fn();
    render(<Dropdown options={options} value={'a' as Val} onChange={onChange} ariaLabel="Pick option" />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: /Option C/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    render(<Dropdown options={options} value={'a' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('trigger has aria-expanded false when closed', () => {
    render(<Dropdown options={options} value={'a' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('trigger has aria-expanded true when open', () => {
    render(<Dropdown options={options} value={'a' as Val} onChange={() => {}} ariaLabel="Pick option" />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  });
});
