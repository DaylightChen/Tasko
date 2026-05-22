import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextInput } from '../index';

describe('TextInput', () => {
  it('renders with label', () => {
    render(<TextInput label="Name" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('renders placeholder', () => {
    render(<TextInput placeholder="Enter name" value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
  });

  it('shows current value', () => {
    render(<TextInput value="Hello" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('Hello');
  });

  it('calls onChange when value changes', () => {
    const onChange = vi.fn();
    render(<TextInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('sets aria-required on required field', () => {
    render(<TextInput value="" onChange={() => {}} required label="Name" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-required', 'true');
  });

  it('sets aria-invalid and aria-describedby on error', () => {
    render(<TextInput value="" onChange={() => {}} error="Field required" label="Name" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
    expect(screen.getByText('Field required')).toBeInTheDocument();
  });

  it('shows helper text when no error', () => {
    render(<TextInput value="" onChange={() => {}} helper="Hint text" />);
    expect(screen.getByText('Hint text')).toBeInTheDocument();
  });

  it('is disabled when disabled prop set', () => {
    render(<TextInput value="" onChange={() => {}} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('is readOnly when readOnly prop set', () => {
    render(<TextInput value="readonly" onChange={() => {}} readOnly />);
    expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
  });

  it('shows error icon when error is present', () => {
    render(<TextInput value="" onChange={() => {}} error="Error message" />);
    // AlertCircle renders as svg with aria-hidden
    const container = screen.getByText('Error message').closest('p');
    expect(container?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders sm size', () => {
    render(<TextInput value="" onChange={() => {}} size="sm" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('data-size', 'sm');
  });

  it('generates unique ids for label association when no id provided', () => {
    render(
      <div>
        <TextInput label="First" value="" onChange={() => {}} />
        <TextInput label="Second" value="" onChange={() => {}} />
      </div>,
    );
    const first = screen.getByLabelText('First');
    const second = screen.getByLabelText('Second');
    expect(first.id).not.toBe(second.id);
  });
});
