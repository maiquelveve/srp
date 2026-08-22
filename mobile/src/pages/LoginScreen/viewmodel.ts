import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { validateEmail, validatePassword } from './model';

const CREDENTIALS_ALERT_DURATION_MS = 4000;

export function useLoginScreenViewModel() {
  const { login } = useAuth();
  const [email, setEmailState] = useState('');
  const [password, setPasswordState] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [credentialsError, setCredentialsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!credentialsError) return;
    const timer = setTimeout(() => setCredentialsError(false), CREDENTIALS_ALERT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [credentialsError]);

  function setEmail(value: string): void {
    setEmailState(value);
    if (emailError) setEmailError(null);
    if (credentialsError) setCredentialsError(false);
  }

  function setPassword(value: string): void {
    setPasswordState(value);
    if (passwordError) setPasswordError(null);
    if (credentialsError) setCredentialsError(false);
  }

  function validate(): boolean {
    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    return !nextEmailError && !nextPasswordError;
  }

  async function handleSubmit(): Promise<void> {
    Keyboard.dismiss();
    setCredentialsError(false);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      // Navigation happens automatically via RootNavigator watching `user`.
    } catch {
      setCredentialsError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    emailError,
    passwordError,
    credentialsError,
    isSubmitting,
    handleSubmit,
  };
}
