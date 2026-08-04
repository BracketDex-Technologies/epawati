import { useEffect } from 'react';

type ValidatableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isValidatableControl(value: EventTarget | Element | RadioNodeList | null): value is ValidatableControl {
  return value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement;
}

function clearFormFieldError(control: ValidatableControl) {
  control.classList.remove('form-error-target', 'form-error-pulse');
  control.removeAttribute('aria-invalid');
  control.closest('label')?.classList.remove('has-field-error');
  control.closest('label')?.querySelector('.form-field-error')?.remove();
  if (control.dataset.appValidationError === 'true') {
    control.setCustomValidity('');
    delete control.dataset.appValidationError;
  }
}

function revealFormFieldError(control: ValidatableControl, message: string) {
  const label = control.closest('label');
  control.setAttribute('aria-invalid', 'true');
  control.classList.add('form-error-target');
  label?.classList.add('has-field-error');

  const existingMessage = label?.querySelector<HTMLElement>('.form-field-error');
  const messageElement = existingMessage ?? document.createElement('span');
  messageElement.className = 'form-field-error';
  messageElement.setAttribute('role', 'alert');
  messageElement.textContent = message;
  if (!existingMessage) label?.append(messageElement);

  control.classList.remove('form-error-pulse');
  void control.offsetWidth;
  control.classList.add('form-error-pulse');
  control.focus({ preventScroll: true });
  control.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

export function setFormFieldError(form: HTMLFormElement, name: string, message: string) {
  const control = form.elements.namedItem(name);
  if (!isValidatableControl(control)) return false;
  control.setCustomValidity(message);
  control.dataset.appValidationError = 'true';
  revealFormFieldError(control, message);
  return true;
}

export function focusFormErrorFromMessage(form: HTMLFormElement, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Please check this field.');
  const normalizedMessage = message.toLowerCase();
  const aliases: Record<string, string[]> = {
    adminEmail: ['admin email', 'email'],
    adminPassword: ['admin password', 'password'],
    contactPhone: ['contact phone', 'mobile', 'phone'],
    contributorPhone: ['contributor phone', 'mobile', 'phone'],
    groupId: ['group'],
    leaderUserId: ['leader'],
    slipLimit: ['slip limit', 'limit', 'quota'],
  };
  const controls = Array.from(form.elements).filter(isValidatableControl);
  const match = controls.find((control) => {
    if (!control.name) return false;
    const words = control.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return [words, ...(aliases[control.name] ?? [])].some((candidate) => normalizedMessage.includes(candidate));
  });
  if (!match) return false;
  match.setCustomValidity(message);
  match.dataset.appValidationError = 'true';
  revealFormFieldError(match, message);
  return true;
}

export function useGlobalFormErrorNavigation() {
  useEffect(() => {
    const handleInvalid = (event: Event) => {
      if (!isValidatableControl(event.target)) return;
      event.preventDefault();
      const control = event.target;
      const firstInvalid = control.form?.querySelector(':invalid');
      if (firstInvalid && firstInvalid !== control) return;
      revealFormFieldError(control, control.validationMessage || 'Please check this field.');
    };
    const handleInput = (event: Event) => {
      if (isValidatableControl(event.target)) clearFormFieldError(event.target);
    };
    document.addEventListener('invalid', handleInvalid, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    return () => {
      document.removeEventListener('invalid', handleInvalid, true);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('change', handleInput, true);
    };
  }, []);
}
